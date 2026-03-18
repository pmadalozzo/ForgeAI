/**
 * Bonequinho SVG pixel-art chibi com 5 estados visuais.
 * Estilo: pixels visíveis (small rects), proporções chibi, cores vivas.
 * Tamanho base: ~25x30px para caber nas mesas do background.
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

/** Tamanho de cada "pixel" do bonequinho */
const PX = 3;

const SKIN = "#FDBCB4";
const SKIN_SHADOW = "#E8A090";
const PANTS = "#2d3748";
const SHOE = "#1a1a2e";

/** Helper: renderiza um pixel (rect) */
function P({ x, y, c, o }: { x: number; y: number; c: string; o?: number }) {
  return <rect x={x * PX} y={y * PX} width={PX} height={PX} fill={c} opacity={o} />;
}

/** Cabelo pixel art — 2 linhas no topo da cabeça */
function Hair({ color }: { color: string }) {
  const dark = darken(color, 0.3);
  return (
    <g>
      {/* Linha de cima do cabelo */}
      <P x={4} y={0} c={color} />
      <P x={5} y={0} c={color} />
      <P x={6} y={0} c={color} />
      <P x={7} y={0} c={color} />
      <P x={8} y={0} c={color} />
      {/* Linha de baixo do cabelo */}
      <P x={3} y={1} c={color} />
      <P x={4} y={1} c={dark} />
      <P x={5} y={1} c={color} />
      <P x={6} y={1} c={color} />
      <P x={7} y={1} c={dark} />
      <P x={8} y={1} c={color} />
      <P x={9} y={1} c={color} />
    </g>
  );
}

/** Rosto: pele + olhos + boca conforme status */
function Face({ status }: { status: AgentStatus }) {
  return (
    <g>
      {/* Rosto — 5px largo, 4px alto */}
      <P x={4} y={2} c={SKIN} />
      <P x={5} y={2} c={SKIN} />
      <P x={6} y={2} c={SKIN} />
      <P x={7} y={2} c={SKIN} />
      <P x={8} y={2} c={SKIN} />

      <P x={3} y={3} c={SKIN} />
      <P x={4} y={3} c={SKIN} />
      <P x={5} y={3} c={SKIN} />
      <P x={6} y={3} c={SKIN} />
      <P x={7} y={3} c={SKIN} />
      <P x={8} y={3} c={SKIN} />
      <P x={9} y={3} c={SKIN} />

      <P x={3} y={4} c={SKIN} />
      <P x={4} y={4} c={SKIN} />
      <P x={5} y={4} c={SKIN} />
      <P x={6} y={4} c={SKIN} />
      <P x={7} y={4} c={SKIN} />
      <P x={8} y={4} c={SKIN} />
      <P x={9} y={4} c={SKIN} />

      <P x={4} y={5} c={SKIN_SHADOW} />
      <P x={5} y={5} c={SKIN} />
      <P x={6} y={5} c={SKIN} />
      <P x={7} y={5} c={SKIN} />
      <P x={8} y={5} c={SKIN_SHADOW} />

      {/* Olhos */}
      <FaceEyes status={status} />
      {/* Boca */}
      <FaceMouth status={status} />
    </g>
  );
}

