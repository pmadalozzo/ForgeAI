/**
 * OrchestratorService — Singleton que conecta Orchestrator, AgentRuntime e LLMGateway.
 * Ponto central de inicializacao e coordenacao do sistema de agentes.
 *
 * Execução PHASED (em fases):
 *   Fase 1 (PLANNING):      PM sozinho → gera PRD
 *   Fase 2 (ARCHITECTURE):  Architect sozinho → recebe PRD → gera arquitetura
 *   Fase 3 (DEVELOPMENT):   Frontend + Backend + Database em paralelo → recebem arquitetura
 *   Fase 4 (QUALITY):       Reviewer + QA + Security em paralelo → leem arquivos reais do disco
 *   Fase 5 (DELIVERY):      DevOps sozinho
 */

import { AgentStatus } from "../../types/agents";
import type { AgentRole } from "../../types/agents";
import { orchestrator } from "./orchestrator";
import type { DecomposedTask } from "./orchestrator";
import { agentRuntime } from "./agent-runtime";
import { llmGateway } from "../llm/llm-gateway";
import { LLMTaskDecomposer } from "./task-decomposer";
import { createDefaultPipeline } from "./quality-gates";
import { EventType, eventBus } from "../events/event-bus";
import { useAgentsStore } from "../../stores/agents-store";
import { useSettingsStore } from "../../stores/settings-store";
import { useChatStore } from "../../stores/chat-store";
import { useMemoryStore } from "../../stores/memory-store";
import { insertTask, updateTaskStatus, loadPendingTasks } from "../supabase/tasks-service";
import { getChangedFilesSummary } from "./project-files-reader";

/** Estado de processamento de uma tarefa de agente */
interface AgentTaskExecution {
  taskId: string;
  agentId: string;
  role: AgentRole;
  description: string;
  /** Fase do pipeline (1-5) */
  phase: 1 | 2 | 3 | 4 | 5;
}

/** Mapa de outputs acumulados entre fases */
interface PhaseOutputs {
  /** Output do PM (PRD) — injetado na Fase 2 */
  prd: string;
  /** Output do Architect — injetado na Fase 3 */
  architecture: string;
  /** Resumo dos arquivos reais criados na Fase 3 — injetado na Fase 4 */
  changedFilesSummary: string;
}

/** Roles conhecidas para pré-carregar skills */
const ALL_ROLES: AgentRole[] = [
  "orchestrator", "pm", "architect", "frontend", "backend",
  "database", "qa", "security", "devops", "reviewer", "designer",
];

/** Nomes legíveis das fases */
const PHASE_NAMES: Record<number, string> = {
  1: "PLANNING",
  2: "ARCHITECTURE",
  3: "DEVELOPMENT",
  4: "QUALITY",
  5: "DELIVERY",
};

class OrchestratorServiceImpl {
  private initialized = false;
  private processing = false;
  private unsubscribers: Array<() => void> = [];
  /** Cache de skills carregadas dos arquivos SKILL.md */
  private skillsCache: Map<string, string> = new Map();

  /**
   * Inicializa o servico: registra providers, agentes e conecta tudo.
   */
  initialize(): void {
    if (this.initialized) return;

    // Configura providers no LLMGateway a partir do settings store
    this.syncProviders();

    // Registra agentes no runtime
    this.syncAgents();

    // Configura TaskDecomposer no Orchestrator
    const decomposer = new LLMTaskDecomposer(llmGateway);
    orchestrator.setDecomposer(decomposer);

    // Configura quality gates no runtime
    const pipeline = createDefaultPipeline();
    agentRuntime.setQualityGatePipeline(pipeline);

    // Pré-carrega skills dos arquivos SKILL.md (async, popula cache)
    void this.loadAllSkills();

    // Escuta eventos para sincronizar com o Zustand store
    this.setupEventListeners();

    this.initialized = true;
    console.warn("[OrchestratorService] Inicializado com sucesso.");
  }

