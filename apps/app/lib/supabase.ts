import { createClient } from '@supabase/supabase-js';
import { createBrowserClient } from '@supabase/ssr';
import type { Database } from '@/types/supabase';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = typeof window !== 'undefined' && typeof document !== 'undefined'
  ? createBrowserClient<Database>(supabaseUrl, supabaseAnonKey, {
      cookieOptions: { domain: process.env.EXPO_PUBLIC_AUTH_COOKIE_DOMAIN || undefined, sameSite: 'lax', secure: window.location.protocol === 'https:' },
    })
  : createClient<Database>(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
