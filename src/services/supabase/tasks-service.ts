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

/** Calcula progresso do projeto baseado nas tasks e atualiza na tabela projects */
export async function syncProjectProgress(projectId: string): Promise<number> {
  const supabase = getSupabaseClient();
  if (!supabase) return 0;

  const { data, error } = await supabase
    .from("tasks")
    .select("status")
    .eq("project_id", projectId);

  if (error || !data || data.length === 0) return 0;

  const total = data.length;
  const doneCount = data.filter((t) => t.status === "done").length;
  const reviewCount = data.filter((t) => t.status === "review").length;
  const inProgressCount = data.filter((t) => t.status === "in_progress").length;

  // done=100%, review=80%, in_progress=40%, pending/blocked=0%
  const weightedProgress = Math.round(
    ((doneCount * 100 + reviewCount * 80 + inProgressCount * 40) / (total * 100)) * 100,
  );

  // Atualiza na tabela projects
  await supabase
    .from("projects")
    .update({ progress: weightedProgress })
    .eq("id", projectId);

  return weightedProgress;
}

/** Carrega o progresso salvo do projeto — usa mesma fórmula ponderada que syncProjectProgress */
export async function getProjectProgress(projectId: string): Promise<{ progress: number; completedTasks: string[] }> {
  const tasks = await loadAllTasks(projectId);
  if (tasks.length === 0) return { progress: 0, completedTasks: [] };

  const completed = tasks.filter((t) => t.status === "done").map((t) => t.title);
  const total = tasks.length;
  const doneCount = completed.length;
  const reviewCount = tasks.filter((t) => t.status === "review").length;
  const inProgressCount = tasks.filter((t) => t.status === "in_progress").length;

  // Mesma fórmula ponderada de syncProjectProgress
  const progress = Math.round(
    ((doneCount * 100 + reviewCount * 80 + inProgressCount * 40) / (total * 100)) * 100,
  );

  return { progress, completedTasks: completed };
}
