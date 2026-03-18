/**
 * Estacao de trabalho SVG estilo SoWork/Gather.town.
 * Mesa escura com profundidade 3D, cadeira teal, monitor com brilho colorido.
 */
import type { DeskItem } from "@/types/agents";

interface DeskProps {
  /** Cor tematica do agente (hex) — usada no brilho do monitor */
  color: string;
  /** Itens decorativos presentes na mesa */
  items: DeskItem[];
  /** Status do agente — quando "review", mostra diff no monitor */
  agentStatus?: string;
}

/** Caneca de cafe com vapor animado */
function Coffee() {
  return (
    <g transform="translate(6, 20)">
      {/* Caneca escura */}
      <rect x="0" y="2" width="7" height="8" rx="1.5" fill="#1a1a1a" stroke="#333" strokeWidth="0.5" />
      <rect
        x="7"
        y="4"
        width="3"
        height="4"
        rx="1.5"
        fill="none"
        stroke="#333"
        strokeWidth="0.8"
      />
      {/* Liquido */}
      <rect x="1" y="4" width="5" height="4" rx="0.5" fill="#6F4E37" opacity="0.8" />
      {/* Vapor */}
      <path
        d="M2 1 Q3 -1 2 -3"
        fill="none"
        stroke="#94a3b8"
        strokeWidth="0.5"
        opacity="0.6"
      >
        <animate
          attributeName="d"
          values="M2 1 Q3 -1 2 -3;M2 1 Q1 -1 2 -3;M2 1 Q3 -1 2 -3"
          dur="2s"
          repeatCount="indefinite"
        />
      </path>
      <path
        d="M4.5 1 Q5.5 -2 4.5 -4"
        fill="none"
        stroke="#94a3b8"
        strokeWidth="0.4"
        opacity="0.5"
      >
        <animate
          attributeName="d"
          values="M4.5 1 Q5.5 -2 4.5 -4;M4.5 1 Q3.5 -2 4.5 -4;M4.5 1 Q5.5 -2 4.5 -4"
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
    <g transform="translate(56, 6)">
      {/* Vaso de terracota */}
      <path d="M2,12 L1,20 L11,20 L10,12 Z" fill="#8B4513" />
      <rect x="1" y="11" width="10" height="2" rx="0.5" fill="#A0522D" />
      {/* Folhagem vibrante */}
      <ellipse cx="6" cy="8" rx="6" ry="5" fill="#228B22" opacity="0.85" />
      <ellipse cx="3" cy="5" rx="4" ry="3.5" fill="#2E8B57" opacity="0.75" />
      <ellipse cx="9" cy="6" rx="4.5" ry="4" fill="#006400" opacity="0.7" />
      <ellipse cx="6" cy="3" rx="3" ry="2.5" fill="#32CD32" opacity="0.55" />
    </g>
  );
}

/** Pilha de papeis */
function Papers() {
  return (
    <g transform="translate(8, 24)">
      <rect
        x="0"
        y="0"
        width="8"
        height="10"
        rx="0.5"
        fill="#e8e8e8"
        transform="rotate(-5)"
      />
      <rect
        x="2"
        y="1"
        width="8"
        height="10"
        rx="0.5"
        fill="#f0f0f0"
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
          fill="#888"
          opacity="0.6"
        />
      ))}
    </g>
  );
}

/**
 * Estacao de trabalho completa estilo SoWork.
 * Mesa escura com 3D, cadeira teal, monitor com linhas de codigo.
 */
