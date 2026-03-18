/**
 * LM Studio Provider — Implementação do provider para LM Studio (API compatível com OpenAI).
 * LM Studio expõe uma API local no formato OpenAI em http://localhost:1234/v1.
 * Utiliza fetch() para chamadas HTTP, compatível com browser/Tauri webview.
 */

import type { LLMProvider as LLMProviderType } from "../../../types/agents";
import type { ILLMProvider, LLMRequest, LLMResponse, LLMStreamChunk } from "../llm-gateway";

/** Configuração específica do LM Studio provider */
export interface LMStudioProviderConfig {
  /** URL base da API (padrão: http://localhost:1234/v1) */
  baseUrl: string;
  /** Timeout de requisição em ms */
  timeoutMs: number;
}

/** Configuração padrão */
const DEFAULT_CONFIG: LMStudioProviderConfig = {
  baseUrl: "http://localhost:1234/v1",
  timeoutMs: 120_000,
};

/** Formato de mensagem compatível com OpenAI */
interface OpenAICompatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

/** Escolha na resposta da API */
interface OpenAICompatChoice {
  index: number;
  message: {
    role: "assistant";
    content: string | null;
  };
  finish_reason: "stop" | "length" | null;
}

/** Uso de tokens na resposta */
interface OpenAICompatUsage {
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
}

/** Resposta completa da API compatível */
interface OpenAICompatResponse {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: OpenAICompatChoice[];
  usage: OpenAICompatUsage;
}

/** Delta em chunk de streaming */
interface StreamDelta {
  role?: "assistant";
  content?: string | null;
}

/** Escolha em chunk de streaming */
interface StreamChoice {
  index: number;
  delta: StreamDelta;
  finish_reason: "stop" | "length" | null;
}

/** Chunk de streaming */
interface StreamChunk {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: StreamChoice[];
}

/** Modelo retornado pela API /models */
interface LMStudioModel {
  id: string;
  object: string;
  owned_by: string;
}

/** Resposta da API /models */
interface LMStudioModelsResponse {
  data: LMStudioModel[];
  object: string;
}

/**
 * Provider para LM Studio (API local compatível com OpenAI).
 * Custo é sempre zero — tudo roda localmente.
 */
export class LMStudioProvider implements ILLMProvider {
  readonly providerType: LLMProviderType = "lm-studio";
  readonly displayName = "LM Studio (Local)";

  private config: LMStudioProviderConfig;

  constructor(config: Partial<LMStudioProviderConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Verifica se o LM Studio está rodando via GET /models.
   */
  async isAvailable(): Promise<boolean> {
    try {
      const response = await fetch(`${this.config.baseUrl}/models`, {
        method: "GET",
        signal: AbortSignal.timeout(5_000),
      });
      return response.ok;
    } catch {
      return false;
    }
  }

  /**
   * Lista modelos disponíveis no LM Studio via GET /models.
   */
  async listModels(): Promise<string[]> {
    try {
      const response = await fetch(`${this.config.baseUrl}/models`, {
        method: "GET",
        signal: AbortSignal.timeout(5_000),
      });

      if (!response.ok) return [];

      const data = (await response.json()) as LMStudioModelsResponse;
      return data.data.map((m) => m.id);
    } catch {
      return [];
    }
  }

  /**
   * Envia uma requisição via POST /chat/completions (formato OpenAI).
   */
  async send(request: LLMRequest): Promise<LLMResponse> {
    const startTime = Date.now();
    const messages = this.buildMessages(request);

    const body = {
      model: request.model,
      messages,
      temperature: request.temperature,
      max_tokens: request.maxTokens,
    };

    let response: Response;
    try {
      response = await fetch(`${this.config.baseUrl}/chat/completions`, {
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

    const data = (await response.json()) as OpenAICompatResponse;
    const durationMs = Date.now() - startTime;

    const firstChoice = data.choices[0];
    const content = firstChoice?.message.content ?? "";
    const inputTokens = data.usage.prompt_tokens;
    const outputTokens = data.usage.completion_tokens;

    const finishReason: LLMResponse["finishReason"] =
      firstChoice?.finish_reason === "length" ? "max_tokens" : "stop";

    return {
      content,
      model: data.model,
      provider: this.providerType,
      inputTokens,
      outputTokens,
      costUsd: 0,
      durationMs,
      finishReason,
    };
  }

  /**
   * Envia uma requisição com streaming via SSE (formato OpenAI).
   * Lida com chunks parciais corretamente.
   */
  async *stream(request: LLMRequest): AsyncGenerator<LLMStreamChunk, void, unknown> {
    const messages = this.buildMessages(request);

    const body = {
      model: request.model,
      messages,
      temperature: request.temperature,
      max_tokens: request.maxTokens,
      stream: true,
    };

    let response: Response;
    try {
      response = await fetch(`${this.config.baseUrl}/chat/completions`, {
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
          if (jsonStr === "[DONE]") {
            yield { content: "", done: true, accumulatedTokens };
            return;
          }

          let chunk: StreamChunk;
          try {
            chunk = JSON.parse(jsonStr) as StreamChunk;
          } catch {
            // JSON incompleto — ignorar
            continue;
          }

          const firstChoice = chunk.choices[0];
          if (!firstChoice) continue;

          const deltaContent = firstChoice.delta.content;
          if (deltaContent) {
            accumulatedTokens++;
            yield {
              content: deltaContent,
              done: false,
              accumulatedTokens,
            };
          }

          if (firstChoice.finish_reason === "stop" || firstChoice.finish_reason === "length") {
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
   * Converte as mensagens do LLMRequest para formato OpenAI compatível.
   */
  private buildMessages(request: LLMRequest): OpenAICompatMessage[] {
    const messages: OpenAICompatMessage[] = [];

    if (request.systemPrompt) {
      messages.push({ role: "system", content: request.systemPrompt });
    }

    for (const msg of request.messages) {
      messages.push({
        role: msg.role,
        content: msg.content,
      });
    }

    return messages;
  }

  /**
   * Constrói uma resposta de erro padronizada.
   */
  private buildErrorResponse(request: LLMRequest, startTime: number, errorMessage: string): LLMResponse {
    return {
      content: `[Erro LMStudioProvider] ${errorMessage}`,
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
