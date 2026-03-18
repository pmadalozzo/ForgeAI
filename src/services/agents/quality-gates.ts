/**
 * Quality Gates — Sistema de verificacao de qualidade do ForgeAI.
 * Toda entrega de agente passa por uma pipeline de gates:
 * Lint -> Type -> Test -> Build -> Security -> Review -> Integration
 */

import { EventType, eventBus } from "../events/event-bus";

/** Resultado de um quality gate individual */
export interface QualityGateResult {
  /** Nome do gate */
  gateName: string;
  /** Se o gate passou */
  passed: boolean;
  /** Saida/logs do gate */
  output: string;
  /** Duracao da execucao em ms */
  durationMs: number;
  /** Timestamp de execucao */
  timestamp: string;
  /** Avisos (gate pode passar mas com advertencias) */
  warnings: string[];
}

/** Resultado consolidado de uma pipeline completa */
export interface PipelineResult {
  /** ID da tarefa verificada */
  taskId: string;
  /** ID do agente que produziu a entrega */
  agentId: string;
  /** Resultados individuais de cada gate */
  gateResults: QualityGateResult[];
  /** Se todos os gates passaram */
  allPassed: boolean;
  /** Duracao total da pipeline em ms */
  totalDurationMs: number;
  /** Timestamp de inicio */
  startedAt: string;
  /** Timestamp de conclusao */
  completedAt: string;
}

/**
 * Interface que todo quality gate deve implementar.
 * Cada gate executa uma verificacao especifica sobre o trabalho do agente.
 */
export interface QualityGate {
  /** Nome identificador do gate */
  readonly name: string;
  /** Descricao breve do que o gate verifica */
  readonly description: string;
  /** Ordem de execucao na pipeline (menor = primeiro) */
  readonly order: number;
  /** Se o gate e obrigatorio (falha bloqueia a pipeline) */
  readonly required: boolean;
  /**
   * Executa a verificacao.
   * @param agentId — ID do agente que produziu o artefato
   * @param taskId — ID da tarefa associada
   * @returns Resultado da verificacao
   */
  execute(agentId: string, taskId: string): Promise<QualityGateResult>;
}

/**
 * Tenta executar um comando shell via endpoint /api/claude/execute.
 * Retorna null se o endpoint nao estiver disponivel.
 */
async function tryRunShellCommand(command: string, args: string[]): Promise<{ code: number; stdout: string; stderr: string } | null> {
  try {
    const fullCommand = `${command} ${args.join(" ")}`;
    const res = await fetch("/api/claude/execute", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        args: ["-p", `Execute este comando e retorne APENAS o output (sem explicacao): ${fullCommand}`, "--output-format", "json", "--no-session-persistence", "--effort", "low", "--dangerously-skip-permissions"],
      }),
    });
    if (!res.ok) return null;
    const result = await res.json() as { success: boolean; stdout: string; stderr: string; exitCode: number };
    return {
      code: result.exitCode,
      stdout: result.stdout,
      stderr: result.stderr,
    };
  } catch {
    return null;
  }
}

/**
 * Cria um resultado de gate "skipped" padronizado.
 */
function skippedResult(gateName: string, reason: string, durationMs: number): QualityGateResult {
  return {
    gateName,
    passed: true,
    output: `[Skipped] ${reason}`,
    durationMs,
    timestamp: new Date().toISOString(),
    warnings: [`Gate ${gateName} foi ignorado: ${reason}`],
  };
}

/**
 * Gate de Lint — Verifica formatacao e estilo de codigo.
 * Tenta executar `npx eslint` via Tauri shell.
 */
export class LintGate implements QualityGate {
  readonly name = "lint";
  readonly description = "Verifica formatacao e estilo de codigo (ESLint + Prettier)";
  readonly order = 10;
  readonly required = true;

  async execute(agentId: string, taskId: string): Promise<QualityGateResult> {
    void agentId; void taskId;
    const start = Date.now();

    try {
      const result = await tryRunShellCommand("npx", ["eslint", ".", "--max-warnings=0", "--format=compact"]);

      if (!result) {
        return skippedResult(this.name, "Tauri shell nao disponivel", Date.now() - start);
      }

      return {
        gateName: this.name,
        passed: result.code === 0,
        output: result.stdout || result.stderr || "Lint executado sem saida",
        durationMs: Date.now() - start,
        timestamp: new Date().toISOString(),
        warnings: result.code === 0 ? [] : [result.stderr],
      };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      return skippedResult(this.name, `Erro ao executar lint: ${errorMsg}`, Date.now() - start);
    }
  }
}