  /**
   * Processa uma mensagem do usuario: decompoe em tarefas e distribui para agentes.
   */
  async processUserMessage(message: string, projectId: string): Promise<void> {
    if (this.processing) {
      useChatStore.getState().addMessage(
        "orchestrator",
        "Ainda estou processando a solicitacao anterior. Aguarde a conclusao.",
      );
      return;
    }

    this.processing = true;

    try {
      // Garante que esta inicializado
      if (!this.initialized) {
        this.initialize();
      }

      // Sincroniza providers e agentes (podem ter mudado)
      this.syncProviders();
      this.syncAgents();

      // Verifica se há tasks pendentes de uma sessão anterior (retomada pós-queda)
      const pendingTasks = await loadPendingTasks(projectId);
      if (pendingTasks.length > 0) {
        useChatStore.getState().addMessage(
          "orchestrator",
          `Encontrei **${pendingTasks.length} tarefa(s) pendente(s)** de uma sessao anterior. Retomando...`,
        );

        // Agrupa tasks pendentes por fase (inferida pelo role do agente)
        const resumeExecutions: AgentTaskExecution[] = pendingTasks.map((t) => ({
          taskId: t.id,
          agentId: t.assigned_agent ?? "backend",
          role: (t.assigned_agent ?? "backend") as AgentRole,
          description: t.description,
          phase: this.inferPhaseFromRole((t.assigned_agent ?? "backend") as AgentRole),
        }));

        await this.executeTaskPipeline(resumeExecutions, projectId);
        this.processing = false;
        return;
      }

      // Verifica se o orchestrator tem provider configurado
      const settings = useSettingsStore.getState();
      const orchDefaults = settings.agentDefaults.orchestrator;
      if (!settings.isProviderConfigured(orchDefaults.provider)) {
        useChatStore.getState().addMessage(
          "orchestrator",
          "Nenhum provider LLM configurado para o Orquestrador. Configure nas configuracoes.",
        );
        return;
      }

      // Configura o orchestrator no gateway
      llmGateway.setAgentConfig("orchestrator", orchDefaults.provider, orchDefaults.model);

      // Informa que esta decompondo
      const decomposingId = useChatStore.getState().addMessage(
        "orchestrator",
        "Analisando sua solicitacao e decompondo em tarefas para os agentes...",
      );

      // Usa a última resposta do orchestrator no chat como plano
      // (evita chamada dupla ao CLI — o chat já chamou e recebeu o plano)
      const chatMessages = useChatStore.getState().messages;
      const lastOrchestratorMsg = [...chatMessages]
        .reverse()
        .find((m) =>
          m.from === "orchestrator" &&
          m.content.length > 100 &&
          !m.content.startsWith("[Erro") &&
          !m.content.startsWith("Analisando") &&
          !m.content.startsWith("Ainda estou") &&
          !m.content.startsWith("Processamento interrompido") &&
          // Deve conter listas numeradas ou bullets (indica plano)
          (/\d+\.\s+\*\*/.test(m.content) || /^[-*]\s+\*\*/m.test(m.content)),
        );

      let tasks: DecomposedTask[];
      try {
        if (lastOrchestratorMsg) {
          // Remove prefixo "Processando com Claude CLI..." se presente
          const cleanContent = lastOrchestratorMsg.content.replace(/^Processando com Claude CLI\.\.\.\s*/i, "");
          const decomposer = new LLMTaskDecomposer(llmGateway);
          tasks = decomposer.parseFromText(cleanContent);
          console.log(`[OrchestratorService] Extraiu ${tasks.length} tarefas da resposta do chat`);
        } else {
          // Fallback: chama o CLI para decompor
          tasks = await orchestrator.orchestrate(message);
        }
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        useChatStore.getState().updateMessage(
          decomposingId,
          `Erro ao decompor tarefas: ${errorMsg}. Verifique as configuracoes do LLM.`,
        );
        return;
      }

      if (tasks.length === 0) {
        useChatStore.getState().updateMessage(
          decomposingId,
          "Nao consegui identificar tarefas na sua solicitacao. Tente descrever com mais detalhes.",
        );
        return;
      }

      // Monta resumo das tarefas
      const taskSummary = tasks
        .map((t) => `- **${t.metadata.title ?? t.description.substring(0, 50)}** → ${t.targetRole} (Fase ${t.phase})`)
        .join("\n");

      useChatStore.getState().updateMessage(
        decomposingId,
        `Decompus sua solicitacao em **${tasks.length} tarefa(s)**:\n\n${taskSummary}\n\nDistribuindo para os agentes em fases...`,
      );

      // Executa cada tarefa com o LLM do agente correspondente (em fases)
      const executions = this.buildExecutions(tasks, projectId);
      await this.executeTaskPipeline(executions, projectId);

    } finally {
      this.processing = false;
    }
  }

  /**
   * Retorna se o servico esta processando.
   */
  isProcessing(): boolean {
    return this.processing;
  }

  /**
   * Retorna se o servico esta inicializado.
   */
  isInitialized(): boolean {
    return this.initialized;
  }

  /**
   * Desliga o servico, removendo listeners e limpando estado.
   */
  /** Reseta o flag de processamento (usado quando o usuário clica "Parar") */
  abortProcessing(): void {
    this.processing = false;
    console.log("[OrchestratorService] Processamento abortado pelo usuário");
  }

  shutdown(): void {
    for (const unsub of this.unsubscribers) {
      unsub();
    }
    this.unsubscribers = [];
    this.initialized = false;
    this.processing = false;
    console.warn("[OrchestratorService] Desligado.");
  }

  /**
   * Sincroniza providers do settings store para o LLMGateway.
   */
  private syncProviders(): void {
    const settings = useSettingsStore.getState();

    llmGateway.initializeProviders({
      claude: {
        apiKey: settings.providers["claude-code"].apiKey,
        baseUrl: settings.providers["claude-code"].baseUrl,
      },
      openai: {
        apiKey: settings.providers.openai.apiKey,
        baseUrl: settings.providers.openai.baseUrl,
      },
      ollama: {
        baseUrl: settings.providers.ollama.baseUrl,
      },
      gemini: {
        apiKey: settings.providers.gemini.apiKey,
      },
      lmStudio: {
        baseUrl: settings.providers["lm-studio"].baseUrl,
      },
    });

    // Configura mapeamento agente → provider/modelo
    const agentDefaults = settings.agentDefaults;
    const agents = useAgentsStore.getState().agents;

    for (const agent of agents) {
      const defaults = agentDefaults[agent.role];
      if (defaults && settings.isProviderConfigured(defaults.provider)) {
        llmGateway.setAgentConfig(agent.id, defaults.provider, defaults.model);
      }
    }
  }

  /**
   * Sincroniza agentes do Zustand store para o AgentRuntime.
   */
  private syncAgents(): void {
    const agents = useAgentsStore.getState().agents;
    const registeredIds = new Set(agentRuntime.getRegisteredAgentIds());

    for (const agent of agents) {
      if (!registeredIds.has(agent.id)) {
        agentRuntime.startAgent(agent);
      }
    }
  }

  /**
   * Configura listeners de eventos para sincronizar com Zustand stores.
   */
  private setupEventListeners(): void {
    // Sincroniza status de agente com o store
    const unsubStatus = eventBus.subscribe(EventType.AGENT_STATUS_CHANGE, (payload) => {
      const store = useAgentsStore.getState();
      store.setAgentStatus(payload.agentId, payload.newStatus);
    });
    this.unsubscribers.push(unsubStatus);

    // Sincroniza walking events com o store
    const unsubWalking = eventBus.subscribe(EventType.AGENT_WALKING, (payload) => {
      useAgentsStore.getState().addWalker({
        agentId: payload.agentId,
        fromAgentId: payload.fromAgentId,
        toAgentId: payload.toAgentId,
        waypoints: payload.waypoints,
        label: payload.label,
        walkProgress: 0,
        startedAt: payload.timestamp,
      });
      // Walker é auto-removido pelo tickWalkers quando walkProgress >= 1
    });
    this.unsubscribers.push(unsubWalking);

    // Sincroniza task assigned com o store
    const unsubTask = eventBus.subscribe(EventType.TASK_ASSIGNED, (payload) => {
      const store = useAgentsStore.getState();
      store.setAgentTask(payload.agentId, payload.description);
    });
    this.unsubscribers.push(unsubTask);

    // Sincroniza task completed com o store
    const unsubCompleted = eventBus.subscribe(EventType.TASK_COMPLETED, (payload) => {
      const store = useAgentsStore.getState();
      store.setAgentTask(payload.agentId, null);
      store.setAgentProgress(payload.agentId, 100);
      if (payload.linesWritten > 0) {
        store.addLinesWritten(payload.agentId, payload.linesWritten);
      }
    });
    this.unsubscribers.push(unsubCompleted);
  }

