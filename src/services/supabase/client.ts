/**
 * Cliente Supabase singleton tipado para uso em toda a aplicação.
 * Utiliza variáveis de ambiente VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY.
 */

import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Database } from './database.types';

// Variáveis de ambiente obrigatórias — validação em tempo de execução
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Variáveis de ambiente VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY são obrigatórias. ' +
      'Verifique o arquivo .env na raiz do projeto.',
  );
}

/**
 * Cliente Supabase tipado — singleton exportado para toda a aplicação.
 * As queries retornam tipos inferidos do schema (database.types.ts).
 */
export const supabase: SupabaseClient<Database> = createClient<Database>(
  supabaseUrl,
  supabaseAnonKey,
  {
    auth: {
      // Persistir sessão no localStorage para manter login entre recarregamentos
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
    realtime: {
      params: {
        // Habilitar envio de eventos de presença
        eventsPerSecond: 10,
      },
    },
  },
);

export type TypedSupabaseClient = typeof supabase;
