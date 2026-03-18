import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        // Paleta principal escura do ForgeAI
        forge: {
          bg: "#0c1322",
          surface: "#111827",
          border: "#1e293b",
          muted: "#374151",
          text: "#e2e8f0",
          "text-dim": "#94a3b8",
        },
        // Cores dos agentes — fixas conforme CLAUDE.md
        agent: {
          orchestrator: "#3B82F6",
          pm: "#8B5CF6",
          architect: "#10B981",
          frontend: "#06B6D4",
          backend: "#F97316",
          database: "#EAB308",
          qa: "#EF4444",
          security: "#6B7280",
          devops: "#EC4899",
          reviewer: "#6366F1",
        },
      },
      fontFamily: {
        mono: ["JetBrains Mono", "Fira Code", "monospace"],
        sans: ["Inter", "system-ui", "sans-serif"],
      },
      animation: {
        "pulse-slow": "pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite",
        "bounce-gentle": "bounce 2s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};

export default config;
