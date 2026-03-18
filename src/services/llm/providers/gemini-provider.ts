/**
 * Gemini Provider — Implementação do provider para Google Gemini API.
 * Utiliza fetch() para chamadas HTTP, compatível com browser/Tauri webview.
 */

import type { LLMProvider as LLMProviderType } from "../../../types/agents";
import type { ILLMProvider, LLMRequest, LLMResponse, LLMStreamChunk } from "../llm-gateway";

/** Configuração específica do Gemini provider */
export interface GeminiProviderConfig {
  /** Chave de API do Google AI */
  apiKey: string;
  /** URL base da API (padrão: https://generativelanguage.googleapis.com) */
  baseUrl: string;
  /** Timeout de requisição em ms */
  timeoutMs: number;
}

/** Configuração padrão */
const DEFAULT_CONFIG: GeminiProviderConfig = {
  apiKey: "",
  baseUrl: "https://generativelanguage.googleapis.com",
  timeoutMs: 120_000,
};

/** Tabela de preços por modelo (USD por milhão de tokens) */
interface ModelPricing {
  inputPerMillion: number;
  outputPerMillion: number;
}

const PRICING: Record<string, ModelPricing> = {
  "gemini-2.0-flash": { inputPerMillion: 0.10, outputPerMillion: 0.40 },
  "gemini-2.5-pro": { inputPerMillion: 1.25, outputPerMillion: 10 },
  "gemini-1.5-flash": { inputPerMillion: 0.075, outputPerMillion: 0.30 },
};

/** Parte de conteúdo para a API Gemini */
interface GeminiPart {
  text: string;
}

/** Bloco de conteúdo da API Gemini */
interface GeminiContent {
  role: "user" | "model";
  parts: GeminiPart[];
}

/** Configuração de geração da API Gemini */
interface GeminiGenerationConfig {
  temperature: number;
  maxOutputTokens: number;
}

/** Candidato na resposta da API */
interface GeminiCandidate {
  content: {
    parts: GeminiPart[];
    role: string;
  };
  finishReason: "STOP" | "MAX_TOKENS" | "SAFETY" | "RECITATION" | "OTHER" | string;
}

/** Metadados de uso na resposta */
interface GeminiUsageMetadata {
  promptTokenCount: number;
  candidatesTokenCount: number;
  totalTokenCount: number;
}

/** Resposta completa da API generateContent */
interface GeminiGenerateResponse {
  candidates: GeminiCandidate[];
  usageMetadata: GeminiUsageMetadata;
}

/** Resposta de streaming (cada chunk SSE) */
interface GeminiStreamResponse {
  candidates?: GeminiCandidate[];
  usageMetadata?: GeminiUsageMetadata;
}

/** Instrução de sistema para a API Gemini */
interface GeminiSystemInstruction {
  parts: GeminiPart[];
}

/**
 * Provider para Google Gemini.
 * Faz chamadas reais à API Gemini via fetch().
 */
export class GeminiProvider implements ILLMProvider {
  readonly providerType: LLMProviderType = "gemini";
  readonly displayName = "Google Gemini";

  private config: GeminiProviderConfig;

