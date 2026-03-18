/**
 * Componente raiz do ForgeAI.
 * Fluxo: Login -> Escritório (configurações via engrenagem).
 */
import { useState, useEffect, useCallback } from "react";
import { StatusBar } from "@/components/ui/StatusBar";
import { OfficeCanvas } from "@/components/office/OfficeCanvas";
import { ChatPanel } from "@/components/chat/ChatPanel";
import { SettingsModal } from "@/components/ui/SettingsModal";
import { ProjectModal } from "@/components/project/ProjectModal";
import { LoginPage } from "@/components/auth/LoginPage";
import { AgentListModal } from "@/components/agents/AgentListModal";
import { ProjectProgressBar } from "@/components/ui/ProjectProgressBar";
import { useSettingsStore } from "@/stores/settings-store";
import { useAppStore } from "@/stores/app-store";
import { useAuthStore } from "@/stores/auth-store";
import { useProjectStore } from "@/stores/project-store";
import { useMemoryStore } from "@/stores/memory-store";
import { useProjects } from "@/hooks/useProjects";
import { getSupabaseClient } from "@/services/supabase/safe-client";
import { llmGateway } from "@/services/llm/llm-gateway";
import { ClaudeProvider } from "@/services/llm/providers/claude-provider";
import { OpenAIProvider } from "@/services/llm/providers/openai-provider";
import { OllamaProvider } from "@/services/llm/providers/ollama-provider";
import { GeminiProvider } from "@/services/llm/providers/gemini-provider";
import { LMStudioProvider } from "@/services/llm/providers/lmstudio-provider";
import type { LLMProvider } from "@/types/agents";

/**
 * Configura o LLM Gateway com os providers e settings do store.
 */
function configureLLMGateway(): void {
  const state = useSettingsStore.getState();

  // Registra/atualiza providers com base nas settings atuais.
  // Usa registerProvider que faz upsert (mesmo key sobrescreve).
  const allProviders: LLMProvider[] = [
    "claude-code",
    "openai",
    "gemini",
    "ollama",
    "lm-studio",
  ];

  for (const p of allProviders) {
    const settings = state.providers[p];
    const hasKey = settings.apiKey.length > 0;
    const shouldRegister = settings.enabled || hasKey;

    console.log(`[LLM Gateway] ${p}: enabled=${settings.enabled}, hasKey=${hasKey}, register=${shouldRegister}`);

    if (!shouldRegister) {
      llmGateway.unregisterProvider(p);
      continue;
    }

    switch (p) {
      case "claude-code": {
        llmGateway.registerProvider(new ClaudeProvider({
          apiKey: settings.apiKey,
          baseUrl: settings.baseUrl,
        }));
        break;
      }
      case "openai": {
        llmGateway.registerProvider(new OpenAIProvider({
          apiKey: settings.apiKey,
          baseUrl: settings.baseUrl,
        }));
        break;
      }
      case "gemini": {
        llmGateway.registerProvider(new GeminiProvider({
          apiKey: settings.apiKey,
        }));
        break;
      }
      case "ollama": {
        llmGateway.registerProvider(new OllamaProvider({
          baseUrl: settings.baseUrl,
        }));
        break;
      }
      case "lm-studio": {
        llmGateway.registerProvider(new LMStudioProvider({
          baseUrl: settings.baseUrl,
        }));
        break;
      }
    }
  }

  for (const [role, config] of Object.entries(state.agentDefaults)) {
    llmGateway.setAgentConfig(role, config.provider, config.model);
  }
}

