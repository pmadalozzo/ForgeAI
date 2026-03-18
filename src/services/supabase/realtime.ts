/**
 * Helpers de assinatura Realtime do Supabase para o ForgeAI.
 * Três primitivas: Postgres Changes (mensagens, tasks), Broadcast (eventos), Presence (online).
 *
 * Usa safe-client para funcionar mesmo quando Supabase não está configurado.
 */

import type { RealtimeChannel, RealtimePostgresChangesPayload } from '@supabase/supabase-js';
import { getSupabaseClient } from './safe-client';
import type { ProjectMessage, AgentSession, Task } from './database.types';

// ========================
// Tipos para callbacks
// ========================

/** Payload recebido quando uma nova mensagem é inserida no projeto */
export type MessageChangePayload = RealtimePostgresChangesPayload<ProjectMessage>;

/** Payload recebido quando o status de uma sessão de agente muda */
export type AgentSessionChangePayload = RealtimePostgresChangesPayload<AgentSession>;

/** Payload recebido quando uma task muda */
export type TaskChangePayload = RealtimePostgresChangesPayload<Task>;

/** Dados de presença de um usuário no canal do projeto */
export interface PresenceState {
  userId: string;
  displayName: string;
  avatarUrl: string | null;
  isTyping: boolean;
  onlineAt: string;
}

// ========================
// Tipos de eventos Broadcast
// ========================

/** Tipos de eventos efêmeros enviados via Broadcast */
export type BroadcastEventType = 'agent_log' | 'agent_progress' | 'quality_gate_result';

/** Payload de log de um agente */
export interface AgentLogEvent {
  type: 'agent_log';
  agentRole: string;
  level: 'info' | 'warn' | 'error' | 'debug';
  message: string;
  timestamp: string;
}

/** Payload de progresso de um agente */
export interface AgentProgressEvent {
  type: 'agent_progress';
  agentRole: string;
  progress: number;
  taskId: string | null;
  status: string;
}

/** Payload de resultado de quality gate */
export interface QualityGateResultEvent {
  type: 'quality_gate_result';
  agentRole: string;
  gate: string;
  passed: boolean;
  details: Record<string, unknown>;
}

/** União de todos os eventos Broadcast */
export type BroadcastEvent = AgentLogEvent | AgentProgressEvent | QualityGateResultEvent;

// ========================
// Inscrição em mensagens do projeto (Postgres Changes)
// ========================

/**
 * Inscreve-se em novas mensagens de um projeto via Postgres Changes.
 * Retorna o canal para permitir unsubscribe posterior, ou null se Supabase indisponível.
 */
export function subscribeToProjectMessages(
  projectId: string,
  callback: (payload: MessageChangePayload) => void,
): RealtimeChannel | null {
  const supabase = getSupabaseClient();
  if (!supabase) return null;

  const channelName = `project:${projectId}:messages`;

  const channel = supabase
    .channel(channelName)
    .on<ProjectMessage>(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'project_messages',
        filter: `project_id=eq.${projectId}`,
      },
      callback,
    )
    .subscribe();

  return channel;
}

// ========================
// Inscrição no status dos agentes (Postgres Changes)
// ========================

/**
 * Inscreve-se em mudanças de sessões de agentes de um projeto.
 * Usa Postgres Changes para atualizações persistidas (status, métricas).
 */
export function subscribeToAgentStatus(
  projectId: string,
  callback: (payload: AgentSessionChangePayload) => void,
): RealtimeChannel | null {
  const supabase = getSupabaseClient();
  if (!supabase) return null;

  const channelName = `project:${projectId}:agent-sessions`;

  const channel = supabase
    .channel(channelName)
    .on<AgentSession>(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'agent_sessions',
        filter: `project_id=eq.${projectId}`,
      },
      callback,
    )
    .subscribe();

  return channel;
}

// ========================
// Inscrição em tasks do projeto (Postgres Changes)
// ========================

/**
 * Inscreve-se em mudanças de tasks de um projeto via Postgres Changes.
 * Captura INSERT, UPDATE e DELETE.
 */
export function subscribeToTasks(
  projectId: string,
  callback: (payload: TaskChangePayload) => void,
): RealtimeChannel | null {
  const supabase = getSupabaseClient();
  if (!supabase) return null;

  const channelName = `project:${projectId}:tasks`;

  const channel = supabase
    .channel(channelName)
    .on<Task>(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'tasks',
        filter: `project_id=eq.${projectId}`,
      },
      callback,
    )
    .subscribe();

  return channel;
}

// ========================
// Broadcast — eventos efêmeros (alta frequência, sem persistir)
// ========================

/**
 * Inscreve-se no canal Broadcast de eventos efêmeros de um projeto.
 * Eventos: agent_log, agent_progress, quality_gate_result.
 */
export function subscribeToBroadcast(
  projectId: string,
  callback: (event: BroadcastEvent) => void,
): RealtimeChannel | null {
  const supabase = getSupabaseClient();
  if (!supabase) return null;

  const channelName = `project:${projectId}:events`;

  const channel = supabase
    .channel(channelName)
    .on('broadcast', { event: 'agent_log' }, ({ payload }) => {
      callback(payload as AgentLogEvent);
    })
    .on('broadcast', { event: 'agent_progress' }, ({ payload }) => {
      callback(payload as AgentProgressEvent);
    })
    .on('broadcast', { event: 'quality_gate_result' }, ({ payload }) => {
      callback(payload as QualityGateResultEvent);
    })
    .subscribe();

  return channel;
}

/**
 * Publica um evento Broadcast no canal do projeto.
 * Usado por agentes/orquestrador para emitir logs, progresso e resultados de quality gate.
 */
export async function publishBroadcast(
  projectId: string,
  event: BroadcastEvent,
): Promise<boolean> {
  const supabase = getSupabaseClient();
  if (!supabase) return false;

  const channelName = `project:${projectId}:events`;
  const channel = supabase.channel(channelName);

  const result = await channel.send({
    type: 'broadcast',
    event: event.type,
    payload: event,
  });

  return result === 'ok';
}

// ========================
// Presença no projeto (Presence)
// ========================

/**
 * Inscreve-se no canal de presença de um projeto.
 * Retorna o canal para rastrear/sincronizar usuários online.
 */
export function subscribeToPresence(projectId: string): RealtimeChannel | null {
  const supabase = getSupabaseClient();
  if (!supabase) return null;

  const channelName = `project:${projectId}:presence`;

  const channel = supabase.channel(channelName, {
    config: {
      presence: {
        key: 'user',
      },
    },
  });

  // Inscreve no canal (ativa o tracking de presença)
  channel.subscribe();

  return channel;
}

// ========================
// Utilitário para remover inscrição
// ========================

/**
 * Remove a inscrição de um canal Realtime de forma segura.
 */
export async function unsubscribeChannel(channel: RealtimeChannel): Promise<void> {
  const supabase = getSupabaseClient();
  if (!supabase) return;
  await supabase.removeChannel(channel);
}