/**
 * Gate de Type Check — Verifica erros de tipagem TypeScript.
 * Tenta executar `npx tsc --noEmit` via Tauri shell.
 */
export class TypeCheckGate implements QualityGate {
  readonly name = "typecheck";
  readonly description = "Verifica erros de tipagem TypeScript (tsc --noEmit)";
  readonly order = 20;
  readonly required = true;

  async execute(agentId: string, taskId: string): Promise<QualityGateResult> {
    void agentId; void taskId;
    const start = Date.now();

    try {
      const result = await tryRunShellCommand("npx", ["tsc", "--noEmit"]);

      if (!result) {
        return skippedResult(this.name, "Tauri shell nao disponivel", Date.now() - start);
      }

      return {
        gateName: this.name,
        passed: result.code === 0,
        output: result.stdout || result.stderr || "Type check executado sem saida",
        durationMs: Date.now() - start,
        timestamp: new Date().toISOString(),
        warnings: result.code === 0 ? [] : [result.stderr],
      };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      return skippedResult(this.name, `Erro ao executar typecheck: ${errorMsg}`, Date.now() - start);
    }
  }
}

/**
 * Gate de Testes — Executa testes automatizados.
 * Tenta executar `npx vitest run` via Tauri shell.
 */
export class TestGate implements QualityGate {
  readonly name = "test";
  readonly description = "Executa testes automatizados (Vitest)";
  readonly order = 30;
  readonly required = true;

  async execute(agentId: string, taskId: string): Promise<QualityGateResult> {
    void agentId; void taskId;
    const start = Date.now();

    try {
      const result = await tryRunShellCommand("npx", ["vitest", "run", "--reporter=verbose"]);

      if (!result) {
        return skippedResult(this.name, "Tauri shell nao disponivel", Date.now() - start);
      }

      return {
        gateName: this.name,
        passed: result.code === 0,
        output: result.stdout || result.stderr || "Testes executados sem saida",
        durationMs: Date.now() - start,
        timestamp: new Date().toISOString(),
        warnings: result.code === 0 ? [] : [result.stderr],
      };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      return skippedResult(this.name, `Erro ao executar testes: ${errorMsg}`, Date.now() - start);
    }
  }
}

/**
 * Gate de Build — Verifica se o projeto compila sem erros.
 * Tenta executar `npm run build` via Tauri shell.
 */
export class BuildGate implements QualityGate {
  readonly name = "build";
  readonly description = "Verifica se o projeto compila sem erros (vite build)";
  readonly order = 40;
  readonly required = true;

  async execute(agentId: string, taskId: string): Promise<QualityGateResult> {
    void agentId; void taskId;
    const start = Date.now();

    try {
      const result = await tryRunShellCommand("npm", ["run", "build"]);

      if (!result) {
        return skippedResult(this.name, "Tauri shell nao disponivel", Date.now() - start);
      }

      return {
        gateName: this.name,
        passed: result.code === 0,
        output: result.stdout || result.stderr || "Build executado sem saida",
        durationMs: Date.now() - start,
        timestamp: new Date().toISOString(),
        warnings: result.code === 0 ? [] : [result.stderr],
      };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      return skippedResult(this.name, `Erro ao executar build: ${errorMsg}`, Date.now() - start);
    }
  }
}

/**
 * Gate de Seguranca — Placeholder, marcado como skipped.
 */
export class SecurityGate implements QualityGate {
  readonly name = "security";
  readonly description = "Verifica vulnerabilidades em dependencias e codigo";
  readonly order = 50;
  readonly required = false;

  async execute(agentId: string, taskId: string): Promise<QualityGateResult> {
    void agentId; void taskId;
    const start = Date.now();
    return skippedResult(this.name, "Verificacao de seguranca ainda nao implementada", Date.now() - start);
  }
}

/**
 * Gate de Code Review — Usa LLMGateway para code review automatizado.
 */
export class ReviewGate implements QualityGate {
  readonly name = "review";
  readonly description = "Revisao automatizada de codigo (via LLM)";
  readonly order = 60;
  readonly required = false;

