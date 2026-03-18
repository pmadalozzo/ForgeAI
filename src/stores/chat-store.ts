/**
 * Chat Store — Zustand store para mensagens do chat com o Orquestrador.
 * Gerencia mensagens, estado de loading e streaming.
 */
import { create } from "zustand";
import { devtools } from "zustand/middleware";

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
}

/** Gera um ID único para mensagens */
function generateMessageId(): string {
  return `msg_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export const useChatStore = create<ChatState>()(
  devtools(
    (set, get) => ({
      messages: [],
      isLoading: false,
      pendingMessage: null,

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
        set({ messages: [], isLoading: false, pendingMessage: null }, false, "clearMessages"),

      injectMessage: (content) =>
        set({ pendingMessage: content }, false, "injectMessage"),

      consumePendingMessage: () => {
        const msg = get().pendingMessage;
        if (msg) set({ pendingMessage: null }, false, "consumePendingMessage");
        return msg;
      },
    }),
    { name: "ForgeAI-Chat" },
  ),
);
