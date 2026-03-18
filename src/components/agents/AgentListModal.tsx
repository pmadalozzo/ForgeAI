/**
 * Modal de lista de agentes — exibe todos os agentes em cards com acesso
 * a criação de novos agentes e configuração individual.
 */
import { useState, useCallback, useRef } from "react";
import { useAgentsStore } from "@/stores/agents-store";
import { AgentStatus } from "@/types/agents";
import { PROVIDER_DISPLAY_NAMES } from "@/stores/settings-store";
import { AgentConfigModal } from "@/components/agents/AgentConfigModal";
import { CreateAgentModal } from "@/components/agents/CreateAgentModal";

const STATUS_CONFIG: Record<AgentStatus, { label: string; color: string; icon: string }> = {
  [AgentStatus.Idle]: { label: "Idle", color: "#64748b", icon: "💤" },
  [AgentStatus.Working]: { label: "Trabalhando", color: "#10B981", icon: "⚡" },
  [AgentStatus.Blocked]: { label: "Bloqueado", color: "#EF4444", icon: "🚫" },
  [AgentStatus.Review]: { label: "Em Review", color: "#8B5CF6", icon: "👀" },
  [AgentStatus.Done]: { label: "Concluído", color: "#3B82F6", icon: "✅" },
};

interface AgentListModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function AgentListModal({ isOpen, onClose }: AgentListModalProps) {
  const agents = useAgentsStore((s) => s.agents);

  const [configAgentId, setConfigAgentId] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);

  const handleOpenConfig = useCallback((agentId: string) => {
    setConfigAgentId(agentId);
  }, []);

  const handleCloseConfig = useCallback(() => {
    setConfigAgentId(null);
  }, []);

  const handleOpenCreate = useCallback(() => {
    setCreateOpen(true);
  }, []);

  const handleCloseCreate = useCallback(() => {
    setCreateOpen(false);
  }, []);

  // Evita fechar modal ao selecionar texto
  const mouseDownTarget = useRef<EventTarget | null>(null);

  if (!isOpen) return null;

  // Se um sub-modal está aberto, renderiza ele por cima
  if (configAgentId) {
    return (
      <AgentConfigModal
        agentId={configAgentId}
        onClose={handleCloseConfig}
        onBackToList={handleCloseConfig}
      />
    );
  }

  if (createOpen) {
    return (
      <CreateAgentModal
        onClose={handleCloseCreate}
        onBackToList={handleCloseCreate}
      />
    );
  }

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 10000,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        backdropFilter: "blur(4px)",
        background: "rgba(0, 0, 0, 0.6)",
      }}
      onMouseDown={(e) => { mouseDownTarget.current = e.target; }}
      onClick={(e) => { if (e.target === e.currentTarget && mouseDownTarget.current === e.currentTarget) onClose(); }}
    >
      <div
        style={{
          width: 800,
          height: 600,
          background: "#0c1322",
          border: "1px solid #1e293b",
          borderRadius: 16,
          display: "flex",
          flexDirection: "column",
          fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
          boxShadow: "0 25px 60px rgba(0,0,0,0.5), 0 0 30px rgba(59,130,246,0.08)",
          overflow: "hidden",
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: "16px 24px",
            borderBottom: "1px solid #1e293b",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexShrink: 0,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontSize: 20 }}>🏢</span>
            <span style={{ fontSize: 16, fontWeight: 700, color: "#e2e8f0" }}>
              Agentes do Escritório
            </span>
            <span
              style={{
                fontSize: 11,
                color: "#64748b",
                background: "#1e293b",
                padding: "2px 8px",
                borderRadius: 4,
                fontWeight: 600,
              }}
            >
              {agents.length} agentes
            </span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <button
              type="button"
              onClick={handleOpenCreate}
              style={{
                padding: "6px 14px",
                background: "linear-gradient(135deg, #3B82F6, #8B5CF6)",
                border: "none",
                borderRadius: 8,
                color: "#fff",
                fontSize: 12,
                fontWeight: 700,
                cursor: "pointer",
                fontFamily: "inherit",
                display: "flex",
                alignItems: "center",
                gap: 6,
              }}
            >
              <span style={{ fontSize: 14, lineHeight: 1 }}>+</span>
              Criar Novo Agente
            </button>
            <button
              type="button"
              onClick={onClose}
              style={{
                background: "none",
                border: "none",
                color: "#475569",
                fontSize: 18,
                cursor: "pointer",
                fontFamily: "inherit",
                padding: "4px 8px",
              }}
            >
              ✕
            </button>
          </div>
        </div>

        {/* Agent grid */}
        <div
          style={{
            flex: 1,
            overflow: "auto",
            padding: "16px 24px",
            display: "grid",
            gridTemplateColumns: "repeat(2, 1fr)",
            gap: 12,
            alignContent: "start",
          }}
        >
          {agents.map((agent) => {
            const statusCfg = STATUS_CONFIG[agent.status];
            return (
              <button
                key={agent.id}
                type="button"
                onClick={() => handleOpenConfig(agent.id)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 14,
                  padding: "14px 16px",
                  background: "#1e293b",
                  border: "1px solid #334155",
                  borderRadius: 12,
                  cursor: "pointer",
                  fontFamily: "inherit",
                  textAlign: "left",
                  transition: "border-color 0.2s, background 0.2s",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = agent.color;
                  e.currentTarget.style.background = "#263354";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = "#334155";
                  e.currentTarget.style.background = "#1e293b";
                }}
              >
                {/* Emoji + cor indicator */}
                <div
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: 10,
                    background: `${agent.color}18`,
                    border: `1px solid ${agent.color}40`,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 22,
                    flexShrink: 0,
                  }}
                >
                  {agent.emoji}
                </div>

                {/* Info */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span
                      style={{
                        fontSize: 13,
                        fontWeight: 700,
                        color: agent.color,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {agent.name}
                    </span>
                    <span
                      style={{
                        fontSize: 10,
                        color: statusCfg.color,
                        background: `${statusCfg.color}18`,
                        padding: "1px 6px",
                        borderRadius: 4,
                        fontWeight: 600,
                        flexShrink: 0,
                      }}
                    >
                      {statusCfg.icon} {statusCfg.label}
                    </span>
                  </div>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      marginTop: 4,
                    }}
                  >
                    <span style={{ fontSize: 10, color: "#64748b" }}>
                      {agent.role}
                    </span>
                    <span style={{ fontSize: 10, color: "#475569" }}>
                      {PROVIDER_DISPLAY_NAMES[agent.provider]}
                    </span>
                  </div>
                  {agent.currentTask && (
                    <div
                      style={{
                        fontSize: 10,
                        color: "#94a3b8",
                        marginTop: 4,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {agent.currentTask}
                    </div>
                  )}
                </div>

                {/* Cor dot */}
                <div
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: "50%",
                    background: agent.color,
                    flexShrink: 0,
                    opacity: 0.6,
                  }}
                />
              </button>
            );
          })}
        </div>

        {/* Footer */}
        <div
          style={{
            padding: "12px 24px",
            borderTop: "1px solid #1e293b",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexShrink: 0,
          }}
        >
          <span style={{ fontSize: 11, color: "#475569" }}>
            Clique em um agente para configurar
          </span>
          <button
            type="button"
            onClick={onClose}
            style={{
              padding: "8px 16px",
              background: "#1e293b",
              border: "1px solid #334155",
              borderRadius: 8,
              color: "#94a3b8",
              fontSize: 12,
              fontWeight: 600,
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
