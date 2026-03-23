/**
 * Estacao de trabalho premium de um agente no escritorio virtual.
 * Card com glassmorphism, glow ambient, status ring e micro-animacoes.
 */
import type { Agent } from "@/types/agents";
import { AgentStatus } from "@/types/agents";
import { Desk } from "@/components/office/Desk";
import { PixelPerson } from "@/components/office/PixelPerson";

interface AgentWorkstationProps {
  agent: Agent;
  isSelected: boolean;
  onSelect: (agentId: string) => void;
}

/** Largura/altura do card */
const CARD_W = 110;
const CARD_H = 108;
const CARD_RX = 10;

/** Status label e cor */
function statusMeta(status: AgentStatus): { label: string; dotColor: string } {
  switch (status) {
    case AgentStatus.Working:
      return { label: "CODING", dotColor: "#22d3ee" };
    case AgentStatus.Review:
      return { label: "REVIEW", dotColor: "#a78bfa" };
    case AgentStatus.Blocked:
      return { label: "BLOCKED", dotColor: "#f87171" };
    case AgentStatus.Done:
      return { label: "DONE", dotColor: "#4ade80" };
    default:
      return { label: "IDLE", dotColor: "#475569" };
  }
}

export function AgentWorkstation({
  agent,
  isSelected,
  onSelect,
}: AgentWorkstationProps) {
  const { desk, color, name, progress, currentTask, status, emoji } = agent;
  const isActive = status === AgentStatus.Working || status === AgentStatus.Review;
  const { label: statusLabel, dotColor } = statusMeta(status);

  /** ID unico para defs (evita colisao entre cards) */
  const uid = `ws-${agent.id}`;

  return (
    <g
      transform={`translate(${desk.position.x}, ${desk.position.y})`}
      onClick={() => onSelect(agent.id)}
      style={{ cursor: "pointer" }}
    >
      <defs>
        {/* Glow radial por agente */}
        <radialGradient id={`${uid}-glow`} cx="50%" cy="45%" r="60%">
          <stop offset="0%" stopColor={color} stopOpacity={isActive ? 0.18 : 0.08} />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </radialGradient>

        {/* Gradiente do card */}
        <linearGradient id={`${uid}-card`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#1a1f35" stopOpacity="0.95" />
          <stop offset="100%" stopColor="#0f1225" stopOpacity="0.98" />
        </linearGradient>

        {/* Borda gradiente */}
        <linearGradient id={`${uid}-border`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity={isSelected ? 0.8 : 0.35} />
          <stop offset="50%" stopColor={color} stopOpacity={isSelected ? 0.4 : 0.12} />
          <stop offset="100%" stopColor={color} stopOpacity={isSelected ? 0.8 : 0.35} />
        </linearGradient>

        {/* Shimmer para progress bar */}
        <linearGradient id={`${uid}-shimmer`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor={color} stopOpacity="0.6" />
          <stop offset="40%" stopColor="#ffffff" stopOpacity="0.3" />
          <stop offset="60%" stopColor="#ffffff" stopOpacity="0.3" />
          <stop offset="100%" stopColor={color} stopOpacity="0.6" />
          <animateTransform
            attributeName="gradientTransform"
            type="translate"
            values="-1 0;1 0;-1 0"
            dur="2.5s"
            repeatCount="indefinite"
          />
        </linearGradient>

        {/* Clip para o card */}
        <clipPath id={`${uid}-clip`}>
          <rect x="-8" y="-24" width={CARD_W} height={CARD_H} rx={CARD_RX} />
        </clipPath>
      </defs>

      {/* ── Ambient glow (halo por tras do card) ── */}
      <ellipse
        cx={CARD_W / 2 - 8}
        cy={CARD_H / 2 - 24}
        rx={CARD_W * 0.55}
        ry={CARD_H * 0.45}
        fill={`url(#${uid}-glow)`}
      >
        {isActive && (
          <animate
            attributeName="opacity"
            values="1;0.6;1"
            dur="3s"
            repeatCount="indefinite"
          />
        )}
      </ellipse>

      {/* ── Card backing (glassmorphism) ── */}
      <rect
        x="-8"
        y="-24"
        width={CARD_W}
        height={CARD_H}
        rx={CARD_RX}
        fill={`url(#${uid}-card)`}
        stroke={`url(#${uid}-border)`}
        strokeWidth={isSelected ? 1.8 : 1}
      >
        {isSelected && (
          <animate
            attributeName="stroke-opacity"
            values="1;0.5;1"
            dur="2s"
            repeatCount="indefinite"
          />
        )}
      </rect>

      {/* Top accent line (cor do agente) */}
      <rect
        x="-2"
        y="-24"
        width={CARD_W - 12}
        height="2"
        rx="1"
        fill={color}
        opacity={isSelected ? 0.9 : 0.5}
      />

      {/* ── Header: emoji + name + status dot ── */}
      <g transform="translate(0, -16)">
        {/* Emoji badge */}
        <text
          x="0"
          y="6"
          fontSize="9"
          fontFamily="'Segoe UI Emoji', 'Apple Color Emoji', sans-serif"
        >
          {emoji}
        </text>

        {/* Agent name */}
        <text
          x="14"
          y="5"
          fontSize="6.5"
          fill={color}
          fontWeight="700"
          fontFamily="'JetBrains Mono', 'SF Mono', monospace"
          letterSpacing="0.3"
        >
          {name}
        </text>

        {/* Status dot com pulso */}
        <circle cx={CARD_W - 16} cy="2" r="3" fill={dotColor} opacity="0.9">
          {(status === AgentStatus.Working || status === AgentStatus.Blocked) && (
            <animate
              attributeName="opacity"
              values="0.9;0.3;0.9"
              dur={status === AgentStatus.Working ? "1.2s" : "0.8s"}
              repeatCount="indefinite"
            />
          )}
        </circle>
        {/* Status dot outer ring */}
        <circle
          cx={CARD_W - 16}
          cy="2"
          r="5"
          fill="none"
          stroke={dotColor}
          strokeWidth="0.6"
          opacity="0.4"
        >
          {status === AgentStatus.Working && (
            <animate
              attributeName="r"
              values="4;7;4"
              dur="2s"
              repeatCount="indefinite"
            />
          )}
          {status === AgentStatus.Working && (
            <animate
              attributeName="opacity"
              values="0.4;0;0.4"
              dur="2s"
              repeatCount="indefinite"
            />
          )}
        </circle>
      </g>

      {/* ── Status label ── */}
      <g transform={`translate(${CARD_W - 48}, -8)`}>
        <rect
          x="0"
          y="0"
          width="32"
          height="9"
          rx="4.5"
          fill={dotColor}
          fillOpacity="0.12"
          stroke={dotColor}
          strokeWidth="0.5"
          strokeOpacity="0.3"
        />
        <text
          x="16"
          y="6.8"
          textAnchor="middle"
          fontSize="4.5"
          fill={dotColor}
          fontWeight="700"
          fontFamily="'JetBrains Mono', monospace"
          letterSpacing="0.5"
        >
          {statusLabel}
        </text>
      </g>

      {/* ── Desk + PixelPerson (conteudo principal) ── */}
      <Desk color={color} items={desk.items} agentStatus={status} />

      <g transform="translate(22, 6)">
        <PixelPerson color={color} status={status} />
      </g>

      {/* ── Progress bar premium (so aparece quando ativo) ── */}
      {isActive && (
        <g transform="translate(-2, 60)">
          {/* Track */}
          <rect
            width={CARD_W - 12}
            height="3.5"
            rx="1.75"
            fill="#0f172a"
            stroke={color}
            strokeWidth="0.3"
            strokeOpacity="0.2"
          />
          {/* Fill com shimmer */}
          <rect
            width={Math.max(0, (CARD_W - 12) * (progress / 100))}
            height="3.5"
            rx="1.75"
            fill={`url(#${uid}-shimmer)`}
          />
          {/* Fill base */}
          <rect
            width={Math.max(0, (CARD_W - 12) * (progress / 100))}
            height="3.5"
            rx="1.75"
            fill={color}
            opacity="0.55"
          />
          {/* Percentage label */}
          <text
            x={CARD_W - 10}
            y="3"
            textAnchor="end"
            fontSize="3.5"
            fill={color}
            fontFamily="'JetBrains Mono', monospace"
            fontWeight="600"
            opacity="0.7"
          >
            {Math.round(progress)}%
          </text>
        </g>
      )}

      {/* ── Task label (always visible when has task, fades on idle) ── */}
      {currentTask && (
        <g transform="translate(-2, 66)">
          <rect
            x="0"
            y="0"
            width={CARD_W - 12}
            height="12"
            rx="4"
            fill="#0a0e1a"
            fillOpacity="0.85"
            stroke={color}
            strokeWidth="0.3"
            strokeOpacity="0.15"
          />
          <text
            x="5"
            y="8.5"
            fontSize="4.2"
            fill="#8892a8"
            fontFamily="'JetBrains Mono', monospace"
            letterSpacing="0.2"
          >
            {currentTask.length > 22 ? `${currentTask.slice(0, 22)}...` : currentTask}
          </text>
        </g>
      )}

      {/* Tooltip é renderizado pelo OfficeCanvas */}

      {/* ── Working pulse ring (anel externo animado) ── */}
      {status === AgentStatus.Working && (
        <rect
          x="-10"
          y="-26"
          width={CARD_W + 4}
          height={CARD_H + 4}
          rx={CARD_RX + 2}
          fill="none"
          stroke={color}
          strokeWidth="0.8"
          opacity="0"
        >
          <animate
            attributeName="opacity"
            values="0;0.3;0"
            dur="2.5s"
            repeatCount="indefinite"
          />
          <animate
            attributeName="stroke-width"
            values="0.8;2;0.8"
            dur="2.5s"
            repeatCount="indefinite"
          />
        </rect>
      )}

      {/* ── Selection marching ants ── */}
      {isSelected && (
        <rect
          x="-10"
          y="-26"
          width={CARD_W + 4}
          height={CARD_H + 4}
          rx={CARD_RX + 2}
          fill="none"
          stroke={color}
          strokeWidth="1"
          strokeDasharray="5 3"
          opacity="0.6"
        >
          <animate
            attributeName="stroke-dashoffset"
            values="0;16"
            dur="1.2s"
            repeatCount="indefinite"
          />
        </rect>
      )}
    </g>
  );
}
