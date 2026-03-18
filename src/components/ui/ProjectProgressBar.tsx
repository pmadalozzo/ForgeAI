/**
 * Barra de progresso do projeto ativa na parte inferior do escritório.
 * Mostra: nome do projeto, status, agentes trabalhando, e progresso visual.
 */
import { useMemo, useCallback } from "react";
import { useProjectStore } from "@/stores/project-store";
import { useAgentsStore } from "@/stores/agents-store";
import { useChatStore } from "@/stores/chat-store";
import { AgentStatus } from "@/types/agents";

const STATUS_LABELS: Record<string, string> = {
  setup: "Configurando",
  planning: "Planejando",
  "in-progress": "Em progresso",
  review: "Em revisão",
  done: "Concluído",
  paused: "Pausado",
};

const STATUS_COLORS: Record<string, string> = {
  setup: "#64748b",
  planning: "#F59E0B",
  "in-progress": "#3B82F6",
  review: "#8B5CF6",
  done: "#10B981",
  paused: "#94a3b8",
};

export function ProjectProgressBar() {
  const projects = useProjectStore((s) => s.projects);
  const activeProjectId = useProjectStore((s) => s.activeProjectId);
  const agents = useAgentsStore((s) => s.agents);
  const setAgentStatus = useAgentsStore((s) => s.setAgentStatus);
  const setAgentTask = useAgentsStore((s) => s.setAgentTask);
  const addMessage = useChatStore((s) => s.addMessage);
  const setLoading = useChatStore((s) => s.setLoading);

  const project = useMemo(
    () => projects.find((p) => p.id === activeProjectId) ?? null,
    [projects, activeProjectId],
  );

  const agentStats = useMemo(() => {
    const working = agents.filter((a) => a.status === AgentStatus.Working);
    const done = agents.filter((a) => a.status === AgentStatus.Done);
    const blocked = agents.filter((a) => a.status === AgentStatus.Blocked);
    const review = agents.filter((a) => a.status === AgentStatus.Review);
    const total = agents.length;
    const active = working.length + review.length;
    const completedCount = project?.completedTasks?.length ?? done.length;
    const progress = project?.progress ?? (total > 0 ? Math.round((completedCount / Math.max(total, 1)) * 100) : 0);

    return { working, done, blocked, review, total, active, progress };
  }, [agents, project]);

  const handleStop = useCallback(async () => {
    try {
      await fetch("/api/claude/abort", { method: "POST" });
    } catch {
      // Ignora
    }

    const allAgents = useAgentsStore.getState().agents;
    for (const agent of allAgents) {
      if (agent.status === AgentStatus.Working) {
        setAgentStatus(agent.id, AgentStatus.Idle);
        setAgentTask(agent.id, "");
      }
    }

    addMessage("orchestrator", "Processamento interrompido pelo usuário.");
    setLoading(false);
  }, [setAgentStatus, setAgentTask, addMessage, setLoading]);

  if (!project) return null;

  const statusColor = STATUS_COLORS[project.status] ?? "#64748b";
  const statusLabel = STATUS_LABELS[project.status] ?? project.status;

  return (
    <div
      style={{
        height: 36,
        background: "#0c1322",
        borderTop: "1px solid #1e293b",
        display: "flex",
        alignItems: "center",
        padding: "0 16px",
        gap: 16,
        fontFamily: "'JetBrains Mono', monospace",
        fontSize: 11,
        flexShrink: 0,
      }}
    >
      {/* Nome do projeto */}
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <span style={{ color: "#64748b" }}>Projeto:</span>
        <span style={{ color: "#e2e8f0", fontWeight: 700 }}>{project.name}</span>
      </div>

      {/* Status badge */}
      <span
        style={{
          color: statusColor,
          background: `${statusColor}18`,
          padding: "2px 8px",
          borderRadius: 4,
          fontWeight: 600,
          fontSize: 10,
          textTransform: "uppercase",
          letterSpacing: 0.5,
        }}
      >
        {statusLabel}
      </span>

      {/* Agentes ativos */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, color: "#64748b" }}>
        {agentStats.active > 0 && (
          <span>
            <span style={{ color: "#10B981", fontWeight: 700 }}>{agentStats.active}</span> trabalhando
          </span>
        )}
        {agentStats.done.length > 0 && (
          <span>
            <span style={{ color: "#3B82F6", fontWeight: 700 }}>{agentStats.done.length}</span> concluídos
          </span>
        )}
        {agentStats.blocked.length > 0 && (
          <span>
            <span style={{ color: "#EF4444", fontWeight: 700 }}>{agentStats.blocked.length}</span> bloqueados
          </span>
        )}
      </div>

      {/* Barra de progresso */}
      <div style={{ flex: 1, display: "flex", alignItems: "center", gap: 8 }}>
        <div
          style={{
            flex: 1,
            height: 6,
            background: "#1e293b",
            borderRadius: 3,
            overflow: "hidden",
          }}
        >
          <div
            style={{
              height: "100%",
              width: `${agentStats.progress}%`,
              background: `linear-gradient(90deg, ${statusColor}, ${statusColor}cc)`,
              borderRadius: 3,
              transition: "width 0.5s ease",
            }}
          />
        </div>
        <span style={{ color: statusColor, fontWeight: 700, minWidth: 32, textAlign: "right" }}>
          {agentStats.progress}%
        </span>
      </div>

      {/* Botão Parar */}
      {agentStats.active > 0 && (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); void handleStop(); }}
          style={{
            padding: "3px 10px",
            fontSize: 10,
            fontWeight: 700,
            fontFamily: "inherit",
            color: "#fff",
            background: "#EF4444",
            border: "none",
            borderRadius: 4,
            cursor: "pointer",
            letterSpacing: 0.3,
            flexShrink: 0,
          }}
        >
          Parar
        </button>
      )}

      {/* Tasks dos agentes ativos */}
      {agentStats.working.length > 0 && (
        <div
          style={{
            color: "#475569",
            fontSize: 10,
            maxWidth: 250,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {agentStats.working[0]?.emoji} {agentStats.working[0]?.currentTask ?? "..."}
        </div>
      )}
    </div>
  );
}
