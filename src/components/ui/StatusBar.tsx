/**
 * Barra superior com branding ForgeAI, contadores de status, custo e botão de configurações.
 * Design glassmorphism com transições fluidas e tooltips modernos.
 */
import { useMemo, useCallback, useState } from "react";
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

interface TooltipProps {
  text: string;
  children: React.ReactNode;
  position?: "top" | "bottom";
}

/** Tooltip moderno com glassmorphism */
function ModernTooltip({ text, children, position = "bottom" }: TooltipProps) {
  const [visible, setVisible] = useState(false);
  const [coords, setCoords] = useState({ x: 0, y: 0 });

  const handleMouseEnter = useCallback((e: React.MouseEvent) => {
    const rect = e.currentTarget.getBoundingClientRect();
    setCoords({
      x: rect.left + rect.width / 2,
      y: position === "bottom" ? rect.bottom + 8 : rect.top - 8,
    });
    setVisible(true);
  }, [position]);

  const handleMouseLeave = useCallback(() => {
    setVisible(false);
  }, []);

  return (
    <>
      <span onMouseEnter={handleMouseEnter} onMouseLeave={handleMouseLeave}>
        {children}
      </span>
      {visible && (
        <div
          className="fixed z-50 px-2 py-1 text-xs font-medium text-white transform -translate-x-1/2 pointer-events-none"
          style={{
            left: coords.x,
            top: position === "bottom" ? coords.y : coords.y - 32,
            background: "rgba(15, 23, 42, 0.95)",
            backdropFilter: "blur(12px)",
            border: "1px solid rgba(148, 163, 184, 0.1)",
            borderRadius: 6,
            boxShadow: "0 4px 20px rgba(0, 0, 0, 0.3), 0 0 0 1px rgba(255, 255, 255, 0.05)",
            animation: "tooltip-in 0.15s ease-out",
          }}
        >
          {text}
          <div
            className="absolute w-2 h-2 transform rotate-45"
            style={{
              left: "50%",
              marginLeft: -4,
              top: position === "bottom" ? -4 : "100%",
              marginTop: position === "bottom" ? 0 : -4,
              background: "rgba(15, 23, 42, 0.95)",
              border: "1px solid rgba(148, 163, 184, 0.1)",
              borderBottom: position === "bottom" ? "none" : undefined,
              borderRight: position === "bottom" ? "none" : undefined,
              borderTop: position === "top" ? "none" : undefined,
              borderLeft: position === "top" ? "none" : undefined,
            }}
          />
        </div>
      )}
    </>
  );
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
    <>
      <style>{`
        @keyframes tooltip-in {
          from { opacity: 0; transform: translateX(-50%) translateY(-4px); }
          to { opacity: 1; transform: translateX(-50%) translateY(0); }
        }

        .glass-header {
          background: rgba(15, 23, 42, 0.85);
          backdrop-filter: blur(16px);
          border-bottom: 1px solid rgba(51, 65, 85, 0.3);
          box-shadow: 0 1px 0 rgba(255, 255, 255, 0.05) inset, 0 2px 8px rgba(0, 0, 0, 0.1);
        }

        .glass-separator {
          border-left: 1px solid rgba(51, 65, 85, 0.4);
          position: relative;
        }

        .glass-separator::before {
          content: '';
          position: absolute;
          left: -1px;
          top: 20%;
          height: 60%;
          width: 1px;
          background: rgba(255, 255, 255, 0.03);
        }

        .status-dot {
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
          box-shadow: 0 0 4px currentColor;
        }

        .status-dot:hover {
          transform: scale(1.2);
          box-shadow: 0 0 8px currentColor;
        }

        .provider-dot {
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
          box-shadow: 0 0 3px currentColor;
        }

        .provider-dot:hover {
          transform: scale(1.3);
          box-shadow: 0 0 6px currentColor;
        }

        .icon-button {
          transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
          position: relative;
          overflow: hidden;
        }

        .icon-button::before {
          content: '';
          position: absolute;
          top: 0;
          left: -100%;
          width: 100%;
          height: 100%;
          background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.1), transparent);
          transition: left 0.5s;
        }

        .icon-button:hover::before {
          left: 100%;
        }

        .project-selector {
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
          position: relative;
          background: rgba(30, 41, 59, 0.6);
          backdrop-filter: blur(8px);
          border: 1px solid rgba(51, 65, 85, 0.5);
        }

        .project-selector:hover {
          background: rgba(38, 51, 84, 0.8);
          border-color: rgba(59, 130, 246, 0.6);
          transform: translateY(-1px);
          box-shadow: 0 4px 12px rgba(59, 130, 246, 0.15);
        }

        .project-selector-new {
          background: linear-gradient(135deg, rgba(59, 130, 246, 0.9), rgba(139, 92, 246, 0.9));
          backdrop-filter: blur(8px);
          border: none;
        }

        .project-selector-new:hover {
          background: linear-gradient(135deg, rgba(59, 130, 246, 1), rgba(139, 92, 246, 1));
          transform: translateY(-1px);
          box-shadow: 0 6px 20px rgba(59, 130, 246, 0.3);
        }
      `}</style>

      <header className="flex shrink-0 items-center justify-between px-4 glass-header"
        style={{
          height: 48,
          fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
        }}
      >
      {/* Branding */}
      <div className="flex items-center gap-2.5">
        <ModernTooltip text="ForgeAI - Fábrica de Software Autônoma">
          <span style={{ fontSize: 18, cursor: "default" }}>🏭</span>
        </ModernTooltip>
        <span
          style={{
            fontSize: 14,
            fontWeight: 800,
            letterSpacing: 3,
            background: "linear-gradient(135deg, #3B82F6, #8B5CF6, #10B981)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
          }}
        >
          FORGEAI
        </span>

        <span className="glass-separator" style={{
          fontSize: 11,
          color: "#475569",
          paddingLeft: 8,
          marginLeft: 4,
        }}>
          Fábrica de Software Autônoma
        </span>

        {/* Project selector — sempre visível */}
        <ModernTooltip text={project ? `Projeto: ${project.name} — Clique para trocar` : "Selecionar projeto"}>
          <button
            type="button"
            onClick={onOpenProjects}
            className={project ? "project-selector" : "project-selector-new"}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              padding: "5px 12px",
              borderRadius: 8,
              color: project ? "#e2e8f0" : "#fff",
              fontSize: 12,
              fontWeight: 600,
              fontFamily: "inherit",
              cursor: "pointer",
              marginLeft: 12,
              maxWidth: 220,
              lineHeight: 1.4,
            }}
          >
            {project ? (
              <>
                <span style={{
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}>
                  {project.name}
                </span>
                <span style={{
                  fontSize: 10,
                  color: "#64748b",
                  flexShrink: 0,
                  transition: "transform 0.2s",
                }}>
                  ▼
                </span>
              </>
            ) : (
              <>
                <span style={{ fontSize: 14, fontWeight: 700 }}>+</span>
                <span>Selecionar Projeto</span>
              </>
            )}
          </button>
        </ModernTooltip>
      </div>

      {/* Contadores de status + providers + custo + settings */}
      <div className="flex items-center gap-4" style={{ fontSize: 12 }}>
        {VISIBLE_STATUSES.map((status) => {
          const cfg = STATUS_CONFIG[status];
          if (!cfg) return null;
          const count = agents.filter((a) => a.status === status).length;
          return (
            <ModernTooltip key={status} text={`${count} agente(s) ${cfg.label}`}>
              <span style={{
                color: cfg.color,
                display: "flex",
                alignItems: "center",
                gap: 6,
                cursor: "default",
              }}>
                <span
                  className="status-dot"
                  style={{
                    display: "inline-block",
                    width: 7,
                    height: 7,
                    borderRadius: "50%",
                    background: cfg.color,
                    color: cfg.color,
                  }}
                />
                <span style={{ fontWeight: 600 }}>{count}</span>
                <span style={{ color: "#94a3b8", fontSize: 11 }}>{cfg.label}</span>
              </span>
            </ModernTooltip>
          );
        })}

        {/* Provider dots */}
        {configuredProviders.length > 0 && (
          <ModernTooltip text={`Providers ativos: ${configuredProviders.map((p) => PROVIDER_DISPLAY_NAMES[p]).join(", ")}`}>
            <span className="glass-separator" style={{
              display: "flex",
              alignItems: "center",
              gap: 4,
              paddingLeft: 12,
              cursor: "default",
            }}>
              {configuredProviders.map((p) => (
                <ModernTooltip key={p} text={PROVIDER_DISPLAY_NAMES[p]}>
                  <span
                    className="provider-dot"
                    style={{
                      width: 7,
                      height: 7,
                      borderRadius: "50%",
                      background: PROVIDER_COLORS[p],
                      display: "inline-block",
                      color: PROVIDER_COLORS[p],
                      cursor: "help",
                    }}
                  />
                </ModernTooltip>
              ))}
            </span>
          </ModernTooltip>
        )}

        {/* Custo */}
        <ModernTooltip text={`Custo total do projeto: ${totalCost}`}>
          <span className="glass-separator" style={{
            color: "#64748b",
            paddingLeft: 12,
            display: "flex",
            alignItems: "center",
            gap: 6,
            cursor: "default",
            fontWeight: 500,
          }}>
            <span style={{ color: "#F59E0B" }}>🪙</span>
            <span>{totalCost}</span>
          </span>
        </ModernTooltip>

        {/* User info + logout */}
        <span className="glass-separator" style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          paddingLeft: 12,
          color: "#64748b",
          fontSize: 11,
        }}>
          <ModernTooltip text={userEmail ?? "Usuário anônimo"}>
            <span style={{
              maxWidth: 140,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
              cursor: "default",
            }}>
              {userEmail ?? ""}
            </span>
          </ModernTooltip>

          <ModernTooltip text="Sair da aplicação">
            <button
              type="button"
              onClick={handleLogout}
              className="icon-button"
              style={{
                background: "rgba(30, 41, 59, 0.5)",
                border: "1px solid rgba(51, 65, 85, 0.4)",
                borderRadius: 6,
                padding: "3px 8px",
                color: "#94a3b8",
                fontSize: 11,
                cursor: "pointer",
                fontFamily: "inherit",
                whiteSpace: "nowrap",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = "#EF4444";
                e.currentTarget.style.color = "#EF4444";
                e.currentTarget.style.background = "rgba(239, 68, 68, 0.1)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = "rgba(51, 65, 85, 0.4)";
                e.currentTarget.style.color = "#94a3b8";
                e.currentTarget.style.background = "rgba(30, 41, 59, 0.5)";
              }}
            >
              Sair
            </button>
          </ModernTooltip>
        </span>

        {/* Agents button */}
        {onOpenAgents && (
          <ModernTooltip text="Gerenciar Agentes">
            <button
              type="button"
              onClick={onOpenAgents}
              className="icon-button"
              style={{
                background: "rgba(30, 41, 59, 0.5)",
                border: "1px solid rgba(51, 65, 85, 0.4)",
                borderRadius: 6,
                padding: "4px 8px",
                color: "#94a3b8",
                fontSize: 13,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontFamily: "inherit",
                marginLeft: 6,
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = "#8B5CF6";
                e.currentTarget.style.color = "#e2e8f0";
                e.currentTarget.style.background = "rgba(139, 92, 246, 0.1)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = "rgba(51, 65, 85, 0.4)";
                e.currentTarget.style.color = "#94a3b8";
                e.currentTarget.style.background = "rgba(30, 41, 59, 0.5)";
              }}
            >
              🏢
            </button>
          </ModernTooltip>
        )}

        {/* Settings button */}
        {onOpenSettings && (
          <ModernTooltip text="Configurações do Sistema">
            <button
              type="button"
              onClick={onOpenSettings}
              className="icon-button"
              style={{
                background: "rgba(30, 41, 59, 0.5)",
                border: "1px solid rgba(51, 65, 85, 0.4)",
                borderRadius: 6,
                padding: "4px 8px",
                color: "#94a3b8",
                fontSize: 13,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontFamily: "inherit",
                marginLeft: 6,
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = "#3B82F6";
                e.currentTarget.style.color = "#e2e8f0";
                e.currentTarget.style.background = "rgba(59, 130, 246, 0.1)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = "rgba(51, 65, 85, 0.4)";
                e.currentTarget.style.color = "#94a3b8";
                e.currentTarget.style.background = "rgba(30, 41, 59, 0.5)";
              }}
            >
              ⚙️
            </button>
          </ModernTooltip>
        )}
      </div>
      </header>
    </>
  );
}
