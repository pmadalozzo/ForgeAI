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
            width: 720,
            maxHeight: "85vh",
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
            padding: "16px 24px",
            display: "grid",
            gridTemplateColumns: "repeat(3, 1fr)",
            gap: 12,
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
                  delay: 0.1 + (index * 0.04),
                  duration: 0.3,
                  type: "spring",
                  damping: 25
                }}
                whileHover={{
                  scale: 1.04,
                  y: -3,
                  boxShadow: `0 16px 32px rgba(0, 0, 0, 0.4), 0 0 24px ${agent.color}25`,
                  borderColor: `${agent.color}60`,
                }}
                whileTap={{ scale: 0.97 }}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: 0,
                  padding: "16px 14px 14px",
                  background: "rgba(15, 23, 42, 0.7)",
                  backdropFilter: "blur(16px) saturate(180%)",
                  border: "1px solid rgba(51, 65, 85, 0.5)",
                  borderRadius: 14,
                  cursor: "pointer",
                  fontFamily: "inherit",
                  textAlign: "center",
                  transition: "border-color 0.3s ease",
                  position: "relative",
                  overflow: "hidden",
                  boxShadow: `
                    0 4px 16px rgba(0, 0, 0, 0.2),
                    inset 0 1px 0 rgba(255, 255, 255, 0.06)
                  `,
                }}
              >
                {/* Top accent bar */}
                <div
                  style={{
                    position: "absolute",
                    top: 0,
                    left: "15%",
                    right: "15%",
                    height: 2,
                    background: `linear-gradient(90deg, transparent, ${agent.color}, transparent)`,
                    opacity: 0.6,
                    borderRadius: "0 0 2px 2px",
                  }}
                />

                {/* Emoji avatar */}
                <div
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: 10,
                    background: `linear-gradient(145deg, ${agent.color}18, ${agent.color}08)`,
                    border: `1px solid ${agent.color}30`,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 20,
                    flexShrink: 0,
                    marginBottom: 8,
                  }}
                >
                  {agent.emoji}
                </div>

                {/* Name */}
                <span
                  style={{
                    fontSize: 12,
                    fontWeight: 700,
                    color: "#e2e8f0",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                    width: "100%",
                    marginBottom: 4,
                  }}
                >
                  {agent.name}
                </span>

                {/* Status pill */}
                <span
                  style={{
                    fontSize: 9,
                    color: statusCfg.color,
                    background: `${statusCfg.color}15`,
                    padding: "2px 8px",
                    borderRadius: 6,
                    fontWeight: 600,
                    border: `1px solid ${statusCfg.color}25`,
                    marginBottom: 6,
                    letterSpacing: 0.3,
                  }}
                >
                  {statusCfg.icon} {statusCfg.label}
                </span>

                {/* Role + Provider tags */}
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 4,
                    flexWrap: "nowrap",
                    justifyContent: "center",
                    width: "100%",
                    overflow: "hidden",
                  }}
                >
                  <span style={{
                    fontSize: 9,
                    color: agent.color,
                    background: `${agent.color}12`,
                    padding: "1px 6px",
                    borderRadius: 4,
                    fontWeight: 600,
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    maxWidth: "45%",
                  }}>
                    {agent.role}
                  </span>
                  <span style={{
                    fontSize: 9,
                    color: "#64748b",
                    background: "rgba(51, 65, 85, 0.4)",
                    padding: "1px 6px",
                    borderRadius: 4,
                    fontWeight: 500,
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    maxWidth: "55%",
                  }}>
                    {PROVIDER_DISPLAY_NAMES[agent.provider]}
                  </span>
                </div>

                {/* Current task (if any) */}
                {agent.currentTask && (
                  <div
                    style={{
                      fontSize: 9,
                      color: "#94a3b8",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                      width: "100%",
                      marginTop: 6,
                      fontWeight: 500,
                      opacity: 0.8,
                      borderTop: "1px solid rgba(51, 65, 85, 0.3)",
                      paddingTop: 6,
                    }}
                  >
                    {agent.currentTask}
                  </div>
                )}

                {/* Status dot (corner) */}
                <motion.div
                  animate={{
                    scale: [1, 1.3, 1],
                    opacity: [0.5, 1, 0.5],
                  }}
                  transition={{
                    duration: 2,
                    repeat: Infinity,
                    ease: "easeInOut",
                  }}
                  style={{
                    position: "absolute",
                    top: 8,
                    right: 8,
                    width: 7,
                    height: 7,
                    borderRadius: "50%",
                    background: agent.color,
                    boxShadow: `0 0 8px ${agent.color}50`,
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
