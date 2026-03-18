/**
 * Project Files Reader — Servico para leitura de arquivos reais do projeto.
 * Usado pelos agentes Reviewer, QA e Security para inspecionar codigo-fonte
 * em vez de revisar apenas texto de saida do chat.
 *
 * Usa o endpoint /api/claude/execute para executar comandos via Claude CLI.
 */

/** Informacoes basicas de um arquivo do projeto */
export interface FileInfo {
  path: string;
  sizeBytes: number;
  modifiedAt: string;
}

/** Conteudo lido de um arquivo do projeto */
export interface FileContent {
  path: string;
  content: string;
  language: string;
}

/** Resultado bruto do /api/claude/execute */
interface CliExecuteResult {
  success: boolean;
  stdout: string;
  stderr: string;
  exitCode: number;
}

/** Resultado JSON retornado pelo Claude CLI */
interface ClaudeJsonOutput {
  type?: string;
  result?: string;
}

/** Diretorios e padroes ignorados na leitura de arquivos */
const IGNORED_DIRS: ReadonlyArray<string> = [
  "node_modules", "dist", ".git", ".next", "build", "coverage",
  ".turbo", ".cache", "__pycache__", ".svelte-kit",
];

/** Extensoes de arquivo priorizadas para revisao (usado por listRecentFiles) */
const _PRIORITY_EXTENSIONS: ReadonlyArray<string> = [
  ".ts", ".tsx",
];
void _PRIORITY_EXTENSIONS;

/** Extensoes validas para leitura (todas que interessam aos agentes) */
const VALID_EXTENSIONS: ReadonlyArray<string> = [
  ".ts", ".tsx", ".js", ".jsx", ".vue", ".svelte",
  ".css", ".scss", ".html", ".json", ".yaml", ".yml",
  ".sql", ".graphql", ".prisma", ".env.example",
];

/** Limite maximo de caracteres para o summary formatado */
const SUMMARY_MAX_CHARS = 8000;

/** Limite maximo de tamanho de arquivo individual para leitura (50KB) */
const MAX_FILE_SIZE_BYTES = 50_000;

/**
 * Executa um prompt no Claude CLI via endpoint local.
 * Retorna o texto de resposta ou null em caso de falha.
 */
async function executeCliPrompt(prompt: string, cwd?: string): Promise<string | null> {
  try {
    const response = await fetch("/api/claude/execute", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        args: [
          "-p", prompt,
          "--output-format", "json",
          "--no-session-persistence",
          "--effort", "low",
          "--dangerously-skip-permissions",
        ],
        cwd,
      }),
    });

    if (!response.ok) {
      console.warn(`[ProjectFilesReader] CLI retornou HTTP ${response.status}`);
      return null;
    }

    const result = await response.json() as CliExecuteResult;

    if (!result.success) {
      console.warn(`[ProjectFilesReader] CLI falhou: ${result.stderr}`);
      return null;
    }

    // Tenta parsear JSON do Claude CLI para extrair o campo result
    try {
      const parsed = JSON.parse(result.stdout) as ClaudeJsonOutput;
      return parsed.result ?? result.stdout;
    } catch {
      return result.stdout;
    }
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error(`[ProjectFilesReader] Erro ao executar CLI: ${msg}`);
    return null;
  }
}

/**
 * Detecta a linguagem de um arquivo com base na extensao.
 */
function detectLanguage(filePath: string): string {
  const ext = filePath.slice(filePath.lastIndexOf(".")).toLowerCase();
  const langMap: Record<string, string> = {
    ".ts": "typescript",
    ".tsx": "tsx",
    ".js": "javascript",
    ".jsx": "jsx",
    ".vue": "vue",
    ".svelte": "svelte",
    ".css": "css",
    ".scss": "scss",
    ".html": "html",
    ".json": "json",
    ".yaml": "yaml",
    ".yml": "yaml",
    ".sql": "sql",
    ".graphql": "graphql",
    ".prisma": "prisma",
    ".py": "python",
    ".rs": "rust",
    ".go": "go",
  };
  return langMap[ext] ?? "plaintext";
}

/**
 * Verifica se o caminho deve ser ignorado (contem diretorio excluido).
 */
function shouldIgnorePath(filePath: string): boolean {
  const normalized = filePath.replace(/\\/g, "/");
  return IGNORED_DIRS.some((dir) => normalized.includes(`/${dir}/`) || normalized.startsWith(`${dir}/`));
}

/**
 * Lista arquivos modificados nos ultimos N milissegundos no diretorio do projeto.
 * Usa o CLI para executar um comando find com filtro por tempo de modificacao.
 *
 * @param projectPath — Caminho absoluto do diretorio do projeto
 * @param sinceMs — Janela de tempo em milissegundos (ex: 300000 para 5 minutos)
 * @returns Lista de arquivos com informacoes basicas
 */
