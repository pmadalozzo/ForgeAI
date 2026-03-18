/**
 * TaskDecomposer — Decompositor de tarefas usando LLM.
 * Produz um pipeline FASEADO (5 fases sequenciais) em vez de uma lista plana.
 *
 * Fases:
 *   1 - PLANNING:      PM cria PRD com requisitos e criterios de aceitacao
 *   2 - ARCHITECTURE:  Architect cria estrutura, convencoes e checklist
 *   3 - DEVELOPMENT:   Frontend, Backend, Database trabalham em paralelo
 *   4 - QUALITY:        QA, Security, Reviewer trabalham em paralelo
 *   5 - DELIVERY:       DevOps cria configs de build/deploy
 */

import type { AgentRole } from "../../types/agents";
import type { TaskDecomposer, DecomposedTask } from "./orchestrator";
import type { LLMGateway } from "../llm/llm-gateway";

/** Numero de fase valido no pipeline */
type PhaseNumber = 0 | 1 | 2 | 3 | 4 | 5;

/** Nomes das fases para referencia */
const PHASE_NAMES: Record<PhaseNumber, string> = {
  0: "RESEARCH",
  1: "PLANNING",
  2: "ARCHITECTURE",
  3: "DEVELOPMENT",
  4: "QUALITY",
  5: "DELIVERY",
};

/** Mapeamento de roles para suas fases esperadas */
const ROLE_TO_PHASE: Record<string, PhaseNumber> = {
  researcher: 0,
  pm: 1,
  architect: 2,
  frontend: 3,
  backend: 3,
  database: 3,
  designer: 4,
  qa: 4,
  security: 4,
  reviewer: 4,
  devops: 5,
};

/** Subtarefa parseada da resposta do LLM */
interface ParsedSubtask {
  title: string;
  description: string;
  assignedRole: AgentRole;
  phase: PhaseNumber;
  priority: "low" | "medium" | "high" | "critical";
  dependencies: string[];
  estimatedMinutes: number;
}

/** Roles validas para validacao */
const VALID_ROLES: ReadonlySet<string> = new Set<string>([
  "orchestrator", "pm", "architect", "frontend", "backend",
  "database", "qa", "security", "devops", "reviewer", "designer", "researcher",
]);

/** Aliases de roles que o LLM pode gerar */
const ROLE_ALIASES: Record<string, AgentRole> = {
  "ui-ux": "designer",
  "ux": "designer",
  "ui": "designer",
  "design": "designer",
  "uiux": "designer",
  "code-reviewer": "reviewer",
  "code_reviewer": "reviewer",
  "review": "reviewer",
  "teste": "qa",
  "test": "qa",
  "seg": "security",
  "infra": "devops",
  "ops": "devops",
  "db": "database",
  "front": "frontend",
  "back": "backend",
  "pesquisador": "researcher",
  "research": "researcher",
  "pesquisa": "researcher",
};

/** Prioridades validas */
const VALID_PRIORITIES: ReadonlySet<string> = new Set([
  "low", "medium", "high", "critical",
]);

/** Fases validas */
const VALID_PHASES: ReadonlySet<number> = new Set([0, 1, 2, 3, 4, 5]);

/**
 * Implementacao do TaskDecomposer que usa LLMGateway para chamar o LLM.
 * Produz tarefas organizadas em 5 fases sequenciais.
 */
export class LLMTaskDecomposer implements TaskDecomposer {
  constructor(private readonly gateway: LLMGateway) {}

  /**
   * Parseia tarefas de um texto ja recebido (sem chamar o CLI novamente).
   * Suporta o campo phase no JSON ou infere a fase a partir do role.
   */
  parseFromText(text: string): DecomposedTask[] {
    const subtasks = this.parseResponse(text);
    return this.buildPipeline(subtasks);
  }

