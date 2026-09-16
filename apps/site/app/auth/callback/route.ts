import { NextRequest, NextResponse } from 'next/server';
import { authServer } from '@/lib/auth-server';

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get('code');
  if (code) {
    try {
      const client = await authServer();
      const { error } = await client.auth.exchangeCodeForSession(code);
      if (!error) return NextResponse.redirect(new URL(request.nextUrl.searchParams.get('destino') === 'senha' ? '/nova-senha' : '/acessar', request.url));
    } catch { /* Link invalido ou servico indisponivel: voltar ao login. */ }
  }
  return NextResponse.redirect(new URL('/login?erro=link', request.url));
}
