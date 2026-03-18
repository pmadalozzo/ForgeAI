/**
 * Modal de seleção/criação de projetos.
 * Exibe lista de projetos existentes e formulário para criar novo projeto.
 * Abre como overlay sobre o escritório (padrão SettingsModal).
 */
import { useState, useCallback, useEffect, useRef } from "react";
import { useProjectStore } from "@/stores/project-store";
import { useAuthStore } from "@/stores/auth-store";
import { useProjects } from "@/hooks/useProjects";
import type { CreateProjectInput } from "@/hooks/useProjects";
import type { Project } from "@/types/agents";

/** Tipo de fonte do projeto (UI) */
type SourceType = "text" | "local" | "git";
import {
  startDeviceFlow,
  pollDeviceFlow,
  validateToken,
  GITHUB_NEW_TOKEN_URL,
} from "@/services/auth/github-auth";
import type { DeviceFlowResponse } from "@/services/auth/github-auth";
import { useChatStore } from "@/stores/chat-store";
import { ProjectAnalysisPanel } from "./ProjectAnalysisPanel";
import { ProjectMemoryPanel } from "./ProjectMemoryPanel";

/** SubView type para controlar qual tela mostrar no modal */
type SubView =
  | { type: "list" }
  | { type: "new" }
  | { type: "edit"; projectId: string }
  | { type: "analysis"; projectId: string }
  | { type: "memory"; projectId: string };

// ─── Constants ──────────────────────────────────────────────────────────────

const SOURCE_OPTIONS: Array<{
  value: SourceType;
  label: string;
  description: string;
  icon: string;
}> = [
  { value: "text", label: "Texto", description: "Descreva o que deseja construir", icon: "\u{1F4DD}" },
  { value: "local", label: "Pasta Local", description: "Pasta existente no computador", icon: "\u{1F4C1}" },
  { value: "git", label: "Repositório Git", description: "Clone de um repo remoto", icon: "\u{1F517}" },
];

const SOURCE_ICON: Record<SourceType, string> = {
  text: "\u{1F4DD}",
  local: "\u{1F4C1}",
  git: "\u{1F517}",
};

const STATUS_LABELS: Record<Project["status"], string> = {
  setup: "Configurando",
  planning: "Planejando",
  "in-progress": "Em progresso",
  review: "Em revisão",
  done: "Concluído",
  paused: "Pausado",
};

const STATUS_COLORS: Record<Project["status"], string> = {
  setup: "#64748b",
  planning: "#F59E0B",
  "in-progress": "#3B82F6",
  review: "#8B5CF6",
  done: "#10B981",
  paused: "#94a3b8",
};

function formatDate(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" });
  } catch {
    return iso;
  }
}

function getSourceType(project: Project): SourceType {
  if (project.gitUrl) return "git";
  if (project.localPath) return "local";
  return "text";
}

async function openFolderDialog(): Promise<string | null> {
  // Modo browser: retorna null — o usuário digita o caminho manualmente
  return null;
}

// ─── Shared Styles ──────────────────────────────────────────────────────────

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

const smallBtnStyle: React.CSSProperties = {
  background: "none",
  border: "1px solid #334155",
  borderRadius: 6,
  padding: "2px 8px",
  color: "#94a3b8",
  fontSize: 11,
  fontWeight: 600,
  fontFamily: "inherit",
  cursor: "pointer",
};

// ─── Props ──────────────────────────────────────────────────────────────────

interface ProjectModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** Se true, o modal não pode ser fechado (sem projeto ativo) */
  mandatory?: boolean;
}

// ─── Main Component ─────────────────────────────────────────────────────────

