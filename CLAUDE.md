# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Sobre o Projeto

ForgeAI é uma **plataforma de fábrica de software autônoma** que orquestra times de agentes de IA para desenvolver, testar e entregar software completo. O usuário descreve o que quer construir (texto, pasta local ou repo Git), configura o time de agentes e acompanha o progresso em tempo real através de um **Escritório Virtual 2D** interativo.

## Arquitetura de 4 Camadas

1. **Interface Layer** — UI 2D interativa (React + SVG), painel de chat com orquestrador, visualização de agentes
2. **Orchestration Layer** — Agente Orquestrador central, roteamento de tarefas, gestão de contexto, Quality Gates
3. **Agent Layer** — Pool de agentes especializados (PM, Architect, Frontend, Backend, Database, QA, Security, DevOps, Code Reviewer), execution sandboxes, memória compartilhada
4. **Infrastructure Layer** — File System, Git integration, LLM connectors (Claude Code, OpenAI, Gemini, Ollama, LM Studio), terminal execution, banco de vetores

Comunicação entre camadas via **Event Bus** (BullMQ + Redis). Fluxo principal: Usuário → Orquestrador → Agentes → Filesystem/Git → Feedback ao Usuário.

## Stack Técnica

| Componente | Tecnologia |
|---|---|
| App Desktop | Tauri 2.0 (Rust + Webview) |
| Frontend | React + TypeScript + Vite |
| Canvas 2D | React Flow + Framer Motion |
| Backend Local | Node.js com Fastify |
| Agent Runtime | Docker containers / Node workers |
| Event Bus | BullMQ + Redis |
| Banco de Vetores | ChromaDB / Qdrant (local) |
| Banco de Dados | **Supabase** |
| Git Integration | isomorphic-git + simple-git |
| LLM Gateway | LiteLLM / Custom Gateway |
| IDE Extension | VS Code Extension API |

## Comandos de Desenvolvimento

```bash
# Instalar dependências
npm install

# Rodar em modo desenvolvimento (Vite + Tauri)
npm run tauri dev

# Build de produção
npm run tauri build

# Rodar apenas o frontend (sem Tauri)
npm run dev

# Lint
npm run lint

# Type check
npm run typecheck

# Testes
npm run test              # todos os testes
npm run test -- --watch   # modo watch
npm run test <arquivo>    # teste específico

# Supabase local (requer Docker)
npx supabase start        # inicia instância local
npx supabase db reset      # reset com migrations
npx supabase gen types     # gerar tipos TypeScript das tabelas
npx supabase migration new <nome>  # criar nova migration
```

## Escritório Virtual 2D (Agent Office)

A interface principal é um escritório virtual 2D onde cada agente de IA é um bonequinho animado (SVG pixel-art/chibi) sentado em sua estação de trabalho. O protótipo funcional está em `docs/ForgeAI-Office-v2.jsx`.

### Zonas do Escritório

| Zona | Agentes | Posição |
|---|---|---|
| 🏢 Management | Orchestrator, PM, Architect | Topo |
| 💻 Development | Frontend, Backend, Database | Centro |
| 🛡️ QA & Ops | QA, Security, DevOps, Code Reviewer | Base |

### Agentes e Cores Fixas

