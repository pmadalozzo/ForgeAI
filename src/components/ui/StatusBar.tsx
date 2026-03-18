/**
 * Barra superior com branding ForgeAI, contadores de status, custo e botão de configurações.
 */
import { useMemo, useCallback } from "react";
import { useAgentsStore } from "@/stores/agents-store";
import { useSettingsStore } from "@/stores/settings-store";
import { useProjectStore } from "@/stores/project-store";
import { useAppStore } from "@/stores/app-store";
import { getSupabaseClient } from "@/services/supabase/safe-client";
import { AgentStatus } from "@/types/agents";
import type { LLMProvider } from "@/types/agents";
import { PROVIDER_DISPLAY_NAMES } from "@/stores/settings-store";

/** Configuração visual por status */
const STATUS_CONFIG: Record<
  string,
  { label: string; color: string; icon: string }
> = {
  [AgentStatus.Working]: {
    label: "trabalhando",
    color: "#10B981",
    icon: "⚡",
  },
  [AgentStatus.Review]: { label: "em review", color: "#8B5CF6", icon: "👀" },
  [AgentStatus.Blocked]: { label: "bloqueado", color: "#EF4444", icon: "🚫" },
  [AgentStatus.Done]: { label: "concluído", color: "#3B82F6", icon: "✅" },
  [AgentStatus.Idle]: { label: "idle", color: "#64748b", icon: "💤" },
};

/** Statuses exibidos na barra (exclui idle) */
const VISIBLE_STATUSES: AgentStatus[] = [
  AgentStatus.Working,
  AgentStatus.Review,
  AgentStatus.Blocked,
];

/** Cores associadas a cada provider (para os dots) */
const PROVIDER_COLORS: Record<LLMProvider, string> = {
  "claude-code": "#D97706",
  openai: "#10B981",
  gemini: "#3B82F6",
  ollama: "#8B5CF6",
  "lm-studio": "#EC4899",
};

interface StatusBarProps {
  /** Custo total do projeto formatado */
  totalCost?: string;
  /** Callback para abrir modal de configurações */
  onOpenSettings?: () => void;
  /** Callback para abrir modal de projetos */
  onOpenProjects?: () => void;
  /** Callback para abrir modal de lista de agentes */
  onOpenAgents?: () => void;
}

