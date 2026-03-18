/**
 * Bonequinho SVG pixel-art com 5 estados visuais e estilo de caminhada.
 * Convertido do protótipo ForgeAI-Office-v2.jsx com tipagem estrita.
 */
import type { AgentStatus } from "@/types/agents";
import { Confetti } from "@/components/office/Confetti";

/** Estilo de renderização: sentado na mesa ou caminhando */
export type PersonStyle = "seated" | "walking";

interface PixelPersonProps {
  /** Cor temática do agente (hex) */
  color: string;
  /** Status visual atual */
  status: AgentStatus;
  /** Direção de face: 1 = direita, -1 = esquerda */
  direction?: 1 | -1;
  /** Estilo: sentado ou caminhando */
  style?: PersonStyle;
  /** Escala do bonequinho (default 1) */
  size?: number;
}

const SKIN_TONE = "#FDBCB4";
const PANTS_COLOR = "#2d3748";
const DARK_COLOR = "#1a1a2e";
const LIP_COLOR = "#c0392b";

const HAIR_COLORS = [
  "#2c1810",
  "#4a3728",
  "#8B4513",
  "#1a1a2e",
  "#3d2b1f",
  "#5c3a21",
  "#d4a574",
  "#2d2d2d",
  "#6b4423",
  "#1c1c1c",
];

/** Deriva a cor do cabelo deterministicamente da cor do agente */
function getHairColor(agentColor: string): string {
  const charCode = agentColor.charCodeAt(1);
  return HAIR_COLORS[charCode % HAIR_COLORS.length] ?? HAIR_COLORS[0] ?? "#2c1810";
}

/** Bonequinho caminhando entre mesas */
function WalkingPerson({
  color,
  direction,
  size,
}: {
  color: string;
  direction: 1 | -1;
  size: number;
}) {
  const hair = getHairColor(color);

  return (
    <g
      transform={`scale(${size * direction}, ${size}) translate(${direction < 0 ? -24 : 0}, 0)`}
    >
      {/* Sombra */}
      <ellipse cx="12" cy="31" rx="7" ry="2" fill="#000" opacity="0.15" />
      {/* Perna esquerda */}
      <rect x="8" y="22" width="3" height="7" rx="1" fill={PANTS_COLOR}>
        <animateTransform
          attributeName="transform"
          type="rotate"
          values="-15 9 22;15 9 22;-15 9 22"
          dur="0.4s"
          repeatCount="indefinite"
        />
      </rect>
      <rect x="8" y="28" width="3" height="2" rx="0.5" fill={DARK_COLOR}>
        <animateTransform
          attributeName="transform"
          type="rotate"
          values="-15 9 22;15 9 22;-15 9 22"
          dur="0.4s"
          repeatCount="indefinite"
        />
      </rect>
      {/* Perna direita */}
      <rect x="13" y="22" width="3" height="7" rx="1" fill={PANTS_COLOR}>
        <animateTransform
          attributeName="transform"
          type="rotate"
          values="15 14 22;-15 14 22;15 14 22"
          dur="0.4s"
          repeatCount="indefinite"
        />
      </rect>
      <rect x="13" y="28" width="3" height="2" rx="0.5" fill={DARK_COLOR}>
        <animateTransform
          attributeName="transform"
          type="rotate"
          values="15 14 22;-15 14 22;15 14 22"
          dur="0.4s"
          repeatCount="indefinite"
        />
      </rect>
      {/* Corpo / camisa */}
      <rect x="7" y="14" width="10" height="9" rx="2" fill={color} />
      {/* Bracos balancando */}
      <rect x="4" y="14" width="3" height="7" rx="1.5" fill={color}>
        <animateTransform
          attributeName="transform"
          type="rotate"
          values="20 5 14;-20 5 14;20 5 14"
          dur="0.4s"
          repeatCount="indefinite"
        />
      </rect>
      <rect x="17" y="14" width="3" height="7" rx="1.5" fill={color}>
        <animateTransform
          attributeName="transform"
          type="rotate"
          values="-20 18 14;20 18 14;-20 18 14"
          dur="0.4s"
          repeatCount="indefinite"
        />
      </rect>
      {/* Cabeca */}
      <circle cx="12" cy="9" r="6" fill={SKIN_TONE} />
      {/* Cabelo */}
      <ellipse cx="12" cy="5.5" rx="6" ry="3.5" fill={hair} />
      {/* Olhos */}
      <circle cx="10" cy="9" r="1" fill={DARK_COLOR} />
      <circle cx="14" cy="9" r="1" fill={DARK_COLOR} />
      {/* Sorriso */}
      <path
        d="M10 11 Q12 13 14 11"
        fill="none"
        stroke={LIP_COLOR}
        strokeWidth="0.6"
      />
      {/* Documento carregado */}
      <rect
        x="17"
        y="16"
        width="5"
        height="6"
        rx="0.5"
        fill="#f1f5f9"
        stroke="#94a3b8"
        strokeWidth="0.3"
      >
        <animateTransform
          attributeName="transform"
          type="rotate"
          values="-20 18 14;20 18 14;-20 18 14"
          dur="0.4s"
          repeatCount="indefinite"
        />
      </rect>
    </g>
  );
}

