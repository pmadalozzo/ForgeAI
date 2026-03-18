/**
 * SettingsModal — Modal de configuracoes de LLM, autenticacao e agentes do ForgeAI.
 * Permite configurar providers, autenticar GitHub, atribuir modelos a agentes e definir modo de supervisao.
 */
import { useState, useEffect, useCallback, useRef } from "react";
import {
  useSettingsStore,
  MODELS_BY_PROVIDER,
  PROVIDER_DISPLAY_NAMES,
  EFFORT_LABELS,
} from "@/stores/settings-store";
import type { LLMProviderSettings, ClaudeEffort } from "@/stores/settings-store";
import { useAuthStore } from "@/stores/auth-store";
import { SupervisionMode } from "@/types/agents";
import type { LLMProvider } from "@/types/agents";
import { llmGateway } from "@/services/llm/llm-gateway";
import type { LLMRequest } from "@/services/llm/llm-gateway";
import {
  startDeviceFlow,
  pollDeviceFlow,
  validateToken,
  GITHUB_NEW_TOKEN_URL,
} from "@/services/auth/github-auth";
import type { DeviceFlowResponse } from "@/services/auth/github-auth";

// --- Constants ---

const ALL_PROVIDERS: LLMProvider[] = [
  "claude-code",
  "openai",
  "gemini",
  "ollama",
  "lm-studio",
];


const SUPERVISION_LABELS: Record<SupervisionMode, { label: string; description: string }> = {
  [SupervisionMode.Autopilot]: {
    label: "Autopilot",
    description: "Agentes executam sem interrupcao",
  },
  [SupervisionMode.Approve]: {
    label: "Aprovar",
    description: "Pausar em cada quality gate para aprovacao",
  },
  [SupervisionMode.Watch]: {
    label: "Observar",
    description: "Execucao continua com streaming de logs",
  },
  [SupervisionMode.Pair]: {
    label: "Pair",
    description: "Trabalhar junto com um agente especifico",
  },
};

type ConnectionStatus = "idle" | "testing" | "success" | "error";

const TABS = ["providers", "auth", "supervision"] as const;
type Tab = (typeof TABS)[number];

const TAB_LABELS: Record<Tab, string> = {
  providers: "Providers",
  auth: "Autenticacao",
  supervision: "Supervisao",
};

// --- Sub-components ---

interface ProviderCardProps {
  provider: LLMProvider;
  settings: LLMProviderSettings;
  connectionStatus: ConnectionStatus;
  connectionMessage: string | null;
  onUpdate: (settings: Partial<LLMProviderSettings>) => void;
  onTestConnection: () => void;
}

