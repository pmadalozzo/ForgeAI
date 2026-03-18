/**
 * Estacao de trabalho SVG com monitor, teclado, mouse e itens opcionais.
 * Convertido do protótipo com tipagem estrita.
 */
import type { DeskItem } from "@/types/agents";

interface DeskProps {
  /** Cor temática do agente (hex) — usada no brilho do monitor */
  color: string;
  /** Itens decorativos presentes na mesa */
  items: DeskItem[];
  /** Status do agente — quando "review", mostra diff no monitor */
  agentStatus?: string;
}

/** Caneca de cafe com vapor animado */
function Coffee() {
  return (
    <g transform="translate(6, 22)">
      <rect x="0" y="2" width="6" height="7" rx="1.5" fill="#8B6914" />
      <rect
        x="6"
        y="4"
        width="3"
        height="3"
        rx="1.5"
        fill="none"
        stroke="#8B6914"
        strokeWidth="0.8"
      />
      {/* Vapor */}
      <path
        d="M2 1 Q3 -1 2 -3"
        fill="none"
        stroke="#94a3b8"
        strokeWidth="0.4"
        opacity="0.5"
      >
        <animate
          attributeName="d"
          values="M2 1 Q3 -1 2 -3;M2 1 Q1 -1 2 -3;M2 1 Q3 -1 2 -3"
          dur="2s"
          repeatCount="indefinite"
        />
      </path>
      <path
        d="M4 1 Q5 -2 4 -4"
        fill="none"
        stroke="#94a3b8"
        strokeWidth="0.3"
        opacity="0.4"
      >
        <animate
          attributeName="d"
          values="M4 1 Q5 -2 4 -4;M4 1 Q3 -2 4 -4;M4 1 Q5 -2 4 -4"
          dur="2.5s"
          repeatCount="indefinite"
        />
      </path>
    </g>
  );
}

/** Vaso com planta */
function Plant() {
  return (
    <g transform="translate(56, 10)">
      <rect x="2" y="6" width="7" height="8" rx="1" fill="#92400e" />
      <circle cx="5.5" cy="5" r="5" fill="#22c55e" opacity="0.7" />
      <circle cx="3" cy="3" r="3" fill="#16a34a" opacity="0.6" />
      <circle cx="8" cy="4" r="3.5" fill="#15803d" opacity="0.5" />
    </g>
  );
}

/** Pilha de papeis */
function Papers() {
  return (
    <g transform="translate(8, 26)">
      <rect
        x="0"
        y="0"
        width="8"
        height="10"
        rx="0.5"
        fill="#f1f5f9"
        transform="rotate(-5)"
      />
      <rect
        x="2"
        y="1"
        width="8"
        height="10"
        rx="0.5"
        fill="#e2e8f0"
        transform="rotate(3)"
      />
      {[0, 1, 2, 3].map((i) => (
        <rect
          key={i}
          x={3}
          y={3 + i * 2}
          width={5 + (i % 3)}
          height="0.8"
          rx="0.3"
          fill="#94a3b8"
          opacity="0.5"
        />
      ))}
    </g>
  );
}

/**
 * Estacao de trabalho completa.
 * Inclui mesa, monitor com linhas de codigo animadas, teclado, mouse,
 * e itens decorativos opcionais.
 */
export function Desk({ color, items, agentStatus }: DeskProps) {
  const hasCoffee = items.includes("caneca-cafe");
  const hasPlant = items.includes("vaso-planta");
  const hasPapers = items.includes("pilha-papeis");
  const isReview = agentStatus === "review";

  return (
    <g>
      {/* Superficie da mesa */}
      <rect
        x="0"
        y="18"
        width="70"
        height="24"
        rx="3"
        fill="#5c4a3a"
        stroke="#4a3a2e"
        strokeWidth="0.8"
      />
      <rect
        x="2"
        y="19"
        width="66"
        height="6"
        rx="1"
        fill="#6b5a4a"
        opacity="0.5"
      />
      {/* Pes da mesa */}
      <rect x="4" y="42" width="4" height="10" rx="1" fill="#4a3a2e" />
      <rect x="62" y="42" width="4" height="10" rx="1" fill="#4a3a2e" />
      {/* Monitor */}
      <rect
        x="22"
        y="2"
        width="26"
        height="17"
        rx="2"
        fill="#1a1a2e"
        stroke={isReview ? "#8B5CF6" : "#2d3748"}
        strokeWidth={isReview ? 1.5 : 1}
      >
        {isReview && (
          <animate
            attributeName="stroke-opacity"
            values="1;0.4;1"
            dur="2s"
            repeatCount="indefinite"
          />
        )}
      </rect>
      <rect x="24" y="4" width="22" height="12" rx="1" fill="#0f172a" />
      {/* Suporte do monitor */}
      <rect x="32" y="19" width="6" height="3" rx="0.5" fill="#2d3748" />
      <rect x="29" y="21" width="12" height="2" rx="1" fill="#2d3748" />
      {/* Brilho na tela */}
      <rect
        x="25"
        y="5"
        width="20"
        height="10"
        rx="0.5"
        fill={color}
        opacity="0.1"
      />
      {/* Linhas de codigo ou diff */}
      {isReview
        ? /* Diff verde/vermelho no modo review */
          [0, 1, 2, 3].map((i) => (
            <rect
              key={i}
              x={26}
              y={6 + i * 2.5}
              width={10 + ((i * 5) % 8)}
              height="1.2"
              rx="0.5"
              fill={i % 2 === 0 ? "#22c55e" : "#ef4444"}
              opacity="0.55"
            >
              <animate
                attributeName="opacity"
                values="0.55;0.35;0.55"
                dur={`${1.5 + i * 0.3}s`}
                repeatCount="indefinite"
              />
            </rect>
          ))
        : /* Linhas de codigo animadas */
          [0, 1, 2, 3].map((i) => (
            <rect
              key={i}
              x={26 + (i % 2) * 2}
              y={6 + i * 2.5}
              width={8 + ((i * 3) % 10)}
              height="1.2"
              rx="0.5"
              fill={color}
              opacity="0.4"
            >
              <animate
                attributeName="width"
                values={`${8 + ((i * 3) % 10)};${12 + ((i * 2) % 8)};${8 + ((i * 3) % 10)}`}
                dur={`${2 + i * 0.5}s`}
                repeatCount="indefinite"
              />
            </rect>
          ))}
      {/* Teclado */}
      <rect
        x="24"
        y="25"
        width="22"
        height="6"
        rx="1.5"
        fill="#2d3748"
        stroke="#475569"
        strokeWidth="0.3"
      />
      {[0, 1, 2].map((row) =>
        [0, 1, 2, 3, 4, 5].map((col) => (
          <rect
            key={`key-${row}-${col}`}
            x={25.5 + col * 3.3}
            y={26 + row * 1.8}
            width="2.5"
            height="1.2"
            rx="0.3"
            fill="#475569"
            opacity="0.6"
          />
        )),
      )}
      {/* Mouse */}
      <rect
        x="50"
        y="27"
        width="4"
        height="5"
        rx="2"
        fill="#475569"
        stroke="#64748b"
        strokeWidth="0.3"
      />
      {/* Itens opcionais */}
      {hasCoffee && <Coffee />}
      {hasPlant && <Plant />}
      {hasPapers && <Papers />}
    </g>
  );
}
