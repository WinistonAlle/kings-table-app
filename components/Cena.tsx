'use client';

import { useEffect, useRef, useState } from 'react';
import { Ficha3D } from './Ficha3D';
import { AnelTexto } from './AnelTexto';
import { useMenosMovimento, useTelaPequena } from './useRolagem';

/* O maestro da ficha.
 *
 * Existe por um motivo só: a ficha 3D não pertence a nenhuma seção. Ela nasce
 * no fim do herói e atravessa a página inteira até a pilha, então quem mede o
 * percurso dela tem que estar fora de todas as seções e enxergar o documento.
 *
 * A emenda com o vídeo é o momento delicado. O herói é `sticky` dentro de uma
 * seção de 260vh: enquanto ela rola, o vídeo fica parado na tela e o quadro
 * avança. Quando ela acaba, o último quadro está congelado com a ficha de
 * frente no centro — e é exatamente aí que a ficha 3D acende, já calibrada
 * para o mesmo tamanho e lugar. Depois disso o herói sobe e leva o vídeo
 * embora; a ficha, que é `fixed`, fica.
 */

/* Quantos pixels antes do fim do herói a ficha 3D já está acesa.
 *
 * Pequeno, mas não zero, e a razão é de ordem: quem acende a ficha é o
 * ouvinte de rolagem daqui, e quem corta para a maleta vazia é o do
 * `HeroVideo`. São dois ouvintes diferentes, cada um agrupado no seu quadro,
 * então nada garante que caiam no MESMO quadro.
 *
 * Se a placa cortasse primeiro, haveria um quadro com a maleta vazia e sem
 * ficha nenhuma — uma piscada de verdade. Com a ficha acendendo alguns pixels
 * antes, a ordem fica garantida: no pior caso ela fica um quadro em cima da
 * ficha do vídeo, que é invisível, porque as duas coincidem.
 *
 * Eram 12px, e nesse trecho o vídeo ainda não chegou ao último quadro: a
 * ficha dele ainda cresce enquanto a 3D já nasce no tamanho final. 4px é
 * folga suficiente para a ordem e curto o bastante para o tamanho não
 * divergir. */
const ANTECIPACAO = 4;

export function Cena() {
  const [progresso, setProgresso] = useState(0);
  const [visivel, setVisivel] = useState(false);
  const pedido = useRef(0);
  const pequena = useTelaPequena();
  const menosMovimento = useMenosMovimento();

  const desligada = pequena === true || menosMovimento;

  useEffect(() => {
    if (desligada) return;

    const medir = () => {
      pedido.current = 0;
      const heroi = document.getElementById('heroi');
      if (!heroi) return;

      /* Onde o herói termina, em coordenadas do documento. */
      const fim = heroi.offsetTop + heroi.offsetHeight - window.innerHeight;
      const y = window.scrollY;

      if (y < fim - ANTECIPACAO) {
        setVisivel(false);
        setProgresso(0);
        return;
      }
      setVisivel(true);

      /* Daqui até o fim da página é o percurso da ficha. */
      const total = document.documentElement.scrollHeight - window.innerHeight;
      const percurso = total - fim;
      setProgresso(percurso <= 0 ? 0 : Math.min(1, Math.max(0, (y - fim) / percurso)));
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
  }, [desligada]);

  if (desligada) return null;

  return (
    <>
      {/* O brilho quente que no vídeo vem de trás da ficha. Sem ele o fundo
          "apaga" no instante da troca: o vídeo tem essa aura, a cena 3D com
          fundo transparente não teria. */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 transition-opacity duration-500"
        style={{
          zIndex: 4,
          opacity: visivel ? 1 - progresso * 0.55 : 0,
          background:
            'radial-gradient(46% 42% at 50% 50%, rgba(196,156,92,0.22) 0%, rgba(150,110,60,0.10) 42%, transparent 72%)',
        }}
      />
      <Ficha3D progresso={progresso} visivel={visivel} />
      {/* Em cima da ficha (z-index 6 contra 5): o anel é texto e precisa ser
          lido, não competir com a peça. */}
      <AnelTexto progresso={progresso} visivel={visivel} />
    </>
  );
}