  constructor(config: Partial<GeminiProviderConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Verifica se o provider está disponível (apiKey configurada).
   */
  async isAvailable(): Promise<boolean> {
    return this.config.apiKey.length > 0;
  }

  /**
   * Lista modelos suportados pelo Gemini.
   */
  async listModels(): Promise<string[]> {
    return [
      "gemini-2.5-pro",
      "gemini-2.0-flash",
      "gemini-1.5-flash",
    ];
  }

  /**
   * Envia uma requisição à API Gemini e aguarda resposta completa.
   */
  async send(request: LLMRequest): Promise<LLMResponse> {
    const startTime = Date.now();
    const { contents, systemInstruction, generationConfig } = this.buildGeminiPayload(request);

    const body: Record<string, unknown> = {
      contents,
      generationConfig,
    };

    if (systemInstruction) {
      body.systemInstruction = systemInstruction;
    }

    const url = `${this.config.baseUrl}/v1beta/models/${request.model}:generateContent?key=${this.config.apiKey}`;

    let response: Response;
    try {
      response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(this.config.timeoutMs),
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return this.buildErrorResponse(request, startTime, `Erro de rede: ${message}`);
    }

    if (!response.ok) {
      const errorText = await response.text().catch(() => "Corpo da resposta indisponível");
      return this.buildErrorResponse(
        request,
        startTime,
        `API retornou status ${response.status}: ${errorText}`,
      );
    }

    const data = (await response.json()) as GeminiGenerateResponse;
    const durationMs = Date.now() - startTime;

    const firstCandidate = data.candidates[0];
    const content = firstCandidate?.content.parts
      .map((p) => p.text)
      .join("") ?? "";

    const inputTokens = data.usageMetadata.promptTokenCount;
    const outputTokens = data.usageMetadata.candidatesTokenCount;
    const costUsd = this.calculateCost(request.model, inputTokens, outputTokens);

    const finishReason: LLMResponse["finishReason"] =
      firstCandidate?.finishReason === "MAX_TOKENS" ? "max_tokens" : "stop";

    return {
      content,
      model: request.model,
      provider: this.providerType,
      inputTokens,
      outputTokens,
      costUsd,
      durationMs,
      finishReason,
    };
  }

  /**
   * Envia uma requisição com streaming via SSE à API Gemini.
   * Usa o endpoint streamGenerateContent com alt=sse.
   */
  async *stream(request: LLMRequest): AsyncGenerator<LLMStreamChunk, void, unknown> {
    const { contents, systemInstruction, generationConfig } = this.buildGeminiPayload(request);

    const body: Record<string, unknown> = {
      contents,
      generationConfig,
    };

    if (systemInstruction) {
      body.systemInstruction = systemInstruction;
    }

    const url = `${this.config.baseUrl}/v1beta/models/${request.model}:streamGenerateContent?alt=sse&key=${this.config.apiKey}`;

    let response: Response;
    try {
      response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(this.config.timeoutMs),
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      yield { content: `[Erro] Falha na conexão: ${message}`, done: true, accumulatedTokens: null };
      return;
    }

    if (!response.ok) {
      const errorText = await response.text().catch(() => "Corpo da resposta indisponível");
      yield {
        content: `[Erro] API retornou status ${response.status}: ${errorText}`,
        done: true,
        accumulatedTokens: null,
      };
      return;
    }

    if (!response.body) {
      yield { content: "[Erro] Resposta sem corpo de stream", done: true, accumulatedTokens: null };
      return;
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let accumulatedTokens = 0;

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        // Processar linhas completas do SSE
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed.startsWith("data: ")) continue;

          const jsonStr = trimmed.slice(6);

          let chunk: GeminiStreamResponse;
          try {
            chunk = JSON.parse(jsonStr) as GeminiStreamResponse;
          } catch {
            // JSON incompleto — ignorar
            continue;
          }

          // Atualizar tokens acumulados se disponível
          if (chunk.usageMetadata) {
            accumulatedTokens = chunk.usageMetadata.candidatesTokenCount;
          }

          const firstCandidate = chunk.candidates?.[0];
          if (!firstCandidate) continue;

          const text = firstCandidate.content.parts
            .map((p) => p.text)
            .join("");

          if (text) {
            yield {
              content: text,
              done: false,
              accumulatedTokens,
            };
          }

          // Verificar se é o último chunk
          if (
            firstCandidate.finishReason === "STOP" ||
            firstCandidate.finishReason === "MAX_TOKENS"
          ) {
            yield { content: "", done: true, accumulatedTokens };
            return;
          }
        }
      }
    } finally {
      reader.releaseLock();
    }

    // Se o stream terminou sem sinal explícito
    yield { content: "", done: true, accumulatedTokens };
  }

  /**
   * Constrói o payload para a API Gemini.
   * System prompt vai em systemInstruction, mensagens em contents.
   * A API Gemini usa "model" em vez de "assistant" para o papel do modelo.
   */
  private buildGeminiPayload(request: LLMRequest): {
    contents: GeminiContent[];
    systemInstruction: GeminiSystemInstruction | null;
    generationConfig: GeminiGenerationConfig;
  } {
    let systemText = request.systemPrompt ?? "";

    const contents: GeminiContent[] = [];

    for (const msg of request.messages) {
      if (msg.role === "system") {
        // Concatenar mensagens de sistema
        systemText = systemText
          ? `${systemText}\n\n${msg.content}`
          : msg.content;
      } else {
        contents.push({
          role: msg.role === "assistant" ? "model" : "user",
          parts: [{ text: msg.content }],
        });
      }
    }

    const systemInstruction: GeminiSystemInstruction | null = systemText
      ? { parts: [{ text: systemText }] }
      : null;

    const generationConfig: GeminiGenerationConfig = {
      temperature: request.temperature,
      maxOutputTokens: request.maxTokens,
    };

    return { contents, systemInstruction, generationConfig };
  }

  /**
   * Calcula o custo em USD com base no modelo e tokens consumidos.
   */
  private calculateCost(model: string, inputTokens: number, outputTokens: number): number {
    const pricing = PRICING[model];
    if (!pricing) return 0;

    return (
      (inputTokens / 1_000_000) * pricing.inputPerMillion +
      (outputTokens / 1_000_000) * pricing.outputPerMillion
    );
  }

  /**
   * Constrói uma resposta de erro padronizada.
   */
  private buildErrorResponse(request: LLMRequest, startTime: number, errorMessage: string): LLMResponse {
    return {
      content: `[Erro GeminiProvider] ${errorMessage}`,
      model: request.model,
      provider: this.providerType,
      inputTokens: 0,
      outputTokens: 0,
      costUsd: 0,
      durationMs: Date.now() - startTime,
      finishReason: "error",
    };
  }
}
