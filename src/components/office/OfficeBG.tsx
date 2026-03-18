/**
 * Background SVG do escritorio virtual — layout 2x2 com corredor em cruz.
 * 4 salas: Research (top-left), Management (top-right),
 *          Development (bottom-left), QA & Security (bottom-right).
 * Corredor em forma de cruz conectando todas as salas.
 * Janelas panoramicas na borda direita com sunset e pinheiros.
 *
 * Depende de defs definidos no OfficeCanvas:
 *   - pattern#floorTiles
 *   - linearGradient#sunsetSky
 *   - radialGradient#lampGlow
 *   - filter#softShadow
 */

/* ─── Paleta ─── */
const WALL_TOP = "#A07850";
const WALL_FRONT = "#6B4226";
const WALL_TRIM = "#4A2E12";
const CORRIDOR_FLOOR = "#B8B0A0";
const CORRIDOR_TILE_LINE = "#A8A090";
const DOOR_WOOD = "#8B6914";

/* ─── Room carpet colors ─── */
const CARPET_RESEARCH = "#D8D0E8";
const CARPET_MANAGEMENT = "#D4C4A0";
const CARPET_DEVELOPMENT = "#C8D8C0";
const CARPET_QA = "#D8D0B8";

/* ═══════════════════════════════════════════════════════════════ */
/*  Structural helpers                                            */
/* ═══════════════════════════════════════════════════════════════ */

/** Parede horizontal 3D — top face 5px + front face 16px + trim 2px */
function WallH({ x, y, w }: { x: number; y: number; w: number }) {
  return (
    <g>
      <rect x={x} y={y} width={w} height={5} fill={WALL_TOP} />
      <rect x={x} y={y + 5} width={w} height={16} fill={WALL_FRONT} />
      <rect x={x} y={y + 21} width={w} height={2} fill={WALL_TRIM} />
    </g>
  );
}

/** Parede vertical 3D */
function WallV({ x, y, h }: { x: number; y: number; h: number }) {
  return (
    <g>
      <rect x={x} y={y} width={5} height={h} fill={WALL_TOP} />
      <rect x={x + 5} y={y} width={16} height={h} fill={WALL_FRONT} />
      <rect x={x + 21} y={y} width={2} height={h} fill={WALL_TRIM} />
    </g>
  );
}

/** Luminaria pendente */
function PendantLamp({ x, y }: { x: number; y: number }) {
  return (
    <g>
      <line x1={x} y1={y} x2={x} y2={y + 10} stroke="#555" strokeWidth={1.5} />
      <rect x={x - 8} y={y + 10} width={16} height={4} fill="#888" rx={2} />
      <rect x={x - 6} y={y + 14} width={12} height={2} fill="#AAA" rx={1} />
      <circle cx={x} cy={y + 16} r={2} fill="#FFEEBB" opacity={0.9} />
      <ellipse cx={x} cy={y + 28} rx={20} ry={10} fill="url(#lampGlow)" />
    </g>
  );
}

/** Planta grande em vaso */
function BigPlant({ x, y }: { x: number; y: number }) {
  return (
    <g transform={`translate(${x},${y})`}>
      <rect x={1} y={18} width={14} height={14} fill="#8B5E3C" rx={2} />
      <rect x={0} y={16} width={16} height={4} fill="#A0703C" rx={1} />
      <circle cx={8} cy={10} r={7} fill="#228B22" opacity={0.75} />
      <circle cx={4} cy={6} r={5} fill="#2E8B57" opacity={0.65} />
      <circle cx={12} cy={7} r={5.5} fill="#1A7A1A" opacity={0.6} />
      <circle cx={8} cy={3} r={4} fill="#32CD32" opacity={0.5} />
      <circle cx={3} cy={12} r={3} fill="#228B22" opacity={0.5} />
      <rect x={7} y={12} width={2} height={6} fill="#4A7A2A" />
    </g>
  );
}

/** Planta pequena */
function SmallPlant({ x, y }: { x: number; y: number }) {
  return (
    <g transform={`translate(${x},${y})`}>
      <rect x={2} y={12} width={8} height={8} fill="#8B5E3C" rx={1} />
      <rect x={1} y={10} width={10} height={3} fill="#A0703C" rx={1} />
      <circle cx={6} cy={6} r={5} fill="#228B22" opacity={0.7} />
      <circle cx={3} cy={4} r={3.5} fill="#2E8B57" opacity={0.6} />
      <circle cx={9} cy={4} r={3.5} fill="#1A7A1A" opacity={0.55} />
      <circle cx={6} cy={1} r={3} fill="#32CD32" opacity={0.45} />
      <rect x={5} y={8} width={2} height={4} fill="#4A7A2A" />
    </g>
  );
}

/* ═══════════════════════════════════════════════════════════════ */
/*  Furniture components                                          */
/* ═══════════════════════════════════════════════════════════════ */

/** Whiteboard com conteudo */
function Whiteboard({ x, y, w, h }: { x: number; y: number; w?: number; h?: number }) {
  const ww = w ?? 60;
  const hh = h ?? 35;
  return (
    <g transform={`translate(${x},${y})`}>
      <rect x={0} y={0} width={ww} height={hh} fill="#C0C0C0" rx={1} />
      <rect x={2} y={2} width={ww - 4} height={hh - 4} fill="#F5F5F5" rx={1} />
      <rect x={5} y={5} width={20} height={10} fill="none" stroke="#3B82F6" strokeWidth={0.8} rx={1} />
      <rect x={30} y={5} width={20} height={10} fill="none" stroke="#10B981" strokeWidth={0.8} rx={1} />
      <line x1={25} y1={10} x2={30} y2={10} stroke="#EF4444" strokeWidth={0.8} />
      <rect x={5} y={18} width={ww - 14} height={1} fill="#6B7280" opacity={0.3} />
      <rect x={5} y={21} width={30} height={1} fill="#6B7280" opacity={0.25} />
      <rect x={5} y={24} width={38} height={1} fill="#6B7280" opacity={0.2} />
      <rect x={10} y={hh - 2} width={ww - 20} height={3} fill="#999" rx={0.5} />
      <rect x={15} y={hh - 2} width={4} height={2} fill="#EF4444" rx={0.3} />
      <rect x={21} y={hh - 2} width={4} height={2} fill="#3B82F6" rx={0.3} />
      <rect x={27} y={hh - 2} width={4} height={2} fill="#111" rx={0.3} />
    </g>
  );
}

/** Lab bench with test tubes */
function LabBench({ x, y }: { x: number; y: number }) {
  const colors = ["#EF4444", "#3B82F6", "#22C55E", "#EAB308", "#A855F7"];
  return (
    <g transform={`translate(${x},${y})`}>
      {/* Bench surface */}
      <rect x={0} y={16} width={50} height={4} fill="#666" rx={1} />
      <rect x={2} y={20} width={3} height={8} fill="#555" />
      <rect x={45} y={20} width={3} height={8} fill="#555" />
      {/* Test tube rack */}
      <rect x={5} y={12} width={30} height={3} fill="#888" rx={0.5} />
      {/* Tubes */}
      {colors.map((c, i) => (
        <g key={i}>
          <rect x={7 + i * 5} y={2} width={4} height={11} fill="#DDE8F0" opacity={0.5} rx={1} />
          <rect x={7 + i * 5} y={6 - i % 3} width={4} height={7 + i % 3} fill={c} opacity={0.4} rx={1} />
          <rect x={7 + i * 5} y={0} width={4} height={3} fill="#CCD5DD" rx={1} />
        </g>
      ))}
      {/* Beakers */}
      <rect x={38} y={8} width={8} height={8} fill="#DDE8F0" opacity={0.3} rx={1} />
      <rect x={39} y={10} width={6} height={5} fill="#93C5FD" opacity={0.3} rx={1} />
    </g>
  );
}

