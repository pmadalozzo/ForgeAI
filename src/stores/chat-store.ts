/**
 * Chat Store — Zustand store para mensagens do chat com o Orquestrador.
 * Gerencia mensagens, estado de loading, streaming e persistência no Supabase.
 */
import { create } from "zustand";
import { devtools } from "zustand/middleware";
import {
  saveMessage,
  loadMessages,
  type ChatMessageRow,
} from "@/services/supabase/chat-service";

/** Mensagem do chat */
export interface ChatStoreMessage {
  /** ID único da mensagem */
  id: string;
  /** Remetente: 'user' ou ID do agente */
  from: string;
  /** Conteúdo da mensagem */
  content: string;
  /** Timestamp em milissegundos */
  timestamp: number;
  /** Se a mensagem está sendo streamada */
  isStreaming?: boolean;
}

/** Estado da store de chat */
export interface ChatState {
  /** Lista de mensagens */
  messages: ChatStoreMessage[];
  /** Se está aguardando resposta */
  isLoading: boolean;
  /** Mensagem pendente injetada externamente (ex: ao iniciar projeto) */
  pendingMessage: string | null;
  /** Fila de mensagens do usuário enviadas durante processamento */
  queuedMessages: string[];
  /** ID do projeto atualmente carregado no chat */
  loadedProjectId: string | null;

  // --- Ações ---
  /** Adiciona uma mensagem e retorna o ID */
  addMessage: (from: string, content: string) => string;
  /** Atualiza o conteúdo de uma mensagem existente */
  updateMessage: (id: string, content: string) => void;
  /** Define o estado de streaming de uma mensagem */
  setStreaming: (id: string, streaming: boolean) => void;
  /** Define o estado de loading global */
  setLoading: (loading: boolean) => void;
  /** Limpa todas as mensagens */
  clearMessages: () => void;
  /** Injeta uma mensagem para ser processada pelo ChatPanel */
  injectMessage: (content: string) => void;
  /** Consome a mensagem pendente */
  consumePendingMessage: () => string | null;
  /** Enfileira uma mensagem para processar após o loading atual */
  enqueueMessage: (content: string) => void;
  /** Consome a próxima mensagem da fila */
  dequeueMessage: () => string | null;
  /** Carrega mensagens do Supabase para o projeto */
  loadMessagesFromSupabase: (projectId: string) => Promise<void>;
  /** Persiste uma mensagem no Supabase (fire-and-forget) */
  persistMessage: (projectId: string, messageId: string, from: string, content: string) => void;
  /** Persiste atualização de conteúdo de mensagem existente */
  persistUpdate: (projectId: string, messageId: string, from: string, content: string) => void;
}

/** Gera um UUID para mensagens (compatível com Supabase) */
function generateMessageId(): string {
  return crypto.randomUUID();
}

/** Converte row do Supabase para ChatStoreMessage */
function rowToMessage(row: ChatMessageRow): ChatStoreMessage {
  return {
    id: row.id,
    from: row.sender_type === "user" ? "user" : (row.agent_role ?? row.sender_id),
    content: row.content,
    timestamp: new Date(row.created_at).getTime(),
    isStreaming: false,
  };
}

export const useChatStore = create<ChatState>()(
  devtools(
    (set, get) => ({
      messages: [],
      isLoading: false,
      pendingMessage: null,
      queuedMessages: [],
      loadedProjectId: null,

      addMessage: (from, content) => {
        const id = generateMessageId();
        set(
          (state) => ({
            messages: [
              ...state.messages,
              {
                id,
                from,
                content,
                timestamp: Date.now(),
                isStreaming: false,
              },
            ],
          }),
          false,
          "addMessage",
        );
        return id;
      },

      updateMessage: (id, content) =>
        set(
          (state) => ({
            messages: state.messages.map((m) =>
              m.id === id ? { ...m, content } : m,
            ),
          }),
          false,
          "updateMessage",
        ),

      setStreaming: (id, streaming) =>
        set(
          (state) => ({
            messages: state.messages.map((m) =>
              m.id === id ? { ...m, isStreaming: streaming } : m,
            ),
          }),
          false,
          "setStreaming",
        ),

      setLoading: (loading) =>
        set({ isLoading: loading }, false, "setLoading"),

      clearMessages: () =>
        set({ messages: [], isLoading: false, pendingMessage: null, queuedMessages: [], loadedProjectId: null }, false, "clearMessages"),

      injectMessage: (content) =>
        set({ pendingMessage: content }, false, "injectMessage"),

      consumePendingMessage: () => {
        const msg = get().pendingMessage;
        if (msg) set({ pendingMessage: null }, false, "consumePendingMessage");
        return msg;
      },

      enqueueMessage: (content) =>
        set(
          (state) => ({ queuedMessages: [...state.queuedMessages, content] }),
          false,
          "enqueueMessage",
        ),

      dequeueMessage: () => {
        const queue = get().queuedMessages;
        if (queue.length === 0) return null;
        const [next, ...rest] = queue;
        set({ queuedMessages: rest }, false, "dequeueMessage");
        return next;
      },

      loadMessagesFromSupabase: async (projectId: string) => {
        // Evita recarregar se já é o mesmo projeto
        if (get().loadedProjectId === projectId) return;

        console.log("[chat-store] Carregando mensagens do projeto:", projectId);
        const rows = await loadMessages(projectId);

        const loaded = rows.map(rowToMessage);
        set(
          {
            messages: loaded,
            loadedProjectId: projectId,
            queuedMessages: [],
            isLoading: false,
          },
          false,
          "loadMessagesFromSupabase",
        );
        console.log(`[chat-store] ${loaded.length} mensagens carregadas`);
      },

      persistMessage: (projectId, messageId, from, content) => {
        const senderType = from === "user" ? "user" as const : "agent" as const;
        const agentRole = from === "user" ? undefined : from;
        void saveMessage(projectId, messageId, senderType, from, content, agentRole);
      },

      persistUpdate: (projectId, messageId, from, content) => {
        const senderType = from === "user" ? "user" as const : "agent" as const;
        const agentRole = from === "user" ? undefined : from;
        // Usa upsert — mesmo ID atualiza o conteúdo
        void saveMessage(projectId, messageId, senderType, from, content, agentRole);
      },
    }),
    { name: "ForgeAI-Chat" },
  ),
);