export function ProjectModal({ isOpen, onClose, mandatory = false }: ProjectModalProps) {
  const { projects, select, remove, update, create } = useProjects();

  const hasProjects = projects.length > 0;
  const [subView, setSubView] = useState<SubView>(hasProjects ? { type: "list" } : { type: "new" });
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  // Reset view when modal opens
  useEffect(() => {
    if (isOpen) {
      setSubView(hasProjects ? { type: "list" } : { type: "new" });
      setConfirmDeleteId(null);
    }
  }, [isOpen, hasProjects]);

  const handleSelectProject = useCallback(
    (id: string) => {
      select(id);
      onClose();
    },
    [select, onClose],
  );

  const handleDelete = useCallback(
    (id: string) => {
      void remove(id);
      setConfirmDeleteId(null);
    },
    [remove],
  );

  const handleProjectCreated = useCallback(() => {
    // Após criar, pega o projeto recém-criado e inicia automaticamente
    const state = useProjectStore.getState();
    const newProject = state.activeProjectId
      ? state.projects.find((p) => p.id === state.activeProjectId)
      : null;

    if (newProject) {
      void update(newProject.id, { status: "in-progress" });
      onClose();
      const startPrompt = `[PROJETO INICIADO] "${newProject.name}"\n\n${newProject.description}\n\nAnalise o projeto, decomponha em tarefas e distribua para os agentes.`;
      useChatStore.getState().injectMessage(startPrompt);
    } else {
      onClose();
    }
  }, [onClose, update]);

  const handleStartProject = useCallback(
    (id: string) => {
      const project = projects.find((p) => p.id === id);
      if (!project) return;

      void update(id, { status: "in-progress" });
      select(id);
      onClose();

      const startPrompt = `[PROJETO INICIADO] "${project.name}"\n\n${project.description}\n\nAnalise o projeto, decomponha em tarefas e distribua para os agentes.`;
      useChatStore.getState().injectMessage(startPrompt);
    },
    [update, select, onClose, projects],
  );

  const handleContinueProject = useCallback(
    (id: string) => {
      const project = projects.find((p) => p.id === id);
      if (!project) return;

      select(id);
      onClose();

      const continuePrompt = `[CONTINUAR PROJETO] "${project.name}"\n\nContinue o trabalho no projeto. Verifique o progresso atual e retome as tarefas pendentes.`;
      useChatStore.getState().injectMessage(continuePrompt);
    },
    [select, onClose, projects],
  );

  // Evita fechar modal ao selecionar texto
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
        background: "rgba(0, 0, 0, 0.7)",
        backdropFilter: "blur(4px)",
        fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
      }}
      onMouseDown={(e) => { mouseDownTarget.current = e.target; }}
      onClick={mandatory ? undefined : (e) => {
        if (e.target === e.currentTarget && mouseDownTarget.current === e.currentTarget) onClose();
      }}
    >
      <div
        style={{
          width: "70%",
          height: "80%",
          background: "#111827",
          border: "1px solid #1e293b",
          borderRadius: 16,
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
          boxShadow: "0 25px 60px rgba(0, 0, 0, 0.6)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "18px 24px",
            borderBottom: "1px solid #1e293b",
            background: "#0f172a",
            flexShrink: 0,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontSize: 20 }}>{"\u{1F3ED}"}</span>
            <h2 style={{ fontSize: 16, fontWeight: 700, color: "#e2e8f0", margin: 0 }}>
              {subView.type === "list"
                ? "Projetos"
                : subView.type === "new"
                  ? "Novo Projeto"
                  : subView.type === "edit"
                    ? "Editar Projeto"
                    : subView.type === "analysis"
                      ? "Análise do Projeto"
                      : "Memória"}
            </h2>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {/* Toggle entre views */}
            {subView.type === "list" && (
              <button
                type="button"
                onClick={() => setSubView({ type: "new" })}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  padding: "7px 16px",
                  fontSize: 12,
                  fontWeight: 700,
                  fontFamily: "inherit",
                  color: "#fff",
                  background: "linear-gradient(135deg, #3B82F6, #8B5CF6)",
                  border: "none",
                  borderRadius: 8,
                  cursor: "pointer",
                  letterSpacing: 0.3,
                  transition: "opacity 0.2s",
                }}
                onMouseEnter={(e) => { e.currentTarget.style.opacity = "0.85"; }}
                onMouseLeave={(e) => { e.currentTarget.style.opacity = "1"; }}
              >
                + Novo Projeto
              </button>
            )}
            {subView.type !== "list" && (
              <button
                type="button"
                onClick={() => setSubView({ type: "list" })}
                style={{
                  padding: "7px 14px",
                  fontSize: 12,
                  fontWeight: 600,
                  fontFamily: "inherit",
                  color: "#94a3b8",
                  background: "none",
                  border: "1px solid #334155",
                  borderRadius: 8,
                  cursor: "pointer",
                  transition: "border-color 0.2s, color 0.2s",
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
                {"\u2190"} Voltar
              </button>
            )}
            {/* Close button */}
            {!mandatory && (
              <button
                type="button"
                onClick={onClose}
                style={{
                  background: "none",
                  border: "1px solid #334155",
                  borderRadius: 8,
                  padding: "5px 10px",
                  color: "#64748b",
                  fontSize: 14,
                  cursor: "pointer",
                  fontFamily: "inherit",
                  transition: "border-color 0.2s, color 0.2s",
                  lineHeight: 1,
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = "#EF4444";
                  e.currentTarget.style.color = "#EF4444";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = "#334155";
                  e.currentTarget.style.color = "#64748b";
                }}
              >
                {"\u2715"}
              </button>
            )}
          </div>
        </div>

        {/* Content */}
        <div
          style={{
            flex: 1,
            overflow: "auto",
            padding: 24,
          }}
        >
          {subView.type === "list" ? (
            <ProjectList
              projects={projects}
              confirmDeleteId={confirmDeleteId}
              onSelect={handleSelectProject}
              onDelete={handleDelete}
              onConfirmDelete={setConfirmDeleteId}
              onStart={handleStartProject}
              onContinue={handleContinueProject}
              onOpenAnalysis={(projectId) => setSubView({ type: "analysis", projectId })}
              onOpenMemory={(projectId) => setSubView({ type: "memory", projectId })}
              onEdit={(projectId) => setSubView({ type: "edit", projectId })}
            />
          ) : subView.type === "new" ? (
            <NewProjectForm
              onCreated={handleProjectCreated}
              createProject={create}
            />
          ) : subView.type === "edit" ? (
            <EditProjectForm
              projectId={subView.projectId}
              onSaved={() => setSubView({ type: "list" })}
            />
          ) : subView.type === "analysis" ? (
            <ProjectAnalysisPanel projectId={subView.projectId} />
          ) : (
            <ProjectMemoryPanel projectId={subView.projectId} />
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Project List ───────────────────────────────────────────────────────────

interface ProjectListProps {
  projects: Project[];
  confirmDeleteId: string | null;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
  onConfirmDelete: (id: string | null) => void;
  onStart: (id: string) => void;
  onOpenAnalysis: (projectId: string) => void;
  onOpenMemory: (projectId: string) => void;
  onEdit: (projectId: string) => void;
}

function ProjectList({ projects, confirmDeleteId, onSelect, onDelete, onConfirmDelete, onStart, onOpenAnalysis, onOpenMemory, onEdit, onContinue }: ProjectListProps & { onContinue: (id: string) => void }) {
  if (projects.length === 0) {
    return (
      <div style={{ textAlign: "center", padding: "40px 0", color: "#475569" }}>
        <span style={{ fontSize: 40, display: "block", marginBottom: 12 }}>{"\u{1F4E6}"}</span>
        <p style={{ fontSize: 14, margin: 0 }}>Nenhum projeto ainda</p>
        <p style={{ fontSize: 12, margin: "6px 0 0 0" }}>Crie seu primeiro projeto para começar</p>
      </div>
    );
  }

  /** Estilo base para botões de ícone */
  const iconBtn = (color: string): React.CSSProperties => ({
    width: 32,
    height: 32,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 14,
    background: "none",
    border: `1px solid ${color}30`,
    borderRadius: 8,
    color,
    cursor: "pointer",
    fontFamily: "inherit",
    transition: "background 0.15s, border-color 0.15s",
    flexShrink: 0,
  });

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {[...projects].reverse().map((proj) => {
        const src = getSourceType(proj);
        const isConfirming = confirmDeleteId === proj.id;
        const statusColor = STATUS_COLORS[proj.status];
        const isActive = proj.status === "in-progress" || proj.status === "review";
        const isPaused = proj.status === "paused";
        const isDone = proj.status === "done";

        // Texto e cor do botão principal
        const primaryLabel = isDone ? "Ver" : isActive ? "Continuar" : isPaused ? "Retomar" : "Iniciar";
        const primaryGradient = isDone
          ? "linear-gradient(135deg, #64748b, #475569)"
          : isActive
            ? "linear-gradient(135deg, #10B981, #059669)"
            : isPaused
              ? "linear-gradient(135deg, #F59E0B, #D97706)"
              : "linear-gradient(135deg, #3B82F6, #2563EB)";
        const primaryAction = isActive ? () => onContinue(proj.id) : () => onStart(proj.id);

        return (
          <div
            key={proj.id}
            style={{
              background: "#0c1322",
              border: `1px solid ${isActive ? statusColor + "40" : "#1e293b"}`,
              borderRadius: 12,
              padding: 16,
              transition: "border-color 0.2s, background 0.2s",
              display: "flex",
              flexDirection: "column",
              gap: 12,
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = statusColor;
              e.currentTarget.style.background = "#0f172a";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = isActive ? statusColor + "40" : "#1e293b";
              e.currentTarget.style.background = "#0c1322";
            }}
          >
            {/* Linha 1: Icon + Info + Status badge */}
            <div
              style={{ display: "flex", alignItems: "flex-start", gap: 14, cursor: "pointer" }}
              onClick={() => onSelect(proj.id)}
            >
              <div
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 10,
                  background: `${statusColor}15`,
                  border: `1px solid ${statusColor}30`,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 18,
                  flexShrink: 0,
                }}
              >
                {SOURCE_ICON[src]}
              </div>

              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 3 }}>
                  <span
                    style={{
                      fontSize: 14,
                      fontWeight: 700,
                      color: "#e2e8f0",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {proj.name}
                  </span>
                  <span
                    style={{
                      fontSize: 9,
                      fontWeight: 700,
                      color: statusColor,
                      background: `${statusColor}15`,
                      padding: "2px 8px",
                      borderRadius: 4,
                      letterSpacing: 0.5,
                      textTransform: "uppercase",
                      flexShrink: 0,
                    }}
                  >
                    {STATUS_LABELS[proj.status]}
                  </span>
                </div>
                <p
                  style={{
                    fontSize: 12,
                    color: "#64748b",
                    margin: 0,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                    lineHeight: 1.4,
                  }}
                >
                  {proj.description}
                </p>
                <span style={{ fontSize: 10, color: "#334155", marginTop: 3, display: "inline-block" }}>
                  {formatDate(proj.createdAt)}
                  {proj.progress > 0 && (
                    <span style={{ color: "#10B981", marginLeft: 8 }}>{proj.progress}%</span>
                  )}
                </span>
              </div>
            </div>

            {/* Linha 2: Ações — primário à esquerda, utilitários à direita */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                borderTop: "1px solid #1e293b",
                paddingTop: 10,
              }}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Botão principal */}
              <button
                type="button"
                onClick={primaryAction}
                style={{
                  padding: "6px 18px",
                  fontSize: 11,
                  fontWeight: 700,
                  fontFamily: "inherit",
                  color: "#fff",
                  background: primaryGradient,
                  border: "none",
                  borderRadius: 6,
                  cursor: "pointer",
                  letterSpacing: 0.3,
                }}
              >
                {primaryLabel}
              </button>

              {/* Botões utilitários — ícones */}
              <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                <button
                  type="button"
                  onClick={() => onOpenAnalysis(proj.id)}
                  title="Análise"
                  style={iconBtn("#3B82F6")}
                  onMouseEnter={(e) => { e.currentTarget.style.background = "#3B82F615"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = "none"; }}
                >
                  {"\u{1F4CA}"}
                </button>
                <button
                  type="button"
                  onClick={() => onOpenMemory(proj.id)}
                  title="Memória"
                  style={iconBtn("#8B5CF6")}
                  onMouseEnter={(e) => { e.currentTarget.style.background = "#8B5CF615"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = "none"; }}
                >
                  {"\u{1F9E0}"}
                </button>
                <button
                  type="button"
                  onClick={() => onEdit(proj.id)}
                  title="Editar"
                  style={iconBtn("#F59E0B")}
                  onMouseEnter={(e) => { e.currentTarget.style.background = "#F59E0B15"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = "none"; }}
                >
                  {"\u270F\uFE0F"}
                </button>

                {/* Delete com confirmação */}
                {isConfirming ? (
                  <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
                    <button
                      type="button"
                      onClick={() => onDelete(proj.id)}
                      style={{
                        ...smallBtnStyle,
                        color: "#EF4444",
                        borderColor: "#EF4444",
                        fontSize: 10,
                        padding: "4px 10px",
                      }}
                    >
                      Confirmar
                    </button>
                    <button
                      type="button"
                      onClick={() => onConfirmDelete(null)}
                      style={{ ...smallBtnStyle, fontSize: 10, padding: "4px 10px" }}
                    >
                      Cancelar
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => onConfirmDelete(proj.id)}
                    title="Excluir"
                    style={iconBtn("#64748b")}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.color = "#EF4444";
                      e.currentTarget.style.borderColor = "#EF444440";
                      e.currentTarget.style.background = "#EF444410";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.color = "#64748b";
                      e.currentTarget.style.borderColor = "#64748b30";
                      e.currentTarget.style.background = "none";
                    }}
                  >
                    {"\u{1F5D1}"}
                  </button>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── New Project Form ───────────────────────────────────────────────────────

interface NewProjectFormProps {
  onCreated: () => void;
  createProject: (input: CreateProjectInput) => Promise<Project | null>;
}

function NewProjectForm({ onCreated, createProject }: NewProjectFormProps) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [sourceType, setSourceType] = useState<SourceType>("text");
  const [localPath, setLocalPath] = useState("");
  const [gitUrl, setGitUrl] = useState("");
  const [gitBranch, setGitBranch] = useState("");
  const [gitToken, setGitToken] = useState("");
  const [showTokenField, setShowTokenField] = useState(false);

  // Device Flow state
  const [deviceFlow, setDeviceFlow] = useState<DeviceFlowResponse | null>(null);
  const [deviceFlowStatus, setDeviceFlowStatus] = useState<"idle" | "waiting" | "success" | "error" | "expired">("idle");
  const [deviceFlowError, setDeviceFlowError] = useState("");
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const githubAuth = useAuthStore((s) => s.github);
  const setGitHubToken = useAuthStore((s) => s.setGitHubToken);

  const canSubmit =
    name.trim().length > 0 &&
    description.trim().length > 0 &&
    (sourceType === "text" ||
      (sourceType === "local" && localPath.trim().length > 0) ||
      (sourceType === "git" && gitUrl.trim().length > 0));

  useEffect(() => {
    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, []);

  const handleSubmit = useCallback(() => {
    if (!canSubmit) return;

    let sourcePath: string | null = null;
    let branch: string | null = null;

    if (sourceType === "local") {
      sourcePath = localPath.trim();
    } else if (sourceType === "git") {
      sourcePath = gitUrl.trim();
      branch = gitBranch.trim() || null;
    }

    void createProject({
      name: name.trim(),
      description: description.trim(),
      sourceType,
      sourcePath,
      gitBranch: branch,
    }).then(() => onCreated());
  }, [canSubmit, name, description, sourceType, localPath, gitUrl, gitBranch, createProject, onCreated]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && e.ctrlKey && canSubmit) {
      handleSubmit();
    }
  };

  const handleGitHubAuth = useCallback(async () => {
    if (githubAuth.isAuthenticated) return;

    const clientId = import.meta.env.GITHUB_CLIENT_ID || import.meta.env.VITE_GITHUB_CLIENT_ID;

    if (!clientId) {
      window.open(GITHUB_NEW_TOKEN_URL, "_blank", "noopener");
      setShowTokenField(true);
      setDeviceFlowStatus("idle");
      setDeviceFlowError("");
      return;
    }

    setDeviceFlowStatus("waiting");
    setDeviceFlowError("");

    const flow = await startDeviceFlow(clientId);
    if (!flow) {
      window.open(GITHUB_NEW_TOKEN_URL, "_blank", "noopener");
      setShowTokenField(true);
      setDeviceFlowStatus("error");
      setDeviceFlowError("Device Flow indisponível. Cole o token criado abaixo.");
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
          setDeviceFlowStatus("success");
        } else {
          setDeviceFlowStatus("error");
          setDeviceFlowError("Token obtido mas falha na validação.");
        }
      } else if (result.status === "expired") {
        if (pollingRef.current) clearInterval(pollingRef.current);
        pollingRef.current = null;
        setDeviceFlowStatus("expired");
      } else if (result.status === "error") {
        if (pollingRef.current) clearInterval(pollingRef.current);
        pollingRef.current = null;
        setDeviceFlowStatus("error");
        setDeviceFlowError(result.message);
      }
    }, interval);
  }, [githubAuth.isAuthenticated, setGitHubToken]);

  const handleValidatePAT = useCallback(async () => {
    if (!gitToken.trim()) return;
    setDeviceFlowStatus("waiting");
    const result = await validateToken(gitToken.trim());
    if (result.valid && result.username) {
      setGitHubToken(gitToken.trim(), result.username, result.avatarUrl ?? "");
      setDeviceFlowStatus("success");
    } else {
      setDeviceFlowStatus("error");
      setDeviceFlowError(result.error ?? "Token inválido");
    }
  }, [gitToken, setGitHubToken]);

  return (
    <div onKeyDown={handleKeyDown}>
      {/* Nome */}
      <div style={{ marginBottom: 16 }}>
        <label style={labelStyle}>Nome do Projeto</label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Ex: MeuApp, E-commerce, Dashboard..."
          style={inputStyle}
          autoComplete="off"
          autoFocus
        />
      </div>

      {/* Descrição */}
      <div style={{ marginBottom: 16 }}>
        <label style={labelStyle}>Descrição do Projeto</label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Descreva o que deseja construir. Seja detalhado: funcionalidades, tecnologias, público-alvo..."
          rows={3}
          style={{
            ...inputStyle,
            resize: "vertical",
            minHeight: 80,
            lineHeight: 1.6,
          }}
        />
      </div>

      {/* Tipo de fonte */}
      <div style={{ marginBottom: 16 }}>
        <label style={labelStyle}>Fonte do Projeto</label>
        <div style={{ display: "flex", gap: 8 }}>
          {SOURCE_OPTIONS.map((opt) => {
            const isActive = sourceType === opt.value;
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => setSourceType(opt.value)}
                style={{
                  flex: 1,
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: 4,
                  padding: "12px 8px",
                  background: isActive ? "#1e293b" : "#0c1322",
                  border: `1px solid ${isActive ? "#3B82F6" : "#1e293b"}`,
                  borderRadius: 10,
                  cursor: "pointer",
                  fontFamily: "inherit",
                  transition: "border-color 0.2s, background 0.2s",
                }}
              >
                <span style={{ fontSize: 20 }}>{opt.icon}</span>
                <span style={{ fontSize: 12, fontWeight: 700, color: isActive ? "#e2e8f0" : "#94a3b8" }}>
                  {opt.label}
                </span>
                <span style={{ fontSize: 10, color: "#64748b", textAlign: "center", lineHeight: 1.3 }}>
                  {opt.description}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Campos condicionais: Local */}
      {sourceType === "local" && (
        <div style={{ marginBottom: 16 }}>
          <label style={labelStyle}>Caminho da Pasta</label>
          <div style={{ display: "flex", gap: 8 }}>
            <input
              type="text"
              value={localPath}
              onChange={(e) => setLocalPath(e.target.value)}
              placeholder="C:\Users\user\projetos\meu-app"
              style={{ ...inputStyle, flex: 1 }}
              autoComplete="off"
            />
          </div>
          <span style={{ fontSize: 10, color: "#475569", marginTop: 4, display: "block" }}>
            Digite o caminho absoluto da pasta do projeto
          </span>
        </div>
      )}

      {/* Campos condicionais: Git */}
      {sourceType === "git" && (
        <div style={{ marginBottom: 16, display: "flex", flexDirection: "column", gap: 10 }}>
          <div>
            <label style={labelStyle}>URL do Repositório</label>
            <input
              type="text"
              value={gitUrl}
              onChange={(e) => setGitUrl(e.target.value)}
              placeholder="https://github.com/user/repo.git"
              style={inputStyle}
              autoComplete="off"
            />
          </div>
          <div>
            <label style={labelStyle}>Branch (opcional)</label>
            <input
              type="text"
              value={gitBranch}
              onChange={(e) => setGitBranch(e.target.value)}
              placeholder="main"
              style={inputStyle}
              autoComplete="off"
            />
          </div>

          {/* GitHub Auth */}
          <div
            style={{
              background: "#0c1322",
              border: "1px solid #1e293b",
              borderRadius: 10,
              padding: 14,
            }}
          >
            <label style={{ ...labelStyle, marginBottom: 8 }}>
              Autenticação GitHub (opcional)
            </label>

            {githubAuth.isAuthenticated ? (
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                {githubAuth.avatarUrl && (
                  <img
                    src={githubAuth.avatarUrl}
                    alt=""
                    style={{ width: 24, height: 24, borderRadius: "50%" }}
                  />
                )}
                <span style={{ fontSize: 12, color: "#10B981", fontWeight: 600 }}>
                  Conectado como {githubAuth.username}
                </span>
              </div>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => void handleGitHubAuth()}
                  disabled={deviceFlowStatus === "waiting"}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    padding: "8px 14px",
                    background: deviceFlowStatus === "waiting" ? "#334155" : "#1e293b",
                    border: "1px solid #334155",
                    borderRadius: 8,
                    color: "#e2e8f0",
                    fontSize: 12,
                    fontWeight: 600,
                    fontFamily: "inherit",
                    cursor: deviceFlowStatus === "waiting" ? "wait" : "pointer",
                    marginBottom: 8,
                    width: "100%",
                    justifyContent: "center",
                    transition: "border-color 0.2s",
                  }}
                  onMouseEnter={(e) => {
                    if (deviceFlowStatus !== "waiting") e.currentTarget.style.borderColor = "#3B82F6";
                  }}
                  onMouseLeave={(e) => { e.currentTarget.style.borderColor = "#334155"; }}
                >
                  {deviceFlowStatus === "waiting" ? "Aguardando autorização..." : "Autenticar com GitHub"}
                </button>

                {deviceFlow && deviceFlowStatus === "waiting" && (
                  <div
                    style={{
                      background: "#1e293b",
                      border: "1px solid #334155",
                      borderRadius: 10,
                      padding: 14,
                      textAlign: "center",
                      marginBottom: 8,
                    }}
                  >
                    <p style={{ fontSize: 11, color: "#94a3b8", margin: "0 0 6px 0" }}>
                      Digite este código em <strong>github.com/login/device</strong>:
                    </p>
                    <div
                      style={{
                        fontSize: 24,
                        fontWeight: 800,
                        letterSpacing: 6,
                        color: "#3B82F6",
                        fontFamily: "'JetBrains Mono', monospace",
                        padding: "6px 0",
                        userSelect: "all",
                      }}
                    >
                      {deviceFlow.user_code}
                    </div>
                  </div>
                )}

                {deviceFlowStatus === "success" && (
                  <p style={{ fontSize: 11, color: "#10B981", margin: "0 0 6px 0" }}>
                    Autenticado com sucesso!
                  </p>
                )}
                {deviceFlowStatus === "expired" && (
                  <p style={{ fontSize: 11, color: "#EAB308", margin: "0 0 6px 0" }}>
                    Código expirado. Clique novamente.
                  </p>
                )}
                {deviceFlowStatus === "error" && (
                  <p style={{ fontSize: 11, color: "#EF4444", margin: "0 0 6px 0" }}>
                    {deviceFlowError}
                  </p>
                )}

                <button
                  type="button"
                  onClick={() => setShowTokenField(!showTokenField)}
                  style={{
                    background: "none",
                    border: "none",
                    color: "#64748b",
                    fontSize: 11,
                    cursor: "pointer",
                    fontFamily: "inherit",
                    padding: 0,
                    textDecoration: "underline",
                  }}
                >
                  {showTokenField ? "Ocultar campo de token" : "Ou use um Personal Access Token (PAT)"}
                </button>

                {showTokenField && (
                  <div style={{ marginTop: 8 }}>
                    <div style={{ display: "flex", gap: 8 }}>
                      <input
                        type="password"
                        value={gitToken}
                        onChange={(e) => setGitToken(e.target.value)}
                        placeholder="ghp_xxxxxxxxxxxxxxxxxxxx"
                        style={{ ...inputStyle, flex: 1 }}
                        autoComplete="off"
                      />
                      <button
                        type="button"
                        onClick={() => void handleValidatePAT()}
                        disabled={!gitToken.trim()}
                        style={{
                          padding: "9px 12px",
                          background: "#1e293b",
                          border: "1px solid #334155",
                          borderRadius: 8,
                          color: gitToken.trim() ? "#e2e8f0" : "#475569",
                          fontSize: 11,
                          fontWeight: 600,
                          fontFamily: "inherit",
                          cursor: gitToken.trim() ? "pointer" : "not-allowed",
                          whiteSpace: "nowrap",
                        }}
                      >
                        Validar
                      </button>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4 }}>
                      <span style={{ fontSize: 10, color: "#475569" }}>
                        Usado apenas para clonar o repositório
                      </span>
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
              </>
            )}
          </div>
        </div>
      )}

      {/* Submit */}
      <button
        type="button"
        onClick={handleSubmit}
        disabled={!canSubmit}
        style={{
          width: "100%",
          padding: "12px 24px",
          fontSize: 14,
          fontWeight: 700,
          fontFamily: "inherit",
          color: "#fff",
          background: canSubmit
            ? "linear-gradient(135deg, #3B82F6, #8B5CF6)"
            : "#334155",
          border: "none",
          borderRadius: 10,
          cursor: canSubmit ? "pointer" : "not-allowed",
          opacity: canSubmit ? 1 : 0.5,
          transition: "opacity 0.2s, background 0.2s",
          letterSpacing: 1,
        }}
      >
        Iniciar Projeto
      </button>
      <p
        style={{
          fontSize: 10,
          color: "#475569",
          textAlign: "center",
          marginTop: 10,
          marginBottom: 0,
        }}
      >
        Ctrl+Enter para iniciar rapidamente
      </p>
    </div>
  );
}

