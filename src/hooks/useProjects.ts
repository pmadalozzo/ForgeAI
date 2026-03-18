/**
 * useProjects — Hook CRUD para projetos.
 *
 * Supabase é a fonte de verdade.
 * O store (useProjectStore) é cache reativo para a UI.
 *
 * Fluxo: Componente → useProjects → Supabase → Store (cache)
 */
import { useCallback, useState } from "react";
import { useProjectStore } from "@/stores/project-store";
import { useAppStore } from "@/stores/app-store";
import { getSupabaseClient } from "@/services/supabase/safe-client";
import { createDefaultAgentConfigs } from "@/services/supabase/agents-service";
import type { Project } from "@/types/agents";
import { SupervisionMode } from "@/types/agents";
import type { ProjectStatus, SourceType, SupervisionMode as DbSupervisionMode } from "@/services/supabase/database.types";

// ─── Row ↔ Project mapping ──────────────────────────────────────────────────

interface ProjectRow {
  id: string;
  name: string;
  description: string;
  status: ProjectStatus;
  supervision_mode: DbSupervisionMode;
  source_type: SourceType;
  source_url: string | null;
  git_branch: string | null;
  created_by: string;
  progress: number;
  total_cost: number;
  created_at: string;
  updated_at: string;
}

const DB_TO_LOCAL_STATUS: Record<string, Project["status"]> = {
  planning: "planning",
  active: "in-progress",
  paused: "paused",
  completed: "done",
};

const LOCAL_TO_DB_STATUS: Record<string, ProjectStatus> = {
  setup: "planning",
  planning: "planning",
  "in-progress": "active",
  review: "active",
  done: "completed",
  paused: "paused",
};

const DEFAULT_AGENT_IDS = [
  "orchestrator", "pm", "architect", "frontend", "backend",
  "database", "qa", "security", "devops", "reviewer", "designer",
];

