'use client';

import { useState } from 'react';
import { SpecularRim } from './SpecularRim';

/* O destino da página inteira.
 *
 * Todos os botões daqui apontavam para `#` ou para a seção de preços: não
 * havia para onde mandar ninguém, porque não há produto para entregar ainda.
 * Uma lista de espera é o único destino honesto nesse estado — e é o que
 * transforma uma página bonita em uma página que faz alguma coisa.
 *
 * Três estados e um campo. Sem biblioteca de formulário: é um campo.
 *
 * O `type="email"` e o `required` fazem o navegador validar antes de sair do
 * aparelho, o que é mais rápido que qualquer ida ao servidor. A validação de
 * verdade mora na rota, porque validação no cliente é cortesia, não defesa.
 */

type Estado = 'parado' | 'enviando' | 'pronto';

export function ListaEspera() {
  const [email, setEmail] = useState('');
  const [estado, setEstado] = useState<Estado>('parado');
  const [erro, setErro] = useState<string | null>(null);

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    setEstado('enviando');
    try {
      const r = await fetch('/api/lista', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      if (!r.ok) {
        const corpo = (await r.json().catch(() => ({}))) as { mensagem?: string };
        throw new Error(corpo.mensagem ?? 'Não consegui registrar agora. Tente de novo.');
      }
      setEstado('pronto');
    } catch (err) {
      setEstado('parado');
      setErro(err instanceof Error ? err.message : 'Não consegui registrar agora.');
    }
  }

  /* Quem já entrou vê a confirmação no LUGAR do formulário, e não abaixo dele:
     um campo vazio ao lado de "pronto" convida a mandar de novo. */
  if (estado === 'pronto') {
    return (
      <p className="t-corpo text-gold200" role="status">
        Pronto. Você é avisado antes de todo mundo.
      </p>
    );
  }

  return (
    <form onSubmit={enviar} className="w-full max-w-md">
      <div className="flex flex-col gap-3 sm:flex-row">
        <label className="sr-only" htmlFor="email-lista">
          Seu e-mail
        </label>
        <input
          id="email-lista"
          type="email"
          required
          autoComplete="email"
          inputMode="email"
          placeholder="voce@email.com"
          value={email}
          onChange={(ev) => setEmail(ev.target.value)}
          disabled={estado === 'enviando'}
          className="min-w-0 flex-1 rounded-full border border-lineStrong bg-bg1 px-6 py-3.5 t-apoio text-text0 outline-none transition-colors placeholder:text-text3 focus:border-gold500 disabled:opacity-60"
        />
        <button
          type="submit"
          disabled={estado === 'enviando'}
          className="botao-ouro shrink-0 rounded-full px-7 py-3.5 t-apoio font-semibold disabled:opacity-70"
        >
          {estado !== 'enviando' && <SpecularRim />}
          {estado === 'enviando' ? 'Entrando…' : 'Entrar na lista'}
        </button>
      </div>

      {erro ? (
        <p className="mt-3 t-micro text-danger" role="alert">
          {erro}
        </p>
      ) : (
        <p className="mt-3 t-micro text-text3">
          Só para avisar quando abrir. Sem newsletter, sem repasse.
        </p>
      )}
    </form>
  );
}
