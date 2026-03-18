/**
 * Serviço de persistência de mensagens do chat no Supabase.
 * Salva/carrega mensagens da tabela project_messages.
 */
import { getSupabaseClient } from "./safe-client";
import type { SenderType } from "./database.types";

export interface ChatMessageRow {
  id: string;
  project_id: string;
  sender_type: SenderType;
  sender_id: string;
  agent_role: string | null;
  content: string;
  metadata: Record<string, unknown>;
  created_at: string;
}

/** Salva uma mensagem no banco (fire-and-forget, não bloqueia UI) */
export async function saveMessage(
  projectId: string,
  messageId: string,
  senderType: SenderType,
  senderId: string,
  content: string,
  agentRole?: string,
  metadata?: Record<string, unknown>,
): Promise<boolean> {
  const supabase = getSupabaseClient();
  if (!supabase) return false;

  const { error } = await supabase.from("project_messages").upsert(
    {
      id: messageId,
      project_id: projectId,
      sender_type: senderType,
      sender_id: senderId,
      agent_role: agentRole ?? null,
      content,
      metadata: metadata ?? {},
    },
    { onConflict: "id" },
  );

  if (error) {
    console.error("[chat-service] saveMessage:", error.message);
    return false;
  }
  return true;
}

/** Carrega mensagens de um projeto (últimas N, ordenadas por data) */
export async function loadMessages(
  projectId: string,
  limit = 100,
): Promise<ChatMessageRow[]> {
  const supabase = getSupabaseClient();
  if (!supabase) return [];

  const { data, error } = await supabase
    .from("project_messages")
    .select("*")
    .eq("project_id", projectId)
    .order("created_at", { ascending: true })
    .limit(limit);

  if (error) {
    console.error("[chat-service] loadMessages:", error.message);
    return [];
  }
  return (data ?? []) as ChatMessageRow[];
}
