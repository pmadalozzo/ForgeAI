/**
 * Barra de progresso reutilizável com gradiente.
 * Usada em estações de trabalho, progresso de sprint, etc.
 */

interface ProgressBarProps {
  /** Progresso atual (0-100) */
  value: number;
  /** Largura total em pixels SVG (default 70) */
  width?: number;
  /** Altura em pixels SVG (default 3) */
  height?: number;
  /** Cor de preenchimento ou "gradient" para gradiente padrão */
  color?: string;
  /** Se a barra deve pulsar (animação de opacidade) */
  pulse?: boolean;
  /** ID único para gradiente SVG (necessário quando múltiplas barras com gradiente) */
  gradientId?: string;
}

export function ProgressBar({
  value,
  width = 70,
  height = 3,
  color = "#3B82F6",
  pulse = true,
  gradientId = "progressGrad",
}: ProgressBarProps) {
  const clampedValue = Math.min(100, Math.max(0, value));
  const fillWidth = width * (clampedValue / 100);
  const isGradient = color === "gradient";

  return (
    <g>
      {isGradient && (
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#3B82F6" />
            <stop offset="50%" stopColor="#8B5CF6" />
            <stop offset="100%" stopColor="#10B981" />
          </linearGradient>
        </defs>
      )}
      {/* Trilho de fundo */}
      <rect
        width={width}
        height={height}
        rx={height / 2}
        fill="#1e293b"
      />
      {/* Preenchimento */}
      <rect
        width={fillWidth}
        height={height}
        rx={height / 2}
        fill={isGradient ? `url(#${gradientId})` : color}
        opacity={0.7}
      >
        {pulse && (
          <animate
            attributeName="opacity"
            values="0.5;0.8;0.5"
            dur="2s"
            repeatCount="indefinite"
          />
        )}
      </rect>
    </g>
  );
}
