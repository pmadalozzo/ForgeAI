/**
 * Canvas SVG principal do escritorio virtual 2D.
 * Layout limpo com 3 zonas (Management, Development, QA & Security)
 * sobre fundo escuro com pattern de tiles.
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
const CANVAS_H = 770;

/** Limites de zoom */
const MIN_SCALE = 0.5;
const MAX_SCALE = 2.0;
const ZOOM_STEP = 0.1;

/** Configuracao das zonas do escritorio */
export const ZONES = [
  { label: "RESEARCH", x: 50, y: 50, w: 830, h: 155, color: "#A855F7" },
  { label: "MANAGEMENT", x: 50, y: 220, w: 830, h: 155, color: "#3B82F6" },
  { label: "DEVELOPMENT", x: 50, y: 405, w: 830, h: 155, color: "#10B981" },
  { label: "QA & SECURITY", x: 50, y: 590, w: 830, h: 155, color: "#EF4444" },
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

  // Loop de animacao dos walkers via requestAnimationFrame
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
          background: "#0c1322",
          cursor: isPanning ? "grabbing" : drag ? "grabbing" : "grab",
        }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onContextMenu={handleContextMenu}
      >
        <defs>
          {/* Pattern: piso escuro com tiles sutis */}
          <pattern id="floorTiles" x="0" y="0" width="20" height="20" patternUnits="userSpaceOnUse">
            <rect width="20" height="20" fill="#0c1322" />
            <line x1="0" y1="0" x2="20" y2="0" stroke="#141b2d" strokeWidth="0.5" />
            <line x1="0" y1="0" x2="0" y2="20" stroke="#141b2d" strokeWidth="0.5" />
          </pattern>

          {/* Filter: sombra suave */}
          <filter id="softShadow" x="-10%" y="-10%" width="120%" height="120%">
            <feDropShadow dx="1" dy="2" stdDeviation="3" floodColor="#000000" floodOpacity="0.4" />
          </filter>
        </defs>

        {/* Grupo transformavel (zoom/pan) */}
        <g transform={`translate(${translateX}, ${translateY}) scale(${scale})`}>

          {/* Piso escuro com tiles */}
          <rect x="0" y="0" width={CANVAS_W} height={CANVAS_H} fill="url(#floorTiles)" />

          {/* Zonas do escritorio */}
          {ZONES.map((zone) => (
            <g key={zone.label}>
              {/* Fundo sutil da zona */}
              <rect
                x={zone.x}
                y={zone.y}
                width={zone.w}
                height={zone.h}
                rx="8"
                fill={zone.color}
                fillOpacity="0.05"
                stroke={zone.color}
                strokeWidth="1"
                strokeDasharray="6 3"
                strokeOpacity="0.3"
              />
              {/* Label da zona */}
              <text
                x={zone.x + 12}
                y={zone.y + 14}
                fontSize="8"
                fill={zone.color}
                fontFamily="'JetBrains Mono', monospace"
                fontWeight="700"
                opacity="0.5"
              >
                {zone.label}
              </text>
            </g>
          ))}

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
