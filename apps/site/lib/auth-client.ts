'use client';

import { createBrowserClient } from '@supabase/ssr';

export function authClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) throw new Error('Autenticacao nao configurada.');
  return createBrowserClient(url, key, {
    cookieOptions: {
      domain: process.env.NEXT_PUBLIC_AUTH_COOKIE_DOMAIN || undefined,
      sameSite: 'lax',
      secure: window.location.protocol === 'https:',
    },
  });
}