  /**
   * Constroi a lista de execucoes a partir das tarefas decompostas.
   * Agrupa por fase (campo phase da DecomposedTask).
   */
  private buildExecutions(tasks: DecomposedTask[], projectId: string): AgentTaskExecution[] {
    const agents = useAgentsStore.getState().agents;

    return tasks.map((task, index) => {
      const agent = agents.find((a) => a.role === task.targetRole);
      const exec: AgentTaskExecution = {
        taskId: task.id,
        agentId: agent?.id ?? task.targetRole,
        role: task.targetRole,
        description: task.description,
        phase: task.phase,
      };

      // Persiste task no Supabase com status "pending" (fire-and-forget)
      insertTask(
        projectId,
        task.id,
        task.metadata.title ?? task.description.substring(0, 100),
        task.description,
        task.targetRole,
        tasks.length - index,
      ).catch(() => {});

      return exec;
    });
  }

  /**
   * Infere a fase do pipeline a partir do role do agente.
   * Usado na retomada de tasks pendentes que não têm fase explícita.
   */
  private inferPhaseFromRole(role: AgentRole): 1 | 2 | 3 | 4 | 5 {
    switch (role) {
      case "pm": return 1;
      case "architect": return 2;
      case "frontend":
      case "backend":
      case "database": return 3;
      case "reviewer":
      case "qa":
      case "security": return 4;
      case "devops": return 5;
      default: return 3;
    }
  }

  /**
   * Executa tarefas em fases sequenciais (pipeline).
   * Cada fase pode conter múltiplas tarefas em paralelo.
   * O output de cada fase é passado como contexto para a próxima.
   */
  private async executeTaskPipeline(
    executions: AgentTaskExecution[],
    projectId: string,
  ): Promise<void> {
    const settings = useSettingsStore.getState();

    // Agrupa execuções por fase
    const phaseGroups = new Map<number, AgentTaskExecution[]>();
    for (const exec of executions) {
      const group = phaseGroups.get(exec.phase) ?? [];
      group.push(exec);
      phaseGroups.set(exec.phase, group);
    }

    // Ordena fases
    const sortedPhases = [...phaseGroups.keys()].sort((a, b) => a - b);

    // Acumula outputs entre fases
    const phaseOutputs: PhaseOutputs = {
      prd: "",
      architecture: "",
      changedFilesSummary: "",
    };

    // Executa fase a fase
    for (const phaseNum of sortedPhases) {
      if (!this.processing) break;

      const phaseTasks = phaseGroups.get(phaseNum);
      if (!phaseTasks || phaseTasks.length === 0) continue;

      const phaseName = PHASE_NAMES[phaseNum] ?? `PHASE_${phaseNum}`;
      console.log(`[OrchestratorService] Iniciando Fase ${phaseNum} (${phaseName}) com ${phaseTasks.length} tarefa(s)`);

      useChatStore.getState().addMessage(
        "orchestrator",
        `Iniciando **Fase ${phaseNum} — ${phaseName}** (${phaseTasks.length} tarefa(s))...`,
      );

      // Monta contexto compartilhado com outputs das fases anteriores
      const phaseContext = this.buildPhaseContext(phaseNum, phaseOutputs, executions);

      // Adiciona contexto ao prompt de cada tarefa da fase
      const enrichedTasks = phaseTasks.map((t) => ({
        ...t,
        description: phaseContext + t.description,
      }));

      // Fase 4 (QUALITY): lê arquivos reais do disco em vez de texto de chat
      if (phaseNum === 4) {
        const project = this.getProjectContext();
        if (project?.localPath) {
          try {
            const filesSummary = await getChangedFilesSummary(project.localPath);
            phaseOutputs.changedFilesSummary = filesSummary;
          } catch (err) {
            console.warn("[OrchestratorService] Falha ao ler arquivos do projeto:", err);
          }
        }
      }

      // Executa tarefas da fase em paralelo (respeitando batch size)
      const BATCH_SIZE = settings.maxParallelAgents ?? 4;
      const phaseResults: Map<string, string> = new Map();

      for (let i = 0; i < enrichedTasks.length; i += BATCH_SIZE) {
        if (!this.processing) break;

        const batch = enrichedTasks.slice(i, i + BATCH_SIZE);
        const promises = batch.map(async (exec) => {
          if (!this.processing) return;

          // Emite walking event: orquestrador caminha até o agente destino
          eventBus.publish(EventType.AGENT_WALKING, {
            agentId: `walk-${exec.agentId}-${Date.now()}`,
            fromAgentId: "orchestrator",
            toAgentId: exec.agentId,
            label: (exec.description.substring(0, 35) + "...").replace(/\n/g, " "),
            waypoints: [],
            timestamp: new Date().toISOString(),
          });

          try {
            const output = await this.executeAgentTask(exec, settings, projectId);
            phaseResults.set(exec.role, output);
          } catch (error) {
            const errorMsg = error instanceof Error ? error.message : String(error);
            console.error(`[OrchestratorService] Erro na tarefa ${exec.taskId} (Fase ${phaseNum}):`, errorMsg);

            useChatStore.getState().addMessage(
              exec.agentId,
              `Erro ao executar tarefa: ${errorMsg}`,
            );

            // Persiste status blocked no Supabase
            updateTaskStatus(exec.taskId, "blocked", { reason: errorMsg }).catch(() => {});
            agentRuntime.completeCurrentTask(exec.agentId, "failure", errorMsg);
          }
        });

        await Promise.allSettled(promises);
      }

      // Coleta outputs da fase para passar como contexto para a próxima
      if (phaseNum === 1) {
        // Fase 1 (PLANNING): salva PRD do PM
        phaseOutputs.prd = phaseResults.get("pm") ?? "";
      } else if (phaseNum === 2) {
        // Fase 2 (ARCHITECTURE): salva arquitetura
        phaseOutputs.architecture = phaseResults.get("architect") ?? "";
      }
      // Fase 3 cria arquivos → Fase 4 lê do disco (já tratado acima)

      // Fase 4 (QUALITY): roda code review com arquivos reais
      if (phaseNum === 4 && this.processing) {
        const reviewResult = await this.runCodeReview(executions, phaseOutputs, settings, projectId);
        if (reviewResult === "retry") {
          useChatStore.getState().addMessage(
            "orchestrator",
            "Review reprovou o codigo. Algumas tarefas marcadas como **blocked**.",
          );
        }
      }

      console.log(`[OrchestratorService] Fase ${phaseNum} (${phaseName}) concluída`);
    }

    // Verificação final: roda tsc uma vez depois de TODOS os agentes
    if (this.processing) {
      const verifyResult = await this.verifyProjectCode(projectId);
      if (verifyResult?.hasErrors) {
        // Manda o architect corrigir
        const fixExec: AgentTaskExecution = {
          taskId: `fix_${Date.now()}`,
          agentId: "architect",
          role: "architect",
          description: `Corrija os seguintes erros de TypeScript no projeto. NAO crie novos arquivos, apenas corrija os erros existentes:\n\n${verifyResult.errors}`,
          phase: 2,
        };
        useChatStore.getState().addMessage("orchestrator", `Erros de TypeScript encontrados. Enviando para o Arquiteto corrigir...`);
        try {
          await this.executeAgentTask(fixExec, settings, projectId);
        } catch {
          console.warn("[OrchestratorService] Falha ao corrigir erros");
        }
      }
    }
  }

