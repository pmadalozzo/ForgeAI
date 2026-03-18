/**
 * LLM Gateway — Gateway central para comunicação com provedores de LLM.
 * Cada agente pode usar um provider diferente (Claude, OpenAI, Gemini, Ollama, LM Studio).
 * Rastreia uso de tokens e custo por agente.
 */

import type { LLMProvider as LLMProviderType } from "../../types/agents";
import { ClaudeProvider } from "./providers/claude-provider";
import type { ClaudeProviderConfig } from "./providers/claude-provider";
import { OpenAIProvider } from "./providers/openai-provider";
import type { OpenAIProviderConfig } from "./providers/openai-provider";
import { OllamaProvider } from "./providers/ollama-provider";
import type { OllamaProviderConfig } from "./providers/ollama-provider";
import { GeminiProvider } from "./providers/gemini-provider";
import type { GeminiProviderConfig } from "./providers/gemini-provider";
import { LMStudioProvider } from "./providers/lmstudio-provider";
import type { LMStudioProviderConfig } from "./providers/lmstudio-provider";

/** Mensagem no formato de chat (role + content) */
export interface LLMMessage {
  /** Papel da mensagem */
  role: "system" | "user" | "assistant";
  /** Conteúdo textual */
  content: string;
}

/** Requisição para o LLM */
export interface LLMRequest {
  /** ID do agente solicitante */
  agentId: string;
  /** Mensagens do contexto */
  messages: LLMMessage[];
  /** Modelo específico a ser usado (ex: "claude-sonnet-4-20250514", "gpt-4o") */
  model: string;
  /** Temperatura de geração (0-2) */
  temperature: number;
  /** Número máximo de tokens na resposta */
  maxTokens: number;
  /** Instruções de sistema (system prompt) */
  systemPrompt: string | null;
  /** Metadados extras para o provider */
  metadata: Record<string, string>;
  /** Sinal para cancelar a requisição */
  signal?: AbortSignal;
}

/** Resposta completa do LLM */
export interface LLMResponse {
  /** Conteúdo da resposta */
  content: string;
  /** Modelo que gerou a resposta */
  model: string;
  /** Provider utilizado */
  provider: LLMProviderType;
  /** Tokens de entrada consumidos */
  inputTokens: number;
  /** Tokens de saída gerados */
  outputTokens: number;
  /** Custo estimado em USD */
  costUsd: number;
  /** Duração total em milissegundos */
  durationMs: number;
  /** Razão de parada */
  finishReason: "stop" | "max_tokens" | "error";
}

/** Chunk de streaming do LLM */
export interface LLMStreamChunk {
  /** Fragmento de texto recebido */
  content: string;
  /** Se este é o último chunk */
  done: boolean;
  /** Tokens acumulados até o momento (se disponível) */
  accumulatedTokens: number | null;
  /** Se true, substitui todo o conteúdo acumulado em vez de concatenar */
  replace?: boolean;
  /** Tokens de input (enviado no último chunk para tracking) */
  inputTokens?: number;
  /** Custo em USD (enviado no último chunk para tracking) */
  costUsd?: number;
}

/** Rastreamento de uso de tokens */
export interface TokenUsage {
  /** ID do agente */
  agentId: string;
  /** Provider utilizado */
  provider: LLMProviderType;
  /** Modelo utilizado */
  model: string;
  /** Total de tokens de entrada */
  totalInputTokens: number;
  /** Total de tokens de saída */
  totalOutputTokens: number;
  /** Custo total em USD */
  totalCostUsd: number;
  /** Número de requisições */
  requestCount: number;
}

/**
 * Interface que todo provider de LLM deve implementar.
 * Garante uniformidade de comportamento entre providers diferentes.
 */
