import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import fs from "fs";
import os from "os";
import { spawn, execSync, execFile } from "child_process";
import type { ChildProcess } from "child_process";
import type { Plugin } from "vite";
import type { IncomingMessage, ServerResponse } from "http";
import { chromium } from "playwright";

/** Map de processos Claude ativos, chave = timestamp de criação */
const activeProcesses = new Map<string, ChildProcess>();

/**
 * Plugin Vite que expõe todos os endpoints backend necessários.
 * Tudo roda dentro do processo do Vite — basta `npm run dev`.
 *
 * Endpoints:
 * - GET  /api/claude-oauth       → credenciais OAuth do Claude Code CLI
 * - POST /api/claude/execute     → executa o claude CLI e retorna resultado
 * - GET  /api/claude/version     → verifica se o claude CLI está instalado
 * - POST /api/claude/install     → instala o claude CLI via npm
 * - POST /api/claude/abort       → mata todos os processos claude em andamento
 * - GET  /api/env/:name          → lê variável de ambiente
 */
function forgeApiPlugin(): Plugin {
  return {
    name: "forge-api",
    configureServer(server) {
      // Helper: lê body de POST request
      function readBody(req: IncomingMessage): Promise<string> {
        return new Promise((resolve, reject) => {
          let data = "";
          req.on("data", (chunk: Buffer) => { data += chunk.toString(); });
          req.on("end", () => resolve(data));
          req.on("error", reject);
        });
      }

      // Helper: responde JSON
      function json(res: ServerResponse, data: unknown, status = 200): void {
        res.writeHead(status, {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type",
        });
        res.end(JSON.stringify(data));
      }

      // CORS preflight
      server.middlewares.use((req, res, next) => {
        if (req.method === "OPTIONS" && req.url?.startsWith("/api/")) {
          res.writeHead(204, {
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type",
          });
          res.end();
          return;
        }
        next();
      });

      // ── GET /api/claude-oauth ─────────────────────────────────────────
      server.middlewares.use("/api/claude-oauth", (_req, res) => {
        try {
          const credPath = path.join(os.homedir(), ".claude", ".credentials.json");
          if (!fs.existsSync(credPath)) {
            json(res, {
              authenticated: false, accessToken: null, subscriptionType: null, scopes: [],
              error: "Credenciais do Claude Code não encontradas. Execute 'claude' no terminal primeiro.",
            });
            return;
          }

          const content = fs.readFileSync(credPath, "utf-8");
          const data = JSON.parse(content) as Record<string, unknown>;
          const oauth = data.claudeAiOauth as Record<string, unknown> | undefined;

          if (!oauth || !oauth.accessToken) {
            json(res, {
              authenticated: false, accessToken: null, subscriptionType: null, scopes: [],
              error: "Token OAuth não encontrado nas credenciais.",
            });
            return;
          }

          json(res, {
            authenticated: true,
            accessToken: oauth.accessToken,
            subscriptionType: oauth.subscriptionType ?? null,
            scopes: (oauth.scopes as string[]) ?? [],
            error: null,
          });
        } catch (err) {
          json(res, {
            authenticated: false, accessToken: null, subscriptionType: null, scopes: [],
            error: `Erro: ${err instanceof Error ? err.message : String(err)}`,
          });
        }
      });

      // ── POST /api/claude/execute ──────────────────────────────────────
      server.middlewares.use("/api/claude/execute", async (req, res) => {
        if (req.method !== "POST") { json(res, { error: "Use POST" }, 405); return; }

        try {
          const body = JSON.parse(await readBody(req)) as { args: string[]; cwd?: string };
          const args = body.args ?? [];
          const cwd = body.cwd ?? undefined;

          // Diagnóstico: mostra CWD recebido do browser
          if (!cwd) {
            console.warn(`[forge-api] ⚠️ CWD NÃO RECEBIDO — agente vai rodar sem diretório de projeto`);
          }

          const startMs = Date.now();
          // Mostra args relevantes (oculta conteúdo longo de -p e --system-prompt)
          const logArgs = args.map((a, i) => {
            const prev = i > 0 ? args[i - 1] : "";
            if (prev === "-p" || prev === "--system-prompt" || prev === "--append-system-prompt") {
              return a.length > 60 ? a.substring(0, 60) + `...(${a.length}ch)` : a;
            }
            return a;
          });
          console.log(`[forge-api] claude ${logArgs.join(" ")} (cwd: ${cwd ?? "default"})`);

          const procId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

          const result = await new Promise<{ success: boolean; stdout: string; stderr: string; exitCode: number }>((resolve) => {
            // shell: false — passa args diretamente ao processo sem interpretação do shell.
            // Com shell: true no Windows, argumentos com newlines/aspas/chars especiais
            // são corrompidos, fazendo o CLI receber prompts vazios e responder "empty message".
            const proc = spawn("claude", args, {
              stdio: ["ignore", "pipe", "pipe"],
              env: { ...process.env },
              cwd: cwd ?? undefined,
              windowsHide: true,
            });

            activeProcesses.set(procId, proc);

            let stdout = "";
            let stderr = "";
            const timer = setTimeout(() => { proc.kill(); resolve({ success: false, stdout, stderr: "Timeout (10min)", exitCode: -1 }); }, 600_000);

            proc.stdout.on("data", (chunk: Buffer) => {
              stdout += chunk.toString();
              const elapsed = ((Date.now() - startMs) / 1000).toFixed(1);
              console.log(`[forge-api] claude stdout parcial (+${chunk.length} bytes, ${elapsed}s total)`);
            });
            proc.stderr.on("data", (chunk: Buffer) => {
              stderr += chunk.toString();
              const elapsed = ((Date.now() - startMs) / 1000).toFixed(1);
              console.log(`[forge-api] claude stderr parcial (+${chunk.length} bytes, ${elapsed}s total)`);
            });

            proc.on("close", (code) => {
              clearTimeout(timer);
              activeProcesses.delete(procId);
              const elapsed = Date.now() - startMs;
              console.log(`[forge-api] claude finalizado (code=${code}) em ${elapsed}ms — stdout: ${stdout.length} chars, stderr: ${stderr.length} chars`);
              if (code !== 0) {
                console.log(`[forge-api] ERRO stdout: ${stdout.slice(0, 500)}`);
                console.log(`[forge-api] ERRO stderr: ${stderr.slice(0, 500)}`);
              }
              resolve({ success: code === 0, stdout, stderr, exitCode: code ?? -1 });
            });

            proc.on("error", (err) => {
              clearTimeout(timer);
              activeProcesses.delete(procId);
              console.error(`[forge-api] spawn error: ${err.message} (code: ${(err as NodeJS.ErrnoException).code ?? "?"})`);
              resolve({ success: false, stdout: "", stderr: `spawn error: ${err.message}`, exitCode: -1 });
            });
          });

          json(res, result);
        } catch (err) {
          json(res, { success: false, stdout: "", stderr: String(err), exitCode: -1 });
        }
      });

      // ── POST /api/claude/abort ────────────────────────────────────────
      server.middlewares.use("/api/claude/abort", (req, res) => {
        if (req.method !== "POST") { json(res, { error: "Use POST" }, 405); return; }

        const count = activeProcesses.size;
        console.log(`[forge-api] Abortando ${count} processos claude ativos`);

        for (const [procId, proc] of activeProcesses) {
          try {
            proc.kill();
          } catch (err) {
            console.error(`[forge-api] Erro ao matar processo ${procId}:`, err);
          }
        }

        activeProcesses.clear();

        // Mata dev servers órfãos (portas 3000-3099 que agentes podem ter iniciado)
        try {
          const netstat = execSync("netstat -ano", { encoding: "utf-8", windowsHide: true });
          const orphanPids = new Set<string>();
          for (const line of netstat.split("\n")) {
            const match = line.match(/LISTENING\s+(\d+)\s*$/);
            const portMatch = line.match(/:30(\d{2})\s/);
            if (match && portMatch) {
              orphanPids.add(match[1]!);
            }
          }
          for (const pid of orphanPids) {
            try {
              execSync(`taskkill /pid ${pid} /T /F`, { windowsHide: true, stdio: "ignore" });
              console.log(`[forge-api] Dev server órfão (PID ${pid}) morto`);
            } catch { /* já morreu */ }
          }
        } catch { /* netstat falhou — ignora */ }

        json(res, { success: true, killed: count });
      });

      // ── GET /api/claude/version ───────────────────────────────────────
      server.middlewares.use("/api/claude/version", (_req, res) => {
        try {
          const version = execSync("claude --version", { encoding: "utf-8", timeout: 10_000 }).trim();
          json(res, { installed: true, version });
        } catch {
          json(res, { installed: false, version: null });
        }
      });

      // ── POST /api/claude/install ──────────────────────────────────────
      server.middlewares.use("/api/claude/install", async (req, res) => {
        if (req.method !== "POST") { json(res, { error: "Use POST" }, 405); return; }

        try {
          const result = await new Promise<{ success: boolean; message: string }>((resolve) => {
            execFile("npm", ["install", "-g", "@anthropic-ai/claude-code"], {
              env: { ...process.env },
              timeout: 120_000,
              shell: true,
            }, (error, _stdout, stderr) => {
              if (error) {
                resolve({ success: false, message: `Erro: ${stderr || error.message}` });
              } else {
                resolve({ success: true, message: "Claude Code CLI instalado com sucesso" });
              }
            });
          });

          json(res, result);
        } catch (err) {
          json(res, { success: false, message: String(err) });
        }
      });

      // ── GET /api/skills/:role ────────────────────────────────────────
      server.middlewares.use("/api/skills/", (req, res) => {
        const role = (req.url ?? "").replace(/^\//, "").replace(/\/$/, "");
        if (!role) { json(res, { content: null }); return; }

        const skillPath = path.join(__dirname, "agent-skills", role, "SKILL.md");
        try {
          if (fs.existsSync(skillPath)) {
            const content = fs.readFileSync(skillPath, "utf-8");
            json(res, { content });
          } else {
            json(res, { content: null });
          }
        } catch (err) {
          console.error(`[forge-api] Erro ao ler skill ${role}:`, err);
          json(res, { content: null });
        }
      });

      // ── POST /api/project/files ────────────────────────────────────────
      // Lê arquivos do projeto diretamente (sem CLI). Usado por reviewers.
      server.middlewares.use("/api/project/files", async (req, res) => {
        if (req.method !== "POST") { json(res, { error: "Use POST" }, 405); return; }

        try {
          const body = JSON.parse(await readBody(req)) as { projectPath?: string; maxFiles?: number };
          const projectPath = body.projectPath;
          if (!projectPath) { json(res, { error: "projectPath required" }, 400); return; }

          const srcPath = path.join(projectPath, "src");
          if (!fs.existsSync(srcPath)) { json(res, { files: [], error: "src/ not found" }); return; }

          const validExts = new Set([".ts", ".tsx", ".js", ".jsx", ".css", ".html"]);
          const ignoreDirs = new Set(["node_modules", "dist", ".git", "build", "coverage"]);
          const maxFiles = body.maxFiles ?? 10;
          const maxFileSize = 50_000;
          const results: Array<{ path: string; content: string; language: string }> = [];

          function walkDir(dir: string): void {
            if (results.length >= maxFiles) return;
            let entries: fs.Dirent[];
            try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }

            for (const entry of entries) {
              if (results.length >= maxFiles) return;
              if (ignoreDirs.has(entry.name)) continue;

              const fullPath = path.join(dir, entry.name);
              if (entry.isDirectory()) {
                walkDir(fullPath);
              } else if (entry.isFile()) {
                const ext = path.extname(entry.name).toLowerCase();
                if (!validExts.has(ext)) continue;
                try {
                  const stat = fs.statSync(fullPath);
                  if (stat.size > maxFileSize) continue;
                  const content = fs.readFileSync(fullPath, "utf-8");
                  const relPath = path.relative(projectPath, fullPath).replace(/\\/g, "/");
                  const langMap: Record<string, string> = { ".ts": "typescript", ".tsx": "tsx", ".js": "javascript", ".jsx": "jsx", ".css": "css", ".html": "html" };
                  results.push({ path: relPath, content, language: langMap[ext] ?? "plaintext" });
                } catch { /* skip unreadable */ }
              }
            }
          }

          walkDir(srcPath);
          console.log(`[forge-api] project/files: ${results.length} arquivos lidos de ${srcPath}`);
          json(res, { files: results });
        } catch (err) {
          json(res, { files: [], error: String(err) });
        }
      });

      // ── POST /api/project/screenshot ──────────────────────────────────
      // Inicia dev server do projeto, captura screenshot com Playwright, retorna caminho.
      // Usado pelo Designer agent para análise visual da interface renderizada.
      server.middlewares.use("/api/project/screenshot", async (req, res) => {
        if (req.method !== "POST") { json(res, { error: "Use POST" }, 405); return; }

        let devProc: ChildProcess | null = null;
        try {
          const body = JSON.parse(await readBody(req)) as {
            projectPath?: string;
            width?: number;
            height?: number;
          };
          const projectPath = body.projectPath;
          if (!projectPath) { json(res, { success: false, error: "projectPath required" }, 400); return; }

          // Verifica se o projeto tem package.json com script dev
          const pkgPath = path.join(projectPath, "package.json");
          if (!fs.existsSync(pkgPath)) {
            json(res, { success: false, error: "package.json not found" });
            return;
          }

          const width = body.width ?? 1280;
          const height = body.height ?? 800;
          const port = 5200 + Math.floor(Math.random() * 700); // 5200-5900

          console.log(`[forge-api] screenshot: iniciando dev server na porta ${port} (${projectPath})`);

          // Inicia dev server do projeto
          devProc = spawn("npx", ["vite", "--port", port.toString()], {
            cwd: projectPath,
            stdio: ["ignore", "pipe", "pipe"],
            env: { ...process.env },
            windowsHide: true,
          });

          // Aguarda o server ficar pronto (detecta URL no stdout)
          const serverUrl = await new Promise<string>((resolve, reject) => {
            const timeout = setTimeout(() => reject(new Error("Dev server timeout (30s)")), 30_000);
            let output = "";

            devProc!.stdout?.on("data", (chunk: Buffer) => {
              output += chunk.toString();
              const urlMatch = output.match(/Local:\s+(http:\/\/localhost:\d+)/);
              if (urlMatch) {
                clearTimeout(timeout);
                resolve(urlMatch[1]!);
              }
            });

            devProc!.stderr?.on("data", (chunk: Buffer) => {
              output += chunk.toString();
            });

            devProc!.on("close", (code) => {
              clearTimeout(timeout);
              reject(new Error(`Dev server saiu com code ${code}: ${output.slice(-200)}`));
            });
          });

          console.log(`[forge-api] screenshot: dev server pronto em ${serverUrl}`);

          // Aguarda um pouco para assets carregarem
          await new Promise((r) => setTimeout(r, 2000));

          // Captura screenshot com Playwright (usa Chrome local instalado)
          const browser = await chromium.launch({ channel: "chrome", headless: true });
          const page = await browser.newPage({ viewport: { width, height } });
          await page.goto(serverUrl, { waitUntil: "networkidle", timeout: 15_000 });
          await page.waitForTimeout(1500); // animações

          const screenshotPath = path.join(os.tmpdir(), `forgeai-screenshot-${Date.now()}.png`);
          await page.screenshot({ path: screenshotPath, fullPage: true });
          await browser.close();

          console.log(`[forge-api] screenshot: capturado em ${screenshotPath}`);

          // Mata o dev server
          try {
            if (devProc.pid) {
              execSync(`taskkill /pid ${devProc.pid} /T /F 2>nul`, { windowsHide: true });
            }
          } catch { devProc.kill(); }
          devProc = null;

          json(res, { success: true, screenshotPath });
        } catch (err) {
          console.error("[forge-api] screenshot erro:", err);
          // Limpa dev server se ainda estiver rodando
          if (devProc?.pid) {
            try { execSync(`taskkill /pid ${devProc.pid} /T /F 2>nul`, { windowsHide: true }); } catch { devProc.kill(); }
          }
          json(res, { success: false, error: String(err instanceof Error ? err.message : err) });
        }
      });


      // ── POST /api/claude/messages ─────────────────────────────────────
      // Chama a API Anthropic Messages diretamente (server-side, sem CORS).
      // Usado para o Orchestrator que precisa de system prompt puro (sem CLI built-in).
      server.middlewares.use("/api/claude/messages", async (req, res) => {
        if (req.method !== "POST") { json(res, { error: "Use POST" }, 405); return; }

        try {
          const body = JSON.parse(await readBody(req)) as {
            model?: string;
            max_tokens?: number;
            system?: string;
            messages?: Array<{ role: string; content: string }>;
            temperature?: number;
          };

          // Busca API key: body > env > OAuth token
          let apiKey = process.env.ANTHROPIC_API_KEY ?? "";
          let authHeader = "";

          if (apiKey) {
            authHeader = `x-api-key:${apiKey}`;
          } else {
            // Tenta OAuth do Claude CLI
            const credPath = path.join(os.homedir(), ".claude", ".credentials.json");
            if (fs.existsSync(credPath)) {
              const creds = JSON.parse(fs.readFileSync(credPath, "utf-8")) as Record<string, unknown>;
              const oauth = creds.claudeAiOauth as Record<string, unknown> | undefined;
              if (oauth?.accessToken) {
                apiKey = String(oauth.accessToken);
                authHeader = `bearer:${apiKey}`;
              }
            }
          }

          if (!apiKey) {
            json(res, { error: "Sem API key ou OAuth token. Configure nas settings ou execute 'claude' no terminal." }, 401);
            return;
          }

          const headers: Record<string, string> = {
            "content-type": "application/json",
            "anthropic-version": "2023-06-01",
          };

          if (authHeader.startsWith("x-api-key:")) {
            headers["x-api-key"] = authHeader.replace("x-api-key:", "");
          } else {
            headers["authorization"] = `Bearer ${apiKey}`;
          }

          console.log(`[forge-api] API Messages: model=${body.model}, messages=${body.messages?.length ?? 0}, system=${(body.system ?? "").length} chars`);

          const apiRes = await fetch("https://api.anthropic.com/v1/messages", {
            method: "POST",
            headers,
            body: JSON.stringify({
              model: body.model ?? "claude-sonnet-4-20250514",
              max_tokens: body.max_tokens ?? 4096,
              system: body.system ?? undefined,
              messages: body.messages ?? [],
              temperature: body.temperature ?? 0.7,
            }),
          });

          if (!apiRes.ok) {
            const errText = await apiRes.text();
            console.error(`[forge-api] API erro ${apiRes.status}:`, errText.substring(0, 300));
            json(res, { error: `API ${apiRes.status}: ${errText.substring(0, 200)}` }, apiRes.status);
            return;
          }

          const result = await apiRes.json();
          json(res, result);
        } catch (err) {
          console.error("[forge-api] API Messages erro:", err);
          json(res, { error: String(err) }, 500);
        }
      });

      // ── GET /api/env/:name ────────────────────────────────────────────
      server.middlewares.use("/api/env/", (req, res) => {
        const envName = req.url?.replace(/^\//, "") ?? "";
        if (!envName) { json(res, { value: null }); return; }
        json(res, { value: process.env[envName] ?? null });
      });
    },
  };
}

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react(), forgeApiPlugin()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },

  // Expõe variáveis de ambiente dos providers LLM para o frontend
  define: {
    "import.meta.env.ANTHROPIC_API_KEY": JSON.stringify(process.env.ANTHROPIC_API_KEY ?? ""),
    "import.meta.env.OPENAI_API_KEY": JSON.stringify(process.env.OPENAI_API_KEY ?? ""),
    "import.meta.env.GEMINI_API_KEY": JSON.stringify(process.env.GEMINI_API_KEY ?? ""),
    "import.meta.env.GITHUB_CLIENT_ID": JSON.stringify(process.env.VITE_GITHUB_CLIENT_ID ?? ""),
  },

  clearScreen: false,

  server: {
    port: 1420,
    strictPort: true,
    headers: {
      "Cache-Control": "no-store, no-cache, must-revalidate",
      "Pragma": "no-cache",
      "Expires": "0",
    },
    watch: {
      ignored: [
            "**/node_modules/**",
            "**/dist/**",
            // Ignora qualquer projeto gerado fora do src/ do ForgeAI
            (filePath: string) => {
              const normalized = filePath.replace(/\\/g, "/");
              // Permite tudo dentro do projeto ForgeAI
              if (normalized.includes("/ForgeAI/src/") || normalized.includes("/ForgeAI/index.html") || normalized.includes("/ForgeAI/vite.config")) return false;
              // Ignora qualquer pasta irmã do ForgeAI em D:/Software/
              if (/\/Software\/(?!ForgeAI\/)/.test(normalized)) return true;
              return false;
            },
          ],
    },
    // Proxy para evitar CORS no modo browser
    proxy: {
      "/api/anthropic": {
        target: "https://api.anthropic.com",
        changeOrigin: true,
        rewrite: (p: string) => p.replace(/^\/api\/anthropic/, ""),
      },
    },
  },
});
