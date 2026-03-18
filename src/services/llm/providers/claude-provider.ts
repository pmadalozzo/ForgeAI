/**
 * Claude Provider — Executa o Claude Code CLI via API local do Vite.
 * Funciona com `npm run dev` no browser — sem Tauri necessário.
 *
 * Endpoints usados (servidos pelo plugin Vite):
 * - POST /api/claude/execute  → executa o CLI
 * - GET  /api/claude/version  → verifica instalação
 */

import type { LLMProvider as LLMProviderType } from "../../../types/agents";
import type { ILLMProvider, LLMRequest, LLMResponse, LLMStreamChunk } from "../llm-gateway";
import { useProjectStore } from "@/stores/project-store";
import { useSettingsStore } from "@/stores/settings-store";

/** Configuração do Claude provider */
export interface ClaudeProviderConfig {
  apiKey: string;
  baseUrl: string;
  timeoutMs: number;
  model: string;
}

/** Roles que podem usar Haiku (tasks simples, não geram código crítico) */
const HAIKU_ELIGIBLE_ROLES: ReadonlySet<string> = new Set([
  "pm", "qa", "reviewer", "security",
]);

/** Modelo rápido para tasks simples */
const FAST_MODEL = "claude-haiku-4-5-20241022";

const DEFAULT_CONFIG: ClaudeProviderConfig = {
  apiKey: "",
  baseUrl: "https://api.anthropic.com",
  timeoutMs: 600_000,
  model: "claude-sonnet-4-20250514",
};

const PRICING: Record<string, { inputPerMillion: number; outputPerMillion: number }> = {
  "claude-opus-4-20250514": { inputPerMillion: 15, outputPerMillion: 75 },
  "claude-sonnet-4-20250514": { inputPerMillion: 3, outputPerMillion: 15 },
  "claude-haiku-4-5-20241022": { inputPerMillion: 1, outputPerMillion: 5 },
};

/** Resultado do /api/claude/execute */
interface ClaudeCliResult {
  success: boolean;
  stdout: string;
  stderr: string;
  exitCode: number;
}

/** Resultado JSON do Claude CLI */
interface ClaudeJsonResult {
  type?: string;
  result?: string;
  cost_usd?: number;
  input_tokens?: number;
  output_tokens?: number;
  total_input_tokens?: number;
  total_output_tokens?: number;
}

/**
 * Executa o Claude Code CLI via endpoint local /api/claude/execute.
 * Funciona tanto com `npm run dev` (Vite) quanto com Tauri.
 */
async function executeClaudeCli(args: string[], cwd?: string, signal?: AbortSignal): Promise<ClaudeCliResult> {
  const response = await fetch("/api/claude/execute", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ args, cwd }),
    signal,
  });

  if (!response.ok) {
    return { success: false, stdout: "", stderr: `HTTP ${response.status}`, exitCode: -1 };
  }

  return response.json() as Promise<ClaudeCliResult>;
}

/** Lê o localPath do projeto ativo do store */
function getProjectWorkDir(): string | undefined {
  try {
    const project = useProjectStore.getState().getProject();
    return project?.localPath ?? undefined;
  } catch {
    return undefined;
  }
}

export class ClaudeProvider implements ILLMProvider {
  readonly providerType: LLMProviderType = "claude-code";
  readonly displayName = "Claude Code (CLI)";

  private config: ClaudeProviderConfig;

  /** Mapa de session IDs por agente — permite --resume em chamadas subsequentes */
  private sessionMap: Map<string, string> = new Map();

  /** Rastreia quantas chamadas cada agente já fez (para decidir --resume vs primeira vez) */
  private callCount: Map<string, number> = new Map();

