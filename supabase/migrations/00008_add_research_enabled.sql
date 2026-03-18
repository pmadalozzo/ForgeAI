-- Adiciona coluna research_enabled na tabela projects
-- Permite opt-in para pesquisa de mercado (Phase 0) antes do planejamento
ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS research_enabled boolean NOT NULL DEFAULT false;