/** Microscope pixel art */
function Microscope({ x, y }: { x: number; y: number }) {
  return (
    <g transform={`translate(${x},${y})`}>
      <rect x={0} y={22} width={18} height={4} fill="#666" rx={1} />
      <rect x={7} y={4} width={4} height={18} fill="#555" />
      <rect x={3} y={0} width={8} height={6} fill="#444" rx={1} />
      <rect x={4} y={1} width={6} height={3} fill="#333" rx={1} />
      <rect x={2} y={14} width={14} height={2} fill="#777" />
      <rect x={8} y={10} width={3} height={5} fill="#888" rx={0.5} />
      <circle cx={9.5} cy={15} r={2} fill="#99CCFF" opacity={0.5} />
    </g>
  );
}

/** Bookshelf */
function Bookshelf({ x, y }: { x: number; y: number }) {
  const bk = ["#C0392B", "#2980B9", "#F39C12", "#27AE60", "#8E44AD", "#E74C3C", "#3498DB", "#1ABC9C"];
  return (
    <g transform={`translate(${x},${y})`}>
      <rect x={0} y={0} width={40} height={38} fill="#5A3A2A" />
      <rect x={1} y={0} width={38} height={1} fill="#7A5A3A" />
      {[0, 1, 2].map((row) => (
        <g key={row}>
          <rect x={1} y={1 + row * 12} width={38} height={11} fill="#3A2A1A" />
          {[0, 1, 2, 3, 4, 5].map((col) => (
            <rect
              key={col}
              x={3 + col * 6}
              y={2 + row * 12}
              width={4}
              height={9 + (col % 2) * -2}
              fill={bk[(row * 6 + col) % bk.length]}
              opacity={0.85}
              rx={0.5}
            />
          ))}
          <rect x={0} y={12 + row * 12} width={40} height={2} fill="#7A5A3A" />
        </g>
      ))}
    </g>
  );
}

/** Round meeting table with chairs */
function MeetingTable({ x, y }: { x: number; y: number }) {
  return (
    <g transform={`translate(${x},${y})`}>
      <ellipse cx={40} cy={28} rx={44} ry={10} fill="#000" opacity={0.12} />
      <ellipse cx={40} cy={12} rx={40} ry={18} fill="#5A3A1A" />
      <ellipse cx={40} cy={10} rx={40} ry={18} fill="#6B5040" />
      <ellipse cx={40} cy={10} rx={36} ry={15} fill="#7A5A45" />
      <rect x={36} y={22} width={8} height={10} fill="#4A3525" rx={1} />
      <ellipse cx={40} cy={32} rx={14} ry={4} fill="#4A3525" />
      {/* Chairs */}
      <rect x={30} y={-8} width={18} height={8} rx={3} fill="#0891B2" />
      <rect x={30} y={36} width={18} height={8} rx={3} fill="#0891B2" />
      <rect x={-8} y={10} width={8} height={16} rx={3} fill="#0891B2" />
      <rect x={78} y={10} width={8} height={16} rx={3} fill="#0891B2" />
      <rect x={62} y={-4} width={14} height={7} rx={3} fill="#0891B2" />
    </g>
  );
}

/** Sofa pixel art */
function Sofa({ x, y, color }: { x: number; y: number; color: string }) {
  const dk = darken(color, 0.3);
  return (
    <g transform={`translate(${x},${y})`}>
      <rect x={0} y={0} width={50} height={12} fill={dk} rx={2} />
      <rect x={0} y={10} width={50} height={10} fill={color} rx={2} />
      <rect x={16} y={10} width={1} height={10} fill={dk} opacity={0.3} />
      <rect x={33} y={10} width={1} height={10} fill={dk} opacity={0.3} />
      <rect x={-4} y={4} width={6} height={16} fill={dk} rx={2} />
      <rect x={48} y={4} width={6} height={16} fill={dk} rx={2} />
      <rect x={4} y={20} width={3} height={3} fill="#333" rx={0.5} />
      <rect x={43} y={20} width={3} height={3} fill="#333" rx={0.5} />
    </g>
  );
}

/** Large TV/screen on wall */
function WallTV({ x, y, w, h }: { x: number; y: number; w: number; h: number }) {
  return (
    <g>
      <rect x={x} y={y} width={w} height={h} fill="#111" rx={2} />
      <rect x={x + 2} y={y + 2} width={w - 4} height={h - 4} fill="#0a0a2a" rx={1} />
      {/* Content on screen — dashboard-like */}
      <rect x={x + 5} y={y + 5} width={w * 0.4} height={h * 0.3} fill="#3B82F6" opacity={0.15} rx={1} />
      <rect x={x + 5 + w * 0.45} y={y + 5} width={w * 0.4} height={h * 0.3} fill="#10B981" opacity={0.15} rx={1} />
      <rect x={x + 5} y={y + 5 + h * 0.4} width={w - 10} height={1.5} fill="#3B82F6" opacity={0.3} />
      <rect x={x + 5} y={y + 5 + h * 0.55} width={w * 0.6} height={1.5} fill="#10B981" opacity={0.25} />
      <rect x={x + 5} y={y + 5 + h * 0.7} width={w * 0.8} height={1.5} fill="#F97316" opacity={0.2} />
      {/* Stand */}
      <rect x={x + w / 2 - 3} y={y + h} width={6} height={4} fill="#333" />
      <rect x={x + w / 2 - 8} y={y + h + 4} width={16} height={2} fill="#444" rx={1} />
    </g>
  );
}

/** Fireplace with animated flames */
function Fireplace({ x, y }: { x: number; y: number }) {
  return (
    <g transform={`translate(${x},${y})`}>
      <rect x={0} y={0} width={40} height={36} fill="#6B4A2A" rx={1} />
      <rect x={2} y={-2} width={36} height={4} fill="#8B6914" rx={1} />
      <rect x={6} y={10} width={28} height={26} fill="#1A1A1A" rx={2} />
      <rect x={8} y={12} width={24} height={22} fill="#111" rx={1} />
      <rect x={10} y={28} width={20} height={4} fill="#5A3A1A" rx={1} />
      <rect x={12} y={26} width={16} height={3} fill="#4A2A10" rx={1} transform="rotate(-10 20 28)" />
      <ellipse cx={20} cy={24} rx={6} ry={8} fill="#FF6B00" opacity={0.7}>
        <animate attributeName="ry" values="8;10;7;9;8" dur="0.8s" repeatCount="indefinite" />
        <animate attributeName="opacity" values="0.7;0.9;0.6;0.8;0.7" dur="0.8s" repeatCount="indefinite" />
      </ellipse>
      <ellipse cx={18} cy={22} rx={3} ry={5} fill="#FFAA00" opacity={0.6}>
        <animate attributeName="ry" values="5;7;4;6;5" dur="0.6s" repeatCount="indefinite" />
      </ellipse>
      <ellipse cx={22} cy={23} rx={2} ry={4} fill="#FFD700" opacity={0.5}>
        <animate attributeName="ry" values="4;5;3;4.5;4" dur="0.5s" repeatCount="indefinite" />
      </ellipse>
      <rect x={-2} y={-4} width={44} height={3} fill="#7A5A3A" rx={0.5} />
    </g>
  );
}

/** Wall painting with gold frame */
function WallPainting({ x, y, w, h, color }: { x: number; y: number; w: number; h: number; color: string }) {
  return (
    <g>
      <rect x={x - 1} y={y - 1} width={w + 2} height={h + 2} fill="#B8960C" rx={1} />
      <rect x={x} y={y} width={w} height={h} fill="#5A4030" rx={1} />
      <rect x={x + 2} y={y + 2} width={w - 4} height={h - 4} fill={color} opacity={0.25} rx={1} />
      <rect x={x + 4} y={y + 4} width={w * 0.3} height={h * 0.35} fill={color} opacity={0.45} />
      <circle cx={x + w * 0.65} cy={y + h * 0.5} r={h * 0.2} fill={color} opacity={0.3} />
    </g>
  );
}

