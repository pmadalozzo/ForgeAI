import { create } from "zustand";
import { devtools } from "zustand/middleware";
import type { Agent, AgentRole, WalkRoute } from "@/types/agents";
import { AgentStatus } from "@/types/agents";
import type { LLMProvider } from "@/types/agents";

/**
 * Definição padrão dos 10 agentes do ForgeAI.
 * Cores, posições e zonas conforme especificado no CLAUDE.md.
 */
const agentesIniciais: Agent[] = [
  // === Zona Research (topo) — 1 agente ===
  {
    id: "researcher",
    name: "Pesquisador",
    emoji: "🔬",
    color: "#A855F7",
    role: "researcher",
    status: AgentStatus.Idle,
    progress: 0,
    currentTask: null,
    provider: "claude-code",
    linesWritten: 0,
    desk: {
      position: { x: 430, y: 95 },
      items: ["pilha-papeis", "caneca-cafe"],
      zone: "research",
    },
  },

  // === Zona Management — 3 agentes, deslocados +170px ===
  {
    id: "orchestrator",
    name: "Orquestrador",
    emoji: "🎯",
    color: "#3B82F6",
    role: "orchestrator",
    status: AgentStatus.Idle,
    progress: 0,
    currentTask: null,
    provider: "claude-code",
    linesWritten: 0,
    desk: {
      position: { x: 430, y: 285 },
      items: ["caneca-cafe", "monitor-extra"],
      zone: "management",
    },
  },
  {
    id: "pm",
    name: "Product Manager",
    emoji: "📋",
    color: "#8B5CF6",
    role: "pm",
    status: AgentStatus.Idle,
    progress: 0,
    currentTask: null,
    provider: "claude-code",
    linesWritten: 0,
    desk: {
      position: { x: 200, y: 285 },
      items: ["pilha-papeis", "caneca-cafe"],
      zone: "management",
    },
  },
  {
    id: "architect",
    name: "Arquiteto",
    emoji: "🏗️",
    color: "#10B981",
    role: "architect",
    status: AgentStatus.Idle,
    progress: 0,
    currentTask: null,
    provider: "claude-code",
    linesWritten: 0,
    desk: {
      position: { x: 660, y: 285 },
      items: ["post-its", "caneca-cafe"],
      zone: "management",
    },
  },

  // === Zona Development (centro) — 3 agentes, deslocados +170px ===
  {
    id: "frontend",
    name: "Frontend Dev",
    emoji: "🎨",
    color: "#06B6D4",
    role: "frontend",
    status: AgentStatus.Idle,
    progress: 0,
    currentTask: null,
    provider: "claude-code",
    linesWritten: 0,
    desk: {
      position: { x: 200, y: 475 },
      items: ["vaso-planta", "caneca-cafe"],
      zone: "development",
    },
  },
  {
    id: "backend",
    name: "Backend Dev",
    emoji: "⚙️",
    color: "#F97316",
    role: "backend",
    status: AgentStatus.Idle,
    progress: 0,
    currentTask: null,
    provider: "claude-code",
    linesWritten: 0,
    desk: {
      position: { x: 430, y: 475 },
      items: ["caneca-cafe", "pilha-papeis"],
      zone: "development",
    },
  },
  {
    id: "database",
    name: "Database Eng",
    emoji: "🗃️",
    color: "#EAB308",
    role: "database",
    status: AgentStatus.Idle,
    progress: 0,
    currentTask: null,
    provider: "claude-code",
    linesWritten: 0,
    desk: {
      position: { x: 660, y: 475 },
      items: ["monitor-extra"],
      zone: "development",
    },
  },

  // === Zona QA & Ops (base) — 5 agentes, deslocados +170px ===
  {
    id: "qa",
    name: "QA Engineer",
    emoji: "🧪",
    color: "#EF4444",
    role: "qa",
    status: AgentStatus.Idle,
    progress: 0,
    currentTask: null,
    provider: "claude-code",
    linesWritten: 0,
    desk: {
      position: { x: 100, y: 670 },
      items: ["pilha-papeis"],
      zone: "qa-ops",
    },
  },
  {
    id: "security",
    name: "Security Eng",
    emoji: "🔒",
    color: "#6B7280",
    role: "security",
    status: AgentStatus.Idle,
    progress: 0,
    currentTask: null,
    provider: "claude-code",
    linesWritten: 0,
    desk: {
      position: { x: 260, y: 670 },
      items: ["caneca-cafe"],
      zone: "qa-ops",
    },
  },
  {
    id: "devops",
    name: "DevOps Eng",
    emoji: "📦",
    color: "#EC4899",
    role: "devops",
    status: AgentStatus.Idle,
    progress: 0,
    currentTask: null,
    provider: "claude-code",
    linesWritten: 0,
    desk: {
      position: { x: 420, y: 670 },
      items: ["monitor-extra", "caneca-cafe"],
      zone: "qa-ops",
    },
  },
  {
    id: "reviewer",
    name: "Code Reviewer",
    emoji: "🔍",
    color: "#6366F1",
    role: "reviewer",
    status: AgentStatus.Idle,
    progress: 0,
    currentTask: null,
    provider: "claude-code",
    linesWritten: 0,
    desk: {
      position: { x: 580, y: 670 },
      items: ["vaso-planta", "post-its"],
      zone: "qa-ops",
    },
  },
  {
    id: "designer",
    name: "UI/UX Designer",
    emoji: "🎨",
    color: "#F472B6",
    role: "designer",
    status: AgentStatus.Idle,
    progress: 0,
    currentTask: null,
    provider: "claude-code",
    linesWritten: 0,
    desk: {
      position: { x: 740, y: 670 },
      items: ["post-its", "caneca-cafe"],
      zone: "qa-ops",
    },
  },
];

