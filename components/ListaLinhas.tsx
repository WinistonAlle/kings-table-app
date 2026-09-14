'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

/* Índice com linhas que reagem à proximidade do ponteiro.
 *
 * O motor é o do LineSidebar (React Bits) e ele é bom pelo motivo certo: um
 * único laço de `requestAnimationFrame` escreve uma variável CSS por item, e
 * cor, deslocamento e escala da linha derivam TODAS dessa mesma variável. Com
 * transições CSS separadas, cada propriedade chegaria no seu tempo e o
 * conjunto ficaria escalonado; aqui elas andam juntas por construção.
 *
 * A suavização é independente da taxa de quadros (`1 - e^(-dt/tau)`), então
 * num monitor de 120Hz o efeito não corre com o dobro da velocidade — o mesmo
 * cuidado que a ficha 3D desta página já toma.
 *
 * Três mudanças em relação ao original:
 *
 * 1. **`<button>` no lugar de `<li onClick>`.** O original troca conteúdo com
 *    um clique num item de lista: quem navega por teclado não alcança, e o
 *    leitor de tela não anuncia que aquilo é acionável. Aqui cada item é botão
 *    de verdade, com `aria-pressed`.
 * 2. **Sem proximidade no dedo.** Em `pointer: coarse` não existe cursor
 *    pairando: o efeito só dispararia no toque, exatamente quando a pessoa já
 *    decidiu clicar. Os ouvintes não chegam a ser registrados.
 * 3. **Controlado por quem chama.** O original guarda o ativo dentro de si, o
 *    que serve para um menu que não conversa com ninguém. Aqui o painel ao
 *    lado precisa saber qual é o ativo, então o estado mora fora.
 */

const CURVAS = {
  linear: (p: number) => p,
  suave: (p: number) => p * p * (3 - 2 * p),
  seca: (p: number) => p * p * p,
};

const ponteiroGrosso = () =>
  typeof window !== 'undefined' &&
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(pointer: coarse)').matches;

export function ListaLinhas({
  itens,
  ativo,
  onEscolher,
  raio = 110,
  deslocamento = 26,
  suavizacao = 120,
}: {
  itens: string[];
  ativo: number;
  onEscolher: (i: number) => void;
  raio?: number;
  deslocamento?: number;
  suavizacao?: number;
}) {
  const lista = useRef<HTMLUListElement>(null);
  const refs = useRef<(HTMLLIElement | null)[]>([]);
  const alvos = useRef<number[]>([]);
  const atuais = useRef<number[]>([]);
  const raf = useRef<number | null>(null);
  const ultimo = useRef(0);
  const ativoRef = useRef(ativo);
  const [semProximidade, setSemProximidade] = useState(true);

  ativoRef.current = ativo;

  useEffect(() => {
    setSemProximidade(ponteiroGrosso());
  }, []);

  const quadro = useCallback(
    (agora: number) => {
      const dt = Math.min((agora - ultimo.current) / 1000, 0.05);
      ultimo.current = agora;
      /* Suavização exponencial por SEGUNDO, não por quadro: em 120Hz um passo
         por quadro andaria o dobro. */
      const k = 1 - Math.exp(-dt / (Math.max(suavizacao, 1) / 1000));

      let andando = false;
      refs.current.forEach((el, i) => {
        if (!el) return;
        /* O item ativo fica em 1 mesmo sem o ponteiro por perto: é ele que
           está sendo lido no painel ao lado. */
        const alvo = Math.max(alvos.current[i] || 0, ativoRef.current === i ? 1 : 0);
        const atual = atuais.current[i] || 0;
        const proximo = atual + (alvo - atual) * k;
        const parou = Math.abs(alvo - proximo) < 0.0015;
        const valor = parou ? alvo : proximo;
        atuais.current[i] = valor;
        el.style.setProperty('--efeito', valor.toFixed(4));
        if (!parou) andando = true;
      });

      raf.current = andando ? requestAnimationFrame(quadro) : null;
    },
    [suavizacao],
  );

  const ligar = useCallback(() => {
    if (raf.current != null) cancelAnimationFrame(raf.current);
    ultimo.current = performance.now();
    raf.current = requestAnimationFrame(quadro);
  }, [quadro]);

  useEffect(() => {
    ligar();
    return () => {
      if (raf.current != null) cancelAnimationFrame(raf.current);
      raf.current = null;
    };
  }, [ativo, ligar]);

  const aoMover = (e: React.PointerEvent) => {
    const el = lista.current;
    if (!el) return;
    const caixa = el.getBoundingClientRect();
    const y = e.clientY - caixa.top;
    refs.current.forEach((item, i) => {
      if (!item) return;
      const centro = item.offsetTop + item.offsetHeight / 2;
      alvos.current[i] = CURVAS.suave(Math.max(0, 1 - Math.abs(y - centro) / raio));
    });
    ligar();
  };

  const aoSair = () => {
    alvos.current = alvos.current.map(() => 0);
    ligar();
  };

  return (
    <ul
      ref={lista}
      className="lista-linhas"
      style={
        {
          '--deslocamento': `${deslocamento}px`,
        } as React.CSSProperties
      }
      onPointerMove={semProximidade ? undefined : aoMover}
      onPointerLeave={semProximidade ? undefined : aoSair}
    >
      {itens.map((rotulo, i) => (
        <li
          key={rotulo}
          ref={(el) => {
            refs.current[i] = el;
          }}
          className="lista-linhas__item"
        >
          <span aria-hidden className="lista-linhas__risco" />
          <button
            type="button"
            className="lista-linhas__botao"
            aria-pressed={ativo === i}
            onClick={() => onEscolher(i)}
            onFocus={() => onEscolher(i)}
          >
            <span className="lista-linhas__numero">{String(i + 1).padStart(2, '0')}</span>
            <span className="lista-linhas__texto">{rotulo}</span>
          </button>
        </li>
      ))}
    </ul>
  );
}