/** Coffee machine with steam */
function CoffeeMachine({ x, y }: { x: number; y: number }) {
  return (
    <g transform={`translate(${x},${y})`}>
      <rect x={0} y={0} width={18} height={26} fill="#444" rx={1} />
      <rect x={1} y={1} width={16} height={8} fill="#333" rx={1} />
      <rect x={3} y={2} width={12} height={5} fill="#0a3a0a" rx={1} />
      <text x={9} y={6} textAnchor="middle" fontSize={3} fill="#22C55E" fontFamily="monospace">CAFE</text>
      <circle cx={5} cy={12} r={1.5} fill="#EF4444" />
      <circle cx={9} cy={12} r={1.5} fill="#22C55E" />
      <circle cx={13} cy={12} r={1.5} fill="#3B82F6" />
      <rect x={7} y={16} width={4} height={3} fill="#333" rx={0.5} />
      <rect x={2} y={22} width={14} height={2} fill="#666" rx={0.5} />
      <rect x={5} y={19} width={6} height={5} fill="#DDD" rx={1} />
      <rect x={11} y={20} width={2} height={3} rx={1} fill="none" stroke="#DDD" strokeWidth={0.6} />
      {/* Steam */}
      <path d="M7,-2 Q5,-6 8,-10" fill="none" stroke="#ccc" strokeWidth={0.8} opacity={0.3}>
        <animate attributeName="opacity" values="0.3;0.1;0.3" dur="2s" repeatCount="indefinite" />
      </path>
      <path d="M11,-2 Q13,-7 10,-12" fill="none" stroke="#ccc" strokeWidth={0.8} opacity={0.2}>
        <animate attributeName="opacity" values="0.2;0.05;0.2" dur="2.5s" repeatCount="indefinite" />
      </path>
    </g>
  );
}

/** Whiteboard with post-its */
function WhiteboardWithPostits({ x, y }: { x: number; y: number }) {
  return (
    <g transform={`translate(${x},${y})`}>
      <rect x={0} y={0} width={50} height={30} fill="#C0C0C0" rx={1} />
      <rect x={2} y={2} width={46} height={26} fill="#F5F5F5" rx={1} />
      <rect x={4} y={4} width={9} height={9} fill="#FDE68A" rx={0.5} />
      <rect x={15} y={4} width={9} height={9} fill="#FCA5A5" rx={0.5} />
      <rect x={26} y={4} width={9} height={9} fill="#93C5FD" rx={0.5} />
      <rect x={37} y={4} width={9} height={9} fill="#86EFAC" rx={0.5} />
      <rect x={4} y={15} width={9} height={9} fill="#C4B5FD" rx={0.5} />
      <rect x={15} y={15} width={9} height={9} fill="#FDBA74" rx={0.5} />
      <rect x={26} y={15} width={9} height={9} fill="#F9A8D4" rx={0.5} />
      {[4, 15, 26, 37].map((px, i) => (
        <g key={i}>
          <rect x={px + 1} y={6} width={6 + i % 2} height={0.8} fill="#666" opacity={0.4} />
          <rect x={px + 1} y={8} width={5} height={0.8} fill="#666" opacity={0.3} />
        </g>
      ))}
    </g>
  );
}

/** Wall monitor for ops */
function WallMonitor({ x, y, w, h, color }: { x: number; y: number; w: number; h: number; color: string }) {
  return (
    <g>
      <rect x={x} y={y} width={w} height={h} fill="#111" rx={1} />
      <rect x={x + 2} y={y + 2} width={w - 4} height={h - 4} fill="#0a0a1a" rx={1} />
      <rect x={x + 3} y={y + 3} width={w - 6} height={h - 6} fill={color} opacity={0.06} />
      {/* Graph lines */}
      {[0, 1, 2].map((i) => (
        <rect key={i} x={x + 4} y={y + 5 + i * 4} width={w * 0.5 + i * 3} height={1.5} fill={color} opacity={0.4} rx={0.5} />
      ))}
      {/* Blinking dots */}
      <circle cx={x + w - 6} cy={y + 6} r={1.2} fill="#22C55E" opacity={0.7}>
        <animate attributeName="opacity" values="0.7;0.2;0.7" dur="1.5s" repeatCount="indefinite" />
      </circle>
      <circle cx={x + w - 5} cy={y + h - 4} r={1} fill="#22C55E" opacity={0.7} />
    </g>
  );
}

/** Server rack with blinking LEDs */
function ServerRack({ x, y }: { x: number; y: number }) {
  return (
    <g transform={`translate(${x},${y})`}>
      <rect x={0} y={0} width={22} height={50} fill="#2A2A2A" rx={1} />
      {[0, 1, 2, 3, 4, 5].map((i) => (
        <g key={i}>
          <rect x={2} y={2 + i * 8} width={18} height={6} fill="#3A3A3A" rx={0.5} />
          <circle cx={5} cy={5 + i * 8} r={1} fill={i % 2 === 0 ? "#22C55E" : "#3B82F6"} opacity={0.8}>
            <animate attributeName="opacity" values="0.8;0.3;0.8" dur={`${1.2 + i * 0.3}s`} repeatCount="indefinite" />
          </circle>
          <circle cx={8} cy={5 + i * 8} r={1} fill={i % 3 === 0 ? "#EF4444" : "#22C55E"} opacity={0.6}>
            <animate attributeName="opacity" values="0.6;0.2;0.6" dur={`${1.5 + i * 0.2}s`} repeatCount="indefinite" />
          </circle>
          <rect x={13} y={3 + i * 8} width={5} height={4} fill="#2A2A2A" rx={0.3} />
        </g>
      ))}
    </g>
  );
}

/** Printer */
function Printer({ x, y }: { x: number; y: number }) {
  return (
    <g transform={`translate(${x},${y})`}>
      <rect x={0} y={4} width={22} height={14} fill="#E2E8F0" rx={1} />
      <rect x={4} y={0} width={14} height={6} fill="#CBD5E1" rx={1} />
      <rect x={3} y={16} width={16} height={2} fill="#94A3B8" rx={0.5} />
      <rect x={6} y={14} width={10} height={6} fill="#F8FAFC" rx={0.5} />
      <circle cx={16} cy={9} r={1.2} fill="#22C55E" />
      <circle cx={16} cy={13} r={1.2} fill="#EF4444" />
    </g>
  );
}

/** Security camera */
function SecurityCamera({ x, y }: { x: number; y: number }) {
  return (
    <g transform={`translate(${x},${y})`}>
      <rect x={4} y={0} width={4} height={6} fill="#555" />
      <rect x={0} y={6} width={12} height={8} fill="#333" rx={1} />
      <circle cx={6} cy={10} r={3} fill="#222" />
      <circle cx={6} cy={10} r={2} fill="#111" />
      <circle cx={6} cy={10} r={1} fill="#3B82F6" opacity={0.4} />
      <circle cx={10} cy={8} r={0.8} fill="#EF4444" opacity={0.8}>
        <animate attributeName="opacity" values="0.8;0.2;0.8" dur="2s" repeatCount="indefinite" />
      </circle>
    </g>
  );
}

/** Water cooler */
function WaterCooler({ x, y }: { x: number; y: number }) {
  return (
    <g transform={`translate(${x},${y})`}>
      <rect x={3} y={0} width={10} height={14} fill="#93C5FD" rx={2} opacity={0.65} />
      <rect x={5} y={0} width={6} height={3} fill="#BFDBFE" rx={1} />
      <rect x={2} y={14} width={12} height={16} fill="#E2E8F0" rx={1} />
      <rect x={0} y={18} width={3} height={2} fill="#3B82F6" rx={0.5} />
      <rect x={13} y={18} width={3} height={2} fill="#EF4444" rx={0.5} />
      <rect x={1} y={28} width={14} height={2} fill="#94A3B8" rx={0.5} />
      <rect x={3} y={30} width={2} height={3} fill="#666" />
      <rect x={11} y={30} width={2} height={3} fill="#666" />
    </g>
  );
}

/** Bench in corridor */
function Bench({ x, y }: { x: number; y: number }) {
  return (
    <g transform={`translate(${x},${y})`}>
      <rect x={0} y={0} width={36} height={4} fill="#7A5A3A" rx={1} />
      <rect x={2} y={4} width={3} height={6} fill="#5A3A2A" />
      <rect x={31} y={4} width={3} height={6} fill="#5A3A2A" />
      <rect x={0} y={4} width={36} height={2} fill="#6B4A2A" rx={0.5} />
    </g>
  );
}

