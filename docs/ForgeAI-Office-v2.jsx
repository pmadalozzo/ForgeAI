import { useState, useEffect, useRef, useCallback, useMemo } from "react";

/* ─── pixel character as SVG (seated, walking, thinking) ─── */
function PixelPerson({ color, status, direction = 1, style = "seated", size = 1 }) {
  const skinTone = "#FDBCB4";
  const hairColors = ["#2c1810", "#4a3728", "#8B4513", "#1a1a2e", "#3d2b1f", "#5c3a21", "#d4a574", "#2d2d2d", "#6b4423", "#1c1c1c"];
  const hair = hairColors[color.charCodeAt(1) % hairColors.length];
  const shirtColor = color;
  const pantsColor = "#2d3748";
  const breathe = status === "working" ? "breathe" : "";

  if (style === "walking") {
    return (
      <g transform={`scale(${size * direction}, ${size}) translate(${direction < 0 ? -24 : 0}, 0)`}>
        {/* Shadow */}
        <ellipse cx="12" cy="31" rx="7" ry="2" fill="#000" opacity="0.15" />
        {/* Left leg walking */}
        <rect x="8" y="22" width="3" height="7" rx="1" fill={pantsColor}>
          <animateTransform attributeName="transform" type="rotate" values="-15 9 22;15 9 22;-15 9 22" dur="0.4s" repeatCount="indefinite" />
        </rect>
        <rect x="8" y="28" width="3" height="2" rx="0.5" fill="#1a1a2e">
          <animateTransform attributeName="transform" type="rotate" values="-15 9 22;15 9 22;-15 9 22" dur="0.4s" repeatCount="indefinite" />
        </rect>
        {/* Right leg walking */}
        <rect x="13" y="22" width="3" height="7" rx="1" fill={pantsColor}>
          <animateTransform attributeName="transform" type="rotate" values="15 14 22;-15 14 22;15 14 22" dur="0.4s" repeatCount="indefinite" />
        </rect>
        <rect x="13" y="28" width="3" height="2" rx="0.5" fill="#1a1a2e">
          <animateTransform attributeName="transform" type="rotate" values="15 14 22;-15 14 22;15 14 22" dur="0.4s" repeatCount="indefinite" />
        </rect>
        {/* Body / shirt */}
        <rect x="7" y="14" width="10" height="9" rx="2" fill={shirtColor} />
        {/* Arms swinging */}
        <rect x="4" y="14" width="3" height="7" rx="1.5" fill={shirtColor}>
          <animateTransform attributeName="transform" type="rotate" values="20 5 14;-20 5 14;20 5 14" dur="0.4s" repeatCount="indefinite" />
        </rect>
        <rect x="17" y="14" width="3" height="7" rx="1.5" fill={shirtColor}>
          <animateTransform attributeName="transform" type="rotate" values="-20 18 14;20 18 14;-20 18 14" dur="0.4s" repeatCount="indefinite" />
        </rect>
        {/* Head */}
        <circle cx="12" cy="9" r="6" fill={skinTone} />
        {/* Hair */}
        <ellipse cx="12" cy="5.5" rx="6" ry="3.5" fill={hair} />
        {/* Eyes */}
        <circle cx="10" cy="9" r="1" fill="#1a1a2e" />
        <circle cx="14" cy="9" r="1" fill="#1a1a2e" />
        {/* Smile */}
        <path d="M10 11 Q12 13 14 11" fill="none" stroke="#c0392b" strokeWidth="0.6" />
        {/* Carrying document */}
        <rect x="17" y="16" width="5" height="6" rx="0.5" fill="#f1f5f9" stroke="#94a3b8" strokeWidth="0.3">
          <animateTransform attributeName="transform" type="rotate" values="-20 18 14;20 18 14;-20 18 14" dur="0.4s" repeatCount="indefinite" />
        </rect>
      </g>
    );
  }

  /* Seated at desk */
  return (
    <g transform={`scale(${size})`}>
      {/* Chair back */}
      <rect x="6" y="10" width="12" height="14" rx="2" fill="#334155" />
      <rect x="4" y="8" width="16" height="3" rx="1.5" fill="#475569" />
      {/* Body seated */}
      <rect x="7" y="14" width="10" height="8" rx="2" fill={shirtColor} />
      {/* Legs on chair */}
      <rect x="7" y="21" width="4" height="5" rx="1" fill={pantsColor} />
      <rect x="13" y="21" width="4" height="5" rx="1" fill={pantsColor} />
      {/* Shoes */}
      <rect x="6" y="25" width="5" height="2" rx="1" fill="#1a1a2e" />
      <rect x="13" y="25" width="5" height="2" rx="1" fill="#1a1a2e" />
      {/* Arms typing */}
      {status === "working" ? (
        <>
          <rect x="3" y="16" width="4" height="3" rx="1" fill={shirtColor}>
            <animate attributeName="y" values="16;15;16" dur="0.3s" repeatCount="indefinite" />
          </rect>
          <rect x="2" y="18" width="3" height="2" rx="0.8" fill={skinTone}>
            <animate attributeName="y" values="18;17;18" dur="0.3s" repeatCount="indefinite" />
          </rect>
          <rect x="17" y="16" width="4" height="3" rx="1" fill={shirtColor}>
            <animate attributeName="y" values="15;16;15" dur="0.3s" repeatCount="indefinite" />
          </rect>
          <rect x="19" y="18" width="3" height="2" rx="0.8" fill={skinTone}>
            <animate attributeName="y" values="17;18;17" dur="0.3s" repeatCount="indefinite" />
          </rect>
        </>
      ) : status === "blocked" ? (
        <>
          {/* Arms crossed / frustrated */}
          <rect x="4" y="16" width="3" height="6" rx="1" fill={shirtColor} transform="rotate(-10 5 16)" />
          <rect x="17" y="16" width="3" height="6" rx="1" fill={shirtColor} transform="rotate(10 18 16)" />
          <rect x="3" y="21" width="3" height="2" rx="0.8" fill={skinTone} />
          <rect x="18" y="21" width="3" height="2" rx="0.8" fill={skinTone} />
        </>
      ) : (
        <>
          {/* Arms resting */}
          <rect x="3" y="16" width="4" height="5" rx="1.5" fill={shirtColor} />
          <rect x="17" y="16" width="4" height="5" rx="1.5" fill={shirtColor} />
        </>
      )}
      {/* Head */}
      <circle cx="12" cy="8" r="6" fill={skinTone}>
        {status === "working" && <animate attributeName="cy" values="8;7.5;8" dur="1.5s" repeatCount="indefinite" />}
      </circle>
      {/* Hair */}
      <ellipse cx="12" cy="4.5" rx="6" ry="3.5" fill={hair} />
      {/* Eyes */}
      {status === "idle" ? (
        <>
          {/* Sleepy eyes */}
          <line x1="9" y1="8" x2="11" y2="8" stroke="#1a1a2e" strokeWidth="1" strokeLinecap="round" />
          <line x1="13" y1="8" x2="15" y2="8" stroke="#1a1a2e" strokeWidth="1" strokeLinecap="round" />
        </>
      ) : status === "blocked" ? (
        <>
          {/* X eyes */}
          <g transform="translate(10,8)">
            <line x1="-1" y1="-1" x2="1" y2="1" stroke="#EF4444" strokeWidth="0.8" />
            <line x1="1" y1="-1" x2="-1" y2="1" stroke="#EF4444" strokeWidth="0.8" />
          </g>
          <g transform="translate(14,8)">
            <line x1="-1" y1="-1" x2="1" y2="1" stroke="#EF4444" strokeWidth="0.8" />
            <line x1="1" y1="-1" x2="-1" y2="1" stroke="#EF4444" strokeWidth="0.8" />
          </g>
        </>
      ) : (
        <>
          <circle cx="10" cy="8" r="1.2" fill="#1a1a2e">
            {status === "working" && <animate attributeName="r" values="1.2;1;1.2" dur="2s" repeatCount="indefinite" />}
          </circle>
          <circle cx="14" cy="8" r="1.2" fill="#1a1a2e">
            {status === "working" && <animate attributeName="r" values="1;1.2;1" dur="2s" repeatCount="indefinite" />}
          </circle>
          {/* Eye shine */}
          <circle cx="10.5" cy="7.5" r="0.4" fill="#fff" />
          <circle cx="14.5" cy="7.5" r="0.4" fill="#fff" />
        </>
      )}
      {/* Mouth */}
      {status === "working" ? (
        <path d="M10 11 Q12 12.5 14 11" fill="none" stroke="#c0392b" strokeWidth="0.5" />
      ) : status === "blocked" ? (
        <path d="M10 12 Q12 10.5 14 12" fill="none" stroke="#c0392b" strokeWidth="0.6" />
      ) : status === "done" ? (
        <path d="M9 10.5 Q12 14 15 10.5" fill="none" stroke="#c0392b" strokeWidth="0.6" />
      ) : (
        <line x1="10" y1="11" x2="14" y2="11" stroke="#c0392b" strokeWidth="0.5" />
      )}
      {/* Status thought bubble */}
      {status === "blocked" && (
        <g>
          <circle cx="22" cy="0" r="5" fill="#fff" stroke="#e2e8f0" strokeWidth="0.5" />
          <circle cx="19" cy="4" r="1.5" fill="#fff" />
          <circle cx="17" cy="6" r="0.8" fill="#fff" />
          <text x="22" y="2" textAnchor="middle" fontSize="5">❗</text>
        </g>
      )}
      {status === "done" && (
        <g>
          <circle cx="22" cy="0" r="5" fill="#fff" stroke="#e2e8f0" strokeWidth="0.5" />
          <circle cx="19" cy="4" r="1.5" fill="#fff" />
          <text x="22" y="2" textAnchor="middle" fontSize="5">✅</text>
        </g>
      )}
      {status === "idle" && (
        <g opacity="0.7">
          <text x="18" y="2" fontSize="8">💤</text>
        </g>
      )}
    </g>
  );
}

