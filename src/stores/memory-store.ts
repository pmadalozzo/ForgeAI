/**
 * Memory Store — Zustand store para memória do projeto e memória de desenvolvimento.
 * Supabase é a fonte principal de dados. State local é cache.
 *
 * - ProjectMemoryEntry: memória por projeto (criada por agentes)
 * - DevMemoryEntry: memória global de desenvolvimento (preferências, padrões, convenções)
 */
import { create } from "zustand";
import { devtools } from "zustand/middleware";
import {
  syncProjectMemoryToSupabase,
  syncDevMemoryToSupabase,
  deleteProjectMemoryFromSupabase,
  deleteDevMemoryFromSupabase,
  loadProjectMemoriesFromSupabase,
  loadDevMemoriesFromSupabase,
} from "@/services/supabase/sync-service";

// ─── Types ───────────────────────────────────────────────────────────────────

export type ProjectMemoryType =
  | "analysis"
  | "decision"
  | "artifact"
  | "issue"
  | "progress"
  | "note";

export type DevMemoryCategory =
  | "preference"
  | "pattern"
  | "convention"
  | "tool"
  | "workflow";

export interface ProjectMemoryEntry {
  id: string;
  projectId: string;
  agentRole: string;
  type: ProjectMemoryType;
  title: string;
  content: string;
  metadata?: Record<string, string>;
  createdAt: string;
}

export interface DevMemoryEntry {
  id: string;
  category: DevMemoryCategory;
  title: string;
  content: string;
  learnedFrom: string;
  createdAt: string;
  updatedAt: string;
}

// ─── Store Interface ─────────────────────────────────────────────────────────

interface MemoryState {
  projectMemories: ProjectMemoryEntry[];
  devMemories: DevMemoryEntry[];

  addProjectMemory: (
    entry: Omit<ProjectMemoryEntry, "id" | "createdAt">,
  ) => void;
  addDevMemory: (
    entry: Omit<DevMemoryEntry, "id" | "createdAt" | "updatedAt">,
  ) => void;
  getProjectMemories: (projectId: string) => ProjectMemoryEntry[];
  updateDevMemory: (
    id: string,
    updates: Partial<Pick<DevMemoryEntry, "title" | "content" | "category">>,
  ) => void;
  deleteProjectMemory: (id: string) => void;
  deleteDevMemory: (id: string) => void;

  /** Carrega memórias do Supabase (fonte principal de dados) */
  loadMemories: (projectId?: string) => Promise<void>;
}

// ─── Helper ──────────────────────────────────────────────────────────────────

function generateId(): string {
  return crypto.randomUUID();
}

// ─── Store ───────────────────────────────────────────────────────────────────

export const useMemoryStore = create<MemoryState>()(
  devtools(
    (set, get) => ({
      projectMemories: [],
      devMemories: [],

      addProjectMemory: (entry) => {
        const newEntry: ProjectMemoryEntry = {
          ...entry,
          id: generateId(),
          createdAt: new Date().toISOString(),
        };

        // Sync com Supabase primeiro (fire-and-forget)
        syncProjectMemoryToSupabase(newEntry).catch(() => {
          console.warn("[memory-store] Falha ao salvar memória de projeto no Supabase");
        });

        set(
          (state) => ({
            projectMemories: [...state.projectMemories, newEntry],
          }),
          false,
          "addProjectMemory",
        );
      },

      addDevMemory: (entry) => {
        const now = new Date().toISOString();
        const newEntry: DevMemoryEntry = {
          ...entry,
          id: generateId(),
          createdAt: now,
          updatedAt: now,
        };

        // Sync com Supabase primeiro (fire-and-forget)
        syncDevMemoryToSupabase(newEntry).catch(() => {
          console.warn("[memory-store] Falha ao salvar memória dev no Supabase");
        });

        set(
          (state) => ({
            devMemories: [...state.devMemories, newEntry],
          }),
          false,
          "addDevMemory",
        );
      },

      getProjectMemories: (projectId) => {
        return get().projectMemories.filter(
          (m) => m.projectId === projectId,
        );
      },

      updateDevMemory: (id, updates) => {
        set(
          (state) => ({
            devMemories: state.devMemories.map((m) =>
              m.id === id
                ? { ...m, ...updates, updatedAt: new Date().toISOString() }
                : m,
            ),
          }),
          false,
          "updateDevMemory",
        );

        // Sync updated entry com Supabase
        const updated = get().devMemories.find((m) => m.id === id);
        if (updated) {
          syncDevMemoryToSupabase(updated).catch(() => {
            console.warn("[memory-store] Falha ao atualizar memória dev no Supabase");
          });
        }
      },

      deleteProjectMemory: (id) => {
        // Deleta do Supabase (fire-and-forget)
        deleteProjectMemoryFromSupabase(id).catch(() => {
          console.warn("[memory-store] Falha ao deletar memória de projeto do Supabase");
        });

        set(
          (state) => ({
            projectMemories: state.projectMemories.filter(
              (m) => m.id !== id,
            ),
          }),
          false,
          "deleteProjectMemory",
        );
      },

      deleteDevMemory: (id) => {
        // Deleta do Supabase (fire-and-forget)
        deleteDevMemoryFromSupabase(id).catch(() => {
          console.warn("[memory-store] Falha ao deletar memória dev do Supabase");
        });

        set(
          (state) => ({
            devMemories: state.devMemories.filter((m) => m.id !== id),
          }),
          false,
          "deleteDevMemory",
        );
      },

      loadMemories: async (projectId) => {
        // Carrega dev memories do Supabase
        const remoteDevMemories = await loadDevMemoriesFromSupabase();
        if (remoteDevMemories.length > 0) {
          set(
            { devMemories: remoteDevMemories },
            false,
            "loadDevMemories",
          );
        }

        // Carrega project memories (se projectId fornecido)
        if (projectId) {
          const remoteProjectMemories = await loadProjectMemoriesFromSupabase(projectId);
          // Substitui as memórias do projeto atual, mantendo memórias de outros projetos
          set(
            (state) => {
              const otherProjectMemories = state.projectMemories.filter(
                (m) => m.projectId !== projectId,
              );
              return {
                projectMemories: [...otherProjectMemories, ...remoteProjectMemories],
              };
            },
            false,
            "loadProjectMemories",
          );
        }
      },
    }),
    { name: "ForgeAI-Memory" },
  ),
);
