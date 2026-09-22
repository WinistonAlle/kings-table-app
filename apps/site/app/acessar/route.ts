import { NextRequest, NextResponse } from 'next/server';
import { authServer } from '@/lib/auth-server';

export async function GET(request: NextRequest) {
  try {
    const client = await authServer();
    const { data: { user }, error } = await client.auth.getUser();
    if (!error && user) {
      return NextResponse.redirect(new URL('/app', request.url), { headers: { 'Cache-Control': 'no-store' } });
    }
  } catch { /* Nunca redirecionar para o sistema sem validar a identidade. */ }
  return NextResponse.redirect(new URL('/login', request.url));
}
