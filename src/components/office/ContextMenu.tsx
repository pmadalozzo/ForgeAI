/**
 * Menu contextual SVG para agentes no escritório virtual.
 * Design moderno com animações fluidas e glassmorphism.
 */
import { useState, useEffect } from "react";
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
  const [isVisible, setIsVisible] = useState(false);
  const [hoveredItem, setHoveredItem] = useState<string | null>(null);
  const agent = useAgentsStore((s) => s.agents.find((a) => a.id === agentId));
  const setAgentStatus = useAgentsStore((s) => s.setAgentStatus);
  const setAgentProvider = useAgentsStore((s) => s.setAgentProvider);
  const selectAgent = useAgentsStore((s) => s.selectAgent);

  useEffect(() => {
    setIsVisible(true);
  }, []);

  const handleClose = () => {
    setIsVisible(false);
    setTimeout(onClose, 150);
  };

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
      {/* Filtros SVG para glassmorphism */}
      <defs>
        <filter id="glass-blur" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur in="SourceGraphic" stdDeviation="2"/>
        </filter>
        <filter id="glass-shadow" x="-50%" y="-50%" width="200%" height="200%">
          <feDropShadow dx="0" dy="4" stdDeviation="8" floodColor="#000" floodOpacity="0.3"/>
        </filter>
        <filter id="menu-glow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="3" result="coloredBlur"/>
          <feMerge>
            <feMergeNode in="coloredBlur"/>
            <feMergeNode in="SourceGraphic"/>
          </feMerge>
        </filter>
      </defs>

      {/* Overlay invisível para capturar cliques fora */}
      <rect
        x="0"
        y="0"
        width="920"
        height="600"
        fill="transparent"
        onClick={handleClose}
      />

      {/* Menu principal */}
      <g
        transform={`translate(${adjustedX}, ${adjustedY})`}
        opacity={isVisible ? 1 : 0}
        style={{
          transition: "opacity 0.15s ease-out, transform 0.15s ease-out",
          transform: isVisible ? "scale(1)" : "scale(0.95)",
        }}
      >
        {/* Fundo glassmorphism */}
        <rect
          x="0"
          y="0"
          width={MENU_W}
          height={menuH}
          rx="6"
          fill="rgba(15, 23, 42, 0.9)"
          stroke="rgba(148, 163, 184, 0.1)"
          strokeWidth="1"
          filter="url(#glass-shadow)"
        />

        {/* Borda interna sutil */}
        <rect
          x="0.5"
          y="0.5"
          width={MENU_W - 1}
          height={menuH - 1}
          rx="5.5"
          fill="none"
          stroke="rgba(255, 255, 255, 0.05)"
          strokeWidth="1"
        />

        {items.map((item, i) => (
          <g
            key={item.label}
            transform={`translate(0, ${i * ITEM_H + 4})`}
            onClick={(e) => {
              e.stopPropagation();
              item.action();
            }}
            onMouseEnter={() => setHoveredItem(item.label)}
            onMouseLeave={() => setHoveredItem(null)}
            style={{ cursor: "pointer" }}
          >
            {/* Hover background */}
            <rect
              x="3"
              y="1"
              width={MENU_W - 6}
              height={ITEM_H - 2}
              rx="3"
              fill={hoveredItem === item.label ? "rgba(59, 130, 246, 0.15)" : "transparent"}
              stroke={hoveredItem === item.label ? "rgba(59, 130, 246, 0.3)" : "transparent"}
              strokeWidth="0.5"
              style={{
                transition: "all 0.2s cubic-bezier(0.4, 0, 0.2, 1)",
              }}
            />

            {/* Ícone indicador */}
            <circle
              cx="12"
              cy={ITEM_H / 2}
              r="3"
              fill={item.color ?? "#64748b"}
              opacity={hoveredItem === item.label ? 1 : 0.7}
              style={{
                transition: "all 0.2s cubic-bezier(0.4, 0, 0.2, 1)",
                filter: hoveredItem === item.label ? "url(#menu-glow)" : undefined,
              }}
            />

            {/* Texto do item */}
            <text
              x="22"
              y={ITEM_H / 2 + 3}
              fontSize="8"
              fill={hoveredItem === item.label ? "#f1f5f9" : "#e2e8f0"}
              fontFamily="'JetBrains Mono', monospace"
              fontWeight={hoveredItem === item.label ? 600 : 500}
              style={{
                transition: "all 0.2s cubic-bezier(0.4, 0, 0.2, 1)",
              }}
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
