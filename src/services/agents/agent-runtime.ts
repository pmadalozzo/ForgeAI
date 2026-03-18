/**
 * Agent Runtime — Gerenciador de ciclo de vida dos agentes.
 * Controla inicialização, pausa, retomada e atribuição de tarefas.
 * Notifica mudanças de estado via Event Bus.
 */

import { AgentStatus } from "../../types/agents";
import type { Agent } from "../../types/agents";
import { EventType, eventBus } from "../events/event-bus";
import type { QualityGatePipeline } from "./quality-gates";

/** Tarefa atribuída a um agente */
export interface AgentTask {
  /** ID único da tarefa */
  id: string;
  /** Descrição da tarefa */
  description: string;
  /** Prioridade */
  priority: "low" | "medium" | "high" | "critical";
  /** ID do agente atribuído */
  assignedTo: string;
  /** Status da tarefa */
  status: "queued" | "running" | "completed" | "failed" | "cancelled";
  /** Timestamp de criação */
  createdAt: string;
  /** Timestamp de início de execução */
  startedAt: string | null;
  /** Timestamp de conclusão */
  completedAt: string | null;
  /** Resultado final */
  result: string | null;
  /** Metadados adicionais */
  metadata: Record<string, string>;
}

/** Transições de status válidas para um agente */
const VALID_TRANSITIONS: Record<AgentStatus, AgentStatus[]> = {
  [AgentStatus.Idle]: [AgentStatus.Working, AgentStatus.Blocked],
  [AgentStatus.Working]: [AgentStatus.Idle, AgentStatus.Review, AgentStatus.Blocked, AgentStatus.Done],
  [AgentStatus.Review]: [AgentStatus.Working, AgentStatus.Done, AgentStatus.Blocked, AgentStatus.Idle],
  [AgentStatus.Blocked]: [AgentStatus.Idle, AgentStatus.Working],
  [AgentStatus.Done]: [AgentStatus.Idle, AgentStatus.Working],
};

/** Estado interno de runtime de um agente */
interface AgentRuntimeState {
  /** Referência ao agente */
  agent: Agent;
  /** Fila de tarefas pendentes */
  taskQueue: AgentTask[];
  /** Tarefa em execução */
  currentTask: AgentTask | null;
  /** Se o agente está pausado */
  paused: boolean;
  /** Total de tarefas concluídas nesta sessão */
  completedTaskCount: number;
  /** Tempo total de execução em ms */
  totalExecutionTimeMs: number;
}

/**
 * Gerenciador de runtime dos agentes.
 * Mantém o estado de cada agente e coordena transições de status.
 */
export class AgentRuntime {
  /** Mapa de estados de runtime por ID do agente */
  private agents: Map<string, AgentRuntimeState> = new Map();

  /** Referência opcional ao pipeline de quality gates */
  private qualityGatePipeline: QualityGatePipeline | null = null;

  /**
   * Configura o pipeline de quality gates a ser usado nas verificações.
   */
  setQualityGatePipeline(pipeline: QualityGatePipeline): void {
    this.qualityGatePipeline = pipeline;
  }