/** Bracos para status "working" (digitando) */
function TypingArms({ color }: { color: string }) {
  return (
    <>
      <rect x="3" y="16" width="4" height="3" rx="1" fill={color}>
        <animate
          attributeName="y"
          values="16;15;16"
          dur="0.3s"
          repeatCount="indefinite"
        />
      </rect>
      <rect x="2" y="18" width="3" height="2" rx="0.8" fill={SKIN_TONE}>
        <animate
          attributeName="y"
          values="18;17;18"
          dur="0.3s"
          repeatCount="indefinite"
        />
      </rect>
      <rect x="17" y="16" width="4" height="3" rx="1" fill={color}>
        <animate
          attributeName="y"
          values="15;16;15"
          dur="0.3s"
          repeatCount="indefinite"
        />
      </rect>
      <rect x="19" y="18" width="3" height="2" rx="0.8" fill={SKIN_TONE}>
        <animate
          attributeName="y"
          values="17;18;17"
          dur="0.3s"
          repeatCount="indefinite"
        />
      </rect>
    </>
  );
}

/** Bracos para status "blocked" (cruzados) */
function BlockedArms({ color }: { color: string }) {
  return (
    <>
      <rect
        x="4"
        y="16"
        width="3"
        height="6"
        rx="1"
        fill={color}
        transform="rotate(-10 5 16)"
      />
      <rect
        x="17"
        y="16"
        width="3"
        height="6"
        rx="1"
        fill={color}
        transform="rotate(10 18 16)"
      />
      <rect x="3" y="21" width="3" height="2" rx="0.8" fill={SKIN_TONE} />
      <rect x="18" y="21" width="3" height="2" rx="0.8" fill={SKIN_TONE} />
    </>
  );
}

/** Bracos relaxados (idle, review, done) */
function RestingArms({ color }: { color: string }) {
  return (
    <>
      <rect x="3" y="16" width="4" height="5" rx="1.5" fill={color} />
      <rect x="17" y="16" width="4" height="5" rx="1.5" fill={color} />
    </>
  );
}

/** Olhos conforme status */
function Eyes({ status }: { status: AgentStatus }) {
  if (status === "idle") {
    return (
      <>
        <line
          x1="9"
          y1="8"
          x2="11"
          y2="8"
          stroke={DARK_COLOR}
          strokeWidth="1"
          strokeLinecap="round"
        />
        <line
          x1="13"
          y1="8"
          x2="15"
          y2="8"
          stroke={DARK_COLOR}
          strokeWidth="1"
          strokeLinecap="round"
        />
      </>
    );
  }

  if (status === "blocked") {
    return (
      <>
        <g transform="translate(10,8)">
          <line
            x1="-1"
            y1="-1"
            x2="1"
            y2="1"
            stroke="#EF4444"
            strokeWidth="0.8"
          />
          <line
            x1="1"
            y1="-1"
            x2="-1"
            y2="1"
            stroke="#EF4444"
            strokeWidth="0.8"
          />
        </g>
        <g transform="translate(14,8)">
          <line
            x1="-1"
            y1="-1"
            x2="1"
            y2="1"
            stroke="#EF4444"
            strokeWidth="0.8"
          />
          <line
            x1="1"
            y1="-1"
            x2="-1"
            y2="1"
            stroke="#EF4444"
            strokeWidth="0.8"
          />
        </g>
      </>
    );
  }

  // working, review, done — olhos normais
  return (
    <>
      <circle cx="10" cy="8" r="1.2" fill={DARK_COLOR}>
        {status === "working" && (
          <animate
            attributeName="r"
            values="1.2;1;1.2"
            dur="2s"
            repeatCount="indefinite"
          />
        )}
      </circle>
      <circle cx="14" cy="8" r="1.2" fill={DARK_COLOR}>
        {status === "working" && (
          <animate
            attributeName="r"
            values="1;1.2;1"
            dur="2s"
            repeatCount="indefinite"
          />
        )}
      </circle>
      {/* Brilho nos olhos */}
      <circle cx="10.5" cy="7.5" r="0.4" fill="#fff" />
      <circle cx="14.5" cy="7.5" r="0.4" fill="#fff" />
    </>
  );
}

