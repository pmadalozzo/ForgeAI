/**
 * Cliente Supabase seguro — retorna null se as variaveis de ambiente nao estiverem configuradas.
 * Usado pela LoginPage para evitar crash quando Supabase nao esta disponivel.
 */

import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Database } from './database.types';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

/** Cliente Supabase — null se as variaveis de ambiente nao estao presentes */
let safeSupabase: SupabaseClient<Database> | null = null;

if (supabaseUrl && supabaseAnonKey) {
  try {
    safeSupabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
      realtime: {
        params: {
          eventsPerSecond: 10,
        },
      },
    });
  } catch {
    safeSupabase = null;
  }
}

/** Retorna true se o Supabase esta disponivel (env vars presentes e client criado) */
export function isSupabaseAvailable(): boolean {
  return safeSupabase !== null;
}

/** Cliente Supabase ou null */
export function getSupabaseClient(): SupabaseClient<Database> | null {
  return safeSupabase;
}