  /**
   * Decompoe uma descricao de projeto em tarefas faseadas via LLM.
   */
  async decompose(description: string, availableRoles: AgentRole[]): Promise<DecomposedTask[]> {
    const systemPrompt = this.buildSystemPrompt(availableRoles);

    const response = await this.gateway.send({
      agentId: "orchestrator",
      messages: [
        { role: "user", content: description },
      ],
      model: "", // Gateway resolve via agentModelMap para "orchestrator"
      temperature: 0.3,
      maxTokens: 4096,
      systemPrompt,
      metadata: {},
    });

    const subtasks = this.parseResponse(response.content);
    return this.buildPipeline(subtasks);
  }

  /**
   * Constroi o system prompt instruindo o LLM a atribuir fases.
   * Todas as roles disponiveis sao incluidas — sem filtro de MVP.
   */
  private buildSystemPrompt(availableRoles: AgentRole[]): string {
    return `Voce e o Orquestrador do ForgeAI, uma fabrica de software autonoma.
Sua tarefa e decompor a descricao do usuario em subtarefas organizadas em FASES sequenciais.

Roles disponiveis: ${availableRoles.join(", ")}

## Pipeline de 5 Fases

As tarefas DEVEM ser organizadas nas seguintes fases:

### Fase 1 — PLANNING (pm)
O PM cria o PRD (Product Requirements Document) com:
- Requisitos funcionais e nao-funcionais
- Criterios de aceitacao claros e testáveis
- User stories priorizadas
- Escopo do MVP

### Fase 2 — ARCHITECTURE (architect)
O Architect recebe o PRD e cria:
- Estrutura do projeto (package.json, tsconfig.json, vite.config.ts, tailwind.config.ts, index.html, pastas)
- Documento de convencoes (stack, padroes de codigo, estrutura de arquivos)
- Checklist de revisao para o Code Reviewer usar na Fase 4
- Definicao de tipos e interfaces TypeScript compartilhadas

### Fase 3 — DEVELOPMENT (frontend, backend, database — em paralelo)
Os agentes de desenvolvimento recebem o output do Architect como contexto e trabalham em paralelo:
- **frontend**: Componentes React, paginas, estilos, hooks
- **backend**: Servicos, APIs, logica de negocio, estado
- **database**: Schemas, migrations, queries, seeds

### Fase 4 — QUALITY (qa, security, reviewer — em paralelo)
Os agentes de qualidade verificam o codigo produzido na Fase 3:
- **qa**: Escreve e executa testes (unit, integration, e2e)
- **security**: Faz scan de seguranca no codigo (vulnerabilidades, secrets expostos, dependencias)
- **reviewer**: Le os arquivos reais e faz code review baseado no checklist do Architect

### Fase 5 — DELIVERY (devops)
O DevOps cria configuracoes de build e deploy:
- Dockerfile, docker-compose
- CI/CD pipeline (GitHub Actions ou similar)
- Scripts de deploy e configuracao de ambiente

## Regras de Decomposicao

1. **Cada tarefa DEVE ter um campo "phase"** (1, 2, 3, 4 ou 5) correspondente a sua fase.
2. **Dependencies DEVEM referenciar tarefas de fases anteriores** pelo titulo.
   - Tarefas da Fase 2 dependem de tarefas da Fase 1.
   - Tarefas da Fase 3 dependem de tarefas da Fase 2.
   - Tarefas da Fase 4 dependem de tarefas da Fase 3.
   - Tarefas da Fase 5 dependem de tarefas da Fase 4.
   - Tarefas dentro da mesma fase podem depender umas das outras se necessario.
3. **assignedRole DEVE ser consistente com a fase** (veja mapeamento acima).
4. **Descricoes DETALHADAS**: Cada tarefa deve explicar exatamente quais arquivos criar e o que cada um deve conter.
5. **Stack padrao**: React 18 + TypeScript strict + Vite + Tailwind CSS. Imports relativos (nunca aliases).
6. **RESPEITE as instrucoes do usuario**: Se o usuario pedir "sem backend" ou "dados mock", NAO crie tarefas para backend. Se pedir "sem database", NAO crie tarefas para database. Atribua a criação de dados mock/services ao frontend.
7. **NAO force tarefas desnecessarias**: Só crie tarefas para roles que o projeto realmente precisa. Fases sem tarefas serao puladas automaticamente.

Responda APENAS com um array JSON valido. Cada objeto deve ter:
- "title": string (titulo curto da tarefa)
- "description": string (descricao DETALHADA)
- "assignedRole": string (uma das roles: ${availableRoles.join(", ")})
- "phase": number (1, 2, 3, 4 ou 5)
- "priority": "low" | "medium" | "high" | "critical"
- "dependencies": string[] (titulos das tarefas que precisam ser concluidas ANTES)
- "estimatedMinutes": number

Exemplo:
[
  {
    "title": "Criar PRD do projeto",
    "description": "Analisar a descricao do usuario e criar um PRD completo com: requisitos funcionais, requisitos nao-funcionais, criterios de aceitacao, user stories priorizadas e escopo do MVP.",
    "assignedRole": "pm",
    "phase": 1,
    "priority": "critical",
    "dependencies": [],
    "estimatedMinutes": 15
  },
  {
    "title": "Definir arquitetura e estrutura",
    "description": "Com base no PRD, criar package.json com dependencias, tsconfig.json strict, vite.config.ts, tailwind.config.ts, index.html, estrutura de pastas (src/components, src/pages, src/hooks, src/utils, src/types), documento de convencoes e checklist de revisao.",
    "assignedRole": "architect",
    "phase": 2,
    "priority": "critical",
    "dependencies": ["Criar PRD do projeto"],
    "estimatedMinutes": 20
  },
  {
    "title": "Implementar componentes frontend",
    "description": "Criar componentes React com TypeScript e Tailwind conforme a arquitetura definida...",
    "assignedRole": "frontend",
    "phase": 3,
    "priority": "high",
    "dependencies": ["Definir arquitetura e estrutura"],
    "estimatedMinutes": 30
  },
  {
    "title": "Executar testes e validacao",
    "description": "Escrever e executar testes unitarios e de integracao para todos os componentes e servicos...",
    "assignedRole": "qa",
    "phase": 4,
    "priority": "high",
    "dependencies": ["Implementar componentes frontend"],
    "estimatedMinutes": 20
  },
  {
    "title": "Configurar build e deploy",
    "description": "Criar Dockerfile, docker-compose.yml e pipeline CI/CD com GitHub Actions...",
    "assignedRole": "devops",
    "phase": 5,
    "priority": "medium",
    "dependencies": ["Executar testes e validacao"],
    "estimatedMinutes": 15
  }
]

IMPORTANTE: Responda SOMENTE o array JSON, sem texto adicional, sem markdown code blocks.`;
  }

