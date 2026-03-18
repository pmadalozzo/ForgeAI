/**
 * Project Store — cache reativo dos projetos.
 * Supabase é a fonte de verdade. O hook useProjects faz o CRUD.
 * Este store é apenas estado em memória para a UI reagir.
 */
import { create } from "zustand";
import { devtools } from "zustand/middleware";
import type { Project } from "@/types/agents";

/** Informação da fase atual do pipeline */
export interface PipelinePhaseInfo {
  /** Número da fase (1-5) */
  phase: number;
  /** Nome da fase */
  name: string;
  /** Total de tarefas na fase */
  totalTasks: number;
  /** Tarefas concluídas na fase */
  completedTasks: number;
}

interface ProjectState {
  projects: Project[];
  activeProjectId: string | null;
  loaded: boolean;
  /** Fase atual do pipeline em execução (null se inativo) */
  currentPhase: PipelinePhaseInfo | null;

  /** Retorna o projeto ativo */
  getProject: () => Project | null;

  /** Seleciona um projeto como ativo */
  setActiveProject: (projectId: string | null) => void;

  /** Atualiza a fase atual do pipeline */
  setCurrentPhase: (phase: PipelinePhaseInfo | null) => void;

  // --- Ações internas (chamadas pelo hook useProjects) ---
  _setProjects: (projects: Project[]) => void;
  _addProject: (project: Project) => void;
  _updateProject: (projectId: string, updates: Partial<Project>) => void;
  _removeProject: (projectId: string) => void;
  _setLoaded: (loaded: boolean) => void;
}

export const useProjectStore = create<ProjectState>()(
  devtools(
    (set, get) => ({
      projects: [],
      activeProjectId: null,
      loaded: false,
      currentPhase: null,

      getProject: () => {
        const { activeProjectId, projects } = get();
        if (!activeProjectId) return null;
        return projects.find((p) => p.id === activeProjectId) ?? null;
      },

      setActiveProject: (projectId) =>
        set({ activeProjectId: projectId, currentPhase: null }, false, "setActiveProject"),

      setCurrentPhase: (phase) =>
        set({ currentPhase: phase }, false, "setCurrentPhase"),

      _setProjects: (projects) =>
        set({ projects, loaded: true }, false, "_setProjects"),

      _addProject: (project) =>
        set(
          (s) => ({ projects: [...s.projects, project], activeProjectId: project.id }),
          false,
          "_addProject",
        ),

      _updateProject: (projectId, updates) =>
        set(
          (s) => ({
            projects: s.projects.map((p) =>
              p.id === projectId ? { ...p, ...updates, updatedAt: new Date().toISOString() } : p,
            ),
          }),
          false,
          "_updateProject",
        ),

      _removeProject: (projectId) =>
        set(
          (s) => ({
            projects: s.projects.filter((p) => p.id !== projectId),
            activeProjectId: s.activeProjectId === projectId ? null : s.activeProjectId,
          }),
          false,
          "_removeProject",
        ),

      _setLoaded: (loaded) =>
        set({ loaded }, false, "_setLoaded"),
    }),
    { name: "ForgeAI-Project" },
  ),
);
