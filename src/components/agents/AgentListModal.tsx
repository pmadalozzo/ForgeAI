/**
 * Modal de lista de agentes — exibe todos os agentes em cards com acesso
 * a criação de novos agentes e configuração individual.
 */
import { useState, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
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
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 10000,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          backdropFilter: "blur(12px) saturate(180%)",
          background: "rgba(0, 0, 0, 0.65)",
        }}
        onMouseDown={(e) => { mouseDownTarget.current = e.target; }}
        onClick={(e) => { if (e.target === e.currentTarget && mouseDownTarget.current === e.currentTarget) onClose(); }}
      >
        <motion.div
          initial={{ scale: 0.8, opacity: 0, y: 20 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.8, opacity: 0, y: 20 }}
          transition={{ type: "spring", duration: 0.4, bounce: 0.3 }}
          style={{
            width: 800,
            height: 600,
            background: "rgba(12, 19, 34, 0.85)",
            backdropFilter: "blur(20px) saturate(180%)",
            border: "1px solid rgba(30, 41, 59, 0.8)",
            borderRadius: 20,
            display: "flex",
            flexDirection: "column",
            fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
            boxShadow: `
              0 32px 80px rgba(0, 0, 0, 0.6),
              0 0 40px rgba(59, 130, 246, 0.12),
              inset 0 1px 0 rgba(255, 255, 255, 0.1)
            `,
            overflow: "hidden",
          }}
        >
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1, duration: 0.3 }}
          style={{
            padding: "20px 28px",
            borderBottom: "1px solid rgba(30, 41, 59, 0.6)",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexShrink: 0,
            background: "linear-gradient(135deg, rgba(59, 130, 246, 0.05), rgba(139, 92, 246, 0.02))",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <motion.span
              initial={{ scale: 0.8 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.2, duration: 0.3, type: "spring" }}
              style={{ fontSize: 24 }}
            >
              🏢
            </motion.span>
            <div>
              <h2 style={{
                fontSize: 18,
                fontWeight: 700,
                color: "#e2e8f0",
                margin: 0,
                textShadow: "0 2px 8px rgba(0, 0, 0, 0.3)"
              }}>
                Agentes do Escritório
              </h2>
              <div
                style={{
                  fontSize: 12,
                  color: "#64748b",
                  background: "rgba(30, 41, 59, 0.6)",
                  backdropFilter: "blur(8px)",
                  padding: "3px 10px",
                  borderRadius: 12,
                  fontWeight: 600,
                  border: "1px solid rgba(51, 65, 85, 0.4)",
                  marginTop: 4,
                  display: "inline-block"
                }}
              >
                {agents.length} agentes ativos
              </div>
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <motion.button
              type="button"
              onClick={handleOpenCreate}
              whileHover={{ scale: 1.05, boxShadow: "0 8px 25px rgba(59, 130, 246, 0.4)" }}
              whileTap={{ scale: 0.95 }}
              style={{
                padding: "8px 16px",
                background: "linear-gradient(135deg, #3B82F6, #8B5CF6)",
                border: "1px solid rgba(59, 130, 246, 0.3)",
                borderRadius: 10,
                color: "#fff",
                fontSize: 13,
                fontWeight: 700,
                cursor: "pointer",
                fontFamily: "inherit",
                display: "flex",
                alignItems: "center",
                gap: 8,
                boxShadow: "0 4px 15px rgba(59, 130, 246, 0.2)",
                position: "relative",
                overflow: "hidden"
              }}
            >
              <span style={{ fontSize: 16, lineHeight: 1 }}>+</span>
              Criar Novo Agente
            </motion.button>
            <motion.button
              type="button"
              onClick={onClose}
              whileHover={{ scale: 1.1, color: "#ef4444" }}
              whileTap={{ scale: 0.9 }}
              style={{
                background: "rgba(71, 85, 105, 0.2)",
                border: "1px solid rgba(71, 85, 105, 0.3)",
                borderRadius: 8,
                color: "#94a3b8",
                fontSize: 18,
                cursor: "pointer",
                fontFamily: "inherit",
                padding: "6px 10px",
                transition: "all 0.2s ease"
              }}
            >
              ✕
            </motion.button>
          </div>
        </motion.div>

        {/* Agent grid */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2, duration: 0.4 }}
          style={{
            flex: 1,
            overflow: "auto",
            padding: "20px 28px",
            display: "grid",
            gridTemplateColumns: "repeat(2, 1fr)",
            gap: 16,
            alignContent: "start",
          }}
        >
          {agents.map((agent, index) => {
            const statusCfg = STATUS_CONFIG[agent.status];
            return (
              <motion.button
                key={agent.id}
                type="button"
                onClick={() => handleOpenConfig(agent.id)}
                initial={{ opacity: 0, y: 20, scale: 0.9 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{
                  delay: 0.1 + (index * 0.05),
                  duration: 0.3,
                  type: "spring",
                  damping: 25
                }}
                whileHover={{
                  scale: 1.03,
                  y: -2,
                  boxShadow: `0 20px 40px rgba(0, 0, 0, 0.4), 0 0 30px ${agent.color}30`
                }}
                whileTap={{ scale: 0.98 }}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 16,
                  padding: "18px 20px",
                  background: "rgba(30, 41, 59, 0.6)",
                  backdropFilter: "blur(16px) saturate(180%)",
                  border: `1px solid rgba(51, 65, 85, 0.6)`,
                  borderRadius: 16,
                  cursor: "pointer",
                  fontFamily: "inherit",
                  textAlign: "left",
                  transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
                  position: "relative",
                  overflow: "hidden",
                  boxShadow: `
                    0 8px 32px rgba(0, 0, 0, 0.2),
                    0 0 15px rgba(${agent.color.slice(1)}, 0.08),
                    inset 0 1px 0 rgba(255, 255, 255, 0.1)
                  `
                }}
                onHoverStart={() => {
                  // Efeito adicional via estilo direto se necessário
                }}
              >
                {/* Glassmorphism overlay */}
                <div
                  style={{
                    position: "absolute",
                    inset: 0,
                    background: `linear-gradient(135deg, ${agent.color}08, transparent)`,
                    opacity: 0,
                    transition: "opacity 0.3s ease"
                  }}
                  className="glass-overlay"
                />

                {/* Emoji + cor indicator */}
                <motion.div
                  whileHover={{ scale: 1.1, rotate: 5 }}
                  style={{
                    width: 48,
                    height: 48,
                    borderRadius: 12,
                    background: `linear-gradient(135deg, ${agent.color}20, ${agent.color}10)`,
                    border: `1px solid ${agent.color}40`,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 24,
                    flexShrink: 0,
                    boxShadow: `0 4px 20px ${agent.color}25`,
                    position: "relative",
                    zIndex: 2
                  }}
                >
                  {agent.emoji}
                </motion.div>

                {/* Info */}
                <div style={{ flex: 1, minWidth: 0, position: "relative", zIndex: 2 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
                    <span
                      style={{
                        fontSize: 14,
                        fontWeight: 700,
                        color: "#e2e8f0",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                        textShadow: "0 1px 3px rgba(0, 0, 0, 0.3)"
                      }}
                    >
                      {agent.name}
                    </span>
                    <motion.span
                      initial={{ scale: 0.8 }}
                      animate={{ scale: 1 }}
                      style={{
                        fontSize: 10,
                        color: statusCfg.color,
                        background: `${statusCfg.color}20`,
                        backdropFilter: "blur(8px)",
                        padding: "3px 8px",
                        borderRadius: 8,
                        fontWeight: 600,
                        flexShrink: 0,
                        border: `1px solid ${statusCfg.color}30`,
                        boxShadow: `0 2px 8px ${statusCfg.color}20`
                      }}
                    >
                      {statusCfg.icon} {statusCfg.label}
                    </motion.span>
                  </div>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                      marginBottom: agent.currentTask ? 6 : 0,
                    }}
                  >
                    <span style={{
                      fontSize: 11,
                      color: "#94a3b8",
                      background: "rgba(71, 85, 105, 0.3)",
                      padding: "2px 6px",
                      borderRadius: 6,
                      fontWeight: 500
                    }}>
                      {agent.role}
                    </span>
                    <span style={{
                      fontSize: 11,
                      color: "#64748b",
                      background: "rgba(51, 65, 85, 0.3)",
                      padding: "2px 6px",
                      borderRadius: 6,
                      fontWeight: 500
                    }}>
                      {PROVIDER_DISPLAY_NAMES[agent.provider]}
                    </span>
                  </div>
                  {agent.currentTask && (
                    <div
                      style={{
                        fontSize: 11,
                        color: "#cbd5e1",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                        fontWeight: 500,
                        opacity: 0.8
                      }}
                    >
                      {agent.currentTask}
                    </div>
                  )}
                </div>

                {/* Status indicator */}
                <motion.div
                  animate={{
                    scale: [1, 1.2, 1],
                    opacity: [0.6, 1, 0.6]
                  }}
                  transition={{
                    duration: 2,
                    repeat: Infinity,
                    ease: "easeInOut"
                  }}
                  style={{
                    width: 10,
                    height: 10,
                    borderRadius: "50%",
                    background: `linear-gradient(135deg, ${agent.color}, ${agent.color}cc)`,
                    flexShrink: 0,
                    boxShadow: `0 0 15px ${agent.color}60`,
                    position: "relative",
                    zIndex: 2
                  }}
                />
              </motion.button>
            );
          })}
        </motion.div>

        {/* Footer */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, duration: 0.3 }}
          style={{
            padding: "16px 28px",
            borderTop: "1px solid rgba(30, 41, 59, 0.6)",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexShrink: 0,
            background: "linear-gradient(135deg, rgba(30, 41, 59, 0.3), rgba(51, 65, 85, 0.2))",
            backdropFilter: "blur(8px)",
          }}
        >
          <span style={{
            fontSize: 12,
            color: "#94a3b8",
            fontWeight: 500,
            opacity: 0.8
          }}>
            Clique em um agente para configurar
          </span>
          <motion.button
            type="button"
            onClick={onClose}
            whileHover={{
              scale: 1.05,
              backgroundColor: "rgba(30, 41, 59, 0.8)",
              borderColor: "rgba(59, 130, 246, 0.4)"
            }}
            whileTap={{ scale: 0.95 }}
            style={{
              padding: "10px 18px",
              background: "rgba(30, 41, 59, 0.6)",
              backdropFilter: "blur(8px)",
              border: "1px solid rgba(51, 65, 85, 0.6)",
              borderRadius: 10,
              color: "#cbd5e1",
              fontSize: 13,
              fontWeight: 600,
              cursor: "pointer",
              fontFamily: "inherit",
              transition: "all 0.2s ease",
              boxShadow: "0 2px 10px rgba(0, 0, 0, 0.2)"
            }}
          >
            Fechar
          </motion.button>
        </motion.div>
      </motion.div>
    </motion.div>
    </AnimatePresence>
  );
}
