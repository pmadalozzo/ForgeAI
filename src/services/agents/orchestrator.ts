/**
 * Orchestrator — Coordenador central de tarefas e agentes.
 * Roteia tarefas para agentes especializados, gerencia progresso
 * do sprint/projeto e controla modos de supervisão.
 */

import type { Agent, AgentRole, SupervisionMode, Project, Position } from "../../types/agents";
import { EventType, eventBus } from "../events/event-bus";
import { agentRuntime } from "./agent-runtime";
import type { AgentTask } from "./agent-runtime";

/** Tarefa decomposta pelo orquestrador para distribuição */
export interface DecomposedTask {
  /** ID único */
  id: string;
  /** Descrição da tarefa */
  description: string;
  /** Papel do agente mais adequado */
  targetRole: AgentRole;
  /** Prioridade */
  priority: "low" | "medium" | "high" | "critical";
  /** IDs de tarefas que precisam ser concluídas antes */
  dependencies: string[];
  /** Estimativa de duração em minutos */
  estimatedMinutes: number;
  /** Fase do pipeline (0=Research, 1=Planning, 2=Architecture, 3=Development, 4=Quality, 5=Delivery) */
  phase: 0 | 1 | 2 | 3 | 4 | 5;
  /** Metadados extras */
  metadata: Record<string, string>;
}

/** Interface para decomposição de tarefas (a ser implementada com LLM) */
export interface TaskDecomposer {
  /**
   * Recebe uma descrição de alto nível e retorna tarefas decompostas.
   */
  decompose(description: string, availableRoles: AgentRole[]): Promise<DecomposedTask[]>;
}

/** Rastreamento de custo por agente/provider */
export interface CostEntry {
  /** ID do agente */
  agentId: string;
  /** Provider utilizado */
  provider: string;
  /** Modelo utilizado */
  model: string;
  /** Tokens de entrada */
  inputTokens: number;
  /** Tokens de saída */
  outputTokens: number;
  /** Custo estimado em USD */
  costUsd: number;
  /** Timestamp */
  timestamp: string;
}

/** Estado de progresso do projeto gerenciado pelo orquestrador */
export interface ProjectProgress {
  /** ID do projeto */
  projectId: string;
  /** Fase atual */
  phase: "planning" | "development" | "testing" | "review" | "deployment";
  /** Total de tarefas planejadas */
  totalTasks: number;
  /** Tarefas concluídas */
  completedTasks: number;
  /** Tarefas em andamento */
  inProgressTasks: number;
  /** Tarefas bloqueadas */
  blockedTasks: number;
  /** Porcentagem geral */
  percentage: number;
}

/**
 * Serviço Orquestrador — Cérebro da fábrica de software.
 * Coordena distribuição de tarefas, progresso e supervisão.
 */
export class Orchestrator {
  /** Modo de supervisão ativo */
  private supervisionMode: SupervisionMode = "autopilot" as SupervisionMode;

  /** Tarefas pendentes de aprovação do usuário (modo Approve) */
  private pendingApprovals: Map<string, AgentTask> = new Map();

  /** Mapa de tarefas decompostas aguardando dependências */
  private waitingTasks: Map<string, DecomposedTask> = new Map();

  /** Tarefas concluídas (para rastrear dependências) */
  private completedTaskIds: Set<string> = new Set();

  /** Histórico de custos por agente */
  private costHistory: CostEntry[] = [];

  /** Progresso atual do projeto */
  private progress: ProjectProgress = {
    projectId: "",
    phase: "planning",
    totalTasks: 0,
    completedTasks: 0,
    inProgressTasks: 0,
    blockedTasks: 0,
    percentage: 0,
  };

  /** Decompositor de tarefas (injetável) */
  private decomposer: TaskDecomposer | null = null;

