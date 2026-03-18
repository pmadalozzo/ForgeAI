-- =============================================================================
-- 00002_rls_policies.sql
-- Políticas de Row Level Security para todas as tabelas
-- service_role (agentes via Edge Functions) faz bypass automático no Supabase
-- =============================================================================

-- ========================
-- Função auxiliar: verifica se o usuário é membro do projeto
-- ========================

CREATE OR REPLACE FUNCTION public.is_project_member(p_project_id uuid)
RETURNS boolean AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.project_members
    WHERE project_id = p_project_id
      AND user_id = auth.uid()
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- ========================
-- Função auxiliar: retorna o papel do usuário no projeto
-- ========================

CREATE OR REPLACE FUNCTION public.get_member_role(p_project_id uuid)
RETURNS member_role AS $$
  SELECT role FROM public.project_members
  WHERE project_id = p_project_id
    AND user_id = auth.uid()
  LIMIT 1;
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- ========================
-- Função auxiliar: verifica se o usuário é developer ou admin do projeto
-- ========================

CREATE OR REPLACE FUNCTION public.is_project_developer_or_admin(p_project_id uuid)
RETURNS boolean AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.project_members
    WHERE project_id = p_project_id
      AND user_id = auth.uid()
      AND role IN ('developer', 'admin')
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- ========================
-- Função auxiliar: verifica se o usuário é admin do projeto
-- ========================

CREATE OR REPLACE FUNCTION public.is_project_admin(p_project_id uuid)
RETURNS boolean AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.project_members
    WHERE project_id = p_project_id
      AND user_id = auth.uid()
      AND role = 'admin'
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- ========================
-- profiles: todos leem, apenas o próprio usuário atualiza
-- ========================

CREATE POLICY "profiles_select_all"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "profiles_update_own"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

CREATE POLICY "profiles_insert_own"
  ON public.profiles FOR INSERT
  TO authenticated
  WITH CHECK (id = auth.uid());

-- ========================
-- projects: membros leem, admins atualizam e deletam, criador insere
-- ========================

CREATE POLICY "projects_select_member"
  ON public.projects FOR SELECT
  TO authenticated
  USING (public.is_project_member(id));

CREATE POLICY "projects_insert_authenticated"
  ON public.projects FOR INSERT
  TO authenticated
  WITH CHECK (created_by = auth.uid());

CREATE POLICY "projects_update_admin"
  ON public.projects FOR UPDATE
  TO authenticated
  USING (public.is_project_admin(id))
  WITH CHECK (public.is_project_admin(id));

CREATE POLICY "projects_delete_admin"
  ON public.projects FOR DELETE
  TO authenticated
  USING (public.is_project_admin(id));

-- ========================
-- project_members: membros leem, admins gerenciam
-- ========================

CREATE POLICY "project_members_select_member"
  ON public.project_members FOR SELECT
  TO authenticated
  USING (public.is_project_member(project_id));

CREATE POLICY "project_members_insert_admin"
  ON public.project_members FOR INSERT
  TO authenticated
  WITH CHECK (public.is_project_admin(project_id));

CREATE POLICY "project_members_update_admin"
  ON public.project_members FOR UPDATE
  TO authenticated
  USING (public.is_project_admin(project_id))
  WITH CHECK (public.is_project_admin(project_id));

CREATE POLICY "project_members_delete_admin"
  ON public.project_members FOR DELETE
  TO authenticated
  USING (public.is_project_admin(project_id));

-- ========================
-- project_messages: membros leem, developers+ inserem
-- ========================

CREATE POLICY "project_messages_select_member"
  ON public.project_messages FOR SELECT
  TO authenticated
  USING (public.is_project_member(project_id));

CREATE POLICY "project_messages_insert_developer"
  ON public.project_messages FOR INSERT
  TO authenticated
  WITH CHECK (public.is_project_developer_or_admin(project_id));

-- ========================
-- agent_configs: membros leem, admins gerenciam
-- ========================

CREATE POLICY "agent_configs_select_member"
  ON public.agent_configs FOR SELECT
  TO authenticated
  USING (public.is_project_member(project_id));

CREATE POLICY "agent_configs_insert_admin"
  ON public.agent_configs FOR INSERT
  TO authenticated
  WITH CHECK (public.is_project_admin(project_id));

CREATE POLICY "agent_configs_update_admin"
  ON public.agent_configs FOR UPDATE
  TO authenticated
  USING (public.is_project_admin(project_id))
  WITH CHECK (public.is_project_admin(project_id));

CREATE POLICY "agent_configs_delete_admin"
  ON public.agent_configs FOR DELETE
  TO authenticated
  USING (public.is_project_admin(project_id));

-- ========================
-- tasks: membros leem, developers+ atualizam
-- ========================

CREATE POLICY "tasks_select_member"
  ON public.tasks FOR SELECT
  TO authenticated
  USING (public.is_project_member(project_id));

CREATE POLICY "tasks_insert_developer"
  ON public.tasks FOR INSERT
  TO authenticated
  WITH CHECK (public.is_project_developer_or_admin(project_id));

CREATE POLICY "tasks_update_developer"
  ON public.tasks FOR UPDATE
  TO authenticated
  USING (public.is_project_developer_or_admin(project_id))
  WITH CHECK (public.is_project_developer_or_admin(project_id));

-- ========================
-- agent_sessions: membros leem, developers+ inserem/atualizam
-- ========================

CREATE POLICY "agent_sessions_select_member"
  ON public.agent_sessions FOR SELECT
  TO authenticated
  USING (public.is_project_member(project_id));

CREATE POLICY "agent_sessions_insert_developer"
  ON public.agent_sessions FOR INSERT
  TO authenticated
  WITH CHECK (public.is_project_developer_or_admin(project_id));

CREATE POLICY "agent_sessions_update_developer"
  ON public.agent_sessions FOR UPDATE
  TO authenticated
  USING (public.is_project_developer_or_admin(project_id))
  WITH CHECK (public.is_project_developer_or_admin(project_id));

-- ========================
-- artifacts: membros leem, developers+ inserem
-- ========================

CREATE POLICY "artifacts_select_member"
  ON public.artifacts FOR SELECT
  TO authenticated
  USING (public.is_project_member(project_id));

CREATE POLICY "artifacts_insert_developer"
  ON public.artifacts FOR INSERT
  TO authenticated
  WITH CHECK (public.is_project_developer_or_admin(project_id));
