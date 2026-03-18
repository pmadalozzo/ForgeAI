import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import fs from "fs";
import os from "os";
import { spawn, execSync, execFile } from "child_process";
import type { ChildProcess } from "child_process";
import type { Plugin } from "vite";
import type { IncomingMessage, ServerResponse } from "http";

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

          const startMs = Date.now();
          console.log(`[forge-api] claude ${args.slice(0, 4).join(" ")}... (cwd: ${cwd ?? "default"})`);

          const procId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

          const result = await new Promise<{ success: boolean; stdout: string; stderr: string; exitCode: number }>((resolve) => {
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
              console.log(`[forge-api] claude finalizado (${code}) em ${Date.now() - startMs}ms — stdout: ${stdout.length} chars`);
              resolve({ success: code === 0, stdout, stderr, exitCode: code ?? -1 });
            });

            proc.on("error", (err) => {
              clearTimeout(timer);
              activeProcesses.delete(procId);
              resolve({ success: false, stdout: "", stderr: err.message, exitCode: -1 });
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