  /**
   * Monta o contexto de fase a ser injetado no prompt de cada tarefa.
   * Cada fase recebe o output acumulado das fases anteriores.
   */
  private buildPhaseContext(
    phaseNum: number,
    phaseOutputs: PhaseOutputs,
    allExecutions: AgentTaskExecution[],
  ): string {
    const allTasksSummary = allExecutions
      .map((e, i) => `${i + 1}. [Fase ${e.phase}][${e.role}] ${e.description.substring(0, 150)}`)
      .join("\n");

    let context = `## Plano completo do projeto (${allExecutions.length} tarefas em fases)
Voce e UM dos agentes trabalhando neste projeto. O trabalho e dividido em 5 fases sequenciais.
NAO crie arquivos que sao responsabilidade de outro agente. Foque APENAS na sua tarefa.

${allTasksSummary}

## IMPORTANTE: Evite conflitos
- Verifique se o arquivo ja existe antes de criar
- NAO crie package.json, tsconfig.json, vite.config.ts se sua tarefa nao e "Setup"
- Use imports relativos para arquivos que outros agentes vao criar
- Se precisa de um tipo/interface de outro agente, defina localmente ou importe de src/types/
`;

    // Injeta PRD do PM (disponível a partir da Fase 2)
    if (phaseNum >= 2 && phaseOutputs.prd.length > 0) {
      context += `\n## PRD do Produto\n${phaseOutputs.prd.substring(0, 4000)}\n`;
    }

    // Injeta Arquitetura (disponível a partir da Fase 3)
    if (phaseNum >= 3 && phaseOutputs.architecture.length > 0) {
      context += `\n## Arquitetura e Convencoes\n${phaseOutputs.architecture.substring(0, 4000)}\n`;
    }

    // Injeta resumo de arquivos reais (Fase 4 — QUALITY)
    if (phaseNum === 4 && phaseOutputs.changedFilesSummary.length > 0) {
      context += `\n## Codigo real do projeto (arquivos criados)\nAnalise os arquivos REAIS abaixo, NAO texto de chat:\n\n${phaseOutputs.changedFilesSummary.substring(0, 8000)}\n`;
    }

    context += "\n## Sua tarefa especifica:\n";
    return context;
  }

