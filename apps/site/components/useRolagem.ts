'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * Quanto de um elemento já foi percorrido pela rolagem, de 0 a 1.
 *
 * Devolve `0` enquanto o topo do elemento não chegou ao topo da tela, e `1`
 * quando o fim dele passou. É a régua que todo efeito guiado por rolagem usa
 * nesta página — vídeo raspado e ficha 3D leem a mesma.
 *
 * Atualiza dentro de um `requestAnimationFrame`: o evento de rolagem dispara
 * muito mais vezes que o navegador desenha, e responder a todos é trabalho
 * jogado fora.
 */
export function useProgresso(alvo: React.RefObject<HTMLElement | null>) {
  const [p, setP] = useState(0);
  const pedido = useRef(0);

  useEffect(() => {
    const el = alvo.current;
    if (!el) return;

    const medir = () => {
      pedido.current = 0;
      const r = el.getBoundingClientRect();
      /* O percurso é a altura do elemento menos uma tela: é quanto dá pra
         rolar com ele ocupando a viewport. */
      const percurso = r.height - window.innerHeight;
      if (percurso <= 0) {
        setP(r.top <= 0 ? 1 : 0);
        return;
      }
      setP(Math.min(1, Math.max(0, -r.top / percurso)));
    };

    const aoRolar = () => {
      if (pedido.current) return;
      pedido.current = requestAnimationFrame(medir);
    };

    medir();
    window.addEventListener('scroll', aoRolar, { passive: true });
    window.addEventListener('resize', aoRolar);
    return () => {
      if (pedido.current) cancelAnimationFrame(pedido.current);
      window.removeEventListener('scroll', aoRolar);
      window.removeEventListener('resize', aoRolar);
    };
  }, [alvo]);

  return p;
}

/** `true` quando a tela é estreita o bastante pra não valer cena pesada. */
export function useTelaPequena(limite = 768) {
  const [pequena, setPequena] = useState<boolean | null>(null);
  useEffect(() => {
    const mq = window.matchMedia(`(max-width: ${limite}px)`);
    const ver = () => setPequena(mq.matches);
    ver();
    mq.addEventListener('change', ver);
    return () => mq.removeEventListener('change', ver);
  }, [limite]);
  return pequena;
}

/** Respeita quem pediu menos movimento no sistema. */
export function useMenosMovimento() {
  const [menos, setMenos] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const ver = () => setMenos(mq.matches);
    ver();
    mq.addEventListener('change', ver);
    return () => mq.removeEventListener('change', ver);
  }, []);
  return menos;
}
