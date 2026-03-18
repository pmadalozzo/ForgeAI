/**
 * Definições de tipos para o sistema de agentes do ForgeAI.
 * Cada agente é um trabalhador especializado no escritório virtual.
 */

/** Status visual do bonequinho no escritório 2D */
export enum AgentStatus {
  /** Braços relaxados, olhos fechados, tela em standby */
  Idle = "idle",
  /** Mãos digitando, cabeça oscilando, linhas de código no monitor */
  Working = "working",
  /** Braços cruzados, olhos X vermelho, borda piscando */
  Blocked = "blocked",
  /** Mão no queixo, olhos semicerrados, diff no monitor */
  Review = "review",
  /** Braços levantados, sorriso largo, confete */
  Done = "done",
}

/** Modo de supervisão do usuário sobre os agentes */
export enum SupervisionMode {
  /** Agentes executam sem interrupção */
  Autopilot = "autopilot",
  /** Cada quality gate pausa para aprovação */
  Approve = "approve",
  /** Execução contínua com streaming de logs */
  Watch = "watch",
  /** Usuário trabalha junto com um agente específico */
  Pair = "pair",
}

/** Papel especializado de cada agente */
export type AgentRole =
  | "orchestrator"
  | "pm"
  | "architect"
  | "frontend"
  | "backend"
  | "database"
  | "qa"
  | "security"
  | "devops"
  | "reviewer"
  | "designer";

/** Provider de LLM que o agente utiliza */
export type LLMProvider =
  | "claude-code"
  | "openai"
  | "gemini"
  | "ollama"
  | "lm-studio";

/** Posição (x, y) no canvas 2D do escritório */
export interface Position {
  x: number;
  y: number;
}

/** Configuração visual da mesa de trabalho de um agente */
export interface DeskConfig {
  /** Posição da mesa no canvas */
  position: Position;
  /** Itens decorativos presentes na mesa */
  items: DeskItem[];
  /** Zona do escritório onde a mesa está */
  zone: OfficeZone;
}

/** Itens decorativos opcionais na mesa */
export type DeskItem =
  | "caneca-cafe"
  | "vaso-planta"
  | "pilha-papeis"
  | "monitor-extra"
  | "post-its";

/** Zonas do escritório virtual */
export type OfficeZone = "management" | "development" | "qa-ops";

/** Agente de IA — representação completa */
export interface Agent {
  /** Identificador único do agente */
  id: string;
  /** Nome de exibição (ex: "Orquestrador", "Frontend Dev") */
  name: string;
  /** Emoji identificador do agente */
  emoji: string;
  /** Cor temática fixa (hex) */
  color: string;
  /** Papel especializado */
  role: AgentRole;
  /** Status visual atual */
  status: AgentStatus;
  /** Progresso da tarefa atual (0-100) */
  progress: number;
  /** Descrição breve da tarefa em execução */
  currentTask: string | null;
  /** Provider de LLM configurado */
  provider: LLMProvider;
  /** Total de linhas de código escritas na sessão */
  linesWritten: number;
  /** Configuração da mesa no escritório */
  desk: DeskConfig;
}

/** Mensagem no chat com o orquestrador */
export interface ChatMessage {
  /** ID único da mensagem */
  id: string;
  /** ID do projeto associado */
  projectId: string;
  /** Remetente — ID do agente ou "user" */
  senderId: string;
  /** Nome de exibição do remetente */
  senderName: string;
  /** Emoji do remetente */
  senderEmoji: string;
  /** Conteúdo da mensagem (suporta markdown) */
  content: string;
  /** Tipo da mensagem */
  type: "text" | "code" | "status" | "error" | "system";
  /** Timestamp de criação (ISO 8601) */
  createdAt: string;
  /** Metadados extras (ex: arquivo referenciado, linguagem do code block) */
  metadata?: Record<string, string>;
}

/** Projeto sendo desenvolvido pela fábrica */
export interface Project {
  /** ID único do projeto */
  id: string;
  /** Nome do projeto */
  name: string;
  /** Descrição fornecida pelo usuário */
  description: string;
  /** Status geral do projeto */
  status: "setup" | "planning" | "in-progress" | "review" | "done" | "paused";
  /** Modo de supervisão ativo */
  supervisionMode: SupervisionMode;
  /** Caminho do diretório local (se houver) */
  localPath: string | null;
  /** URL do repositório Git (se houver) */
  gitUrl: string | null;
  /** Branch do repositório Git (se houver) */
  gitBranch: string | null;
  /** IDs dos agentes alocados */
  agentIds: string[];
  /** Progresso geral do projeto (0-100) */
  progress: number;
  /** Tarefas concluídas (títulos) */
  completedTasks: string[];
  /** Timestamp de criação */
  createdAt: string;
  /** Timestamp da última atualização */
  updatedAt: string;
}

/** Rota de caminhada de um agente entre mesas */
export interface WalkRoute {
  /** ID do agente que está caminhando */
  agentId: string;
  /** ID do agente de origem */
  fromAgentId: string;
  /** ID do agente de destino */
  toAgentId: string;
  /** Pontos intermediários da rota no canvas */
  waypoints: Position[];
  /** Etiqueta flutuante com conteúdo sendo transportado */
  label: string;
  /** Progresso da caminhada (0-1) */
  walkProgress: number;
  /** Timestamp de início */
  startedAt: string;
}