/* ─── Desk with monitor, items ─── */
function Desk({ color, hasPlant, hasCoffee, hasPapers }) {
  return (
    <g>
      {/* Desk surface */}
      <rect x="0" y="18" width="70" height="24" rx="3" fill="#5c4a3a" stroke="#4a3a2e" strokeWidth="0.8" />
      <rect x="2" y="19" width="66" height="6" rx="1" fill="#6b5a4a" opacity="0.5" />
      {/* Desk legs */}
      <rect x="4" y="42" width="4" height="10" rx="1" fill="#4a3a2e" />
      <rect x="62" y="42" width="4" height="10" rx="1" fill="#4a3a2e" />
      {/* Monitor */}
      <rect x="22" y="2" width="26" height="17" rx="2" fill="#1a1a2e" stroke="#2d3748" strokeWidth="1" />
      <rect x="24" y="4" width="22" height="12" rx="1" fill="#0f172a" />
      {/* Monitor stand */}
      <rect x="32" y="19" width="6" height="3" rx="0.5" fill="#2d3748" />
      <rect x="29" y="21" width="12" height="2" rx="1" fill="#2d3748" />
      {/* Screen content glow */}
      <rect x="25" y="5" width="20" height="10" rx="0.5" fill={color} opacity="0.1" />
      {/* Code lines on screen */}
      {[0, 1, 2, 3].map(i => (
        <rect key={i} x={26 + (i % 2) * 2} y={6 + i * 2.5} width={8 + (i * 3) % 10} height="1.2" rx="0.5" fill={color} opacity="0.4">
          <animate attributeName="width" values={`${8 + (i * 3) % 10};${12 + (i * 2) % 8};${8 + (i * 3) % 10}`} dur={`${2 + i * 0.5}s`} repeatCount="indefinite" />
        </rect>
      ))}
      {/* Keyboard */}
      <rect x="24" y="25" width="22" height="6" rx="1.5" fill="#2d3748" stroke="#475569" strokeWidth="0.3" />
      {[0,1,2].map(row => (
        [0,1,2,3,4,5].map(col => (
          <rect key={`${row}-${col}`} x={25.5 + col * 3.3} y={26 + row * 1.8} width="2.5" height="1.2" rx="0.3" fill="#475569" opacity="0.6" />
        ))
      ))}
      {/* Mouse */}
      <rect x="50" y="27" width="4" height="5" rx="2" fill="#475569" stroke="#64748b" strokeWidth="0.3" />
      {/* Optional items */}
      {hasCoffee && (
        <g transform="translate(6, 22)">
          <rect x="0" y="2" width="6" height="7" rx="1.5" fill="#8B6914" />
          <rect x="6" y="4" width="3" height="3" rx="1.5" fill="none" stroke="#8B6914" strokeWidth="0.8" />
          {/* Steam */}
          <path d="M2 1 Q3 -1 2 -3" fill="none" stroke="#94a3b8" strokeWidth="0.4" opacity="0.5">
            <animate attributeName="d" values="M2 1 Q3 -1 2 -3;M2 1 Q1 -1 2 -3;M2 1 Q3 -1 2 -3" dur="2s" repeatCount="indefinite" />
          </path>
          <path d="M4 1 Q5 -2 4 -4" fill="none" stroke="#94a3b8" strokeWidth="0.3" opacity="0.4">
            <animate attributeName="d" values="M4 1 Q5 -2 4 -4;M4 1 Q3 -2 4 -4;M4 1 Q5 -2 4 -4" dur="2.5s" repeatCount="indefinite" />
          </path>
        </g>
      )}
      {hasPlant && (
        <g transform="translate(56, 10)">
          <rect x="2" y="6" width="7" height="8" rx="1" fill="#92400e" />
          <circle cx="5.5" cy="5" r="5" fill="#22c55e" opacity="0.7" />
          <circle cx="3" cy="3" r="3" fill="#16a34a" opacity="0.6" />
          <circle cx="8" cy="4" r="3.5" fill="#15803d" opacity="0.5" />
        </g>
      )}
      {hasPapers && (
        <g transform="translate(8, 26)">
          <rect x="0" y="0" width="8" height="10" rx="0.5" fill="#f1f5f9" transform="rotate(-5)" />
          <rect x="2" y="1" width="8" height="10" rx="0.5" fill="#e2e8f0" transform="rotate(3)" />
          {[0,1,2,3].map(i => (
            <rect key={i} x={3} y={3 + i * 2} width={5 + i % 3} height="0.8" rx="0.3" fill="#94a3b8" opacity="0.5" />
          ))}
        </g>
      )}
    </g>
  );
}

