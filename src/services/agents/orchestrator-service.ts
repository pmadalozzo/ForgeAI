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
import { insertTask, updateTaskStatus, loadPendingTasks, syncProjectProgress } from "../supabase/tasks-service";
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
      // Se ficou preso por mais de 15 minutos, reseta automaticamente
      useChatStore.getState().addMessage(
        "orchestrator",
        "Ainda estou processando a solicitacao anterior. Aguarde a conclusao.",
      );
      return;
    }

    this.processing = true;

    // Safety timeout: se o pipeline travar, reseta após 20 minutos
    const safetyTimeout = setTimeout(() => {
      if (this.processing) {
        console.warn("[OrchestratorService] Safety timeout: resetando processing flag após 20 minutos");
        this.processing = false;
        import("../../stores/project-store").then(({ useProjectStore }) => {
          useProjectStore.getState().setCurrentPhase(null);
        }).catch(() => {});
      }
    }, 20 * 60 * 1000);

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

        // Seta fase inicial para que a UI mostre o indicador
        const firstPhase = Math.min(...resumeExecutions.map((e) => e.phase));
        const { useProjectStore } = await import("../../stores/project-store");
        const phaseName = PHASE_NAMES[firstPhase] ?? `PHASE_${firstPhase}`;
        useProjectStore.getState().setCurrentPhase({
          phase: firstPhase,
          name: phaseName,
          totalTasks: resumeExecutions.filter((e) => e.phase === firstPhase).length,
          completedTasks: 0,
        });

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

      // Indica fase de planejamento na UI
      {
        const { useProjectStore } = await import("../../stores/project-store");
        useProjectStore.getState().setCurrentPhase({
          phase: 0,
          name: "PLANEJANDO",
          totalTasks: 0,
          completedTasks: 0,
        });
      }

      // Informa que esta decompondo
      const decomposingId = useChatStore.getState().addMessage(
        "orchestrator",
        "Analisando sua solicitacao e decompondo em tarefas para os agentes...",
      );

      // Determina se é continuação automática ou mensagem livre do usuário
      const isContinuation = message.includes("[CONTINUAR PROJETO]");

      // Só reutiliza plano do chat para continuação automática
      // Mensagens livres do usuário ("melhore o Hero", "adicione contato") geram plano NOVO
      let lastOrchestratorMsg: { content: string } | undefined;
      if (isContinuation) {
        const chatMessages = useChatStore.getState().messages;
        lastOrchestratorMsg = [...chatMessages]
          .reverse()
          .find((m) =>
            m.from === "orchestrator" &&
            m.content.length > 100 &&
            !m.content.startsWith("[Erro") &&
            !m.content.startsWith("Analisando sua solicitacao") &&
            !m.content.startsWith("Ainda estou") &&
            !m.content.startsWith("Processamento interrompido") &&
            !m.content.startsWith("Decompus") &&
            !m.content.startsWith("Iniciando") &&
            !m.content.startsWith("Enviando") &&
            !m.content.startsWith("Review reprovou") &&
            !m.content.startsWith("Projeto conclu") &&
            !m.content.startsWith("Pipeline finalizado") &&
            /\d+\.\s+\*\*[^*]+\*\*\s*\((?:architect|frontend|backend|database|qa|security|devops|reviewer|designer|pm)\)/i.test(m.content),
          );
      }

      let tasks: DecomposedTask[] = [];
      try {
        // Decomposição determinística baseada em regras — NÃO depende do CLI.
        // O CLI é inconsistente para planejamento (responde conversacionalmente).
        // Tenta primeiro extrair plano válido da resposta do chat (se o LLM respondeu corretamente).
        // Se não encontrar, usa decomposição por regras baseada em keywords da mensagem.

        const PLAN_PATTERN = /\d+\.\s+\*\*[^*]+\*\*\s*\((?:architect|frontend|backend|database|qa|security|devops|reviewer|designer|pm)\)/i;

        // Tenta extrair de plano existente no chat (continuação ou resposta estruturada)
        const chatMessages = useChatStore.getState().messages;
        const planMsg = isContinuation ? lastOrchestratorMsg : [...chatMessages]
          .reverse()
          .find((m) =>
            m.from === "orchestrator" &&
            m.content.length > 50 &&
            !m.content.startsWith("[Erro") &&
            !m.content.startsWith("Analisando") &&
            PLAN_PATTERN.test(m.content),
          );

        if (planMsg) {
          const cleanContent = planMsg.content
            .replace(/^⏳\s*Processando com Claude CLI\.\.\.\s*/i, "")
            .replace(/\n\n_\(.+\)_$/, "");
          const decomposer = new LLMTaskDecomposer(llmGateway);
          tasks = decomposer.parseFromText(cleanContent);
          const isRealPlan = tasks.length > 1 ||
            (tasks.length === 1 && !tasks[0]!.description.includes("Criar PRD da solicitacao"));
          if (isRealPlan) {
            console.log(`[OrchestratorService] Extraiu ${tasks.length} tarefas do plano no chat`);
          } else {
            tasks = [];
          }
        }

        // Fallback: decomposição determinística por regras (sem LLM)
        if (tasks.length === 0) {
          console.log("[OrchestratorService] Usando decomposição por regras (sem LLM)");
          tasks = this.decomposeByRules(message);
        }
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        useChatStore.getState().updateMessage(
          decomposingId,
          `Erro ao decompor tarefas: ${errorMsg}. Verifique as configuracoes do LLM.`,
        );
        return;
      }

      // Limita a no máximo 8 tasks para evitar execuções infinitas
      if (tasks.length > 8) {
        console.warn(`[OrchestratorService] ${tasks.length} tasks extraídas, limitando a 8`);
        tasks = tasks.slice(0, 8);
      }

      if (tasks.length === 0) {
        useChatStore.getState().updateMessage(
          decomposingId,
          "Nao consegui identificar tarefas na sua solicitacao. Tente descrever com mais detalhes.",
        );
        return;
      }

      // Monta resumo das tarefas (limpa markdown duplo do title)
      const taskSummary = tasks
        .map((t) => {
          const rawTitle = t.metadata.title ?? t.description.substring(0, 50);
          // Remove markdown e referências de fase que já existam no title
          const cleanTitle = rawTitle.replace(/\*\*/g, "").replace(/→\s*\w+\s*\(Fase \d+\)/g, "").trim();
          return `- **${cleanTitle}** → ${t.targetRole} (Fase ${t.phase})`;
        })
        .join("\n");

      useChatStore.getState().updateMessage(
        decomposingId,
        `Decompus em **${tasks.length} tarefa(s)**:\n\n${taskSummary}\n\nDistribuindo para os agentes...`,
      );

      // Executa cada tarefa com o LLM do agente correspondente (em fases)
      const executions = this.buildExecutions(tasks, projectId);
      await this.executeTaskPipeline(executions, projectId);

      // Pipeline completo — atualiza status e progresso final do projeto
      {
        const { useProjectStore } = await import("../../stores/project-store");
        const activeId = useProjectStore.getState().activeProjectId;
        if (activeId) {
          const realProgress = await syncProjectProgress(activeId);
          const finalStatus = realProgress >= 100 ? "done" : "in-progress";
          useProjectStore.getState()._updateProject(activeId, {
            progress: realProgress,
            status: finalStatus,
          });

          // Persiste status no Supabase
          const { getSupabaseClient } = await import("../supabase/safe-client");
          const supabase = getSupabaseClient();
          if (supabase) {
            const dbStatus = finalStatus === "done" ? "completed" : "active";
            await supabase.from("projects").update({ status: dbStatus, progress: realProgress }).eq("id", activeId);
          }

          useChatStore.getState().addMessage(
            "orchestrator",
            realProgress >= 100
              ? "Projeto concluído! Todos os agentes finalizaram suas tarefas. Envie uma mensagem se quiser melhorar algo."
              : `Pipeline finalizado (${realProgress}% concluído). Envie uma mensagem para continuar ou melhorar o projeto.`,
          );
        }
      }

    } finally {
      clearTimeout(safetyTimeout);
      this.processing = false;
      // Limpa indicador de fase
      import("../../stores/project-store").then(({ useProjectStore }) => {
        useProjectStore.getState().setCurrentPhase(null);
      }).catch(() => {});
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

    // Garante que Fase 4 (QUALITY) e Fase 5 (DELIVERY) sempre existam no pipeline
    // mesmo que o decomposer não tenha criado tasks explícitas para elas
    if (!phaseGroups.has(4) && phaseGroups.size > 0) {
      phaseGroups.set(4, []); // runCodeReview cuida da Fase 4 internamente
    }
    if (!phaseGroups.has(5) && phaseGroups.size > 0) {
      phaseGroups.set(5, []); // Pode ficar vazia se não há task de DevOps
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

      const phaseTasks = phaseGroups.get(phaseNum) ?? [];
      // Fase 4 (QUALITY) sempre roda via runCodeReview, mesmo sem tasks decompostas
      // Fase 5 (DELIVERY) sempre roda via runDevOpsDelivery, mesmo sem tasks decompostas
      if (phaseTasks.length === 0 && phaseNum !== 4 && phaseNum !== 5) continue;

      const phaseName = PHASE_NAMES[phaseNum] ?? `PHASE_${phaseNum}`;
      console.log(`[OrchestratorService] Iniciando Fase ${phaseNum} (${phaseName}) com ${phaseTasks.length} tarefa(s)`);

      // Atualiza indicador de fase no store para a UI acompanhar
      {
        const { useProjectStore } = await import("../../stores/project-store");
        useProjectStore.getState().setCurrentPhase({
          phase: phaseNum,
          name: phaseName,
          totalTasks: phaseNum === 4 ? 4 : phaseNum === 5 ? Math.max(1, phaseTasks.length) : phaseTasks.length,
          completedTasks: 0,
        });
      }

      const taskCountLabel = phaseNum === 4
        ? "4 revisores: Code Reviewer, QA, Security, Designer"
        : phaseNum === 5
          ? "1 tarefa: DevOps (build & deploy)"
          : `${phaseTasks.length} tarefa(s)`;
      useChatStore.getState().addMessage(
        "orchestrator",
        `Iniciando **Fase ${phaseNum} — ${phaseName}** (${taskCountLabel})...`,
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
        const project = await this.getProjectContext();
        if (project?.localPath) {
          try {
            const filesSummary = await getChangedFilesSummary(project.localPath);
            phaseOutputs.changedFilesSummary = filesSummary;
          } catch (err) {
            console.warn("[OrchestratorService] Falha ao ler arquivos do projeto:", err);
          }
        }
      }

      // Fase 4 (QUALITY) é tratada pelo runCodeReview — pula execução normal
      if (phaseNum === 4) {
        if (this.processing) {
          const reviewResult = await this.runCodeReview(executions, phaseOutputs, settings, projectId);
          if (reviewResult === "retry") {
            useChatStore.getState().addMessage(
              "orchestrator",
              "Review reprovou o codigo. Algumas tarefas marcadas como **blocked**.",
            );
          }
        }
        console.log(`[OrchestratorService] Fase ${phaseNum} (${phaseName}) concluída`);
        continue;
      }

      // Fase 5 (DELIVERY) é tratada pelo runDevOpsDelivery se não houver tasks explícitas
      if (phaseNum === 5 && phaseTasks.length === 0) {
        if (this.processing) {
          await this.runDevOpsDelivery(phaseOutputs, settings, projectId);
        }
        console.log(`[OrchestratorService] Fase ${phaseNum} (${phaseName}) concluída`);
        continue;
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
        const prdOutput = phaseResults.get("pm") ?? "";
        phaseOutputs.prd = prdOutput.startsWith("[Erro") ? "" : prdOutput;
      } else if (phaseNum === 2) {
        const archOutput = phaseResults.get("architect") ?? "";
        phaseOutputs.architecture = archOutput.startsWith("[Erro") ? "" : archOutput;
      }

      // Fase 3 (DEVELOPMENT): após concluir, Designer revisa o frontend
      if (phaseNum === 3 && this.processing) {
        const hasFrontendTask = phaseTasks.some((t) => t.role === "frontend");
        if (hasFrontendTask) {
          await this.runDesignerReview(executions, phaseOutputs, settings, projectId);
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
          taskId: crypto.randomUUID(),
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

    // Garante que o projeto está marcado como "in-progress"
    {
      const { useProjectStore } = await import("../../stores/project-store");
      const activeId = useProjectStore.getState().activeProjectId;
      if (activeId) {
        const proj = useProjectStore.getState().getProject();
        if (proj && proj.status !== "in-progress") {
          useProjectStore.getState()._updateProject(activeId, { status: "in-progress" });
        }
      }
    }

    // Monta o prompt para o agente (com memórias do projeto e preferências)
    const systemPrompt = await this.buildAgentSystemPrompt(exec.role, projectId);

    // Cria mensagem placeholder no chat com nome da task
    // Extrai título limpo: tenta [Titulo] no description, senão pega as últimas linhas (após "## Sua tarefa especifica:")
    const titleMatch = exec.description.match(/\[Fase \d+ - \w+\] \[(.+?)\]/);
    const taskLabel = titleMatch?.[1]
      ?? exec.description.split("\n").filter((l) => l.trim().length > 0 && !l.startsWith("##") && !l.startsWith("-") && !l.startsWith("Voce")).pop()?.substring(0, 60)
      ?? exec.role;
    const msgId = useChatStore.getState().addMessage(exec.agentId, `⏳ ${taskLabel}...`);
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
        if (chunk.replace) {
          // Provider pediu substituição total (ex: Claude CLI)
          accumulatedContent = chunk.content;
        } else {
          accumulatedContent += chunk.content;
        }
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

      // Verifica se a resposta é um erro (não marca como Done se for erro)
      const isError = accumulatedContent.startsWith("[Erro") ||
        accumulatedContent.includes("Erro do CLI") ||
        accumulatedContent.includes("Erro ao comunicar") ||
        accumulatedContent.length === 0;

      if (isError) {
        // Agente ficou bloqueado — não marcar como Done
        updateTaskStatus(exec.taskId, "blocked", { reason: accumulatedContent.slice(0, 200) }).catch(() => {});
        agentRuntime.completeCurrentTask(exec.agentId, "failure", accumulatedContent.substring(0, 200));
        useAgentsStore.getState().setAgentStatus(exec.agentId, AgentStatus.Blocked);
        useAgentsStore.getState().setAgentTask(exec.agentId, "Erro na execução");
        return accumulatedContent;
      }

      // Sucesso: marca como review
      useAgentsStore.getState().setAgentStatus(exec.agentId, AgentStatus.Review);
      useAgentsStore.getState().setAgentTask(exec.agentId, "Revisando resultado...");

      // Pequena pausa visual para o usuário ver o estado "Review"
      await new Promise((r) => setTimeout(r, 1500));

      // Persiste task como done no Supabase — AWAIT para garantir que está salvo antes de calcular progresso
      await updateTaskStatus(exec.taskId, "done", {
        outputLength: accumulatedContent.length,
      });

      // Marca tarefa como concluida
      agentRuntime.completeCurrentTask(
        exec.agentId,
        "success",
        accumulatedContent.substring(0, 200),
      );

      useAgentsStore.getState().setAgentProgress(exec.agentId, 100);
      useAgentsStore.getState().setAgentStatus(exec.agentId, AgentStatus.Done);
      useAgentsStore.getState().setAgentTask(exec.agentId, "Concluído");

      // Calcula e persiste progresso real DEPOIS de confirmar que task foi salva
      {
        const { useProjectStore } = await import("../../stores/project-store");
        const activeId = useProjectStore.getState().activeProjectId;
        if (activeId) {
          const taskTitle = exec.description.substring(0, 100);
          const project = useProjectStore.getState().getProject();
          if (project) {
            const newTasks = project.completedTasks.includes(taskTitle)
              ? project.completedTasks
              : [...project.completedTasks, taskTitle];

            const realProgress = await syncProjectProgress(activeId);
            console.log(`[OrchestratorService] Progresso atualizado: ${realProgress}% (task: ${taskTitle.substring(0, 40)})`);

            useProjectStore.getState()._updateProject(activeId, {
              completedTasks: newTasks,
              progress: realProgress,
            });
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

      const errorMsg = error instanceof Error ? error.message : String(error);
      if (accumulatedContent.length === 0) {
        useChatStore.getState().updateMessage(
          msgId,
          `Erro ao executar tarefa: ${errorMsg}`,
        );
      }

      // Marca agente como bloqueado (não Done!)
      useAgentsStore.getState().setAgentStatus(exec.agentId, AgentStatus.Blocked);
      useAgentsStore.getState().setAgentTask(exec.agentId, `Erro: ${errorMsg.substring(0, 60)}`);

      throw error;
    }
  }

  /**
   * Verifica erros de TypeScript na pasta do projeto.
   * Roda `npx tsc --noEmit` via endpoint e retorna erros se houver.
   */
  private async verifyProjectCode(_projectId: string): Promise<{ hasErrors: boolean; errors: string } | null> {
    const project = await this.getProjectContext();
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
    projectId: string,
  ): Promise<"approved" | "retry"> {
    const project = await this.getProjectContext();
    console.log(`[OrchestratorService] runCodeReview: project=${project?.name ?? "null"}, localPath=${project?.localPath ?? "null"}, changedFiles=${phaseOutputs.changedFilesSummary?.length ?? 0} chars`);

    // Lê arquivos reais do disco para passar ao review
    let codeToReview = phaseOutputs.changedFilesSummary;
    if ((!codeToReview || codeToReview.length === 0) && project?.localPath) {
      try {
        codeToReview = await getChangedFilesSummary(project.localPath);
        console.log(`[OrchestratorService] getChangedFilesSummary retornou ${codeToReview?.length ?? 0} chars`);
      } catch (err) {
        console.warn("[OrchestratorService] Nao foi possivel ler arquivos para review:", err);
      }
    }

    if (!codeToReview || codeToReview.length === 0) {
      const reason = !project ? "projeto null" : !project.localPath ? "localPath null" : "nenhum arquivo encontrado";
      console.warn(`[OrchestratorService] Sem arquivos para revisar (${reason}), aprovando automaticamente`);
      useChatStore.getState().addMessage(
        "orchestrator",
        `⚠️ Fase 4 pulada: ${reason}. Os revisores precisam de arquivos no projeto para revisar.`,
      );
      return "approved";
    }

    // Todos os roles de qualidade rodam na Fase 4 — NENHUM é excluído
    const reviewRoles: AgentRole[] = ["reviewer", "qa", "security", "designer"];

    const agentStore = useAgentsStore.getState();
    let anyRejected = false;

    useChatStore.getState().addMessage(
      "orchestrator",
      `Iniciando revisão com **${reviewRoles.length} agentes**: Code Reviewer, QA, Security e Designer...`,
    );

    // Roda todos os reviewers em paralelo
    const reviewPromises = reviewRoles.map(async (reviewRole) => {
      const reviewerDefaults = settings.agentDefaults[reviewRole];
      if (!reviewerDefaults || !settings.isProviderConfigured(reviewerDefaults.provider)) {
        console.log(`[OrchestratorService] ${reviewRole} sem provider configurado, pulando`);
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
          reviewer: `Revise o codigo abaixo como Code Reviewer. Verifique:
1. Erros de logica ou bugs obvios
2. Imports incorretos ou faltando
3. Tipos TypeScript incorretos (nunca any)
4. Codigo incompleto (stubs, TODOs)
5. Padroes de codigo inconsistentes
6. Nomes de variaveis/funcoes claros`,
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
          designer: `Como UI/UX Designer, revise o codigo da interface abaixo:
1. Hierarquia visual e layout
2. Consistencia de cores, espacamento e tipografia
3. Responsividade (mobile/desktop)
4. Acessibilidade (a11y: contraste, labels, foco)
5. UX: estados de loading, erro, vazio tratados?
6. Feedback visual para acoes do usuario`,
        };

        const reviewPrompt = reviewPromptMap[reviewRole] ?? reviewPromptMap.reviewer;

        const roleNames: Record<string, string> = {
          reviewer: "Code Reviewer",
          qa: "QA Engineer",
          security: "Security Engineer",
          designer: "UI/UX Designer",
        };

        // Usa executeAgentTask para ter streaming e visibilidade no chat
        const reviewExec: AgentTaskExecution = {
          taskId: crypto.randomUUID(),
          agentId: reviewerAgent.id,
          role: reviewRole,
          description: `${reviewPrompt}

Se estiver OK, responda: APROVADO seguido de um breve resumo do que revisou.
Se tiver problemas, responda: REPROVADO seguido da lista de problemas a corrigir.

--- CODIGO DO PROJETO ---
${codeToReview.substring(0, 6000)}`,
          phase: 4,
        };

        const output = await this.executeAgentTask(reviewExec, settings, projectId);
        const approved = !output.toUpperCase().includes("REPROVADO");

        if (!approved) {
          anyRejected = true;
        }

        console.log(`[OrchestratorService] ${roleNames[reviewRole] ?? reviewRole}: ${approved ? "APROVADO" : "REPROVADO"}`);
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        console.warn(`[OrchestratorService] Review (${reviewRole}) falhou: ${msg}`);
        agentStore.setAgentStatus(reviewerAgent.id, AgentStatus.Blocked);
        agentStore.setAgentTask(reviewerAgent.id, `Erro: ${msg.substring(0, 50)}`);
      }
    });

    await Promise.allSettled(reviewPromises);

    // Checa resultado ANTES de marcar tasks
    if (anyRejected) {
      // Marca tasks da Fase 3 como blocked (precisam ser refeitas)
      for (const exec of allExecutions) {
        if (exec.phase === 3) {
          await updateTaskStatus(exec.taskId, "blocked", { reason: "review_rejected" });
        }
        if (exec.phase === 4) {
          await updateTaskStatus(exec.taskId, "blocked", { reason: "review_rejected_others" });
        }
      }
      return "retry";
    }

    // Sucesso: marca tasks da Fase 4 como done
    for (const exec of allExecutions) {
      if (exec.phase === 4) {
        await updateTaskStatus(exec.taskId, "done", { executedBy: "runCodeReview" });
      }
    }

    // Atualiza progresso após Fase 4
    {
      const { useProjectStore } = await import("../../stores/project-store");
      const activeId = useProjectStore.getState().activeProjectId;
      if (activeId) {
        const realProgress = await syncProjectProgress(activeId);
        useProjectStore.getState()._updateProject(activeId, { progress: realProgress });
      }
    }

    return "approved";
  }

  /**
   * Revisão do Designer após Fase 3 (Development).
   * O Designer analisa o trabalho do Frontend e pode reprovar.
   */
  private async runDesignerReview(
    _allExecutions: AgentTaskExecution[],
    phaseOutputs: PhaseOutputs,
    settings: ReturnType<typeof useSettingsStore.getState>,
    projectId: string,
  ): Promise<"approved" | "needs_changes"> {
    const designerDefaults = settings.agentDefaults.designer;
    if (!designerDefaults || !settings.isProviderConfigured(designerDefaults.provider)) {
      console.log("[OrchestratorService] Designer sem provider configurado, pulando revisão UI");
      return "approved";
    }

    const agentStore = useAgentsStore.getState();
    const designerAgent = agentStore.agents.find((a) => a.role === "designer");
    if (!designerAgent) return "approved";

    // Lê arquivos do projeto para o designer analisar
    const project = await this.getProjectContext();
    let codeToReview = phaseOutputs.changedFilesSummary;
    if ((!codeToReview || codeToReview.length === 0) && project?.localPath) {
      try {
        codeToReview = await getChangedFilesSummary(project.localPath);
        phaseOutputs.changedFilesSummary = codeToReview;
      } catch {
        // sem arquivos para revisar
      }
    }

    if (!codeToReview || codeToReview.length === 0) {
      console.log("[OrchestratorService] Sem arquivos frontend para designer revisar");
      return "approved";
    }

    useChatStore.getState().addMessage(
      "orchestrator",
      "Enviando para o **Designer** revisar a interface antes de avançar...",
    );

    // Walker visual
    eventBus.publish(EventType.AGENT_WALKING, {
      agentId: `walk-designer-${Date.now()}`,
      fromAgentId: "frontend",
      toAgentId: designerAgent.id,
      label: "Review UI/UX",
      waypoints: [],
      timestamp: new Date().toISOString(),
    });

    agentStore.setAgentStatus(designerAgent.id, AgentStatus.Review);
    agentStore.setAgentTask(designerAgent.id, "Capturando screenshot da interface...");

    // Captura screenshot da interface renderizada para análise visual
    let screenshotInstruction = "";
    if (project?.localPath) {
      try {
        const ssRes = await fetch("/api/project/screenshot", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ projectPath: project.localPath }),
        });
        const ssData = await ssRes.json() as { success: boolean; screenshotPath?: string };
        if (ssData.success && ssData.screenshotPath) {
          screenshotInstruction = `\n\n--- SCREENSHOT DA INTERFACE RENDERIZADA ---\nIMPORTANTE: Use a ferramenta Read para visualizar este screenshot: ${ssData.screenshotPath}\nAnalise VISUALMENTE o layout real renderizado no browser: alinhamento, espacamento, cores, hierarquia.\n`;
          console.log(`[OrchestratorService] Screenshot capturado para Designer: ${ssData.screenshotPath}`);
        }
      } catch (err) {
        console.warn("[OrchestratorService] Falha ao capturar screenshot:", err);
      }
    }

    agentStore.setAgentTask(designerAgent.id, "Revisando interface do Frontend...");

    try {
      llmGateway.setAgentConfig(designerAgent.id, designerDefaults.provider, designerDefaults.model);

      const designerExec: AgentTaskExecution = {
        taskId: crypto.randomUUID(),
        agentId: designerAgent.id,
        role: "designer",
        description: `Revise a interface criada pelo Frontend Dev. Analise:
- Layout e hierarquia visual
- Consistência de cores e tipografia
- Responsividade
- Acessibilidade (a11y)
- UX (fluxo do usuário, feedback visual, estados de loading/erro/vazio)

Se tiver problemas, liste as correções necessárias para o Frontend aplicar.
Se estiver tudo OK, responda APROVADO.
${screenshotInstruction}
--- CÓDIGO DA INTERFACE ---
${codeToReview.substring(0, 6000)}`,
        phase: 3,
      };

      const output = await this.executeAgentTask(designerExec, settings, projectId);
      const approved = !output.toUpperCase().includes("REPROVADO") && !output.toUpperCase().includes("CORREÇÕES");

      if (approved) {
        useChatStore.getState().addMessage(designerAgent.id, "Interface APROVADA pelo Designer.");
        agentStore.setAgentStatus(designerAgent.id, AgentStatus.Done);
        agentStore.setAgentTask(designerAgent.id, "UI/UX Aprovada");
        return "approved";
      }

      // Designer reprovou — manda frontend corrigir
      useChatStore.getState().addMessage(
        "orchestrator",
        "Designer solicitou correções no Frontend. Enviando feedback...",
      );

      const frontendAgent = agentStore.agents.find((a) => a.role === "frontend");
      if (frontendAgent) {
        const fixExec: AgentTaskExecution = {
          taskId: crypto.randomUUID(),
          agentId: frontendAgent.id,
          role: "frontend",
          description: `O Designer revisou sua interface e pediu as seguintes correções. Aplique TODAS:\n\n${output}`,
          phase: 3,
        };
        await this.executeAgentTask(fixExec, settings, projectId);
      }

      agentStore.setAgentStatus(designerAgent.id, AgentStatus.Done);
      agentStore.setAgentTask(designerAgent.id, "Correções aplicadas");
      return "needs_changes";

    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      console.warn(`[OrchestratorService] Designer review falhou: ${msg}`);
      agentStore.setAgentStatus(designerAgent.id, AgentStatus.Blocked);
      agentStore.setAgentTask(designerAgent.id, `Erro: ${msg.substring(0, 50)}`);
      return "approved"; // Não bloqueia o fluxo se designer falhar
    }
  }

  /**
   * Constroi system prompt especifico para cada role de agente.
   */
  private async buildAgentSystemPrompt(role: AgentRole, projectId?: string): Promise<string> {
    const project = await this.getProjectContext();
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
- **PRIMEIRO: liste os arquivos que ja existem na pasta do projeto** antes de criar qualquer coisa. Use Read/Glob/ls.
- **NAO recrie** arquivos que ja existem e estao corretos. Apenas crie o que falta ou corrija o que tem erro.
- Se o projeto ja tem package.json, tsconfig, etc., NAO sobrescreva — apenas adicione o que falta.
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
   * Executa Fase 5 (DELIVERY) com o agente DevOps quando não há task explícita.
   * Cria automaticamente Dockerfile, docker-compose e CI/CD pipeline.
   */
  private async runDevOpsDelivery(
    phaseOutputs: PhaseOutputs,
    settings: ReturnType<typeof useSettingsStore.getState>,
    projectId: string,
  ): Promise<void> {
    const devopsDefaults = settings.agentDefaults.devops;
    if (!devopsDefaults || !settings.isProviderConfigured(devopsDefaults.provider)) {
      console.log("[OrchestratorService] DevOps sem provider configurado, pulando delivery");
      return;
    }

    const agentStore = useAgentsStore.getState();
    const devopsAgent = agentStore.agents.find((a) => a.role === "devops");
    if (!devopsAgent) return;

    const project = await this.getProjectContext();

    // Lê arquivos do projeto para contexto
    let projectFiles = phaseOutputs.changedFilesSummary;
    if ((!projectFiles || projectFiles.length === 0) && project?.localPath) {
      try {
        projectFiles = await getChangedFilesSummary(project.localPath);
      } catch {
        // sem arquivos
      }
    }

    useChatStore.getState().addMessage(
      "orchestrator",
      "Enviando para o **DevOps** criar configurações de build e deploy...",
    );

    // Walker visual
    eventBus.publish(EventType.AGENT_WALKING, {
      agentId: `walk-devops-${Date.now()}`,
      fromAgentId: "orchestrator",
      toAgentId: devopsAgent.id,
      label: "Build & Deploy",
      waypoints: [],
      timestamp: new Date().toISOString(),
    });

    const devopsExec: AgentTaskExecution = {
      taskId: crypto.randomUUID(),
      agentId: devopsAgent.id,
      role: "devops",
      description: `Crie as configurações de build e deploy para o projeto:
1. Dockerfile multi-stage (build + runtime)
2. docker-compose.yml para desenvolvimento local
3. CI/CD pipeline (GitHub Actions) com lint, test e build
4. Scripts utilitários (start, build, deploy) se necessário

${project?.name ? `Projeto: ${project.name}` : ""}
${phaseOutputs.architecture ? `\n## Arquitetura\n${phaseOutputs.architecture.substring(0, 3000)}` : ""}
${projectFiles ? `\n## Arquivos do projeto\n${projectFiles.substring(0, 4000)}` : ""}`,
      phase: 5,
    };

    try {
      await this.executeAgentTask(devopsExec, settings, projectId);
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      console.warn(`[OrchestratorService] DevOps delivery falhou: ${msg}`);
      agentStore.setAgentStatus(devopsAgent.id, AgentStatus.Blocked);
      agentStore.setAgentTask(devopsAgent.id, `Erro: ${msg.substring(0, 50)}`);
    }
  }

  /**
   * Obtem contexto do projeto ativo a partir do store.
   */
  private async getProjectContext(): Promise<{ name: string; description: string; localPath: string | null } | null> {
    try {
      const { useProjectStore } = await import("../../stores/project-store");
      const project = useProjectStore.getState().getProject();
      if (!project) return null;
      return { name: project.name, description: project.description, localPath: project.localPath };
    } catch {
      return null;
    }
  }

  /**
   * Decomposição determinística baseada em regras (sem LLM).
   * Analisa keywords na mensagem do usuário e gera plano apropriado.
   * 100% confiável — não depende do CLI ou API.
   */
  private decomposeByRules(message: string): DecomposedTask[] {
    const lower = message.toLowerCase();
    const tasks: DecomposedTask[] = [];

    const makeTask = (
      title: string,
      description: string,
      role: AgentRole,
      phase: 1 | 2 | 3 | 4 | 5,
      deps: string[],
    ): DecomposedTask => {
      const id = crypto.randomUUID();
      return {
        id,
        description: `[Fase ${phase} - ${PHASE_NAMES[phase]}] [${title}] ${description}`,
        targetRole: role,
        priority: phase <= 2 ? "critical" : "high",
        dependencies: deps,
        estimatedMinutes: 15,
        phase,
        metadata: {
          title,
          phase: String(phase),
          phaseName: PHASE_NAMES[phase] ?? `PHASE_${phase}`,
          originalDependencies: "",
        },
      };
    };

    // Detecta tipo de pedido
    const isImprovement = /melhor|ajust|revis|corrig|atualiz|refator|otimiz|redesign|modific|alter/i.test(lower);
    const isNewProject = /cri[ea]|novo|nova|desenvolv|faz|construi|implement|mont/i.test(lower) && !isImprovement;

    // Detecta áreas mencionadas
    const mentionsUI = /ui|ux|interface|visual|layout|card|menu|header|footer|hero|botao|botão|estilo|cor|fonte|tela|pagina|página|design|responsiv|mobile|acessibilid/i.test(lower);
    const mentionsBackend = /backend|api|servidor|endpoint|servico|serviço|autenticac|banco|database|schema|migration/i.test(lower);
    const mentionsFrontend = /frontend|componente|react|hook|estado|state|formulari|lista|tabela|grid|modal/i.test(lower);

    if (isImprovement) {
      // ── MELHORIA ──────────────────────────────────────────────────────
      if (mentionsUI || (!mentionsBackend && !mentionsFrontend)) {
        // Melhoria de UI/UX (ou pedido genérico sem área específica)
        const designTask = makeTask(
          "Revisar UI/UX e propor melhorias",
          `Analise a interface atual do projeto e proponha melhorias visuais baseadas no pedido do usuario: "${message}". Foque em: hierarquia visual, espacamento, tipografia, cores, hover effects, sombras, responsividade e acessibilidade. Liste as mudancas especificas que o Frontend deve implementar.`,
          "designer",
          3,
          [],
        );
        tasks.push(designTask);

        tasks.push(makeTask(
          "Implementar melhorias visuais",
          `Implemente as melhorias de UI/UX no projeto conforme o pedido: "${message}". Atualize os componentes existentes com: design mais moderno, hover effects, sombras, espacamento consistente, tipografia melhorada, responsividade. NAO crie novos componentes se os existentes podem ser melhorados.`,
          "frontend",
          3,
          [designTask.id],
        ));
      }

      if (mentionsBackend) {
        tasks.push(makeTask(
          "Melhorar backend/API",
          `Melhore o backend conforme pedido: "${message}". Otimize endpoints, corrija bugs, melhore tratamento de erros.`,
          "backend",
          3,
          [],
        ));
      }

      if (mentionsFrontend && !mentionsUI) {
        tasks.push(makeTask(
          "Melhorar componentes frontend",
          `Melhore os componentes React conforme pedido: "${message}". Corrija bugs, otimize performance, melhore UX.`,
          "frontend",
          3,
          [],
        ));
      }
    } else if (isNewProject) {
      // ── NOVO PROJETO ──────────────────────────────────────────────────
      const pmTask = makeTask(
        "Criar PRD do projeto",
        `Analise o pedido do usuario e crie um PRD completo: "${message}". Inclua requisitos funcionais, nao-funcionais, user stories e criterios de aceitacao.`,
        "pm",
        1,
        [],
      );
      tasks.push(pmTask);

      const archTask = makeTask(
        "Definir arquitetura e setup",
        `Crie a estrutura do projeto: package.json, tsconfig.json, vite.config.ts, tailwind.config.ts, index.html, estrutura de pastas (src/components, src/pages, src/types, src/data). Defina tipos TypeScript e convencoes.`,
        "architect",
        2,
        [pmTask.id],
      );
      tasks.push(archTask);

      tasks.push(makeTask(
        "Implementar interface frontend",
        `Crie todos os componentes React com TypeScript e Tailwind CSS conforme a arquitetura definida. Pedido do usuario: "${message}". Codigo completo e funcional.`,
        "frontend",
        3,
        [archTask.id],
      ));

      if (mentionsBackend) {
        tasks.push(makeTask(
          "Implementar backend/API",
          `Crie os servicos e endpoints conforme a arquitetura. Pedido: "${message}".`,
          "backend",
          3,
          [archTask.id],
        ));
      }
    } else {
      // ── PEDIDO GENÉRICO ────────────────────────────────────────────────
      // Interpreta como melhoria de frontend por padrão
      tasks.push(makeTask(
        "Executar pedido do usuario",
        `Execute o seguinte pedido no projeto: "${message}". Analise o codigo existente e faca as alteracoes necessarias.`,
        "frontend",
        3,
        [],
      ));
    }

    console.log(`[OrchestratorService] Regras geraram ${tasks.length} tarefas: ${tasks.map((t) => t.targetRole).join(", ")}`);
    return tasks;
  }
}

/** Instancia singleton do OrchestratorService */
export const orchestratorService = new OrchestratorServiceImpl();
