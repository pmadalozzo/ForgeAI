/**
 * Canvas SVG principal do escritorio virtual 2D.
 * Visual estilo SoWork/Gather.town: piso escuro com triangulos,
 * salas com carpete claro, paredes 3D de madeira, janelas com cenario externo.
 */
import { useCallback, useState, useRef, useEffect } from "react";
import { useAgentsStore } from "@/stores/agents-store";
import { AgentWorkstation } from "@/components/office/AgentWorkstation";
import { OfficeDecorations } from "@/components/office/OfficeDecorations";
import { WalkingAgent } from "@/components/office/WalkingAgent";
import { ContextMenu } from "@/components/office/ContextMenu";
import { AgentStatus } from "@/types/agents";

/** Dimensoes do canvas SVG */
const CANVAS_W = 920;
const CANVAS_H = 900;

/** Limites de zoom */
const MIN_SCALE = 0.5;
const MAX_SCALE = 2.0;
const ZOOM_STEP = 0.1;

/** Configuracao das zonas do escritorio */
const ZONES = [
  {
    label: "RESEARCH",
    x: 50,
    y: 75,
    w: 830,
    h: 140,
    color: "#A855F7",
    carpet: "#C4A86C",
  },
  {
    label: "MANAGEMENT",
    x: 50,
    y: 265,
    w: 830,
    h: 140,
    color: "#3B82F6",
    carpet: "#D4A855",
  },
  {
    label: "DEVELOPMENT",
    x: 50,
    y: 455,
    w: 830,
    h: 140,
    color: "#10B981",
    carpet: "#C9B07A",
  },
  {
    label: "QA & SECURITY",
    x: 50,
    y: 645,
    w: 830,
    h: 155,
    color: "#EF4444",
    carpet: "#BFA76E",
  },
] as const;

/** Estado do context menu */
interface ContextMenuState {
  agentId: string;
  x: number;
  y: number;
}

/** Estado do tooltip */
interface TooltipState {
  agentId: string;
  x: number;
  y: number;
}

/** Estado de drag */
interface DragState {
  agentId: string;
  startX: number;
  startY: number;
  origDeskX: number;
  origDeskY: number;
}

/** Parede 3D com face superior e frontal */
function Wall3D({
  x,
  y,
  w,
  h,
  topH = 5,
}: {
  x: number;
  y: number;
  w: number;
  h: number;
  topH?: number;
}) {
  return (
    <g>
      {/* Face frontal (mais escura) */}
      <rect x={x} y={y + topH} width={w} height={h - topH} fill="#5A3A1A" />
      {/* Face superior (mais clara, simula topo da parede) */}
      <rect x={x} y={y} width={w} height={topH} fill="#8B6914" />
      {/* Borda de detalhe */}
      <line
        x1={x}
        y1={y + topH}
        x2={x + w}
        y2={y + topH}
        stroke="#4A2E12"
        strokeWidth="0.5"
      />
    </g>
  );
}

