/**
 * Modal para criar um novo agente customizado no escritório virtual.
 */
import { useState, useCallback, useRef } from "react";
import { useAgentsStore } from "@/stores/agents-store";
import { AgentStatus } from "@/types/agents";
import type { AgentRole, LLMProvider, OfficeZone } from "@/types/agents";
import { MODELS_BY_PROVIDER, PROVIDER_DISPLAY_NAMES } from "@/stores/settings-store";

const ALL_PROVIDERS: LLMProvider[] = ["claude-code", "openai", "gemini", "ollama", "lm-studio"];

const ALL_ROLES: { value: AgentRole; label: string }[] = [
  { value: "orchestrator", label: "Orchestrator" },
  { value: "pm", label: "Product Manager" },
  { value: "architect", label: "Architect" },
  { value: "frontend", label: "Frontend Dev" },
  { value: "backend", label: "Backend Dev" },
  { value: "database", label: "Database Eng" },
  { value: "qa", label: "QA Engineer" },
  { value: "security", label: "Security Eng" },
  { value: "devops", label: "DevOps Eng" },
  { value: "reviewer", label: "Code Reviewer" },
  { value: "designer", label: "UI/UX Designer" },
];

const ZONES: { value: OfficeZone; label: string }[] = [
  { value: "research", label: "Research (Topo)" },
  { value: "management", label: "Management" },
  { value: "development", label: "Development (Centro)" },
  { value: "qa-ops", label: "QA & Ops (Base)" },
];

/** Posições automáticas baseadas na zona */
const ZONE_POSITIONS: Record<OfficeZone, { x: number; y: number }> = {
  research: { x: 430, y: 95 },
  management: { x: 430, y: 285 },
  development: { x: 430, y: 475 },
  "qa-ops": { x: 430, y: 670 },
};

const DEFAULT_COLORS = [
  "#3B82F6", "#8B5CF6", "#10B981", "#06B6D4", "#F97316",
  "#EAB308", "#EF4444", "#6B7280", "#EC4899", "#6366F1",
  "#14B8A6", "#F59E0B", "#84CC16", "#E879F9",
];

const SKILL_TEMPLATE = `# Nome do Agente — Especialidade

## Competências
- Competência 1
- Competência 2
- Competência 3

## System Prompt
Você é um agente especializado do ForgeAI. Descreva sua função aqui.`;

function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    || "agent";
}

interface CreateAgentModalProps {
  onClose: () => void;
  onBackToList: () => void;
}