function FaceEyes({ status }: { status: AgentStatus }) {
  if (status === "idle") {
    // Olhos fechados — linhas horizontais
    return (
      <>
        <P x={4} y={3} c="#555" />
        <P x={5} y={3} c="#555" />
        <P x={7} y={3} c="#555" />
        <P x={8} y={3} c="#555" />
      </>
    );
  }
  if (status === "blocked") {
    // X vermelho nos olhos
    return (
      <>
        <P x={4} y={3} c="#EF4444" />
        <P x={5} y={4} c="#EF4444" />
        <P x={5} y={3} c="#EF4444" />
        <P x={4} y={4} c="#EF4444" />
        <P x={7} y={3} c="#EF4444" />
        <P x={8} y={4} c="#EF4444" />
        <P x={8} y={3} c="#EF4444" />
        <P x={7} y={4} c="#EF4444" />
      </>
    );
  }
  // working, review, done — olhos abertos
  return (
    <>
      <P x={4} y={3} c="#1a1a2e" />
      <P x={5} y={3} c="#1a1a2e" />
      <P x={7} y={3} c="#1a1a2e" />
      <P x={8} y={3} c="#1a1a2e" />
      {/* Brilho */}
      <rect x={4 * PX} y={3 * PX} width={1} height={1} fill="#fff" opacity={0.8} />
      <rect x={7 * PX} y={3 * PX} width={1} height={1} fill="#fff" opacity={0.8} />
    </>
  );
}

function FaceMouth({ status }: { status: AgentStatus }) {
  if (status === "done") {
    // Sorriso grande — boca aberta
    return (
      <>
        <P x={5} y={5} c="#c0392b" />
        <P x={6} y={5} c="#e74c3c" />
        <P x={7} y={5} c="#c0392b" />
      </>
    );
  }
  if (status === "blocked") {
    // Boca triste
    return <P x={6} y={5} c="#c0392b" />;
  }
  // idle, working, review — boca neutra
  return <P x={6} y={5} c="#c0392b" />;
}

/** Corpo sentado: tronco + braços conforme status + pernas dobradas */
function SeatedBody({ color, status }: { color: string; status: AgentStatus }) {
  const dark = darken(color, 0.2);
  return (
    <g>
      {/* Tronco / camisa — 5px largo */}
      <P x={4} y={6} c={color} />
      <P x={5} y={6} c={color} />
      <P x={6} y={6} c={color} />
      <P x={7} y={6} c={color} />
      <P x={8} y={6} c={color} />
      <P x={4} y={7} c={dark} />
      <P x={5} y={7} c={color} />
      <P x={6} y={7} c={color} />
      <P x={7} y={7} c={color} />
      <P x={8} y={7} c={dark} />
      <P x={4} y={8} c={dark} />
      <P x={5} y={8} c={color} />
      <P x={6} y={8} c={color} />
      <P x={7} y={8} c={color} />
      <P x={8} y={8} c={dark} />

      {/* Braços */}
      <Arms color={color} status={status} />

      {/* Pernas dobradas (sentado) */}
      <P x={4} y={9} c={PANTS} />
      <P x={5} y={9} c={PANTS} />
      <P x={7} y={9} c={PANTS} />
      <P x={8} y={9} c={PANTS} />
      {/* Pernas para frente */}
      <P x={3} y={10} c={PANTS} />
      <P x={4} y={10} c={PANTS} />
      <P x={8} y={10} c={PANTS} />
      <P x={9} y={10} c={PANTS} />
      {/* Sapatos */}
      <P x={2} y={11} c={SHOE} />
      <P x={3} y={11} c={SHOE} />
      <P x={9} y={11} c={SHOE} />
      <P x={10} y={11} c={SHOE} />
    </g>
  );
}

