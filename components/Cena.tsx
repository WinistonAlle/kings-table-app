'use client';

import { useEffect, useRef, useState } from 'react';
import { Ficha3D } from './Ficha3D';
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

/* A ficha 3D acende EXATAMENTE no fim do herói, nem um pixel antes.
 *
 * Aqui havia 12px de antecipação, para não existir um quadro sem ficha
 * nenhuma. Ela criava o problema que queria evitar: nesses 12px o vídeo ainda
 * não chegou ao último quadro, a ficha dele ainda está crescendo, e a 3D já
 * nasce no tamanho final. Trocava-se uma peça por outra de tamanho diferente,
 * e o olho lia isso como uma piscada. Medido: o brilho médio do quadro subia
 * 3,91 de uma vez só nesse ponto, contra variações de ±0,2 em todo o resto da
 * travessia, e a diferença estava inteira dentro do disco da ficha.
 *
 * Não existe quadro sem ficha: a do vídeo está lá até o último instante. */
const ANTECIPACAO = 0;

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
          "apaga" quando o herói sai de cena: o vídeo tem essa aura, a cena 3D
          com fundo transparente não teria.
          Mas ele NÃO pode acender na hora da troca. Ele acendia de 0 a 1 em
          500ms exatamente ali, somando a própria aura por cima da que o vídeo
          já desenha — e duas auras somadas no mesmo instante é o que se via
          como uma piscada. Agora ele entra pela ROLAGEM, do zero, ao longo
          dos primeiros 6% do percurso, que é quando o vídeo está saindo e a
          aura dele indo embora junto. */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0"
        style={{
          zIndex: 4,
          opacity: visivel
            ? Math.min(1, Math.max(0, progresso / 0.05)) * (1 - progresso * 0.55)
            : 0,
          background:
            'radial-gradient(46% 42% at 50% 50%, rgba(196,156,92,0.22) 0%, rgba(150,110,60,0.10) 42%, transparent 72%)',
        }}
      />
      <Ficha3D progresso={progresso} visivel={visivel} />
    </>
  );
}
