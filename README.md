# ForgeAI

Plataforma de fábrica de software autônoma que orquestra times de agentes de IA para desenvolver, testar e entregar software completo.

O usuário descreve o que quer construir — via texto, pasta local ou repositório Git — e um time de agentes especializados trabalha de forma coordenada para entregar o projeto. Todo o progresso é acompanhado em tempo real através de um **Escritório Virtual 2D** interativo.

![Status](https://img.shields.io/badge/status-em%20desenvolvimento-yellow)

## Como Funciona

O ForgeAI simula uma software house com agentes de IA, cada um com uma especialidade:

| Agente | Função |
|---|---|
| 🎯 **Orchestrator** | Coordena todo o time, distribui tarefas e garante qualidade |
| 📋 **PM** | Gerencia escopo, requisitos e prioridades |
| 🏗️ **Architect** | Define arquitetura e decisões técnicas |
| 🎨 **Frontend** | Desenvolve interfaces e componentes visuais |
| ⚙️ **Backend** | Implementa APIs, lógica de negócio e integrações |
| 🗃️ **Database** | Modela dados, cria migrations e otimiza queries |
| 🧪 **QA** | Escreve e executa testes automatizados |
| 🔒 **Security** | Audita vulnerabilidades e aplica boas práticas |
| 📦 **DevOps** | Configura CI/CD, containers e infraestrutura |
| 🔍 **Code Reviewer** | Revisa código e sugere melhorias |

### Escritório Virtual 2D

A interface principal é um escritório virtual onde cada agente é representado como um bonequinho animado em sua estação de trabalho. Você pode ver em tempo real:

- Quem está trabalhando, ocioso, bloqueado ou em review
- Agentes "caminhando" entre mesas para entregar tarefas
- Progresso individual e geral do projeto
- Logs e outputs de cada agente

### Modos de Supervisão

| Modo | Descrição |
|---|---|
| 🚀 **Autopilot** | Agentes executam sem interrupção |
| ✅ **Approve** | Cada etapa pausa para sua aprovação |
| 👀 **Watch** | Execução contínua com streaming de logs |
| 🎯 **Pair** | Trabalhe junto com um agente específico |

## Stack Técnica

- **Frontend**: React + TypeScript + Vite + Tailwind CSS
- **Canvas 2D**: React Flow + Framer Motion
- **Backend**: Node.js + Fastify
- **Event Bus**: BullMQ + Redis
- **Banco de Dados**: Supabase (Postgres + Realtime)
- **Git**: isomorphic-git + simple-git
- **LLM Providers**: Claude Code, OpenAI, Google Gemini, Ollama, LM Studio

## Pré-requisitos

- [Node.js](https://nodejs.org/) 18+
- [Redis](https://redis.io/) (para o Event Bus)
- [Docker](https://www.docker.com/) (opcional, para Supabase local e agent runtime)

## Instalação

```bash
# Clone o repositório
git clone https://github.com/pmadalozzo/ForgeAI.git
cd ForgeAI

# Instale as dependências
npm install
```

## Uso

### Desenvolvimento

```bash
# Rodar apenas o frontend
npm run dev

# Rodar frontend + backend juntos
npm run dev:full

# Rodar apenas o backend
npm run dev:backend
```

### Supabase Local (opcional)

```bash
# Iniciar instância local (requer Docker)
npx supabase start

# Reset do banco com migrations
npx supabase db reset

# Gerar tipos TypeScript das tabelas
npx supabase gen types
```

### Build de Produção

```bash
npm run build
```

### Testes e Qualidade

```bash
# Rodar todos os testes
npm run test

# Testes em modo watch
npm run test -- --watch

# Verificação de tipos
npm run typecheck

# Lint
npm run lint

# Formatação
npm run format
```

## Estrutura do Projeto

```
ForgeAI/
├── src/
│   ├── components/       # Componentes React
│   │   ├── agents/       # Componentes dos agentes
│   │   ├── auth/         # Autenticação
│   │   ├── chat/         # Chat com orquestrador
│   │   ├── office/       # Escritório Virtual 2D
│   │   ├── project/      # Gestão de projetos
│   │   └── ui/           # Componentes de UI compartilhados
│   ├── services/         # Lógica de negócio
│   │   ├── agents/       # Runtime dos agentes
│   │   ├── auth/         # Serviço de autenticação
│   │   ├── events/       # Event Bus (BullMQ)
│   │   ├── llm/          # Conectores LLM
│   │   └── supabase/     # Cliente Supabase
│   ├── stores/           # Estado global (Zustand)
│   ├── hooks/            # React hooks customizados
│   └── types/            # Definições TypeScript
├── supabase/             # Configuração e migrations
├── agent-skills/         # Skills dos agentes
├── docs/                 # Documentação e protótipos
└── public/               # Arquivos estáticos
```

## LLM Providers Suportados

O sistema é agnóstico de LLM — cada agente pode usar um provider diferente:

| Provider | Tipo | Melhor Para |
|---|---|---|
| Claude Code | Local (terminal) | Coding autônomo, refactoring, debug |
| OpenAI | API remota | Geração rápida, boilerplate |
| Google Gemini | API remota | Contexto longo, análise de docs |
| Ollama | Local (GPU) | Privacidade total, sem custo |
| LM Studio | Local (GPU) | Modelos fine-tuned |

## Licença

MIT License