/** Boca conforme status */
function Mouth({ status }: { status: AgentStatus }) {
  if (status === "working") {
    return (
      <path
        d="M10 11 Q12 12.5 14 11"
        fill="none"
        stroke={LIP_COLOR}
        strokeWidth="0.5"
      />
    );
  }
  if (status === "blocked") {
    return (
      <path
        d="M10 12 Q12 10.5 14 12"
        fill="none"
        stroke={LIP_COLOR}
        strokeWidth="0.6"
      />
    );
  }
  if (status === "done") {
    return (
      <path
        d="M9 10.5 Q12 14 15 10.5"
        fill="none"
        stroke={LIP_COLOR}
        strokeWidth="0.6"
      />
    );
  }
  // idle, review
  return (
    <line x1="10" y1="11" x2="14" y2="11" stroke={LIP_COLOR} strokeWidth="0.5" />
  );
}

/** Balao de pensamento por status */
function ThoughtBubble({ status }: { status: AgentStatus }) {
  if (status === "blocked") {
    return (
      <g>
        <circle
          cx="22"
          cy="0"
          r="5"
          fill="#fff"
          stroke="#e2e8f0"
          strokeWidth="0.5"
        />
        <circle cx="19" cy="4" r="1.5" fill="#fff" />
        <circle cx="17" cy="6" r="0.8" fill="#fff" />
        <text x="22" y="2" textAnchor="middle" fontSize="5">
          ❗
        </text>
      </g>
    );
  }

  if (status === "done") {
    return (
      <g>
        <circle
          cx="22"
          cy="0"
          r="5"
          fill="#fff"
          stroke="#e2e8f0"
          strokeWidth="0.5"
        />
        <circle cx="19" cy="4" r="1.5" fill="#fff" />
        <text x="22" y="2" textAnchor="middle" fontSize="5">
          ✅
        </text>
      </g>
    );
  }

  if (status === "idle") {
    return (
      <g opacity="0.7">
        <text x="18" y="2" fontSize="8">
          💤
        </text>
      </g>
    );
  }

  return null;
}

/** Bonequinho sentado na mesa */
function SeatedPerson({
  color,
  status,
  size,
}: {
  color: string;
  status: AgentStatus;
  size: number;
}) {
  const hair = getHairColor(color);

  return (
    <g transform={`scale(${size})`}>
      {/* Encosto da cadeira */}
      <rect x="6" y="10" width="12" height="14" rx="2" fill="#334155" />
      <rect x="4" y="8" width="16" height="3" rx="1.5" fill="#475569" />
      {/* Corpo sentado */}
      <rect x="7" y="14" width="10" height="8" rx="2" fill={color} />
      {/* Pernas na cadeira */}
      <rect x="7" y="21" width="4" height="5" rx="1" fill={PANTS_COLOR} />
      <rect x="13" y="21" width="4" height="5" rx="1" fill={PANTS_COLOR} />
      {/* Sapatos */}
      <rect x="6" y="25" width="5" height="2" rx="1" fill={DARK_COLOR} />
      <rect x="13" y="25" width="5" height="2" rx="1" fill={DARK_COLOR} />
      {/* Bracos conforme status */}
      {status === "working" ? (
        <TypingArms color={color} />
      ) : status === "blocked" ? (
        <BlockedArms color={color} />
      ) : (
        <RestingArms color={color} />
      )}
      {/* Cabeca */}
      <circle cx="12" cy="8" r="6" fill={SKIN_TONE}>
        {status === "working" && (
          <animate
            attributeName="cy"
            values="8;7.5;8"
            dur="1.5s"
            repeatCount="indefinite"
          />
        )}
      </circle>
      {/* Cabelo */}
      <ellipse cx="12" cy="4.5" rx="6" ry="3.5" fill={hair} />
      {/* Olhos */}
      <Eyes status={status} />
      {/* Boca */}
      <Mouth status={status} />
      {/* Balao de pensamento */}
      <ThoughtBubble status={status} />
      {/* Confetti quando done */}
      {status === "done" && (
        <g transform="translate(12, 0)">
          <Confetti agentColor={color} />
        </g>
      )}
    </g>
  );
}

/**
 * Componente principal do bonequinho SVG.
 * Renderiza no estilo sentado (default) ou caminhando.
 */
export function PixelPerson({
  color,
  status,
  direction = 1,
  style = "seated",
  size = 1,
}: PixelPersonProps) {
  if (style === "walking") {
    return <WalkingPerson color={color} direction={direction} size={size} />;
  }

  return <SeatedPerson color={color} status={status} size={size} />;
}