- 🎯 Orchestrator (#3B82F6), 📋 PM (#8B5CF6), 🏗️ Architect (#10B981)
- 🎨 Frontend (#06B6D4), ⚙️ Backend (#F97316), 🗃️ Database (#EAB308)
- 🧪 QA (#EF4444), 🔒 Security (#6B7280), 📦 DevOps (#EC4899), 🔍 Code Reviewer (#6366F1)

### 5 Estados Visuais dos Bonequinhos

| Status | Corpo | Monitor | Indicador |
|---|---|---|---|
| ⚡ Working | Mãos digitando, cabeça oscila | Linhas de código animadas | Barra de progresso avançando |
| 💤 Idle | Braços relaxados, olhos fechados | Tela escura/standby | Balão 💤 |
| 🚫 Blocked | Braços cruzados, olhos X vermelho | Borda vermelha piscando | Balão ❗ |
| 👀 In Review | Mão no queixo, olhos semicerrados | Diff verde/vermelho | Borda roxa pulsante |
| ✅ Done | Braços levantados, sorriso largo | Checkmark grande | Balão ✅, confete |

### Agentes Andando (Walking Agents)

Quando um agente envia task/resultado para outro, um bonequinho se levanta e caminha fisicamente até a mesa destino carregando um documento, com etiqueta flutuante do conteúdo. Max 5 walkers simultâneos.

### Estação de Trabalho (Desk)

Cada mesa tem: monitor com linhas de código animadas na cor do agente, teclado + mouse, cadeira, barra de progresso, label da task atual, name badge. Itens variáveis por agente: caneca de café com vapor, vaso com planta, pilha de papéis.

### Interações do Canvas

- Clique no bonequinho → painel de detalhes lateral
- Zoom in/out e pan para navegar
- Hover → tooltip com status e task
- Drag & Drop → reorganizar mesas (persistência de layout)
- Double-click → modo Pair Programming com o agente
- Right-click → menu contextual (Pausar, Reiniciar, Trocar Provider, Ver Logs)
- Hotkeys: Space (pausar tudo), R (reiniciar selecionado), Tab (ciclar agentes), Esc (deselecionar)
- Minimap no canto inferior esquerdo

### Elementos Decorativos

Plantas, bebedouro, quadro kanban na parede, impressora (zona QA), dashboard de métricas (zona Ops), máquina de café, iluminação com gradiente radial por zona.

## Supabase — Arquitetura Multi-Usuário

O sistema suporta múltiplos usuários simultâneos interagindo com o mesmo time de agentes via 3 primitivas Realtime:

| Camada | Primitiva | Uso |
|---|---|---|
| Persistência | Postgres Changes | Chat com Orchestrator — mensagens em `project_messages`, histórico recuperável |
| Eventos Efêmeros | Broadcast | Status de agentes, progresso, logs ao vivo — alta frequência, sem persistir |
| Colaboração | Presence | Quem está online, "digitando...", painel de usuários ativos |

### Isolamento por Projeto

Canais separados por projeto: `project:{id}:messages`, `project:{id}:presence`, `project:{id}:events`

### Permissões (RLS)

- **viewer** — só lê mensagens
- **developer** — lê/envia mensagens, acessa artefatos
- **admin** — controle total (membros, agentes, configurações)
- **Orchestrator/Agentes** — Edge Functions com `service_role` (bypass RLS)

### Modos de Supervisão

| Modo | Comportamento |
|---|---|
| 🚀 Autopilot | Agentes executam sem interrupção, usuário recebe notificações |
| ✅ Approve | Cada quality gate pausa para aprovação do usuário |
| 👀 Watch | Execução contínua com streaming de logs em tempo real |
| 🎯 Pair | Usuário trabalha junto com um agente específico |

## Quality Gates

Toda entrega de agente passa por: Lint → Type → Test → Build → Security → Review → Integration

## Convenções

- **Idioma**: Português brasileiro em todo código, UI e comunicação (termos técnicos mantêm forma original)
- **NÃO usar `any`** em TypeScript — nunca
- **Não excluir ou alterar layout** sem perguntar ao usuário antes
- Paleta escura: fundo #0c1322, zones com overlay sutil, personagens com cores vivas
- Tipografia: JetBrains Mono / Fira Code (monospace), Inter (UI)
- Rendering: SVG inline em React; CSS animations para pulsações; SVG SMIL para digitação/caminhada
- SVG viewBox escalável; painel lateral colapsável; breakpoints em 1024px e 768px

## LLM Connectors

O sistema é agnóstico de LLM — cada agente pode usar um provider diferente:

| Provider | Execução | Melhor Para |
|---|---|---|
| Claude Code | Local (terminal) | Coding autônomo, refactoring, debug |
| OpenAI Codex/GPT | API remota | Geração rápida, boilerplate |
| Google Gemini | API remota | Contexto longo, docs |
| Ollama | Local (GPU) | Privacidade total, sem custo |
| LM Studio | Local (GPU) | Modelos fine-tuned |
