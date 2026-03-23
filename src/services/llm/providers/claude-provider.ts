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
const FAST_MODEL = "claude-haiku-4-5-20251001";

const DEFAULT_CONFIG: ClaudeProviderConfig = {
  apiKey: "",
  baseUrl: "https://api.anthropic.com",
  timeoutMs: 600_000,
  model: "claude-sonnet-4-20250514",
};

const PRICING: Record<string, { inputPerMillion: number; outputPerMillion: number }> = {
  "claude-opus-4-20250514": { inputPerMillion: 15, outputPerMillion: 75 },
  "claude-sonnet-4-20250514": { inputPerMillion: 3, outputPerMillion: 15 },
  "claude-haiku-4-5-20251001": { inputPerMillion: 1, outputPerMillion: 5 },
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
  subtype?: string;
  is_error?: boolean;
  result?: string;
  cost_usd?: number;
  total_cost_usd?: number;
  input_tokens?: number;
  output_tokens?: number;
  total_input_tokens?: number;
  total_output_tokens?: number;
  usage?: {
    input_tokens?: number;
    output_tokens?: number;
    cache_read_input_tokens?: number;
    cache_creation_input_tokens?: number;
  };
}

/**
 * Executa o Claude Code CLI via endpoint local /api/claude/execute.
 * Funciona tanto com `npm run dev` (Vite) quanto com Tauri.
 */