function App() {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [projectModalOpen, setProjectModalOpen] = useState(false);
  const [agentListOpen, setAgentListOpen] = useState(false);
  const [totalCost, setTotalCost] = useState("$0.00");
  const [sessionChecked, setSessionChecked] = useState(false);

  const isAuthenticated = useAppStore((s) => s.isAuthenticated);
  const setAuthenticated = useAppStore((s) => s.setAuthenticated);
  const logout = useAppStore((s) => s.logout);

  const activeProjectId = useProjectStore((s) => s.activeProjectId);
  const { load: loadProjects } = useProjects();


  // Verificar sessao Supabase ao montar
  useEffect(() => {
    const supabase = getSupabaseClient();
    if (!supabase) {
      setSessionChecked(true);
      return;
    }

    void supabase.auth.getSession().then(({ data }) => {
      if (data.session?.user) {
        setAuthenticated(
          data.session.user.id,
          data.session.user.email ?? "",
        );
      }
      setSessionChecked(true);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        if (session?.user) {
          setAuthenticated(
            session.user.id,
            session.user.email ?? "",
          );
        } else if (_event === "SIGNED_OUT") {
          logout();
        }
      },
    );

    return () => {
      subscription.unsubscribe();
    };
  }, [setAuthenticated, logout]);

  // Carrega dados do Supabase quando autenticado
  useEffect(() => {
    if (!isAuthenticated) return;
    const userId = useAppStore.getState().userId;

    loadProjects().catch(() => {
      console.warn("[App] Falha ao carregar projetos do Supabase");
    });

    if (userId) {
      useSettingsStore.getState().loadSettings(userId).catch(() => {
        console.warn("[App] Falha ao carregar settings do Supabase");
      });
      useAuthStore.getState().loadGitHub(userId).catch(() => {
        console.warn("[App] Falha ao carregar GitHub do Supabase");
      });
    }
  }, [isAuthenticated]);

  // Carrega memórias quando o projeto ativo muda
  useEffect(() => {
    if (activeProjectId) {
      useMemoryStore.getState().loadMemories(activeProjectId).catch(() => {
        console.warn("[App] Falha ao carregar memórias do Supabase");
      });
    }
  }, [activeProjectId]);

  // Auto-detecta API keys do ambiente
  useEffect(() => {
    const state = useSettingsStore.getState();

    const envAnthropicKey = import.meta.env.ANTHROPIC_API_KEY as string;
    if (!state.providers["claude-code"].apiKey && envAnthropicKey) {
      state.setProviderSettings("claude-code", {
        apiKey: envAnthropicKey,
        enabled: true,
      });
    }

    const envOpenaiKey = import.meta.env.OPENAI_API_KEY as string;
    if (!state.providers.openai.apiKey && envOpenaiKey) {
      state.setProviderSettings("openai", {
        apiKey: envOpenaiKey,
        enabled: true,
      });
    }

    const envGeminiKey = import.meta.env.GEMINI_API_KEY as string;
    if (!state.providers.gemini.apiKey && envGeminiKey) {
      state.setProviderSettings("gemini", {
        apiKey: envGeminiKey,
        enabled: true,
      });
    }
  }, []);

  // Inicializa LLM Gateway
  useEffect(() => {
    configureLLMGateway();
    const unsubscribe = useSettingsStore.subscribe(() => {
      configureLLMGateway();
    });
    return unsubscribe;
  }, []);

  // Atualiza custo total
  useEffect(() => {
    const interval = setInterval(() => {
      const cost = llmGateway.getTotalCost();
      setTotalCost(`$${cost.toFixed(2)}`);
    }, 2000);
    return () => clearInterval(interval);
  }, []);

  const handleOpenSettings = useCallback(() => {
    setSettingsOpen(true);
  }, []);

  const handleCloseSettings = useCallback(() => {
    setSettingsOpen(false);
  }, []);

  const handleOpenProjectModal = useCallback(() => {
    setProjectModalOpen(true);
  }, []);

  const handleCloseProjectModal = useCallback(() => {
    setProjectModalOpen(false);
  }, []);

  const handleOpenAgentList = useCallback(() => {
    setAgentListOpen(true);
  }, []);

  const handleCloseAgentList = useCallback(() => {
    setAgentListOpen(false);
  }, []);

  // Aguarda verificacao de sessao
  if (!sessionChecked) {
    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          height: "100vh",
          width: "100vw",
          background: "#080c14",
          fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
          color: "#475569",
          fontSize: 14,
        }}
      >
        Carregando...
      </div>
    );
  }

  // Se nao autenticado, mostra login
  if (!isAuthenticated) {
    return <LoginPage />;
  }

  // Escritorio
  return (
    <div
      style={{
        display: "flex",
        height: "100vh",
        width: "100vw",
        flexDirection: "column",
        overflow: "hidden",
        background: "#080c14",
        fontFamily: "'JetBrains Mono', 'SF Mono', 'Fira Code', monospace",
        color: "#e2e8f0",
      }}
    >
      <StatusBar
        totalCost={totalCost}
        onOpenSettings={handleOpenSettings}
        onOpenProjects={handleOpenProjectModal}
        onOpenAgents={handleOpenAgentList}
      />

      <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>
        <OfficeCanvas />
        <ChatPanel />
      </div>

      <ProjectProgressBar />

      <SettingsModal isOpen={settingsOpen} onClose={handleCloseSettings} />


      {/* Modal de lista de agentes — abre pelo botão na StatusBar */}
      <AgentListModal isOpen={agentListOpen} onClose={handleCloseAgentList} />

      {/* Modal de projetos — abre pelo botão na StatusBar */}
      <ProjectModal
        isOpen={projectModalOpen}
        onClose={handleCloseProjectModal}
      />
    </div>
  );
}

export default App;