export function Desk({ color, items, agentStatus }: DeskProps) {
  const hasCoffee = items.includes("caneca-cafe");
  const hasPlant = items.includes("vaso-planta");
  const hasPapers = items.includes("pilha-papeis");
  const isReview = agentStatus === "review";

  return (
    <g>
      {/* Sombra da mesa no chao */}
      <ellipse cx="35" cy="54" rx="36" ry="5" fill="#000000" opacity="0.3" />

      {/* ── Cadeira teal (atras da mesa) ── */}
      <g transform="translate(22, 42)">
        {/* Encosto da cadeira */}
        <rect x="4" y="-4" width="18" height="12" rx="3" fill="#0891B2" stroke="#0E7490" strokeWidth="0.8" />
        {/* Assento */}
        <rect x="2" y="8" width="22" height="4" rx="2" fill="#0891B2" stroke="#0E7490" strokeWidth="0.5" />
        {/* Base da cadeira */}
        <rect x="10" y="12" width="6" height="3" rx="0.5" fill="#333" />
        {/* Rodas */}
        <circle cx="8" cy="16" r="1.5" fill="#444" />
        <circle cx="18" cy="16" r="1.5" fill="#444" />
        <circle cx="13" cy="17" r="1.5" fill="#444" />
      </g>

      {/* ── Mesa escura com profundidade 3D ── */}
      {/* Face superior da mesa (mais clara) */}
      <rect
        x="0"
        y="18"
        width="70"
        height="8"
        rx="2"
        fill="#3a3a3a"
      />
      {/* Face frontal da mesa (mais escura — profundidade) */}
      <rect
        x="0"
        y="26"
        width="70"
        height="14"
        rx="0"
        fill="#1a1a1a"
        stroke="#111"
        strokeWidth="0.5"
      />
      {/* Borda inferior arredondada */}
      <rect
        x="0"
        y="38"
        width="70"
        height="2"
        fill="#111"
        rx="1"
      />
      {/* Pes da mesa — metal escuro */}
      <rect x="4" y="40" width="3" height="12" rx="1" fill="#2a2a2a" />
      <rect x="63" y="40" width="3" height="12" rx="1" fill="#2a2a2a" />
      {/* Barra entre pes */}
      <rect x="6" y="48" width="58" height="1.5" rx="0.5" fill="#222" />

      {/* ── Monitor ── */}
      {/* Moldura do monitor (escura) */}
      <rect
        x="20"
        y="0"
        width="30"
        height="19"
        rx="2"
        fill="#111111"
        stroke={isReview ? "#8B5CF6" : "#222"}
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
      {/* Tela do monitor */}
      <rect x="22" y="2" width="26" height="14" rx="1" fill="#0a0a1a" />
      {/* Brilho colorido na tela */}
      <rect
        x="23"
        y="3"
        width="24"
        height="12"
        rx="0.5"
        fill={color}
        opacity="0.1"
      />
      {/* Suporte do monitor */}
      <rect x="32" y="19" width="6" height="2" rx="0.5" fill="#222" />
      <rect x="29" y="20" width="12" height="2" rx="1" fill="#333" />

      {/* Linhas de codigo ou diff */}
      {isReview
        ? [0, 1, 2, 3].map((i) => (
            <rect
              key={i}
              x={24}
              y={5 + i * 2.5}
              width={12 + ((i * 5) % 8)}
              height="1.2"
              rx="0.5"
              fill={i % 2 === 0 ? "#22c55e" : "#ef4444"}
              opacity="0.7"
            >
              <animate
                attributeName="opacity"
                values="0.7;0.4;0.7"
                dur={`${1.5 + i * 0.3}s`}
                repeatCount="indefinite"
              />
            </rect>
          ))
        : [0, 1, 2, 3].map((i) => (
            <rect
              key={i}
              x={24 + (i % 2) * 2}
              y={5 + i * 2.5}
              width={10 + ((i * 3) % 10)}
              height="1.2"
              rx="0.5"
              fill={color}
              opacity="0.55"
            >
              <animate
                attributeName="width"
                values={`${10 + ((i * 3) % 10)};${14 + ((i * 2) % 8)};${10 + ((i * 3) % 10)}`}
                dur={`${2 + i * 0.5}s`}
                repeatCount="indefinite"
              />
            </rect>
          ))}

      {/* ── Teclado escuro ── */}
      <rect
        x="22"
        y="24"
        width="24"
        height="7"
        rx="1.5"
        fill="#1a1a1a"
        stroke="#333"
        strokeWidth="0.5"
      />
      {[0, 1, 2].map((row) =>
        [0, 1, 2, 3, 4, 5, 6].map((col) => (
          <rect
            key={`key-${row}-${col}`}
            x={23.5 + col * 3}
            y={25.5 + row * 1.8}
            width="2"
            height="1.2"
            rx="0.3"
            fill="#333"
            opacity="0.8"
          />
        )),
      )}

      {/* ── Mouse escuro ── */}
      <rect
        x="50"
        y="25"
        width="5"
        height="6"
        rx="2.5"
        fill="#1a1a1a"
        stroke="#333"
        strokeWidth="0.5"
      />
      {/* Scroll wheel */}
      <rect x="51.5" y="26" width="2" height="1.5" rx="0.5" fill="#444" />

      {/* Itens opcionais */}
      {hasCoffee && <Coffee />}
      {hasPlant && <Plant />}
      {hasPapers && <Papers />}
    </g>
  );
}
