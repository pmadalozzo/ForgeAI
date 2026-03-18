-- =============================================================================
-- 00005_project_memories.sql
-- Tabelas de memória — project_memories (por projeto) e dev_memories (global)
-- =============================================================================

-- ========================
-- Tabela: project_memories
-- Memórias criadas por agentes dentro de um projeto
-- ========================

CREATE TABLE public.project_memories (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id  uuid        NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  agent_role  text        NOT NULL,
  type        text        NOT NULL,
  title       text        NOT NULL,
  content     text        NOT NULL,
  metadata    jsonb       NOT NULL DEFAULT '{}',
  created_at  timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT project_memories_type_check
    CHECK (type IN ('analysis', 'decision', 'artifact', 'issue', 'progress', 'note'))
);

ALTER TABLE public.project_memories ENABLE ROW LEVEL SECURITY;

-- ========================
-- Tabela: dev_memories
-- Memória global de desenvolvimento (preferências, padrões, convenções)
-- ========================

CREATE TABLE public.dev_memories (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  category      text        NOT NULL,
  title         text        NOT NULL,
  content       text        NOT NULL,
  learned_from  text        NOT NULL DEFAULT 'manual',
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT dev_memories_category_check
    CHECK (category IN ('preference', 'pattern', 'convention', 'tool', 'workflow'))
);

ALTER TABLE public.dev_memories ENABLE ROW LEVEL SECURITY;

-- ========================
-- Índices
-- ========================

CREATE INDEX idx_project_memories_project_id ON public.project_memories(project_id);
CREATE INDEX idx_project_memories_agent_role ON public.project_memories(project_id, agent_role);
CREATE INDEX idx_project_memories_type ON public.project_memories(project_id, type);
CREATE INDEX idx_dev_memories_category ON public.dev_memories(category);

-- ========================
-- Trigger updated_at para dev_memories (reutiliza função existente de 00001)
-- ========================

CREATE TRIGGER set_dev_memories_updated_at
  BEFORE UPDATE ON public.dev_memories
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ========================
-- RLS Policies — authenticated pode tudo
-- ========================

-- project_memories: membros do projeto podem ler, developers+ podem inserir/deletar
CREATE POLICY "project_memories_select_member"
  ON public.project_memories FOR SELECT
  TO authenticated
  USING (public.is_project_member(project_id));

CREATE POLICY "project_memories_insert_developer"
  ON public.project_memories FOR INSERT
  TO authenticated
  WITH CHECK (public.is_project_developer_or_admin(project_id));

CREATE POLICY "project_memories_delete_developer"
  ON public.project_memories FOR DELETE
  TO authenticated
  USING (public.is_project_developer_or_admin(project_id));

-- dev_memories: qualquer usuário autenticado pode ler, inserir, atualizar, deletar
CREATE POLICY "dev_memories_select_authenticated"
  ON public.dev_memories FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "dev_memories_insert_authenticated"
  ON public.dev_memories FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "dev_memories_update_authenticated"
  ON public.dev_memories FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "dev_memories_delete_authenticated"
  ON public.dev_memories FOR DELETE
  TO authenticated
  USING (true);

-- ========================
-- Adiciona à publicação Realtime
-- ========================

ALTER PUBLICATION supabase_realtime ADD TABLE public.project_memories;
ALTER PUBLICATION supabase_realtime ADD TABLE public.dev_memories;
