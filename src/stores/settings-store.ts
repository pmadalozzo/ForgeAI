/**
 * Settings Store — Zustand store para configurações de LLM e preferências do ForgeAI.
 * Supabase é a fonte principal (tabela user_settings). Sem localStorage.
 */
import { create } from "zustand";
import { devtools } from "zustand/middleware";
import type { LLMProvider, AgentRole } from "@/types/agents";
import { SupervisionMode } from "@/types/agents";
import {
  syncSettingsToSupabase,
  loadSettingsFromSupabase,
} from "@/services/supabase/settings-sync";
import { useAppStore } from "@/stores/app-store";

/** Configuração de um provider de LLM */
export interface LLMProviderSettings {
  enabled: boolean;
  apiKey: string;
  baseUrl: string;
  defaultModel: string;
}

/** Nível de esforço do Claude Code CLI */
export type ClaudeEffort = "low" | "medium" | "high" | "max";

/** Labels para exibição do effort */
export const EFFORT_LABELS: Record<ClaudeEffort, { label: string; description: string }> = {
  low: { label: "Low", description: "Respostas rápidas e concisas" },
  medium: { label: "Medium", description: "Equilíbrio entre velocidade e qualidade" },
  high: { label: "High", description: "Respostas mais detalhadas e completas" },
  max: { label: "Max", description: "Máximo esforço, melhor qualidade" },
};

/** Estado completo da store de configurações */
export interface SettingsState {
  /** Indica se as configurações do usuário já foram carregadas do Supabase */
  _settingsLoaded: boolean;
  /** Configurações por provider */
  providers: Record<LLMProvider, LLMProviderSettings>;
  /** Provider/modelo/effort padrão por papel de agente */
  agentDefaults: Record<AgentRole, { provider: LLMProvider; model: string; effort: ClaudeEffort }>;
  /** Modo de supervisão */
  supervisionMode: SupervisionMode;
  /** Nível de esforço do Claude Code CLI */
  claudeEffort: ClaudeEffort;
  /** Agentes simultâneos (batch size) */
  maxParallelAgents: number;
  /** Usar Haiku automaticamente para agentes simples (PM, QA, Reviewer, Security) */
  autoFastModel: boolean;
  /** Tema (apenas dark por enquanto) */
  theme: "dark";

  // --- Ações ---
  setProviderSettings: (provider: LLMProvider, settings: Partial<LLMProviderSettings>) => void;
  setAgentDefault: (role: AgentRole, provider: LLMProvider, model: string, effort?: ClaudeEffort) => void;
  setSupervisionMode: (mode: SupervisionMode) => void;
  setClaudeEffort: (effort: ClaudeEffort) => void;
  setMaxParallelAgents: (count: number) => void;
  setAutoFastModel: (enabled: boolean) => void;
  isProviderConfigured: (provider: LLMProvider) => boolean;
  getConfiguredProviders: () => LLMProvider[];

  /** Carrega configurações do Supabase (fonte principal de dados) */
  loadSettings: (userId: string) => Promise<void>;
}

/** URLs base padrão para cada provider */
const DEFAULT_BASE_URLS: Record<LLMProvider, string> = {
  "claude-code": "https://api.anthropic.com",
  openai: "https://api.openai.com/v1",
  gemini: "https://generativelanguage.googleapis.com",
  ollama: "http://localhost:11434",
  "lm-studio": "http://localhost:1234",
};

/** Modelos padrão por provider */
const DEFAULT_MODELS: Record<LLMProvider, string> = {
  "claude-code": "claude-sonnet-4-20250514",
  openai: "gpt-4o",
  gemini: "gemini-2.0-flash",
  ollama: "llama3:8b",
  "lm-studio": "default",
};

/** Configuração inicial de providers */
function createDefaultProviders(): Record<LLMProvider, LLMProviderSettings> {
  const providers = {} as Record<LLMProvider, LLMProviderSettings>;
  const allProviders: LLMProvider[] = ["claude-code", "openai", "gemini", "ollama", "lm-studio"];

  for (const p of allProviders) {
    providers[p] = {
      enabled: false,
      apiKey: "",
      baseUrl: DEFAULT_BASE_URLS[p],
      defaultModel: DEFAULT_MODELS[p],
    };
  }

  return providers;
}

/** Configuração padrão de agentes (todos com Claude) */
function createDefaultAgentDefaults(): Record<AgentRole, { provider: LLMProvider; model: string; effort: ClaudeEffort }> {
  const roles: AgentRole[] = [
    "orchestrator", "pm", "architect", "frontend", "backend",
    "database", "qa", "security", "devops", "reviewer", "designer", "researcher",
  ];

  const defaults = {} as Record<AgentRole, { provider: LLMProvider; model: string; effort: ClaudeEffort }>;
  for (const role of roles) {
    defaults[role] = { provider: "claude-code", model: "claude-sonnet-4-20250514", effort: "medium" };
  }

  return defaults;
}