async function executeClaudeCli(args: string[], cwd?: string, signal?: AbortSignal): Promise<ClaudeCliResult> {
  // Log diagnóstico: mostra CWD e agentId no console do browser
  const agentArg = args.find((_, i) => i > 0 && args[i - 1] === "--append-system-prompt")?.substring(0, 30) ?? "";
  console.log(`[ClaudeProvider] executeClaudeCli cwd=${cwd ?? "UNDEFINED"} agent-hint=${agentArg}`);

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
    const localPath = project?.localPath ?? undefined;
    if (!localPath) {
      // Tenta pegar do activeProjectId + projects list
      const state = useProjectStore.getState() as unknown as Record<string, unknown>;
      const activeId = state.activeProjectId as string | undefined;
      const projects = state.projects as Array<{ id: string; localPath?: string }> | undefined;
      if (activeId && projects) {
        const found = projects.find((p) => p.id === activeId);
        if (found?.localPath) {
          console.log(`[ClaudeProvider] getProjectWorkDir fallback: ${found.localPath}`);
          return found.localPath;
        }
      }
      console.warn(`[ClaudeProvider] getProjectWorkDir: projeto sem localPath (project=${project?.name ?? "null"}, activeId=${activeId ?? "null"})`);
    }
    return localPath;
  } catch (err) {
    console.warn("[ClaudeProvider] getProjectWorkDir erro:", err);
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
  private shouldUseFastModel(agentId: string, _requestModel: string): boolean {
    // Só usa fast model se o setting "autoFastModel" estiver habilitado
    const { autoFastModel, agentDefaults } = useSettingsStore.getState();
    if (!autoFastModel) return false;

    // Se o usuário configurou um modelo específico para este agente, RESPEITA
    const agentConfig = agentDefaults[agentId as keyof typeof agentDefaults];
    if (agentConfig?.model && agentConfig.model.length > 0) {
      // O usuário escolheu explicitamente — não sobrescrever
      return false;
    }

    // Só aplica Haiku para roles elegíveis sem modelo explícito
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
      "claude-haiku-4-5-20251001",
    ];
  }

  async send(request: LLMRequest): Promise<LLMResponse> {
    const startTime = Date.now();
    const prompt = this.buildPrompt(request);
    const isOrchPlanning = request.agentId === "orchestrator" || request.agentId === "__settings_test__";
    // Orchestrator NÃO recebe CWD — quando o CLI roda dentro do projeto,
    // ele lê todos os arquivos e adiciona como contexto, fazendo o modelo
    // responder "seu projeto está completo, o que precisa?" em vez de planejar.
    const workDir = isOrchPlanning ? undefined : getProjectWorkDir();

    try {
      const isOrchestrator = request.agentId === "orchestrator";
      const isExecutor = !isOrchestrator && request.agentId !== "__settings_test__";
      const agentKey = request.agentId || "default";

      // Modelo: respeita config do agente > request.model > default
      const requestModel = request.model && request.model.length > 0 ? request.model : this.config.model;
      const effectiveModel = this.shouldUseFastModel(agentKey, requestModel)
        ? FAST_MODEL
        : requestModel;

      // Session management: executores reutilizam sessão, orchestrator sempre cria nova
      const existingSession = isExecutor ? this.sessionMap.get(agentKey) : undefined;
      const calls = isExecutor ? (this.callCount.get(agentKey) ?? 0) : 0;
      const isResume = existingSession && calls > 0;

      const args: string[] = [];

      if (isResume) {
        args.push("--resume", existingSession, "-p", prompt);
      } else {
        const sessionId = crypto.randomUUID();
        if (isExecutor) this.sessionMap.set(agentKey, sessionId);
        args.push("-p", prompt, "--session-id", sessionId);
      }

      args.push(
        "--output-format", "json",
        "--model", effectiveModel,
        "--effort", isOrchestrator ? "medium" : this.getEffortForAgent(agentKey),
        "--max-turns", isOrchestrator ? "3" : this.getMaxTurnsForAgent(agentKey),
      );

      // Orchestrator: --system-prompt SUBSTITUI o system prompt built-in do CLI.
      // CRÍTICO: --append-system-prompt apenas apenda ao built-in que diz "seja um
      // assistente de coding interativo", fazendo o LLM ignorar nossas instruções.
      // Executores: --append-system-prompt mantém o built-in (útil para coding).
      if (isOrchestrator) {
        args.push("--no-session-persistence");
        if (request.systemPrompt) {
          args.push("--system-prompt", request.systemPrompt);
        }
      } else {
        args.push("--dangerously-skip-permissions");
        if (request.systemPrompt) {
          args.push("--append-system-prompt", request.systemPrompt);
        }
      }

      // Atualiza contador de chamadas
      this.callCount.set(agentKey, calls + 1);

      console.log(`[ClaudeProvider] ${isResume ? "RESUME" : "NEW"} session for ${agentKey}, model: ${effectiveModel}, cwd: ${workDir ?? "(default)"}`);
      let result = await executeClaudeCli(args, workDir, request.signal);
      const durationMs = Date.now() - startTime;
      console.log(`[ClaudeProvider] CLI respondeu em ${durationMs}ms, success: ${result.success}, stdout: ${result.stdout.length} chars`);

      // Se --resume falhou (sessão expirada), tenta novamente com sessão nova
      if (!result.success && isResume && (result.stderr.includes("No conversation found") || result.stdout.includes("No conversation found"))) {
        console.log(`[ClaudeProvider] Sessão expirada para ${agentKey}, criando nova...`);
        this.clearAgentSession(agentKey);
        const newSessionId = crypto.randomUUID();
        this.sessionMap.set(agentKey, newSessionId);

        // Reconstrói args sem --resume, com --session-id novo
        const retryArgs: string[] = [
          "-p", prompt,
          "--session-id", newSessionId,
          "--output-format", "json",
          "--model", effectiveModel,
          "--effort", isOrchestrator ? "medium" : this.getEffortForAgent(agentKey),
          "--max-turns", isOrchestrator ? "3" : this.getMaxTurnsForAgent(agentKey),
        ];
        if (isOrchestrator) {
          retryArgs.push("--no-session-persistence");
          if (request.systemPrompt) retryArgs.push("--system-prompt", request.systemPrompt);
        } else {
          retryArgs.push("--dangerously-skip-permissions");
          if (request.systemPrompt) retryArgs.push("--append-system-prompt", request.systemPrompt);
        }

        result = await executeClaudeCli(retryArgs, workDir, request.signal);
      }

      // Tenta parsear stdout como JSON (o CLI sempre retorna JSON com --output-format json)
      let data: ClaudeJsonResult | null = null;
      try {
        data = JSON.parse(result.stdout) as ClaudeJsonResult;
      } catch {
        // stdout não é JSON — pode ser erro em texto puro
      }

      // Verifica erro: exit code != 0 OU JSON com is_error=true
      if (!result.success || data?.is_error) {
        // Se tem JSON com resultado de erro, usa como mensagem
        if (data?.result) {
          return this.buildErrorResponse(request, startTime, data.result);
        }
        // Se tem erro no stderr, parseia
        if (result.stderr.trim().length > 0) {
          const friendlyError = this.parseCLIError(result.exitCode, result.stderr);
          return this.buildErrorResponse(request, startTime, friendlyError);
        }
        // Tenta extrair erro do stdout mesmo que não seja JSON
        if (result.stdout.trim().length > 0 && !data) {
          return this.buildErrorResponse(request, startTime, result.stdout.trim().slice(0, 200));
        }
        const friendlyError = this.parseCLIError(result.exitCode, result.stderr);
        return this.buildErrorResponse(request, startTime, friendlyError);
      }

      // Sucesso: extrai conteúdo do JSON
      if (data) {
        const content = data.result ?? result.stdout;
        const inputTokens = data.usage?.input_tokens ?? data.total_input_tokens ?? data.input_tokens ?? 0;
        const outputTokens = data.usage?.output_tokens ?? data.total_output_tokens ?? data.output_tokens ?? 0;
        const costUsd = data.total_cost_usd ?? data.cost_usd ?? this.calculateCost(request.model, inputTokens, outputTokens);

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
      }

      // Fallback: stdout não é JSON mas CLI retornou sucesso
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
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return this.buildErrorResponse(request, startTime, `Erro: ${message}`);
    }
  }

  async *stream(request: LLMRequest): AsyncGenerator<LLMStreamChunk, void, unknown> {
    // Informa que o processamento começou (replace=true indica substituição total)
    yield { content: "⏳ Processando com Claude CLI...", done: false, accumulatedTokens: 0, replace: true };

    const response = await this.send(request);
    const elapsed = Math.round(response.durationMs / 1000);

    if (response.finishReason === "error") {
      // Substitui a mensagem de processamento pelo erro
      yield { content: response.content, done: true, accumulatedTokens: null, replace: true };
      return;
    }

    // Substitui a mensagem de processamento pelo conteúdo real
    const footer = `\n\n_(${elapsed}s • ${response.inputTokens + response.outputTokens} tokens • $${response.costUsd.toFixed(4)})_`;
    yield {
      content: response.content + footer,
      done: true,
      accumulatedTokens: response.outputTokens,
      inputTokens: response.inputTokens,
      costUsd: response.costUsd,
      replace: true,
    };
  }

  private buildPrompt(request: LLMRequest): string {
    const isOrchestrator = request.agentId === "orchestrator";
    const hasSystemPrompt = request.systemPrompt && request.systemPrompt.length > 0;

    // Para o orchestrator: -p contém APENAS a mensagem do usuário (sem instruções).
    // Instruções vão 100% no --append-system-prompt. Misturar instrução no -p
    // faz o CLI confundir instrução com mensagem do user.
    if (isOrchestrator) {
      const userMessages: string[] = [];
      for (const msg of request.messages) {
        if (msg.role === "user") {
          userMessages.push(msg.content);
        }
        // Respostas anteriores do assistant são IGNORADAS para não contaminar
      }
      return userMessages.join("\n\n");
    }

    // Para agentes executores: prefixo + mensagens
    let prefix = "";
    if (!hasSystemPrompt) {
      prefix = `Agente executor. SEM usuario. Execute direto. SOMENTE CODIGO.

- Crie arquivos diretamente. Sem permissao. Sem perguntas. Sem menus.
- NAO crie README, documentacao, exemplos de uso, ou resumos do que fez.
- NAO use emojis. NAO liste funcionalidades. Resposta CURTA.
- Codigo completo e funcional. Sem stubs ou TODOs.
- Imports relativos. Sem aliases. TypeScript strict. Tailwind CSS.

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

  /** Max turns por role — roles simples precisam de menos turnos */
  private getMaxTurnsForAgent(agentId: string): string {
    switch (agentId) {
      case "devops": return "8";
      case "pm": return "5";
      case "reviewer": return "5";
      case "security": return "5";
      case "designer": return "10";
      case "researcher": return "10";
      default: return "15"; // frontend, backend, database, architect
    }
  }

  private calculateCost(model: string, inputTokens: number, outputTokens: number): number {
    const pricing = PRICING[model];
    if (!pricing) return 0;
    return (inputTokens / 1_000_000) * pricing.inputPerMillion +
           (outputTokens / 1_000_000) * pricing.outputPerMillion;
  }

  /** Parseia erros do CLI e retorna mensagem amigável */
  private parseCLIError(exitCode: number, stderr: string): string {
    // Checks específicos primeiro — ordem importa (antes do catch-all de exitCode)
    if (stderr.includes("Timeout")) {
      return "O agente demorou demais para responder. Tente com menos agentes em paralelo ou reduza o esforço (effort).";
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
    // Catch-all para exitCode -1 (spawn error, processo morto, etc.)
    if (exitCode === -1) {
      if (stderr.length === 0) {
        return "Processo abortado pelo usuário ou timeout.";
      }
      // Mostra o stderr real para diagnóstico em vez de mensagem genérica
      const cleanStderr = stderr.split("\n").filter((line) => line.trim().length > 0).slice(0, 3).join(" | ");
      return `Falha ao executar o Claude CLI (spawn): ${cleanStderr}`;
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
