import { create } from "zustand";
import { devtools } from "zustand/middleware";
import type { Agent, AgentRole, WalkRoute } from "@/types/agents";
import { AgentStatus } from "@/types/agents";
import type { LLMProvider } from "@/types/agents";

/**
 * Definição padrão dos 12 agentes do ForgeAI.
 * Cores, posições e zonas conforme CLAUDE.md.
 * Canvas: 920x770 com 4 zonas empilhadas.
 */
/**
 * Calcula posições centralizadas dentro de cada zona.
 * Zonas: RESEARCH y=40 h=160, MANAGEMENT y=215 h=165, DEVELOPMENT y=400 h=165, QA y=585 h=165
 * Card tem offset -24 no topo, então desk Y = zoneCenterY - cardHeight/2 + 24
 */
const ZONE_Y = {
  research: 80,     // zona y=40, h=160 → centro ~120, desk ~80
  management: 260,  // zona y=215, h=165 → centro ~297, desk ~260
  development: 445, // zona y=400, h=165 → centro ~482, desk ~445
  "qa-ops": 630,    // zona y=585, h=165 → centro ~667, desk ~630
};

/** Distribui N agentes horizontalmente dentro da zona (x=40, w=840) */
function distributeX(count: number, index: number): number {
  const zoneX = 40;
  const zoneW = 840;
  const cardW = 110;
  const totalCards = count * cardW;
  const gap = (zoneW - totalCards) / (count + 1);
  return zoneX + gap + index * (cardW + gap);
}

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
      position: { x: distributeX(1, 0), y: ZONE_Y.research },
      items: ["pilha-papeis", "caneca-cafe"],
      zone: "research",
    },
  },

  // === Zona Management — 3 agentes ===
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
      position: { x: distributeX(3, 0), y: ZONE_Y.management },
      items: ["pilha-papeis", "caneca-cafe"],
      zone: "management",
    },
  },
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
      position: { x: distributeX(3, 1), y: ZONE_Y.management },
      items: ["caneca-cafe", "monitor-extra"],
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
      position: { x: distributeX(3, 2), y: ZONE_Y.management },
      items: ["post-its", "caneca-cafe"],
      zone: "management",
    },
  },

  // === Zona Development (centro) — 3 agentes ===
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
      position: { x: distributeX(3, 0), y: ZONE_Y.development },
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
      position: { x: distributeX(3, 1), y: ZONE_Y.development },
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
      position: { x: distributeX(3, 2), y: ZONE_Y.development },
      items: ["monitor-extra"],
      zone: "development",
    },
  },

  // === Zona QA & Ops (base) — 5 agentes ===
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
      position: { x: distributeX(5, 0), y: ZONE_Y["qa-ops"] },
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
      position: { x: distributeX(5, 1), y: ZONE_Y["qa-ops"] },
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
      position: { x: distributeX(5, 2), y: ZONE_Y["qa-ops"] },
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
      position: { x: distributeX(5, 3), y: ZONE_Y["qa-ops"] },
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
      position: { x: distributeX(5, 4), y: ZONE_Y["qa-ops"] },
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
  setAgentStatus: (agentId: string, status: AgentStatus) => void;
  setAgentProgress: (agentId: string, progress: number) => void;
  setAgentTask: (agentId: string, task: string | null) => void;
  setAgentProvider: (agentId: string, provider: LLMProvider) => void;
  addLinesWritten: (agentId: string, lines: number) => void;
  selectAgent: (agentId: string | null) => void;
  updateDeskPosition: (agentId: string, x: number, y: number) => void;
  addWalker: (walker: WalkRoute) => void;
  removeWalker: (agentId: string) => void;
  tickWalkers: (deltaMs: number) => void;
  resetAll: () => void;
  addAgent: (agent: Agent) => void;
  removeAgent: (agentId: string) => void;
  loadDefaultAgents: () => void;
  getAgent: (agentId: string) => Agent | undefined;
  getAgentsByRole: (role: AgentRole) => Agent[];
}

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
            walkers: [...state.walkers.slice(-4), walker],
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

      tickWalkers: (deltaMs: number) => {
        const WALK_DURATION = 2500;
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
