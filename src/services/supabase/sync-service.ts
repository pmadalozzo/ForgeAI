/**
 * Sync Service — sincroniza memórias com Supabase.
 * Usa safe-client para fallback gracioso quando Supabase não está disponível.
 */

import { getSupabaseClient } from './safe-client';
import type { ProjectMemoryRow, DevMemoryRow, InsertDto } from './database.types';
import type { ProjectMemoryEntry, DevMemoryEntry } from '@/stores/memory-store';

// ─── Memory Sync ────────────────────────────────────────────────────────────

/** Salva uma memória de projeto no Supabase */
export async function syncProjectMemoryToSupabase(
  entry: ProjectMemoryEntry,
): Promise<boolean> {
  const supabase = getSupabaseClient();
  if (!supabase) return false;

  const row: InsertDto<'project_memories'> = {
    id: entry.id,
    project_id: entry.projectId,
    agent_role: entry.agentRole,
    type: entry.type,
    title: entry.title,
    content: entry.content,
    metadata: (entry.metadata as Record<string, unknown>) ?? {},
    created_at: entry.createdAt,
  };

  const { error } = await supabase
    .from('project_memories')
    .upsert(row, { onConflict: 'id' });

  if (error) {
    console.error('[sync-service] syncProjectMemoryToSupabase:', error.message);
    return false;
  }

  return true;
}

/** Salva uma memória de desenvolvimento no Supabase */
export async function syncDevMemoryToSupabase(
  entry: DevMemoryEntry,
): Promise<boolean> {
  const supabase = getSupabaseClient();
  if (!supabase) return false;

  const row: InsertDto<'dev_memories'> = {
    id: entry.id,
    category: entry.category,
    title: entry.title,
    content: entry.content,
    learned_from: entry.learnedFrom,
    created_at: entry.createdAt,
    updated_at: entry.updatedAt,
  };

  const { error } = await supabase
    .from('dev_memories')
    .upsert(row, { onConflict: 'id' });

  if (error) {
    console.error('[sync-service] syncDevMemoryToSupabase:', error.message);
    return false;
  }

  return true;
}

/** Carrega memórias de projeto do Supabase */
export async function loadProjectMemoriesFromSupabase(
  projectId: string,
): Promise<ProjectMemoryEntry[]> {
  const supabase = getSupabaseClient();
  if (!supabase) return [];

  const { data, error } = await supabase
    .from('project_memories')
    .select('*')
    .eq('project_id', projectId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('[sync-service] loadProjectMemoriesFromSupabase:', error.message);
    return [];
  }

  return (data ?? []).map((row: ProjectMemoryRow) => ({
    id: row.id,
    projectId: row.project_id,
    agentRole: row.agent_role,
    type: row.type as ProjectMemoryEntry['type'],
    title: row.title,
    content: row.content,
    metadata: row.metadata as Record<string, string> | undefined,
    createdAt: row.created_at,
  }));
}

/** Carrega memórias de desenvolvimento do Supabase */
export async function loadDevMemoriesFromSupabase(): Promise<DevMemoryEntry[]> {
  const supabase = getSupabaseClient();
  if (!supabase) return [];

  const { data, error } = await supabase
    .from('dev_memories')
    .select('*')
    .order('updated_at', { ascending: false });

  if (error) {
    console.error('[sync-service] loadDevMemoriesFromSupabase:', error.message);
    return [];
  }

  return (data ?? []).map((row: DevMemoryRow) => ({
    id: row.id,
    category: row.category as DevMemoryEntry['category'],
    title: row.title,
    content: row.content,
    learnedFrom: row.learned_from,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }));
}

/** Deleta uma memória de projeto do Supabase */
export async function deleteProjectMemoryFromSupabase(id: string): Promise<boolean> {
  const supabase = getSupabaseClient();
  if (!supabase) return false;

  const { error } = await supabase
    .from('project_memories')
    .delete()
    .eq('id', id);

  if (error) {
    console.error('[sync-service] deleteProjectMemoryFromSupabase:', error.message);
    return false;
  }

  return true;
}

/** Deleta uma memória de desenvolvimento do Supabase */
export async function deleteDevMemoryFromSupabase(id: string): Promise<boolean> {
  const supabase = getSupabaseClient();
  if (!supabase) return false;

  const { error } = await supabase
    .from('dev_memories')
    .delete()
    .eq('id', id);

  if (error) {
    console.error('[sync-service] deleteDevMemoryFromSupabase:', error.message);
    return false;
  }

  return true;
}