/* ─── Walking agent that moves between desks ─── */
function WalkingAgent({ fromDesk, toDesk, color, progress, label }) {
  const x = fromDesk.x + (toDesk.x - fromDesk.x) * progress;
  const y = fromDesk.y + (toDesk.y - fromDesk.y) * progress + 14;
  const dir = toDesk.x > fromDesk.x ? 1 : -1;
  const opacity = progress < 0.1 ? progress * 10 : progress > 0.9 ? (1 - progress) * 10 : 1;

  return (
    <g transform={`translate(${x}, ${y})`} opacity={opacity}>
      <PixelPerson color={color} status="working" direction={dir} style="walking" size={0.9} />
      {/* Task label floating above */}
      <g transform="translate(12, -10)">
        <rect x="-28" y="-8" width="56" height="12" rx="4" fill="#0f172a" stroke={color} strokeWidth="0.5" opacity="0.9" />
        <text x="0" y="-0.5" textAnchor="middle" fontSize="5.5" fill="#e2e8f0" fontFamily="monospace">{label}</text>
      </g>
    </g>
  );
}

/* ─── Config ─── */
const AGENTS = [
  { id: "orchestrator", name: "Orchestrator", emoji: "🎯", color: "#3B82F6", role: "Coordenador", desk: { x: 340, y: 40 }, hasPlant: true, hasCoffee: true },
  { id: "pm", name: "PM Agent", emoji: "📋", color: "#8B5CF6", role: "Product Manager", desk: { x: 130, y: 40 }, hasCoffee: true, hasPapers: true },
  { id: "architect", name: "Architect", emoji: "🏗️", color: "#10B981", role: "Arquiteto", desk: { x: 550, y: 40 }, hasPlant: true },
  { id: "frontend", name: "Frontend", emoji: "🎨", color: "#06B6D4", role: "Frontend Dev", desk: { x: 80, y: 210 }, hasCoffee: true },
  { id: "backend", name: "Backend", emoji: "⚙️", color: "#F97316", role: "Backend Dev", desk: { x: 290, y: 210 }, hasCoffee: true, hasPapers: true },
  { id: "database", name: "Database", emoji: "🗃️", color: "#EAB308", role: "DB Engineer", desk: { x: 500, y: 210 }, hasPlant: true },
  { id: "qa", name: "QA", emoji: "🧪", color: "#EF4444", role: "QA Engineer", desk: { x: 80, y: 380 }, hasPapers: true },
  { id: "security", name: "Security", emoji: "🔒", color: "#6B7280", role: "Security", desk: { x: 290, y: 380 }, hasCoffee: true },
  { id: "devops", name: "DevOps", emoji: "📦", color: "#EC4899", role: "DevOps", desk: { x: 500, y: 380 }, hasPlant: true, hasCoffee: true },
];

