import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { Database } from './database.types';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

// Supabase is required - throw error if not configured
if (!supabaseUrl || !supabaseAnonKey) {
  console.error(
    '⚠️ Supabase is not configured!\n' +
    'Please create a .env.local file with:\n' +
    'NEXT_PUBLIC_SUPABASE_URL=your_supabase_url\n' +
    'NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key'
  );
}

// Create the Supabase client with persistent sessions
export const supabase: SupabaseClient<Database> | null = 
  supabaseUrl && supabaseAnonKey 
    ? createClient<Database>(supabaseUrl, supabaseAnonKey, {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true,
          // Store session in localStorage with 30-day expiry
          storage: typeof window !== 'undefined' ? window.localStorage : undefined,
          storageKey: 'vault-auth-token',
        },
      })
    : null;

// Helper function to check if Supabase is configured
export const isSupabaseConfigured = (): boolean => {
  return !!(supabaseUrl && supabaseAnonKey && supabase);
};