export function CreateAgentModal({ onClose, onBackToList }: CreateAgentModalProps) {
  const addAgent = useAgentsStore((s) => s.addAgent);
  const agents = useAgentsStore((s) => s.agents);

  const [name, setName] = useState("");
  const [emoji, setEmoji] = useState("🤖");
  const [color, setColor] = useState("#3B82F6");
  const [role, setRole] = useState<AgentRole>("frontend");
  const [zone, setZone] = useState<OfficeZone>("development");
  const [provider, setProvider] = useState<LLMProvider>("claude-code");
  const [model, setModel] = useState(MODELS_BY_PROVIDER["claude-code"][0] ?? "");
  const [skill, setSkill] = useState(SKILL_TEMPLATE);
  const [error, setError] = useState("");

  const handleCreate = useCallback(() => {
    if (!name.trim()) {
      setError("Nome é obrigatório");
      return;
    }

    const id = slugify(name);
    if (agents.some((a) => a.id === id)) {
      setError("Já existe um agente com esse nome/ID");
      return;
    }

    // Calcula posição automática na zona — offset baseado em quantos agentes já tem na zona
    const agentsInZone = agents.filter((a) => a.desk.zone === zone);
    const basePos = ZONE_POSITIONS[zone];
    const offset = agentsInZone.length * 180;
    const x = 100 + (offset % 700);
    const y = basePos.y;

    addAgent({
      id,
      name: name.trim(),
      emoji,
      color,
      role,
      status: AgentStatus.Idle,
      progress: 0,
      currentTask: null,
      provider,
      linesWritten: 0,
      desk: {
        position: { x, y },
        items: ["caneca-cafe"],
        zone,
      },
    });

    onBackToList();
  }, [name, emoji, color, role, zone, provider, agents, addAgent, onBackToList]);

  // Evita fechar modal ao selecionar texto
  const mouseDownTarget = useRef<EventTarget | null>(null);

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
              ← Voltar
            </button>
            <span style={{ fontSize: 16, fontWeight: 700, color: "#e2e8f0" }}>
              Criar Novo Agente
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

        {/* Form */}
        <div style={{ flex: 1, overflow: "auto", padding: "16px 24px", display: "flex", flexDirection: "column", gap: 14 }}>
          {/* Row 1: Nome + Emoji + Cor */}
          <div style={{ display: "flex", gap: 12 }}>
            <div style={{ flex: 2 }}>
              <label style={labelStyle}>Nome</label>
              <input
                type="text"
                value={name}
                onChange={(e) => { setName(e.target.value); setError(""); }}
                placeholder="Ex: Data Analyst"
                style={inputStyle}
                autoComplete="off"
              />
            </div>
            <div style={{ flex: 0, minWidth: 80 }}>
              <label style={labelStyle}>Emoji</label>
              <input
                type="text"
                value={emoji}
                onChange={(e) => setEmoji(e.target.value.slice(0, 4))}
                style={{ ...inputStyle, textAlign: "center", fontSize: 20, padding: "4px 8px" }}
                autoComplete="off"
              />
            </div>
            <div style={{ flex: 1 }}>
              <label style={labelStyle}>Cor</label>
              <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                {DEFAULT_COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setColor(c)}
                    style={{
                      width: 20,
                      height: 20,
                      borderRadius: 4,
                      background: c,
                      border: color === c ? "2px solid #fff" : "2px solid transparent",
                      cursor: "pointer",
                      padding: 0,
                    }}
                  />
                ))}
              </div>
            </div>
          </div>

          {/* Row 2: Role + Zona */}
          <div style={{ display: "flex", gap: 12 }}>
            <div style={{ flex: 1 }}>
              <label style={labelStyle}>Role</label>
              <select
                value={role}
                onChange={(e) => setRole(e.target.value as AgentRole)}
                style={selectStyle}
              >
                {ALL_ROLES.map((r) => (
                  <option key={r.value} value={r.value}>{r.label}</option>
                ))}
              </select>
            </div>
            <div style={{ flex: 1 }}>
              <label style={labelStyle}>Zona</label>
              <select
                value={zone}
                onChange={(e) => setZone(e.target.value as OfficeZone)}
                style={selectStyle}
              >
                {ZONES.map((z) => (
                  <option key={z.value} value={z.value}>{z.label}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Row 3: Provider + Model */}
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
              <select
                value={model}
                onChange={(e) => setModel(e.target.value)}
                style={selectStyle}
              >
                {MODELS_BY_PROVIDER[provider].map((m) => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Row 4: Skill */}
          <div style={{ flex: 1 }}>
            <label style={labelStyle}>Skill Inicial (Markdown)</label>
            <textarea
              value={skill}
              onChange={(e) => setSkill(e.target.value)}
              style={{
                ...inputStyle,
                minHeight: 120,
                flex: 1,
                resize: "vertical",
                lineHeight: 1.6,
                fontSize: 12,
              }}
            />
          </div>

          {/* Preview */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              padding: "10px 14px",
              background: "#1e293b",
              borderRadius: 10,
              border: "1px solid #334155",
            }}
          >
            <span style={{ fontSize: 11, color: "#64748b", fontWeight: 600 }}>PRÉVIA:</span>
            <div
              style={{
                width: 30,
                height: 30,
                borderRadius: 8,
                background: `${color}18`,
                border: `1px solid ${color}40`,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 16,
              }}
            >
              {emoji}
            </div>
            <span style={{ fontSize: 13, fontWeight: 700, color }}>
              {name || "Nome do Agente"}
            </span>
            <span style={{ fontSize: 10, color: "#64748b" }}>{role}</span>
            <span style={{ fontSize: 10, color: "#475569" }}>
              {PROVIDER_DISPLAY_NAMES[provider]}
            </span>
          </div>

          {/* Error */}
          {error && (
            <div style={{ fontSize: 12, color: "#EF4444", fontWeight: 600 }}>
              {error}
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
          <button
            type="button"
            onClick={onBackToList}
            style={btnStyle}
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleCreate}
            style={{
              padding: "8px 20px",
              background: "linear-gradient(135deg, #3B82F6, #8B5CF6)",
              border: "none",
              borderRadius: 8,
              color: "#fff",
              fontSize: 13,
              fontWeight: 700,
              cursor: "pointer",
              fontFamily: "inherit",
            }}
          >
            Criar Agente
          </button>
        </div>
      </div>
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