  constructor() {
    // Escuta conclusões de tarefas para atualizar progresso e destravar dependências
    eventBus.subscribe(EventType.TASK_COMPLETED, (payload) => {
      this.completedTaskIds.add(payload.taskId);
      this.progress.completedTasks++;
      this.progress.inProgressTasks = Math.max(0, this.progress.inProgressTasks - 1);
      this.updatePercentage();
      this.publishProgress();
      this.checkWaitingTasks();
    });
  }

  /**
   * Define o decompositor de tarefas (implementação com LLM).
   */
  setDecomposer(decomposer: TaskDecomposer): void {
    this.decomposer = decomposer;
  }

  /**
   * Define o modo de supervisão ativo.
   */
  setSupervisionMode(mode: SupervisionMode): void {
    this.supervisionMode = mode;
  }

  /**
   * Retorna o modo de supervisão atual.
   */
  getSupervisionMode(): SupervisionMode {
    return this.supervisionMode;
  }

  /**
   * Inicia um novo projeto, configurando o progresso e alocando agentes.
   */
  initProject(project: Project): void {
    this.progress = {
      projectId: project.id,
      phase: "planning",
      totalTasks: 0,
      completedTasks: 0,
      inProgressTasks: 0,
      blockedTasks: 0,
      percentage: 0,
    };
    this.completedTaskIds.clear();
    this.waitingTasks.clear();
    this.pendingApprovals.clear();
  }

  /**
   * Recebe uma descrição de alto nível e orquestra a decomposição + distribuição.
   */
  async orchestrate(description: string): Promise<DecomposedTask[]> {
    if (!this.decomposer) {
      throw new Error("[Orchestrator] Decompositor de tarefas não configurado.");
    }

    const availableRoles = agentRuntime.getAllAgents().map((a) => a.role);
    const tasks = await this.decomposer.decompose(description, availableRoles);

    this.progress.totalTasks += tasks.length;
    this.updatePercentage();
    this.publishProgress();

    // Distribui tarefas respeitando dependências
    for (const task of tasks) {
      if (task.dependencies.length === 0 || task.dependencies.every((d) => this.completedTaskIds.has(d))) {
        this.routeTaskToAgent(task);
      } else {
        this.waitingTasks.set(task.id, task);
      }
    }

    return tasks;
  }

  /**
   * Roteia uma tarefa decomposta para o agente mais adequado.
   */
  routeTaskToAgent(task: DecomposedTask): void {
    const agents = agentRuntime.getAllAgents();
    const candidate = this.selectBestAgent(agents, task.targetRole);

    if (!candidate) {
      console.warn(`[Orchestrator] Nenhum agente disponível para role ${task.targetRole}.`);
      this.progress.blockedTasks++;
      this.publishProgress();
      return;
    }

    const agentTask = agentRuntime.assignTask(candidate.id, {
      id: task.id,
      description: task.description,
      priority: task.priority,
      createdAt: new Date().toISOString(),
      metadata: task.metadata,
    });

    this.progress.inProgressTasks++;
    this.publishProgress();

    // Se modo Approve, coloca na fila de aprovação
    if (this.supervisionMode === ("approve" as SupervisionMode)) {
      this.pendingApprovals.set(agentTask.id, agentTask);
    }

    // Emite evento de walking se o orquestrador está enviando tarefa
    this.emitWalkingEvent(candidate.id, task);
  }

  /**
   * Aprova uma tarefa pendente (modo Approve).
   */
  approveTask(taskId: string): boolean {
    const task = this.pendingApprovals.get(taskId);
    if (!task) return false;
    this.pendingApprovals.delete(taskId);
    return true;
  }

  /**
   * Rejeita uma tarefa pendente (modo Approve), cancelando-a.
   */
  rejectTask(taskId: string): boolean {
    const task = this.pendingApprovals.get(taskId);
    if (!task) return false;
    task.status = "cancelled";
    this.pendingApprovals.delete(taskId);
    return true;
  }

  /**
   * Registra uma entrada de custo (uso de LLM).
   */
  trackCost(entry: CostEntry): void {
    this.costHistory.push(entry);
  }

  /**
   * Retorna o custo total acumulado.
   */
  getTotalCost(): number {
    return this.costHistory.reduce((sum, e) => sum + e.costUsd, 0);
  }

