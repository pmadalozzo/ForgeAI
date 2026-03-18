/**
 * Estacao de trabalho completa de um agente no escritorio virtual.
 * Renderiza mesa (Desk), bonequinho (PixelPerson), barra de progresso,
 * name badge e task label.
 */
import { useState } from "react";
import type { Agent } from "@/types/agents";
import { AgentStatus } from "@/types/agents";
import { Desk } from "@/components/office/Desk";
import { PixelPerson } from "@/components/office/PixelPerson";
import { ProgressBar } from "@/components/ui/ProgressBar";

interface AgentWorkstationProps {
  agent: Agent;
  isSelected: boolean;
  onSelect: (agentId: string) => void;
}

export function AgentWorkstation({
  agent,
  isSelected,
  onSelect,
}: AgentWorkstationProps) {
  const { desk, color, name, progress, currentTask, status } = agent;
  const [hovered, setHovered] = useState(false);
  const isActive = status === AgentStatus.Working || status === AgentStatus.Review;

  return (
    <g
      transform={`translate(${desk.position.x}, ${desk.position.y})`}
      onClick={() => onSelect(agent.id)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{ cursor: "pointer" }}
    >
      {/* Selection highlight (animated dashed border) */}
      {isSelected && (
        <rect
          x="-6"
          y="-22"
          width="82"
          height="86"
          rx="6"
          fill={color}
          fillOpacity="0.06"
          stroke={color}
          strokeWidth="1.5"
          strokeDasharray="4 2"
          opacity="0.8"
        >
          <animate
            attributeName="strokeDashoffset"
            values="0;12"
            dur="1s"
            repeatCount="indefinite"
          />
        </rect>
      )}

      {/* Desk (mesa, monitor, cadeira, itens) */}
      <Desk color={color} items={desk.items} agentStatus={status} />

      {/* PixelPerson (bonequinho sentado na cadeira) */}
      <g transform="translate(22, 6)">
        <PixelPerson
          color={color}
          status={status}
        />
      </g>

      {/* Name badge acima do personagem */}
      <g transform="translate(35, -16)">
        <rect
          x={-(name.length * 3 + 10)}
          y="-6"
          width={name.length * 6 + 20}
          height="12"
          rx="4"
          fill="#0c0c1e"
          fillOpacity="0.9"
          stroke={color}
          strokeWidth="0.8"
          strokeOpacity="0.7"
        />
        <text
          x="0"
          y="3"
          textAnchor="middle"
          fontSize="6.5"
          fill={color}
          fontWeight="700"
          fontFamily="'JetBrains Mono', monospace"
        >
          {name}
        </text>
      </g>

      {/* Barra de progresso (so aparece quando trabalhando/review) */}
      {isActive && (
        <g transform="translate(17, 56)">
          <ProgressBar
            value={progress}
            width={36}
            height={3}
            color={color}
            pulse={status === AgentStatus.Working}
          />
        </g>
      )}

      {/* Task label abaixo (no hover) */}
      {hovered && currentTask && (
        <g transform="translate(35, 62)">
          <rect
            x="-42"
            y="0"
            width="84"
            height="14"
            rx="4"
            fill="#0c0c1e"
            fillOpacity="0.9"
            stroke={color}
            strokeWidth="0.5"
            strokeOpacity="0.5"
          />
          <text
            x="0"
            y="10"
            textAnchor="middle"
            fontSize="4.5"
            fill="#c8d0e0"
            fontFamily="monospace"
          >
            {currentTask.slice(0, 28)}
          </text>
        </g>
      )}

      {/* Pulso de atividade (quando working) */}
      {status === AgentStatus.Working && (
        <circle
          cx={68}
          cy={4}
          r="4"
          fill={color}
          opacity="0.7"
        >
          <animate
            attributeName="r"
            values="3;5;3"
            dur="1.5s"
            repeatCount="indefinite"
          />
          <animate
            attributeName="opacity"
            values="0.7;0.3;0.7"
            dur="1.5s"
            repeatCount="indefinite"
          />
        </circle>
      )}
    </g>
  );
}
