/**
 * Particulas de confetti SVG animadas para o estado "done".
 * Renderiza circulos e retangulos coloridos caindo.
 */

const COLORS = ["#3B82F6", "#10B981", "#EF4444", "#EAB308", "#8B5CF6", "#EC4899", "#06B6D4"];
const PARTICLE_COUNT = 12;

/** Gera dados deterministicos de particulas baseados na cor do agente */
function generateParticles(agentColor: string) {
  const seed = agentColor.charCodeAt(1) + agentColor.charCodeAt(3);
  return Array.from({ length: PARTICLE_COUNT }, (_, i) => {
    const s = (seed + i * 7) % 100;
    return {
      x: -10 + ((s * 3 + i * 5) % 44),
      startY: -15 - (s % 12),
      endY: 10 + (s % 20),
      size: 1.5 + (s % 3),
      color: COLORS[(s + i) % COLORS.length] ?? "#3B82F6",
      dur: `${1.2 + (s % 8) * 0.15}s`,
      delay: `${(i * 0.1).toFixed(1)}s`,
      isCircle: i % 3 !== 0,
      rotation: (s * 17) % 360,
    };
  });
}

interface ConfettiProps {
  /** Cor do agente para gerar particulas deterministicas */
  agentColor: string;
}

export function Confetti({ agentColor }: ConfettiProps) {
  const particles = generateParticles(agentColor);

  return (
    <g opacity="0.8">
      {particles.map((p, i) => (
        <g key={i}>
          {p.isCircle ? (
            <circle
              cx={p.x}
              cy={p.startY}
              r={p.size}
              fill={p.color}
              opacity="0"
            >
              <animate
                attributeName="cy"
                values={`${p.startY};${p.endY}`}
                dur={p.dur}
                begin={p.delay}
                repeatCount="indefinite"
              />
              <animate
                attributeName="opacity"
                values="0;0.9;0.9;0"
                dur={p.dur}
                begin={p.delay}
                repeatCount="indefinite"
              />
            </circle>
          ) : (
            <rect
              x={p.x - p.size / 2}
              y={p.startY}
              width={p.size}
              height={p.size * 1.5}
              rx="0.3"
              fill={p.color}
              opacity="0"
              transform={`rotate(${p.rotation} ${p.x} ${p.startY})`}
            >
              <animate
                attributeName="y"
                values={`${p.startY};${p.endY}`}
                dur={p.dur}
                begin={p.delay}
                repeatCount="indefinite"
              />
              <animate
                attributeName="opacity"
                values="0;0.8;0.8;0"
                dur={p.dur}
                begin={p.delay}
                repeatCount="indefinite"
              />
              <animateTransform
                attributeName="transform"
                type="rotate"
                values={`${p.rotation} ${p.x} ${p.startY};${p.rotation + 360} ${p.x} ${p.endY}`}
                dur={p.dur}
                begin={p.delay}
                repeatCount="indefinite"
              />
            </rect>
          )}
        </g>
      ))}
    </g>
  );
}
