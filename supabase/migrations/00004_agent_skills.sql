-- =============================================================================
-- 00004_agent_skills.sql
-- Tabela de skills dos agentes — habilidades configuráveis por role e projeto
-- =============================================================================

-- ========================
-- Tabela: agent_skills
-- Skills (documentos SKILL.md) atribuídas a agentes, globais ou por projeto
-- ========================

CREATE TABLE public.agent_skills (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_role  text        NOT NULL,
  name        text        NOT NULL,
  description text,
  content     text        NOT NULL,
  version     text        NOT NULL DEFAULT '1.0.0',
  tags        text[]      NOT NULL DEFAULT '{}',
  is_default  boolean     NOT NULL DEFAULT false,
  project_id  uuid        REFERENCES public.projects(id) ON DELETE CASCADE,
  created_by  uuid        REFERENCES auth.users(id),
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.agent_skills ENABLE ROW LEVEL SECURITY;

-- ========================
-- Índices
-- ========================

CREATE INDEX idx_agent_skills_agent_role ON public.agent_skills(agent_role);
CREATE INDEX idx_agent_skills_project_id ON public.agent_skills(project_id);
CREATE INDEX idx_agent_skills_is_default ON public.agent_skills(is_default) WHERE is_default = true;

-- ========================
-- Trigger updated_at (reutiliza função existente de 00001)
-- ========================

CREATE TRIGGER set_agent_skills_updated_at
  BEFORE UPDATE ON public.agent_skills
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ========================
-- RLS Policies
-- ========================

-- Membros do projeto podem ler skills do projeto + skills globais (project_id IS NULL)
CREATE POLICY "agent_skills_select_member"
  ON public.agent_skills FOR SELECT
  TO authenticated
  USING (
    project_id IS NULL
    OR public.is_project_member(project_id)
  );

-- Developers+ podem criar skills no projeto
CREATE POLICY "agent_skills_insert_developer"
  ON public.agent_skills FOR INSERT
  TO authenticated
  WITH CHECK (
    project_id IS NULL
    OR public.is_project_developer_or_admin(project_id)
  );

-- Developers+ podem atualizar skills do projeto
CREATE POLICY "agent_skills_update_developer"
  ON public.agent_skills FOR UPDATE
  TO authenticated
  USING (
    project_id IS NULL
    OR public.is_project_developer_or_admin(project_id)
  )
  WITH CHECK (
    project_id IS NULL
    OR public.is_project_developer_or_admin(project_id)
  );

-- Developers+ podem deletar skills do projeto
CREATE POLICY "agent_skills_delete_developer"
  ON public.agent_skills FOR DELETE
  TO authenticated
  USING (
    project_id IS NULL
    OR public.is_project_developer_or_admin(project_id)
  );

-- ========================
-- Adiciona à publicação Realtime
-- ========================

ALTER PUBLICATION supabase_realtime ADD TABLE public.agent_skills;
