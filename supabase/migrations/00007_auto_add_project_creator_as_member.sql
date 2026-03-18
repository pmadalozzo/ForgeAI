-- =============================================================================
-- 00007_cleanup_unnecessary_triggers.sql
-- Remove triggers desnecessários — o código faz tudo via CRUD direto
-- =============================================================================

-- O sync-service.ts agora faz 3 operações diretas:
-- 1. upsert profiles (garante que o profile existe)
-- 2. upsert projects (salva o projeto)
-- 3. upsert project_members (adiciona criador como admin)
-- Nenhum trigger necessário.

DROP TRIGGER IF EXISTS add_creator_as_member ON public.projects;
DROP FUNCTION IF EXISTS public.auto_add_project_creator();

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user();

DROP POLICY IF EXISTS "projects_update_creator" ON public.projects;
DROP POLICY IF EXISTS "projects_delete_creator" ON public.projects;
DROP POLICY IF EXISTS "projects_select_creator" ON public.projects;
