/**
 * OpenAI Provider — Implementação real do provider para OpenAI Chat Completions API.
 * Utiliza fetch() para chamadas HTTP, compatível com browser/Tauri webview.
 */

import type { LLMProvider as LLMProviderType } from "../../../types/agents";
import type { ILLMProvider, LLMRequest, LLMResponse, LLMStreamChunk } from "../llm-gateway";

/** Configuração específica do OpenAI provider */
export interface OpenAIProviderConfig {
  /** Chave de API da OpenAI */
  apiKey: string;
  /** URL base da API (padrão: https://api.openai.com/v1) */
  baseUrl: string;
  /** ID da organização (opcional) */
  organizationId: string;
  /** Timeout de requisição em ms */
  timeoutMs: number;
}

/** Configuração padrão */
const DEFAULT_CONFIG: OpenAIProviderConfig = {
  apiKey: "",
  baseUrl: "https://api.openai.com/v1",
  organizationId: "",
  timeoutMs: 60_000,
};

/** Tabela de preços por modelo (USD por milhão de tokens) */
interface ModelPricing {
  inputPerMillion: number;
  outputPerMillion: number;
}

const PRICING: Record<string, ModelPricing> = {
  "gpt-4o": { inputPerMillion: 2.5, outputPerMillion: 10 },
  "gpt-4o-mini": { inputPerMillion: 0.15, outputPerMillion: 0.6 },
  "o3-mini": { inputPerMillion: 1.1, outputPerMillion: 4.4 },
};

/** Formato de mensagem para a API OpenAI */
interface OpenAIMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

/** Bloco de escolha na resposta da API */
interface OpenAIChoice {
  index: number;
  message: {
    role: "assistant";
    content: string | null;
  };
  finish_reason: "stop" | "length" | "content_filter" | null;
}

/** Informações de uso na resposta da API */
interface OpenAIUsage {
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
}

/** Resposta completa da API Chat Completions */
interface OpenAIChatResponse {
  id: string;
  object: "chat.completion";
  created: number;
  model: string;
  choices: OpenAIChoice[];
  usage: OpenAIUsage;
}

/** Delta de conteúdo em streaming */
interface OpenAIStreamDelta {
  role?: "assistant";
  content?: string | null;
}

/** Escolha em chunk de streaming */
interface OpenAIStreamChoice {
  index: number;
  delta: OpenAIStreamDelta;
  finish_reason: "stop" | "length" | "content_filter" | null;
}

/** Chunk de streaming da API */
interface OpenAIStreamChunk {
  id: string;
  object: "chat.completion.chunk";
  created: number;
  model: string;
  choices: OpenAIStreamChoice[];
  usage?: OpenAIUsage | null;
}

/**
 * Provider para OpenAI (GPT-4o, GPT-4o-mini, o3-mini, etc.).
 * Faz chamadas reais à API OpenAI Chat Completions via fetch().
 */
export class OpenAIProvider implements ILLMProvider {
  readonly providerType: LLMProviderType = "openai";
  readonly displayName = "OpenAI";

  private config: OpenAIProviderConfig;

  constructor(config: Partial<OpenAIProviderConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Verifica se o provider está disponível (apiKey configurada).
   */
  async isAvailable(): Promise<boolean> {
    return this.config.apiKey.length > 0;
  }

  /**
   * Lista modelos suportados pela OpenAI.
   */
  async listModels(): Promise<string[]> {
    return [
      "gpt-4o",
      "gpt-4o-mini",
      "o3-mini",
    ];
  }

  /**
   * Envia uma requisição à API OpenAI e aguarda resposta completa.
   */
  async send(request: LLMRequest): Promise<LLMResponse> {
    const startTime = Date.now();
    const messages = this.buildOpenAIMessages(request);

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
        headers: this.buildHeaders(),
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

    const data = (await response.json()) as OpenAIChatResponse;
    const durationMs = Date.now() - startTime;

    const firstChoice = data.choices[0];
    const content = firstChoice?.message.content ?? "";
    const inputTokens = data.usage.prompt_tokens;
    const outputTokens = data.usage.completion_tokens;
    const costUsd = this.calculateCost(request.model, inputTokens, outputTokens);

    const finishReason: LLMResponse["finishReason"] =
      firstChoice?.finish_reason === "length" ? "max_tokens" : "stop";

    return {
      content,
      model: data.model,
      provider: this.providerType,
      inputTokens,
      outputTokens,
      costUsd,
      durationMs,
      finishReason,
    };
  }

  /**
   * Envia uma requisição com streaming via SSE à API OpenAI.
   * Lida com chunks parciais corretamente.
   */
  async *stream(request: LLMRequest): AsyncGenerator<LLMStreamChunk, void, unknown> {
    const messages = this.buildOpenAIMessages(request);

    const body = {
      model: request.model,
      messages,
      temperature: request.temperature,
      max_tokens: request.maxTokens,
      stream: true,
      stream_options: { include_usage: true },
    };

    let response: Response;
    try {
      response = await fetch(`${this.config.baseUrl}/chat/completions`, {
        method: "POST",
        headers: this.buildHeaders(),
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

          let chunk: OpenAIStreamChunk;
          try {
            chunk = JSON.parse(jsonStr) as OpenAIStreamChunk;
          } catch {
            // JSON incompleto — ignorar
            continue;
          }

          // Atualizar tokens se informação de uso disponível
          if (chunk.usage) {
            accumulatedTokens = chunk.usage.completion_tokens;
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
   * Constrói os headers para chamadas à API OpenAI.
   */
  private buildHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      "Authorization": `Bearer ${this.config.apiKey}`,
      "Content-Type": "application/json",
    };

    if (this.config.organizationId) {
      headers["OpenAI-Organization"] = this.config.organizationId;
    }

    return headers;
  }

  /**
   * Converte as mensagens do LLMRequest para formato OpenAI.
   * System prompt e mensagens de role "system" são incluídas diretamente.
   */
  private buildOpenAIMessages(request: LLMRequest): OpenAIMessage[] {
    const messages: OpenAIMessage[] = [];

    // Adicionar system prompt se presente
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
      content: `[Erro OpenAIProvider] ${errorMessage}`,
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
