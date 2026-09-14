'use client';

import { useEffect } from 'react';
import Lenis from 'lenis';

/* Rolagem suave, e o motivo de ela existir aqui não é gosto.
 *
 * A página inteira é guiada por rolagem: o vídeo do herói avança quadro a
 * quadro e a ficha 3D atravessa as seções. Com a rolagem nativa do navegador,
 * cada entalhe da roda do mouse é um SALTO de dezenas de pixels, e um salto
 * vira um pulo no vídeo e um teleporte na ficha. O movimento fica picotado por
 * mais bem feita que esteja a cena.
 *
 * O Lenis troca o salto por uma aproximação quadro a quadro: a rolagem tem um
 * destino e caminha até ele. O vídeo e a ficha, que só leem a posição atual,
 * ganham fluidez sem saber que ele existe.
 *
 * Quem pediu menos movimento no sistema continua com a rolagem nativa. Rolagem
 * com inércia é exatamente o tipo de coisa que essa preferência existe para
 * desligar.
 */
export function RolagemSuave() {
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    const lenis = new Lenis({
      /* `duration` é quanto tempo a rolagem leva para alcançar o destino.
         Acima de ~1,4s a página começa a parecer que não obedece; abaixo de
         ~0,8s volta a picotar no vídeo. */
      duration: 1.1,
      /* Exponencial de saída: rápida no começo, freando no fim. É a curva que
         o olho lê como peso, e não como atraso. */
      easing: (t) => (t === 1 ? 1 : 1 - Math.pow(2, -10 * t)),
      /* No toque a rolagem nativa já é suave e tem física do próprio sistema.
         Substituí-la deixa o celular pior, não melhor. */
      smoothWheel: true,
      syncTouch: false,
    });

    let raf = 0;
    const passo = (t: number) => {
      lenis.raf(t);
      raf = requestAnimationFrame(passo);
    };
    raf = requestAnimationFrame(passo);

    /* Os links de âncora do topo e dos botões do herói precisam passar pelo
       Lenis: `scrollIntoView` nativo briga com ele e a página treme. */
    const aoClicar = (e: MouseEvent) => {
      const alvo = (e.target as HTMLElement)?.closest('a[href^="#"]');
      if (!alvo) return;
      const id = alvo.getAttribute('href')!.slice(1);
      const destino = document.getElementById(id);
      if (!destino) return;
      e.preventDefault();
      lenis.scrollTo(destino, { offset: -8 });
    };
    document.addEventListener('click', aoClicar);

    return () => {
      cancelAnimationFrame(raf);
      document.removeEventListener('click', aoClicar);
      lenis.destroy();
    };
  }, []);

  return null;
}
