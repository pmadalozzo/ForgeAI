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
  const addMessageRaw = useChatStore((s) => s.addMessage);
  const updateMessageRaw = useChatStore((s) => s.updateMessage);
  const setStreaming = useChatStore((s) => s.setStreaming);
  const setLoading = useChatStore((s) => s.setLoading);
  const persistMessage = useChatStore((s) => s.persistMessage);
  const persistUpdate = useChatStore((s) => s.persistUpdate);

  // Settings store
  const agentDefaults = useSettingsStore((s) => s.agentDefaults);
  const isProviderConfigured = useSettingsStore((s) => s.isProviderConfigured);

  // Project store
  const project = useProjectStore((s) => s.getProject());

  // Wrappers que adicionam e persistem mensagens no Supabase
  const addMessage = useCallback((from: string, content: string) => {
    const id = addMessageRaw(from, content);
    const pid = project?.id;
    if (pid) {
      persistMessage(pid, id, from, content);
    }
    return id;
  }, [addMessageRaw, persistMessage, project]);

  // updateMessage NÃO persiste a cada chunk — só atualiza em memória.
  // A persistência final acontece quando setStreaming(id, false) é chamado.
  const updateMessage = updateMessageRaw;

  // Wrapper de setStreaming que persiste a mensagem final quando streaming termina
  const setStreamingRaw = setStreaming;
  const setStreamingWithPersist = useCallback((id: string, streaming: boolean) => {
    setStreamingRaw(id, streaming);
    // Quando streaming termina, persiste o conteúdo final
    if (!streaming) {
      const pid = project?.id;
      if (pid) {
        const msg = useChatStore.getState().messages.find((m) => m.id === id);
        if (msg && msg.content.length > 0) {
          persistUpdate(pid, id, msg.from, msg.content);
        }
      }
    }
  }, [setStreamingRaw, persistUpdate, project]);

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

## REGRA ABSOLUTA
Voce SEMPRE responde com um PLANO DE TAREFAS em formato de lista numerada. NUNCA responda com perguntas, status, ou explicacoes. Se o pedido for ambiguo, INTERPRETE e crie o plano — NAO pergunte "o que voce precisa?".

## Formato OBRIGATORIO (siga EXATAMENTE)
1. **Titulo da tarefa** (role) — Descricao curta do que fazer

Roles validas entre parenteses: pm, architect, frontend, backend, database, qa, security, devops, reviewer, designer

## Tipos de Mensagem do Usuario
1. **Novo projeto**: "Crie um site de pets" → plano completo do zero (PM, Architect, Frontend...)
2. **Melhoria/feedback**: "Melhore o Hero", "Melhore os cards", "Não gostei do layout" → plano com 1-3 tarefas focadas (geralmente designer + frontend)
3. **Continuação**: "[CONTINUAR PROJETO]" → verifique o que falta e planeje apenas as pendências

Para melhorias de UI/UX, inclua o **designer** para revisar e o **frontend** para implementar.
Para melhorias, NÃO repita o projeto inteiro. Crie apenas 1-3 tarefas focadas na mudança pedida.

## IMPORTANTE: Continuidade do Projeto
- SEMPRE analise primeiro o que ja existe no projeto antes de planejar
- Se o projeto ja tem arquivos/codigo, planeje APENAS o que falta, nao refaca o que ja esta pronto
- NUNCA repita tarefas que ja foram concluidas (cheque o historico)

## Exemplo de resposta para MELHORIA:
1. **Revisar UI/UX dos cards** (designer) — Analisar layout, espacamento, hierarquia visual e propor melhorias nos cards existentes
2. **Implementar melhorias nos cards** (frontend) — Aplicar as melhorias de design: sombras, hover effects, tipografia, responsividade

## Exemplo de resposta para NOVO PROJETO:
1. **Criar PRD** (pm) — Definir requisitos, user stories e criterios de aceitacao
2. **Setup do projeto** (architect) — Criar package.json, tsconfig, vite.config, tailwind.config
3. **Componentes React** (frontend) — Criar paginas e componentes da interface