/** Decorative rug — double rect with patterned border */
function Rug({ x, y, w, h, outer, inner }: { x: number; y: number; w: number; h: number; outer: string; inner: string }) {
  return (
    <g>
      <rect x={x} y={y} width={w} height={h} fill={outer} rx={2} opacity={0.8} />
      <rect x={x + 3} y={y + 3} width={w - 6} height={h - 6} fill={inner} rx={1} opacity={0.85} />
      <rect x={x + 6} y={y + 6} width={w - 12} height={h - 12} fill={outer} rx={1} opacity={0.35} />
      {/* Corner diamonds */}
      <rect x={x + 5} y={y + 5} width={4} height={4} fill={inner} opacity={0.6} transform={`rotate(45 ${x + 7} ${y + 7})`} />
      <rect x={x + w - 9} y={y + 5} width={4} height={4} fill={inner} opacity={0.6} transform={`rotate(45 ${x + w - 7} ${y + 7})`} />
      <rect x={x + 5} y={y + h - 9} width={4} height={4} fill={inner} opacity={0.6} transform={`rotate(45 ${x + 7} ${y + h - 7})`} />
      <rect x={x + w - 9} y={y + h - 9} width={4} height={4} fill={inner} opacity={0.6} transform={`rotate(45 ${x + w - 7} ${y + h - 7})`} />
    </g>
  );
}

/** Wall clock */
function WallClock({ x, y }: { x: number; y: number }) {
  return (
    <g transform={`translate(${x},${y})`}>
      <circle cx={0} cy={0} r={9} fill="#F5F5F0" stroke="#C9A96E" strokeWidth={1.5} />
      <circle cx={0} cy={0} r={8} fill="#FAFAF5" />
      {/* Hour marks */}
      {[0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330].map((deg) => (
        <line key={deg} x1={0} y1={-6} x2={0} y2={-7.5} stroke="#333" strokeWidth={0.8} transform={`rotate(${deg})`} />
      ))}
      {/* Hour hand */}
      <line x1={0} y1={0} x2={0} y2={-4.5} stroke="#222" strokeWidth={1.2} transform="rotate(30)" />
      {/* Minute hand */}
      <line x1={0} y1={0} x2={0} y2={-6} stroke="#222" strokeWidth={0.8} transform="rotate(180)" />
      <circle cx={0} cy={0} r={1} fill="#333" />
    </g>
  );
}

/** Medium plant — between small and big */
function MediumPlant({ x, y }: { x: number; y: number }) {
  return (
    <g transform={`translate(${x},${y})`}>
      <rect x={1} y={14} width={12} height={11} fill="#8B5E3C" rx={2} />
      <rect x={0} y={12} width={14} height={3} fill="#A0703C" rx={1} />
      <circle cx={7} cy={7} r={6} fill="#006400" opacity={0.8} />
      <circle cx={3} cy={4} r={4} fill="#228B22" opacity={0.7} />
      <circle cx={11} cy={5} r={4.5} fill="#2E8B57" opacity={0.65} />
      <circle cx={7} cy={1} r={3.5} fill="#228B22" opacity={0.55} />
      <rect x={6} y={9} width={2} height={5} fill="#4A7A2A" />
    </g>
  );
}

/** Picture frame with gold border and colored interior */
function PictureFrame({ x, y, w, h, color }: { x: number; y: number; w: number; h: number; color: string }) {
  return (
    <g>
      <rect x={x - 1.5} y={y - 1.5} width={w + 3} height={h + 3} fill="#C9A96E" rx={1} />
      <rect x={x} y={y} width={w} height={h} fill="#3A2A1A" rx={0.5} />
      <rect x={x + 1.5} y={y + 1.5} width={w - 3} height={h - 3} fill={color} opacity={0.6} rx={0.5} />
    </g>
  );
}

/** Lamp glow on floor */
function FloorGlow({ cx, cy }: { cx: number; cy: number }) {
  return <ellipse cx={cx} cy={cy} rx={30} ry={14} fill="#FFE8A0" opacity={0.08} />;
}

/** Filing cabinet */
function FilingCabinet({ x, y }: { x: number; y: number }) {
  return (
    <g transform={`translate(${x},${y})`}>
      <rect x={0} y={0} width={16} height={14} fill="#6B7280" rx={1} />
      <rect x={0} y={15} width={16} height={14} fill="#6B7280" rx={1} />
      <rect x={5} y={4} width={6} height={2} fill="#9CA3AF" rx={0.5} />
      <rect x={5} y={19} width={6} height={2} fill="#9CA3AF" rx={0.5} />
      <rect x={7} y={5} width={2} height={0.8} fill="#555" />
      <rect x={7} y={20} width={2} height={0.8} fill="#555" />
    </g>
  );
}

/** Computer monitor on desk */
function DeskMonitor({ x, y, screenColor }: { x: number; y: number; screenColor?: string }) {
  const sc = screenColor ?? "#0a0a2a";
  return (
    <g transform={`translate(${x},${y})`}>
      <rect x={0} y={0} width={20} height={14} fill="#222" rx={1} />
      <rect x={1} y={1} width={18} height={11} fill={sc} rx={0.5} />
      {/* Screen content lines */}
      <rect x={3} y={3} width={10} height={1} fill="#3B82F6" opacity={0.4} />
      <rect x={3} y={5.5} width={14} height={1} fill="#10B981" opacity={0.3} />
      <rect x={3} y={8} width={8} height={1} fill="#F97316" opacity={0.25} />
      {/* Stand */}
      <rect x={8} y={14} width={4} height={3} fill="#333" />
      <rect x={5} y={17} width={10} height={1.5} fill="#444" rx={0.5} />
    </g>
  );
}

/** Globe */
function Globe({ x, y }: { x: number; y: number }) {
  return (
    <g transform={`translate(${x},${y})`}>
      <rect x={4} y={16} width={8} height={2} fill="#8B6914" rx={0.5} />
      <rect x={7} y={12} width={2} height={4} fill="#8B6914" />
      <circle cx={8} cy={8} r={8} fill="#2563EB" opacity={0.5} />
      <circle cx={8} cy={8} r={7.5} fill="none" stroke="#C9A96E" strokeWidth={0.5} />
      {/* Continents */}
      <rect x={3} y={4} width={5} height={3} fill="#228B22" opacity={0.6} rx={1} />
      <rect x={9} y={6} width={4} height={5} fill="#228B22" opacity={0.5} rx={1} />
      <rect x={5} y={10} width={3} height={2} fill="#228B22" opacity={0.4} rx={0.5} />
      {/* Axis line */}
      <line x1={8} y1={0} x2={8} y2={16} stroke="#C9A96E" strokeWidth={0.3} opacity={0.4} />
      <ellipse cx={8} cy={8} rx={8} ry={3} fill="none" stroke="#C9A96E" strokeWidth={0.3} opacity={0.3} />
    </g>
  );
}

/** Scattered papers */
function ScatteredPapers({ x, y }: { x: number; y: number }) {
  return (
    <g transform={`translate(${x},${y})`}>
      <rect x={0} y={0} width={8} height={6} fill="#F5F5F0" opacity={0.9} transform="rotate(-12 4 3)" />
      <rect x={6} y={-2} width={7} height={5} fill="#FFF" opacity={0.85} transform="rotate(8 9 0)" />
      <rect x={14} y={1} width={6} height={5} fill="#F0F0E8" opacity={0.8} transform="rotate(-5 17 3)" />
      <rect x={3} y={4} width={9} height={5} fill="#FAFAF5" opacity={0.75} transform="rotate(15 7 6)" />
    </g>
  );
}

/** Coffee table */
function CoffeeTable({ x, y }: { x: number; y: number }) {
  return (
    <g transform={`translate(${x},${y})`}>
      <rect x={0} y={4} width={3} height={8} fill="#5A3A1A" />
      <rect x={27} y={4} width={3} height={8} fill="#5A3A1A" />
      <rect x={0} y={0} width={30} height={5} fill="#7A5A3A" rx={1} />
      <rect x={1} y={0} width={28} height={1} fill="#8B6A4A" rx={0.5} />
    </g>
  );
}

