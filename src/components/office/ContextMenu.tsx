/**
 * Menu contextual SVG para agentes no escritorio virtual.
 * Aparece ao clicar com botao direito em um agente.
 */
import { useAgentsStore } from "@/stores/agents-store";
import { AgentStatus } from "@/types/agents";
import type { LLMProvider } from "@/types/agents";

interface ContextMenuProps {
  /** ID do agente alvo */
  agentId: string;
  /** Posicao X no canvas SVG */
  x: number;
  /** Posicao Y no canvas SVG */
  y: number;
  /** Callback para fechar o menu */
  onClose: () => void;
}

interface MenuItemDef {
  label: string;
  action: () => void;
  color?: string;
}

const PROVIDERS: { id: LLMProvider; label: string }[] = [
  { id: "claude-code", label: "Claude Code" },
  { id: "openai", label: "OpenAI" },
  { id: "gemini", label: "Gemini" },
  { id: "ollama", label: "Ollama" },
  { id: "lm-studio", label: "LM Studio" },
];

const ITEM_H = 18;
const MENU_W = 110;
const PROVIDER_W = 90;

export function ContextMenu({ agentId, x, y, onClose }: ContextMenuProps) {
  const agent = useAgentsStore((s) => s.agents.find((a) => a.id === agentId));
  const setAgentStatus = useAgentsStore((s) => s.setAgentStatus);
  const setAgentProvider = useAgentsStore((s) => s.setAgentProvider);
  const selectAgent = useAgentsStore((s) => s.selectAgent);

  if (!agent) return null;

  const isWorking = agent.status === AgentStatus.Working;

  const items: MenuItemDef[] = [
    {
      label: isWorking ? "Pausar" : "Iniciar",
      action: () => {
        setAgentStatus(agentId, isWorking ? AgentStatus.Idle : AgentStatus.Working);
        onClose();
      },
      color: isWorking ? "#EAB308" : "#10B981",
    },
    {
      label: "Reiniciar",
      action: () => {
        setAgentStatus(agentId, AgentStatus.Idle);
        onClose();
      },
      color: "#3B82F6",
    },
    {
      label: "Ver Detalhes",
      action: () => {
        selectAgent(agentId);
        onClose();
      },
      color: "#8B5CF6",
    },
  ];

  const menuH = (items.length + 1) * ITEM_H + 6; // +1 for "Trocar Provider" header
  const providerH = PROVIDERS.length * ITEM_H + 4;

  // Ajusta posicao para nao sair do canvas
  const adjustedX = Math.min(x, 920 - MENU_W - PROVIDER_W - 10);
  const adjustedY = Math.min(y, 600 - Math.max(menuH, providerH) - 10);

  return (
    <g>
      {/* Overlay invisivel para capturar cliques fora */}
      <rect
        x="0"
        y="0"
        width="920"
        height="600"
        fill="transparent"
        onClick={onClose}
      />

      {/* Menu principal */}
      <g transform={`translate(${adjustedX}, ${adjustedY})`}>
        <rect
          x="0"
          y="0"
          width={MENU_W}
          height={menuH}
          rx="4"
          fill="#1e293b"
          stroke="#334155"
          strokeWidth="1"
          filter="url(#glow)"
        />

        {items.map((item, i) => (
          <g
            key={item.label}
            transform={`translate(0, ${i * ITEM_H + 3})`}
            onClick={(e) => {
              e.stopPropagation();
              item.action();
            }}
            style={{ cursor: "pointer" }}
          >
            <rect
              x="2"
              y="0"
              width={MENU_W - 4}
              height={ITEM_H - 2}
              rx="2"
              fill="transparent"
              className="context-menu-item"
            />
            <circle cx="12" cy={ITEM_H / 2 - 1} r="2.5" fill={item.color ?? "#64748b"} opacity="0.7" />
            <text
              x="20"
              y={ITEM_H / 2 + 2}
              fontSize="7"
              fill="#e2e8f0"
              fontFamily="monospace"
            >
              {item.label}
            </text>
          </g>
        ))}

        {/* Separador */}
        <line
          x1="6"
          y1={items.length * ITEM_H + 2}
          x2={MENU_W - 6}
          y2={items.length * ITEM_H + 2}
          stroke="#334155"
          strokeWidth="0.5"
        />

        {/* Trocar Provider header */}
        <text
          x="8"
          y={items.length * ITEM_H + 14}
          fontSize="6"
          fill="#64748b"
          fontFamily="monospace"
          fontWeight="700"
        >
          Trocar Provider
        </text>
      </g>

      {/* Submenu providers */}
      <g transform={`translate(${adjustedX + MENU_W + 2}, ${adjustedY})`}>
        <rect
          x="0"
          y="0"
          width={PROVIDER_W}
          height={providerH}
          rx="4"
          fill="#1e293b"
          stroke="#334155"
          strokeWidth="1"
        />

        {PROVIDERS.map((provider, i) => {
          const isActive = agent.provider === provider.id;
          return (
            <g
              key={provider.id}
              transform={`translate(0, ${i * ITEM_H + 2})`}
              onClick={(e) => {
                e.stopPropagation();
                setAgentProvider(agentId, provider.id);
                onClose();
              }}
              style={{ cursor: "pointer" }}
            >
              <rect
                x="2"
                y="0"
                width={PROVIDER_W - 4}
                height={ITEM_H - 2}
                rx="2"
                fill={isActive ? agent.color : "transparent"}
                fillOpacity={isActive ? 0.15 : 0}
              />
              <text
                x="10"
                y={ITEM_H / 2 + 2}
                fontSize="6.5"
                fill={isActive ? agent.color : "#94a3b8"}
                fontFamily="monospace"
                fontWeight={isActive ? "700" : "400"}
              >
                {provider.label}
              </text>
              {isActive && (
                <text x={PROVIDER_W - 14} y={ITEM_H / 2 + 2} fontSize="6" fill={agent.color}>
                  ✓
                </text>
              )}
            </g>
          );
        })}
      </g>
    </g>
  );
}