  /**
   * Retorna o custo agrupado por agente.
   */
  getCostByAgent(): Record<string, number> {
    const result: Record<string, number> = {};
    for (const entry of this.costHistory) {
      result[entry.agentId] = (result[entry.agentId] ?? 0) + entry.costUsd;
    }
    return result;
  }

  /**
   * Retorna o custo agrupado por provider.
   */
  getCostByProvider(): Record<string, number> {
    const result: Record<string, number> = {};
    for (const entry of this.costHistory) {
      result[entry.provider] = (result[entry.provider] ?? 0) + entry.costUsd;
    }
    return result;
  }

  /**
   * Retorna o progresso atual do projeto.
   */
  getProgress(): ProjectProgress {
    return { ...this.progress };
  }

  /**
   * Retorna tarefas pendentes de aprovação.
   */
  getPendingApprovals(): AgentTask[] {
    return Array.from(this.pendingApprovals.values());
  }

  /**
   * Limpa o estado do orquestrador. Útil para testes.
   */
  clear(): void {
    this.pendingApprovals.clear();
    this.waitingTasks.clear();
    this.completedTaskIds.clear();
    this.costHistory = [];
    this.progress = {
      projectId: "",
      phase: "planning",
      totalTasks: 0,
      completedTasks: 0,
      inProgressTasks: 0,
      blockedTasks: 0,
      percentage: 0,
    };
  }

  /**
   * Seleciona o melhor agente disponível para uma role.
   * Prioriza agentes ociosos sobre os que já estão trabalhando.
   */
  private selectBestAgent(agents: Agent[], targetRole: AgentRole): Agent | null {
    const candidates = agents.filter((a) => a.role === targetRole);
    if (candidates.length === 0) return null;

    // Prioriza idle, depois done, depois working
    const statusPriority: Record<string, number> = {
      idle: 0,
      done: 1,
      working: 2,
      review: 3,
      blocked: 4,
    };

    candidates.sort(
      (a, b) => (statusPriority[a.status] ?? 99) - (statusPriority[b.status] ?? 99)
    );

    return candidates[0] ?? null;
  }

  /**
   * Verifica tarefas em espera e distribui as que tiveram dependências satisfeitas.
   */
  private checkWaitingTasks(): void {
    const readyIds: string[] = [];

    for (const [id, task] of this.waitingTasks) {
      if (task.dependencies.every((d) => this.completedTaskIds.has(d))) {
        readyIds.push(id);
      }
    }

    for (const id of readyIds) {
      const task = this.waitingTasks.get(id);
      if (task) {
        this.waitingTasks.delete(id);
        this.routeTaskToAgent(task);
      }
    }
  }

  /**
   * Emite evento visual de agente caminhando (orquestrador → agente destino).
   */
  private emitWalkingEvent(targetAgentId: string, task: DecomposedTask): void {
    eventBus.publish(EventType.AGENT_WALKING, {
      agentId: "orchestrator",
      fromAgentId: "orchestrator",
      toAgentId: targetAgentId,
      label: task.description.substring(0, 40),
      waypoints: [] as Position[],
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Atualiza a porcentagem de progresso.
   */
  private updatePercentage(): void {
    if (this.progress.totalTasks === 0) {
      this.progress.percentage = 0;
    } else {
      this.progress.percentage = Math.round(
        (this.progress.completedTasks / this.progress.totalTasks) * 100
      );
    }
  }

  /**
   * Publica o progresso atual via Event Bus.
   */
  private publishProgress(): void {
    eventBus.publish(EventType.PROJECT_PROGRESS, {
      projectId: this.progress.projectId,
      phase: this.progress.phase,
      completedTasks: this.progress.completedTasks,
      totalTasks: this.progress.totalTasks,
      percentage: this.progress.percentage,
      timestamp: new Date().toISOString(),
    });
  }
}

/** Instância singleton do Orquestrador */
export const orchestrator = new Orchestrator();
