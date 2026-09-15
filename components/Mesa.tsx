'use client';

import { useEffect, useRef } from 'react';
import { useProgresso, useTelaPequena } from './useRolagem';
import { definirMesa } from './mesaSinal';
import { Rotulo, Realce } from './Secao';
import { PASSOS } from './AntesDepois';

/* A mesa, de ponta a ponta, com o conteúdo no meio do feltro.
 *
 * A mesa agora vive aqui, na própria dobra. Quando ela estava no canvas global
 * da ficha, qualquer regra de recorte ou de ativação virava piscada: a seção
 * media um ponto, a cena 3D desenhava outro. Como a mesa precisa ficar parada
 * nesta dobra, ela pertence ao layout desta dobra.
 *
 * A cena 3D ainda recebe o sinal por `mesaSinal.ts` para esconder a ficha
 * viajante enquanto esta dobra está na tela.
 */

const LUGARES = 8;

export const LUGARES_NA_MESA = LUGARES;

export function Mesa() {
  const secao = useRef<HTMLElement>(null);
  const grude = useRef<HTMLDivElement>(null);
  const progressoAtual = useRef(0);
  const p = useProgresso(secao);
  const telaPequena = useTelaPequena();
  const semMesa3D = telaPequena !== false;

  useEffect(() => {
    progressoAtual.current = Math.min(1, p);
  }, [p]);

  useEffect(() => {
    const el = secao.current;
    const bloco = grude.current;
    if (!el || semMesa3D) {
      definirMesa({ ativa: false, progresso: 0, deslocamentoY: 0, recorteTopo: 0, recorteBaixo: 0 });
      return;
    }
    if (!bloco) {
      definirMesa({ ativa: false, progresso: 0, deslocamentoY: 0, recorteTopo: 0, recorteBaixo: 0 });
      return;
    }

    let pedido = 0;
    const medir = () => {
      pedido = 0;
      const secaoRect = el.getBoundingClientRect();
      const blocoRect = bloco.getBoundingClientRect();
      const recorteTopo = Math.max(0, secaoRect.top);
      const recorteBaixo = Math.min(window.innerHeight, secaoRect.bottom);
      const ativa = secaoRect.top < window.innerHeight && secaoRect.bottom > 0;
      definirMesa({
        ativa,
        progresso: progressoAtual.current,
        deslocamentoY: blocoRect.top,
        recorteTopo,
        recorteBaixo,
      });
    };
    const aoRolar = () => {
      if (pedido) return;
      pedido = requestAnimationFrame(medir);
    };

    medir();
    window.addEventListener('scroll', aoRolar, { passive: true });
    window.addEventListener('resize', aoRolar);
    return () => {
      if (pedido) cancelAnimationFrame(pedido);
      window.removeEventListener('scroll', aoRolar);
      window.removeEventListener('resize', aoRolar);
      definirMesa({ ativa: false, progresso: 0, deslocamentoY: 0, recorteTopo: 0, recorteBaixo: 0 });
    };
  }, [semMesa3D]);

  /* Abaixo de 768px a cena 3D não roda (ver `Cena.tsx`), então a dobra volta a
     ter a altura do próprio conteúdo. */
  return (
    <section ref={secao} id="mesa" className="mesa-dobra relative w-full">
      <div ref={grude} className="mesa-grude flex w-full items-center justify-center">
        <div className="mesa-visual" aria-hidden>
          <div className="mesa-oval">
            {Array.from({ length: LUGARES }, (_, i) => (
              <span key={i} className={`mesa-pilha mesa-pilha--${i + 1}`} />
            ))}
          </div>
        </div>

        <div className="mesa-conteudo mx-auto w-full max-w-3xl px-6 text-center">
          {/* O conteúdo do bloco fica no meio do feltro. Antes havia aqui uma
              faixa de status da mesa, mas ela brigava com as fichas estáticas
              e com a peça 3D que pousa no feltro. */}
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

        </div>
      </div>
    </section>
  );
}