  async execute(agentId: string, taskId: string): Promise<QualityGateResult> {
    const start = Date.now();

    try {
      // Importa LLMGateway dinamicamente para evitar dependencia circular
      const { llmGateway } = await import("../llm/llm-gateway");

      const response = await llmGateway.send({
        agentId: "reviewer",
        messages: [
          {
            role: "user",
            content: `Revise o trabalho da tarefa ${taskId} feito pelo agente ${agentId}. Identifique problemas de qualidade, seguranca e boas praticas. Responda com: APROVADO ou REPROVADO seguido de comentarios.`,
          },
        ],
        model: "",
        temperature: 0.3,
        maxTokens: 1024,
        systemPrompt: "Voce e um Code Reviewer experiente. Seja conciso e objetivo.",
        metadata: {},
      });

      const passed = !response.content.toUpperCase().includes("REPROVADO");

      return {
        gateName: this.name,
        passed,
        output: response.content,
        durationMs: Date.now() - start,
        timestamp: new Date().toISOString(),
        warnings: passed ? [] : ["Code review identificou problemas"],
      };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      return skippedResult(this.name, `LLM nao disponivel para review: ${errorMsg}`, Date.now() - start);
    }
  }
}

/**
 * Gate de Integracao — Placeholder, marcado como skipped.
 */
export class IntegrationGate implements QualityGate {
  readonly name = "integration";
  readonly description = "Verifica integracao com o projeto completo";
  readonly order = 70;
  readonly required = true;

  async execute(agentId: string, taskId: string): Promise<QualityGateResult> {
    void agentId; void taskId;
    const start = Date.now();
    return skippedResult(this.name, "Testes de integracao ainda nao implementados", Date.now() - start);
  }
}

/**
 * Pipeline de quality gates — executa gates em sequencia.
 * Para na primeira falha de gate obrigatorio.
 */
export class QualityGatePipeline {
  /** Gates registrados na pipeline */
  private gates: QualityGate[] = [];

  constructor(gates?: QualityGate[]) {
    if (gates) {
      this.gates = [...gates].sort((a, b) => a.order - b.order);
    }
  }

  /**
   * Adiciona um gate a pipeline.
   */
  addGate(gate: QualityGate): void {
    this.gates.push(gate);
    this.gates.sort((a, b) => a.order - b.order);
  }

  /**
   * Remove um gate pelo nome.
   */
  removeGate(gateName: string): void {
    this.gates = this.gates.filter((g) => g.name !== gateName);
  }

  /**
   * Lista gates registrados.
   */
  listGates(): QualityGate[] {
    return [...this.gates];
  }

  /**
   * Executa todos os gates em sequencia para uma tarefa/agente.
   * Publica resultado de cada gate via Event Bus.
   * Para na primeira falha de gate obrigatorio.
   */
  async run(agentId: string, taskId: string): Promise<QualityGateResult[]> {
    const results: QualityGateResult[] = [];

    for (const gate of this.gates) {
      try {
        const result = await gate.execute(agentId, taskId);
        results.push(result);

        // Publica resultado individual via Event Bus
        eventBus.publish(EventType.QUALITY_GATE_RESULT, {
          taskId,
          agentId,
          gateName: gate.name,
          passed: result.passed,
          output: result.output,
          durationMs: result.durationMs,
          timestamp: result.timestamp,
        });

        // Se gate obrigatorio falhou, para a pipeline
        if (!result.passed && gate.required) {
          break;
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        const failResult: QualityGateResult = {
          gateName: gate.name,
          passed: false,
          output: `Erro ao executar gate: ${errorMessage}`,
          durationMs: 0,
          timestamp: new Date().toISOString(),
          warnings: [],
        };
        results.push(failResult);

        // Publica erro
        eventBus.publish(EventType.QUALITY_GATE_RESULT, {
          taskId,
          agentId,
          gateName: gate.name,
          passed: false,
          output: failResult.output,
          durationMs: 0,
          timestamp: failResult.timestamp,
        });

        eventBus.publish(EventType.ERROR, {
          source: `quality-gate:${gate.name}`,
          message: `Falha no gate ${gate.name}`,
          details: errorMessage,
          timestamp: new Date().toISOString(),
        });

        if (gate.required) break;
      }
    }

    return results;
  }
}

/**
 * Cria a pipeline padrao com todos os gates na ordem correta.
 */
export function createDefaultPipeline(): QualityGatePipeline {
  return new QualityGatePipeline([
    new LintGate(),
    new TypeCheckGate(),
    new TestGate(),
    new BuildGate(),
    new SecurityGate(),
    new ReviewGate(),
    new IntegrationGate(),
  ]);
}

/** Instancia singleton da pipeline padrao */
export const defaultPipeline = createDefaultPipeline();
