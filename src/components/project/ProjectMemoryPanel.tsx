/**
 * Painel de Memória do Projeto.
 * 2 tabs: "Projeto" (memórias do projeto ativo) e "Desenvolvimento" (memórias globais).
 */
import { useState, useCallback, useMemo, useEffect } from "react";
import { useMemoryStore } from "@/stores/memory-store";
import type {
  ProjectMemoryType,
  DevMemoryCategory,
} from "@/stores/memory-store";

// ─── Constants ───────────────────────────────────────────────────────────────

const PROJECT_TYPE_COLORS: Record<ProjectMemoryType, string> = {
  analysis: "#3B82F6",
  decision: "#8B5CF6",
  artifact: "#10B981",
  issue: "#EF4444",
  progress: "#F59E0B",
  note: "#64748b",
};

const PROJECT_TYPE_LABELS: Record<ProjectMemoryType, string> = {
  analysis: "Análise",
  decision: "Decisão",
  artifact: "Artefato",
  issue: "Problema",
  progress: "Progresso",
  note: "Nota",
};

const DEV_CATEGORY_COLORS: Record<DevMemoryCategory, string> = {
  preference: "#D97706",
  pattern: "#8B5CF6",
  convention: "#3B82F6",
  tool: "#10B981",
  workflow: "#EC4899",
};

const DEV_CATEGORY_LABELS: Record<DevMemoryCategory, string> = {
  preference: "Preferência",
  pattern: "Padrão",
  convention: "Convenção",
  tool: "Ferramenta",
  workflow: "Workflow",
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

// ─── Shared styles ───────────────────────────────────────────────────────────

const inputStyle: React.CSSProperties = {
  width: "100%",
  background: "#1e293b",
  border: "1px solid #334155",
  borderRadius: 8,
  padding: "9px 12px",
  color: "#e2e8f0",
  fontSize: 13,
  fontFamily: "inherit",
  outline: "none",
  boxSizing: "border-box",
  transition: "border-color 0.2s",
};

const labelStyle: React.CSSProperties = {
  display: "block",
  fontSize: 11,
  color: "#94a3b8",
  marginBottom: 6,
  fontFamily: "inherit",
  fontWeight: 600,
  letterSpacing: 0.5,
  textTransform: "uppercase",
};

// ─── Props ───────────────────────────────────────────────────────────────────

interface ProjectMemoryPanelProps {
  projectId: string;
}

// ─── Main Component ──────────────────────────────────────────────────────────

export function ProjectMemoryPanel({ projectId }: ProjectMemoryPanelProps) {
  const [activeTab, setActiveTab] = useState<"project" | "dev">("project");

  // Carrega memórias do Supabase ao montar
  useEffect(() => {
    useMemoryStore.getState().loadMemories(projectId).catch(() => {
      console.warn("[ProjectMemoryPanel] Falha ao carregar memórias");
    });
  }, [projectId]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Tabs */}
      <div style={{ display: "flex", gap: 4 }}>
        <TabButton
          label="Projeto"
          isActive={activeTab === "project"}
          color="#3B82F6"
          onClick={() => setActiveTab("project")}
        />
        <TabButton
          label="Desenvolvimento"
          isActive={activeTab === "dev"}
          color="#8B5CF6"
          onClick={() => setActiveTab("dev")}
        />
      </div>

      {/* Content */}
      <div
        style={{
          maxHeight: 400,
          overflowY: "auto",
          paddingRight: 4,
        }}
      >
        {activeTab === "project" ? (
          <ProjectTab projectId={projectId} />
        ) : (
          <DevTab projectId={projectId} />
        )}
      </div>
    </div>
  );
}

// ─── Tab Button ──────────────────────────────────────────────────────────────

function TabButton({
  label,
  isActive,
  color,
  onClick,
}: {
  label: string;
  isActive: boolean;
  color: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        flex: 1,
        padding: "8px 16px",
        fontSize: 12,
        fontWeight: 700,
        fontFamily: "inherit",
        color: isActive ? "#fff" : "#94a3b8",
        background: isActive ? `${color}20` : "transparent",
        border: `1px solid ${isActive ? color : "#334155"}`,
        borderRadius: 8,
        cursor: "pointer",
        transition: "all 0.2s",
        letterSpacing: 0.3,
      }}
    >
      {label}
    </button>
  );
}

// ─── Project Tab ─────────────────────────────────────────────────────────────