/** Estado da store de agentes */
interface AgentsState {
  /** Lista de todos os agentes */
  agents: Agent[];
  /** Agentes caminhando entre mesas */
  walkers: WalkRoute[];
  /** ID do agente selecionado no canvas (ou null) */
  selectedAgentId: string | null;

  // --- Ações ---

  /** Atualiza o status de um agente */
  setAgentStatus: (agentId: string, status: AgentStatus) => void;

  /** Atualiza o progresso de um agente (0-100) */
  setAgentProgress: (agentId: string, progress: number) => void;

  /** Define a tarefa atual de um agente */
  setAgentTask: (agentId: string, task: string | null) => void;

  /** Troca o provider de LLM de um agente */
  setAgentProvider: (agentId: string, provider: LLMProvider) => void;

  /** Incrementa o contador de linhas escritas */
  addLinesWritten: (agentId: string, lines: number) => void;

  /** Seleciona um agente (ou null para deselecionar) */
  selectAgent: (agentId: string | null) => void;

  /** Atualiza a posição da mesa (drag & drop) */
  updateDeskPosition: (agentId: string, x: number, y: number) => void;

  /** Adiciona um walker (agente caminhando entre mesas) */
  addWalker: (walker: WalkRoute) => void;

  /** Remove um walker quando chega ao destino */
  removeWalker: (agentId: string) => void;

  /** Avança walkProgress de todos os walkers (chamado por rAF) */
  tickWalkers: (deltaMs: number) => void;

  /** Reseta todos os agentes para idle */
  resetAll: () => void;

  /** Adiciona um agente customizado */
  addAgent: (agent: Agent) => void;

  /** Remove um agente */
  removeAgent: (agentId: string) => void;

  /** Restaura os 10 agentes padrão */
  loadDefaultAgents: () => void;

  /** Retorna um agente pelo ID */
  getAgent: (agentId: string) => Agent | undefined;

  /** Retorna agentes filtrados por role */
  getAgentsByRole: (role: AgentRole) => Agent[];
}

