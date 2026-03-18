-- =============================================================================
-- 00003_realtime.sql
-- Habilita Supabase Realtime nas tabelas relevantes para streaming ao vivo
-- =============================================================================

-- Adiciona as tabelas à publicação do Realtime do Supabase
-- O Supabase usa a publicação "supabase_realtime" para Postgres Changes
ALTER PUBLICATION supabase_realtime ADD TABLE public.project_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.tasks;
ALTER PUBLICATION supabase_realtime ADD TABLE public.agent_sessions;