export function OfficeCanvas() {
  const agents = useAgentsStore((s) => s.agents);
  const walkers = useAgentsStore((s) => s.walkers);
  const tickWalkers = useAgentsStore((s) => s.tickWalkers);
  const selectedAgentId = useAgentsStore((s) => s.selectedAgentId);
  const selectAgent = useAgentsStore((s) => s.selectAgent);
  const setAgentStatus = useAgentsStore((s) => s.setAgentStatus);
  const updateDeskPosition = useAgentsStore((s) => s.updateDeskPosition);


  // Transform state (zoom/pan)
  const [scale, setScale] = useState(1);
  const [translateX, setTranslateX] = useState(0);
  const [translateY, setTranslateY] = useState(0);

  // Pan state
  const [isPanning, setIsPanning] = useState(false);
  const panStartRef = useRef({ x: 0, y: 0, tx: 0, ty: 0 });

  // Context menu
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);

  // Tooltip
  const [tooltip, setTooltip] = useState<TooltipState | null>(null);

  // Drag state
  const [drag, setDrag] = useState<DragState | null>(null);
  const dragRef = useRef<DragState | null>(null);

  const svgRef = useRef<SVGSVGElement>(null);

  // Loop de animação dos walkers via requestAnimationFrame
  const lastFrameRef = useRef<number>(0);
  useEffect(() => {
    if (walkers.length === 0) {
      lastFrameRef.current = 0;
      return;
    }

    let rafId: number;
    const animate = (timestamp: number) => {
      if (lastFrameRef.current === 0) lastFrameRef.current = timestamp;
      const delta = timestamp - lastFrameRef.current;
      lastFrameRef.current = timestamp;

      if (delta > 0 && delta < 200) {
        tickWalkers(delta);
      }

      rafId = requestAnimationFrame(animate);
    };

    rafId = requestAnimationFrame(animate);
    return () => {
      cancelAnimationFrame(rafId);
      lastFrameRef.current = 0;
    };
  }, [walkers.length > 0, tickWalkers]);

  /** Converte coordenadas de tela para coordenadas SVG */
  const screenToSvg = useCallback(
    (clientX: number, clientY: number): { x: number; y: number } => {
      const svg = svgRef.current;
      if (!svg) return { x: 0, y: 0 };
      const rect = svg.getBoundingClientRect();
      const svgX = ((clientX - rect.left) / rect.width) * CANVAS_W;
      const svgY = ((clientY - rect.top) / rect.height) * CANVAS_H;
      return {
        x: (svgX - translateX) / scale,
        y: (svgY - translateY) / scale,
      };
    },
    [scale, translateX, translateY],
  );

  /** Handler de selecao de agente */
  const handleSelectAgent = useCallback(
    (agentId: string) => {
      if (drag) return;
      selectAgent(selectedAgentId === agentId ? null : agentId);
    },
    [selectedAgentId, selectAgent, drag],
  );

  /** Zoom via scroll */
  const handleWheel = useCallback(
    (e: React.WheelEvent<HTMLDivElement>) => {
      e.preventDefault();
      const delta = e.deltaY > 0 ? -ZOOM_STEP : ZOOM_STEP;
      setScale((prev) => Math.min(MAX_SCALE, Math.max(MIN_SCALE, prev + delta)));
    },
    [],
  );

  /** Inicio do pan */
  const handleMouseDown = useCallback(
    (e: React.MouseEvent<SVGSVGElement>) => {
      if (e.button === 0 && !drag) {
        setIsPanning(true);
        panStartRef.current = {
          x: e.clientX,
          y: e.clientY,
          tx: translateX,
          ty: translateY,
        };
      }
    },
    [translateX, translateY, drag],
  );

  /** Movimento do pan ou drag */
  const handleMouseMove = useCallback(
    (e: React.MouseEvent<SVGSVGElement>) => {
      if (isPanning && !dragRef.current) {
        const dx = e.clientX - panStartRef.current.x;
        const dy = e.clientY - panStartRef.current.y;
        const svg = svgRef.current;
        if (!svg) return;
        const rect = svg.getBoundingClientRect();
        const svgDx = (dx / rect.width) * CANVAS_W;
        const svgDy = (dy / rect.height) * CANVAS_H;
        setTranslateX(panStartRef.current.tx + svgDx);
        setTranslateY(panStartRef.current.ty + svgDy);
      }

      if (dragRef.current) {
        const pos = screenToSvg(e.clientX, e.clientY);
        const d = dragRef.current;
        const newX = d.origDeskX + (pos.x - d.startX);
        const newY = d.origDeskY + (pos.y - d.startY);
        updateDeskPosition(
          d.agentId,
          Math.max(10, Math.min(CANVAS_W - 80, newX)),
          Math.max(10, Math.min(CANVAS_H - 70, newY)),
        );
      }
    },
    [isPanning, screenToSvg, updateDeskPosition],
  );

  /** Fim do pan ou drag */
  const handleMouseUp = useCallback(() => {
    setIsPanning(false);
    if (dragRef.current) {
      dragRef.current = null;
      setDrag(null);
    }
  }, []);

  /** Context menu (right-click) */
  const handleContextMenu = useCallback(
    (e: React.MouseEvent<SVGSVGElement>) => {
      e.preventDefault();
      setContextMenu(null);
    },
    [],
  );

  /** Context menu handler para agentes */
  const handleAgentContextMenu = useCallback(
    (agentId: string, e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      const pos = screenToSvg(e.clientX, e.clientY);
      setContextMenu({ agentId, x: pos.x, y: pos.y });
    },
    [screenToSvg],
  );

  /** Tooltip handlers */
  const handleAgentMouseEnter = useCallback(
    (agentId: string, e: React.MouseEvent) => {
      const pos = screenToSvg(e.clientX, e.clientY);
      setTooltip({ agentId, x: pos.x, y: pos.y });
    },
    [screenToSvg],
  );

  const handleAgentMouseLeave = useCallback(() => {
    setTooltip(null);
  }, []);

  /** Drag handler */
  const handleAgentDragStart = useCallback(
    (agentId: string, e: React.MouseEvent) => {
      if (e.button !== 0) return;
      e.stopPropagation();
      const pos = screenToSvg(e.clientX, e.clientY);
      const agent = useAgentsStore.getState().agents.find((a) => a.id === agentId);
      if (!agent) return;
      const d: DragState = {
        agentId,
        startX: pos.x,
        startY: pos.y,
        origDeskX: agent.desk.position.x,
        origDeskY: agent.desk.position.y,
      };
      dragRef.current = d;
      setDrag(d);
    },
    [screenToSvg],
  );

  /** Hotkeys */
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;

      switch (e.key) {
        case " ": {
          e.preventDefault();
          const store = useAgentsStore.getState();
          const allIdle = store.agents.every((a) => a.status === AgentStatus.Idle);
          const newStatus = allIdle ? AgentStatus.Working : AgentStatus.Idle;
          for (const agent of store.agents) {
            setAgentStatus(agent.id, newStatus);
          }
          break;
        }
        case "r":
        case "R": {
          const store = useAgentsStore.getState();
          if (store.selectedAgentId) {
            setAgentStatus(store.selectedAgentId, AgentStatus.Idle);
          }
          break;
        }
        case "Tab": {
          e.preventDefault();
          const store = useAgentsStore.getState();
          const ids = store.agents.map((a) => a.id);
          if (ids.length === 0) break;
          const currentIdx = store.selectedAgentId
            ? ids.indexOf(store.selectedAgentId)
            : -1;
          const nextIdx = (currentIdx + 1) % ids.length;
          selectAgent(ids[nextIdx] ?? null);
          break;
        }
        case "Escape": {
          selectAgent(null);
          setContextMenu(null);
          break;
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [setAgentStatus, selectAgent]);

  /** Zoom buttons */
  const handleZoomIn = useCallback(() => {
    setScale((prev) => Math.min(MAX_SCALE, prev + ZOOM_STEP));
  }, []);

  const handleZoomOut = useCallback(() => {
    setScale((prev) => Math.max(MIN_SCALE, prev - ZOOM_STEP));
  }, []);

  const handleZoomReset = useCallback(() => {
    setScale(1);
    setTranslateX(0);
    setTranslateY(0);
  }, []);

  /** Resolve posicoes dos walkers usando agentes do store */
  const resolveWalkerPositions = useCallback(() => {
    const agentMap = new Map(agents.map((a) => [a.id, a]));
    return walkers
      .map((w) => {
        const from = agentMap.get(w.fromAgentId);
        const to = agentMap.get(w.toAgentId);
        if (!from || !to) return null;
        return {
          ...w,
          fromDesk: from.desk.position,
          toDesk: to.desk.position,
          color: from.color,
        };
      })
      .filter((w): w is NonNullable<typeof w> => w !== null);
  }, [agents, walkers]);

  const resolvedWalkers = resolveWalkerPositions();

  // Tooltip agent data
  const tooltipAgent = tooltip
    ? agents.find((a) => a.id === tooltip.agentId)
    : null;

  return (
    <div
      className="flex flex-1 items-center justify-center overflow-hidden"
      style={{
        padding: 6,
        position: "relative",
      }}
      onWheel={handleWheel}
    >
      <svg
        ref={svgRef}
        viewBox={`0 0 ${CANVAS_W} ${CANVAS_H}`}
        preserveAspectRatio="xMidYMid meet"
        style={{
          width: "100%",
          height: "100%",
          borderRadius: 10,
          border: "none",
          background: "#1a1a1a",
          cursor: isPanning ? "grabbing" : drag ? "grabbing" : "grab",
        }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onContextMenu={handleContextMenu}
      >
        <defs>
          {/* Piso escuro com padrao de triangulos geometricos */}
          <pattern
            id="darkFloorTriangles"
            width="24"
            height="24"
            patternUnits="userSpaceOnUse"
          >
            <rect width="24" height="24" fill="#2E2E2E" />
            {/* Triangulos alternados criando textura chevron */}
            <polygon points="0,0 12,0 6,12" fill="#333333" />
            <polygon points="12,0 24,0 18,12" fill="#363636" />
            <polygon points="6,12 18,12 12,24" fill="#333333" />
            <polygon points="0,24 6,12 12,24" fill="#2A2A2A" />
            <polygon points="12,24 18,12 24,24" fill="#2A2A2A" />
            {/* Linhas sutis entre triangulos */}
            <line x1="0" y1="0" x2="6" y2="12" stroke="#252525" strokeWidth="0.3" />
            <line x1="12" y1="0" x2="6" y2="12" stroke="#252525" strokeWidth="0.3" />
            <line x1="12" y1="0" x2="18" y2="12" stroke="#252525" strokeWidth="0.3" />
            <line x1="24" y1="0" x2="18" y2="12" stroke="#252525" strokeWidth="0.3" />
            <line x1="6" y1="12" x2="12" y2="24" stroke="#252525" strokeWidth="0.3" />
            <line x1="18" y1="12" x2="12" y2="24" stroke="#252525" strokeWidth="0.3" />
          </pattern>

          {/* Filtro de brilho */}
          <filter id="glow">
            <feGaussianBlur stdDeviation="2" />
            <feMerge>
              <feMergeNode />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>

          {/* Sombra suave para moveis */}
          <filter id="softShadow" x="-10%" y="-10%" width="120%" height="120%">
            <feDropShadow dx="1" dy="2" stdDeviation="3" floodColor="#000000" floodOpacity="0.4" />
          </filter>

          {/* Brilho quente de lampada */}
          <radialGradient id="warmLight" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#fbbf24" stopOpacity="0.08" />
            <stop offset="60%" stopColor="#f59e0b" stopOpacity="0.03" />
            <stop offset="100%" stopColor="#f59e0b" stopOpacity="0" />
          </radialGradient>

          {/* Gradiente do ceu externo (sunset) */}
          <linearGradient id="skyGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#1e1b4b" />
            <stop offset="25%" stopColor="#312e81" />
            <stop offset="50%" stopColor="#7c3aed" />
            <stop offset="75%" stopColor="#c084fc" />
            <stop offset="90%" stopColor="#f472b6" />
            <stop offset="100%" stopColor="#fb923c" />
          </linearGradient>

          {/* Gradiente para vidro das janelas */}
          <linearGradient id="glassSheen" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#ffffff" stopOpacity="0.08" />
            <stop offset="50%" stopColor="#ffffff" stopOpacity="0.02" />
            <stop offset="100%" stopColor="#ffffff" stopOpacity="0.06" />
          </linearGradient>

          {/* Brilho da lareira */}
          <radialGradient id="fireplaceGlow" cx="50%" cy="80%" r="60%">
            <stop offset="0%" stopColor="#f97316" stopOpacity="0.15" />
            <stop offset="60%" stopColor="#ea580c" stopOpacity="0.05" />
            <stop offset="100%" stopColor="#ea580c" stopOpacity="0" />
          </radialGradient>
        </defs>

        {/* Grupo transformavel (zoom/pan) */}
        <g transform={`translate(${translateX}, ${translateY}) scale(${scale})`}>

          {/* ═══ PISO ESCURO DO CORREDOR (fundo inteiro) ═══ */}
          <rect width={CANVAS_W} height={CANVAS_H} fill="url(#darkFloorTriangles)" />

          {/* ═══ JANELAS / PAREDE EXTERNA DIREITA ═══ */}
          <g>
            {/* Ceu externo visivel pela janela */}
            <rect x={CANVAS_W - 30} y={0} width={30} height={CANVAS_H} fill="url(#skyGradient)" />

            {/* Montanhas distantes */}
            <polygon points={`${CANVAS_W - 30},${CANVAS_H * 0.7} ${CANVAS_W - 20},${CANVAS_H * 0.5} ${CANVAS_W - 5},${CANVAS_H * 0.65} ${CANVAS_W},${CANVAS_H * 0.7}`} fill="#1e1b4b" opacity="0.6" />
            <polygon points={`${CANVAS_W - 30},${CANVAS_H * 0.72} ${CANVAS_W - 15},${CANVAS_H * 0.55} ${CANVAS_W},${CANVAS_H * 0.68} ${CANVAS_W},${CANVAS_H * 0.72}`} fill="#312e81" opacity="0.4" />

            {/* Silhuetas de pinheiros */}
            {[0.75, 0.78, 0.82, 0.76, 0.80, 0.84, 0.77, 0.81].map((yPct, i) => {
              const treeX = CANVAS_W - 28 + i * 3.5;
              const treeTop = CANVAS_H * (yPct - 0.08 - (i % 3) * 0.02);
              const treeBase = CANVAS_H * yPct;
              return (
                <polygon
                  key={`tree-${i}`}
                  points={`${treeX},${treeBase} ${treeX + 1.5},${treeTop} ${treeX + 3},${treeBase}`}
                  fill="#0a3622"
                  opacity={0.7 + (i % 3) * 0.1}
                />
              );
            })}

            {/* Paineis de vidro com moldura de madeira */}
            {ZONES.map((zone, i) => {
              const glassY = zone.y;
              const glassH = zone.h;
              return (
                <g key={`window-${i}`}>
                  {/* Moldura de madeira */}
                  <rect
                    x={CANVAS_W - 32}
                    y={glassY - 2}
                    width={4}
                    height={glassH + 4}
                    fill="#6B4226"
                  />
                  {/* Vidro */}
                  <rect
                    x={CANVAS_W - 28}
                    y={glassY}
                    width={26}
                    height={glassH}
                    fill="url(#glassSheen)"
                    stroke="#6B4226"
                    strokeWidth="1.5"
                  />
                  {/* Divisores verticais do vidro */}
                  <line
                    x1={CANVAS_W - 15}
                    y1={glassY}
                    x2={CANVAS_W - 15}
                    y2={glassY + glassH}
                    stroke="#6B4226"
                    strokeWidth="1"
                  />
                  {/* Divisor horizontal */}
                  <line
                    x1={CANVAS_W - 28}
                    y1={glassY + glassH / 2}
                    x2={CANVAS_W - 2}
                    y2={glassY + glassH / 2}
                    stroke="#6B4226"
                    strokeWidth="1"
                  />
                  {/* Reflexo sutil no vidro */}
                  <rect
                    x={CANVAS_W - 26}
                    y={glassY + 3}
                    width={4}
                    height={glassH - 6}
                    fill="#ffffff"
                    opacity="0.04"
                    rx="1"
                  />
                </g>
              );
            })}
          </g>

          {/* ═══ SALAS DO ESCRITORIO ═══ */}
          {ZONES.map((zone, i) => {
            const wallThickness = 16;
            const wallTopH = 5;
            const doorW = 54;
            const doorX = zone.x + zone.w / 2 - doorW / 2;

            return (
              <g key={zone.label}>
                {/* ── Carpete da sala (claro, contraste com corredor escuro) ── */}
                <rect
                  x={zone.x}
                  y={zone.y}
                  width={zone.w}
                  height={zone.h}
                  fill={zone.carpet}
                  rx="1"
                />
                {/* Textura sutil no carpete */}
                <rect
                  x={zone.x}
                  y={zone.y}
                  width={zone.w}
                  height={zone.h}
                  fill="#000000"
                  opacity="0.04"
                  rx="1"
                />
                {/* Borda interna do carpete (contorno sutil) */}
                <rect
                  x={zone.x + 4}
                  y={zone.y + 4}
                  width={zone.w - 8}
                  height={zone.h - 8}
                  fill="none"
                  stroke={zone.carpet}
                  strokeWidth="0.5"
                  strokeOpacity="0.3"
                  rx="1"
                />

                {/* ── Parede traseira 3D (topo da sala) ── */}
                <Wall3D
                  x={zone.x - 8}
                  y={zone.y - wallThickness}
                  w={zone.w + 16}
                  h={wallThickness}
                  topH={wallTopH}
                />

                {/* ── Parede esquerda 3D ── */}
                <Wall3D
                  x={zone.x - 8}
                  y={zone.y - wallThickness}
                  w={8}
                  h={zone.h + wallThickness}
                  topH={wallTopH}
                />

                {/* ── Quadros na parede traseira ── */}
                {/* Quadro 1 — arte/logo */}
                <rect
                  x={zone.x + 25}
                  y={zone.y - wallThickness + 3}
                  width="20"
                  height="10"
                  rx="1"
                  fill="#2a1f0e"
                  stroke="#8B6914"
                  strokeWidth="1.5"
                />
                <rect
                  x={zone.x + 27}
                  y={zone.y - wallThickness + 5}
                  width="16"
                  height="6"
                  rx="0.5"
                  fill={zone.color}
                  fillOpacity="0.25"
                />

                {/* Quadro 2 — whiteboard */}
                <rect
                  x={zone.x + zone.w - 55}
                  y={zone.y - wallThickness + 2}
                  width="26"
                  height="12"
                  rx="1"
                  fill="#f5f5f0"
                  stroke="#8B6914"
                  strokeWidth="1.2"
                />
                {/* Mini barras no quadro */}
                {[0, 1, 2, 3, 4].map((j) => (
                  <rect
                    key={j}
                    x={zone.x + zone.w - 51 + j * 4.5}
                    y={zone.y - wallThickness + 9 - (j % 3) * 2}
                    width="3"
                    height={3 + (j % 3) * 2}
                    rx="0.5"
                    fill={zone.color}
                    opacity={0.5 + j * 0.1}
                  />
                ))}

                {/* ── Placa do departamento ── */}
                <rect
                  x={zone.x + zone.w / 2 - (zone.label.length * 4 + 12)}
                  y={zone.y - wallThickness + 3}
                  width={zone.label.length * 8 + 24}
                  height="11"
                  rx="3"
                  fill="#1a1a1a"
                  fillOpacity="0.7"
                  stroke={zone.color}
                  strokeWidth="1.5"
                  strokeOpacity="0.8"
                />
                <text
                  x={zone.x + zone.w / 2}
                  y={zone.y - wallThickness + 11}
                  textAnchor="middle"
                  fontSize="7"
                  fill={zone.color}
                  fontFamily="monospace"
                  fontWeight="800"
                  letterSpacing="2"
                >
                  {zone.label}
                </text>

                {/* ── Luz quente ambiente ── */}
                <ellipse
                  cx={zone.x + zone.w / 2}
                  cy={zone.y + zone.h / 2}
                  rx={zone.w * 0.3}
                  ry={zone.h * 0.35}
                  fill="url(#warmLight)"
                />

                {/* ── Parede inferior / divisoria entre salas ── */}
                {i < ZONES.length - 1 && (
                  <g>
                    {/* Parede inferior esquerda */}
                    <Wall3D
                      x={zone.x - 8}
                      y={zone.y + zone.h}
                      w={doorX - zone.x + 8}
                      h={wallThickness}
                      topH={wallTopH}
                    />
                    {/* Parede inferior direita */}
                    <Wall3D
                      x={doorX + doorW}
                      y={zone.y + zone.h}
                      w={zone.x + zone.w + 8 - doorX - doorW}
                      h={wallThickness}
                      topH={wallTopH}
                    />

                    {/* Porta / abertura — piso do corredor visivel */}
                    <rect
                      x={doorX}
                      y={zone.y + zone.h}
                      width={doorW}
                      height={wallThickness}
                      fill="#2E2E2E"
                    />
                    {/* Triangulos no piso do corredor */}
                    <polygon
                      points={`${doorX},${zone.y + zone.h} ${doorX + doorW / 2},${zone.y + zone.h + wallThickness} ${doorX + doorW},${zone.y + zone.h}`}
                      fill="#333333"
                      opacity="0.5"
                    />

                    {/* Pilares da porta */}
                    <rect
                      x={doorX - 2}
                      y={zone.y + zone.h}
                      width={3}
                      height={wallThickness}
                      fill="#8B6914"
                    />
                    <rect
                      x={doorX + doorW - 1}
                      y={zone.y + zone.h}
                      width={3}
                      height={wallThickness}
                      fill="#8B6914"
                    />
                  </g>
                )}

                {/* ── Estante com livros (canto esquerdo) ── */}
                <g transform={`translate(${zone.x + 6}, ${zone.y + 8})`}>
                  {/* Corpo da estante */}
                  <rect x="0" y="0" width="14" height="35" rx="1" fill="#3D2B1F" stroke="#2A1B10" strokeWidth="0.5" />
                  {/* Prateleiras */}
                  {[0, 1, 2, 3].map((s) => (
                    <rect key={s} x="1" y={3 + s * 8} width="12" height="1" fill="#5A3A1A" />
                  ))}
                  {/* Livros coloridos */}
                  {[0, 1, 2, 3].map((s) => (
                    <g key={`books-${s}`}>
                      <rect x="2" y={s * 8 + 0.5} width="2.5" height="6" rx="0.3" fill="#e74c3c" opacity="0.85" />
                      <rect x="5" y={s * 8 + 1} width="2" height="5.5" rx="0.3" fill="#3498db" opacity="0.85" />
                      <rect x="7.5" y={s * 8 + 0.5} width="1.8" height="6" rx="0.3" fill="#2ecc71" opacity="0.85" />
                      <rect x="10" y={s * 8 + 1.5} width="2" height="5" rx="0.3" fill="#f39c12" opacity="0.8" />
                    </g>
                  ))}
                </g>

                {/* ── Planta grande (canto direito) ── */}
                <g transform={`translate(${zone.x + zone.w - 28}, ${zone.y + zone.h - 40})`}>
                  {/* Vaso de terracota */}
                  <path d="M4,22 L2,35 L18,35 L16,22 Z" fill="#8B4513" />
                  <rect x="2" y="21" width="16" height="3" rx="1" fill="#A0522D" />
                  {/* Folhagem rica */}
                  <ellipse cx="10" cy="16" rx="10" ry="8" fill="#228B22" opacity="0.85" />
                  <ellipse cx="5" cy="12" rx="7" ry="6" fill="#2E8B57" opacity="0.75" />
                  <ellipse cx="15" cy="13" rx="8" ry="7" fill="#006400" opacity="0.7" />
                  <ellipse cx="10" cy="8" rx="6" ry="5" fill="#32CD32" opacity="0.6" />
                  {/* Detalhe de folhas */}
                  <path d="M6,10 Q3,5 8,6" fill="none" stroke="#1a6b1a" strokeWidth="0.8" opacity="0.5" />
                  <path d="M14,11 Q17,6 12,7" fill="none" stroke="#1a6b1a" strokeWidth="0.8" opacity="0.5" />
                </g>
              </g>
            );
          })}

          {/* ── Parede inferior da ultima sala ── */}
          {(() => {
            const last = ZONES[ZONES.length - 1]!;
            return (
              <Wall3D
                x={last.x - 8}
                y={last.y + last.h}
                w={last.w + 16}
                h={16}
                topH={5}
              />
            );
          })()}

          {/* ═══ LAREIRA (entre Management e Development, parede esquerda) ═══ */}
          <g transform={`translate(${ZONES[1].x - 6}, ${ZONES[1].y + ZONES[1].h - 10})`}>
            {/* Estrutura da lareira */}
            <rect x="-4" y="-8" width="28" height="4" rx="1" fill="#5A3A1A" />
            <rect x="-2" y="-4" width="24" height="20" rx="1" fill="#3D2B1F" />
            <rect x="1" y="-1" width="18" height="15" rx="1" fill="#1a0a00" />
            {/* Fogo animado */}
            <ellipse cx="10" cy="10" rx="6" ry="4" fill="#f97316" opacity="0.7">
              <animate attributeName="ry" values="4;5;3.5;4" dur="1.5s" repeatCount="indefinite" />
            </ellipse>
            <ellipse cx="10" cy="9" rx="4" ry="3" fill="#fbbf24" opacity="0.6">
              <animate attributeName="ry" values="3;4;2.5;3" dur="1.2s" repeatCount="indefinite" />
            </ellipse>
            <ellipse cx="10" cy="8" rx="2" ry="2" fill="#fef3c7" opacity="0.5">
              <animate attributeName="ry" values="2;2.5;1.5;2" dur="1s" repeatCount="indefinite" />
            </ellipse>
            {/* Brilho da lareira no chao */}
            <ellipse cx="10" cy="20" rx="25" ry="15" fill="url(#fireplaceGlow)" />
          </g>

          {/* Decoracoes do escritorio */}
          <OfficeDecorations />

          {/* Estacoes de trabalho dos agentes */}
          {agents.map((agent) => (
            <g
              key={agent.id}
              onContextMenu={(e) => handleAgentContextMenu(agent.id, e)}
              onMouseEnter={(e) => handleAgentMouseEnter(agent.id, e)}
              onMouseLeave={handleAgentMouseLeave}
              onMouseDown={(e) => handleAgentDragStart(agent.id, e)}
            >
              <AgentWorkstation
                agent={agent}
                isSelected={selectedAgentId === agent.id}
                onSelect={handleSelectAgent}
              />
            </g>
          ))}

          {/* Walking agents */}
          {resolvedWalkers.map((w) => (
            <WalkingAgent
              key={`${w.agentId}-${w.startedAt}`}
              fromDesk={w.fromDesk}
              toDesk={w.toDesk}
              color={w.color}
              progress={w.walkProgress}
              label={w.label}
            />
          ))}

          {/* Context menu */}
          {contextMenu && (
            <ContextMenu
              agentId={contextMenu.agentId}
              x={contextMenu.x}
              y={contextMenu.y}
              onClose={() => setContextMenu(null)}
            />
          )}

          {/* Tooltip */}
          {tooltipAgent && tooltip && (
            <g
              transform={`translate(${tooltipAgent.desk.position.x + 80}, ${tooltipAgent.desk.position.y - 5})`}
              style={{ pointerEvents: "none" }}
            >
              <rect
                x="0"
                y="0"
                width="120"
                height="36"
                rx="6"
                fill="#1a1a2e"
                stroke={tooltipAgent.color}
                strokeWidth="1"
                opacity="0.95"
                filter="url(#softShadow)"
              />
              <text
                x="6"
                y="12"
                fontSize="7"
                fill={tooltipAgent.color}
                fontFamily="monospace"
                fontWeight="700"
              >
                {tooltipAgent.name}
              </text>
              <text
                x="6"
                y="22"
                fontSize="6"
                fill="#94a3b8"
                fontFamily="monospace"
              >
                Status: {tooltipAgent.status}
              </text>
              <text
                x="6"
                y="31"
                fontSize="5.5"
                fill="#6b7280"
                fontFamily="monospace"
              >
                {tooltipAgent.currentTask
                  ? tooltipAgent.currentTask.slice(0, 24)
                  : "Sem tarefa"}
              </text>
            </g>
          )}
        </g>


        {/* Zoom controls (posicao fixa) */}
        <g transform={`translate(${CANVAS_W - 40}, 10)`}>
          {/* Zoom in */}
          <g
            onClick={handleZoomIn}
            style={{ cursor: "pointer" }}
          >
            <rect
              x="0"
              y="0"
              width="28"
              height="22"
              rx="4"
              fill="#1e293b"
              stroke="#334155"
              strokeWidth="0.8"
            />
            <text
              x="14"
              y="15"
              textAnchor="middle"
              fontSize="14"
              fill="#e2e8f0"
              fontFamily="monospace"
              fontWeight="700"
            >
              +
            </text>
          </g>

          {/* Zoom reset */}
          <g
            onClick={handleZoomReset}
            style={{ cursor: "pointer" }}
          >
            <rect
              x="0"
              y="26"
              width="28"
              height="18"
              rx="4"
              fill="#1e293b"
              stroke="#334155"
              strokeWidth="0.8"
            />
            <text
              x="14"
              y="38"
              textAnchor="middle"
              fontSize="7"
              fill="#94a3b8"
              fontFamily="monospace"
            >
              {Math.round(scale * 100)}%
            </text>
          </g>

          {/* Zoom out */}
          <g
            onClick={handleZoomOut}
            style={{ cursor: "pointer" }}
          >
            <rect
              x="0"
              y="48"
              width="28"
              height="22"
              rx="4"
              fill="#1e293b"
              stroke="#334155"
              strokeWidth="0.8"
            />
            <text
              x="14"
              y="63"
              textAnchor="middle"
              fontSize="14"
              fill="#e2e8f0"
              fontFamily="monospace"
              fontWeight="700"
            >
              −
            </text>
          </g>
        </g>
      </svg>
    </div>
  );
}
