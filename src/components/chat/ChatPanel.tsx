/**
 * Painel lateral de chat com o Orquestrador.
 * Totalmente funcional — utiliza LLM Gateway para comunicação real com o LLM.
 */
import { useState, useEffect, useRef, useCallback } from "react";
import { useAgentsStore } from "@/stores/agents-store";
import { useChatStore } from "@/stores/chat-store";
import { useSettingsStore } from "@/stores/settings-store";
import { useProjectStore } from "@/stores/project-store";
import { llmGateway } from "@/services/llm/llm-gateway";
import { AgentStatus } from "@/types/agents";
import type { Agent } from "@/types/agents";
import type { LLMMessage } from "@/services/llm/llm-gateway";
import { useOrchestrator } from "@/hooks/useOrchestrator";
import { useMemoryStore } from "@/stores/memory-store";

/** Configuracao visual por status */
const STATUS_CONFIG: Record<
  AgentStatus,
  { label: string; color: string; icon: string }
> = {
  [AgentStatus.Idle]: { label: "Idle", color: "#64748b", icon: "💤" },
  [AgentStatus.Working]: {
    label: "Trabalhando",
    color: "#10B981",
    icon: "⚡",
  },
  [AgentStatus.Blocked]: {
    label: "Bloqueado",
    color: "#EF4444",
    icon: "🚫",
  },
  [AgentStatus.Review]: {
    label: "Em Review",
    color: "#8B5CF6",
    icon: "👀",
  },
  [AgentStatus.Done]: { label: "Concluido", color: "#3B82F6", icon: "✅" },
};

/** Configuracao dos agentes para lookup no chat */
interface AgentLookup {
  emoji: string;
  name: string;
  color: string;
}