export interface ILLMProvider {
  /** Identificador do provider */
  readonly providerType: LLMProviderType;
  /** Nome de exibição */
  readonly displayName: string;
  /** Se o provider está disponível/configurado */
  isAvailable(): Promise<boolean>;
  /** Lista de modelos suportados */
  listModels(): Promise<string[]>;
  /** Envia uma requisição e aguarda resposta completa */
  send(request: LLMRequest): Promise<LLMResponse>;
  /** Envia uma requisição com streaming de resposta */
  stream(request: LLMRequest): AsyncGenerator<LLMStreamChunk, void, unknown>;
}

/**
 * Registro de providers e gateway central para LLMs.
 * Gerencia providers, seleção de modelo e rastreamento de uso.
 */
export class LLMGateway {
  /** Providers registrados por tipo */
  private providers: Map<LLMProviderType, ILLMProvider> = new Map();

  /** Mapeamento de agente → provider */
  private agentProviderMap: Map<string, LLMProviderType> = new Map();

  /** Mapeamento de agente → modelo */
  private agentModelMap: Map<string, string> = new Map();

  /** Rastreamento de uso por agente */
  private usageByAgent: Map<string, TokenUsage> = new Map();

  /**
   * Registra um provider de LLM no gateway.
   */
  registerProvider(provider: ILLMProvider): void {
    this.providers.set(provider.providerType, provider);
  }

  /**
   * Remove um provider do registro.
   */
  unregisterProvider(providerType: LLMProviderType): void {
    this.providers.delete(providerType);
  }

  /**
   * Retorna um provider pelo tipo.
   */
  getProvider(providerType: LLMProviderType): ILLMProvider | null {
    return this.providers.get(providerType) ?? null;
  }

  /**
   * Lista todos os providers registrados.
   */
  listProviders(): ILLMProvider[] {
    return Array.from(this.providers.values());
  }

  /**
   * Configura o provider e modelo para um agente específico.
   */
  setAgentConfig(agentId: string, providerType: LLMProviderType, model: string): void {
    this.agentProviderMap.set(agentId, providerType);
    this.agentModelMap.set(agentId, model);
  }

  /**
   * Envia uma requisição ao LLM associado ao agente.
   * Rastreia uso de tokens e custo.
   */
  async send(request: LLMRequest): Promise<LLMResponse> {
    const provider = this.resolveProvider(request.agentId);
    const mapped = this.agentModelMap.get(request.agentId);
    const model = (mapped && mapped.length > 0) ? mapped : (request.model || "");

    const adjustedRequest: LLMRequest = { ...request, model };
    const response = await provider.send(adjustedRequest);

    this.trackUsage(request.agentId, response);

    return response;
  }

  /**
   * Envia uma requisição com streaming ao LLM associado ao agente.
   */
  async *stream(request: LLMRequest): AsyncGenerator<LLMStreamChunk, void, unknown> {
    const provider = this.resolveProvider(request.agentId);
    const mapped = this.agentModelMap.get(request.agentId);
    const model = (mapped && mapped.length > 0) ? mapped : (request.model || "");

    const adjustedRequest: LLMRequest = { ...request, model };

    // Rastreia tokens do stream para contabilizar uso total
    let lastOutputTokens = 0;
    let lastInputTokens = 0;
    let lastCostUsd = 0;
    for await (const chunk of provider.stream(adjustedRequest)) {
      if (chunk.accumulatedTokens != null && chunk.accumulatedTokens > 0) {
        lastOutputTokens = chunk.accumulatedTokens;
      }
      if (chunk.inputTokens != null) lastInputTokens = chunk.inputTokens;
      if (chunk.costUsd != null) lastCostUsd = chunk.costUsd;
      yield chunk;
    }

    // Após stream completo, registra uso
    if (lastOutputTokens > 0 || lastInputTokens > 0) {
      this.trackUsage(request.agentId, {
        content: "",
        model: adjustedRequest.model,
        provider: provider.providerType,
        inputTokens: lastInputTokens,
        outputTokens: lastOutputTokens,
        costUsd: lastCostUsd,
        durationMs: 0,
        finishReason: "stop",
      });
    }
  }

