/**
 * CRUD de tasks no Supabase.
 * Persiste cada etapa do pipeline para permitir retomada após queda.
 */
import { getSupabaseClient } from "./safe-client";

type TaskStatus = "pending" | "in_progress" | "review" | "blocked" | "done";

export interface TaskRow {
  id: string;
  project_id: string;
  title: string;
  description: string;
  assigned_agent: string | null;
  status: TaskStatus;
  priority: number;
  parent_task_id: string | null;
  quality_gate_results: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
}

/** Insere uma task no banco (status: pending) */
export async function insertTask(
  projectId: string,
  taskId: string,
  title: string,
  description: string,
  assignedAgent: string,
  priority: number,
): Promise<boolean> {
  const supabase = getSupabaseClient();
  if (!supabase) return false;

  const { error } = await supabase.from("tasks").upsert({
    id: taskId,
    project_id: projectId,
    title,
    description,
    assigned_agent: assignedAgent,
    status: "pending" as TaskStatus,
    priority,
  }, { onConflict: "id" });

  if (error) {
    console.error("[tasks-service] insertTask:", error.message);
    return false;
  }
  return true;
}

/** Atualiza o status de uma task */
export async function updateTaskStatus(
  taskId: string,
  status: TaskStatus,
  qualityGateResults?: Record<string, unknown>,
): Promise<boolean> {
  const supabase = getSupabaseClient();
  if (!supabase) return false;

  const updates: Record<string, unknown> = { status };
  if (status === "done") {
    updates.completed_at = new Date().toISOString();
  }
  if (qualityGateResults) {
    updates.quality_gate_results = qualityGateResults;
  }

  const { error } = await supabase
    .from("tasks")
    .update(updates)
    .eq("id", taskId);

  if (error) {
    console.error("[tasks-service] updateTaskStatus:", error.message);
    return false;
  }
  return true;
}

/** Carrega tasks pendentes/em progresso de um projeto (para retomada) */
export async function loadPendingTasks(projectId: string): Promise<TaskRow[]> {
  const supabase = getSupabaseClient();
  if (!supabase) return [];

  const { data, error } = await supabase
    .from("tasks")
    .select("*")
    .eq("project_id", projectId)
    .in("status", ["pending", "in_progress", "review", "blocked"])
    .order("priority", { ascending: false });

  if (error) {
    console.error("[tasks-service] loadPendingTasks:", error.message);
    return [];
  }
  return (data ?? []) as TaskRow[];
}

/** Carrega todas as tasks de um projeto */
export async function loadAllTasks(projectId: string): Promise<TaskRow[]> {
  const supabase = getSupabaseClient();
  if (!supabase) return [];

  const { data, error } = await supabase
    .from("tasks")
    .select("*")
    .eq("project_id", projectId)
    .order("created_at", { ascending: true });

  if (error) {
    console.error("[tasks-service] loadAllTasks:", error.message);
    return [];
  }
  return (data ?? []) as TaskRow[];
}