/** Formata timestamp relativo */
function formatTime(ts: number): string {
  const now = Date.now();
  const diff = now - ts;
  if (diff < 60_000) return "agora";
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}min`;
  return new Date(ts).toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** Painel de informacoes do agente selecionado */
function AgentInfoPanel({
  agent,
  onClose,
}: {
  agent: Agent;
  onClose: () => void;
}) {
  const statusCfg = STATUS_CONFIG[agent.status];

  const infoItems: Array<[string, string, string]> = [
    ["Status", `${statusCfg.icon} ${statusCfg.label}`, statusCfg.color],
    ["Progresso", `${agent.progress.toFixed(0)}%`, agent.color],
    ["Linhas", String(agent.linesWritten), "#e2e8f0"],
    ["Provider", agent.provider, "#e2e8f0"],
  ];

  return (
    <div
      style={{
        padding: 12,
        borderBottom: "1px solid #1e293b",
        background: "#0f172a",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "start",
          marginBottom: 8,
        }}
      >
        <div>
          <div style={{ fontSize: 16, fontWeight: 700, color: agent.color }}>
            {agent.emoji} {agent.name}
          </div>
          <div style={{ fontSize: 12, color: "#64748b" }}>{agent.role}</div>
        </div>
        <span
          onClick={onClose}
          style={{ cursor: "pointer", color: "#475569", fontSize: 14 }}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") onClose();
          }}
        >
          ✕
        </span>
      </div>

      {/* Grid de metricas */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 5,
          fontSize: 13,
        }}
      >
        {infoItems.map(([label, value, color]) => (
          <div
            key={label}
            style={{
              background: "#1e293b",
              borderRadius: 4,
              padding: "4px 8px",
            }}
          >
            <div style={{ color: "#64748b", marginBottom: 1, fontSize: 11 }}>
              {label}
            </div>
            <div style={{ fontWeight: 700, color, fontSize: 13 }}>
              {value}
            </div>
          </div>
        ))}
      </div>

      {/* Tarefa atual */}
      <div
        style={{
          marginTop: 6,
          padding: 6,
          background: "#1e293b",
          borderRadius: 4,
          fontSize: 13,
          borderLeft: `2px solid ${agent.color}`,
        }}
      >
        <div style={{ color: "#64748b", marginBottom: 2, fontSize: 11 }}>
          Task atual:
        </div>
        <div style={{ color: "#e2e8f0" }}>
          {agent.currentTask || "Nenhuma tarefa"}
        </div>
      </div>
    </div>
  );
}

export function ChatPanel() {
  const agents = useAgentsStore((s) => s.agents);
  const selectedAgentId = useAgentsStore((s) => s.selectedAgentId);
  const selectAgent = useAgentsStore((s) => s.selectAgent);
  const setAgentStatus = useAgentsStore((s) => s.setAgentStatus);
  const setAgentTask = useAgentsStore((s) => s.setAgentTask);

  const selectedAgent = agents.find((a) => a.id === selectedAgentId) ?? null;

  // Detecta o último agente ativo (Working > Review > Done, prioriza quem está fazendo algo agora)
  const STATUS_PRIORITY: Record<AgentStatus, number> = {
    [AgentStatus.Working]: 0,
    [AgentStatus.Review]: 1,
    [AgentStatus.Done]: 2,
    [AgentStatus.Blocked]: 3,
    [AgentStatus.Idle]: 4,
  };

  const lastActiveAgent = [...agents]
    .filter((a) => a.status !== AgentStatus.Idle)
    .sort((a, b) => {
      const pa = STATUS_PRIORITY[a.status];
      const pb = STATUS_PRIORITY[b.status];
      if (pa !== pb) return pa - pb;
      // Mesmo status: menor progresso = acabou de começar (mais relevante)
      return (a.progress ?? 0) - (b.progress ?? 0);
    })[0] ?? null;

  // Mostra o agente selecionado manualmente OU o último ativo
  const displayAgent = selectedAgent ?? lastActiveAgent;

  // Chat store
  const messages = useChatStore((s) => s.messages);
  const isLoading = useChatStore((s) => s.isLoading);
  const addMessage = useChatStore((s) => s.addMessage);
  const updateMessage = useChatStore((s) => s.updateMessage);
  const setStreaming = useChatStore((s) => s.setStreaming);
  const setLoading = useChatStore((s) => s.setLoading);

  // Settings store
  const agentDefaults = useSettingsStore((s) => s.agentDefaults);
  const isProviderConfigured = useSettingsStore((s) => s.isProviderConfigured);

  // Project store
  const project = useProjectStore((s) => s.getProject());

  // Orchestrator hook — distribui tarefas para agentes
  const { processMessage: orchestratorProcess } = useOrchestrator();

  // Memory store — salvar respostas do orquestrador como memória do projeto
  const addProjectMemory = useMemoryStore((s) => s.addProjectMemory);
  const projectMemories = useMemoryStore((s) => s.projectMemories);
  const devMemories = useMemoryStore((s) => s.devMemories);

  const [chatInput, setChatInput] = useState("");
  const chatRef = useRef<HTMLDivElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Lookup de agentes por ID para renderizar mensagens
  const agentLookup = agents.reduce<Record<string, AgentLookup>>(
    (acc, a) => {
      acc[a.id] = { emoji: a.emoji, name: a.name, color: a.color };
      return acc;
    },
    {},
  );

  /** Monta system prompt com contexto do projeto */
  const buildSystemPrompt = useCallback((): string => {
    let prompt = `Voce e o Orquestrador do ForgeAI, uma fabrica de software autonoma.
Seu papel e APENAS PLANEJAR e COORDENAR. Voce NAO cria arquivos, NAO escreve codigo, NAO executa comandos.

## Seu Unico Trabalho
Receber a descricao do projeto e responder com um PLANO CONCISO em formato de lista:
- Liste 4-6 tarefas na ordem de execucao
- Cada tarefa com: titulo, agente responsavel (architect/frontend/backend/database/qa), e descricao curta
- NUNCA tente criar arquivos ou executar codigo voce mesmo

## Formato de Resposta
Responda APENAS com o plano, sem explicacoes longas. Exemplo:

1. **Setup do projeto** (architect) — Criar package.json, tsconfig, vite.config, tailwind.config
2. **Tipos e interfaces** (architect) — Definir interfaces TypeScript para as entidades
3. **Dados mock e services** (backend) — Criar services com dados mock em memoria
4. **Componentes React** (frontend) — Criar paginas e componentes da interface
5. **Integracao** (frontend) — Conectar componentes aos services

## Regras
- Maximo 6 tarefas para MVP
- Ordem sequencial (cada tarefa depende da anterior)
- Stack padrao: React 18 + TypeScript + Vite + Tailwind
- Imports relativos (sem aliases)
- Responda em portugues brasileiro
- Seja CONCISO — maximo 15 linhas de resposta`;

    if (project) {
      prompt += `\n\n## Contexto do Projeto Atual\n- Nome: ${project.name}\n- Descricao: ${project.description}`;
      if (project.localPath) {
        prompt += `\n- Pasta local: ${project.localPath}`;
      }
      if (project.gitUrl) {
        prompt += `\n- Repositorio Git: ${project.gitUrl}`;
      }
    }

    // Injeta memórias do projeto (últimas 5 de progresso)
    const pid = project?.id ?? "default";
    const relevantProjectMems = projectMemories
      .filter((m) => m.projectId === pid)
      .slice(-5);

    if (relevantProjectMems.length > 0) {
      const memLines = relevantProjectMems
        .map((m) => `- [${m.type}] ${m.title} (por ${m.agentRole})`)
        .join("\n");
      prompt += `\n\n## Historico do Projeto\n${memLines}`;
    }

    // Injeta preferências de desenvolvimento do usuário
    if (devMemories.length > 0) {
      const devLines = devMemories
        .map((m) => `- [${m.category}] ${m.title}: ${m.content}`)
        .join("\n");
      prompt += `\n\n## Preferencias do Usuario\n${devLines}`;
    }

    return prompt;
  }, [project, projectMemories, devMemories]);

  /** Auto-scroll ao receber nova mensagem */
  useEffect(() => {
    if (chatRef.current) {
      chatRef.current.scrollTop = chatRef.current.scrollHeight;
    }
  }, [messages]);

  /** Verifica se o orchestrator tem um provider configurado */
  const orchestratorConfigured = useCallback((): boolean => {
    const defaults = agentDefaults.orchestrator;
    return isProviderConfigured(defaults.provider);
  }, [agentDefaults, isProviderConfigured]);

  /** Para o processamento em andamento */
  const handleStop = useCallback(async () => {
    // 1. Abortar o fetch em andamento
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }

    // 2. Matar processos CLI no servidor
    try {
      await fetch("/api/claude/abort", { method: "POST" });
    } catch {
      // Ignora — servidor pode estar indisponível
    }

    // 3. Setar todos os agentes "Working" para "Idle"
    const allAgents = useAgentsStore.getState().agents;
    for (const agent of allAgents) {
      if (agent.status === AgentStatus.Working) {
        setAgentStatus(agent.id, AgentStatus.Idle);
        setAgentTask(agent.id, "");
      }
    }

    // 4. Resetar flag de processamento do orchestrator
    const { orchestratorService } = await import("@/services/agents/orchestrator-service");
    orchestratorService.abortProcessing();

    // 5. Mostrar mensagem no chat
    addMessage("orchestrator", "Processamento interrompido pelo usuário.");

    // 6. Parar loading
    setLoading(false);
  }, [setAgentStatus, setAgentTask, addMessage, setLoading]);

  /** Envia mensagem e recebe resposta via streaming */
  const handleSend = useCallback(async (injectedText?: string) => {
    const text = (injectedText ?? chatInput).trim();
    if (!text || isLoading) return;

    if (!injectedText) setChatInput("");

    // Add user message
    addMessage("user", text);

    // Check if provider is configured
    if (!orchestratorConfigured()) {
      addMessage(
        "orchestrator",
        "Configure um provider LLM nas configurações para começar.",
      );
      return;
    }

    setLoading(true);

    // Cria AbortController para permitir cancelamento
    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    // Atualiza visual do orquestrador
    const { setAgentProgress: setProgress } = useAgentsStore.getState();
    setAgentStatus("orchestrator", AgentStatus.Working);
    setAgentTask("orchestrator", "Analisando projeto...");
    setProgress("orchestrator", 10);

    try {
      // Build messages array from chat history (last 20 messages for context)
      const recentMessages = useChatStore.getState().messages;
      const contextMessages = recentMessages.slice(-20);

      const llmMessages: LLMMessage[] = contextMessages.map((m) => ({
        role: m.from === "user" ? "user" as const : "assistant" as const,
        content: m.content,
      }));

      // Get orchestrator config
      const orchDefaults = agentDefaults.orchestrator;

      // Garante que o provider está registrado (fallback se gateway não inicializou)
      if (!llmGateway.getProvider(orchDefaults.provider)) {
        const { ClaudeProvider } = await import("@/services/llm/providers/claude-provider");
        llmGateway.registerProvider(new ClaudeProvider());
        console.log("[ChatPanel] Provider registrado via fallback");
      }

      // Set agent config on gateway
      llmGateway.setAgentConfig(
        "orchestrator",
        orchDefaults.provider,
        orchDefaults.model,
      );

      // Create a placeholder message for the streaming response
      const responseId = addMessage("orchestrator", "");
      setStreaming(responseId, true);
      updateMessage(responseId, "Aguardando resposta do Claude Code CLI...");

      let accumulatedContent = "";

      // Try streaming
      try {
        const request = {
          agentId: "orchestrator",
          messages: llmMessages,
          model: orchDefaults.model,
          temperature: 0.7,
          maxTokens: 4096,
          systemPrompt: buildSystemPrompt(),
          metadata: {} as Record<string, string>,
          signal: abortController.signal,
        };

        console.log("[ChatPanel] Iniciando stream...", { model: orchDefaults.model, msgCount: llmMessages.length });
        setAgentTask("orchestrator", "Consultando Claude CLI...");
        setProgress("orchestrator", 30);

        const stream = llmGateway.stream(request);
        for await (const chunk of stream) {
          if (chunk.content) {
            accumulatedContent += chunk.content;
            updateMessage(responseId, accumulatedContent);
          }
          if (chunk.done) {
            console.log("[ChatPanel] Stream completo:", accumulatedContent.length, "chars");
            setProgress("orchestrator", 60);
          }
        }
        console.log("[ChatPanel] Stream loop finalizado");
      } catch (streamError) {
        const errorMsg =
          streamError instanceof Error
            ? streamError.message
            : String(streamError);

        if (accumulatedContent.length === 0) {
          updateMessage(
            responseId,
            `Erro ao comunicar com o LLM: ${errorMsg}. Verifique as configurações.`,
          );
        }
      } finally {
        setStreaming(responseId, false);

        // Salvar resposta do orquestrador como memória do projeto
        // Não salvar se o conteúdo é uma mensagem de erro
        const isErrorContent =
          accumulatedContent.startsWith("[Erro") ||
          accumulatedContent.startsWith("Erro ao comunicar") ||
          accumulatedContent.startsWith("Erro inesperado");
        if (accumulatedContent.length > 0 && !isErrorContent) {
          const memProjectId = project?.id ?? "default";
          const title =
            accumulatedContent.length > 60
              ? accumulatedContent.slice(0, 60) + "..."
              : accumulatedContent;
          addProjectMemory({
            projectId: memProjectId,
            agentRole: "orchestrator",
            type: "analysis",
            title,
            content: accumulatedContent,
          });
        }
      }

      // Dispara o orchestrator para distribuir tarefas aos agentes em background
      setAgentTask("orchestrator", "Distribuindo tarefas...");
      setProgress("orchestrator", 80);

      const projectId = project?.id ?? "default";
      orchestratorProcess(text, projectId)
        .then(() => {
          setProgress("orchestrator", 100);
          setAgentStatus("orchestrator", AgentStatus.Done);
          setAgentTask("orchestrator", "Tarefas distribuídas");
        })
        .catch((err: unknown) => {
          console.error("[ChatPanel] Erro no orchestrator:", err);
          setAgentStatus("orchestrator", AgentStatus.Blocked);
          setAgentTask("orchestrator", "Erro na distribuição");
        });
    } catch (error) {
      const errorMsg =
        error instanceof Error ? error.message : String(error);
      addMessage(
        "orchestrator",
        `Erro inesperado: ${errorMsg}. Verifique as configurações.`,
      );
    } finally {
      setLoading(false);
    }
  }, [
    chatInput,
    isLoading,
    addMessage,
    updateMessage,
    setStreaming,
    setLoading,
    setAgentStatus,
    setAgentTask,
    orchestratorConfigured,
    agentDefaults,
    buildSystemPrompt,
    orchestratorProcess,
    project,
    addProjectMemory,
  ]);

  /** Consome mensagens pendentes injetadas (ex: ao iniciar projeto) */
  const pendingMessage = useChatStore((s) => s.pendingMessage);
  const handleSendRef = useRef(handleSend);
  handleSendRef.current = handleSend;
  useEffect(() => {
    if (pendingMessage && !isLoading) {
      const msg = useChatStore.getState().consumePendingMessage();
      if (msg) {
        void handleSendRef.current(msg);
      }
    }
  }, [pendingMessage, isLoading]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") void handleSend();
  };

  return (
    <div
      style={{
        width: 340,
        display: "flex",
        flexDirection: "column",
        borderLeft: "1px solid #1e293b",
        background: "#0c1322",
        fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
      }}
    >
      {/* Info do agente ativo (selecionado manualmente ou último trabalhando) */}
      {displayAgent && (
        <AgentInfoPanel
          agent={displayAgent}
          onClose={() => selectAgent(null)}
        />
      )}

      {/* Header do chat */}
      <div
        style={{
          padding: "8px 12px",
          borderBottom: "1px solid #1e293b",
          fontSize: 14,
          fontWeight: 700,
          color: "#94a3b8",
          display: "flex",
          alignItems: "center",
          gap: 6,
        }}
      >
        <span
          style={{
            width: 8,
            height: 8,
            borderRadius: "50%",
            background: orchestratorConfigured() ? "#10B981" : "#475569",
            display: "inline-block",
          }}
        />
        Chat com Orchestrator
      </div>

      {/* Mensagens */}
      <div
        ref={chatRef}
        style={{
          flex: 1,
          overflowY: "auto",
          padding: 10,
          display: "flex",
          flexDirection: "column",
          gap: 8,
        }}
      >
        {messages.length === 0 && (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              flex: 1,
              color: "#475569",
              fontSize: 13,
              textAlign: "center",
              padding: 20,
              gap: 8,
            }}
          >
            <span style={{ fontSize: 28 }}>🎯</span>
            <span>
              {orchestratorConfigured()
                ? "Envie uma mensagem para o Orquestrador"
                : "Configure um provider LLM nas configurações para começar"}
            </span>
          </div>
        )}

        {messages.map((m) => {
          const isUser = m.from === "user";
          const agent = !isUser ? agentLookup[m.from] : undefined;

          return (
            <div
              key={m.id}
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: isUser ? "flex-end" : "flex-start",
              }}
            >
              {/* Sender label + timestamp */}
              <div
                style={{
                  fontSize: 12,
                  color: "#475569",
                  marginBottom: 2,
                  display: "flex",
                  gap: 6,
                  alignItems: "center",
                }}
              >
                <span>
                  {isUser
                    ? "👤 Você"
                    : agent
                      ? `${agent.emoji} ${agent.name}`
                      : m.from}
                </span>
                <span style={{ color: "#334155", fontSize: 11 }}>{formatTime(m.timestamp)}</span>
              </div>
              {/* Bubble */}
              <div
                style={{
                  maxWidth: "88%",
                  padding: "6px 10px",
                  fontSize: 13,
                  lineHeight: 1.5,
                  borderRadius: isUser
                    ? "10px 10px 2px 10px"
                    : "10px 10px 10px 2px",
                  background: isUser
                    ? "linear-gradient(135deg, #3B82F6, #2563EB)"
                    : "#1e293b",
                  border: isUser
                    ? "none"
                    : `1px solid ${agent?.color ?? "#334155"}25`,
                  color: "#e2e8f0",
                }}
              >
                {m.content || (m.isStreaming ? "" : "")}
                {m.isStreaming && (
                  <span
                    style={{
                      display: "inline-block",
                      width: 4,
                      height: 14,
                      background: "#3B82F6",
                      marginLeft: 2,
                      verticalAlign: "text-bottom",
                      animation: "blink 1s infinite",
                    }}
                  />
                )}
              </div>
            </div>
          );
        })}

        {/* Typing indicator — mostra o agente que está trabalhando */}
        {isLoading && (
          <div
            style={{
              fontSize: 12,
              color: lastActiveAgent?.color ?? "#64748b",
              display: "flex",
              alignItems: "center",
              gap: 6,
              padding: "4px 0",
            }}
          >
            <span
              style={{
                display: "inline-flex",
                gap: 3,
              }}
            >
              <span style={dotStyle(0)} />
              <span style={dotStyle(1)} />
              <span style={dotStyle(2)} />
            </span>
            {lastActiveAgent && lastActiveAgent.status === AgentStatus.Working
              ? `${lastActiveAgent.emoji} ${lastActiveAgent.name} está trabalhando...`
              : lastActiveAgent && lastActiveAgent.status === AgentStatus.Review
                ? `${lastActiveAgent.emoji} ${lastActiveAgent.name} está revisando...`
                : "Orquestrador está digitando..."}
          </div>
        )}
      </div>

      {/* Blink animation style */}
      <style>{`
        @keyframes blink {
          0%, 50% { opacity: 1; }
          51%, 100% { opacity: 0; }
        }
        @keyframes bounce {
          0%, 80%, 100% { transform: translateY(0); }
          40% { transform: translateY(-4px); }
        }
      `}</style>

      {/* Input de mensagem */}
      <div
        style={{
          padding: 8,
          borderTop: "1px solid #1e293b",
          display: "flex",
          gap: 6,
        }}
      >
        <input
          value={chatInput}
          onChange={(e) => setChatInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Fale com o Orchestrator..."
          disabled={isLoading}
          autoComplete="off"
          style={{
            flex: 1,
            background: "#1e293b",
            border: "1px solid #334155",
            borderRadius: 8,
            padding: "7px 10px",
            color: "#e2e8f0",
            fontSize: 14,
            fontFamily: "inherit",
            outline: "none",
            opacity: isLoading ? 0.6 : 1,
          }}
        />
        {isLoading ? (
          <button
            onClick={() => void handleStop()}
            type="button"
            style={{
              background: "linear-gradient(135deg, #EF4444, #DC2626)",
              border: "none",
              borderRadius: 8,
              padding: "7px 14px",
              color: "#fff",
              fontSize: 12,
              cursor: "pointer",
              fontFamily: "inherit",
              fontWeight: 700,
              whiteSpace: "nowrap",
            }}
          >
            Parar
          </button>
        ) : (
          <button
            onClick={() => void handleSend()}
            type="button"
            style={{
              background: "linear-gradient(135deg, #3B82F6, #8B5CF6)",
              border: "none",
              borderRadius: 8,
              padding: "7px 14px",
              color: "#fff",
              fontSize: 15,
              cursor: "pointer",
              fontFamily: "inherit",
              fontWeight: 700,
            }}
          >
            ↵
          </button>
        )}
      </div>
    </div>
  );
}

/** Estilo para os dots da animação de typing */
function dotStyle(index: number): React.CSSProperties {
  return {
    width: 5,
    height: 5,
    borderRadius: "50%",
    background: "#64748b",
    display: "inline-block",
    animation: `bounce 1.2s ease-in-out ${index * 0.15}s infinite`,
  };
}