function ProviderCard({
  provider,
  settings,
  connectionStatus,
  connectionMessage,
  onUpdate,
  onTestConnection,
}: ProviderCardProps) {
  const [showKey, setShowKey] = useState(false);
  const isLocal = provider === "ollama" || provider === "lm-studio";

  const statusDot = (): { color: string; label: string } => {
    if (!settings.enabled) return { color: "#475569", label: "Desabilitado" };
    switch (connectionStatus) {
      case "testing":
        return { color: "#EAB308", label: "Testando..." };
      case "success":
        return { color: "#10B981", label: connectionMessage ?? "Conectado" };
      case "error":
        return { color: "#EF4444", label: connectionMessage ?? "Erro" };
      default:
        if (isLocal || settings.apiKey.length > 0) {
          return { color: "#3B82F6", label: "Configurado" };
        }
        return { color: "#F97316", label: "Sem API Key" };
    }
  };

  const status = statusDot();

  return (
    <div
      style={{
        background: "#0f172a",
        border: `1px solid ${settings.enabled ? "#334155" : "#1e293b"}`,
        borderRadius: 8,
        padding: 16,
        marginBottom: 12,
        opacity: settings.enabled ? 1 : 0.6,
        transition: "opacity 0.2s, border-color 0.2s",
      }}
    >
      {/* Header */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 12,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span
            style={{
              width: 8,
              height: 8,
              borderRadius: "50%",
              background: status.color,
              display: "inline-block",
              flexShrink: 0,
            }}
          />
          <span style={{ fontSize: 14, fontWeight: 700, color: "#e2e8f0" }}>
            {PROVIDER_DISPLAY_NAMES[provider]}
          </span>
          <span style={{ fontSize: 11, color: "#64748b", maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {status.label}
          </span>
        </div>

        {/* Toggle */}
        <button
          type="button"
          onClick={() => onUpdate({ enabled: !settings.enabled })}
          style={{
            width: 36,
            height: 20,
            borderRadius: 10,
            border: "none",
            background: settings.enabled ? "#3B82F6" : "#334155",
            cursor: "pointer",
            position: "relative",
            transition: "background 0.2s",
          }}
        >
          <span
            style={{
              width: 16,
              height: 16,
              borderRadius: "50%",
              background: "#e2e8f0",
              position: "absolute",
              top: 2,
              left: settings.enabled ? 18 : 2,
              transition: "left 0.2s",
            }}
          />
        </button>
      </div>

      {/* Claude: autenticação sempre visível (não depende do toggle) */}
      {provider === "claude-code" && (
        <ClaudeAuthInline settings={settings} onUpdate={onUpdate} />
      )}

      {settings.enabled && (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {/* API Key — campo manual para providers não-locais e não-Claude */}
          {!isLocal && provider !== "claude-code" && (
            <div>
              <label style={labelStyle}>API Key</label>
              <div style={{ display: "flex", gap: 6 }}>
                <input
                  type={showKey ? "text" : "password"}
                  value={settings.apiKey}
                  onChange={(e) => onUpdate({ apiKey: e.target.value })}
                  placeholder="sk-..."
                  style={{ ...inputStyle, flex: 1 }}
                  autoComplete="off"
                />
                <button
                  type="button"
                  onClick={() => setShowKey(!showKey)}
                  style={smallBtnStyle}
                >
                  {showKey ? "\uD83D\uDE48" : "\uD83D\uDC41\uFE0F"}
                </button>
              </div>
            </div>
          )}

          {/* Base URL */}
          <div>
            <label style={labelStyle}>Base URL</label>
            <input
              type="text"
              value={settings.baseUrl}
              onChange={(e) => onUpdate({ baseUrl: e.target.value })}
              style={inputStyle}
              autoComplete="off"
            />
          </div>

          {/* Default Model */}
          <div>
            <label style={labelStyle}>Modelo padrao</label>
            <select
              value={settings.defaultModel}
              onChange={(e) => onUpdate({ defaultModel: e.target.value })}
              style={selectStyle}
            >
              {MODELS_BY_PROVIDER[provider].map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </div>

          {/* Test Connection */}
          <button
            type="button"
            onClick={onTestConnection}
            disabled={connectionStatus === "testing"}
            style={{
              ...smallBtnStyle,
              width: "100%",
              padding: "6px 12px",
              fontSize: 12,
              background:
                connectionStatus === "testing"
                  ? "#1e293b"
                  : connectionStatus === "success"
                    ? "#064e3b"
                    : connectionStatus === "error"
                      ? "#7f1d1d"
                      : "#1e293b",
              color:
                connectionStatus === "success"
                  ? "#10B981"
                  : connectionStatus === "error"
                    ? "#EF4444"
                    : "#94a3b8",
            }}
          >
            {connectionStatus === "testing"
              ? "Testando..."
              : connectionStatus === "success"
                ? (connectionMessage ?? "Conexao OK")
                : connectionStatus === "error"
                  ? (connectionMessage ?? "Falha -- Tentar novamente")
                  : "Testar Conexao"}
          </button>
        </div>
      )}
    </div>
  );
}

// --- Auth Tab sub-components ---

function GitHubAuthSection() {
  const github = useAuthStore((s) => s.github);
  const setGitHubToken = useAuthStore((s) => s.setGitHubToken);
  const clearGitHub = useAuthStore((s) => s.clearGitHub);

  const [deviceFlow, setDeviceFlow] = useState<DeviceFlowResponse | null>(null);
  const [flowStatus, setFlowStatus] = useState<"idle" | "waiting" | "success" | "error" | "expired">("idle");
  const [flowError, setFlowError] = useState("");
  const [showPatFallback, setShowPatFallback] = useState(false);
  const [patInput, setPatInput] = useState("");
  const [showPat, setShowPat] = useState(false);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, []);

  /** Autenticar via Device Flow (abre navegador) */
  const handleDeviceFlow = useCallback(async () => {
    const clientId = import.meta.env.GITHUB_CLIENT_ID || import.meta.env.VITE_GITHUB_CLIENT_ID;

    if (!clientId) {
      // Sem client_id — abre criação de PAT e mostra campo
      window.open(GITHUB_NEW_TOKEN_URL, "_blank", "noopener");
      setShowPatFallback(true);
      setFlowStatus("idle");
      setFlowError("");
      return;
    }

    setFlowStatus("waiting");
    setFlowError("");

    const flow = await startDeviceFlow(clientId);
    if (!flow) {
      window.open(GITHUB_NEW_TOKEN_URL, "_blank", "noopener");
      setShowPatFallback(true);
      setFlowStatus("error");
      setFlowError("Device Flow indisponível. Cole o token abaixo.");
      return;
    }

    setDeviceFlow(flow);
    window.open(flow.verification_uri, "_blank", "noopener");

    if (pollingRef.current) clearInterval(pollingRef.current);
    const interval = (flow.interval || 5) * 1000;

    pollingRef.current = setInterval(async () => {
      const result = await pollDeviceFlow(clientId, flow.device_code);

      if (result.status === "success") {
        if (pollingRef.current) clearInterval(pollingRef.current);
        pollingRef.current = null;
        const validation = await validateToken(result.token);
        if (validation.valid && validation.username) {
          setGitHubToken(result.token, validation.username, validation.avatarUrl ?? "");
          setFlowStatus("success");
        } else {
          setFlowStatus("error");
          setFlowError("Token obtido mas falha na validação.");
        }
      } else if (result.status === "expired") {
        if (pollingRef.current) clearInterval(pollingRef.current);
        pollingRef.current = null;
        setFlowStatus("expired");
      } else if (result.status === "error") {
        if (pollingRef.current) clearInterval(pollingRef.current);
        pollingRef.current = null;
        setFlowStatus("error");
        setFlowError(result.message);
      }
    }, interval);
  }, [setGitHubToken]);

  /** Validar PAT manualmente */
  const handleValidatePat = useCallback(async () => {
    if (!patInput.trim()) return;
    setFlowStatus("waiting");
    const result = await validateToken(patInput.trim());
    if (result.valid && result.username) {
      setGitHubToken(patInput.trim(), result.username, result.avatarUrl ?? "");
      setFlowStatus("success");
      setPatInput("");
    } else {
      setFlowStatus("error");
      setFlowError(result.error ?? "Token inválido");
    }
  }, [patInput, setGitHubToken]);

  // Já autenticado
  if (github.isAuthenticated) {
    return (
      <div
        style={{
          background: "#0f172a",
          border: "1px solid #10B98133",
          borderRadius: 10,
          padding: 16,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          {github.avatarUrl && (
            <img
              src={github.avatarUrl}
              alt={github.username ?? "avatar"}
              style={{ width: 40, height: 40, borderRadius: "50%", border: "2px solid #334155" }}
            />
          )}
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: "#e2e8f0" }}>
              {github.username}
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 2 }}>
              <span
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: "50%",
                  background: "#10B981",
                  display: "inline-block",
                }}
              />
              <span style={{ fontSize: 12, color: "#10B981" }}>Conectado</span>
            </div>
          </div>
          <button
            type="button"
            onClick={clearGitHub}
            style={{
              ...smallBtnStyle,
              color: "#EF4444",
              borderColor: "#EF444433",
              fontSize: 12,
            }}
            onMouseEnter={(e) => { e.currentTarget.style.borderColor = "#EF4444"; }}
            onMouseLeave={(e) => { e.currentTarget.style.borderColor = "#EF444433"; }}
          >
            Desconectar
          </button>
        </div>
      </div>
    );
  }

  // Não autenticado
  return (
    <div
      style={{
        background: "#0f172a",
        border: "1px solid #334155",
        borderRadius: 10,
        padding: 16,
        display: "flex",
        flexDirection: "column",
        gap: 10,
      }}
    >
      {/* Botão principal: abre navegador */}
      <button
        type="button"
        onClick={() => void handleDeviceFlow()}
        disabled={flowStatus === "waiting"}
        style={{
          width: "100%",
          padding: "12px 16px",
          fontSize: 13,
          fontWeight: 700,
          fontFamily: "inherit",
          color: "#fff",
          background: flowStatus === "waiting"
            ? "#334155"
            : "linear-gradient(135deg, #1e3a5f, #334155)",
          border: "none",
          borderRadius: 8,
          cursor: flowStatus === "waiting" ? "wait" : "pointer",
          transition: "opacity 0.2s",
          letterSpacing: 0.3,
        }}
        onMouseEnter={(e) => { if (flowStatus !== "waiting") e.currentTarget.style.opacity = "0.85"; }}
        onMouseLeave={(e) => { e.currentTarget.style.opacity = "1"; }}
      >
        {flowStatus === "waiting" ? "Aguardando autorização no navegador..." : "Autenticar com GitHub"}
      </button>

      {/* Código do Device Flow */}
      {deviceFlow && flowStatus === "waiting" && (
        <div
          style={{
            background: "#1e293b",
            border: "1px solid #334155",
            borderRadius: 10,
            padding: 16,
            textAlign: "center",
          }}
        >
          <p style={{ fontSize: 12, color: "#94a3b8", margin: "0 0 8px 0" }}>
            Digite este código em <strong>github.com/login/device</strong>:
          </p>
          <div
            style={{
              fontSize: 28,
              fontWeight: 800,
              letterSpacing: 6,
              color: "#3B82F6",
              fontFamily: "'JetBrains Mono', monospace",
              padding: "8px 0",
              userSelect: "all",
            }}
          >
            {deviceFlow.user_code}
          </div>
          <p style={{ fontSize: 11, color: "#475569", margin: "8px 0 0 0" }}>
            A página já foi aberta. Aguardando autorização...
          </p>
        </div>
      )}

      {/* Status */}
      {flowStatus === "success" && (
        <p style={{ fontSize: 12, color: "#10B981", margin: 0 }}>Autenticado com sucesso!</p>
      )}
      {flowStatus === "expired" && (
        <p style={{ fontSize: 12, color: "#EAB308", margin: 0 }}>Código expirado. Clique novamente.</p>
      )}
      {flowStatus === "error" && flowError && (
        <p style={{ fontSize: 12, color: "#EF4444", margin: 0 }}>{flowError}</p>
      )}

      {/* Fallback PAT */}
      <button
        type="button"
        onClick={() => setShowPatFallback(!showPatFallback)}
        style={{
          background: "none",
          border: "none",
          color: "#475569",
          fontSize: 11,
          cursor: "pointer",
          fontFamily: "inherit",
          padding: 0,
          textDecoration: "underline",
          textAlign: "left",
        }}
      >
        {showPatFallback ? "Ocultar campo de token" : "Ou use um Personal Access Token (PAT)"}
      </button>

      {showPatFallback && (
        <div>
          <div style={{ display: "flex", gap: 6 }}>
            <input
              type={showPat ? "text" : "password"}
              value={patInput}
              onChange={(e) => setPatInput(e.target.value)}
              placeholder="ghp_..."
              style={{ ...inputStyle, flex: 1 }}
              autoComplete="off"
            />
            <button type="button" onClick={() => setShowPat(!showPat)} style={smallBtnStyle}>
              {showPat ? "\uD83D\uDE48" : "\uD83D\uDC41\uFE0F"}
            </button>
            <button
              type="button"
              onClick={() => void handleValidatePat()}
              disabled={!patInput.trim()}
              style={{
                ...smallBtnStyle,
                padding: "6px 12px",
                color: patInput.trim() ? "#e2e8f0" : "#475569",
                cursor: patInput.trim() ? "pointer" : "not-allowed",
              }}
            >
              Validar
            </button>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4 }}>
            <span style={{ fontSize: 10, color: "#475569" }}>Escopo necessário: repo</span>
            <a
              href={GITHUB_NEW_TOKEN_URL}
              target="_blank"
              rel="noopener noreferrer"
              style={{ fontSize: 10, color: "#3B82F6", textDecoration: "none" }}
            >
              Criar token
            </a>
          </div>
        </div>
      )}
    </div>
  );
}

