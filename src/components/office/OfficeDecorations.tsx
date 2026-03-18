/**
 * Elementos decorativos SVG do escritorio virtual.
 * Bebedouro, quadro kanban, maquina de cafe, plantas decorativas,
 * impressora, dashboard de metricas.
 * Posicoes calibradas para viewBox 920x600, distribuidas nas bordas e entre zonas.
 */

/** Bebedouro / water cooler */
export function WaterCooler() {
  return (
    <g opacity="0.6">
      <rect x="0" y="8" width="12" height="18" rx="2" fill="#93c5fd" opacity="0.5" />
      <rect x="2" y="4" width="8" height="6" rx="1" fill="#bfdbfe" opacity="0.6" />
      <text x="6" y="0" textAnchor="middle" fontSize="8">
        🚰
      </text>
    </g>
  );
}

/** Quadro kanban / whiteboard */
export function KanbanBoard() {
  return (
    <g opacity="0.6">
      <rect
        x="0"
        y="0"
        width="30"
        height="20"
        rx="2"
        fill="#f8fafc"
        stroke="#94a3b8"
        strokeWidth="0.8"
      />
      {/* Colunas do kanban */}
      <line x1="10" y1="2" x2="10" y2="18" stroke="#94a3b8" strokeWidth="0.3" />
      <line x1="20" y1="2" x2="20" y2="18" stroke="#94a3b8" strokeWidth="0.3" />
      {/* Labels */}
      <text x="5" y="5" textAnchor="middle" fontSize="2.5" fill="#6b7280">
        TODO
      </text>
      <text x="15" y="5" textAnchor="middle" fontSize="2.5" fill="#6b7280">
        DOING
      </text>
      <text x="25" y="5" textAnchor="middle" fontSize="2.5" fill="#6b7280">
        DONE
      </text>
      {/* Post-its */}
      <rect x="3" y="7" width="4" height="3" rx="0.5" fill="#3B82F6" opacity="0.4" />
      <rect x="3" y="11" width="4" height="3" rx="0.5" fill="#8B5CF6" opacity="0.4" />
      <rect x="13" y="7" width="4" height="3" rx="0.5" fill="#F97316" opacity="0.4" />
      <rect x="13" y="11" width="4" height="3" rx="0.5" fill="#06B6D4" opacity="0.4" />
      <rect x="23" y="7" width="4" height="3" rx="0.5" fill="#10B981" opacity="0.4" />
    </g>
  );
}

/** Maquina de cafe */
export function CoffeeMachine() {
  return (
    <g opacity="0.55">
      <rect x="0" y="2" width="14" height="20" rx="2" fill="#e2e8f0" stroke="#94a3b8" strokeWidth="0.5" />
      <rect x="2" y="4" width="10" height="6" rx="1" fill="#cbd5e1" />
      {/* Botoes */}
      <circle cx="5" cy="14" r="1.5" fill="#EF4444" opacity="0.6" />
      <circle cx="9" cy="14" r="1.5" fill="#10B981" opacity="0.6" />
      {/* Bandeja */}
      <rect x="3" y="18" width="8" height="2" rx="0.5" fill="#94a3b8" />
      <text x="7" y="0" textAnchor="middle" fontSize="7">
        ☕
      </text>
    </g>
  );
}

/** Planta decorativa grande */
export function DecorativePlant() {
  return (
    <g opacity="0.6">
      <rect x="2" y="14" width="8" height="10" rx="1.5" fill="#a16207" />
      <circle cx="6" cy="10" r="7" fill="#22c55e" opacity="0.5" />
      <circle cx="3" cy="7" r="4" fill="#16a34a" opacity="0.4" />
      <circle cx="9" cy="8" r="5" fill="#15803d" opacity="0.35" />
      <circle cx="6" cy="4" r="3" fill="#22c55e" opacity="0.3" />
    </g>
  );
}

/** Impressora (zona QA) */
export function Printer() {
  return (
    <g opacity="0.55">
      <rect x="0" y="4" width="16" height="10" rx="2" fill="#e2e8f0" stroke="#94a3b8" strokeWidth="0.5" />
      <rect x="3" y="0" width="10" height="5" rx="1" fill="#cbd5e1" />
      <rect x="4" y="12" width="8" height="4" rx="0.5" fill="#f8fafc" opacity="0.8" />
      {/* Bandeja de saida */}
      <rect x="2" y="14" width="12" height="1" rx="0.5" fill="#94a3b8" />
    </g>
  );
}

/** Dashboard de metricas (zona Ops) */
export function MetricsDashboard() {
  return (
    <g opacity="0.55">
      <rect
        x="0"
        y="0"
        width="28"
        height="18"
        rx="2"
        fill="#f1f5f9"
        stroke="#94a3b8"
        strokeWidth="0.8"
      />
      {/* Barras do grafico */}
      <rect x="3" y="10" width="3" height="6" rx="0.5" fill="#10B981" opacity="0.5" />
      <rect x="7" y="7" width="3" height="9" rx="0.5" fill="#3B82F6" opacity="0.5" />
      <rect x="11" y="4" width="3" height="12" rx="0.5" fill="#EAB308" opacity="0.5" />
      <rect x="15" y="8" width="3" height="8" rx="0.5" fill="#EF4444" opacity="0.5" />
      <rect x="19" y="3" width="3" height="13" rx="0.5" fill="#8B5CF6" opacity="0.5" />
      <rect x="23" y="6" width="3" height="10" rx="0.5" fill="#EC4899" opacity="0.5" />
    </g>
  );
}

/**
 * Agrupa todas as decoracoes do escritorio.
 * Posicionadas para o canvas 920x600 com 3 zonas.
 */
export function OfficeDecorations() {
  return (
    <g>
      {/* Bebedouro entre Management e Development */}
      <g transform="translate(860, 200)">
        <WaterCooler />
      </g>

      {/* Quadro kanban na parede (zona Management) */}
      <g transform="translate(56, 170)">
        <KanbanBoard />
      </g>

      {/* Maquina de cafe entre Development e QA */}
      <g transform="translate(56, 390)">
        <CoffeeMachine />
      </g>

      {/* Planta decorativa (canto superior esquerdo) */}
      <g transform="translate(10, 10)">
        <DecorativePlant />
      </g>

      {/* Planta decorativa (canto inferior direito) */}
      <g transform="translate(895, 565)">
        <DecorativePlant />
      </g>

      {/* Planta decorativa (canto superior direito) */}
      <g transform="translate(895, 10)">
        <DecorativePlant />
      </g>

      {/* Planta decorativa (canto inferior esquerdo) */}
      <g transform="translate(10, 565)">
        <DecorativePlant />
      </g>

      {/* Impressora (zona QA) */}
      <g transform="translate(850, 450)">
        <Printer />
      </g>

      {/* Dashboard de metricas (zona Ops) */}
      <g transform="translate(850, 210)">
        <MetricsDashboard />
      </g>
    </g>
  );
}