/**
 * Store Zustand para estado dos agentes.
 * Centraliza toda a lógica de estado do escritório virtual.
 */
export const useAgentsStore = create<AgentsState>()(
  devtools(
    (set, get) => ({
      agents: agentesIniciais,
      walkers: [],
      selectedAgentId: null,

      setAgentStatus: (agentId, status) =>
        set(
          (state) => ({
            agents: state.agents.map((a) =>
              a.id === agentId ? { ...a, status } : a,
            ),
          }),
          false,
          "setAgentStatus",
        ),

      setAgentProgress: (agentId, progress) =>
        set(
          (state) => ({
            agents: state.agents.map((a) =>
              a.id === agentId
                ? { ...a, progress: Math.min(100, Math.max(0, progress)) }
                : a,
            ),
          }),
          false,
          "setAgentProgress",
        ),

      setAgentTask: (agentId, task) =>
        set(
          (state) => ({
            agents: state.agents.map((a) =>
              a.id === agentId ? { ...a, currentTask: task } : a,
            ),
          }),
          false,
          "setAgentTask",
        ),

      setAgentProvider: (agentId, provider) =>
        set(
          (state) => ({
            agents: state.agents.map((a) =>
              a.id === agentId ? { ...a, provider } : a,
            ),
          }),
          false,
          "setAgentProvider",
        ),

      addLinesWritten: (agentId, lines) =>
        set(
          (state) => ({
            agents: state.agents.map((a) =>
              a.id === agentId
                ? { ...a, linesWritten: a.linesWritten + lines }
                : a,
            ),
          }),
          false,
          "addLinesWritten",
        ),

      selectAgent: (agentId) =>
        set({ selectedAgentId: agentId }, false, "selectAgent"),

      updateDeskPosition: (agentId, x, y) =>
        set(
          (state) => ({
            agents: state.agents.map((a) =>
              a.id === agentId
                ? { ...a, desk: { ...a.desk, position: { x, y } } }
                : a,
            ),
          }),
          false,
          "updateDeskPosition",
        ),

      addWalker: (walker) =>
        set(
          (state) => ({
            walkers: [...state.walkers.slice(-4), walker], // máx 5 walkers
          }),
          false,
          "addWalker",
        ),

      removeWalker: (agentId) =>
        set(
          (state) => ({
            walkers: state.walkers.filter((w) => w.agentId !== agentId),
          }),
          false,
          "removeWalker",
        ),

      /** Avança walkProgress de todos os walkers. Chamado por requestAnimationFrame no OfficeCanvas. */
      tickWalkers: (deltaMs: number) => {
        const WALK_DURATION = 2500; // ms para ir de 0 a 1
        set(
          (state) => {
            const updated = state.walkers
              .map((w) => ({
                ...w,
                walkProgress: Math.min(1, w.walkProgress + deltaMs / WALK_DURATION),
              }))
              .filter((w) => w.walkProgress < 1);
            return { walkers: updated };
          },
          false,
          "tickWalkers",
        );
      },

      resetAll: () =>
        set(
          {
            agents: agentesIniciais,
            walkers: [],
            selectedAgentId: null,
          },
          false,
          "resetAll",
        ),

      addAgent: (agent) =>
        set(
          (state) => ({
            agents: [...state.agents, agent],
          }),
          false,
          "addAgent",
        ),

      removeAgent: (agentId) =>
        set(
          (state) => ({
            agents: state.agents.filter((a) => a.id !== agentId),
            selectedAgentId: state.selectedAgentId === agentId ? null : state.selectedAgentId,
          }),
          false,
          "removeAgent",
        ),

      loadDefaultAgents: () =>
        set(
          { agents: agentesIniciais },
          false,
          "loadDefaultAgents",
        ),

      getAgent: (agentId) => get().agents.find((a) => a.id === agentId),

      getAgentsByRole: (role) => get().agents.filter((a) => a.role === role),
    }),
    { name: "ForgeAI-Agents" },
  ),
);