/** Coat rack */
function CoatRack({ x, y }: { x: number; y: number }) {
  return (
    <g transform={`translate(${x},${y})`}>
      <rect x={4} y={0} width={2} height={28} fill="#5A3A2A" />
      <circle cx={5} cy={0} r={2} fill="#5A3A2A" />
      <circle cx={0} cy={4} r={2} fill="#6B4A2A" />
      <circle cx={10} cy={4} r={2} fill="#6B4A2A" />
      <circle cx={0} cy={10} r={2} fill="#6B4A2A" />
      <circle cx={10} cy={10} r={2} fill="#6B4A2A" />
      {/* Coat hanging */}
      <rect x={-3} y={5} width={6} height={8} fill="#2563EB" opacity={0.5} rx={1} />
      <rect x={8} y={5} width={5} height={7} fill="#6B7280" opacity={0.5} rx={1} />
      {/* Base */}
      <rect x={0} y={28} width={10} height={2} fill="#5A3A2A" rx={1} />
    </g>
  );
}

/** Water dispenser */
function WaterDispenser({ x, y }: { x: number; y: number }) {
  return (
    <g transform={`translate(${x},${y})`}>
      <rect x={2} y={0} width={12} height={16} fill="#93C5FD" rx={3} opacity={0.6} />
      <rect x={4} y={0} width={8} height={4} fill="#BFDBFE" rx={2} />
      <rect x={1} y={16} width={14} height={18} fill="#E2E8F0" rx={1} />
      <rect x={5} y={20} width={2} height={3} fill="#3B82F6" rx={0.5} />
      <rect x={9} y={20} width={2} height={3} fill="#EF4444" rx={0.5} />
      <rect x={0} y={34} width={16} height={2} fill="#94A3B8" rx={0.5} />
      <rect x={2} y={36} width={3} height={3} fill="#666" />
      <rect x={11} y={36} width={3} height={3} fill="#666" />
    </g>
  );
}

/** Standing desk with monitor */
function StandingDesk({ x, y }: { x: number; y: number }) {
  return (
    <g transform={`translate(${x},${y})`}>
      {/* Shadow */}
      <rect x={2} y={38} width={30} height={4} fill="#000" opacity={0.1} rx={1} />
      {/* Legs */}
      <rect x={2} y={16} width={3} height={22} fill="#555" />
      <rect x={27} y={16} width={3} height={22} fill="#555" />
      {/* Desk surface */}
      <rect x={0} y={14} width={32} height={3} fill="#666" rx={1} />
      {/* Monitor */}
      <rect x={6} y={0} width={20} height={13} fill="#222" rx={1} />
      <rect x={7} y={1} width={18} height={10} fill="#0a0a2a" rx={0.5} />
      <rect x={9} y={3} width={12} height={1} fill="#06B6D4" opacity={0.4} />
      <rect x={9} y={5} width={14} height={1} fill="#10B981" opacity={0.3} />
      <rect x={9} y={7} width={8} height={1} fill="#F97316" opacity={0.25} />
      <rect x={14} y={13} width={4} height={2} fill="#333" />
      {/* Keyboard */}
      <rect x={6} y={15} width={16} height={2} fill="#444" rx={0.5} />
    </g>
  );
}

/** Headphones on desk */
function Headphones({ x, y }: { x: number; y: number }) {
  return (
    <g transform={`translate(${x},${y})`}>
      <path d="M0,8 Q0,0 6,0 Q12,0 12,8" fill="none" stroke="#333" strokeWidth={2} />
      <rect x={-2} y={6} width={4} height={6} fill="#444" rx={1} />
      <rect x={10} y={6} width={4} height={6} fill="#444" rx={1} />
      <rect x={-1} y={7} width={2} height={4} fill="#666" rx={0.5} />
      <rect x={11} y={7} width={2} height={4} fill="#666" rx={0.5} />
    </g>
  );
}

/** Trash can */
function TrashCan({ x, y }: { x: number; y: number }) {
  return (
    <g transform={`translate(${x},${y})`}>
      <rect x={1} y={0} width={12} height={2} fill="#6B7280" rx={0.5} />
      <rect x={2} y={2} width={10} height={14} fill="#555" rx={0} />
      <rect x={1.5} y={2} width={11} height={1} fill="#777" />
      {/* Trapezoid shape via clip */}
      <rect x={3} y={14} width={8} height={2} fill="#444" />
    </g>
  );
}

/** Fire extinguisher */
function FireExtinguisher({ x, y }: { x: number; y: number }) {
  return (
    <g transform={`translate(${x},${y})`}>
      <rect x={2} y={4} width={8} height={16} fill="#DC2626" rx={2} />
      <rect x={3} y={2} width={6} height={3} fill="#B91C1C" rx={1} />
      <rect x={5} y={0} width={2} height={3} fill="#444" />
      <rect x={3} y={9} width={6} height={4} fill="#FFF" opacity={0.3} rx={0.5} />
      <rect x={0} y={20} width={12} height={2} fill="#333" rx={0.5} />
    </g>
  );
}

/** Vending machine */
function VendingMachine({ x, y }: { x: number; y: number }) {
  return (
    <g transform={`translate(${x},${y})`}>
      <rect x={0} y={0} width={22} height={40} fill="#374151" rx={2} />
      <rect x={2} y={2} width={18} height={24} fill="#1F2937" rx={1} />
      {/* Drink items */}
      {[0, 1, 2, 3].map((row) =>
        [0, 1, 2].map((col) => (
          <circle key={`${row}-${col}`} cx={6 + col * 5} cy={6 + row * 5} r={1.8}
            fill={["#EF4444", "#3B82F6", "#22C55E", "#EAB308", "#EC4899", "#F97316",
                   "#06B6D4", "#A855F7", "#EF4444", "#10B981", "#3B82F6", "#FBBF24"]
                  [row * 3 + col]}
            opacity={0.8}
          />
        ))
      )}
      {/* Dispensing slot */}
      <rect x={4} y={28} width={14} height={6} fill="#111" rx={1} />
      {/* Coin slot */}
      <rect x={16} y={30} width={3} height={1} fill="#C9A96E" rx={0.3} />
      {/* Buttons */}
      <rect x={3} y={36} width={4} height={2} fill="#22C55E" rx={0.5} />
      <rect x={9} y={36} width={4} height={2} fill="#EF4444" rx={0.5} />
    </g>
  );
}

/** Welcome mat */
function WelcomeMat({ x, y, w }: { x: number; y: number; w?: number }) {
  const ww = w ?? 30;
  return (
    <g>
      <rect x={x} y={y} width={ww} height={6} fill="#8B6914" rx={1} opacity={0.7} />
      <rect x={x + 2} y={y + 1} width={ww - 4} height={4} fill="#A07850" rx={0.5} opacity={0.8} />
    </g>
  );
}

/** Emergency exit sign */
function ExitSign({ x, y }: { x: number; y: number }) {
  return (
    <g transform={`translate(${x},${y})`}>
      <rect x={0} y={0} width={20} height={8} fill="#15803D" rx={1} />
      <text x={10} y={6} textAnchor="middle" fontSize={3.5} fill="#FFF" fontFamily="monospace" fontWeight="700">EXIT</text>
    </g>
  );
}