export async function listRecentFiles(projectPath: string, sinceMs: number): Promise<FileInfo[]> {
  const sinceMinutes = Math.max(1, Math.ceil(sinceMs / 60_000));
  const ignoreDirs = IGNORED_DIRS.map((d) => `-not -path '*/${d}/*'`).join(" ");
  const extFilter = VALID_EXTENSIONS.map((e) => `-name '*${e}'`).join(" -o ");

  const prompt = `Execute este comando e retorne APENAS o output raw (sem explicacao, sem markdown):
find "${projectPath}" -type f \\( ${extFilter} \\) -mmin -${sinceMinutes} ${ignoreDirs} -printf '%p\\t%s\\t%T@\\n' 2>/dev/null | sort -t$'\\t' -k3 -rn`;

  const output = await executeCliPrompt(prompt, projectPath);

  if (!output || output.trim().length === 0) {
    return [];
  }

  const files: FileInfo[] = [];

  for (const line of output.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    // Formato esperado: path\tsize\ttimestamp
    const parts = trimmed.split("\t");
    if (parts.length >= 3) {
      const filePath = parts[0] ?? "";
      const sizeBytes = parseInt(parts[1] ?? "0", 10);
      const timestamp = parseFloat(parts[2] ?? "0");

      if (filePath && !isNaN(sizeBytes) && !isNaN(timestamp) && !shouldIgnorePath(filePath)) {
        files.push({
          path: filePath,
          sizeBytes,
          modifiedAt: new Date(timestamp * 1000).toISOString(),
        });
      }
    } else {
      // Fallback: linha pode ser apenas um caminho de arquivo
      if (trimmed.startsWith("/") || trimmed.match(/^[A-Za-z]:\\/)) {
        files.push({
          path: trimmed,
          sizeBytes: 0,
          modifiedAt: new Date().toISOString(),
        });
      }
    }
  }

  return files;
}

/**
 * Le o conteudo de arquivos especificos do projeto via CLI.
 *
 * @param projectPath — Caminho absoluto do diretorio do projeto
 * @param filePaths — Lista de caminhos de arquivos para ler
 * @returns Conteudo de cada arquivo com deteccao de linguagem
 */
export async function readProjectFiles(projectPath: string, filePaths: string[]): Promise<FileContent[]> {
  if (filePaths.length === 0) return [];

  // Limita a quantidade de arquivos por chamada para nao estourar o prompt
  const maxFiles = 15;
  const selectedPaths = filePaths.slice(0, maxFiles);

  // Monta comando cat com separadores claros entre arquivos
  const catCommands = selectedPaths.map(
    (fp) => `echo "===FILE:${fp}===" && cat "${fp}" 2>/dev/null || echo "[ERRO: arquivo nao encontrado]"`
  ).join(" && ");

  const prompt = `Execute este comando e retorne APENAS o output raw (sem explicacao, sem markdown):
${catCommands}`;

  const output = await executeCliPrompt(prompt, projectPath);

  if (!output) return [];

  // Parseia o output separado por marcadores ===FILE:path===
  const results: FileContent[] = [];
  const sections = output.split(/===FILE:(.+?)===/);

  // sections alterna: [preambulo, path1, content1, path2, content2, ...]
  for (let i = 1; i < sections.length; i += 2) {
    const path = (sections[i] ?? "").trim();
    const content = (sections[i + 1] ?? "").trim();

    if (path && content && !content.startsWith("[ERRO:")) {
      // Trunca arquivos muito grandes
      const truncated = content.length > MAX_FILE_SIZE_BYTES
        ? content.slice(0, MAX_FILE_SIZE_BYTES) + "\n\n// ... [truncado: arquivo muito grande]"
        : content;

      results.push({
        path,
        content: truncated,
        language: detectLanguage(path),
      });
    }
  }

  return results;
}

/**
 * Retorna um resumo formatado dos arquivos do projeto (src/) e seus conteudos.
 * Projetado para ser injetado diretamente no prompt de agentes revisores.
 *
 * Usa o Claude CLI para listar e ler — funciona em Windows e Linux.
 * Prioriza arquivos .ts e .tsx. Ignora node_modules, dist, .git.
 * Limita o output total a 8000 caracteres.
 *
 * @param projectPath — Caminho absoluto do diretorio do projeto
 * @returns Texto formatado com blocos de codigo dos arquivos do projeto
 */
export async function getChangedFilesSummary(projectPath: string): Promise<string> {
  // Lê arquivos do projeto via endpoint direto do Vite (sem CLI).
  // O CLI respondia com garbage conversacional em vez de listar arquivos.
  try {
    const response = await fetch("/api/project/files", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ projectPath, maxFiles: 10 }),
    });

    if (!response.ok) {
      console.warn(`[ProjectFilesReader] /api/project/files retornou HTTP ${response.status}`);
      return "";
    }

    const data = await response.json() as {
      files: Array<{ path: string; content: string; language: string }>;
      error?: string;
    };

    if (!data.files || data.files.length === 0) {
      console.warn(`[ProjectFilesReader] Nenhum arquivo encontrado em ${projectPath}/src/`);
      return "";
    }

    // Formata como blocos de codigo para injetar no prompt dos revisores
    // Trunca arquivos grandes para caber no limite total
    const MAX_PER_FILE = 2000; // chars por arquivo
    let summary = "";
    for (const file of data.files) {
      const truncatedContent = file.content.length > MAX_PER_FILE
        ? file.content.substring(0, MAX_PER_FILE) + "\n// ... [truncado]"
        : file.content;
      const block = `### ${file.path}\n\`\`\`${file.language}\n${truncatedContent}\n\`\`\`\n\n`;
      if (summary.length + block.length > SUMMARY_MAX_CHARS) break;
      summary += block;
    }

    console.log(`[ProjectFilesReader] ${data.files.length} arquivos lidos, ${summary.length} chars de summary`);
    return summary;
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error(`[ProjectFilesReader] Erro ao ler arquivos: ${msg}`);
    return "";
  }
}
