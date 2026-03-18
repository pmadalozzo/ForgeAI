/**
 * Modal de configuração de um agente — provider, modelo, skills e opções avançadas.
 * Refatorado do antigo AgentModal.tsx com tabs internas e remoção segura.
 */
import { useState, useEffect, useCallback, useRef } from "react";
import { useAgentsStore } from "@/stores/agents-store";
import { useSettingsStore, MODELS_BY_PROVIDER, PROVIDER_DISPLAY_NAMES } from "@/stores/settings-store";
import type { ClaudeEffort } from "@/stores/settings-store";
import { AgentStatus } from "@/types/agents";
import type { LLMProvider, AgentRole } from "@/types/agents";
import {
  fetchSkillsForAgent,
  createSkill,
  updateSkill,
  deleteSkill,
  getDefaultSkill,
} from "@/services/supabase/skills-service";
import type { SkillRow } from "@/services/supabase/skills-service";
import { useProjectStore } from "@/stores/project-store";

const ALL_PROVIDERS: LLMProvider[] = ["claude-code", "openai", "gemini", "ollama", "lm-studio"];

const STATUS_CONFIG: Record<AgentStatus, { label: string; color: string; icon: string }> = {
  [AgentStatus.Idle]: { label: "Idle", color: "#64748b", icon: "💤" },
  [AgentStatus.Working]: { label: "Trabalhando", color: "#10B981", icon: "⚡" },
  [AgentStatus.Blocked]: { label: "Bloqueado", color: "#EF4444", icon: "🚫" },
  [AgentStatus.Review]: { label: "Em Review", color: "#8B5CF6", icon: "👀" },
  [AgentStatus.Done]: { label: "Concluído", color: "#3B82F6", icon: "✅" },
};

/** Fallback mínimo quando SKILL.md não carrega */
const FALLBACK_SKILL = (role: string, name: string): string =>
  `# ${name}\n\n## Competências\n- Descreva as competências aqui\n\n## System Prompt\nVocê é o agente ${role} do ForgeAI.`;

/** Cache local de skills carregadas via /api/skills/:role */
const skillFileCache: Map<string, string> = new Map();

/**
 * Carrega o conteúdo do arquivo SKILL.md de um agente via endpoint.
 * Usa cache para evitar chamadas repetidas.
 */
async function loadSkillFromFile(role: string): Promise<string | null> {
  if (skillFileCache.has(role)) return skillFileCache.get(role) ?? null;
  try {
    const res = await fetch(`/api/skills/${role}`);
    if (!res.ok) return null;
    const data = await res.json() as { content: string | null };
    if (data.content) {
      skillFileCache.set(role, data.content);
    }
    return data.content;
  } catch {
    return null;
  }
}

type ConfigTab = "geral" | "skills" | "avancado";

interface AgentConfigModalProps {
  agentId: string | null;
  onClose: () => void;
  /** Se fornecido, mostra botão "Voltar" para a lista */
  onBackToList?: () => void;
}