function rowToProject(row: ProjectRow): Project {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    status: DB_TO_LOCAL_STATUS[row.status] ?? "planning",
    supervisionMode: (row.supervision_mode as SupervisionMode) ?? SupervisionMode.Watch,
    localPath: row.source_type === "local_folder" ? row.source_url : null,
    gitUrl: row.source_type === "git_repo" ? row.source_url : null,
    gitBranch: row.git_branch,
    agentIds: DEFAULT_AGENT_IDS,
    progress: row.progress ?? 0,
    completedTasks: [],
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// ─── Input types ─────────────────────────────────────────────────────────────

export interface CreateProjectInput {
  name: string;
  description: string;
  sourceType: "text" | "local" | "git";
  sourcePath: string | null;
  gitBranch: string | null;
}

export interface UpdateProjectInput {
  name?: string;
  description?: string;
  status?: Project["status"];
  supervisionMode?: SupervisionMode;
  localPath?: string | null;
  gitUrl?: string | null;
  gitBranch?: string | null;
  progress?: number;
}

// ─── Hook ────────────────────────────────────────────────────────────────────

export function useProjects() {
  const projects = useProjectStore((s) => s.projects);
  const activeProjectId = useProjectStore((s) => s.activeProjectId);
  const activeProject = useProjectStore((s) => s.getProject());
  const loaded = useProjectStore((s) => s.loaded);

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /** Carrega todos os projetos do usuário logado */
  const load = useCallback(async () => {
    const supabase = getSupabaseClient();
    const userId = useAppStore.getState().userId;
    if (!supabase || !userId) return;

    setIsLoading(true);
    setError(null);

    const { data, error: err } = await supabase
      .from("projects")
      .select("*")
      .order("updated_at", { ascending: false });

    if (err) {
      setError(err.message);
      setIsLoading(false);
      return;
    }

    const rows = (data ?? []) as ProjectRow[];
    useProjectStore.getState()._setProjects(rows.map(rowToProject));
    setIsLoading(false);
  }, []);

  /** Cria um novo projeto */
  const create = useCallback(async (input: CreateProjectInput): Promise<Project | null> => {
    const supabase = getSupabaseClient();
    const userId = useAppStore.getState().userId;
    if (!supabase || !userId) {
      setError("Não autenticado");
      return null;
    }

    setIsLoading(true);
    setError(null);

    // 1. Garante que o profile existe (FK)
    await supabase
      .from("profiles")
      .upsert({ id: userId, display_name: "" }, { onConflict: "id", ignoreDuplicates: true });

    // 2. Resolve source_type e source_url
    const sourceType: SourceType =
      input.sourceType === "git" ? "git_repo"
        : input.sourceType === "local" ? "local_folder"
          : "text";
    const sourceUrl = input.sourceType === "git" ? input.sourcePath
      : input.sourceType === "local" ? input.sourcePath
        : null;

    // 3. Insert no Supabase
    const { data, error: err } = await supabase
      .from("projects")
      .insert({
        name: input.name,
        description: input.description,
        source_type: sourceType,
        source_url: sourceUrl,
        git_branch: input.gitBranch,
        created_by: userId,
      })
      .select()
      .single();

    if (err || !data) {
      setError(err?.message ?? "Erro ao criar projeto");
      setIsLoading(false);
      return null;
    }

    const row = data as ProjectRow;

    // 4. Adiciona criador como membro admin (RLS precisa disso)
    await supabase.from("project_members").insert({
      project_id: row.id,
      user_id: userId,
      role: "admin",
    });

    // 5. Cria agent_configs padrão
    await createDefaultAgentConfigs(row.id);

    // 6. Atualiza cache
    const project = rowToProject(row);
    useProjectStore.getState()._addProject(project);
    setIsLoading(false);
    return project;
  }, []);

  /** Atualiza um projeto existente */
  const update = useCallback(async (projectId: string, input: UpdateProjectInput): Promise<boolean> => {
    const supabase = getSupabaseClient();
    if (!supabase) {
      setError("Supabase indisponível");
      return false;
    }

    setError(null);

    // Monta o objeto de update para o banco
    const dbUpdates: Record<string, unknown> = {};
    if (input.name !== undefined) dbUpdates.name = input.name;
    if (input.description !== undefined) dbUpdates.description = input.description;
    if (input.progress !== undefined) dbUpdates.progress = input.progress;
    if (input.gitBranch !== undefined) dbUpdates.git_branch = input.gitBranch;

    if (input.status !== undefined) {
      dbUpdates.status = LOCAL_TO_DB_STATUS[input.status] ?? "planning";
    }
    if (input.supervisionMode !== undefined) {
      dbUpdates.supervision_mode = input.supervisionMode;
    }

    // source_type + source_url se localPath ou gitUrl mudou
    if (input.gitUrl !== undefined) {
      dbUpdates.source_type = "git_repo";
      dbUpdates.source_url = input.gitUrl;
    } else if (input.localPath !== undefined) {
      dbUpdates.source_type = "local_folder";
      dbUpdates.source_url = input.localPath;
    }

    const { error: err } = await supabase
      .from("projects")
      .update(dbUpdates)
      .eq("id", projectId);

    if (err) {
      setError(err.message);
      return false;
    }

    // Atualiza cache
    useProjectStore.getState()._updateProject(projectId, input);
    return true;
  }, []);

  /** Remove um projeto */
  const remove = useCallback(async (projectId: string): Promise<boolean> => {
    const supabase = getSupabaseClient();
    if (!supabase) {
      setError("Supabase indisponível");
      return false;
    }

    setError(null);

    const { error: err } = await supabase
      .from("projects")
      .delete()
      .eq("id", projectId);

    if (err) {
      setError(err.message);
      return false;
    }

    useProjectStore.getState()._removeProject(projectId);
    return true;
  }, []);

  /** Seleciona um projeto como ativo */
  const select = useCallback((projectId: string | null) => {
    useProjectStore.getState().setActiveProject(projectId);
  }, []);

  return {
    projects,
    activeProject,
    activeProjectId,
    loaded,
    isLoading,
    error,
    load,
    create,
    update,
    remove,
    select,
  };
}
