/**
 * Auth Store — Zustand store para estado de autenticacao do ForgeAI.
 * Supabase é a fonte principal (profiles.github_token/github_username). Sem localStorage.
 */
import { create } from "zustand";
import { devtools } from "zustand/middleware";
import {
  syncGitHubToSupabase,
  loadGitHubFromSupabase,
} from "@/services/supabase/settings-sync";
import { useAppStore } from "@/stores/app-store";

/** Estado de autenticacao GitHub */
interface GitHubAuth {
  token: string | null;
  username: string | null;
  avatarUrl: string | null;
  isAuthenticated: boolean;
}

/** Estado completo da store de autenticacao */
export interface AuthState {
  github: GitHubAuth;

  // --- Acoes ---
  setGitHubToken: (token: string, username: string, avatarUrl: string) => void;
  clearGitHub: () => void;

  /** Carrega dados GitHub do Supabase */
  loadGitHub: (userId: string) => Promise<void>;
}

/** Estado inicial do GitHub (nao autenticado) */
const INITIAL_GITHUB: GitHubAuth = {
  token: null,
  username: null,
  avatarUrl: null,
  isAuthenticated: false,
};

export const useAuthStore = create<AuthState>()(
  devtools(
    (set) => ({
      github: { ...INITIAL_GITHUB },

      setGitHubToken: (token, username, avatarUrl) => {
        set(
          {
            github: {
              token,
              username,
              avatarUrl,
              isAuthenticated: true,
            },
          },
          false,
          "setGitHubToken",
        );

        // Sync com Supabase
        const userId = useAppStore.getState().userId;
        if (userId) {
          syncGitHubToSupabase(userId, token, username, avatarUrl).catch(() => {
            console.warn("[auth-store] Falha ao sincronizar GitHub com Supabase");
          });
        }
      },

      clearGitHub: () => {
        set(
          { github: { ...INITIAL_GITHUB } },
          false,
          "clearGitHub",
        );

        // Limpa no Supabase
        const userId = useAppStore.getState().userId;
        if (userId) {
          syncGitHubToSupabase(userId, null, null, null).catch(() => {
            console.warn("[auth-store] Falha ao limpar GitHub no Supabase");
          });
        }
      },

      loadGitHub: async (userId) => {
        const remote = await loadGitHubFromSupabase(userId);
        if (remote && remote.token) {
          set(
            {
              github: {
                token: remote.token,
                username: remote.username,
                avatarUrl: remote.avatarUrl,
                isAuthenticated: true,
              },
            },
            false,
            "loadGitHub",
          );
        }
      },
    }),
    { name: "ForgeAI-Auth" },
  ),
);