/** Modelos disponíveis por provider (hardcoded) */
export const MODELS_BY_PROVIDER: Record<LLMProvider, string[]> = {
  "claude-code": [
    "claude-opus-4-20250514",
    "claude-sonnet-4-20250514",
    "claude-haiku-4-5-20251001",
  ],
  openai: [
    "gpt-4o",
    "gpt-4o-mini",
    "gpt-4-turbo",
    "o1",
    "o1-mini",
    "o3-mini",
  ],
  gemini: [
    "gemini-2.0-flash",
    "gemini-2.0-pro",
    "gemini-1.5-flash",
    "gemini-1.5-pro",
  ],
  ollama: [
    "codellama:13b",
    "deepseek-coder:6.7b",
    "llama3:8b",
    "mistral:7b",
    "qwen2.5-coder:7b",
  ],
  "lm-studio": [
    "default",
  ],
};

/** Nomes legíveis por provider */
export const PROVIDER_DISPLAY_NAMES: Record<LLMProvider, string> = {
  "claude-code": "Claude (Anthropic)",
  openai: "OpenAI",
  gemini: "Google Gemini",
  ollama: "Ollama (Local)",
  "lm-studio": "LM Studio (Local)",
};

/** Helper para disparar sync com Supabase após qualquer mudança */
function scheduleSync() {
  const userId = useAppStore.getState().userId;
  if (!userId) return;

  const state = useSettingsStore.getState();

  // Não sincronizar antes de carregar as configurações do usuário — evita
  // sobrescrever os dados salvos com valores default/env durante a inicialização.
  if (!state._settingsLoaded) return;
  syncSettingsToSupabase(userId, {
    providers: state.providers,
    agentDefaults: state.agentDefaults,
    supervisionMode: state.supervisionMode,
    claudeEffort: state.claudeEffort,
    maxParallelAgents: state.maxParallelAgents,
    autoFastModel: state.autoFastModel,
    theme: state.theme,
  }).catch(() => {
    console.warn("[settings-store] Falha ao sincronizar settings com Supabase");
  });
}

export const useSettingsStore = create<SettingsState>()(
  devtools(
    (set, get) => ({
      _settingsLoaded: false,
      providers: createDefaultProviders(),
      agentDefaults: createDefaultAgentDefaults(),
      supervisionMode: SupervisionMode.Watch,
      claudeEffort: "high" as ClaudeEffort,
      maxParallelAgents: 4,
      autoFastModel: false,
      theme: "dark" as const,

      setProviderSettings: (provider, settings) => {
        set(
          (state) => ({
            providers: {
              ...state.providers,
              [provider]: { ...state.providers[provider], ...settings },
            },
          }),
          false,
          "setProviderSettings",
        );
        scheduleSync();
      },

      setAgentDefault: (role, provider, model, effort?) => {
        set(
          (state) => ({
            agentDefaults: {
              ...state.agentDefaults,
              [role]: { provider, model, effort: effort ?? state.agentDefaults[role]?.effort ?? "high" },
            },
          }),
          false,
          "setAgentDefault",
        );
        scheduleSync();
      },

      setSupervisionMode: (mode) => {
        set({ supervisionMode: mode }, false, "setSupervisionMode");
        scheduleSync();
      },

      setClaudeEffort: (effort) => {
        set({ claudeEffort: effort }, false, "setClaudeEffort");
        scheduleSync();
      },

      setMaxParallelAgents: (count) => {
        set({ maxParallelAgents: Math.max(1, Math.min(10, count)) }, false, "setMaxParallelAgents");
        scheduleSync();
      },

      setAutoFastModel: (enabled) => {
        set({ autoFastModel: enabled }, false, "setAutoFastModel");
        scheduleSync();
      },

      isProviderConfigured: (provider) => {
        const p = get().providers[provider];
        if (!p.enabled) return false;
        if (provider === "ollama" || provider === "lm-studio") return true;
        return p.apiKey.length > 0;
      },

      getConfiguredProviders: () => {
        const state = get();
        const allProviders: LLMProvider[] = ["claude-code", "openai", "gemini", "ollama", "lm-studio"];
        return allProviders.filter((p) => state.isProviderConfigured(p));
      },

      loadSettings: async (userId) => {
        const remote = await loadSettingsFromSupabase(userId);
        if (remote) {
          set(
            {
              providers: remote.providers,
              agentDefaults: remote.agentDefaults,
              supervisionMode: remote.supervisionMode,
              claudeEffort: remote.claudeEffort,
              maxParallelAgents: remote.maxParallelAgents,
              autoFastModel: remote.autoFastModel,
              theme: remote.theme,
              _settingsLoaded: true,
            },
            false,
            "loadSettings",
          );
        } else {
          // Mesmo sem dados remotos, marcar como carregado para permitir sync futuro
          set({ _settingsLoaded: true }, false, "loadSettings/noRemote");
        }
      },
    }),
    { name: "ForgeAI-Settings" },
  ),
);
