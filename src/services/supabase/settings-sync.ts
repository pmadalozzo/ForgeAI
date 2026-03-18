/**
 * Settings Sync — sincroniza configurações do usuário com Supabase (tabela user_settings).
 * Substitui o antigo localStorage "forgeai-settings".
 */
import { getSupabaseClient } from './safe-client';
import type { LLMProvider, AgentRole } from '@/types/agents';
import type { LLMProviderSettings, ClaudeEffort } from '@/stores/settings-store';
import type { SupervisionMode } from '@/types/agents';

export interface UserSettingsRow {
  id: string;
  user_id: string;
  providers: Record<string, unknown>;
  agent_defaults: Record<string, unknown>;
  supervision_mode: string;
  claude_effort: string;
  max_parallel_agents: number;
  auto_fast_model: boolean;
  theme: string;
  created_at: string;
  updated_at: string;
}

export interface SettingsData {
  providers: Record<LLMProvider, LLMProviderSettings>;
  agentDefaults: Record<AgentRole, { provider: LLMProvider; model: string; effort: ClaudeEffort }>;
  supervisionMode: SupervisionMode;
  claudeEffort: ClaudeEffort;
  maxParallelAgents: number;
  autoFastModel: boolean;
  theme: 'dark';
}

/** Carrega configurações do Supabase para o usuário logado */
export async function loadSettingsFromSupabase(userId: string): Promise<SettingsData | null> {
  const supabase = getSupabaseClient();
  if (!supabase) return null;

  const { data, error } = await supabase
    .from('user_settings')
    .select('*')
    .eq('user_id', userId)
    .single();

  if (error || !data) return null;

  const row = data as UserSettingsRow;
  return {
    providers: row.providers as SettingsData['providers'],
    agentDefaults: row.agent_defaults as SettingsData['agentDefaults'],
    supervisionMode: row.supervision_mode as SupervisionMode,
    claudeEffort: row.claude_effort as ClaudeEffort,
    maxParallelAgents: row.max_parallel_agents,
    autoFastModel: row.auto_fast_model,
    theme: row.theme as 'dark',
  };
}

/** Salva/atualiza configurações no Supabase */
export async function syncSettingsToSupabase(
  userId: string,
  settings: SettingsData,
): Promise<boolean> {
  const supabase = getSupabaseClient();
  if (!supabase) return false;

  const { error } = await supabase
    .from('user_settings')
    .upsert({
      user_id: userId,
      providers: settings.providers as Record<string, unknown>,
      agent_defaults: settings.agentDefaults as Record<string, unknown>,
      supervision_mode: settings.supervisionMode,
      claude_effort: settings.claudeEffort,
      max_parallel_agents: settings.maxParallelAgents,
      auto_fast_model: settings.autoFastModel,
      theme: settings.theme,
    }, { onConflict: 'user_id' });

  if (error) {
    console.error('[settings-sync] syncSettingsToSupabase:', error.message);
    return false;
  }

  return true;
}

/** Salva GitHub token e username no perfil do usuário */
export async function syncGitHubToSupabase(
  userId: string,
  token: string | null,
  username: string | null,
  avatarUrl: string | null,
): Promise<boolean> {
  const supabase = getSupabaseClient();
  if (!supabase) return false;

  const { error } = await supabase
    .from('profiles')
    .update({
      github_token: token,
      github_username: username,
      avatar_url: avatarUrl,
    })
    .eq('id', userId);

  if (error) {
    console.error('[settings-sync] syncGitHubToSupabase:', error.message);
    return false;
  }

  return true;
}

/** Carrega dados GitHub do perfil do usuário */
export async function loadGitHubFromSupabase(userId: string): Promise<{
  token: string | null;
  username: string | null;
  avatarUrl: string | null;
} | null> {
  const supabase = getSupabaseClient();
  if (!supabase) return null;

  const { data, error } = await supabase
    .from('profiles')
    .select('github_token, github_username, avatar_url')
    .eq('id', userId)
    .single();

  if (error || !data) return null;

  return {
    token: (data as { github_token: string | null }).github_token,
    username: (data as { github_username: string | null }).github_username,
    avatarUrl: (data as { avatar_url: string | null }).avatar_url,
  };
}