function ProjectTab({ projectId }: { projectId: string }) {
  const allProjectMemories = useMemoryStore((s) => s.projectMemories);
  const projectMemories = useMemo(
    () => allProjectMemories.filter((m) => m.projectId === projectId),
    [allProjectMemories, projectId],
  );
  const addProjectMemory = useMemoryStore((s) => s.addProjectMemory);
  const deleteProjectMemory = useMemoryStore((s) => s.deleteProjectMemory);

  const [showForm, setShowForm] = useState(false);
  const [noteTitle, setNoteTitle] = useState("");
  const [noteContent, setNoteContent] = useState("");

  const handleAddNote = useCallback(() => {
    if (!noteTitle.trim() || !noteContent.trim()) return;
    addProjectMemory({
      projectId,
      agentRole: "user",
      type: "note",
      title: noteTitle.trim(),
      content: noteContent.trim(),
    });
    setNoteTitle("");
    setNoteContent("");
    setShowForm(false);
  }, [noteTitle, noteContent, projectId, addProjectMemory]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {/* Add note button */}
      {!showForm && (
        <button
          type="button"
          onClick={() => setShowForm(true)}
          style={{
            padding: "8px 14px",
            fontSize: 12,
            fontWeight: 700,
            fontFamily: "inherit",
            color: "#3B82F6",
            background: "#3B82F610",
            border: "1px dashed #3B82F640",
            borderRadius: 8,
            cursor: "pointer",
            transition: "border-color 0.2s",
          }}
        >
          + Adicionar nota
        </button>
      )}

      {/* Add note form */}
      {showForm && (
        <div
          style={{
            background: "#0c1322",
            border: "1px solid #1e293b",
            borderRadius: 8,
            padding: 14,
            display: "flex",
            flexDirection: "column",
            gap: 10,
          }}
        >
          <div>
            <label style={labelStyle}>Título</label>
            <input
              type="text"
              value={noteTitle}
              onChange={(e) => setNoteTitle(e.target.value)}
              placeholder="Título da nota..."
              style={inputStyle}
              autoComplete="off"
              autoFocus
            />
          </div>
          <div>
            <label style={labelStyle}>Conteúdo</label>
            <textarea
              value={noteContent}
              onChange={(e) => setNoteContent(e.target.value)}
              placeholder="Conteúdo da nota..."
              rows={3}
              style={{ ...inputStyle, resize: "vertical", minHeight: 60, lineHeight: 1.5 }}
            />
          </div>
          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
            <button
              type="button"
              onClick={() => {
                setShowForm(false);
                setNoteTitle("");
                setNoteContent("");
              }}
              style={{
                padding: "6px 14px",
                fontSize: 11,
                fontWeight: 600,
                fontFamily: "inherit",
                color: "#94a3b8",
                background: "none",
                border: "1px solid #334155",
                borderRadius: 6,
                cursor: "pointer",
              }}
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleAddNote}
              disabled={!noteTitle.trim() || !noteContent.trim()}
              style={{
                padding: "6px 14px",
                fontSize: 11,
                fontWeight: 700,
                fontFamily: "inherit",
                color: "#fff",
                background:
                  noteTitle.trim() && noteContent.trim()
                    ? "linear-gradient(135deg, #3B82F6, #2563EB)"
                    : "#334155",
                border: "none",
                borderRadius: 6,
                cursor:
                  noteTitle.trim() && noteContent.trim()
                    ? "pointer"
                    : "not-allowed",
                opacity: noteTitle.trim() && noteContent.trim() ? 1 : 0.5,
              }}
            >
              Salvar
            </button>
          </div>
        </div>
      )}

      {/* Entries */}
      {projectMemories.length === 0 && !showForm && (
        <div
          style={{
            textAlign: "center",
            padding: "32px 24px",
            color: "#475569",
            fontSize: 12,
          }}
        >
          Nenhuma memória do projeto ainda.
        </div>
      )}

      {projectMemories.map((entry) => {
        const color = PROJECT_TYPE_COLORS[entry.type];
        return (
          <div
            key={entry.id}
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
              <span style={{ fontSize: 13 }}>
                {getAgentEmoji(entry.agentRole)}
              </span>
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
                {PROJECT_TYPE_LABELS[entry.type]}
              </span>
              <span
                style={{
                  fontSize: 10,
                  color: "#475569",
                  marginLeft: "auto",
                }}
              >
                {formatTimestamp(entry.createdAt)}
              </span>
              <button
                type="button"
                onClick={() => deleteProjectMemory(entry.id)}
                title="Excluir"
                style={{
                  background: "none",
                  border: "none",
                  color: "#475569",
                  fontSize: 12,
                  cursor: "pointer",
                  padding: "2px 4px",
                  fontFamily: "inherit",
                  transition: "color 0.2s",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.color = "#EF4444";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.color = "#475569";
                }}
              >
                {"\u2715"}
              </button>
            </div>
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
      })}
    </div>
  );
}

// ─── Dev Tab ─────────────────────────────────────────────────────────────────

