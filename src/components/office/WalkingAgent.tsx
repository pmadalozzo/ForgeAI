/**
 * Agente caminhando entre mesas com etiqueta flutuante de tarefa.
 */
import type { Position } from "@/types/agents";
import { AgentStatus } from "@/types/agents";
import { PixelPerson } from "@/components/office/PixelPerson";

interface WalkingAgentProps {
  /** Posicao da mesa de origem */
  fromDesk: Position;
  /** Posicao da mesa de destino */
  toDesk: Position;
  /** Cor tematica do agente */
  color: string;
  /** Progresso da caminhada (0-1) */
  progress: number;
  /** Etiqueta com descricao do conteudo transportado */
  label: string;
}

/**
 * Renderiza um bonequinho caminhando de uma mesa a outra
 * com fade-in/fade-out nas extremidades e etiqueta flutuante.
 */
export function WalkingAgent({
  fromDesk,
  toDesk,
  color,
  progress,
  label,
}: WalkingAgentProps) {
  const x = fromDesk.x + (toDesk.x - fromDesk.x) * progress;
  const y = fromDesk.y + (toDesk.y - fromDesk.y) * progress + 14;
  const dir: 1 | -1 = toDesk.x > fromDesk.x ? 1 : -1;

  // Fade in/out nas bordas da caminhada
  const opacity =
    progress < 0.1
      ? progress * 10
      : progress > 0.9
        ? (1 - progress) * 10
        : 1;

  return (
    <g transform={`translate(${x}, ${y})`} opacity={opacity}>
      <PixelPerson
        color={color}
        status={AgentStatus.Working}
        direction={dir}
        style="walking"
        size={0.9}
      />
      {/* Etiqueta flutuante da tarefa */}
      <g transform="translate(12, -10)">
        <rect
          x="-28"
          y="-8"
          width="56"
          height="12"
          rx="4"
          fill="#0f172a"
          stroke={color}
          strokeWidth="0.5"
          opacity="0.9"
        />
        <text
          x="0"
          y="-0.5"
          textAnchor="middle"
          fontSize="5.5"
          fill="#e2e8f0"
          fontFamily="monospace"
        >
          {label}
        </text>
      </g>
    </g>
  );
}