export function AgentConfigModal({ agentId, onClose, onBackToList }: AgentConfigModalProps) {
  const agents = useAgentsStore((s) => s.agents);
  const setAgentProvider = useAgentsStore((s) => s.setAgentProvider);
  const removeAgent = useAgentsStore((s) => s.removeAgent);
  const agentDefaults = useSettingsStore((s) => s.agentDefaults);
  const setAgentDefault = useSettingsStore((s) => s.setAgentDefault);
  const activeProjectId = useProjectStore((s) => s.activeProjectId);

  const agent = agents.find((a) => a.id === agentId) ?? null;

  // Estado
  const [activeTab, setActiveTab] = useState<ConfigTab>("geral");
  const [provider, setProvider] = useState<LLMProvider>("claude-code");
  const [model, setModel] = useState("");
  const [effort, setEffort] = useState<ClaudeEffort>("high");
  const [skills, setSkills] = useState<SkillRow[]>([]);
  const [activeSkillIdx, setActiveSkillIdx] = useState(0);
  const [editContent, setEditContent] = useState("");
  const [editName, setEditName] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [confirmDeleteSkill, setConfirmDeleteSkill] = useState(false);
  const [removeCheck, setRemoveCheck] = useState(false);
  const [removeConfirmed, setRemoveConfirmed] = useState(false);

  // Carrega dados ao abrir
  useEffect(() => {
    if (!agent) return;

    const defaults = agentDefaults[agent.role as AgentRole];
    if (defaults) {
      setProvider(defaults.provider);
      setModel(defaults.model);
      setEffort(defaults.effort ?? "high");
    }

    setLoading(true);
    void (async () => {
      // 1. Tenta carregar do Supabase (skill editada pelo usuário)
      const supabaseRows = await fetchSkillsForAgent(agent.role, activeProjectId);
      const userEdited = supabaseRows.find((r) => !r.is_default && r.content.length > 100);

      if (userEdited) {
        // Usa a skill editada do Supabase
        setSkills([userEdited]);
        setActiveSkillIdx(0);
        setEditContent(userEdited.content);
        setEditName(userEdited.name);
        setLoading(false);
        return;
      }

      // 2. Carrega o SKILL.md completo do arquivo
      const fileContent = await loadSkillFromFile(agent.role);
      const content = fileContent ?? FALLBACK_SKILL(agent.role, agent.name);

      // 3. Se tem no Supabase mas é default curto, atualiza com o conteúdo completo
      const existingDefault = supabaseRows.find((r) => r.is_default);
      if (existingDefault && existingDefault.content.length < content.length) {
        void updateSkill(existingDefault.id, { content });
      }

      // 4. Se não tem nada no Supabase, salva o arquivo como default
      if (supabaseRows.length === 0 && content.length > 0) {
        const defaultSkill = getDefaultSkill(agent.role);
        void createSkill({
          agent_role: agent.role,
          name: defaultSkill.name,
          description: defaultSkill.description,
          content,
          tags: defaultSkill.tags,
          is_default: true,
          project_id: null,
        });
      }

      const defaultSkill = getDefaultSkill(agent.role);
      const row: SkillRow = {
        id: existingDefault?.id ?? "__local__",
        agent_role: agent.role,
        name: defaultSkill.name,
        description: defaultSkill.description,
        content,
        version: "1.0.0",
        tags: defaultSkill.tags ?? [],
        is_default: true,
        project_id: null,
        created_by: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      setSkills([row]);
      setActiveSkillIdx(0);
      setEditContent(content);
      setEditName(defaultSkill.name);
      setLoading(false);
    })();
  }, [agent, agentDefaults, activeProjectId]);

  // Atualiza editor quando muda de skill
  useEffect(() => {
    const skill = skills[activeSkillIdx];
    if (skill) {
      setEditContent(skill.content);
      setEditName(skill.name);
    }
  }, [activeSkillIdx, skills]);

  const handleSave = useCallback(async () => {
    if (!agent) return;
    setSaving(true);

    setAgentDefault(agent.role as AgentRole, provider, model, effort);
    setAgentProvider(agent.id, provider);

    const skill = skills[activeSkillIdx];
    if (skill) {
      if (skill.id === "__local__") {
        await createSkill({
          agent_role: agent.role,
          name: editName,
          description: skill.description,
          content: editContent,
          tags: skill.tags,
          is_default: true,
          project_id: activeProjectId,
        });
      } else {
        await updateSkill(skill.id, {
          name: editName,
          content: editContent,
        });
      }
    }

    setSaving(false);
    onClose();
  }, [agent, provider, model, skills, activeSkillIdx, editName, editContent, activeProjectId, setAgentDefault, setAgentProvider, onClose]);

  const handleAddSkill = useCallback(async () => {
    if (!agent) return;
    const newSkill = await createSkill({
      agent_role: agent.role,
      name: "Nova Skill",
      description: "Descreva esta skill",
      content: `# Nova Skill\n\n## Competências\n- \n\n## System Prompt\n\`\`\`\nDescreva o prompt aqui\n\`\`\``,
      tags: [],
      project_id: activeProjectId,
    });
    if (newSkill) {
      setSkills((prev) => [...prev, newSkill]);
      setActiveSkillIdx(skills.length);
    }
  }, [agent, activeProjectId, skills.length]);

  const handleDeleteSkill = useCallback(async () => {
    const skill = skills[activeSkillIdx];
    if (!skill || skill.id === "__local__") return;
    await deleteSkill(skill.id);
    setSkills((prev) => prev.filter((_, i) => i !== activeSkillIdx));
    setActiveSkillIdx(0);
    setConfirmDeleteSkill(false);
  }, [skills, activeSkillIdx]);

  const handleDeleteAgent = useCallback(() => {
    if (!agent || !removeCheck) return;
    removeAgent(agent.id);
    setRemoveConfirmed(false);
    setRemoveCheck(false);
    onClose();
  }, [agent, removeCheck, removeAgent, onClose]);

  if (!agent) return null;
  const statusCfg = STATUS_CONFIG[agent.status];

  // Evita fechar modal ao selecionar texto
  const mouseDownTarget = useRef<EventTarget | null>(null);

  const TABS: { key: ConfigTab; label: string }[] = [
    { key: "geral", label: "Geral" },
    { key: "skills", label: "Skills" },
    { key: "avancado", label: "Avançado" },
  ];

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
          width: 700,
          height: 550,
          background: "#0c1322",
          border: `1px solid ${agent.color}40`,
          borderRadius: 16,
          display: "flex",
          flexDirection: "column",
          fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
          boxShadow: `0 25px 60px rgba(0,0,0,0.5), 0 0 30px ${agent.color}15`,
          overflow: "hidden",
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: "14px 24px",
            background: `linear-gradient(135deg, ${agent.color}15, ${agent.color}05)`,
            borderBottom: `1px solid ${agent.color}30`,
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexShrink: 0,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            {onBackToList && (
              <button
                type="button"
                onClick={onBackToList}
                style={{
                  background: "none",
                  border: "1px solid #334155",
                  borderRadius: 6,
                  padding: "4px 10px",
                  color: "#94a3b8",
                  fontSize: 12,
                  cursor: "pointer",
                  fontFamily: "inherit",
                }}
              >
                ← Lista
              </button>
            )}
            <span style={{ fontSize: 24 }}>{agent.emoji}</span>
            <div>
              <div style={{ fontSize: 15, fontWeight: 700, color: agent.color }}>{agent.name}</div>
              <div style={{ fontSize: 10, color: "#64748b" }}>{agent.role}</div>
            </div>
            <span style={{
              fontSize: 10, color: statusCfg.color, background: `${statusCfg.color}18`,
              padding: "2px 8px", borderRadius: 4, fontWeight: 600, marginLeft: 6,
            }}>
              {statusCfg.icon} {statusCfg.label}
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{ background: "none", border: "none", color: "#475569", fontSize: 18, cursor: "pointer", fontFamily: "inherit" }}
          >
            ✕
          </button>
        </div>

        {/* Tabs */}
        <div
          style={{
            display: "flex",
            borderBottom: "1px solid #1e293b",
            padding: "0 24px",
            flexShrink: 0,
          }}
        >
          {TABS.map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key)}
              style={{
                background: "none",
                border: "none",
                borderBottom: activeTab === tab.key ? `2px solid ${agent.color}` : "2px solid transparent",
                padding: "10px 16px",
                color: activeTab === tab.key ? "#e2e8f0" : "#64748b",
                fontSize: 12,
                fontWeight: 600,
                cursor: "pointer",
                fontFamily: "inherit",
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab content */}
        <div style={{ flex: 1, overflow: "auto", padding: "16px 24px" }}>
          {/* === Tab Geral === */}
          {activeTab === "geral" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div style={{ display: "flex", gap: 12 }}>
                <div style={{ flex: 1 }}>
                  <label style={labelStyle}>Provider</label>
                  <select
                    value={provider}
                    onChange={(e) => {
                      const p = e.target.value as LLMProvider;
                      setProvider(p);
                      setModel(MODELS_BY_PROVIDER[p][0] ?? "");
                    }}
                    style={selectStyle}
                  >
                    {ALL_PROVIDERS.map((p) => (
                      <option key={p} value={p}>{PROVIDER_DISPLAY_NAMES[p]}</option>
                    ))}
                  </select>
                </div>
                <div style={{ flex: 1 }}>
                  <label style={labelStyle}>Modelo</label>
                  <select value={model} onChange={(e) => setModel(e.target.value)} style={selectStyle}>
                    {MODELS_BY_PROVIDER[provider].map((m) => (
                      <option key={m} value={m}>{m}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Effort selector */}
              <div>
                <label style={labelStyle}>Nível de Esforço</label>
                <div style={{ display: "flex", gap: 4 }}>
                  {(["low", "medium", "high", "max"] as const).map((lvl) => {
                    const colors: Record<string, string> = { low: "#64748b", medium: "#EAB308", high: "#3B82F6", max: "#10B981" };
                    const labels: Record<string, string> = { low: "Low", medium: "Medium", high: "High", max: "Max" };
                    return (
                      <button
                        key={lvl}
                        type="button"
                        onClick={() => setEffort(lvl)}
                        style={{
                          flex: 1,
                          padding: "6px 0",
                          fontSize: 11,
                          fontWeight: 600,
                          fontFamily: "inherit",
                          cursor: "pointer",
                          borderRadius: 6,
                          border: effort === lvl ? `1px solid ${colors[lvl]}` : "1px solid #334155",
                          background: effort === lvl ? `${colors[lvl]}18` : "#1e293b",
                          color: effort === lvl ? colors[lvl] : "#64748b",
                          transition: "all 0.15s",
                        }}
                      >
                        {labels[lvl]}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Info cards */}
              <div style={{ display: "flex", gap: 12 }}>
                <InfoCard label="Status" value={`${statusCfg.icon} ${statusCfg.label}`} color={statusCfg.color} />
                <InfoCard label="Progresso" value={`${agent.progress}%`} color={agent.color} />
                <InfoCard label="Linhas" value={String(agent.linesWritten)} color="#64748b" />
                <InfoCard label="Zona" value={agent.desk.zone} color="#64748b" />
              </div>

              {agent.currentTask && (
                <div>
                  <label style={labelStyle}>Tarefa Atual</label>
                  <div style={{
                    padding: "10px 14px",
                    background: "#1e293b",
                    border: "1px solid #334155",
                    borderRadius: 8,
                    color: "#94a3b8",
                    fontSize: 12,
                  }}>
                    {agent.currentTask}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* === Tab Skills === */}
          {activeTab === "skills" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 12, height: "100%" }}>
              {/* Skill tabs */}
              <div style={{ display: "flex", alignItems: "center", gap: 0, borderBottom: "1px solid #1e293b" }}>
                {skills.map((s, i) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => setActiveSkillIdx(i)}
                    style={{
                      background: "none",
                      border: "none",
                      borderBottom: i === activeSkillIdx ? `2px solid ${agent.color}` : "2px solid transparent",
                      padding: "8px 12px",
                      color: i === activeSkillIdx ? "#e2e8f0" : "#64748b",
                      fontSize: 11,
                      fontWeight: 600,
                      cursor: "pointer",
                      fontFamily: "inherit",
                    }}
                  >
                    {s.name}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => void handleAddSkill()}
                  style={{
                    background: "none",
                    border: "none",
                    color: "#3B82F6",
                    fontSize: 14,
                    fontWeight: 700,
                    cursor: "pointer",
                    fontFamily: "inherit",
                    padding: "8px 12px",
                  }}
                  title="Adicionar nova skill"
                >
                  +
                </button>
              </div>

              {loading ? (
                <div style={{ color: "#475569", fontSize: 13, textAlign: "center", padding: 40 }}>Carregando skills...</div>
              ) : (
                <>
                  <div>
                    <label style={labelStyle}>Nome da Skill</label>
                    <input
                      type="text"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      style={inputStyle}
                      autoComplete="off"
                    />
                  </div>

                  <div style={{ flex: 1 }}>
                    <label style={labelStyle}>Conteúdo (SKILL.md — Markdown)</label>
                    <textarea
                      value={editContent}
                      onChange={(e) => setEditContent(e.target.value)}
                      style={{
                        ...inputStyle,
                        minHeight: 180,
                        resize: "vertical",
                        lineHeight: 1.6,
                        fontSize: 12,
                      }}
                    />
                  </div>

                  {/* Tags */}
                  {skills[activeSkillIdx] && skills[activeSkillIdx].tags.length > 0 && (
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                      {skills[activeSkillIdx].tags.map((tag) => (
                        <span key={tag} style={{
                          fontSize: 10, padding: "2px 8px", borderRadius: 4,
                          background: `${agent.color}18`, color: agent.color, fontWeight: 600,
                        }}>
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Restaurar padrão */}
                  <button
                    type="button"
                    onClick={() => {
                      if (!agent) return;
                      // Recarrega do arquivo SKILL.md (ignora edições do Supabase)
                      skillFileCache.delete(agent.role);
                      void loadSkillFromFile(agent.role).then((content) => {
                        setEditContent(content ?? FALLBACK_SKILL(agent.role, agent.name));
                      });
                    }}
                    style={{ ...btnStyle, color: "#F59E0B" }}
                  >
                    Restaurar Padrão
                  </button>

                  {/* Delete skill */}
                  {skills[activeSkillIdx] && skills[activeSkillIdx].id !== "__local__" && (
                    <div>
                      {confirmDeleteSkill ? (
                        <div style={{ display: "flex", gap: 6 }}>
                          <button type="button" onClick={() => void handleDeleteSkill()} style={{ ...btnStyle, color: "#EF4444", borderColor: "#7f1d1d" }}>Confirmar Exclusão</button>
                          <button type="button" onClick={() => setConfirmDeleteSkill(false)} style={btnStyle}>Cancelar</button>
                        </div>
                      ) : (
                        <button type="button" onClick={() => setConfirmDeleteSkill(true)} style={{ ...btnStyle, color: "#EF4444" }}>Excluir Skill</button>
                      )}
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {/* === Tab Avançado === */}
          {activeTab === "avancado" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              {/* Danger zone */}
              <div
                style={{
                  padding: "20px",
                  background: "#1a0a0a",
                  border: "1px solid #7f1d1d",
                  borderRadius: 12,
                }}
              >
                <div style={{ fontSize: 13, fontWeight: 700, color: "#EF4444", marginBottom: 12 }}>
                  Zona de Perigo
                </div>
                <div style={{ fontSize: 12, color: "#94a3b8", marginBottom: 16, lineHeight: 1.6 }}>
                  Remover o agente <strong style={{ color: agent.color }}>{agent.name}</strong> do escritório.
                  Esta ação é irreversível e remove todas as configurações associadas.
                </div>

                {/* Checkbox de confirmação */}
                <label
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    cursor: "pointer",
                    marginBottom: 14,
                    fontSize: 12,
                    color: removeCheck ? "#EF4444" : "#64748b",
                  }}
                >
                  <input
                    type="checkbox"
                    checked={removeCheck}
                    onChange={(e) => {
                      setRemoveCheck(e.target.checked);
                      if (!e.target.checked) setRemoveConfirmed(false);
                    }}
                    style={{ accentColor: "#EF4444" }}
                  />
                  Eu entendo que isso é irreversível
                </label>

                {/* Botão de remoção — só aparece com checkbox marcado */}
                {removeCheck && (
                  removeConfirmed ? (
                    <div style={{ display: "flex", gap: 8 }}>
                      <button
                        type="button"
                        onClick={handleDeleteAgent}
                        style={{
                          padding: "8px 20px",
                          background: "#7f1d1d",
                          border: "1px solid #EF4444",
                          borderRadius: 8,
                          color: "#EF4444",
                          fontSize: 12,
                          fontWeight: 700,
                          cursor: "pointer",
                          fontFamily: "inherit",
                        }}
                      >
                        Confirmar Remoção Definitiva
                      </button>
                      <button
                        type="button"
                        onClick={() => setRemoveConfirmed(false)}
                        style={btnStyle}
                      >
                        Cancelar
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setRemoveConfirmed(true)}
                      style={{
                        padding: "8px 16px",
                        background: "transparent",
                        border: "1px solid #7f1d1d",
                        borderRadius: 8,
                        color: "#EF4444",
                        fontSize: 12,
                        fontWeight: 600,
                        cursor: "pointer",
                        fontFamily: "inherit",
                      }}
                    >
                      Remover Agente...
                    </button>
                  )
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div
          style={{
            padding: "12px 24px",
            borderTop: "1px solid #1e293b",
            display: "flex",
            justifyContent: "flex-end",
            gap: 8,
            flexShrink: 0,
          }}
        >
          <button type="button" onClick={onClose} style={btnStyle}>Cancelar</button>
          <button
            type="button"
            onClick={() => void handleSave()}
            disabled={saving}
            style={{
              padding: "8px 20px",
              background: `linear-gradient(135deg, ${agent.color}, ${agent.color}cc)`,
              border: "none",
              borderRadius: 8,
              color: "#fff",
              fontSize: 13,
              fontWeight: 700,
              cursor: saving ? "wait" : "pointer",
              fontFamily: "inherit",
              opacity: saving ? 0.6 : 1,
            }}
          >
            {saving ? "Salvando..." : "Salvar"}
          </button>
        </div>
      </div>
    </div>
  );
}

/** Card de info compacto */
function InfoCard({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div
      style={{
        flex: 1,
        padding: "10px 12px",
        background: "#1e293b",
        border: "1px solid #334155",
        borderRadius: 8,
        textAlign: "center",
      }}
    >
      <div style={{ fontSize: 9, color: "#64748b", textTransform: "uppercase", letterSpacing: 1, fontWeight: 600, marginBottom: 4 }}>
        {label}
      </div>
      <div style={{ fontSize: 13, color, fontWeight: 700 }}>{value}</div>
    </div>
  );
}

const labelStyle: React.CSSProperties = {
  display: "block", fontSize: 10, color: "#64748b", marginBottom: 4,
  fontFamily: "inherit", textTransform: "uppercase", letterSpacing: 1, fontWeight: 600,
};

const inputStyle: React.CSSProperties = {
  width: "100%", background: "#1e293b", border: "1px solid #334155", borderRadius: 8,
  padding: "8px 12px", color: "#e2e8f0", fontSize: 13, fontFamily: "inherit",
  outline: "none", boxSizing: "border-box",
};

const selectStyle: React.CSSProperties = { ...inputStyle, cursor: "pointer" };

const btnStyle: React.CSSProperties = {
  padding: "8px 16px", background: "#1e293b", border: "1px solid #334155",
  borderRadius: 8, color: "#94a3b8", fontSize: 12, fontWeight: 600,
  cursor: "pointer", fontFamily: "inherit",
};
