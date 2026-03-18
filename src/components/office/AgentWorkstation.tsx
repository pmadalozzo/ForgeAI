/**
 * Estacao de trabalho completa de um agente:
 * Mesa + Bonequinho + badge de nome + barra de progresso + label da task + selecao.
 */
import type { Agent } from "@/types/agents";
import { Desk } from "@/components/office/Desk";
import { PixelPerson } from "@/components/office/PixelPerson";
import { ProgressBar } from "@/components/ui/ProgressBar";

interface AgentWorkstationProps {
  /** Dados completos do agente */
  agent: Agent;
  /** Se este agente esta selecionado */
  isSelected: boolean;
  /** Callback ao clicar na estacao */
  onSelect: (agentId: string) => void;
}

/**
 * Combina Desk + PixelPerson com todos os overlays informativos.
 * Posicionamento absoluto via agent.desk.position.
 */
export function AgentWorkstation({
  agent,
  isSelected,
  onSelect,
}: AgentWorkstationProps) {
  const { desk, color, status, name, progress, currentTask } = agent;

  const handleClick = () => {
    onSelect(agent.id);
  };

  return (
    <g
      transform={`translate(${desk.position.x}, ${desk.position.y})`}
      onClick={handleClick}
      style={{ cursor: "pointer" }}
    >
      {/* Mesa com itens */}
      <Desk color={color} items={desk.items} agentStatus={status} />

      {/* Bonequinho sentado */}
      <g transform="translate(23, 0)">
        <PixelPerson color={color} status={status} size={1} />
      </g>

      {/* Badge de nome */}
      <g transform="translate(35, -12)">
        <rect
          x="-24"
          y="-1"
          width="48"
          height="11"
          rx="3"
          fill={color}
          fillOpacity="0.2"
          stroke={color}
          strokeOpacity="0.4"
          strokeWidth="0.5"
        />
        <text
          x="0"
          y="7"
          textAnchor="middle"
          fontSize="6.5"
          fill={color}
          fontWeight="700"
          fontFamily="monospace"
        >
          {name}
        </text>
      </g>

      {/* Barra de progresso abaixo da mesa */}
      <g transform="translate(0, 53)">
        <ProgressBar
          value={progress}
          width={70}
          height={3}
          color={color}
          pulse={status === "working"}
        />
      </g>

      {/* Label da tarefa atual */}
      <text
        x="35"
        y="62"
        textAnchor="middle"
        fontSize="5"
        fill="#64748b"
        fontFamily="monospace"
      >
        {currentTask ? currentTask.slice(0, 26) : ""}
      </text>

      {/* Highlight de selecao (borda tracejada animada) */}
      {isSelected && (
        <rect
          x="-6"
          y="-16"
          width="82"
          height="84"
          rx="6"
          fill="none"
          stroke={color}
          strokeWidth="1.5"
          strokeDasharray="4 2"
          opacity="0.6"
        >
          <animate
            attributeName="strokeDashoffset"
            values="0;12"
            dur="1s"
            repeatCount="indefinite"
          />
        </rect>
      )}
    </g>
  );
}
