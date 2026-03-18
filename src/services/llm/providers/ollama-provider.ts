/**
 * Ollama Provider — Implementação real do provider para Ollama (execução local).
 * Utiliza fetch() para chamadas HTTP, compatível com browser/Tauri webview.
 */

import type { LLMProvider as LLMProviderType } from "../../../types/agents";
import type { ILLMProvider, LLMRequest, LLMResponse, LLMStreamChunk } from "../llm-gateway";

/** Configuração específica do Ollama provider */
export interface OllamaProviderConfig {
  /** URL base da API local do Ollama (padrão: http://localhost:11434) */
  baseUrl: string;
  /** Timeout de requisição em ms */
  timeoutMs: number;
  /** Se deve manter o modelo carregado na memória */
  keepAlive: boolean;
}

/** Configuração padrão */
const DEFAULT_CONFIG: OllamaProviderConfig = {
  baseUrl: "http://localhost:11434",
  timeoutMs: 120_000,
  keepAlive: true,
};

/** Formato de mensagem para a API do Ollama */
interface OllamaMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

/** Resposta completa (stream: false) da API /api/chat */
interface OllamaChatResponse {
  model: string;
  created_at: string;
  message: OllamaMessage;
  done: boolean;
  total_duration?: number;
  prompt_eval_count?: number;
  eval_count?: number;
}

/** Modelo retornado por /api/tags */
interface OllamaModelInfo {
  name: string;
  model: string;
  modified_at: string;
  size: number;
}

/** Resposta da API /api/tags */
interface OllamaTagsResponse {
  models: OllamaModelInfo[];
}

/**
 * Provider para Ollama (execução local com GPU).
 * Custo é sempre zero — tudo roda localmente.
 */
export class OllamaProvider implements ILLMProvider {
  readonly providerType: LLMProviderType = "ollama";
  readonly displayName = "Ollama (Local)";

  private config: OllamaProviderConfig;

  constructor(config: Partial<OllamaProviderConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Verifica se o Ollama está rodando localmente via GET /api/tags.
   */
  async isAvailable(): Promise<boolean> {
    try {
      const response = await fetch(`${this.config.baseUrl}/api/tags`, {
        method: "GET",
        signal: AbortSignal.timeout(5_000),
      });
      return response.ok;
    } catch {
      return false;
    }
  }

  /**
   * Lista modelos disponíveis no Ollama local via GET /api/tags.
   * Em caso de falha, retorna lista vazia.
   */
  async listModels(): Promise<string[]> {
    try {
      const response = await fetch(`${this.config.baseUrl}/api/tags`, {
        method: "GET",
        signal: AbortSignal.timeout(5_000),
      });

      if (!response.ok) return [];

      const data = (await response.json()) as OllamaTagsResponse;
      return data.models.map((m) => m.name);
    } catch {
      return [];
    }
  }

  /**
   * Envia uma requisição ao Ollama via POST /api/chat (stream: false).
   */
  async send(request: LLMRequest): Promise<LLMResponse> {
    const startTime = Date.now();
    const messages = this.buildOllamaMessages(request);

    const body = {
      model: request.model,
      messages,
      stream: false,
      options: {
        temperature: request.temperature,
        num_predict: request.maxTokens,
      },
      keep_alive: this.config.keepAlive ? "5m" : "0",
    };

    let response: Response;
    try {
      response = await fetch(`${this.config.baseUrl}/api/chat`, {
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

    const data = (await response.json()) as OllamaChatResponse;
    const durationMs = Date.now() - startTime;

    const inputTokens = data.prompt_eval_count ?? 0;
    const outputTokens = data.eval_count ?? 0;

    return {
      content: data.message.content,
      model: data.model,
      provider: this.providerType,
      inputTokens,
      outputTokens,
      costUsd: 0,
      durationMs,
      finishReason: "stop",
    };
  }

  /**
   * Envia uma requisição com streaming via POST /api/chat (stream: true).
   * O Ollama retorna NDJSON — cada linha é um objeto JSON separado.
   */
  async *stream(request: LLMRequest): AsyncGenerator<LLMStreamChunk, void, unknown> {
    const messages = this.buildOllamaMessages(request);

    const body = {
      model: request.model,
      messages,
      stream: true,
      options: {
        temperature: request.temperature,
        num_predict: request.maxTokens,
      },
      keep_alive: this.config.keepAlive ? "5m" : "0",
    };

    let response: Response;
    try {
      response = await fetch(`${this.config.baseUrl}/api/chat`, {
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

        // NDJSON — cada linha é um JSON completo
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed) continue;

          let chunk: OllamaChatResponse;
          try {
            chunk = JSON.parse(trimmed) as OllamaChatResponse;
          } catch {
            // Linha incompleta — ignorar
            continue;
          }

          if (chunk.done) {
            // Chunk final com contagem de tokens
            accumulatedTokens = chunk.eval_count ?? accumulatedTokens;
            yield { content: "", done: true, accumulatedTokens };
            return;
          }

          accumulatedTokens++;
          yield {
            content: chunk.message.content,
            done: false,
            accumulatedTokens,
          };
        }
      }
    } finally {
      reader.releaseLock();
    }

    // Se o stream terminou sem chunk done=true
    yield { content: "", done: true, accumulatedTokens };
  }

  /**
   * Converte as mensagens do LLMRequest para formato Ollama.
   */
  private buildOllamaMessages(request: LLMRequest): OllamaMessage[] {
    const messages: OllamaMessage[] = [];

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
   * Constrói uma resposta de erro padronizada.
   */
  private buildErrorResponse(request: LLMRequest, startTime: number, errorMessage: string): LLMResponse {
    return {
      content: `[Erro OllamaProvider] ${errorMessage}`,
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