// ─── Edit Project Form ──────────────────────────────────────────────────────

interface EditProjectFormProps {
  projectId: string;
  onSaved: () => void;
}

function EditProjectForm({ projectId, onSaved }: EditProjectFormProps) {
  const projects = useProjectStore((s) => s.projects);
  const { update: updateProject } = useProjects();
  const project = projects.find((p) => p.id === projectId);

  const [name, setName] = useState(project?.name ?? "");
  const [description, setDescription] = useState(project?.description ?? "");
  const [localPath, setLocalPath] = useState(project?.localPath ?? "");
  const [gitUrl, setGitUrl] = useState(project?.gitUrl ?? "");
  const [gitBranch, setGitBranch] = useState(project?.gitBranch ?? "");

  const handleSave = useCallback(() => {
    void updateProject(projectId, {
      name: name.trim(),
      description: description.trim(),
      localPath: localPath.trim() || null,
      gitUrl: gitUrl.trim() || null,
      gitBranch: gitBranch.trim() || null,
    });
    onSaved();
  }, [projectId, name, description, localPath, gitUrl, gitBranch, updateProject, onSaved]);

  const handleSelectFolder = useCallback(async () => {
    const folder = await openFolderDialog();
    if (folder) setLocalPath(folder);
  }, []);

  if (!project) {
    return <div style={{ color: "#64748b", textAlign: "center", padding: 40 }}>Projeto não encontrado</div>;
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Nome */}
      <div>
        <label style={labelStyle}>Nome do Projeto</label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          style={inputStyle}
          autoComplete="off"
        />
      </div>

      {/* Descrição */}
      <div>
        <label style={labelStyle}>Descrição</label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
          style={{ ...inputStyle, resize: "vertical", lineHeight: 1.6 }}
        />
      </div>

      {/* Pasta Local */}
      <div>
        <label style={labelStyle}>Pasta Local</label>
        <div style={{ display: "flex", gap: 8 }}>
          <input
            type="text"
            value={localPath}
            onChange={(e) => setLocalPath(e.target.value)}
            placeholder="D:\Projects\MeuProjeto"
            style={{ ...inputStyle, flex: 1 }}
            autoComplete="off"
          />
          <button
            type="button"
            onClick={() => void handleSelectFolder()}
            style={{
              ...smallBtnStyle,
              padding: "8px 12px",
              fontSize: 12,
              whiteSpace: "nowrap",
            }}
          >
            Procurar
          </button>
        </div>
        <div style={{ fontSize: 10, color: "#475569", marginTop: 4 }}>
          Pasta onde o Claude CLI vai executar e criar os arquivos do projeto
        </div>
      </div>

      {/* Git URL */}
      <div>
        <label style={labelStyle}>Repositório Git (opcional)</label>
        <input
          type="text"
          value={gitUrl}
          onChange={(e) => setGitUrl(e.target.value)}
          placeholder="https://github.com/user/repo.git"
          style={inputStyle}
          autoComplete="off"
        />
      </div>

      {/* Git Branch */}
      {gitUrl && (
        <div>
          <label style={labelStyle}>Branch</label>
          <input
            type="text"
            value={gitBranch}
            onChange={(e) => setGitBranch(e.target.value)}
            placeholder="main"
            style={inputStyle}
            autoComplete="off"
          />
        </div>
      )}

      {/* Botão Salvar */}
      <button
        type="button"
        onClick={handleSave}
        disabled={!name.trim()}
        style={{
          width: "100%",
          padding: "12px 16px",
          fontSize: 14,
          fontWeight: 700,
          fontFamily: "inherit",
          color: "#fff",
          background: name.trim() ? "linear-gradient(135deg, #3B82F6, #8B5CF6)" : "#334155",
          border: "none",
          borderRadius: 10,
          cursor: name.trim() ? "pointer" : "not-allowed",
          letterSpacing: 1,
          transition: "opacity 0.2s",
        }}
      >
        Salvar Alterações
      </button>
    </div>
  );
}