  /**
   * Inicia um agente no runtime, registrando seu estado inicial.
   * O agente começa em status Idle.
   */
  startAgent(agent: Agent): void {
    if (this.agents.has(agent.id)) {
      console.warn(`[AgentRuntime] Agente ${agent.id} já está registrado.`);
      return;
    }

    const state: AgentRuntimeState = {
      agent: { ...agent, status: AgentStatus.Idle },
      taskQueue: [],
      currentTask: null,
      paused: false,
      completedTaskCount: 0,
      totalExecutionTimeMs: 0,
    };

    this.agents.set(agent.id, state);

    eventBus.publish(EventType.AGENT_STATUS_CHANGE, {
      agentId: agent.id,
      previousStatus: agent.status,
      newStatus: AgentStatus.Idle,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Remove um agente do runtime, cancelando tarefas pendentes.
   */
  stopAgent(agentId: string): void {
    const state = this.agents.get(agentId);
    if (!state) {
      console.warn(`[AgentRuntime] Agente ${agentId} não encontrado.`);
      return;
    }

    // Cancela tarefa em execução
    if (state.currentTask) {
      state.currentTask.status = "cancelled";
      state.currentTask = null;
    }

    // Cancela tarefas na fila
    for (const task of state.taskQueue) {
      task.status = "cancelled";
    }

    const previousStatus = state.agent.status;
    this.agents.delete(agentId);

    eventBus.publish(EventType.AGENT_STATUS_CHANGE, {
      agentId,
      previousStatus,
      newStatus: AgentStatus.Idle,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Pausa um agente — ele mantém a tarefa atual mas não processa novas.
   */
  pauseAgent(agentId: string): void {
    const state = this.agents.get(agentId);
    if (!state) {
      console.warn(`[AgentRuntime] Agente ${agentId} não encontrado.`);
      return;
    }

    state.paused = true;
    const previousStatus = state.agent.status;
    this.transitionStatus(agentId, AgentStatus.Idle);

    eventBus.publish(EventType.AGENT_STATUS_CHANGE, {
      agentId,
      previousStatus,
      newStatus: AgentStatus.Idle,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Retoma um agente pausado. Se houver tarefa na fila, começa a processar.
   */
  resumeAgent(agentId: string): void {
    const state = this.agents.get(agentId);
    if (!state) {
      console.warn(`[AgentRuntime] Agente ${agentId} não encontrado.`);
      return;
    }

    state.paused = false;

    // Se há tarefas na fila, inicia a próxima
    if (state.taskQueue.length > 0 && !state.currentTask) {
      this.processNextTask(agentId);
    }
  }

  /**
   * Atribui uma tarefa a um agente. Se o agente não está ocupado, executa imediatamente.
   * Caso contrário, enfileira.
   */
  assignTask(agentId: string, task: Omit<AgentTask, "assignedTo" | "status" | "startedAt" | "completedAt" | "result">): AgentTask {
    const state = this.agents.get(agentId);
    if (!state) {
      throw new Error(`[AgentRuntime] Agente ${agentId} não encontrado para atribuição de tarefa.`);
    }

    const fullTask: AgentTask = {
      ...task,
      assignedTo: agentId,
      status: "queued",
      startedAt: null,
      completedAt: null,
      result: null,
    };

    // Publica evento de tarefa atribuída
    eventBus.publish(EventType.TASK_ASSIGNED, {
      taskId: fullTask.id,
      agentId,
      agentRole: state.agent.role,
      description: fullTask.description,
      priority: fullTask.priority,
      timestamp: new Date().toISOString(),
    });

    // Se o agente está livre e não pausado, executa imediatamente
    if (!state.currentTask && !state.paused) {
      state.currentTask = fullTask;
      fullTask.status = "running";
      fullTask.startedAt = new Date().toISOString();
      this.transitionStatus(agentId, AgentStatus.Working);
      state.agent.currentTask = fullTask.description;
    } else {
      state.taskQueue.push(fullTask);
    }

    return fullTask;
  }

  /**
   * Marca a tarefa atual de um agente como concluída e processa a próxima da fila.
   */
  completeCurrentTask(agentId: string, result: "success" | "failure" | "partial", summary: string): void {
    const state = this.agents.get(agentId);
    if (!state || !state.currentTask) {
      console.warn(`[AgentRuntime] Sem tarefa ativa para agente ${agentId}.`);
      return;
    }

    const task = state.currentTask;
    task.status = "completed";
    task.completedAt = new Date().toISOString();
    task.result = summary;

    const durationMs = task.startedAt
      ? new Date(task.completedAt).getTime() - new Date(task.startedAt).getTime()
      : 0;

    state.completedTaskCount++;
    state.totalExecutionTimeMs += durationMs;
    state.currentTask = null;
    state.agent.currentTask = null;

    // Publica conclusão
    eventBus.publish(EventType.TASK_COMPLETED, {
      taskId: task.id,
      agentId,
      agentRole: state.agent.role,
      result,
      summary,
      linesWritten: state.agent.linesWritten,
      durationMs,
      timestamp: new Date().toISOString(),
    });

    // Transição para Done antes de processar próxima tarefa
    this.transitionStatus(agentId, AgentStatus.Done);

    // Processa próxima tarefa se não pausado
    if (!state.paused && state.taskQueue.length > 0) {
      this.processNextTask(agentId);
    } else {
      this.transitionStatus(agentId, AgentStatus.Idle);
    }
  }

  /**
   * Retorna o status atual de um agente.
   */
  getAgentStatus(agentId: string): AgentStatus | null {
    const state = this.agents.get(agentId);
    return state ? state.agent.status : null;
  }

  /**
   * Retorna o estado completo do agente (cópia).
   */
  getAgentState(agentId: string): AgentRuntimeState | null {
    const state = this.agents.get(agentId);
    if (!state) return null;
    return { ...state, agent: { ...state.agent }, taskQueue: [...state.taskQueue] };
  }

  /**
   * Retorna todos os agentes registrados no runtime.
   */
  getAllAgents(): Agent[] {
    return Array.from(this.agents.values()).map((s) => ({ ...s.agent }));
  }

  /**
   * Retorna os IDs de todos os agentes registrados.
   */
  getRegisteredAgentIds(): string[] {
    return Array.from(this.agents.keys());
  }

  /**
   * Executa quality gates para um agente/tarefa, se pipeline configurado.
   */
  async runQualityGates(agentId: string, taskId: string): Promise<boolean> {
    if (!this.qualityGatePipeline) {
      console.warn("[AgentRuntime] Pipeline de quality gates não configurado.");
      return true;
    }

    this.transitionStatus(agentId, AgentStatus.Review);

    const results = await this.qualityGatePipeline.run(agentId, taskId);
    const allPassed = results.every((r) => r.passed);

    if (!allPassed) {
      this.transitionStatus(agentId, AgentStatus.Blocked);
    }

    return allPassed;
  }

  /**
   * Limpa o runtime, removendo todos os agentes. Útil para testes.
   */
  clear(): void {
    this.agents.clear();
  }

  /**
   * Processa a próxima tarefa da fila de um agente.
   */
  private processNextTask(agentId: string): void {
    const state = this.agents.get(agentId);
    if (!state || state.taskQueue.length === 0) return;

    // Ordena por prioridade (critical > high > medium > low)
    const priorityOrder: Record<string, number> = {
      critical: 0,
      high: 1,
      medium: 2,
      low: 3,
    };

    state.taskQueue.sort(
      (a, b) => (priorityOrder[a.priority] ?? 3) - (priorityOrder[b.priority] ?? 3)
    );

    const nextTask = state.taskQueue.shift();
    if (!nextTask) return;

    state.currentTask = nextTask;
    nextTask.status = "running";
    nextTask.startedAt = new Date().toISOString();
    state.agent.currentTask = nextTask.description;
    this.transitionStatus(agentId, AgentStatus.Working);
  }

  /**
   * Realiza a transição de status de um agente, validando o caminho.
   */
  private transitionStatus(agentId: string, newStatus: AgentStatus): void {
    const state = this.agents.get(agentId);
    if (!state) return;

    const current = state.agent.status;
    const allowed = VALID_TRANSITIONS[current];

    if (!allowed.includes(newStatus)) {
      console.warn(
        `[AgentRuntime] Transição inválida: ${current} → ${newStatus} para agente ${agentId}`
      );
      return;
    }

    const previousStatus = state.agent.status;
    state.agent.status = newStatus;

    eventBus.publish(EventType.AGENT_STATUS_CHANGE, {
      agentId,
      previousStatus,
      newStatus,
      timestamp: new Date().toISOString(),
    });
  }
}

/** Instância singleton do Agent Runtime */
export const agentRuntime = new AgentRuntime();