/** Seletor de nível de esforço do Claude Code CLI */
function EffortSelector() {
  const claudeEffort = useSettingsStore((s) => s.claudeEffort);
  const setClaudeEffort = useSettingsStore((s) => s.setClaudeEffort);

  const levels: Array<{ value: ClaudeEffort; label: string; color: string }> = [
    { value: "low", label: "Low", color: "#64748b" },
    { value: "medium", label: "Medium", color: "#EAB308" },
    { value: "high", label: "High", color: "#3B82F6" },
    { value: "max", label: "Max", color: "#10B981" },
  ];

  return (
    <div>
      <div style={{ fontSize: 10, color: "#64748b", marginBottom: 6, textTransform: "uppercase", letterSpacing: 1, fontWeight: 600 }}>
        Nível de Esforço
      </div>
      <div style={{ display: "flex", gap: 4 }}>
        {levels.map((l) => (
          <button
            key={l.value}
            type="button"
            onClick={() => setClaudeEffort(l.value)}
            style={{
              flex: 1,
              padding: "6px 0",
              fontSize: 11,
              fontWeight: 600,
              fontFamily: "inherit",
              cursor: "pointer",
              borderRadius: 6,
              border: claudeEffort === l.value ? `1px solid ${l.color}` : "1px solid #334155",
              background: claudeEffort === l.value ? `${l.color}18` : "#1e293b",
              color: claudeEffort === l.value ? l.color : "#64748b",
              transition: "all 0.15s",
            }}
          >
            {l.label}
          </button>
        ))}
      </div>
      <div style={{ fontSize: 10, color: "#475569", marginTop: 4 }}>
        {EFFORT_LABELS[claudeEffort].description}
      </div>
    </div>
  );
}

