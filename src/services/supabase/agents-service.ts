/**
 * CRUD para agent_configs no Supabase.
 */
import { getSupabaseClient } from "./safe-client";

export interface AgentConfigRow {
  id: string;
  project_id: string;
  agent_role: string;
  llm_provider: string;
  model_name: string;
  is_active: boolean;
  config: Record<string, string>;
  created_at: string;
}

export interface AgentConfigInput {
  project_id: string;
  agent_role: string;
  llm_provider: string;
  model_name: string;
  is_active?: boolean;
  config?: Record<string, string>;
}

const DEFAULT_AGENTS: Array<{ role: string; provider: string; model: string }> = [
  { role: "orchestrator", provider: "claude-code", model: "claude-sonnet-4-20250514" },
  { role: "pm", provider: "claude-code", model: "claude-sonnet-4-20250514" },
  { role: "architect", provider: "claude-code", model: "claude-sonnet-4-20250514" },
  { role: "frontend", provider: "claude-code", model: "claude-sonnet-4-20250514" },
  { role: "backend", provider: "claude-code", model: "claude-sonnet-4-20250514" },
  { role: "database", provider: "claude-code", model: "claude-sonnet-4-20250514" },
  { role: "qa", provider: "claude-code", model: "claude-sonnet-4-20250514" },
  { role: "security", provider: "claude-code", model: "claude-sonnet-4-20250514" },
  { role: "devops", provider: "claude-code", model: "claude-sonnet-4-20250514" },
  { role: "reviewer", provider: "claude-code", model: "claude-sonnet-4-20250514" },
  { role: "researcher", provider: "claude-code", model: "claude-sonnet-4-20250514" },
];

export async function fetchAgentConfigs(projectId: string): Promise<AgentConfigRow[]> {
  const supabase = getSupabaseClient();
  if (!supabase) return [];

  const { data, error } = await supabase
    .from("agent_configs")
    .select("*")
    .eq("project_id", projectId)
    .order("created_at");

  if (error) {
    console.error("[agents-service] fetchAgentConfigs:", error.message);
    return [];
  }

  return (data ?? []) as AgentConfigRow[];
}

export async function upsertAgentConfig(
  config: AgentConfigInput & { id?: string },
): Promise<AgentConfigRow | null> {
  const supabase = getSupabaseClient();
  if (!supabase) return null;

  const { data, error } = await supabase
    .from("agent_configs")
    .upsert(config)
    .select()
    .single();

  if (error) {
    console.error("[agents-service] upsertAgentConfig:", error.message);
    return null;
  }

  return data as AgentConfigRow;
}

export async function deleteAgentConfig(configId: string): Promise<boolean> {
  const supabase = getSupabaseClient();
  if (!supabase) return false;

  const { error } = await supabase
    .from("agent_configs")
    .delete()
    .eq("id", configId);

  if (error) {
    console.error("[agents-service] deleteAgentConfig:", error.message);
    return false;
  }

  return true;
}

export async function createDefaultAgentConfigs(projectId: string): Promise<AgentConfigRow[]> {
  const supabase = getSupabaseClient();
  if (!supabase) return [];

  const rows = DEFAULT_AGENTS.map((a) => ({
    project_id: projectId,
    agent_role: a.role,
    llm_provider: a.provider,
    model_name: a.model,
    is_active: true,
    config: {},
  }));

  const { data, error } = await supabase
    .from("agent_configs")
    .insert(rows)
    .select();

  if (error) {
    console.error("[agents-service] createDefaultAgentConfigs:", error.message);
    return [];
  }

  return (data ?? []) as AgentConfigRow[];
}
