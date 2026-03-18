-- ============================================================================
-- Migration 00006: user_settings + github fields em profiles
-- Migra dados que estavam em localStorage para Supabase
-- ============================================================================

-- 1. Tabela user_settings — configurações globais do usuário (providers, agentDefaults, etc.)
CREATE TABLE IF NOT EXISTS public.user_settings (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  providers   jsonb NOT NULL DEFAULT '{}'::jsonb,
  agent_defaults jsonb NOT NULL DEFAULT '{}'::jsonb,
  supervision_mode text NOT NULL DEFAULT 'watch'
    CHECK (supervision_mode IN ('autopilot', 'approve', 'watch', 'pair')),
  claude_effort text NOT NULL DEFAULT 'high'
    CHECK (claude_effort IN ('low', 'medium', 'high', 'max')),
  max_parallel_agents integer NOT NULL DEFAULT 4
    CHECK (max_parallel_agents BETWEEN 1 AND 10),
  auto_fast_model boolean NOT NULL DEFAULT false,
  theme text NOT NULL DEFAULT 'dark',
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT user_settings_user_id_unique UNIQUE (user_id)
);

-- 2. Campos GitHub em profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS github_token text,
  ADD COLUMN IF NOT EXISTS github_username text;

-- 3. RLS para user_settings
ALTER TABLE public.user_settings ENABLE ROW LEVEL SECURITY;

-- Usuário só acessa suas próprias configurações
CREATE POLICY "Users can read own settings"
  ON public.user_settings FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own settings"
  ON public.user_settings FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own settings"
  ON public.user_settings FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- 4. RLS para campos GitHub em profiles (já tem RLS habilitado)
-- As policies existentes de profiles já cobrem leitura/escrita do próprio perfil

-- 5. Índice para busca rápida por user_id
CREATE INDEX IF NOT EXISTS idx_user_settings_user_id ON public.user_settings(user_id);

-- 6. Trigger para atualizar updated_at automaticamente
CREATE OR REPLACE FUNCTION update_user_settings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER user_settings_updated_at
  BEFORE UPDATE ON public.user_settings
  FOR EACH ROW
  EXECUTE FUNCTION update_user_settings_updated_at();