interface ClaudeAuthInlineProps {
  settings: LLMProviderSettings;
  onUpdate: (settings: Partial<LLMProviderSettings>) => void;
}

function ClaudeAuthInline({ settings, onUpdate }: ClaudeAuthInlineProps) {
  type AuthStep = "idle" | "checking" | "installing" | "authenticating" | "connected" | "error";
  const [step, setStep] = useState<AuthStep>(
    settings.enabled ? "connected" : "idle"
  );
  const [message, setMessage] = useState<string | null>(null);
  const [cliInstalled, setCliInstalled] = useState<boolean | null>(null);
  const [cliVersion, setCliVersion] = useState<string | null>(null);

  const isConnected = settings.enabled;

  // Verifica status do CLI ao montar
  useEffect(() => {
    void checkCli();
  }, []);

  /** Verifica se o Claude CLI está instalado via endpoint local */
  async function checkCli(): Promise<boolean> {
    try {
      const res = await fetch("/api/claude/version");
      const data = await res.json() as { installed: boolean; version: string | null };
      if (data.installed && data.version) {
        setCliInstalled(true);
        setCliVersion(data.version);
        return true;
      }
      setCliInstalled(false);
      return false;
    } catch {
      setCliInstalled(false);
      return false;
    }
  }

  /** Instala o Claude Code CLI via endpoint local */
  async function installCli(): Promise<boolean> {
    setStep("installing");
    setMessage("Instalando Claude Code CLI...");

    try {
      const res = await fetch("/api/claude/install", { method: "POST" });
      const data = await res.json() as { success: boolean; message: string };
      if (data.success) {
        setCliInstalled(true);
        setMessage(data.message);
        return true;
      }
      setStep("error");
      setMessage(data.message);
      return false;
    } catch (err) {
      setStep("error");
      setMessage(`Erro ao instalar: ${err instanceof Error ? err.message : String(err)}`);
      return false;
    }
  }

  /** Fluxo principal: verifica CLI → instala se necessário → verifica auth → conecta */
  const handleConnect = useCallback(async () => {
    setStep("checking");
    setMessage("Verificando Claude Code CLI...");

    let installed = await checkCli();

    if (!installed) {
      installed = await installCli();
      if (!installed) return;
    }

    setStep("authenticating");
    setMessage("Verificando autenticação...");

    try {
      const res = await fetch("/api/claude/execute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ args: ["-p", "responda apenas: ok", "--output-format", "json", "--no-session-persistence"] }),
      });
      const result = await res.json() as { success: boolean; stdout: string; stderr: string };

      if (result.success) {
        onUpdate({ enabled: true, apiKey: "claude-cli-connected" });
        setStep("connected");
        setMessage("Conectado via Claude Code CLI");
        return;
      }

      setStep("error");
      setMessage(
        "Claude Code CLI instalado mas não autenticado. Abra um terminal e execute 'claude' para fazer login."
      );
    } catch (err) {
      setStep("error");
      setMessage(`Erro: ${err instanceof Error ? err.message : String(err)}`);
    }
  }, [onUpdate]);

  /** Desconectar */
  const handleDisconnect = useCallback(() => {
    onUpdate({ apiKey: "", enabled: false });
    setStep("idle");
    setMessage(null);
  }, [onUpdate]);

  /** Testar conexão via endpoint local */
  const handleTest = useCallback(async () => {
    setStep("checking");
    setMessage("Testando conexão... (pode levar até 30s)");

    try {
      const res = await fetch("/api/claude/execute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ args: ["-p", "responda apenas: OK", "--output-format", "json", "--model", settings.defaultModel, "--no-session-persistence", "--effort", "low"] }),
        signal: AbortSignal.timeout(60_000),
      });
      const result = await res.json() as { success: boolean; stdout: string; stderr: string; exitCode: number };

      if (result.success) {
        setStep("connected");
        setMessage(`Conectado — ${settings.defaultModel}`);
      } else {
        setStep("error");
        setMessage(`Erro (código ${result.exitCode}): ${result.stderr || result.stdout}`);
      }
    } catch (err: unknown) {
      setStep("error");
      const msg = err instanceof Error ? err.message : String(err);
      setMessage(msg.includes("abort") ? "Timeout — o CLI demorou demais. Tente novamente." : `Erro: ${msg}`);
    }
  }, [settings.defaultModel]);

  const isBusy = step === "checking" || step === "installing" || step === "authenticating";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10, position: "relative" }}>
      {/* Overlay de loading */}
      {isBusy && (
        <div style={{
          position: "absolute",
          inset: 0,
          zIndex: 10,
          background: "rgba(12, 19, 34, 0.85)",
          borderRadius: 8,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 12,
        }}>
          <div style={{
            width: 28,
            height: 28,
            border: "3px solid #334155",
            borderTopColor: "#D97706",
            borderRadius: "50%",
            animation: "forgeai-spin 0.8s linear infinite",
          }} />
          <div style={{ fontSize: 12, color: "#e2e8f0", fontWeight: 600 }}>
            {step === "checking" && "Verificando..."}
            {step === "installing" && "Instalando Claude Code..."}
            {step === "authenticating" && "Autenticando..."}
          </div>
          {message && (
            <div style={{ fontSize: 11, color: "#64748b" }}>{message}</div>
          )}
          <style>{`@keyframes forgeai-spin { to { transform: rotate(360deg); } }`}</style>
        </div>
      )}

      {/* Estado: Conectado */}
      {isConnected && (
        <>
          <div
            style={{
              background: "#064e3b22",
              border: "1px solid #10B98133",
              borderRadius: 8,
              padding: "10px 14px",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <div>
              <div style={{ fontSize: 12, color: "#10B981", fontWeight: 600 }}>
                Claude Code CLI conectado
              </div>
              {cliVersion && (
                <div style={{ fontSize: 10, color: "#64748b", marginTop: 2 }}>
                  {cliVersion}
                </div>
              )}
            </div>
            <button
              type="button"
              onClick={handleDisconnect}
              style={{
                ...smallBtnStyle,
                color: "#EF4444",
                borderColor: "#EF444433",
                fontSize: 11,
                padding: "4px 10px",
              }}
              onMouseEnter={(e) => { e.currentTarget.style.borderColor = "#EF4444"; }}
              onMouseLeave={(e) => { e.currentTarget.style.borderColor = "#EF444433"; }}
            >
              Desconectar
            </button>
          </div>

          {message && (
            <div
              style={{
                fontSize: 12,
                color: step === "connected" ? "#10B981" : "#EF4444",
                padding: "6px 10px",
                background: step === "connected" ? "#064e3b22" : "#7f1d1d22",
                borderRadius: 6,
              }}
            >
              {message}
            </div>
          )}

          <button
            type="button"
            onClick={() => void handleTest()}
            disabled={step === "checking"}
            style={{
              ...smallBtnStyle,
              width: "100%",
              padding: "8px 12px",
              fontSize: 12,
              background: "#1e293b",
            }}
          >
            {step === "checking" ? "Testando..." : "Testar Conexão"}
          </button>

          {/* Effort selector */}
          <EffortSelector />
        </>
      )}

      {/* Estado: Não conectado */}
      {!isConnected && (
        <>
          <button
            type="button"
            onClick={() => void handleConnect()}
            disabled={step === "checking" || step === "installing" || step === "authenticating"}
            style={{
              width: "100%",
              padding: "12px 16px",
              fontSize: 13,
              fontWeight: 700,
              fontFamily: "inherit",
              color: "#fff",
              background: "linear-gradient(135deg, #D97706, #B45309)",
              border: "none",
              borderRadius: 8,
              cursor: step === "checking" || step === "installing" ? "wait" : "pointer",
              transition: "opacity 0.2s",
              letterSpacing: 0.3,
            }}
            onMouseEnter={(e) => { e.currentTarget.style.opacity = "0.85"; }}
            onMouseLeave={(e) => { e.currentTarget.style.opacity = "1"; }}
          >
            {step === "checking" && "Verificando..."}
            {step === "installing" && "Instalando Claude Code..."}
            {step === "authenticating" && "Autenticando..."}
            {(step === "idle" || step === "error") && "Conectar Claude Code"}
          </button>

          {/* Info sobre o CLI */}
          <div style={{ fontSize: 11, color: "#475569", lineHeight: 1.6 }}>
            {cliInstalled === null && "Clique para detectar e conectar automaticamente."}
            {cliInstalled === true && (
              <span style={{ color: "#10B981" }}>Claude Code CLI detectado {cliVersion && `(${cliVersion})`}</span>
            )}
            {cliInstalled === false && (
              <span>Claude Code CLI não encontrado — será instalado automaticamente.</span>
            )}
          </div>

          {/* Mensagem de erro/status */}
          {message && step === "error" && (
            <div
              style={{
                fontSize: 12,
                color: "#EF4444",
                padding: "8px 12px",
                background: "#7f1d1d22",
                borderRadius: 6,
                lineHeight: 1.5,
              }}
            >
              {message}
            </div>
          )}

          {message && step !== "error" && step !== "idle" && (
            <div
              style={{
                fontSize: 12,
                color: "#D97706",
                padding: "8px 12px",
                background: "#78350f22",
                borderRadius: 6,
                lineHeight: 1.5,
              }}
            >
              {message}
            </div>
          )}
        </>
      )}
    </div>
  );
}

