import { NextResponse } from 'next/server';
import { clienteSupabase } from '@/lib/supabase';

/* Entrada na lista de espera.
 *
 * Duas decisões que não são óbvias:
 *
 * 1. **E-mail repetido é SUCESSO.** Quem se inscreveu há um mês e esqueceu
 *    não precisa descobrir isso na forma de um erro vermelho. O banco tem
 *    `unique` no e-mail, então a segunda tentativa volta com o código 23505,
 *    e é isso que a gente traduz para "pronto". O efeito para quem está do
 *    outro lado é o mesmo: está na lista.
 *
 * 2. **A mensagem de erro não conta o que aconteceu.** Se o Supabase estiver
 *    fora, quem visita não tem o que fazer com esse detalhe, e a mensagem
 *    técnica só serve para quem estiver sondando a rota. O detalhe vai para
 *    o log do servidor.
 */

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export async function POST(req: Request) {
  let email: unknown;
  try {
    ({ email } = (await req.json()) as { email?: unknown });
  } catch {
    return NextResponse.json({ mensagem: 'Pedido inválido.' }, { status: 400 });
  }

  const limpo = typeof email === 'string' ? email.trim().toLowerCase() : '';
  if (!EMAIL.test(limpo) || limpo.length > 254) {
    return NextResponse.json({ mensagem: 'Confere o e-mail e tenta de novo.' }, { status: 400 });
  }

  try {
    const { error } = await clienteSupabase()
      .from('lista_espera')
      .insert({ email: limpo, origem: 'landing' });

    // 23505 = violação de unicidade. Já está na lista, e isso é sucesso.
    if (error && error.code !== '23505') throw error;

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[lista] falha ao registrar:', err);
    return NextResponse.json(
      { mensagem: 'Não consegui registrar agora. Tente de novo em instantes.' },
      { status: 502 },
    );
  }
}