  /**
   * Executa uma tarefa individual com o LLM do agente.
   * Retorna o output acumulado do agente (usado para passar contexto entre fases).
   */
  private async executeAgentTask(
    exec: AgentTaskExecution,
    settings: ReturnType<typeof useSettingsStore.getState>,
    projectId: string,
  ): Promise<string> {
    const defaults = settings.agentDefaults[exec.role];
    if (!defaults || !settings.isProviderConfigured(defaults.provider)) {
      useChatStore.getState().addMessage(
        exec.agentId,
        `Provider LLM nao configurado para ${exec.role}. Tarefa marcada como skipped.`,
      );
      agentRuntime.completeCurrentTask(exec.agentId, "partial", "Provider nao configurado");
      return "";
    }

    // Configura provider para este agente
    llmGateway.setAgentConfig(exec.agentId, defaults.provider, defaults.model);

    // Persiste status in_progress no Supabase
    updateTaskStatus(exec.taskId, "in_progress").catch(() => {});

    // Atualiza status, task e progresso do agente
    const agentStore = useAgentsStore.getState();
    agentStore.setAgentStatus(exec.agentId, AgentStatus.Working);
    agentStore.setAgentTask(exec.agentId, exec.description.substring(0, 80));
    agentStore.setAgentProgress(exec.agentId, 10);

    // Monta o prompt para o agente (com memórias do projeto e preferências)
    const systemPrompt = this.buildAgentSystemPrompt(exec.role, projectId);

    // Cria mensagem placeholder no chat
    const msgId = useChatStore.getState().addMessage(exec.agentId, "");
    useChatStore.getState().setStreaming(msgId, true);

    let accumulatedContent = "";

    try {
      const stream = llmGateway.stream({
        agentId: exec.agentId,
        messages: [
          { role: "user", content: exec.description },
        ],
        model: defaults.model,
        temperature: 0.5,
        maxTokens: 4096,
        systemPrompt,
        metadata: {},
      });

      let chunkCount = 0;
      for await (const chunk of stream) {
        accumulatedContent += chunk.content;
        chunkCount++;

        // Atualiza mensagem a cada N chunks para performance
        if (chunkCount % 3 === 0 || chunk.done) {
          useChatStore.getState().updateMessage(msgId, accumulatedContent);
        }

        // Atualiza progresso baseado nos chunks
        const progress = Math.min(90, 10 + chunkCount * 2);
        useAgentsStore.getState().setAgentProgress(exec.agentId, progress);
      }

      // Garante que o conteudo final esta atualizado
      useChatStore.getState().updateMessage(msgId, accumulatedContent);
      useChatStore.getState().setStreaming(msgId, false);

      // Persiste status review no Supabase
      updateTaskStatus(exec.taskId, "review").catch(() => {});

      // Persiste task como done no Supabase
      updateTaskStatus(exec.taskId, "done", {
        outputLength: accumulatedContent.length,
      }).catch(() => {});

      // Marca tarefa como concluida
      agentRuntime.completeCurrentTask(
        exec.agentId,
        "success",
        accumulatedContent.substring(0, 200),
      );

      useAgentsStore.getState().setAgentProgress(exec.agentId, 100);
      useAgentsStore.getState().setAgentStatus(exec.agentId, AgentStatus.Done);
      useAgentsStore.getState().setAgentTask(exec.agentId, "Concluído");

      // Salva progresso no projeto (persiste entre reloads)
      const { useProjectStore } = await import("../../stores/project-store");
      const activeId = useProjectStore.getState().activeProjectId;
      if (activeId) {
        const taskTitle = exec.description.substring(0, 100);
        const project = useProjectStore.getState().getProject();
        if (project) {
          const newTasks = project.completedTasks.includes(taskTitle)
            ? project.completedTasks
            : [...project.completedTasks, taskTitle];
          useProjectStore.getState()._updateProject(activeId, { completedTasks: newTasks });

          // Sync com Supabase (fire-and-forget)
          const { getSupabaseClient } = await import("../supabase/safe-client");
          const supabase = getSupabaseClient();
          if (supabase) {
            supabase.from("projects").update({ progress: project.progress }).eq("id", activeId).then();
          }
        }
      }

      // Salvar resposta do agente como memória do projeto
      if (accumulatedContent.length > 0) {
        const memTitle =
          accumulatedContent.length > 60
            ? accumulatedContent.slice(0, 60) + "..."
            : accumulatedContent;
        useMemoryStore.getState().addProjectMemory({
          projectId,
          agentRole: exec.role,
          type: "progress",
          title: memTitle,
          content: accumulatedContent,
        });

        // Auto-aprendizado: extrair padrões e preferências da resposta
        this.extractAndSavePatterns(accumulatedContent, exec.role, projectId);
      }

      return accumulatedContent;

    } catch (error) {
      useChatStore.getState().setStreaming(msgId, false);

      if (accumulatedContent.length === 0) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        useChatStore.getState().updateMessage(
          msgId,
          `Erro ao executar tarefa: ${errorMsg}`,
        );
      }

      throw error;
    }
  }

  /**
   * Verifica erros de TypeScript na pasta do projeto.
   * Roda `npx tsc --noEmit` via endpoint e retorna erros se houver.
   */
  private async verifyProjectCode(_projectId: string): Promise<{ hasErrors: boolean; errors: string } | null> {
    const project = this.getProjectContext();
    if (!project?.localPath) return null;

    try {
      const res = await fetch("/api/claude/execute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          args: ["-p", "Execute npx tsc --noEmit e me diga APENAS os erros encontrados. Se nao houver erros, responda apenas: OK", "--output-format", "json", "--no-session-persistence", "--effort", "low", "--dangerously-skip-permissions"],
          cwd: project.localPath,
        }),
      });

      if (!res.ok) return null;

      const result = await res.json() as { success: boolean; stdout: string; stderr: string };
      if (!result.success) return null;

      try {
        const data = JSON.parse(result.stdout) as { result?: string };
        const output = data.result ?? result.stdout;

        if (output.includes("OK") && !output.includes("error") && !output.includes("Error")) {
          console.log(`[OrchestratorService] Verificacao do projeto: sem erros`);
          return { hasErrors: false, errors: "" };
        }

        console.log(`[OrchestratorService] Verificacao do projeto: erros encontrados`);
        return { hasErrors: true, errors: output.substring(0, 2000) };
      } catch {
        return null;
      }
    } catch {
      return null;
    }
  }

  /**
   * Formata memórias do projeto para inclusão no system prompt.
   */
  private formatProjectMemoriesForPrompt(projectId: string, role: AgentRole): string {
    const memories = useMemoryStore.getState().projectMemories
      .filter((m) => m.projectId === projectId && (m.agentRole === role || m.type === "decision"))
      .slice(-5);

    if (memories.length === 0) return "";

    const formatted = memories
      .map((m) => `- [${m.type}] ${m.title} (por ${m.agentRole}, ${new Date(m.createdAt).toLocaleString("pt-BR")})`)
      .join("\n");

    return `\n\n## Memoria do Projeto (o que ja foi feito)\n${formatted}`;
  }

  /**
   * Formata memórias de desenvolvimento para inclusão no system prompt.
   */
  private formatDevMemoriesForPrompt(): string {
    const devMemories = useMemoryStore.getState().devMemories;

    if (devMemories.length === 0) return "";

    const formatted = devMemories
      .map((m) => `- [${m.category}] ${m.title}: ${m.content}`)
      .join("\n");

    return `\n\n## Preferencias de Desenvolvimento do Usuario\n${formatted}`;
  }

  /**
   * Extrai padrões e preferências da resposta de um agente e salva como DevMemory.
   */
  private extractAndSavePatterns(response: string, role: AgentRole, projectId: string): void {
    const memStore = useMemoryStore.getState();
    const existingTitles = new Set(memStore.devMemories.map((m) => m.title));

    const patterns: Array<{ keyword: string; title: string; category: "convention" | "pattern" | "preference" }> = [
      { keyword: "tailwind", title: "Usa Tailwind CSS para estilos", category: "convention" },
      { keyword: "typescript strict", title: "TypeScript em modo strict", category: "convention" },
      { keyword: "vitest", title: "Usa Vitest para testes", category: "convention" },
      { keyword: "zustand", title: "Usa Zustand para state management", category: "convention" },
      { keyword: "react-router", title: "Usa React Router para navegacao", category: "convention" },
      { keyword: "framer-motion", title: "Usa Framer Motion para animacoes", category: "convention" },
      { keyword: "fastify", title: "Usa Fastify como framework backend", category: "convention" },
      { keyword: "prisma", title: "Usa Prisma como ORM", category: "convention" },
      { keyword: "zod", title: "Usa Zod para validacao", category: "convention" },
    ];

    const lowerResponse = response.toLowerCase();

    for (const pat of patterns) {
      if (lowerResponse.includes(pat.keyword) && !existingTitles.has(pat.title)) {
        memStore.addDevMemory({
          category: pat.category,
          title: pat.title,
          content: `Detectado no projeto ${projectId} pelo agente ${role}`,
          learnedFrom: `auto:${role}`,
        });
        existingTitles.add(pat.title);
      }
    }
  }

  /**
   * Executa code review na Fase 4 (QUALITY).
   * Lê arquivos REAIS do disco (não texto de chat) e roda Reviewer + QA + Security em paralelo.
   * Se QUALQUER reviewer reprova, retorna "retry".
   */
  private async runCodeReview(
    allExecutions: AgentTaskExecution[],
    phaseOutputs: PhaseOutputs,
    settings: ReturnType<typeof useSettingsStore.getState>,
    _projectId: string,
  ): Promise<"approved" | "retry"> {
    const project = this.getProjectContext();

    // Lê arquivos reais do disco para passar ao review
    let codeToReview = phaseOutputs.changedFilesSummary;
    if ((!codeToReview || codeToReview.length === 0) && project?.localPath) {
      try {
        codeToReview = await getChangedFilesSummary(project.localPath);
      } catch {
        console.warn("[OrchestratorService] Nao foi possivel ler arquivos para review");
      }
    }

    if (!codeToReview || codeToReview.length === 0) {
      console.warn("[OrchestratorService] Sem arquivos para revisar, aprovando automaticamente");
      return "approved";
    }

    // Roles de review que vamos rodar em paralelo (inclui designer para revisão de UI)
    const reviewRoles: AgentRole[] = ["reviewer", "qa", "security", "designer"];

    // Filtra: não revisa a si mesmo (se um reviewer tiver task na Fase 4, pula)
    const phase4Roles = new Set(
      allExecutions.filter((e) => e.phase === 4).map((e) => e.role),
    );

    const activeReviewRoles = reviewRoles.filter((role) => !phase4Roles.has(role) || role !== role);
    // Na prática: reviewer não revisa reviewer, qa não revisa qa, etc.
    // Mas todos revisam o código dos agentes de Fase 3

    const agentStore = useAgentsStore.getState();
    let anyRejected = false;

    // Roda os 3 reviewers em paralelo
    const reviewPromises = activeReviewRoles.map(async (reviewRole) => {
      const reviewerDefaults = settings.agentDefaults[reviewRole];
      if (!reviewerDefaults || !settings.isProviderConfigured(reviewerDefaults.provider)) {
        return; // Sem provider → pula
      }

      const reviewerAgent = agentStore.agents.find((a) => a.role === reviewRole);
      if (!reviewerAgent) return;

      try {
        agentStore.setAgentStatus(reviewerAgent.id, AgentStatus.Review);
        agentStore.setAgentTask(reviewerAgent.id, `Revisando codigo do projeto`);

        // Walker visual
        eventBus.publish(EventType.AGENT_WALKING, {
          agentId: `walk-review-${reviewerAgent.id}-${Date.now()}`,
          fromAgentId: "orchestrator",
          toAgentId: reviewerAgent.id,
          label: `Review (${reviewRole})`,
          waypoints: [],
          timestamp: new Date().toISOString(),
        });

        useChatStore.getState().addMessage(
          reviewerAgent.id,
          `Revisando codigo real do projeto como ${reviewRole}...`,
        );

        llmGateway.setAgentConfig(reviewerAgent.id, reviewerDefaults.provider, reviewerDefaults.model);

        // Monta prompt específico por role de review
        const reviewPromptMap: Record<string, string> = {
          reviewer: `Revise o codigo abaixo. Verifique:
1. Erros de logica ou bugs obvios
2. Imports incorretos ou faltando
3. Tipos TypeScript incorretos (nunca any)
4. Codigo incompleto (stubs, TODOs)
5. Padroes de codigo inconsistentes`,
          qa: `Como QA Engineer, verifique o codigo abaixo:
1. Existem testes para as funcionalidades principais?
2. Ha edge cases nao tratados?
3. Tratamento de erros adequado?
4. Validacao de inputs?
5. Ha memory leaks ou problemas de performance obvios?`,
          security: `Como Security Engineer, verifique o codigo abaixo:
1. Vulnerabilidades de injecao (SQL, XSS, etc.)
2. Dados sensiveis expostos (keys, tokens, senhas)
3. Validacao de input insuficiente
4. Problemas de autenticacao/autorizacao
5. Dependencias com vulnerabilidades conhecidas`,
        };

        const reviewPrompt = reviewPromptMap[reviewRole] ?? reviewPromptMap.reviewer;

        const reviewResponse = await llmGateway.send({
          agentId: reviewerAgent.id,
          messages: [
            {
              role: "user",
              content: `${reviewPrompt}

Se estiver OK, responda apenas: APROVADO
Se tiver problemas, responda: REPROVADO seguido da lista de problemas.

--- CODIGO DO PROJETO ---
${codeToReview.substring(0, 6000)}`,
            },
          ],
          model: reviewerDefaults.model,
          temperature: 0.2,
          maxTokens: 1024,
          systemPrompt: `Voce e um ${reviewRole === "reviewer" ? "Code Reviewer" : reviewRole === "qa" ? "QA Engineer" : "Security Engineer"}. Seja conciso. Responda APROVADO ou REPROVADO.`,
          metadata: {},
        });

        const approved = !reviewResponse.content.toUpperCase().includes("REPROVADO");

        if (approved) {
          useChatStore.getState().addMessage(reviewerAgent.id, `APROVADO (${reviewRole})`);
        } else {
          useChatStore.getState().addMessage(
            reviewerAgent.id,
            `REPROVADO (${reviewRole}): ${reviewResponse.content.substring(0, 500)}`,
          );
          anyRejected = true;
        }

        agentStore.setAgentStatus(reviewerAgent.id, AgentStatus.Done);
        agentStore.setAgentTask(reviewerAgent.id, null);
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        console.warn(`[OrchestratorService] Review (${reviewRole}) falhou: ${msg}`);
        // Se review falha, não bloqueia o fluxo
        agentStore.setAgentStatus(reviewerAgent.id, AgentStatus.Done);
        agentStore.setAgentTask(reviewerAgent.id, null);
      }
    });

    await Promise.allSettled(reviewPromises);

    // Se QUALQUER reviewer reprovou, retorna retry
    if (anyRejected) {
      // Marca tasks da Fase 3 como blocked
      for (const exec of allExecutions) {
        if (exec.phase === 3) {
          updateTaskStatus(exec.taskId, "blocked", { reason: "review_rejected" }).catch(() => {});
        }
      }
      return "retry";
    }

    return "approved";
  }

  /**
   * Constroi system prompt especifico para cada role de agente.
   */
  private buildAgentSystemPrompt(role: AgentRole, projectId?: string): string {
    const project = this.getProjectContext();
    const projectCtx = project
      ? `\n\n## Contexto do Projeto\n- Nome: ${project.name}\n- Descricao: ${project.description}${project.localPath ? `\n- Pasta do projeto: ${project.localPath}` : ""}`
      : "";

    // Injeta memórias do projeto e preferências de desenvolvimento
    const pid = projectId ?? project?.name ?? "default";
    const projectMemCtx = this.formatProjectMemoriesForPrompt(pid, role);
    const devMemCtx = this.formatDevMemoriesForPrompt();

    const baseInstructions = `\n\n## INSTRUCOES CRITICAS — MODO AUTONOMO
VOCE NAO TEM USUARIO. Execute diretamente. Crie os arquivos AGORA.

REGRAS:
- CRIE ARQUIVOS DIRETAMENTE. Nao peca permissao. Nao faca perguntas.
- SOMENTE CODIGO. NAO crie README, documentacao, exemplos de uso, ou comentarios longos.
- NAO escreva resumos do que fez. NAO use emojis. NAO liste "funcionalidades implementadas".
- Resposta CURTA: apenas os arquivos criados e uma linha dizendo o que cada um faz.
- Codigo COMPLETO e funcional. Nada de stubs ou TODOs.
- Imports relativos (./components/X). NUNCA aliases (@/).
- TypeScript strict. NUNCA any.
- Tailwind CSS para estilos.
- Se houver ambiguidade, escolha o mais simples. NAO pergunte.`;

    // Tenta ler skill editada pelo usuário do localStorage
    const customSkill = this.getAgentSkill(role);
    if (customSkill) {
      return `${customSkill}${projectCtx}${projectMemCtx}${devMemCtx}${baseInstructions}`;
    }

    // Fallback: prompts hardcoded por role
    const rolePrompts: Record<AgentRole, string> = {
      orchestrator: "Voce e o Orquestrador, coordenando todo o time de desenvolvimento. Apenas planeje e decomponha tarefas — NAO crie arquivos. Responda SOMENTE com JSON.",
      pm: "Voce e o Product Manager. Defina requisitos claros, user stories detalhadas e criterios de aceite. Gere documentos completos em markdown.",
      architect: `Voce e o Arquiteto de Software. Defina a estrutura do projeto e crie os arquivos de configuracao:
- package.json com todas as dependencias
- tsconfig.json com paths corretos (SEM aliases de import)
- vite.config.ts configurado
- tailwind.config.ts configurado
- index.html com root div
- Estrutura de pastas (src/components, src/pages, src/hooks, src/utils, src/types)`,
      frontend: `Voce e o Frontend Developer. Implemente componentes React completos:
- Componentes funcionais com TypeScript strict
- Estilos com Tailwind CSS (classes utilitarias)
- Imports relativos (./components/X, nunca @/components/X)
- Cada componente deve ser funcional e renderizavel
- Inclua o App.tsx e main.tsx se nao existirem`,
      backend: `Voce e o Backend Developer. Implemente logica de negocios e APIs:
- Funcoes e servicos com TypeScript strict
- Tratamento de erros completo
- Types/interfaces bem definidos
- Integracoes com APIs externas quando necessario`,
      database: `Voce e o Database Engineer. Implemente schema e queries:
- Migrations SQL completas
- Types TypeScript correspondentes
- Funcoes de acesso a dados tipadas`,
      qa: "Voce e o QA Engineer. Escreva testes completos com Vitest. Cubra casos de sucesso, erro e edge cases.",
      security: "Voce e o Security Engineer. Identifique vulnerabilidades e implemente correcoes diretas no codigo.",
      devops: "Voce e o DevOps Engineer. Configure CI/CD, Docker e deployment com arquivos completos.",
      reviewer: "Voce e o Code Reviewer. Revise codigo e aplique correcoes diretamente quando encontrar problemas.",
      designer: `Voce e o UI/UX Designer do ForgeAI. Seu trabalho e revisar e melhorar a interface criada pelo Frontend Dev.

RESPONSABILIDADES:
1. Analisar o layout e componentes criados pelo Frontend
2. Pesquisar como grandes players (Stripe, Linear, Vercel, Notion, Figma) resolvem problemas similares de UI
3. Sugerir melhorias de UX: hierarquia visual, espacamento, tipografia, cores, feedback visual
4. Verificar responsividade e acessibilidade
5. Reescrever componentes com layout profissional quando necessario

REGRAS:
- Use Tailwind CSS — NUNCA CSS inline
- Design system: espacamento consistente (4, 8, 12, 16, 24, 32, 48px)
- Tipografia: hierarquia clara (h1 > h2 > body > caption)
- Cores: paleta escura do projeto (#0c1322 fundo), contraste WCAG AA
- Animacoes sutis com Framer Motion (hover, transicoes de pagina)
- Mobile-first: 320px → 768px → 1024px → 1440px
- Componentes reutilizaveis: Button, Input, Card, Modal, Badge, Toast
- Patterns de referencia: dashboards do Linear, forms do Stripe, navegacao do Notion`,
    };

    return `${rolePrompts[role]}${projectCtx}${projectMemCtx}${devMemCtx}${baseInstructions}`;
  }

  /**
   * Lê a skill do agente do cache (populado pelo Supabase + arquivos SKILL.md).
   * Retorna null se não encontrar (usa fallback hardcoded).
   */
  private getAgentSkill(role: AgentRole): string | null {
    return this.skillsCache.get(role) ?? null;
  }

  /**
   * Carrega todas as skills dos arquivos SKILL.md via endpoint /api/skills/:role.
   * Extrai a seção "## System Prompt" e guarda no cache.
   */
  private async loadAllSkills(): Promise<void> {
    // 0. Sincroniza SKILL.md dos arquivos locais para o Supabase (garante dados atualizados)
    try {
      const { syncSkillsFromFiles } = await import("../supabase/skills-service");
      await syncSkillsFromFiles();
    } catch {
      // Falha na sync — continua com o que tem
    }

    // 1. Carrega do Supabase (agora com dados atualizados)
    try {
      const { fetchAllSkills } = await import("../supabase/skills-service");
      const supabaseSkills = await fetchAllSkills();
      for (const skill of supabaseSkills) {
        if (skill.content && skill.content.length > 0) {
          const systemPrompt = this.extractSystemPrompt(skill.content);
          if (systemPrompt) {
            this.skillsCache.set(skill.agent_role, systemPrompt);
          }
        }
      }
      if (supabaseSkills.length > 0) {
        console.log(`[OrchestratorService] ${supabaseSkills.length} skills carregadas do Supabase`);
      }
    } catch {
      // Supabase indisponível — continua com arquivos
    }

    // 2. Carrega dos arquivos SKILL.md (preenche o que faltou)
    const results = await Promise.allSettled(
      ALL_ROLES.map(async (role) => {
        if (this.skillsCache.has(role)) return; // já carregou do Supabase
        try {
          const res = await fetch(`/api/skills/${role}`);
          if (!res.ok) return;
          const data = await res.json() as { content: string | null };
          if (!data.content) return;

          const systemPrompt = this.extractSystemPrompt(data.content);
          if (systemPrompt) {
            this.skillsCache.set(role, systemPrompt);
          }
        } catch (err) {
          console.warn(`[OrchestratorService] Erro ao carregar skill ${role}:`, err);
        }
      }),
    );

    const loaded = results.filter((r) => r.status === "fulfilled").length;
    console.log(`[OrchestratorService] ${this.skillsCache.size} skills no cache (${loaded} tentativas de arquivo)`);
  }

  /**
   * Extrai o conteúdo da seção "## System Prompt" de um arquivo SKILL.md.
   * O prompt pode estar dentro de um code block (```) ou como texto direto.
   */
  private extractSystemPrompt(markdown: string): string | null {
    // Encontra a seção "## System Prompt" até a próxima seção ## (não ###)
    const sectionMatch = markdown.match(/## System Prompt\s*\n([\s\S]*?)(?=\n## (?!#)|$)/);
    if (!sectionMatch) return null;

    const sectionContent = (sectionMatch[1] ?? "").trim();
    if (!sectionContent) return null;

    // Encontra o PRIMEIRO ``` (abertura) e o ÚLTIMO ``` (fechamento)
    const firstBacktick = sectionContent.indexOf("```");
    const lastBacktick = sectionContent.lastIndexOf("```");

    if (firstBacktick !== -1 && lastBacktick !== firstBacktick) {
      // Pega tudo entre o primeiro ``` e o último ```
      const afterFirst = sectionContent.indexOf("\n", firstBacktick);
      if (afterFirst !== -1) {
        return sectionContent.substring(afterFirst + 1, lastBacktick).trim();
      }
    }

    // Fallback: usa o conteúdo direto (sem code block)
    return sectionContent;
  }

  /**
   * Obtem contexto do projeto ativo a partir do store.
   */
  private getProjectContext(): { name: string; description: string; localPath: string | null } | null {
    try {
      const { useProjectStore } = require("@/stores/project-store") as {
        useProjectStore: { getState: () => { getProject: () => { name: string; description: string; localPath: string | null } | null } };
      };
      const project = useProjectStore.getState().getProject();
      if (!project) return null;
      return { name: project.name, description: project.description, localPath: project.localPath };
    } catch {
      return null;
    }
  }
}

/** Instancia singleton do OrchestratorService */
export const orchestratorService = new OrchestratorServiceImpl();