  /**
   * Retorna o uso de tokens acumulado para um agente.
   */
  getUsage(agentId: string): TokenUsage | null {
    return this.usageByAgent.get(agentId) ?? null;
  }

  /**
   * Retorna o uso total de todos os agentes.
   */
  getAllUsage(): TokenUsage[] {
    return Array.from(this.usageByAgent.values());
  }

  /**
   * Retorna o custo total acumulado de todos os agentes.
   */
  getTotalCost(): number {
    let total = 0;
    for (const usage of this.usageByAgent.values()) {
      total += usage.totalCostUsd;
    }
    return total;
  }

  /**
   * Inicializa e registra todos os providers a partir de um objeto de configuração.
   * Remove providers existentes antes de registrar os novos.
   */
  initializeProviders(configs: AllProvidersConfig): void {
    this.providers.clear();
    const allProviders = createAllProviders(configs);
    for (const provider of allProviders) {
      this.registerProvider(provider);
    }
  }

  /**
   * Limpa sessões do Claude CLI (para iniciar contexto limpo em novo projeto).
   */
  clearClaudeSessions(): void {
    const claude = this.providers.get("claude-code");
    if (claude && "clearSessions" in claude) {
      (claude as ClaudeProvider).clearSessions();
    }
  }

  /**
   * Limpa o estado do gateway. Útil para testes.
   */
  clear(): void {
    this.providers.clear();
    this.agentProviderMap.clear();
    this.agentModelMap.clear();
    this.usageByAgent.clear();
  }

  /**
   * Resolve o provider associado a um agente.
   * Lança erro se não encontrado.
   */
  private resolveProvider(agentId: string): ILLMProvider {
    const providerType = this.agentProviderMap.get(agentId);
    if (!providerType) {
      throw new Error(`[LLMGateway] Provider não configurado para agente ${agentId}.`);
    }

    const provider = this.providers.get(providerType);
    if (!provider) {
      throw new Error(`[LLMGateway] Provider ${providerType} não registrado.`);
    }

    return provider;
  }

  /**
   * Atualiza o rastreamento de uso para um agente.
   */
  private trackUsage(agentId: string, response: LLMResponse): void {
    const existing = this.usageByAgent.get(agentId);

    if (existing) {
      existing.totalInputTokens += response.inputTokens;
      existing.totalOutputTokens += response.outputTokens;
      existing.totalCostUsd += response.costUsd;
      existing.requestCount++;
    } else {
      this.usageByAgent.set(agentId, {
        agentId,
        provider: response.provider,
        model: response.model,
        totalInputTokens: response.inputTokens,
        totalOutputTokens: response.outputTokens,
        totalCostUsd: response.costUsd,
        requestCount: 1,
      });
    }
  }
}

/** Configuração para inicialização de todos os providers */
export interface AllProvidersConfig {
  /** Configuração do provider Claude (Anthropic) */
  claude?: Partial<ClaudeProviderConfig>;
  /** Configuração do provider OpenAI */
  openai?: Partial<OpenAIProviderConfig>;
  /** Configuração do provider Ollama (local) */
  ollama?: Partial<OllamaProviderConfig>;
  /** Configuração do provider Google Gemini */
  gemini?: Partial<GeminiProviderConfig>;
  /** Configuração do provider LM Studio (local) */
  lmStudio?: Partial<LMStudioProviderConfig>;
}

/**
 * Cria instâncias de todos os providers a partir de um objeto de configuração.
 * Retorna um array pronto para registro no gateway.
 */
export function createAllProviders(configs: AllProvidersConfig): ILLMProvider[] {
  const providers: ILLMProvider[] = [];

  providers.push(new ClaudeProvider(configs.claude));
  providers.push(new OpenAIProvider(configs.openai));
  providers.push(new OllamaProvider(configs.ollama));
  providers.push(new GeminiProvider(configs.gemini));
  providers.push(new LMStudioProvider(configs.lmStudio));

  return providers;
}

/** Instância singleton do LLM Gateway */
export const llmGateway = new LLMGateway();
