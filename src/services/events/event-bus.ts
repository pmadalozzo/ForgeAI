/**
 * Event Bus — Abstração de barramento de eventos do ForgeAI.
 * Implementação local em memória com pub/sub tipado.
 * Futuramente será substituído por BullMQ + Redis.
 */

import type { AgentStatus, AgentRole, ChatMessage, Position } from "../../types/agents";

/** Tipos de evento suportados pelo barramento */
export enum EventType {
  /** Mudança de status visual de um agente */
  AGENT_STATUS_CHANGE = "agent:status-change",
  /** Tarefa atribuída a um agente */
  TASK_ASSIGNED = "agent:task-assigned",
  /** Tarefa concluída por um agente */
  TASK_COMPLETED = "agent:task-completed",
  /** Mensagem no chat do projeto */
  CHAT_MESSAGE = "chat:message",
  /** Resultado de um quality gate */
  QUALITY_GATE_RESULT = "quality-gate:result",
  /** Atualização de progresso do projeto */
  PROJECT_PROGRESS = "project:progress",
  /** Agente caminhando entre mesas */
  AGENT_WALKING = "agent:walking",
  /** Erro genérico do sistema */
  ERROR = "system:error",
}

/** Payload para AGENT_STATUS_CHANGE */
export interface AgentStatusChangePayload {
  agentId: string;
  previousStatus: AgentStatus;
  newStatus: AgentStatus;
  timestamp: string;
}

/** Payload para TASK_ASSIGNED */
export interface TaskAssignedPayload {
  taskId: string;
  agentId: string;
  agentRole: AgentRole;
  description: string;
  priority: "low" | "medium" | "high" | "critical";
  timestamp: string;
}

/** Payload para TASK_COMPLETED */
export interface TaskCompletedPayload {
  taskId: string;
  agentId: string;
  agentRole: AgentRole;
  result: "success" | "failure" | "partial";
  summary: string;
  linesWritten: number;
  durationMs: number;
  timestamp: string;
}

/** Payload para CHAT_MESSAGE */
export interface ChatMessagePayload {
  message: ChatMessage;
}

/** Resultado individual de um quality gate */
export interface QualityGateResultPayload {
  taskId: string;
  agentId: string;
  gateName: string;
  passed: boolean;
  output: string;
  durationMs: number;
  timestamp: string;
}

/** Payload para PROJECT_PROGRESS */
export interface ProjectProgressPayload {
  projectId: string;
  phase: string;
  completedTasks: number;
  totalTasks: number;
  percentage: number;
  timestamp: string;
}

/** Payload para AGENT_WALKING */
export interface AgentWalkingPayload {
  agentId: string;
  fromAgentId: string;
  toAgentId: string;
  label: string;
  waypoints: Position[];
  timestamp: string;
}

/** Payload para ERROR */
export interface ErrorPayload {
  source: string;
  message: string;
  details: string | null;
  timestamp: string;
}

/** Mapeamento de tipo de evento para seu payload */
export interface EventPayloadMap {
  [EventType.AGENT_STATUS_CHANGE]: AgentStatusChangePayload;
  [EventType.TASK_ASSIGNED]: TaskAssignedPayload;
  [EventType.TASK_COMPLETED]: TaskCompletedPayload;
  [EventType.CHAT_MESSAGE]: ChatMessagePayload;
  [EventType.QUALITY_GATE_RESULT]: QualityGateResultPayload;
  [EventType.PROJECT_PROGRESS]: ProjectProgressPayload;
  [EventType.AGENT_WALKING]: AgentWalkingPayload;
  [EventType.ERROR]: ErrorPayload;
}

/** Assinatura de um handler de evento tipado */
type EventHandler<T extends EventType> = (payload: EventPayloadMap[T]) => void;

/** Estrutura interna de uma assinatura */
interface Subscription {
  id: string;
  type: EventType;
  handler: EventHandler<EventType>;
}

/**
 * Barramento de eventos local em memória.
 * Gerencia publicação e assinatura de eventos tipados.
 * Thread-safe para contexto single-thread do JS.
 */
export class EventBus {
  /** Mapa de assinantes por tipo de evento */
  private subscriptions: Map<EventType, Subscription[]> = new Map();

  /** Contador para gerar IDs únicos de assinatura */
  private nextId = 0;

  /** Histórico de eventos recentes (buffer circular) */
  private history: Array<{ type: EventType; payload: EventPayloadMap[EventType]; timestamp: string }> = [];

  /** Tamanho máximo do histórico */
  private readonly maxHistorySize = 500;

  /**
   * Publica um evento no barramento.
   * Todos os handlers inscritos naquele tipo são notificados de forma síncrona.
   */
  publish<T extends EventType>(type: T, payload: EventPayloadMap[T]): void {
    // Adiciona ao histórico
    this.history.push({ type, payload, timestamp: new Date().toISOString() });
    if (this.history.length > this.maxHistorySize) {
      this.history.shift();
    }

    const handlers = this.subscriptions.get(type);
    if (!handlers || handlers.length === 0) return;

    // Notifica todos os assinantes (cópia para evitar mutação durante iteração)
    for (const sub of [...handlers]) {
      try {
        (sub.handler as EventHandler<T>)(payload);
      } catch (error) {
        console.error(`[EventBus] Erro no handler ${sub.id} para evento ${type}:`, error);
      }
    }
  }

  /**
   * Inscreve um handler para um tipo de evento.
   * Retorna uma função de cleanup para cancelar a inscrição.
   */
  subscribe<T extends EventType>(type: T, handler: EventHandler<T>): () => void {
    const id = `sub_${++this.nextId}`;
    const subscription: Subscription = {
      id,
      type,
      handler: handler as EventHandler<EventType>,
    };

    const existing = this.subscriptions.get(type);
    if (existing) {
      existing.push(subscription);
    } else {
      this.subscriptions.set(type, [subscription]);
    }

    // Retorna função de unsubscribe
    return () => {
      const subs = this.subscriptions.get(type);
      if (subs) {
        const idx = subs.findIndex((s) => s.id === id);
        if (idx !== -1) subs.splice(idx, 1);
      }
    };
  }

  /**
   * Retorna o histórico de eventos recentes, opcionalmente filtrado por tipo.
   */
  getHistory<T extends EventType>(
    type?: T
  ): Array<{ type: EventType; payload: EventPayloadMap[EventType]; timestamp: string }> {
    if (type === undefined) return [...this.history];
    return this.history.filter((e) => e.type === type);
  }

  /**
   * Remove todas as assinaturas. Útil para testes e cleanup.
   */
  clear(): void {
    this.subscriptions.clear();
    this.history = [];
    this.nextId = 0;
  }
}

/** Instância singleton do Event Bus para uso em toda a aplicação */
export const eventBus = new EventBus();