function Arms({ color, status }: { color: string; status: AgentStatus }) {
  if (status === "working") {
    // Mãos no teclado — braços estendidos para frente, com animação
    return (
      <g>
        {/* Braço esquerdo estendido */}
        <P x={3} y={7} c={color} />
        <P x={2} y={7} c={color} />
        <rect x={1 * PX} y={7 * PX} width={PX} height={PX} fill={SKIN}>
          <animate attributeName="y" values={`${7 * PX};${6.5 * PX};${7 * PX}`} dur="0.35s" repeatCount="indefinite" />
        </rect>
        {/* Braço direito estendido */}
        <P x={9} y={7} c={color} />
        <P x={10} y={7} c={color} />
        <rect x={11 * PX} y={7 * PX} width={PX} height={PX} fill={SKIN}>
          <animate attributeName="y" values={`${6.5 * PX};${7 * PX};${6.5 * PX}`} dur="0.35s" repeatCount="indefinite" />
        </rect>
      </g>
    );
  }
  if (status === "blocked") {
    // Braços cruzados
    return (
      <g>
        <P x={3} y={7} c={color} />
        <P x={5} y={8} c={color} />
        <P x={9} y={7} c={color} />
        <P x={7} y={8} c={color} />
        {/* Mãos cruzadas */}
        <P x={6} y={7} c={SKIN} />
      </g>
    );
  }
  if (status === "review") {
    // Mão no queixo (pensando)
    return (
      <g>
        <P x={3} y={7} c={color} />
        <P x={3} y={8} c={color} />
        {/* Mão direita no queixo */}
        <P x={9} y={7} c={color} />
        <P x={9} y={6} c={color} />
        <P x={8} y={5} c={SKIN} />
      </g>
    );
  }
  if (status === "done") {
    // Braços levantados celebrando
    return (
      <g>
        <P x={3} y={6} c={color} />
        <P x={2} y={5} c={color} />
        <P x={1} y={4} c={SKIN} />
        <P x={9} y={6} c={color} />
        <P x={10} y={5} c={color} />
        <P x={11} y={4} c={SKIN} />
      </g>
    );
  }
  // idle — braços relaxados para baixo
  return (
    <g>
      <P x={3} y={7} c={color} />
      <P x={3} y={8} c={color} />
      <P x={3} y={9} c={SKIN} />
      <P x={9} y={7} c={color} />
      <P x={9} y={8} c={color} />
      <P x={9} y={9} c={SKIN} />
    </g>
  );
}

