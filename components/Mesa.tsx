'use client';

import { useEffect, useRef } from 'react';
import { useProgresso, useTelaPequena } from './useRolagem';
import { definirMesa } from './mesaSinal';
import { Rotulo, Realce } from './Secao';
import { PASSOS } from './AntesDepois';

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

/* A estrutura de blinds sobe a cada duas quedas, que é o ritmo de uma mesa
   que encolhe. Quatro níveis para sete eliminações. */
const BLINDS = [
  [25, 50],
  [50, 100],
  [100, 200],
  [200, 400],
];

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
  const nivel = Math.min(BLINDS.length, 1 + Math.floor(quedas / 2));
  const [blindPequeno, blindGrande] = BLINDS[nivel - 1];
  const acabou = restantes === 1;

  /* A altura grande da dobra (170vh, no CSS) é o PERCURSO da eliminação, e ela
     só faz sentido onde a mesa 3D existe. Abaixo de 768px a cena não roda (ver
     `Cena.tsx`), e 170vh viraria uma tela e meia de preto com um texto grudado
     no meio: lá a dobra volta a ter a altura do próprio conteúdo. */
  return (
    <section ref={secao} id="mesa" className="mesa-dobra relative w-full">
      <div className="mesa-grude flex w-full items-center justify-center">
        <div className="mx-auto w-full max-w-3xl px-6 text-center">
          {/* O conteúdo do bloco fica no meio do feltro, e é o que o
              organizador de fato olha durante a noite: nível, blinds, quantos
              restam, quanto tem no bolo. Antes havia aqui uma frase de efeito
              ("Oito entram. Um leva.") e um parágrafo explicando o que a
              animação já mostrava. Mostrar o painel vale mais que descrevê-lo:
              é a única parte desta página em que o produto aparece. */}
          <Rotulo>Enquanto isso</Rotulo>
          <h2 className="titulo mt-4 t-secao text-balance text-text0">
            Três passos, e a noite <Realce>cuida de si</Realce>.
          </h2>

          {/* Os três passos vieram da dobra anterior, e o lugar deles é este:
              embaixo eles descreviam um laço que o leitor tinha que imaginar;
              aqui em cima do feltro, com as pilhas sumindo em volta, eles são
              legenda do que está acontecendo. */}
          <ol className="mt-10 grid gap-7 text-left sm:grid-cols-3 sm:gap-6">
            {PASSOS.map((passo) => (
              <li key={passo.n}>
                <span aria-hidden className="titulo block text-[1.6rem] leading-none text-gold600">
                  {passo.n}
                </span>
                <h3 className="titulo mt-2 t-card text-gold200">{passo.titulo}</h3>
                <p className="mt-1.5 t-apoio text-text2">{passo.texto}</p>
              </li>
            ))}
          </ol>

          {/* O painel do relógio: o que o organizador de fato olha durante a
              noite. Ele muda com a rolagem, junto com as pilhas. */}
          <dl className="mt-10 flex flex-wrap items-baseline justify-center gap-x-9 gap-y-4 border-t border-line pt-7">
            <div className="flex items-baseline gap-2">
              <dt className="rotulo text-gold500">Nível</dt>
              <dd className="font-mono t-corpo text-text0">{nivel}</dd>
            </div>
            <div className="flex items-baseline gap-2">
              <dt className="rotulo text-gold500">Blinds</dt>
              <dd className="font-mono t-corpo text-text0">
                {blindPequeno}
                <span className="text-text3">/</span>
                {blindGrande}
              </dd>
            </div>
            <div className="flex items-baseline gap-2">
              <dt className="rotulo text-gold500">De pé</dt>
              <dd className="font-mono t-corpo text-text0">
                {restantes}
                <span className="text-text3">/{LUGARES}</span>
              </dd>
            </div>
            <div className="flex items-baseline gap-2">
              <dt className="rotulo text-gold500">Bolo</dt>
              <dd className="font-mono t-corpo text-text0">R$ {BOLO}</dd>
            </div>
          </dl>

          {/* A premiação só aparece quando sobra um: é o desfecho, e desfecho
              que está na tela desde o começo não lê como desfecho. */}
          <div
            className="mesa-premios mt-8"
            style={{ opacity: acabou ? 1 : 0 }}
            aria-hidden={!acabou}
          >
            <p className="rotulo text-gold500">Pago na hora</p>
            <ul className="mt-3 flex items-baseline justify-center gap-8">
              {PREMIOS.map((premio) => (
                <li key={premio.posicao} className="flex items-baseline gap-2">
                  <span className="font-mono t-apoio text-gold300">{premio.posicao}</span>
                  <span className="t-corpo text-text0">R$ {premio.valor.toFixed(0)}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}