## Regras
- Maximo 6 tarefas para MVP
- Stack padrao: React 18 + TypeScript + Vite + Tailwind
- Responda em portugues brasileiro
- Seja CONCISO — maximo 15 linhas
- NUNCA responda com status do projeto ou perguntas. SEMPRE responda com o plano.
- **RESPEITE** preferencias do usuario: se pediu "sem backend", NAO crie tarefas para backend.`;

    if (project) {
      prompt += `\n\n## Contexto do Projeto Atual\n- Nome: ${project.name}\n- Descricao: ${project.description}`;
      // NÃO inclui localPath — o orchestrator roda sem CWD e tentaria acessar a pasta sem permissão
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

    // Injeta resumo das últimas interações do chat para continuidade
    const recentMsgs = useChatStore.getState().messages;
    const agentMsgs = recentMsgs.filter(
      (m) => m.from !== "user" && m.content.length > 50 && !m.content.startsWith("[Erro"),
    ).slice(-3);

    if (agentMsgs.length > 0) {
      const summaryLines = agentMsgs.map((m) => {
        const preview = m.content.length > 150 ? m.content.slice(0, 150) + "..." : m.content;
        return `- [${m.from}]: ${preview}`;
      }).join("\n");
      prompt += `\n\n## Ultimas Respostas dos Agentes (para contexto de continuidade)\n${summaryLines}`;
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

  // Queue store
  const enqueueMessage = useChatStore((s) => s.enqueueMessage);
  const dequeueMessage = useChatStore((s) => s.dequeueMessage);

  /** Envia mensagem e recebe resposta via streaming */
  const handleSend = useCallback(async (injectedText?: string) => {
    const text = (injectedText ?? chatInput).trim();
    if (!text) return;

    if (!injectedText) setChatInput("");

    // Se já está processando, enfileira a mensagem para depois
    if (isLoading) {
      addMessage("user", text);
      enqueueMessage(text);
      return;
    }

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
      setStreamingWithPersist(responseId, true);
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
            if (chunk.replace) {
              // Provider pede substituição total (ex: Claude CLI que não faz streaming real)
              accumulatedContent = chunk.content;
            } else {
              accumulatedContent += chunk.content;
            }
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
        setStreamingWithPersist(responseId, false);

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
    setStreamingWithPersist,
    setLoading,
    setAgentStatus,
    setAgentTask,
    orchestratorConfigured,
    agentDefaults,
    buildSystemPrompt,
    orchestratorProcess,
    project,
    addProjectMemory,
    enqueueMessage,
  ]);

  /** Processa mensagens da fila quando o loading termina */
  const handleSendRef2 = useRef(handleSend);
  handleSendRef2.current = handleSend;
  useEffect(() => {
    if (!isLoading) {
      const next = dequeueMessage();
      if (next) {
        void handleSendRef2.current(next);
      }
    }
  }, [isLoading, dequeueMessage]);

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

        {messages.map((m, idx) => {
          const isUser = m.from === "user";
          const agent = !isUser ? agentLookup[m.from] : undefined;

          // Agrupa: oculta label se a mensagem anterior (qualquer posição recente) é do mesmo sender
          const prevMsg = idx > 0 ? messages[idx - 1] : undefined;
          const isSameSender = prevMsg !== undefined && prevMsg.from === m.from;
          // Também oculta se a mensagem anterior é do orchestrator com msg curta de sistema (ex: "Iniciando Fase...")
          const isPrevSystemMsg = prevMsg !== undefined &&
            prevMsg.from === "orchestrator" &&
            prevMsg.content.length < 120 &&
            (prevMsg.content.includes("Fase") || prevMsg.content.includes("Decompus") || prevMsg.content.includes("Analisando"));
          const prevPrevMsg = idx > 1 ? messages[idx - 2] : undefined;
          const isGroupedAfterSystem = isPrevSystemMsg && prevPrevMsg !== undefined && prevPrevMsg.from === m.from;

          const hideLabel = isSameSender || isGroupedAfterSystem;

          return (
            <div
              key={m.id}
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: isUser ? "flex-end" : "flex-start",
                marginTop: isSameSender ? -4 : 0,
              }}
            >
              {/* Sender label + timestamp — oculta se agrupado */}
              {!hideLabel && (
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
              )}
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
          placeholder={isLoading ? "Envie instrução adicional..." : "Fale com o Orchestrator..."}
          autoComplete="off"
          style={{
            flex: 1,
            background: "#1e293b",
            border: `1px solid ${isLoading ? "#3B82F6" : "#334155"}`,
            borderRadius: 8,
            padding: "7px 10px",
            color: "#e2e8f0",
            fontSize: 14,
            fontFamily: "inherit",
            outline: "none",
          }}
        />
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
        {isLoading && (
          <button
            onClick={() => void handleStop()}
            type="button"
            style={{
              background: "linear-gradient(135deg, #EF4444, #DC2626)",
              border: "none",
              borderRadius: 8,
              padding: "7px 10px",
              color: "#fff",
              fontSize: 12,
              cursor: "pointer",
              fontFamily: "inherit",
              fontWeight: 700,
              whiteSpace: "nowrap",
            }}
          >
            ■
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
