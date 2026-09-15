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
 * O que está AQUI é a seção: o percurso curto em que o bloco fica preso na
 * tela, com o conteúdo no meio e a posição que permite à cena 3D desenhar a
 * mesa inteira atrás dele. O número que liga os dois lados vai por
 * `mesaSinal.ts`.
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
      const blocoPreenchendoTela = blocoRect.top <= 1 && blocoRect.bottom >= window.innerHeight - 1;
      const ativa = recorteBaixo > recorteTopo && blocoPreenchendoTela;
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
        <div className="mx-auto w-full max-w-3xl px-6 text-center">
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