  constructor(config: Partial<ClaudeProviderConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /** Limpa sessões de todos os agentes (útil ao iniciar novo projeto) */
  clearSessions(): void {
    this.sessionMap.clear();
    this.callCount.clear();
  }

  /** Limpa sessão de um agente específico */
  clearAgentSession(agentId: string): void {
    this.sessionMap.delete(agentId);
    this.callCount.delete(agentId);
  }

  /** Retorna se o agente pode usar modelo rápido (Haiku) */
  private shouldUseFastModel(agentId: string, requestModel: string): boolean {
    // Só usa fast model se o setting "autoFastModel" estiver habilitado
    const { autoFastModel } = useSettingsStore.getState();
    if (!autoFastModel) return false;

    // Só para roles elegíveis e se não foi explicitamente configurado outro modelo
    const defaultModel = this.config.model;
    if (requestModel && requestModel !== defaultModel) return false;
    return HAIKU_ELIGIBLE_ROLES.has(agentId);
  }

  async isAvailable(): Promise<boolean> {
    try {
      const res = await fetch("/api/claude/version");
      const data = await res.json() as { installed: boolean };
      return data.installed;
    } catch {
      return false;
    }
  }

  async listModels(): Promise<string[]> {
    return [
      "claude-opus-4-20250514",
      "claude-sonnet-4-20250514",
      "claude-haiku-4-5-20241022",
    ];
  }

  async send(request: LLMRequest): Promise<LLMResponse> {
    const startTime = Date.now();
    const prompt = this.buildPrompt(request);
    const workDir = getProjectWorkDir();

    try {
      // Orchestrator só planeja — não precisa de permissões de escrita
      const isExecutor = request.agentId !== "orchestrator" && request.agentId !== "__settings_test__";
      const agentKey = request.agentId || "default";

      // Modelo inteligente: Haiku para roles simples, modelo configurado para o resto
      const effectiveModel = this.shouldUseFastModel(agentKey, request.model)
        ? FAST_MODEL
        : (request.model || this.config.model);

      // Session management: reutiliza sessão do agente para evitar cold start
      const existingSession = this.sessionMap.get(agentKey);
      const calls = this.callCount.get(agentKey) ?? 0;
      const isResume = existingSession && calls > 0;

      const args: string[] = [];

      if (isResume) {
        // Chamada subsequente: --resume reutiliza contexto da sessão anterior
        args.push("--resume", existingSession, "-p", prompt);
      } else {
        // Primeira chamada: cria sessão nova com UUID válido
        const sessionId = crypto.randomUUID();
        this.sessionMap.set(agentKey, sessionId);
        args.push("-p", prompt, "--session-id", sessionId);
      }

      args.push(
        "--output-format", "json",
        "--model", effectiveModel,
        "--effort", isExecutor ? this.getEffortForAgent(agentKey) : "low",
      );

      // Só agentes executores podem criar/editar arquivos
      if (isExecutor) {
        args.push("--dangerously-skip-permissions");
      }

      if (request.systemPrompt) {
        args.push("--append-system-prompt", request.systemPrompt);
      }

      // Atualiza contador de chamadas
      this.callCount.set(agentKey, calls + 1);

      console.log(`[ClaudeProvider] ${isResume ? "RESUME" : "NEW"} session for ${agentKey}, model: ${effectiveModel}, cwd: ${workDir ?? "(default)"}`);
      let result = await executeClaudeCli(args, workDir, request.signal);
      const durationMs = Date.now() - startTime;
      console.log(`[ClaudeProvider] CLI respondeu em ${durationMs}ms, success: ${result.success}, stdout: ${result.stdout.length} chars`);

      // Se --resume falhou (sessão expirada), tenta novamente sem resume
      if (!result.success && isResume && result.stderr.includes("No conversation found")) {
        console.log(`[ClaudeProvider] Sessão expirada para ${agentKey}, criando nova...`);
        this.clearAgentSession(agentKey);
        const newSessionId = crypto.randomUUID();
        this.sessionMap.set(agentKey, newSessionId);
        const retryArgs = args.filter((a) => a !== "--resume" && a !== existingSession);
        retryArgs.splice(retryArgs.indexOf("-p"), 0, "--session-id", newSessionId);
        result = await executeClaudeCli(retryArgs, workDir, request.signal);
      }

      if (!result.success) {
        const friendlyError = this.parseCLIError(result.exitCode, result.stderr);
        return this.buildErrorResponse(request, startTime, friendlyError);
      }

      try {
        const data = JSON.parse(result.stdout) as ClaudeJsonResult;
        const content = data.result ?? result.stdout;
        const inputTokens = data.total_input_tokens ?? data.input_tokens ?? 0;
        const outputTokens = data.total_output_tokens ?? data.output_tokens ?? 0;
        const costUsd = data.cost_usd ?? this.calculateCost(request.model, inputTokens, outputTokens);

        return {
          content,
          model: request.model,
          provider: this.providerType,
          inputTokens,
          outputTokens,
          costUsd,
          durationMs,
          finishReason: "stop",
        };
      } catch {
        return {
          content: result.stdout,
          model: request.model,
          provider: this.providerType,
          inputTokens: 0,
          outputTokens: 0,
          costUsd: 0,
          durationMs,
          finishReason: "stop",
        };
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return this.buildErrorResponse(request, startTime, `Erro: ${message}`);
    }
  }

  async *stream(request: LLMRequest): AsyncGenerator<LLMStreamChunk, void, unknown> {
    // Informa que o processamento começou
    yield { content: "Processando com Claude CLI...\n", done: false, accumulatedTokens: 0 };

    const response = await this.send(request);
    const elapsed = Math.round(response.durationMs / 1000);

    if (response.finishReason === "error") {
      yield { content: response.content, done: true, accumulatedTokens: null };
      return;
    }

    // Substitui a mensagem de processamento pelo conteúdo real
    yield { content: response.content, done: false, accumulatedTokens: response.outputTokens };
    yield { content: `\n\n_(Concluído em ${elapsed}s)_`, done: true, accumulatedTokens: response.outputTokens };
  }

  private buildPrompt(request: LLMRequest): string {
    // Se já tem systemPrompt (ex: TaskDecomposer), não adiciona prefixo para não conflitar
    const hasSystemPrompt = request.systemPrompt && request.systemPrompt.length > 0;
    const isExecutor = request.agentId !== "orchestrator" && request.agentId !== "__settings_test__";

    let prefix = "";
    if (!hasSystemPrompt) {
      prefix = isExecutor
        ? `Agente executor. SEM usuario. Execute direto. SOMENTE CODIGO.

- Crie arquivos diretamente. Sem permissao. Sem perguntas. Sem menus.
- NAO crie README, documentacao, exemplos de uso, ou resumos do que fez.
- NAO use emojis. NAO liste funcionalidades. Resposta CURTA.
- Codigo completo e funcional. Sem stubs ou TODOs.
- Imports relativos. Sem aliases. TypeScript strict. Tailwind CSS.

`
        : `Voce e o Orquestrador do ForgeAI. APENAS PLANEJE — NAO crie arquivos.
Responda SOMENTE com um array JSON de tarefas (maximo 6). Portugues brasileiro.
NAO escreva texto antes ou depois do JSON. NAO use markdown code blocks.

`;
    }

    const parts: string[] = prefix ? [prefix] : [];
    for (const msg of request.messages) {
      if (msg.role === "user") {
        parts.push(msg.content);
      } else if (msg.role === "assistant") {
        parts.push(`[Assistente anterior]: ${msg.content}`);
      }
    }
    return parts.join("\n\n");
  }

  /** Lê o effort do agente ou o global como fallback */
  private getEffortForAgent(agentId: string): string {
    try {
      const state = useSettingsStore.getState();
      // Effort específico do agente
      const agentEffort = state.agentDefaults[agentId as keyof typeof state.agentDefaults]?.effort;
      if (agentEffort) return agentEffort;
      // Fallback global
      return state.claudeEffort ?? "high";
    } catch { /* fallback */ }
    return "high";
  }

  private calculateCost(model: string, inputTokens: number, outputTokens: number): number {
    const pricing = PRICING[model];
    if (!pricing) return 0;
    return (inputTokens / 1_000_000) * pricing.inputPerMillion +
           (outputTokens / 1_000_000) * pricing.outputPerMillion;
  }

  /** Parseia erros do CLI e retorna mensagem amigável */
  private parseCLIError(exitCode: number, stderr: string): string {
    if (stderr.includes("Timeout")) {
      return "O agente demorou demais para responder. Tente com menos agentes em paralelo ou reduza o esforço (effort).";
    }
    if (exitCode === -1 && !stderr.includes("Timeout")) {
      return "Falha ao executar o Claude CLI. Verifique se está instalado com 'claude --version'.";
    }
    if (stderr.includes("ENOENT") || stderr.includes("not found") || stderr.includes("not recognized")) {
      return "Claude CLI não encontrado. Instale com: npm install -g @anthropic-ai/claude-code";
    }
    if (stderr.includes("authentication") || stderr.includes("unauthorized") || stderr.includes("401")) {
      return "Falha de autenticação com o Claude CLI. Execute 'claude' no terminal para reautenticar.";
    }
    if (stderr.includes("rate limit") || stderr.includes("429")) {
      return "Limite de requisições atingido. Aguarde alguns minutos e tente novamente.";
    }
    // Limpa mensagens genéricas do stderr
    const cleanStderr = stderr.split("\n").filter((line) => line.trim().length > 0).slice(0, 3).join(" | ");
    return `Erro do CLI (código ${exitCode}): ${cleanStderr || "erro desconhecido"}`;
  }

  private buildErrorResponse(request: LLMRequest, startTime: number, errorMessage: string): LLMResponse {
    return {
      content: `[Erro ClaudeProvider] ${errorMessage}`,
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
