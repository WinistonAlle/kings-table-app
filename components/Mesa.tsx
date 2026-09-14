'use client';

import { useEffect, useRef } from 'react';
import { useProgresso, useTelaPequena } from './useRolagem';
import { definirMesa } from './mesaSinal';
import { Rotulo, Realce } from './Secao';

/* A mesa, de ponta a ponta, com o conteúdo no meio do feltro.
 *
 * O DESENHO da mesa não está aqui: ele vive na cena 3D (`Ficha3D.tsx`), junto
 * com a ficha que atravessa a página. Isso não é organização, é o que torna a
 * coisa possível — a ficha precisa POUSAR numa pilha, e pousar de verdade
 * exige a mesma perspectiva, a mesma luz e o mesmo teste de profundidade. Com
 * a mesa num canvas à parte, o melhor que se consegue é sobrepor uma imagem
 * na outra e torcer para o ângulo bater.
 *
 * (Isto já foi um desenho em SVG, com a mesa de frente e os lugares em volta.
 * Funcionava, mas era um diagrama: a ficha não podia pousar nele, só passar
 * por cima ou por baixo.)
 *
 * O que está AQUI é a seção: a altura que dá espaço para a noite acontecer
 * enquanto se rola, o conteúdo grudado no meio da tela, e o contador. O número
 * que liga os dois lados vai por `mesaSinal.ts`.
 *
 * A seção tem 170vh de propósito. Ela precisa ser mais alta que a tela para
 * existir um PERCURSO — é ele que faz os jogadores caírem conforme a pessoa
 * rola, em vez de um relógio correndo sozinho num canto da página. O conteúdo
 * fica `sticky` e ocupa uma tela; o que passa por baixo é a noite.
 */

const LUGARES = 8;
const BUY_IN = 50;
const BOLO = LUGARES * BUY_IN;

/* 50/30/20 é o que o app aplica a um campo de 6 a 9 jogadores
   (`percentuais()` em `lib/payouts.ts` do aplicativo). Demonstração que
   inventa a conta é pior que nenhuma demonstração. */
const PREMIOS = [
  { posicao: '1º', valor: BOLO * 0.5 },
  { posicao: '2º', valor: BOLO * 0.3 },
  { posicao: '3º', valor: BOLO * 0.2 },
];

/* A janela em que a mesa esvazia. Sobra folga nas duas pontas: entrando, para
   a mesa chegar cheia; saindo, para o campeão ficar um tempo sozinho antes de
   a dobra ir embora. */
export const QUEDA_DE = 0.16;
export const QUEDA_ATE = 0.78;
export const LUGARES_NA_MESA = LUGARES;

/** Quantos já caíram, dado o progresso da dobra. Exportada porque a cena 3D
 *  precisa da MESMA conta para apagar as pilhas na hora certa. */
export function quedasEm(progresso: number) {
  const t = Math.min(1, Math.max(0, (progresso - QUEDA_DE) / (QUEDA_ATE - QUEDA_DE)));
  return Math.min(LUGARES - 1, Math.floor(t * LUGARES));
}

export function Mesa() {
  const secao = useRef<HTMLElement>(null);
  const p = useProgresso(secao);
  const telaPequena = useTelaPequena();
  const semMesa3D = telaPequena !== false;

  useEffect(() => {
    definirMesa({ ativa: true, progresso: Math.min(1, p) });
    return () => definirMesa({ ativa: false, progresso: 0 });
  }, [p]);

  /* Sem a mesa 3D não há percurso: o contador mostra o desfecho. */
  const quedas = semMesa3D ? LUGARES - 1 : quedasEm(Math.min(1, p));
  const restantes = LUGARES - quedas;
  const nivel = 1 + Math.floor(quedas / 2);
  const acabou = restantes === 1;

  /* A altura grande da dobra (170vh, no CSS) é o PERCURSO da eliminação, e ela
     só faz sentido onde a mesa 3D existe. Abaixo de 768px a cena não roda (ver
     `Cena.tsx`), e 170vh viraria uma tela e meia de preto com um texto grudado
     no meio: lá a dobra volta a ter a altura do próprio conteúdo. */
  return (
    <section ref={secao} id="mesa" className="mesa-dobra relative w-full">
      <div className="mesa-grude flex w-full items-center justify-center">
        <div className="mx-auto w-full max-w-lg px-6 text-center">
          <Rotulo>A noite, de cima</Rotulo>
          <h2 className="titulo mt-4 t-secao text-balance text-text0">
            Oito entram. <Realce>Um leva</Realce>.
          </h2>

          {/* O contador fica no MEIO do feltro, que é para onde as pilhas em
              volta apontam — e onde o olho já está. */}
          <dl className="mt-10 flex items-start justify-center gap-10">
            <div>
              <dt className="rotulo text-gold500">Nível</dt>
              <dd className="mt-1 font-mono t-ornamento text-text0">{nivel}</dd>
            </div>
            <div className="h-14 w-px self-center bg-lineStrong" aria-hidden />
            <div>
              <dt className="rotulo text-gold500">De pé</dt>
              <dd className="mt-1 font-mono t-ornamento text-text0">
                {restantes}
                <span className="t-apoio text-text3"> / {LUGARES}</span>
              </dd>
            </div>
          </dl>

          {/* A premiação só aparece quando sobra um: é o desfecho, e desfecho
              que está na tela desde o começo não lê como desfecho. */}
          <div
            className="mesa-premios mt-9"
            style={{ opacity: acabou ? 1 : 0 }}
            aria-hidden={!acabou}
          >
            <p className="rotulo text-gold500">Premiação</p>
            <ul className="mt-3 flex items-baseline justify-center gap-7">
              {PREMIOS.map((premio) => (
                <li key={premio.posicao} className="flex items-baseline gap-2">
                  <span className="font-mono t-apoio text-gold300">{premio.posicao}</span>
                  <span className="t-corpo text-text0">R$ {premio.valor.toFixed(0)}</span>
                </li>
              ))}
            </ul>
          </div>

          <p className="medida mx-auto mt-9 t-apoio text-text2">
            Ninguém digitou nada disso. A posição sai de quem ainda está de pé,
            e as faixas acompanham o tamanho do campo.
          </p>
        </div>
      </div>
    </section>
  );
}