function DevTab({ projectId }: { projectId: string }) {
  const devMemories = useMemoryStore((s) => s.devMemories);
  const addDevMemory = useMemoryStore((s) => s.addDevMemory);
  const deleteDevMemory = useMemoryStore((s) => s.deleteDevMemory);

  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [category, setCategory] = useState<DevMemoryCategory>("preference");

  const handleAdd = useCallback(() => {
    if (!title.trim() || !content.trim()) return;
    addDevMemory({
      category,
      title: title.trim(),
      content: content.trim(),
      learnedFrom: projectId || "manual",
    });
    setTitle("");
    setContent("");
    setCategory("preference");
    setShowForm(false);
  }, [title, content, category, projectId, addDevMemory]);

  const categories: DevMemoryCategory[] = [
    "preference",
    "pattern",
    "convention",
    "tool",
    "workflow",
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {/* Add button */}
      {!showForm && (
        <button
          type="button"
          onClick={() => setShowForm(true)}
          style={{
            padding: "8px 14px",
            fontSize: 12,
            fontWeight: 700,
            fontFamily: "inherit",
            color: "#8B5CF6",
            background: "#8B5CF610",
            border: "1px dashed #8B5CF640",
            borderRadius: 8,
            cursor: "pointer",
            transition: "border-color 0.2s",
          }}
        >
          + Adicionar memória
        </button>
      )}

      {/* Add form */}
      {showForm && (
        <div
          style={{
            background: "#0c1322",
            border: "1px solid #1e293b",
            borderRadius: 8,
            padding: 14,
            display: "flex",
            flexDirection: "column",
            gap: 10,
          }}
        >
          <div>
            <label style={labelStyle}>Categoria</label>
            <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
              {categories.map((cat) => {
                const isActive = category === cat;
                const catColor = DEV_CATEGORY_COLORS[cat];
                return (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setCategory(cat)}
                    style={{
                      padding: "4px 10px",
                      fontSize: 10,
                      fontWeight: 700,
                      fontFamily: "inherit",
                      color: isActive ? "#fff" : catColor,
                      background: isActive ? `${catColor}30` : "transparent",
                      border: `1px solid ${isActive ? catColor : "#334155"}`,
                      borderRadius: 6,
                      cursor: "pointer",
                      textTransform: "uppercase",
                      letterSpacing: 0.3,
                      transition: "all 0.2s",
                    }}
                  >
                    {DEV_CATEGORY_LABELS[cat]}
                  </button>
                );
              })}
            </div>
          </div>
          <div>
            <label style={labelStyle}>Título</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ex: Sempre usar ESLint com Prettier..."
              style={inputStyle}
              autoComplete="off"
              autoFocus
            />
          </div>
          <div>
            <label style={labelStyle}>Conteúdo</label>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Descreva o aprendizado, preferência ou convenção..."
              rows={3}
              style={{ ...inputStyle, resize: "vertical", minHeight: 60, lineHeight: 1.5 }}
            />
          </div>
          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
            <button
              type="button"
              onClick={() => {
                setShowForm(false);
                setTitle("");
                setContent("");
              }}
              style={{
                padding: "6px 14px",
                fontSize: 11,
                fontWeight: 600,
                fontFamily: "inherit",
                color: "#94a3b8",
                background: "none",
                border: "1px solid #334155",
                borderRadius: 6,
                cursor: "pointer",
              }}
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleAdd}
              disabled={!title.trim() || !content.trim()}
              style={{
                padding: "6px 14px",
                fontSize: 11,
                fontWeight: 700,
                fontFamily: "inherit",
                color: "#fff",
                background:
                  title.trim() && content.trim()
                    ? "linear-gradient(135deg, #8B5CF6, #7C3AED)"
                    : "#334155",
                border: "none",
                borderRadius: 6,
                cursor:
                  title.trim() && content.trim()
                    ? "pointer"
                    : "not-allowed",
                opacity: title.trim() && content.trim() ? 1 : 0.5,
              }}
            >
              Salvar
            </button>
          </div>
        </div>
      )}

      {/* Entries */}
      {devMemories.length === 0 && !showForm && (
        <div
          style={{
            textAlign: "center",
            padding: "32px 24px",
            color: "#475569",
            fontSize: 12,
          }}
        >
          Nenhuma memória de desenvolvimento ainda.
        </div>
      )}

      {devMemories.map((entry) => {
        const color = DEV_CATEGORY_COLORS[entry.category];
        return (
          <div
            key={entry.id}
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
                {DEV_CATEGORY_LABELS[entry.category]}
              </span>
              <span
                style={{
                  fontSize: 10,
                  color: "#475569",
                  marginLeft: "auto",
                }}
              >
                {formatTimestamp(entry.updatedAt)}
              </span>
              <button
                type="button"
                onClick={() => deleteDevMemory(entry.id)}
                title="Excluir"
                style={{
                  background: "none",
                  border: "none",
                  color: "#475569",
                  fontSize: 12,
                  cursor: "pointer",
                  padding: "2px 4px",
                  fontFamily: "inherit",
                  transition: "color 0.2s",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.color = "#EF4444";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.color = "#475569";
                }}
              >
                {"\u2715"}
              </button>
            </div>
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
            {entry.learnedFrom !== "manual" && (
              <div
                style={{
                  fontSize: 10,
                  color: "#334155",
                  marginTop: 4,
                }}
              >
                Aprendido em: {entry.learnedFrom}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