const WALK_ROUTES = [
  { from: "orchestrator", to: "frontend", label: "Task: Dashboard UI" },
  { from: "orchestrator", to: "backend", label: "Task: Auth API" },
  { from: "pm", to: "orchestrator", label: "Stories prontas" },
  { from: "architect", to: "database", label: "Schema ER" },
  { from: "backend", to: "qa", label: "API p/ testes" },
  { from: "frontend", to: "qa", label: "PR #12 review" },
  { from: "qa", to: "orchestrator", label: "Bug report" },
  { from: "security", to: "backend", label: "Fix XSS" },
  { from: "devops", to: "orchestrator", label: "Deploy ready" },
  { from: "database", to: "backend", label: "Migrations OK" },
];

const TASKS = [
  "Criando schema do banco...", "Implementando JWT auth...", "Escrevendo testes e2e...",
  "Setup CI/CD pipeline...", "Review de segurança...", "Componentes UI...",
  "Otimizando queries...", "Rotas da API...", "Docker config...", "Refactoring core...",
];

const CHAT_MESSAGES = [
  { from: "user", text: "Status geral?" },
  { from: "orchestrator", text: "Sprint 1: 68% completo. 6 agentes ativos, 2 em review." },
  { from: "user", text: "@frontend Usa Shadcn/ui" },
  { from: "frontend", text: "Entendido! Migrando componentes..." },
  { from: "orchestrator", text: "⚠️ QA encontrou 3 bugs no auth. Backend re-priorizando." },
  { from: "user", text: "Custo até agora?" },
  { from: "orchestrator", text: "Total: $1.47 — Claude: $0.89, GPT-4o: $0.42, Local: $0.16" },
  { from: "qa", text: "Testes passando: 47/52. Investigando 5 flaky." },
  { from: "user", text: "Prioriza o deploy!" },
  { from: "orchestrator", text: "DevOps movido p/ P0. Preview em ~12 min." },
  { from: "security", text: "Scan completo. 1 vulnerabilidade média encontrada." },
  { from: "user", text: "Mostra o que o backend fez" },
  { from: "orchestrator", text: "Backend completou: POST /api/auth, GET /api/projects, middleware JWT. 23 testes." },
];

