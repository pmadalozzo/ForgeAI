/**
 * Painel de Análise do Projeto.
 * Mostra todas as ProjectMemoryEntry do projeto, agrupadas por agente.
 */
import { useMemo } from "react";
import { useMemoryStore } from "@/stores/memory-store";
import type { ProjectMemoryEntry, ProjectMemoryType } from "@/stores/memory-store";

// ─── Constants ───────────────────────────────────────────────────────────────

const TYPE_COLORS: Record<ProjectMemoryType, string> = {
  analysis: "#3B82F6",
  decision: "#8B5CF6",
  artifact: "#10B981",
  issue: "#EF4444",
  progress: "#F59E0B",
  note: "#64748b",
};

const TYPE_LABELS: Record<ProjectMemoryType, string> = {
  analysis: "Análise",
  decision: "Decisão",
  artifact: "Artefato",
  issue: "Problema",
  progress: "Progresso",
  note: "Nota",
};

const AGENT_EMOJIS: Record<string, string> = {
  orchestrator: "\u{1F3AF}",
  pm: "\u{1F4CB}",
  architect: "\u{1F3D7}\uFE0F",
  frontend: "\u{1F3A8}",
  backend: "\u2699\uFE0F",
  database: "\u{1F5C3}\uFE0F",
  qa: "\u{1F9EA}",
  security: "\u{1F512}",
  devops: "\u{1F4E6}",
  "code-reviewer": "\u{1F50D}",
};

function getAgentEmoji(role: string): string {
  return AGENT_EMOJIS[role] ?? "\u{1F916}";
}

function formatTimestamp(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

// ─── Props ───────────────────────────────────────────────────────────────────

interface ProjectAnalysisPanelProps {
  projectId: string;
}

// ─── Component ───────────────────────────────────────────────────────────────

export function ProjectAnalysisPanel({ projectId }: ProjectAnalysisPanelProps) {
  const allProjectMemories = useMemoryStore((s) => s.projectMemories);
  const projectMemories = useMemo(
    () => allProjectMemories.filter((m) => m.projectId === projectId),
    [allProjectMemories, projectId],
  );

  // Agrupar por agente
  const grouped = useMemo(() => {
    const map = new Map<string, ProjectMemoryEntry[]>();
    for (const entry of projectMemories) {
      const existing = map.get(entry.agentRole);
      if (existing) {
        existing.push(entry);
      } else {
        map.set(entry.agentRole, [entry]);
      }
    }
    return map;
  }, [projectMemories]);

  if (projectMemories.length === 0) {
    return (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: "48px 24px",
          color: "#475569",
          textAlign: "center",
          gap: 12,
        }}
      >
        <span style={{ fontSize: 36 }}>{"\u{1F4CA}"}</span>
        <p style={{ fontSize: 13, margin: 0, lineHeight: 1.6 }}>
          Nenhuma análise registrada.
          <br />
          Inicie o projeto para os agentes começarem a trabalhar.
        </p>
      </div>
    );
  }

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 16,
        maxHeight: 420,
        overflowY: "auto",
        paddingRight: 4,
      }}
    >
      {Array.from(grouped.entries()).map(([agentRole, entries]) => (
        <div key={agentRole}>
          {/* Agent header */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              marginBottom: 8,
              fontSize: 13,
              fontWeight: 700,
              color: "#e2e8f0",
            }}
          >
            <span style={{ fontSize: 16 }}>{getAgentEmoji(agentRole)}</span>
            <span style={{ textTransform: "capitalize" }}>{agentRole}</span>
            <span
              style={{
                fontSize: 11,
                color: "#64748b",
                fontWeight: 400,
              }}
            >
              ({entries.length})
            </span>
          </div>

          {/* Entries */}
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {entries.map((entry) => (
              <AnalysisEntry key={entry.id} entry={entry} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Entry Card ──────────────────────────────────────────────────────────────

function AnalysisEntry({ entry }: { entry: ProjectMemoryEntry }) {
  const color = TYPE_COLORS[entry.type];

  return (
    <div
      style={{
        background: "#0c1322",
        border: "1px solid #1e293b",
        borderLeft: `3px solid ${color}`,
        borderRadius: 8,
        padding: "10px 14px",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          marginBottom: 6,
        }}
      >
        {/* Type badge */}
        <span
          style={{
            fontSize: 10,
            fontWeight: 700,
            color,
            background: `${color}18`,
            padding: "2px 8px",
            borderRadius: 4,
            textTransform: "uppercase",
            letterSpacing: 0.3,
          }}
        >
          {TYPE_LABELS[entry.type]}
        </span>
        {/* Timestamp */}
        <span style={{ fontSize: 10, color: "#475569", marginLeft: "auto" }}>
          {formatTimestamp(entry.createdAt)}
        </span>
      </div>

      {/* Title */}
      <div
        style={{
          fontSize: 12,
          fontWeight: 600,
          color: "#e2e8f0",
          marginBottom: 4,
        }}
      >
        {entry.title}
      </div>

      {/* Content */}
      <div
        style={{
          fontSize: 11,
          color: "#94a3b8",
          lineHeight: 1.5,
          whiteSpace: "pre-wrap",
          wordBreak: "break-word",
        }}
      >
        {entry.content}
      </div>
    </div>
  );
}
