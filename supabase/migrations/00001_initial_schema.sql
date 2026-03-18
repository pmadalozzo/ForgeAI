-- =============================================================================
-- 00001_initial_schema.sql
-- Schema inicial do ForgeAI — tabelas, enums, índices e RLS habilitado
-- =============================================================================

-- ========================
-- Enums
-- ========================

CREATE TYPE public.user_role AS ENUM ('viewer', 'developer', 'admin');

CREATE TYPE public.project_status AS ENUM ('planning', 'active', 'paused', 'completed');

CREATE TYPE public.supervision_mode AS ENUM ('autopilot', 'approve', 'watch', 'pair');

CREATE TYPE public.source_type AS ENUM ('text', 'local_folder', 'git_repo');

CREATE TYPE public.sender_type AS ENUM ('user', 'agent', 'system');

CREATE TYPE public.member_role AS ENUM ('viewer', 'developer', 'admin');

CREATE TYPE public.task_status AS ENUM ('pending', 'in_progress', 'review', 'blocked', 'done');

-- ========================
-- Tabela: profiles
-- Perfil do usuário vinculado ao auth.users do Supabase
-- ========================

CREATE TABLE public.profiles (
  id            uuid        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name  text        NOT NULL DEFAULT '',
  avatar_url    text,
  role          user_role   NOT NULL DEFAULT 'developer',
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- ========================
-- Tabela: projects
-- Projetos de software gerenciados pela plataforma
-- ========================

CREATE TABLE public.projects (
  id                uuid            PRIMARY KEY DEFAULT gen_random_uuid(),
  name              text            NOT NULL,
  description       text            NOT NULL DEFAULT '',
  status            project_status  NOT NULL DEFAULT 'planning',
  supervision_mode  supervision_mode NOT NULL DEFAULT 'approve',
  source_type       source_type     NOT NULL DEFAULT 'text',
  source_url        text,
  git_branch        text,
  created_by        uuid            NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  progress          numeric         NOT NULL DEFAULT 0,
  total_cost        numeric         NOT NULL DEFAULT 0,
  created_at        timestamptz     NOT NULL DEFAULT now(),
  updated_at        timestamptz     NOT NULL DEFAULT now()
);

ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;

-- ========================
-- Tabela: project_members
-- Associação de usuários a projetos com papel específico
-- ========================

CREATE TABLE public.project_members (
  project_id  uuid        NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  user_id     uuid        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  role        member_role NOT NULL DEFAULT 'viewer',
  joined_at   timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (project_id, user_id)
);

ALTER TABLE public.project_members ENABLE ROW LEVEL SECURITY;

-- ========================
-- Tabela: project_messages
-- Mensagens do chat do projeto (usuários, agentes, sistema)
-- ========================

CREATE TABLE public.project_messages (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id  uuid        NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  sender_type sender_type NOT NULL,
  sender_id   text        NOT NULL,
  agent_role  text,
  content     text        NOT NULL,
  metadata    jsonb       NOT NULL DEFAULT '{}',
  created_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.project_messages ENABLE ROW LEVEL SECURITY;

-- ========================
-- Tabela: agent_configs
-- Configuração de agentes por projeto (provider, modelo, etc.)
-- ========================

CREATE TABLE public.agent_configs (
  id            uuid    PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id    uuid    NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  agent_role    text    NOT NULL,
  llm_provider  text    NOT NULL,
  model_name    text    NOT NULL,
  is_active     boolean NOT NULL DEFAULT true,
  config        jsonb   NOT NULL DEFAULT '{}',
  created_at    timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.agent_configs ENABLE ROW LEVEL SECURITY;

-- ========================
-- Tabela: tasks
-- Tarefas atribuídas a agentes dentro de um projeto
-- ========================

CREATE TABLE public.tasks (
  id                    uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id            uuid        NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  title                 text        NOT NULL,
  description           text        NOT NULL DEFAULT '',
  assigned_agent        text,
  status                task_status NOT NULL DEFAULT 'pending',
  priority              int         NOT NULL DEFAULT 0,
  parent_task_id        uuid        REFERENCES public.tasks(id) ON DELETE SET NULL,
  quality_gate_results  jsonb,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now(),
  completed_at          timestamptz
);

ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;

-- ========================
-- Tabela: agent_sessions
-- Sessões de execução de agentes (métricas de uso)
-- ========================

CREATE TABLE public.agent_sessions (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id      uuid        NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  agent_role      text        NOT NULL,
  status          text        NOT NULL DEFAULT 'idle',
  current_task_id uuid        REFERENCES public.tasks(id) ON DELETE SET NULL,
  lines_written   int         NOT NULL DEFAULT 0,
  tokens_used     int         NOT NULL DEFAULT 0,
  cost            numeric     NOT NULL DEFAULT 0,
  started_at      timestamptz NOT NULL DEFAULT now(),
  ended_at        timestamptz
);

ALTER TABLE public.agent_sessions ENABLE ROW LEVEL SECURITY;

-- ========================
-- Tabela: artifacts
-- Artefatos gerados por agentes (arquivos, código, documentos)
-- ========================

CREATE TABLE public.artifacts (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id       uuid        NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  task_id          uuid        REFERENCES public.tasks(id) ON DELETE SET NULL,
  file_path        text        NOT NULL,
  content          text        NOT NULL DEFAULT '',
  artifact_type    text        NOT NULL,
  created_by_agent text,
  created_at       timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.artifacts ENABLE ROW LEVEL SECURITY;

-- ========================
-- Índices para foreign keys e colunas frequentemente consultadas
-- ========================

-- projects
CREATE INDEX idx_projects_created_by ON public.projects(created_by);
CREATE INDEX idx_projects_status ON public.projects(status);

-- project_members
CREATE INDEX idx_project_members_user_id ON public.project_members(user_id);

-- project_messages
CREATE INDEX idx_project_messages_project_id ON public.project_messages(project_id);
CREATE INDEX idx_project_messages_created_at ON public.project_messages(project_id, created_at DESC);

-- agent_configs
CREATE INDEX idx_agent_configs_project_id ON public.agent_configs(project_id);

-- tasks
CREATE INDEX idx_tasks_project_id ON public.tasks(project_id);
CREATE INDEX idx_tasks_status ON public.tasks(project_id, status);
CREATE INDEX idx_tasks_parent_task_id ON public.tasks(parent_task_id);

-- agent_sessions
CREATE INDEX idx_agent_sessions_project_id ON public.agent_sessions(project_id);
CREATE INDEX idx_agent_sessions_current_task ON public.agent_sessions(current_task_id);

-- artifacts
CREATE INDEX idx_artifacts_project_id ON public.artifacts(project_id);
CREATE INDEX idx_artifacts_task_id ON public.artifacts(task_id);

-- ========================
-- Trigger para atualizar updated_at automaticamente
-- ========================

CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER set_projects_updated_at
  BEFORE UPDATE ON public.projects
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER set_tasks_updated_at
  BEFORE UPDATE ON public.tasks
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
