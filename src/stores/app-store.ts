/**
 * App Store — Zustand store para estado de autenticacao global do ForgeAI.
 * Estado derivado do Supabase Auth (persistSession: true) — sem localStorage próprio.
 */
import { create } from "zustand";
import { devtools } from "zustand/middleware";

/** Estado global da aplicacao */
export interface AppState {
  /** Indica se o usuario esta autenticado */
  isAuthenticated: boolean;
  /** ID do usuario Supabase */
  userId: string | null;
  /** Email do usuario */
  userEmail: string | null;

  /** Define o estado de autenticacao */
  setAuthenticated: (userId: string, email: string) => void;
  /** Limpa autenticacao e volta para tela de login */
  logout: () => void;
}

export const useAppStore = create<AppState>()(
  devtools(
    (set) => ({
      isAuthenticated: false,
      userId: null,
      userEmail: null,

      setAuthenticated: (userId, email) =>
        set(
          {
            isAuthenticated: true,
            userId,
            userEmail: email,
          },
          false,
          "setAuthenticated",
        ),

      logout: () =>
        set(
          {
            isAuthenticated: false,
            userId: null,
            userEmail: null,
          },
          false,
          "logout",
        ),
    }),
    { name: "ForgeAI-App" },
  ),
);