  /**
   * Parseia a resposta do LLM tentando JSON primeiro, fallback para texto livre.
   */
  private parseResponse(content: string): ParsedSubtask[] {
    // Tenta extrair JSON do conteudo (pode vir com markdown code blocks)
    let jsonStr = content.trim();

    // Remove markdown code blocks se presentes
    const codeBlockMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (codeBlockMatch) {
      jsonStr = (codeBlockMatch[1] ?? "").trim();
    }

    // Tenta encontrar array JSON no conteudo
    const arrayMatch = jsonStr.match(/\[[\s\S]*\]/);
    if (arrayMatch) {
      jsonStr = arrayMatch[0];
    }

    try {
      const parsed: unknown = JSON.parse(jsonStr);
      if (!Array.isArray(parsed)) {
        console.warn("[TaskDecomposer] Resposta do LLM nao e um array, tentando extrair do texto.");
        return this.extractTasksFromText(content);
      }
      return parsed.map((item: unknown) => this.validateSubtask(item));
    } catch (error) {
      console.warn("[TaskDecomposer] Falha ao parsear JSON, tentando extrair tarefas do texto:", error);
      console.log("[TaskDecomposer] Conteudo recebido (primeiros 500 chars):", content.substring(0, 500));
      return this.extractTasksFromText(content);
    }
  }