export default function ForgeAIOffice() {
  const [agents, setAgents] = useState(() =>
    AGENTS.map((a, i) => ({
      ...a, status: i === 0 ? "working" : i < 3 ? "working" : "idle",
      progress: 10 + Math.random() * 60,
      currentTask: TASKS[i % TASKS.length],
      linesWritten: Math.floor(Math.random() * 500),
    }))
  );
  const [walkers, setWalkers] = useState([]);
  const [selectedAgent, setSelectedAgent] = useState(null);
  const [chatMessages, setChatMessages] = useState([CHAT_MESSAGES[0], CHAT_MESSAGES[1]]);
  const [chatInput, setChatInput] = useState("");
  const [projectProgress, setProjectProgress] = useState(34);
  const chatRef = useRef(null);
  const chatIdx = useRef(2);
  const walkerIdRef = useRef(0);

  /* Simulate status changes */
  useEffect(() => {
    const iv = setInterval(() => {
      setAgents(prev => prev.map(a => {
        const r = Math.random();
        let ns = a.status;
        if (r < 0.06) ns = "working";
        else if (r < 0.08) ns = "review";
        else if (r < 0.085) ns = "blocked";
        else if (r < 0.095) ns = "done";
        return {
          ...a, status: ns,
          progress: Math.min(100, a.progress + (ns === "working" ? Math.random() * 2.5 : 0)),
          currentTask: r < 0.04 ? TASKS[Math.floor(Math.random() * TASKS.length)] : a.currentTask,
          linesWritten: a.linesWritten + (ns === "working" ? Math.floor(Math.random() * 6) : 0),
        };
      }));
      setProjectProgress(p => Math.min(98, p + Math.random() * 0.25));
    }, 1400);
    return () => clearInterval(iv);
  }, []);

  /* Spawn walking agents */
  useEffect(() => {
    const iv = setInterval(() => {
      const route = WALK_ROUTES[Math.floor(Math.random() * WALK_ROUTES.length)];
      const fromA = AGENTS.find(a => a.id === route.from);
      const toA = AGENTS.find(a => a.id === route.to);
      if (!fromA || !toA) return;
      const id = walkerIdRef.current++;
      setWalkers(prev => [...prev.slice(-4), { id, from: fromA.desk, to: toA.desk, color: fromA.color, label: route.label, start: Date.now(), duration: 3000 }]);
      setTimeout(() => setWalkers(prev => prev.filter(w => w.id !== id)), 3200);
    }, 2800);
    return () => clearInterval(iv);
  }, []);

  /* Auto chat */
  useEffect(() => {
    const iv = setInterval(() => {
      if (chatIdx.current < CHAT_MESSAGES.length) {
        setChatMessages(prev => [...prev, CHAT_MESSAGES[chatIdx.current]]);
        chatIdx.current++;
      }
    }, 5500);
    return () => clearInterval(iv);
  }, []);

  useEffect(() => {
    if (chatRef.current) chatRef.current.scrollTop = chatRef.current.scrollHeight;
  }, [chatMessages]);

  const handleChat = useCallback(() => {
    if (!chatInput.trim()) return;
    setChatMessages(prev => [...prev, { from: "user", text: chatInput }]);
    const input = chatInput;
    setChatInput("");
    setTimeout(() => {
      setChatMessages(prev => [...prev, { from: "orchestrator", text: `Processando: "${input}". Redistribuindo tasks...` }]);
    }, 1500);
  }, [chatInput]);

  const [tick, setTick] = useState(0);
  useEffect(() => { const iv = setInterval(() => setTick(t => t + 1), 60); return () => clearInterval(iv); }, []);

  const W = 720, H = 530;
  const sel = agents.find(a => a.id === selectedAgent);
  const STATUS_CFG = {
    idle: { label: "Idle", color: "#64748b", icon: "💤" },
    working: { label: "Trabalhando", color: "#10B981", icon: "⚡" },
    blocked: { label: "Bloqueado", color: "#EF4444", icon: "🚫" },
    review: { label: "Em Review", color: "#8B5CF6", icon: "👀" },
    done: { label: "Concluído", color: "#3B82F6", icon: "✅" },
  };

  return (
    <div style={{ display: "flex", height: "100vh", background: "#080c14", fontFamily: "'JetBrains Mono', 'SF Mono', 'Fira Code', monospace", color: "#e2e8f0", overflow: "hidden" }}>
      {/* Main Area */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
        {/* Top Bar */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 16px", background: "#0f172a", borderBottom: "1px solid #1e293b" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontSize: 18 }}>🏭</span>
            <span style={{ fontSize: 14, fontWeight: 800, letterSpacing: 3, background: "linear-gradient(135deg, #3B82F6, #8B5CF6, #10B981)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>FORGEAI</span>
            <span style={{ fontSize: 9, color: "#475569", borderLeft: "1px solid #334155", paddingLeft: 8, marginLeft: 4 }}>Autonomous Software Factory</span>
          </div>
          <div style={{ display: "flex", gap: 14, fontSize: 9, alignItems: "center" }}>
            {["working", "review", "blocked"].map(s => (
              <span key={s} style={{ color: STATUS_CFG[s].color }}>
                <span style={{ display: "inline-block", width: 6, height: 6, borderRadius: "50%", background: STATUS_CFG[s].color, marginRight: 4, verticalAlign: "middle" }} />
                {agents.filter(a => a.status === s).length} {STATUS_CFG[s].label.toLowerCase()}
              </span>
            ))}
            <span style={{ color: "#64748b", borderLeft: "1px solid #334155", paddingLeft: 10 }}>🪙 $1.47</span>
          </div>
        </div>

        {/* Canvas */}
        <div style={{ flex: 1, display: "flex", justifyContent: "center", alignItems: "center", overflow: "hidden", padding: 6 }}>
          <svg viewBox={`0 0 ${W} ${H}`} style={{ maxWidth: "100%", maxHeight: "100%", borderRadius: 10, border: "1px solid #1e293b" }}>
            <defs>
              <pattern id="floor" width="20" height="20" patternUnits="userSpaceOnUse">
                <rect width="20" height="20" fill="#0c1322" />
                <rect width="10" height="10" fill="#0e1526" />
                <rect x="10" y="10" width="10" height="10" fill="#0e1526" />
              </pattern>
              <filter id="glow"><feGaussianBlur stdDeviation="2" /><feMerge><feMergeNode /><feMergeNode in="SourceGraphic" /></feMerge></filter>
              <radialGradient id="lampGlow" cx="50%" cy="0%" r="80%">
                <stop offset="0%" stopColor="#fbbf24" stopOpacity="0.06" />
                <stop offset="100%" stopColor="#fbbf24" stopOpacity="0" />
              </radialGradient>
            </defs>
            {/* Floor */}
            <rect width={W} height={H} fill="url(#floor)" />
            {/* Zone labels with subtle backgrounds */}
            {[
              { label: "MANAGEMENT", x: 50, y: 20, w: 620, h: 135, c: "#3B82F6" },
              { label: "DEVELOPMENT", x: 50, y: 185, w: 620, h: 145, c: "#10B981" },
              { label: "QA & SECURITY", x: 50, y: 358, w: 620, h: 145, c: "#EF4444" },
            ].map((z, i) => (
              <g key={i}>
                <rect x={z.x} y={z.y} width={z.w} height={z.h} rx="8" fill={z.c} fillOpacity="0.02" stroke={z.c} strokeOpacity="0.1" strokeWidth="1" strokeDasharray="4 4" />
                <text x={z.x + 8} y={z.y + 13} fontSize="7" fill={z.c} opacity="0.35" fontFamily="monospace" fontWeight="800" letterSpacing="2">{z.label}</text>
                {/* Ceiling lamp glow per zone */}
                <ellipse cx={z.x + z.w / 2} cy={z.y} rx={z.w * 0.4} ry={z.h * 0.5} fill={`url(#lampGlow)`} />
              </g>
            ))}
            {/* Decorative: water cooler, whiteboard, plants */}
            <g transform="translate(680, 160)" opacity="0.4">
              <rect x="0" y="8" width="12" height="18" rx="2" fill="#0ea5e9" opacity="0.3" />
              <rect x="2" y="4" width="8" height="6" rx="1" fill="#38bdf8" opacity="0.4" />
              <text x="6" y="0" textAnchor="middle" fontSize="8">🚰</text>
            </g>
            <g transform="translate(10, 150)" opacity="0.35">
              <rect x="0" y="0" width="30" height="20" rx="2" fill="#1e293b" stroke="#334155" strokeWidth="0.5" />
              <text x="15" y="13" textAnchor="middle" fontSize="6" fill="#94a3b8">📊 Board</text>
            </g>

            {/* Render desks + agents */}
            {agents.map((a, i) => (
              <g key={a.id} transform={`translate(${a.desk.x}, ${a.desk.y})`}
                onClick={() => setSelectedAgent(selectedAgent === a.id ? null : a.id)} style={{ cursor: "pointer" }}>
                {/* Desk */}
                <Desk color={a.color} hasPlant={a.hasPlant} hasCoffee={a.hasCoffee} hasPapers={a.hasPapers} />
                {/* Person sitting at desk */}
                <g transform="translate(23, 0)">
                  <PixelPerson color={a.color} status={a.status} size={1} />
                </g>
                {/* Name badge */}
                <g transform="translate(35, -12)">
                  <rect x="-24" y="-1" width="48" height="11" rx="3" fill={a.color} fillOpacity="0.2" stroke={a.color} strokeOpacity="0.4" strokeWidth="0.5" />
                  <text x="0" y="7" textAnchor="middle" fontSize="6.5" fill={a.color} fontWeight="700" fontFamily="monospace">{a.name}</text>
                </g>
                {/* Progress bar under desk */}
                <g transform="translate(0, 53)">
                  <rect width="70" height="3" rx="1.5" fill="#1e293b" />
                  <rect width={70 * (a.progress / 100)} height="3" rx="1.5" fill={a.color} opacity="0.7">
                    <animate attributeName="opacity" values="0.5;0.8;0.5" dur="2s" repeatCount="indefinite" />
                  </rect>
                </g>
                {/* Task label */}
                <text x="35" y="62" textAnchor="middle" fontSize="5" fill="#64748b" fontFamily="monospace">{a.currentTask?.slice(0, 26)}</text>
                {/* Selection highlight */}
                {selectedAgent === a.id && (
                  <rect x="-6" y="-16" width="82" height="84" rx="6" fill="none" stroke={a.color} strokeWidth="1.5" strokeDasharray="4 2" opacity="0.6">
                    <animate attributeName="strokeDashoffset" values="0;12" dur="1s" repeatCount="indefinite" />
                  </rect>
                )}
              </g>
            ))}

            {/* Walking agents */}
            {walkers.map(w => {
              const elapsed = (Date.now() - w.start) / w.duration;
              const p = Math.min(1, Math.max(0, elapsed));
              return <WalkingAgent key={w.id} fromDesk={w.from} toDesk={w.to} color={w.color} progress={p} label={w.label} />;
            })}

            {/* Bottom progress */}
            <g transform={`translate(50, ${H - 20})`}>
              <rect width={W - 100} height="12" rx="4" fill="#1e293b" />
              <rect width={(W - 100) * (projectProgress / 100)} height="12" rx="4" fill="url(#pGrad)" />
              <defs>
                <linearGradient id="pGrad" x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%" stopColor="#3B82F6" /><stop offset="50%" stopColor="#8B5CF6" /><stop offset="100%" stopColor="#10B981" />
                </linearGradient>
              </defs>
              <text x={(W - 100) / 2} y="9" textAnchor="middle" fontSize="7" fill="#fff" fontWeight="700" fontFamily="monospace">
                SPRINT 1 — {projectProgress.toFixed(1)}%
              </text>
            </g>
          </svg>
        </div>
      </div>

      {/* Right Panel */}
      <div style={{ width: 280, display: "flex", flexDirection: "column", borderLeft: "1px solid #1e293b", background: "#0c1322" }}>
        {/* Agent info if selected */}
        {sel && (
          <div style={{ padding: 12, borderBottom: "1px solid #1e293b", background: "#0f172a" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", marginBottom: 8 }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, color: sel.color }}>{sel.emoji} {sel.name}</div>
                <div style={{ fontSize: 9, color: "#64748b" }}>{sel.role}</div>
              </div>
              <span onClick={() => setSelectedAgent(null)} style={{ cursor: "pointer", color: "#475569", fontSize: 12 }}>✕</span>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 5, fontSize: 9 }}>
              {[
                ["Status", STATUS_CFG[sel.status].icon + " " + STATUS_CFG[sel.status].label, STATUS_CFG[sel.status].color],
                ["Progresso", sel.progress.toFixed(0) + "%", sel.color],
                ["Linhas", sel.linesWritten, "#e2e8f0"],
                ["Provider", "Claude Code", "#e2e8f0"],
              ].map(([l, v, c], i) => (
                <div key={i} style={{ background: "#1e293b", borderRadius: 4, padding: "4px 8px" }}>
                  <div style={{ color: "#64748b", marginBottom: 1, fontSize: 8 }}>{l}</div>
                  <div style={{ fontWeight: 700, color: c, fontSize: 10 }}>{v}</div>
                </div>
              ))}
            </div>
            <div style={{ marginTop: 6, padding: 6, background: "#1e293b", borderRadius: 4, fontSize: 9, borderLeft: `2px solid ${sel.color}` }}>
              <div style={{ color: "#64748b", marginBottom: 2, fontSize: 8 }}>Task atual:</div>
              <div style={{ color: "#e2e8f0" }}>{sel.currentTask}</div>
            </div>
          </div>
        )}

        {/* Chat header */}
        <div style={{ padding: "8px 12px", borderBottom: "1px solid #1e293b", fontSize: 10, fontWeight: 700, color: "#94a3b8", display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ width: 7, height: 7, borderRadius: "50%", background: "#10B981", display: "inline-block" }} />
          Chat com Orchestrator
        </div>

        {/* Messages */}
        <div ref={chatRef} style={{ flex: 1, overflowY: "auto", padding: 10, display: "flex", flexDirection: "column", gap: 8 }}>
          {chatMessages.map((m, i) => {
            const isUser = m.from === "user";
            const agent = !isUser ? AGENTS.find(a => a.id === m.from) : null;
            return (
              <div key={i} style={{ display: "flex", flexDirection: "column", alignItems: isUser ? "flex-end" : "flex-start" }}>
                <div style={{ fontSize: 8, color: "#475569", marginBottom: 2 }}>
                  {isUser ? "👤 Você" : agent ? `${agent.emoji} ${agent.name}` : m.from}
                </div>
                <div style={{
                  maxWidth: "88%", padding: "6px 10px", fontSize: 10, lineHeight: 1.5,
                  borderRadius: isUser ? "10px 10px 2px 10px" : "10px 10px 10px 2px",
                  background: isUser ? "linear-gradient(135deg, #3B82F6, #2563EB)" : "#1e293b",
                  border: isUser ? "none" : `1px solid ${agent?.color || "#334155"}25`,
                }}>
                  {m.text}
                </div>
              </div>
            );
          })}
        </div>

        {/* Input */}
        <div style={{ padding: 8, borderTop: "1px solid #1e293b", display: "flex", gap: 6 }}>
          <input value={chatInput} onChange={e => setChatInput(e.target.value)}
            onKeyDown={e => e.key === "Enter" && handleChat()}
            placeholder="Fale com o Orchestrator..."
            style={{ flex: 1, background: "#1e293b", border: "1px solid #334155", borderRadius: 8, padding: "7px 10px", color: "#e2e8f0", fontSize: 10, fontFamily: "inherit", outline: "none" }} />
          <button onClick={handleChat}
            style={{ background: "linear-gradient(135deg, #3B82F6, #8B5CF6)", border: "none", borderRadius: 8, padding: "7px 14px", color: "#fff", fontSize: 11, cursor: "pointer", fontFamily: "inherit", fontWeight: 700 }}>
            ↵
          </button>
        </div>
      </div>
    </div>
  );
}