/** Balão de status flutuante */
function StatusBubble({ status }: { status: AgentStatus }) {
  if (status === "idle") {
    return (
      <g opacity={0.7}>
        <text x={22} y={4} fontSize={6} fontFamily="monospace">
          💤
        </text>
      </g>
    );
  }
  if (status === "blocked") {
    return (
      <g>
        <rect x={20} y={-2} width={10} height={10} rx={2} fill="#fff" stroke="#e2e8f0" strokeWidth={0.5} />
        <text x={25} y={6} textAnchor="middle" fontSize={6}>
          ❗
        </text>
      </g>
    );
  }
  if (status === "done") {
    return (
      <g>
        <rect x={20} y={-2} width={10} height={10} rx={2} fill="#fff" stroke="#e2e8f0" strokeWidth={0.5} />
        <text x={25} y={6} textAnchor="middle" fontSize={6}>
          ✅
        </text>
      </g>
    );
  }
  return null;
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
  return (
    <g transform={`scale(${size * direction}, ${size}) translate(${direction < 0 ? -13 : 0}, 0)`}>
      {/* Sombra */}
      <ellipse cx={6 * PX} cy={13 * PX} rx={5} ry={2} fill="#000" opacity={0.15} />

      {/* Cabelo */}
      <Hair color={color} />

      {/* Rosto simplificado */}
      <P x={4} y={2} c={SKIN} /><P x={5} y={2} c={SKIN} /><P x={6} y={2} c={SKIN} /><P x={7} y={2} c={SKIN} /><P x={8} y={2} c={SKIN} />
      <P x={3} y={3} c={SKIN} /><P x={4} y={3} c="#1a1a2e" /><P x={5} y={3} c={SKIN} /><P x={6} y={3} c={SKIN} /><P x={7} y={3} c={SKIN} /><P x={8} y={3} c="#1a1a2e" /><P x={9} y={3} c={SKIN} />
      <P x={4} y={4} c={SKIN} /><P x={5} y={4} c={SKIN} /><P x={6} y={4} c="#c0392b" /><P x={7} y={4} c={SKIN} /><P x={8} y={4} c={SKIN} />

      {/* Corpo */}
      <P x={4} y={5} c={color} /><P x={5} y={5} c={color} /><P x={6} y={5} c={color} /><P x={7} y={5} c={color} /><P x={8} y={5} c={color} />
      <P x={4} y={6} c={color} /><P x={5} y={6} c={color} /><P x={6} y={6} c={color} /><P x={7} y={6} c={color} /><P x={8} y={6} c={color} />

      {/* Braços balançando */}
      <rect x={3 * PX} y={5 * PX} width={PX} height={3 * PX} fill={color}>
        <animateTransform attributeName="transform" type="rotate" values={`15 ${3 * PX} ${5 * PX};-15 ${3 * PX} ${5 * PX};15 ${3 * PX} ${5 * PX}`} dur="0.4s" repeatCount="indefinite" />
      </rect>
      <rect x={9 * PX} y={5 * PX} width={PX} height={3 * PX} fill={color}>
        <animateTransform attributeName="transform" type="rotate" values={`-15 ${9 * PX} ${5 * PX};15 ${9 * PX} ${5 * PX};-15 ${9 * PX} ${5 * PX}`} dur="0.4s" repeatCount="indefinite" />
      </rect>

      {/* Pernas andando */}
      <rect x={5 * PX} y={7 * PX} width={PX} height={4 * PX} fill={PANTS}>
        <animateTransform attributeName="transform" type="rotate" values={`-20 ${5 * PX} ${7 * PX};20 ${5 * PX} ${7 * PX};-20 ${5 * PX} ${7 * PX}`} dur="0.4s" repeatCount="indefinite" />
      </rect>
      <rect x={7 * PX} y={7 * PX} width={PX} height={4 * PX} fill={PANTS}>
        <animateTransform attributeName="transform" type="rotate" values={`20 ${7 * PX} ${7 * PX};-20 ${7 * PX} ${7 * PX};20 ${7 * PX} ${7 * PX}`} dur="0.4s" repeatCount="indefinite" />
      </rect>

      {/* Sapatos */}
      <P x={4} y={11} c={SHOE} /><P x={5} y={11} c={SHOE} />
      <P x={7} y={11} c={SHOE} /><P x={8} y={11} c={SHOE} />

      {/* Documento */}
      <rect x={10 * PX} y={6 * PX} width={4} height={5} rx={0.5} fill="#f1f5f9" stroke="#94a3b8" strokeWidth={0.3}>
        <animateTransform attributeName="transform" type="rotate" values={`-15 ${9 * PX} ${5 * PX};15 ${9 * PX} ${5 * PX};-15 ${9 * PX} ${5 * PX}`} dur="0.4s" repeatCount="indefinite" />
      </rect>
    </g>
  );
}

/** Escurece uma cor hex */
function darken(hex: string, amount: number): string {
  const num = parseInt(hex.slice(1), 16);
  const r = Math.max(0, ((num >> 16) & 0xff) * (1 - amount));
  const g = Math.max(0, ((num >> 8) & 0xff) * (1 - amount));
  const b = Math.max(0, (num & 0xff) * (1 - amount));
  return `#${((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1)}`;
}

/**
 * Componente principal do bonequinho SVG pixel-art.
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

  return (
    <g transform={`scale(${size})`}>
      {/* Cabelo */}
      <Hair color={color} />
      {/* Rosto + olhos + boca */}
      <Face status={status} />
      {/* Corpo sentado + braços + pernas */}
      <SeatedBody color={color} status={status} />
      {/* Balão de status */}
      <StatusBubble status={status} />
      {/* Confetti quando done */}
      {status === "done" && (
        <g transform={`translate(${6 * PX}, 0)`}>
          <Confetti agentColor={color} />
        </g>
      )}
      {/* Head bobble when working */}
      {status === "working" && (
        <rect x={0} y={0} width={0} height={0} opacity={0}>
          <animateTransform
            attributeName="transform"
            type="translate"
            values="0 0;0 -1;0 0"
            dur="1.5s"
            repeatCount="indefinite"
            additive="sum"
          />
        </rect>
      )}
    </g>
  );
}