/** Monitoring wall — 3 large screens side by side */
function MonitoringWall({ x, y }: { x: number; y: number }) {
  const screens: Array<{ color: string; dots: Array<[number, number, string]> }> = [
    { color: "#EF4444", dots: [[8, 8, "#EF4444"], [14, 12, "#22C55E"], [20, 6, "#EAB308"]] },
    { color: "#3B82F6", dots: [[8, 10, "#3B82F6"], [16, 5, "#06B6D4"], [12, 14, "#10B981"]] },
    { color: "#22C55E", dots: [[10, 8, "#22C55E"], [18, 12, "#EC4899"], [6, 14, "#F97316"]] },
  ];
  return (
    <g transform={`translate(${x},${y})`}>
      {screens.map((s, i) => (
        <g key={i}>
          <rect x={i * 35} y={0} width={32} height={22} fill="#111" rx={1} />
          <rect x={i * 35 + 1} y={1} width={30} height={20} fill="#0a0a1a" rx={0.5} />
          {/* Metric lines */}
          <rect x={i * 35 + 3} y={4} width={18} height={1} fill={s.color} opacity={0.35} />
          <rect x={i * 35 + 3} y={7} width={24} height={1} fill={s.color} opacity={0.25} />
          <rect x={i * 35 + 3} y={10} width={14} height={1} fill={s.color} opacity={0.3} />
          {/* Dots */}
          {s.dots.map((d, j) => (
            <circle key={j} cx={i * 35 + d[0]} cy={d[1]} r={1.2} fill={d[2]} opacity={0.7}>
              <animate attributeName="opacity" values="0.7;0.3;0.7" dur={`${1.2 + j * 0.4}s`} repeatCount="indefinite" />
            </circle>
          ))}
        </g>
      ))}
    </g>
  );
}

/** Direction sign */
function DirectionSign({ x, y, text, direction }: { x: number; y: number; text: string; direction: "left" | "right" }) {
  return (
    <g transform={`translate(${x},${y})`}>
      <rect x={4} y={0} width={3} height={18} fill="#666" />
      {direction === "right" ? (
        <polygon points="0,-2 40,-2 46,5 40,12 0,12" fill="#2563EB" opacity={0.8} />
      ) : (
        <polygon points="6,-2 46,-2 46,12 6,12 0,5" fill="#2563EB" opacity={0.8} />
      )}
      <text x={23} y={8} textAnchor="middle" fontSize={4} fill="#fff" fontFamily="monospace" fontWeight="700">{text}</text>
    </g>
  );
}

/** Escurece hex */
function darken(hex: string, amount: number): string {
  const num = parseInt(hex.slice(1), 16);
  const r = Math.max(0, Math.round(((num >> 16) & 0xff) * (1 - amount)));
  const g = Math.max(0, Math.round(((num >> 8) & 0xff) * (1 - amount)));
  const b = Math.max(0, Math.round((num & 0xff) * (1 - amount)));
  return `#${((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1)}`;
}

/* ═══════════════════════════════════════════════════════════════ */
/*  Main export                                                   */
/* ═══════════════════════════════════════════════════════════════ */