export function StatusBar({ totalCost = "$0.00", onOpenSettings, onOpenProjects, onOpenAgents }: StatusBarProps) {
  const agents = useAgentsStore((s) => s.agents);
  const providers = useSettingsStore((s) => s.providers);
  const project = useProjectStore((s) => s.getProject());
  const userEmail = useAppStore((s) => s.userEmail);
  const appLogout = useAppStore((s) => s.logout);

  const handleLogout = useCallback(() => {
    const supabase = getSupabaseClient();
    if (supabase) {
      void supabase.auth.signOut();
    }
    appLogout();
  }, [appLogout]);

  const configuredProviders = useMemo(() => {
    const allProviders: LLMProvider[] = ["claude-code", "openai", "gemini", "ollama", "lm-studio"];
    return allProviders.filter((p) => {
      const cfg = providers[p];
      if (!cfg.enabled) return false;
      if (p === "ollama" || p === "lm-studio") return true;
      return cfg.apiKey.length > 0;
    });
  }, [providers]);

  return (
    <header
      className="flex shrink-0 items-center justify-between border-b border-forge-border px-4"
      style={{
        height: 48,
        background: "#0f172a",
        fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
      }}
    >
      {/* Branding */}
      <div className="flex items-center gap-2.5">
        <span style={{ fontSize: 18 }}>🏭</span>
        <span
          style={{
            fontSize: 14,
            fontWeight: 800,
            letterSpacing: 3,
            background:
              "linear-gradient(135deg, #3B82F6, #8B5CF6, #10B981)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
          }}
        >
          FORGEAI
        </span>
        <span
          style={{
            fontSize: 11,
            color: "#475569",
            borderLeft: "1px solid #334155",
            paddingLeft: 8,
            marginLeft: 4,
          }}
        >
          Fábrica de Software Autônoma
        </span>

        {/* Project selector — sempre visível */}
        <button
          type="button"
          onClick={onOpenProjects}
          title={project ? `Projeto: ${project.name} — Clique para trocar` : "Selecionar projeto"}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            padding: "4px 12px",
            background: project ? "#1e293b" : "linear-gradient(135deg, #3B82F6, #8B5CF6)",
            border: project ? "1px solid #334155" : "none",
            borderRadius: 8,
            color: project ? "#e2e8f0" : "#fff",
            fontSize: 12,
            fontWeight: 600,
            fontFamily: "inherit",
            cursor: "pointer",
            transition: "border-color 0.2s, background 0.2s, opacity 0.2s",
            marginLeft: 8,
            maxWidth: 220,
            lineHeight: 1.4,
          }}
          onMouseEnter={(e) => {
            if (project) {
              e.currentTarget.style.borderColor = "#3B82F6";
              e.currentTarget.style.background = "#263354";
            } else {
              e.currentTarget.style.opacity = "0.85";
            }
          }}
          onMouseLeave={(e) => {
            if (project) {
              e.currentTarget.style.borderColor = "#334155";
              e.currentTarget.style.background = "#1e293b";
            } else {
              e.currentTarget.style.opacity = "1";
            }
          }}
        >
          {project ? (
            <>
              <span
                style={{
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {project.name}
              </span>
              <span style={{ fontSize: 10, color: "#64748b", flexShrink: 0 }}>{"\u25BC"}</span>
            </>
          ) : (
            <>
              <span style={{ fontSize: 14 }}>+</span>
              <span>Selecionar Projeto</span>
            </>
          )}
        </button>
      </div>

      {/* Contadores de status + providers + custo + settings */}
      <div className="flex items-center gap-3.5" style={{ fontSize: 12 }}>
        {VISIBLE_STATUSES.map((status) => {
          const cfg = STATUS_CONFIG[status];
          if (!cfg) return null;
          const count = agents.filter((a) => a.status === status).length;
          return (
            <span key={status} style={{ color: cfg.color }}>
              <span
                style={{
                  display: "inline-block",
                  width: 6,
                  height: 6,
                  borderRadius: "50%",
                  background: cfg.color,
                  marginRight: 4,
                  verticalAlign: "middle",
                }}
              />
              {count} {cfg.label}
            </span>
          );
        })}

        {/* Provider dots */}
        {configuredProviders.length > 0 && (
          <span
            style={{
              display: "flex",
              alignItems: "center",
              gap: 3,
              borderLeft: "1px solid #334155",
              paddingLeft: 10,
            }}
            title={configuredProviders
              .map((p) => PROVIDER_DISPLAY_NAMES[p])
              .join(", ")}
          >
            {configuredProviders.map((p) => (
              <span
                key={p}
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: "50%",
                  background: PROVIDER_COLORS[p],
                  display: "inline-block",
                }}
                title={PROVIDER_DISPLAY_NAMES[p]}
              />
            ))}
          </span>
        )}

        {/* Custo */}
        <span
          style={{
            color: "#64748b",
            borderLeft: "1px solid #334155",
            paddingLeft: 10,
          }}
        >
          🪙 {totalCost}
        </span>

        {/* User info + logout */}
        <span
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            borderLeft: "1px solid #334155",
            paddingLeft: 10,
            color: "#64748b",
            fontSize: 11,
          }}
        >
          <span
            style={{
              maxWidth: 140,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
            title={userEmail ?? ""}
          >
            {userEmail ?? ""}
          </span>
          <button
            type="button"
            onClick={handleLogout}
            title="Sair"
            style={{
              background: "none",
              border: "1px solid #334155",
              borderRadius: 6,
              padding: "2px 8px",
              color: "#94a3b8",
              fontSize: 11,
              cursor: "pointer",
              fontFamily: "inherit",
              transition: "border-color 0.2s, color 0.2s",
              whiteSpace: "nowrap",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = "#EF4444";
              e.currentTarget.style.color = "#EF4444";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = "#334155";
              e.currentTarget.style.color = "#94a3b8";
            }}
          >
            Sair
          </button>
        </span>

        {/* Agents button */}
        {onOpenAgents && (
          <button
            type="button"
            onClick={onOpenAgents}
            title="Gerenciar Agentes"
            style={{
              background: "none",
              border: "1px solid #334155",
              borderRadius: 6,
              padding: "3px 8px",
              color: "#94a3b8",
              fontSize: 13,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontFamily: "inherit",
              transition: "border-color 0.2s, color 0.2s",
              marginLeft: 4,
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = "#8B5CF6";
              e.currentTarget.style.color = "#e2e8f0";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = "#334155";
              e.currentTarget.style.color = "#94a3b8";
            }}
          >
            🏢
          </button>
        )}

        {/* Settings button */}
        {onOpenSettings && (
          <button
            type="button"
            onClick={onOpenSettings}
            title="Configurações"
            style={{
              background: "none",
              border: "1px solid #334155",
              borderRadius: 6,
              padding: "3px 8px",
              color: "#94a3b8",
              fontSize: 13,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontFamily: "inherit",
              transition: "border-color 0.2s, color 0.2s",
              marginLeft: 4,
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = "#3B82F6";
              e.currentTarget.style.color = "#e2e8f0";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = "#334155";
              e.currentTarget.style.color = "#94a3b8";
            }}
          >
            ⚙️
          </button>
        )}
      </div>
    </header>
  );
}