// --- Styles ---

const labelStyle: React.CSSProperties = {
  display: "block",
  fontSize: 11,
  color: "#64748b",
  marginBottom: 4,
  fontFamily: "inherit",
  textTransform: "uppercase",
  letterSpacing: 1,
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  background: "#1e293b",
  border: "1px solid #334155",
  borderRadius: 6,
  padding: "6px 10px",
  color: "#e2e8f0",
  fontSize: 13,
  fontFamily: "inherit",
  outline: "none",
  boxSizing: "border-box",
};

const selectStyle: React.CSSProperties = {
  ...inputStyle,
  cursor: "pointer",
  appearance: "auto" as const,
};

const smallBtnStyle: React.CSSProperties = {
  background: "#1e293b",
  border: "1px solid #334155",
  borderRadius: 6,
  padding: "4px 10px",
  color: "#94a3b8",
  fontSize: 13,
  cursor: "pointer",
  fontFamily: "inherit",
};

// --- Main Component ---

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function SettingsModal({ isOpen, onClose }: SettingsModalProps) {
  const [activeTab, setActiveTab] = useState<Tab>("providers");
  const [connectionStatuses, setConnectionStatuses] = useState<
    Record<LLMProvider, ConnectionStatus>
  >({
    "claude-code": "idle",
    openai: "idle",
    gemini: "idle",
    ollama: "idle",
    "lm-studio": "idle",
  });
  const [connectionMessages, setConnectionMessages] = useState<
    Record<LLMProvider, string | null>
  >({
    "claude-code": null,
    openai: null,
    gemini: null,
    ollama: null,
    "lm-studio": null,
  });

  const providers = useSettingsStore((s) => s.providers);
  const supervisionMode = useSettingsStore((s) => s.supervisionMode);
  const maxParallelAgents = useSettingsStore((s) => s.maxParallelAgents);
  const autoFastModel = useSettingsStore((s) => s.autoFastModel);
  const setProviderSettings = useSettingsStore((s) => s.setProviderSettings);
  const setSupervisionMode = useSettingsStore((s) => s.setSupervisionMode);
  const setMaxParallelAgents = useSettingsStore((s) => s.setMaxParallelAgents);
  const setAutoFastModel = useSettingsStore((s) => s.setAutoFastModel);

  const modalRef = useRef<HTMLDivElement>(null);

  // Close on Escape
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  // Test connection — sends a real API request for Claude, checks availability for others
  const handleTestConnection = useCallback(
    async (provider: LLMProvider) => {
      setConnectionStatuses((prev) => ({ ...prev, [provider]: "testing" }));
      setConnectionMessages((prev) => ({ ...prev, [provider]: null }));

      try {
        const p = llmGateway.getProvider(provider);

        if (p) {
          // For Claude, send a real minimal request
          if (provider === "claude-code") {
            const request: LLMRequest = {
              agentId: "__settings_test__",
              messages: [{ role: "user", content: "Diga 'OK'" }],
              model: providers[provider].defaultModel,
              temperature: 0,
              maxTokens: 10,
              systemPrompt: null,
              metadata: {},
            };

            const response = await p.send(request);

            if (response.finishReason === "error") {
              setConnectionStatuses((prev) => ({ ...prev, [provider]: "error" }));
              setConnectionMessages((prev) => ({ ...prev, [provider]: response.content }));
            } else {
              setConnectionStatuses((prev) => ({ ...prev, [provider]: "success" }));
              setConnectionMessages((prev) => ({
                ...prev,
                [provider]: `Conectado - ${response.model}`,
              }));
            }
          } else {
            // For other providers, check availability
            const available = await p.isAvailable();
            setConnectionStatuses((prev) => ({
              ...prev,
              [provider]: available ? "success" : "error",
            }));
            setConnectionMessages((prev) => ({
              ...prev,
              [provider]: available ? "Conectado" : "Provider nao disponivel",
            }));
          }
        } else {
          // No registered provider yet -- check if settings look valid
          const settings = providers[provider];
          const isLocal = provider === "ollama" || provider === "lm-studio";
          if (isLocal || settings.apiKey.length > 0) {
            setConnectionStatuses((prev) => ({ ...prev, [provider]: "success" }));
            setConnectionMessages((prev) => ({ ...prev, [provider]: "Configurado" }));
          } else {
            setConnectionStatuses((prev) => ({ ...prev, [provider]: "error" }));
            setConnectionMessages((prev) => ({
              ...prev,
              [provider]: "Provider nao registrado",
            }));
          }
        }
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        setConnectionStatuses((prev) => ({ ...prev, [provider]: "error" }));
        setConnectionMessages((prev) => ({ ...prev, [provider]: message }));
      }
    },
    [providers],
  );

  // Evita fechar modal ao selecionar texto (mousedown dentro, mouseup no backdrop)
  const mouseDownTarget = useRef<EventTarget | null>(null);

  if (!isOpen) return null;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9999,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        backdropFilter: "blur(4px)",
        background: "rgba(0, 0, 0, 0.6)",
      }}
      onMouseDown={(e) => { mouseDownTarget.current = e.target; }}
      onClick={(e) => {
        if (e.target === e.currentTarget && mouseDownTarget.current === e.currentTarget) onClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-label="Configuracoes"
    >
      <div
        ref={modalRef}
        style={{
          width: "70%",
          height: "80%",
          background: "#0c1322",
          border: "1px solid #1e293b",
          borderRadius: 12,
          display: "flex",
          flexDirection: "column",
          fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
          boxShadow: "0 25px 50px rgba(0, 0, 0, 0.5)",
        }}
      >
        {/* Header */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            padding: "16px 20px",
            borderBottom: "1px solid #1e293b",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 18 }}>{"\u2699\uFE0F"}</span>
            <span style={{ fontSize: 16, fontWeight: 700, color: "#e2e8f0" }}>
              Configuracoes
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{
              background: "none",
              border: "none",
              color: "#475569",
              fontSize: 18,
              cursor: "pointer",
              padding: "4px 8px",
              borderRadius: 4,
              fontFamily: "inherit",
            }}
          >
            {"\u2715"}
          </button>
        </div>

        {/* Tabs */}
        <div
          style={{
            display: "flex",
            borderBottom: "1px solid #1e293b",
            padding: "0 20px",
          }}
        >
          {TABS.map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setActiveTab(tab)}
              style={{
                background: "none",
                border: "none",
                borderBottom:
                  activeTab === tab ? "2px solid #3B82F6" : "2px solid transparent",
                padding: "10px 16px",
                color: activeTab === tab ? "#e2e8f0" : "#64748b",
                fontSize: 12,
                fontWeight: 600,
                cursor: "pointer",
                fontFamily: "inherit",
                textTransform: "uppercase",
                letterSpacing: 1,
                transition: "color 0.2s, border-color 0.2s",
              }}
            >
              {TAB_LABELS[tab]}
            </button>
          ))}
        </div>

        {/* Content */}
        <div
          style={{
            flex: 1,
            overflowY: "auto",
            padding: 20,
          }}
        >
          {activeTab === "providers" && (
            <div>
              <p
                style={{
                  fontSize: 13,
                  color: "#64748b",
                  marginTop: 0,
                  marginBottom: 16,
                  lineHeight: 1.5,
                }}
              >
                Configure os provedores de LLM que deseja utilizar. Providers locais
                (Ollama, LM Studio) nao requerem API key.
              </p>
              {ALL_PROVIDERS.map((p) => (
                <ProviderCard
                  key={p}
                  provider={p}
                  settings={providers[p]}
                  connectionStatus={connectionStatuses[p]}
                  connectionMessage={connectionMessages[p]}
                  onUpdate={(s) => setProviderSettings(p, s)}
                  onTestConnection={() => void handleTestConnection(p)}
                />
              ))}
            </div>
          )}

          {activeTab === "auth" && (
            <div>
              <p
                style={{
                  fontSize: 13,
                  color: "#64748b",
                  marginTop: 0,
                  marginBottom: 16,
                  lineHeight: 1.5,
                }}
              >
                Gerencie autenticacao com servicos externos.
              </p>

              {/* GitHub Section */}
              <div style={{ marginBottom: 20 }}>
                <h3
                  style={{
                    fontSize: 13,
                    fontWeight: 700,
                    color: "#e2e8f0",
                    margin: "0 0 10px 0",
                    textTransform: "uppercase",
                    letterSpacing: 1,
                  }}
                >
                  GitHub
                </h3>
                <GitHubAuthSection />
              </div>

              {/* Claude API — autenticação integrada no card do Provider */}
            </div>
          )}


          {activeTab === "supervision" && (
            <div>
              <p
                style={{
                  fontSize: 13,
                  color: "#64748b",
                  marginTop: 0,
                  marginBottom: 16,
                  lineHeight: 1.5,
                }}
              >
                Defina o nivel de supervisao sobre os agentes durante a execucao.
              </p>
              <div
                style={{ display: "flex", flexDirection: "column", gap: 8 }}
              >
                {(
                  [
                    SupervisionMode.Autopilot,
                    SupervisionMode.Approve,
                    SupervisionMode.Watch,
                    SupervisionMode.Pair,
                  ] as const
                ).map((mode) => {
                  const info = SUPERVISION_LABELS[mode];
                  const isActive = supervisionMode === mode;
                  return (
                    <button
                      key={mode}
                      type="button"
                      onClick={() => setSupervisionMode(mode)}
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        gap: 4,
                        padding: "12px 16px",
                        background: isActive ? "#1e293b" : "#0f172a",
                        border: `1px solid ${isActive ? "#3B82F6" : "#1e293b"}`,
                        borderRadius: 8,
                        cursor: "pointer",
                        textAlign: "left",
                        fontFamily: "inherit",
                        transition: "border-color 0.2s, background 0.2s",
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 8,
                        }}
                      >
                        <span
                          style={{
                            width: 10,
                            height: 10,
                            borderRadius: "50%",
                            border: `2px solid ${isActive ? "#3B82F6" : "#334155"}`,
                            background: isActive ? "#3B82F6" : "transparent",
                            display: "inline-block",
                            flexShrink: 0,
                          }}
                        />
                        <span
                          style={{
                            fontSize: 14,
                            fontWeight: 700,
                            color: isActive ? "#e2e8f0" : "#94a3b8",
                          }}
                        >
                          {info.label}
                        </span>
                      </div>
                      <span
                        style={{
                          fontSize: 12,
                          color: "#64748b",
                          marginLeft: 18,
                        }}
                      >
                        {info.description}
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* Agentes simultâneos */}
              <div style={{ marginTop: 20 }}>
                <label style={{ display: "block", fontSize: 11, color: "#64748b", marginBottom: 8, textTransform: "uppercase", letterSpacing: 1, fontWeight: 600 }}>
                  Agentes Simultâneos
                </label>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  {[1, 2, 3, 4, 6, 8].map((n) => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => setMaxParallelAgents(n)}
                      style={{
                        width: 36,
                        height: 36,
                        fontSize: 13,
                        fontWeight: 700,
                        fontFamily: "inherit",
                        cursor: "pointer",
                        borderRadius: 8,
                        border: maxParallelAgents === n ? "1px solid #3B82F6" : "1px solid #334155",
                        background: maxParallelAgents === n ? "#3B82F618" : "#1e293b",
                        color: maxParallelAgents === n ? "#3B82F6" : "#64748b",
                        transition: "all 0.15s",
                      }}
                    >
                      {n}
                    </button>
                  ))}
                </div>
                <div style={{ fontSize: 10, color: "#475569", marginTop: 6 }}>
                  Quantos agentes podem executar tarefas ao mesmo tempo. Mais agentes = mais rápido, mas consome mais recursos.
                </div>
              </div>

              {/* Toggle Modelo Rápido */}
              <div>
                <label style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }}>
                  <div
                    role="switch"
                    tabIndex={0}
                    aria-checked={autoFastModel}
                    onClick={() => setAutoFastModel(!autoFastModel)}
                    onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") setAutoFastModel(!autoFastModel); }}
                    style={{
                      width: 40,
                      height: 22,
                      borderRadius: 11,
                      background: autoFastModel ? "#10B981" : "#334155",
                      position: "relative",
                      transition: "background 0.2s",
                      flexShrink: 0,
                    }}
                  >
                    <div style={{
                      width: 16,
                      height: 16,
                      borderRadius: 8,
                      background: "#fff",
                      position: "absolute",
                      top: 3,
                      left: autoFastModel ? 21 : 3,
                      transition: "left 0.2s",
                    }} />
                  </div>
                  <span style={{ fontSize: 12, color: "#94a3b8", fontWeight: 500 }}>
                    Modelo Rapido para agentes simples (PM, QA, Reviewer, Security)
                  </span>
                </label>
                <div style={{ fontSize: 10, color: "#475569", marginTop: 4, marginLeft: 50 }}>
                  Usa Haiku (~3x mais rapido) para agentes que nao geram codigo critico. Economiza tempo sem perder qualidade.
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div
          style={{
            padding: "12px 20px",
            borderTop: "1px solid #1e293b",
            display: "flex",
            justifyContent: "flex-end",
            gap: 8,
          }}
        >
          <button
            type="button"
            onClick={onClose}
            style={{
              background: "linear-gradient(135deg, #3B82F6, #8B5CF6)",
              border: "none",
              borderRadius: 6,
              padding: "8px 20px",
              color: "#fff",
              fontSize: 13,
              fontWeight: 700,
              cursor: "pointer",
              fontFamily: "inherit",
            }}
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
}