export function OfficeBG() {
  return (
    <g>
      {/* ═══ CORRIDOR FLOOR (cross shape) ═══ */}
      {/* Full background dark */}
      <rect x={0} y={0} width={920} height={750} fill="#1a1a2e" />

      {/* Vertical corridor: x:290 to x:340, full height */}
      <rect x={290} y={0} width={50} height={750} fill={CORRIDOR_FLOOR} />
      {/* Horizontal corridor: y:330 to y:380, full width */}
      <rect x={0} y={330} width={920} height={50} fill={CORRIDOR_FLOOR} />

      {/* Corridor tile grid pattern */}
      {/* Vertical corridor tiles */}
      {Array.from({ length: Math.ceil(750 / 20) }, (_, i) => (
        <line key={`cvl${i}`} x1={290} y1={i * 20} x2={340} y2={i * 20} stroke={CORRIDOR_TILE_LINE} strokeWidth={0.5} />
      ))}
      {Array.from({ length: 3 }, (_, i) => (
        <line key={`cvv${i}`} x1={290 + i * 20} y1={0} x2={290 + i * 20} y2={750} stroke={CORRIDOR_TILE_LINE} strokeWidth={0.5} />
      ))}
      {/* Horizontal corridor tiles */}
      {Array.from({ length: Math.ceil(920 / 20) }, (_, i) => (
        <line key={`chl${i}`} x1={i * 20} y1={330} x2={i * 20} y2={380} stroke={CORRIDOR_TILE_LINE} strokeWidth={0.5} />
      ))}
      {Array.from({ length: 3 }, (_, i) => (
        <line key={`chh${i}`} x1={0} y1={330 + i * 20} x2={920} y2={330 + i * 20} stroke={CORRIDOR_TILE_LINE} strokeWidth={0.5} />
      ))}

      {/* ═══ ROOM CARPETS ═══ */}

      {/* RESEARCH: x:30, y:30, w:260, h:300 */}
      <rect x={30} y={30} width={260} height={300} fill={CARPET_RESEARCH} />
      {/* Carpet texture */}
      {Array.from({ length: 50 }, (_, i) => (
        <rect key={`rc${i}`} x={30} y={30 + i * 6} width={260} height={1} fill="#000" opacity={0.03} />
      ))}

      {/* MANAGEMENT: x:340, y:30, w:480, h:300 */}
      <rect x={340} y={30} width={480} height={300} fill={CARPET_MANAGEMENT} />
      {Array.from({ length: 50 }, (_, i) => (
        <rect key={`mc${i}`} x={340} y={30 + i * 6} width={480} height={1} fill="#000" opacity={0.03} />
      ))}

      {/* DEVELOPMENT: x:30, y:380, w:380, h:310 */}
      <rect x={30} y={380} width={380} height={310} fill={CARPET_DEVELOPMENT} />
      {Array.from({ length: 52 }, (_, i) => (
        <rect key={`dc${i}`} x={30} y={380 + i * 6} width={380} height={1} fill="#000" opacity={0.03} />
      ))}

      {/* QA & SECURITY: x:460, y:380, w:460, h:310 */}
      <rect x={460} y={380} width={460} height={310} fill={CARPET_QA} />
      {Array.from({ length: 52 }, (_, i) => (
        <rect key={`qc${i}`} x={460} y={380 + i * 6} width={460} height={1} fill="#000" opacity={0.03} />
      ))}

      {/* (janelas removidas — escritório sem vista externa) */}

      {/* ═══ WALLS (3D wood between rooms and corridors) ═══ */}

      {/* --- RESEARCH room walls (com porta no lado direito) --- */}
      <WallH x={30} y={7} w={260} />
      <WallV x={7} y={7} h={323} />
      {/* Parede direita com abertura de porta */}
      <rect x={285} y={30} width={5} height={100} fill={WALL_FRONT} />
      <rect x={285} y={170} width={5} height={160} fill={WALL_FRONT} />
      {/* Porta Research → corredor */}
      <rect x={286} y={130} width={4} height={40} rx={1} fill={DOOR_WOOD} />
      <circle cx={288} cy={150} r={1.5} fill="#C9A96E" />
      {/* Parede inferior com abertura de porta */}
      <rect x={30} y={325} width={80} height={5} fill={WALL_FRONT} />
      <rect x={150} y={325} width={140} height={5} fill={WALL_FRONT} />
      {/* Porta Research → corredor horizontal */}
      <rect x={110} y={326} width={40} height={4} rx={1} fill={DOOR_WOOD} />
      <circle cx={130} cy={328} r={1.5} fill="#C9A96E" />

      {/* --- MANAGEMENT room walls (com porta no lado esquerdo) --- */}
      <WallH x={340} y={7} w={480} />
      {/* Parede esquerda com abertura de porta */}
      <rect x={340} y={30} width={5} height={100} fill={WALL_FRONT} />
      <rect x={340} y={170} width={5} height={160} fill={WALL_FRONT} />
      {/* Porta Management → corredor */}
      <rect x={341} y={130} width={4} height={40} rx={1} fill={DOOR_WOOD} />
      <circle cx={343} cy={150} r={1.5} fill="#C9A96E" />
      {/* Parede direita */}
      <rect x={815} y={7} width={5} height={323} fill={WALL_FRONT} />
      {/* Parede inferior com abertura de porta */}
      <rect x={340} y={325} width={160} height={5} fill={WALL_FRONT} />
      <rect x={540} y={325} width={280} height={5} fill={WALL_FRONT} />
      {/* Porta Management → corredor horizontal */}
      <rect x={500} y={326} width={40} height={4} rx={1} fill={DOOR_WOOD} />
      <circle cx={520} cy={328} r={1.5} fill="#C9A96E" />

      {/* --- DEVELOPMENT room walls (x:30, y:380, w:380, h:310) --- */}
      <rect x={30} y={380} width={130} height={5} fill={WALL_FRONT} />
      <rect x={200} y={380} width={210} height={5} fill={WALL_FRONT} />
      <rect x={160} y={381} width={40} height={4} rx={1} fill={DOOR_WOOD} />
      <circle cx={180} cy={383} r={1.5} fill="#C9A96E" />
      <WallV x={7} y={380} h={310} />
      <rect x={405} y={380} width={5} height={120} fill={WALL_FRONT} />
      <rect x={405} y={540} width={5} height={150} fill={WALL_FRONT} />
      <rect x={406} y={500} width={4} height={40} rx={1} fill={DOOR_WOOD} />
      <circle cx={408} cy={520} r={1.5} fill="#C9A96E" />
      <rect x={30} y={685} width={380} height={5} fill={WALL_FRONT} />

      {/* --- QA & SECURITY room walls (x:460, y:380, w:460, h:310) --- */}
      <rect x={460} y={380} width={140} height={5} fill={WALL_FRONT} />
      <rect x={640} y={380} width={280} height={5} fill={WALL_FRONT} />
      <rect x={600} y={381} width={40} height={4} rx={1} fill={DOOR_WOOD} />
      <circle cx={620} cy={383} r={1.5} fill="#C9A96E" />
      <rect x={460} y={385} width={5} height={120} fill={WALL_FRONT} />
      <rect x={460} y={545} width={5} height={145} fill={WALL_FRONT} />
      <rect x={461} y={505} width={4} height={40} rx={1} fill={DOOR_WOOD} />
      <circle cx={463} cy={525} r={1.5} fill="#C9A96E" />
      <rect x={915} y={380} width={5} height={310} fill={WALL_FRONT} />
      <rect x={460} y={685} width={460} height={5} fill={WALL_FRONT} />

      {/* ═══ ROOM LABELS ═══ */}
      <text x={45} y={22} fontSize={8} fill="#A855F7" fontFamily="monospace" fontWeight="700" opacity={0.9}>RESEARCH</text>
      <text x={355} y={22} fontSize={8} fill="#3B82F6" fontFamily="monospace" fontWeight="700" opacity={0.9}>MANAGEMENT</text>
      <text x={45} y={397} fontSize={8} fill="#10B981" fontFamily="monospace" fontWeight="700" opacity={0.9}>DEVELOPMENT</text>
      <text x={435} y={397} fontSize={8} fill="#EF4444" fontFamily="monospace" fontWeight="700" opacity={0.9}>QA &amp; SECURITY</text>

      {/* ═══ CEILING LIGHTS ═══ */}
      {/* Research */}
      <PendantLamp x={160} y={32} />
      {/* Management */}
      <PendantLamp x={500} y={32} />
      <PendantLamp x={700} y={32} />
      {/* Development */}
      <PendantLamp x={150} y={385} />
      <PendantLamp x={320} y={385} />
      {/* QA & Security */}
      <PendantLamp x={580} y={385} />
      <PendantLamp x={720} y={385} />

      {/* ════════════════════════════════════════════ */}
      {/* ═══ FLOOR GLOWS BELOW LAMPS ═══ */}
      {/* ════════════════════════════════════════════ */}
      <FloorGlow cx={160} cy={80} />
      <FloorGlow cx={500} cy={80} />
      <FloorGlow cx={700} cy={80} />
      <FloorGlow cx={150} cy={430} />
      <FloorGlow cx={320} cy={430} />
      <FloorGlow cx={580} cy={430} />
      <FloorGlow cx={720} cy={430} />

      {/* ════════════════════════════════════════════ */}
      {/* ═══ RUGS ═══ */}
      {/* ════════════════════════════════════════════ */}
      <Rug x={80} y={140} w={160} h={120} outer="#8B5CF6" inner="#C4B5FD" />
      <Rug x={450} y={140} w={280} h={120} outer="#B8860B" inner="#DAA520" />
      <Rug x={100} y={500} w={240} h={140} outer="#0E7490" inner="#67E8F9" />
      <Rug x={550} y={510} w={200} h={120} outer="#991B1B" inner="#FECACA" />

      {/* ════════════════════════════════════════════ */}
      {/* ═══ FURNITURE PER ROOM ═══ */}
      {/* ════════════════════════════════════════════ */}

      {/* ─── RESEARCH (top-left: 30,30 — 260x300) ─── */}
      <Whiteboard x={50} y={35} w={55} h={30} />
      <LabBench x={130} y={50} />
      <Bookshelf x={210} y={40} />
      <Microscope x={200} y={100} />
      <BigPlant x={40} y={270} />
      <BigPlant x={250} y={100} />
      {/* NEW: second lab bench */}
      <LabBench x={60} y={100} />
      {/* NEW: computer monitor on existing bench */}
      <DeskMonitor x={155} y={35} />
      {/* NEW: filing cabinet */}
      <FilingCabinet x={250} y={200} />
      {/* NEW: scattered papers */}
      <ScatteredPapers x={140} y={88} />
      {/* NEW: globe */}
      <Globe x={220} y={140} />
      {/* NEW: more plants */}
      <MediumPlant x={40} y={140} />
      <SmallPlant x={230} y={285} />
      {/* NEW: wall clock */}
      <WallClock x={170} y={42} />
      {/* NEW: picture frames */}
      <PictureFrame x={110} y={35} w={16} h={12} color="#A855F7" />
      <PictureFrame x={200} y={38} w={12} h={10} color="#3B82F6" />
      {/* Shadow under lab benches */}
      <rect x={60} y={128} width={50} height={3} fill="#000" opacity={0.08} rx={1} />
      <rect x={130} y={78} width={50} height={3} fill="#000" opacity={0.08} rx={1} />

      {/* ─── MANAGEMENT (top-right: 340,30 — 480x300) ─── */}
      <MeetingTable x={520} y={100} />
      <Sofa x={700} y={260} color="#2563EB" />
      <WallTV x={500} y={35} w={60} h={35} />
      <Fireplace x={360} y={60} />
      <BigPlant x={350} y={270} />
      <BigPlant x={780} y={100} />
      <WallPainting x={440} y={40} w={28} h={20} color="#3B82F6" />
      <WallPainting x={650} y={40} w={24} h={18} color="#8B5CF6" />
      {/* NEW: 2 more chairs around meeting table */}
      <rect x={520 + 30} y={100 + 36} width={18} height={8} rx={3} fill="#0891B2" />
      <rect x={520 + 62} y={100 - 4} width={14} height={7} rx={3} fill="#0891B2" />
      {/* NEW: coffee table near sofa */}
      <CoffeeTable x={760} y={268} />
      {/* NEW: water dispenser in corner */}
      <WaterDispenser x={790} y={200} />
      {/* NEW: coat rack */}
      <CoatRack x={370} y={120} />
      {/* NEW: name plates on wall */}
      <rect x={420} y={65} width={30} height={6} fill="#C9A96E" rx={1} />
      <text x={435} y={70} textAnchor="middle" fontSize={3} fill="#333" fontFamily="monospace">CEO</text>
      <rect x={420} y={74} width={30} height={6} fill="#C9A96E" rx={1} />
      <text x={435} y={79} textAnchor="middle" fontSize={3} fill="#333" fontFamily="monospace">CTO</text>
      {/* NEW: bigger fireplace logs */}
      <rect x={368} y={92} width={12} height={3} fill="#5A3A1A" rx={1} />
      <rect x={374} y={90} width={10} height={3} fill="#4A2A10" rx={1} transform="rotate(-15 379 91)" />
      <rect x={382} y={93} width={8} height={2.5} fill="#6B4A2A" rx={0.5} />
      {/* NEW: more plants */}
      <MediumPlant x={700} y={100} />
      <SmallPlant x={790} y={270} />
      {/* NEW: wall clock */}
      <WallClock x={620} y={45} />
      {/* NEW: picture frames */}
      <PictureFrame x={580} y={40} w={14} h={10} color="#10B981" />
      <PictureFrame x={720} y={40} w={18} h={12} color="#EAB308" />
      {/* Shadow under sofa */}
      <rect x={700} y={280} width={50} height={4} fill="#000" opacity={0.1} rx={1} />

      {/* ─── DEVELOPMENT (bottom-left: 30,380 — 400x310) ─── */}
      <WhiteboardWithPostits x={150} y={392} />
      <CoffeeMachine x={360} y={420} />
      {/* Extra monitors on wall */}
      <WallMonitor x={250} y={392} w={40} h={22} color="#06B6D4" />
      <WallMonitor x={300} y={392} w={40} h={22} color="#F97316" />
      <BigPlant x={40} y={640} />
      <BigPlant x={390} y={640} />
      {/* NEW: standing desk */}
      <StandingDesk x={80} y={440} />
      {/* NEW: headphones on desk area */}
      <Headphones x={120} y={448} />
      {/* NEW: more sticky notes on whiteboard (inside existing whiteboard area) */}
      <rect x={154} y={408} width={7} height={7} fill="#FBBF24" rx={0.5} />
      <rect x={163} y={408} width={7} height={7} fill="#F87171" rx={0.5} />
      <rect x={172} y={408} width={7} height={7} fill="#34D399" rx={0.5} />
      <rect x={181} y={408} width={7} height={7} fill="#A78BFA" rx={0.5} />
      <rect x={154} y={417} width={7} height={4} fill="#FB923C" rx={0.5} />
      <rect x={163} y={417} width={7} height={4} fill="#38BDF8" rx={0.5} />
      <rect x={172} y={417} width={7} height={4} fill="#F472B6" rx={0.5} />
      <rect x={181} y={417} width={7} height={4} fill="#FDE68A" rx={0.5} />
      <rect x={190} y={408} width={7} height={7} fill="#86EFAC" rx={0.5} />
      <rect x={190} y={417} width={7} height={4} fill="#FCA5A5" rx={0.5} />
      {/* NEW: trash can */}
      <TrashCan x={350} y={460} />
      {/* NEW: cable management under desks */}
      <line x1={82} y1={478} x2={110} y2={478} stroke="#333" strokeWidth={0.5} opacity={0.3} />
      <line x1={95} y1={478} x2={95} y2={484} stroke="#333" strokeWidth={0.5} opacity={0.3} />
      <line x1={82} y1={480} x2={105} y2={480} stroke="#222" strokeWidth={0.4} opacity={0.25} />
      {/* NEW: second coffee machine / water cooler */}
      <WaterCooler x={40} y={420} />
      {/* NEW: more plants */}
      <MediumPlant x={200} y={640} />
      <SmallPlant x={330} y={640} />
      {/* NEW: wall clock */}
      <WallClock x={70} y={398} />
      {/* NEW: picture frames */}
      <PictureFrame x={40} y={392} w={14} h={10} color="#06B6D4" />
      <PictureFrame x={350} y={392} w={12} h={10} color="#F97316" />
      {/* Shadow under standing desk */}
      <rect x={80} y={480} width={32} height={3} fill="#000" opacity={0.08} rx={1} />

      {/* ─── QA & SECURITY (bottom-right: 480,380 — 340x310) ─── */}
      {/* Monitoring wall — 3 monitors */}
      <WallMonitor x={500} y={392} w={48} h={28} color="#EF4444" />
      <WallMonitor x={555} y={392} w={48} h={28} color="#6B7280" />
      <WallMonitor x={610} y={392} w={48} h={28} color="#EC4899" />
      {/* Server rack */}
      <ServerRack x={780} y={430} />
      {/* Printer */}
      <Printer x={770} y={640} />
      {/* Security camera */}
      <SecurityCamera x={500} y={425} />
      <BigPlant x={490} y={640} />
      <BigPlant x={780} y={640} />
      {/* NEW: large monitoring wall (3 screens) */}
      <MonitoringWall x={670} y={395} />
      {/* NEW: fire extinguisher on wall */}
      <FireExtinguisher x={800} y={400} />
      {/* NEW: emergency exit sign */}
      <ExitSign x={660} y={392} />
      {/* NEW: test reports / papers on desks */}
      <ScatteredPapers x={530} y={450} />
      <ScatteredPapers x={620} y={460} />
      {/* NEW: second server rack */}
      <ServerRack x={750} y={430} />
      {/* NEW: more plants */}
      <MediumPlant x={500} y={550} />
      <SmallPlant x={790} y={550} />
      {/* NEW: wall clock */}
      <WallClock x={750} y={398} />
      {/* NEW: picture frames */}
      <PictureFrame x={490} y={392} w={12} h={10} color="#EF4444" />
      <PictureFrame x={780} y={392} w={14} h={10} color="#6366F1" />
      {/* Shadow under server racks */}
      <rect x={750} y={480} width={22} height={3} fill="#000" opacity={0.08} rx={1} />
      <rect x={780} y={480} width={22} height={3} fill="#000" opacity={0.08} rx={1} />

      {/* ═══ CORRIDOR DECORATIONS ═══ */}

      {/* Water cooler at intersection */}
      <WaterCooler x={300} y={338} />

      {/* Small plants in corridor corners */}
      <SmallPlant x={292} y={30} />
      <SmallPlant x={292} y={300} />
      <SmallPlant x={292} y={390} />
      <SmallPlant x={292} y={660} />
      <SmallPlant x={30} y={335} />
      <SmallPlant x={440} y={335} />

      {/* NEW: more plants in corridor corners */}
      <MediumPlant x={330} y={30} />
      <SmallPlant x={330} y={300} />
      <MediumPlant x={330} y={660} />
      <SmallPlant x={820} y={335} />

      {/* Direction signs */}
      <DirectionSign x={295} y={60} text="MGMT" direction="right" />
      <DirectionSign x={295} y={420} text="QA" direction="right" />
      {/* NEW: more direction signs */}
      <DirectionSign x={295} y={200} text="LAB" direction="left" />
      <DirectionSign x={295} y={550} text="DEV" direction="left" />
      <DirectionSign x={60} y={355} text="RESEARCH" direction="left" />
      <DirectionSign x={650} y={355} text="QA&SEC" direction="right" />

      {/* Bench in corridor */}
      <Bench x={297} y={250} />
      <Bench x={100} y={348} />

      {/* NEW: welcome mats at doors */}
      <WelcomeMat x={116} y={320} w={28} />
      <WelcomeMat x={506} y={320} w={28} />
      <WelcomeMat x={166} y={385} w={28} />
      <WelcomeMat x={586} y={385} w={28} />
      <WelcomeMat x={280} y={135} w={10} />
      <WelcomeMat x={341} y={135} w={10} />
      <WelcomeMat x={420} y={505} w={10} />
      <WelcomeMat x={481} y={510} w={10} />

      {/* NEW: vending machine */}
      <VendingMachine x={450} y={340} />

      {/* NEW: fire extinguisher in corridor */}
      <FireExtinguisher x={295} y={340} />

      {/* NEW: floor arrows / path lines (subtle) */}
      {/* Vertical corridor path */}
      <line x1={315} y1={40} x2={315} y2={320} stroke="#8B8070" strokeWidth={1} opacity={0.15} strokeDasharray="6 4" />
      <line x1={315} y1={390} x2={315} y2={700} stroke="#8B8070" strokeWidth={1} opacity={0.15} strokeDasharray="6 4" />
      {/* Horizontal corridor path */}
      <line x1={40} y1={355} x2={280} y2={355} stroke="#8B8070" strokeWidth={1} opacity={0.15} strokeDasharray="6 4" />
      <line x1={350} y1={355} x2={440} y2={355} stroke="#8B8070" strokeWidth={1} opacity={0.15} strokeDasharray="6 4" />
      <line x1={480} y1={355} x2={810} y2={355} stroke="#8B8070" strokeWidth={1} opacity={0.15} strokeDasharray="6 4" />

      {/* ForgeAI logo sign above intersection */}
      <g transform="translate(295, 332)">
        <rect x={0} y={0} width={40} height={12} rx={2} fill="#1e293b" stroke="#3B82F6" strokeWidth={0.8} />
        <text x={20} y={9} textAnchor="middle" fontSize={5} fill="#3B82F6" fontFamily="monospace" fontWeight="700">ForgeAI</text>
      </g>
    </g>
  );
}