  /**
   * Tenta extrair tarefas de texto livre quando o LLM nao responde com JSON.
   * Procura por padroes como listas numeradas ou bullets.
   * Infere a fase a partir do role detectado.
   */
  private extractTasksFromText(content: string): ParsedSubtask[] {
    const lines = content.split("\n").map((l) => l.trim()).filter((l) => l.length > 0);

    // Pattern para lista numerada com formato: "1. **Titulo** (role) — descricao"
    const richPattern = /^\d+[.)]\s+\*\*(.+?)\*\*\s*(?:\((\w+)\))?\s*(?:[—:/-]\s*(.+))?$/;
    // Pattern simples: "1. Titulo - descricao"
    const numberedPattern = /^\d+[.)]\s+(.+)/;
    // Bullets: "- Titulo: descricao"
    const bulletPattern = /^[-*]\s+(.+)/;

    const extracted: ParsedSubtask[] = [];

    for (const line of lines) {
      // IGNORA linhas que indicam tarefas já concluídas (✅, ✓, "já existe", "já criado")
      if (line.includes("✅") || line.includes("✓") || /j[aá]\s+(exist|cria|conclu|complet|pront)/i.test(line)) {
        continue;
      }
      // IGNORA linhas que são status/resumo, não tarefas
      if (line.startsWith("**Status") || line.startsWith("**✅") || line.startsWith("Como você")) {
        continue;
      }
      // IGNORA linhas que são perguntas (não são tarefas reais)
      if (/[?¿]/.test(line)) {
        continue;
      }
      // IGNORA linhas conversacionais (o LLM respondeu com status/ofertas em vez de plano)
      if (/^[-*]?\s*(Ajuda|Correção|Implementação|Testes|Rodar|Fazer|Me conte|O que|Ou algo|Você precisa|Como posso)/i.test(line)) {
        continue;
      }

      // Tenta primeiro o pattern rico (com markdown bold e role entre parênteses)
      const richMatch = line.match(richPattern);
      if (richMatch) {
        const title = (richMatch[1] ?? "").trim();
        const explicitRole = richMatch[2]?.trim().toLowerCase();
        const description = (richMatch[3] ?? title).trim();

        // Usa role explícito se presente, senão infere
        const resolvedRole = explicitRole ? (ROLE_ALIASES[explicitRole] ?? (VALID_ROLES.has(explicitRole) ? explicitRole : null)) : null;
        const role = resolvedRole
          ? resolvedRole as AgentRole
          : this.inferRoleFromText(title + " " + description);
        const phase = this.inferPhaseFromRole(role);

        extracted.push({
          title: title.substring(0, 100),
          description: description.substring(0, 500),
          assignedRole: role,
          phase,
          priority: phase <= 2 ? "critical" : "high",
          dependencies: extracted.length > 0 ? [extracted[extracted.length - 1]!.title] : [],
          estimatedMinutes: 15,
        });
        continue;
      }

      const numberedMatch = line.match(numberedPattern);
      const bulletMatch = line.match(bulletPattern);
      const matchContent = numberedMatch?.[1] ?? bulletMatch?.[1];

      if (matchContent) {
        // Strip markdown bold
        const cleaned = matchContent.replace(/\*\*/g, "");

        // Tenta separar titulo de descricao por "—", ":", " - "
        const separatorMatch = cleaned.match(/^(.+?)(?:\s*[—:]\s*|\s+-\s+)(.+)$/);
        const title = separatorMatch ? (separatorMatch[1] ?? cleaned) : cleaned;
        const description = separatorMatch ? (separatorMatch[2] ?? cleaned) : cleaned;

        // Checa se tem role explícito entre parênteses: "(architect)"
        const roleInParens = title.match(/\((\w+)\)\s*$/);
        const cleanTitle = title.replace(/\s*\(\w+\)\s*$/, "").trim();

        const explicitRole = roleInParens?.[1]?.toLowerCase();
        const role = (explicitRole && VALID_ROLES.has(explicitRole))
          ? explicitRole as AgentRole
          : this.inferRoleFromText(cleanTitle + " " + description);
        const phase = this.inferPhaseFromRole(role);

        extracted.push({
          title: cleanTitle.substring(0, 100),
          description: description.substring(0, 500),
          assignedRole: role,
          phase,
          priority: phase <= 2 ? "critical" : "high",
          dependencies: extracted.length > 0 ? [extracted[extracted.length - 1]!.title] : [],
          estimatedMinutes: 15,
        });
      }
    }

    if (extracted.length > 0) {
      console.log(`[TaskDecomposer] Extraiu ${extracted.length} tarefa(s) do texto livre.`);
      return extracted;
    }

    // Ultimo fallback: cria tarefa generica na fase de planejamento
    console.warn("[TaskDecomposer] Nao conseguiu extrair tarefas do texto, criando tarefa generica.");
    return [this.createFallbackTask(content)];
  }

  /**
   * Infere o role do agente a partir do conteudo textual da tarefa.
   */
  private inferRoleFromText(text: string): AgentRole {
    const lower = text.toLowerCase();

    // Fase 1 — Planning
    if (lower.includes("prd") || lower.includes("requisito") || lower.includes("requirement") || lower.includes("user stor") || lower.includes("aceitacao")) {
      return "pm";
    }
    // Fase 2 — Architecture
    if (lower.includes("setup") || lower.includes("config") || lower.includes("arquitetur") || lower.includes("estrutura") || lower.includes("package.json") || lower.includes("tsconfig") || lower.includes("convenc")) {
      return "architect";
    }
    // Fase 3 — Development
    if (lower.includes("frontend") || lower.includes("componente") || lower.includes("react") || lower.includes("ui") || lower.includes("pagina") || lower.includes("tela") || lower.includes("layout")) {
      return "frontend";
    }
    if (lower.includes("backend") || lower.includes("servidor") || lower.includes("endpoint")) {
      // Se mencionou "mock" junto com backend, é frontend que cria os mocks
      if (lower.includes("mock")) return "frontend";
      return "backend";
    }
    if ((lower.includes("api") || lower.includes("servico")) && !lower.includes("mock")) {
      return "backend";
    }
    if (lower.includes("banco") || lower.includes("database") || lower.includes("migration") || lower.includes("schema") || lower.includes("tabela")) {
      return "database";
    }
    // Fase 4 — Quality
    if (lower.includes("teste") || lower.includes("test") || lower.includes("qa")) {
      return "qa";
    }
    if (lower.includes("seguranca") || lower.includes("security") || lower.includes("vulnerab") || lower.includes("scan")) {
      return "security";
    }
    if (lower.includes("review") || lower.includes("revisao") || lower.includes("code review")) {
      return "reviewer";
    }
    if (lower.includes("ui/ux") || lower.includes("ui ux") || lower.includes("design") || lower.includes("usabilidade") || lower.includes("acessibilidade")) {
      return "designer";
    }
    // Fase 5 — Delivery
    if (lower.includes("deploy") || lower.includes("docker") || lower.includes("ci/cd") || lower.includes("devops") || lower.includes("pipeline")) {
      return "devops";
    }
    // Tipos/interfaces/modelos → architect (define contratos), não backend
    if (lower.includes("tipo") || lower.includes("type") || lower.includes("interface") || lower.includes("modelo")) {
      return "architect";
    }

    return "frontend";
  }

  /**
   * Infere a fase a partir do role do agente.
   */
  private inferPhaseFromRole(role: AgentRole): PhaseNumber {
    return ROLE_TO_PHASE[role] ?? 3;
  }

  /**
   * Valida e normaliza uma subtarefa do JSON parseado.
   * Garante que phase e role sao consistentes.
   */
  private validateSubtask(item: unknown): ParsedSubtask {
    const obj = item as Record<string, unknown>;

    const role = String(obj.assignedRole ?? "backend");
    const priority = String(obj.priority ?? "medium");
    const deps = Array.isArray(obj.dependencies) ? obj.dependencies.map(String) : [];

    // Valida phase — se nao veio ou e invalida, infere a partir do role
    const rawPhase = typeof obj.phase === "number" ? obj.phase : 0;
    const validatedRole = (VALID_ROLES.has(role) ? role : "backend") as AgentRole;
    const phase: PhaseNumber = VALID_PHASES.has(rawPhase)
      ? rawPhase as PhaseNumber
      : this.inferPhaseFromRole(validatedRole);

    return {
      title: String(obj.title ?? "Tarefa sem titulo"),
      description: String(obj.description ?? ""),
      assignedRole: validatedRole,
      phase,
      priority: (VALID_PRIORITIES.has(priority) ? priority : "medium") as ParsedSubtask["priority"],
      dependencies: deps,
      estimatedMinutes: typeof obj.estimatedMinutes === "number" ? obj.estimatedMinutes : 30,
    };
  }

  /**
   * Cria tarefa generica de fallback quando nenhuma extracao funciona.
   */
  private createFallbackTask(content: string): ParsedSubtask {
    return {
      title: "Criar PRD da solicitacao",
      description: content.substring(0, 500),
      assignedRole: "pm",
      phase: 1,
      priority: "critical",
      dependencies: [],
      estimatedMinutes: 15,
    };
  }

  /**
   * Constroi o pipeline faseado a partir das subtarefas parseadas.
   * Resolve dependencias entre fases: tarefas de uma fase dependem
   * de todas as tarefas da fase anterior (se nao tiverem deps explicitas cross-fase).
   */
  private buildPipeline(subtasks: ParsedSubtask[]): DecomposedTask[] {
    // Gera IDs e monta mapa titulo → id
    const titleToId = new Map<string, string>();
    const taskEntries: Array<{ subtask: ParsedSubtask; id: string }> = [];

    // Ordena por fase para garantir IDs consistentes
    const sorted = [...subtasks].sort((a, b) => a.phase - b.phase);

    sorted.forEach((subtask) => {
      const id = crypto.randomUUID();
      titleToId.set(subtask.title, id);
      taskEntries.push({ subtask, id });
    });

    // Agrupa tarefas por fase para resolver dependencias implicitas
    const tasksByPhase = new Map<PhaseNumber, Array<{ subtask: ParsedSubtask; id: string }>>();
    for (const entry of taskEntries) {
      const phaseList = tasksByPhase.get(entry.subtask.phase) ?? [];
      phaseList.push(entry);
      tasksByPhase.set(entry.subtask.phase, phaseList);
    }

    // Constroi DecomposedTask[] com dependencias resolvidas
    return taskEntries.map(({ subtask, id }) => {
      // Resolve dependencias explicitas (titulo → id)
      const resolvedDeps: string[] = [];
      for (const depTitle of subtask.dependencies) {
        const depId = titleToId.get(depTitle);
        if (depId) {
          resolvedDeps.push(depId);
        }
      }

      // Se a tarefa nao tem dependencias explicitas de fases anteriores,
      // adiciona dependencia implicita em TODAS as tarefas da fase anterior.
      const previousPhase = (subtask.phase - 1) as PhaseNumber;
      if (previousPhase >= 1) {
        const prevPhaseTasks = tasksByPhase.get(previousPhase) ?? [];
        const hasCrossPhaseDep = resolvedDeps.some((depId) => {
          const depEntry = taskEntries.find((e) => e.id === depId);
          return depEntry && depEntry.subtask.phase < subtask.phase;
        });

        // Adiciona deps implicitas apenas se nao ha dependencias cross-fase explicitas
        if (!hasCrossPhaseDep && prevPhaseTasks.length > 0) {
          for (const prevTask of prevPhaseTasks) {
            if (!resolvedDeps.includes(prevTask.id)) {
              resolvedDeps.push(prevTask.id);
            }
          }
        }
      }

      return {
        id,
        description: `[Fase ${subtask.phase} - ${PHASE_NAMES[subtask.phase]}] [${subtask.title}] ${subtask.description}`,
        targetRole: subtask.assignedRole,
        priority: subtask.priority,
        dependencies: resolvedDeps,
        estimatedMinutes: subtask.estimatedMinutes,
        phase: subtask.phase,
        metadata: {
          title: subtask.title,
          phase: String(subtask.phase),
          phaseName: PHASE_NAMES[subtask.phase],
          originalDependencies: subtask.dependencies.join(","),
        },
      };
    });
  }
}
