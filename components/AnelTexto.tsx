'use client';

import { useEffect, useState } from 'react';
import { POSE_PAUSA, projetar } from './Ficha3D';

/* O texto que gira em volta da ficha, enquanto ela está parada.
 *
 * Adaptado do CircularText do React Bits, com duas mudanças:
 *
 * 1. **Sem `motion`.** A biblioteca entraria no pacote inteira para girar um
 *    texto em laço — e girar em laço é o que `@keyframes` faz de graça, no
 *    compositor, sem passar pelo JavaScript a cada quadro. O acelerar no hover
 *    também é CSS: uma troca de `animation-duration`, com transição. O que se
 *    perde é a interpolação elástica na mudança de velocidade, que ninguém vê
 *    num texto que dá uma volta a cada vinte segundos.
 *
 * 2. **O posicionamento vem da CENA 3D, não do CSS.** O original é um bloco de
 *    200x200 que o autor põe onde quiser. Aqui ele tem que ficar em volta de
 *    uma peça que vive num canvas WebGL, cujo lugar na tela depende da câmera,
 *    da proporção da janela e da escala da pose. `projetar()` é exportado pela
 *    própria cena justamente para não existirem duas contas para a mesma
 *    posição: se a pose da pausa mudar, o anel acompanha sem ninguém lembrar.
 *
 * O anel só existe durante a pausa. Fora dela a ficha está atravessando a
 * página, e um texto preso em volta de um objeto em movimento é outra coisa —
 * pior, e não era o pedido.
 */

/* Os separadores importam tanto quanto as palavras: sem eles, "KING'STABLE"
   fecha o círculo sem respiro e o olho não acha onde a frase começa. */
const TEXTO = "KING'S · TABLE · ";

/** Quanto o anel é maior que a ficha. 1,38 deixa o texto fora da borda sem
 *  descolar dela a ponto de virar um círculo independente. */
const FOLGA = 1.38;

export function AnelTexto({ progresso, visivel }: { progresso: number; visivel: boolean }) {
  const [caixa, setCaixa] = useState<{ centroX: number; centroY: number; diametro: number } | null>(
    null,
  );

  useEffect(() => {
    const medir = () =>
      setCaixa(projetar(POSE_PAUSA.pose, window.innerWidth, window.innerHeight));
    medir();
    window.addEventListener('resize', medir);
    return () => window.removeEventListener('resize', medir);
  }, []);

  if (!caixa) return null;

  /* Aparece e some junto com a pausa, com uma margem curta nas duas pontas: o
     anel entrando enquanto a ficha ainda desliza mostraria o texto perseguindo
     a peça. */
  const MARGEM = 0.02;
  const dentro =
    visivel && progresso > POSE_PAUSA.de + MARGEM && progresso < POSE_PAUSA.ate - MARGEM;

  const letras = Array.from(TEXTO);
  const tamanho = caixa.diametro * FOLGA;

  return (
    <div
      aria-hidden
      className="anel-texto pointer-events-none fixed"
      style={{
        zIndex: 6,
        left: caixa.centroX - tamanho / 2,
        top: caixa.centroY - tamanho / 2,
        width: tamanho,
        height: tamanho,
        opacity: dentro ? 1 : 0,
        transition: 'opacity 600ms ease',
      }}
    >
      <div className="anel-texto__giro" style={{ fontSize: tamanho * 0.062 }}>
        {letras.map((letra, i) => (
          <span
            key={i}
            style={{ transform: `rotate(${(360 / letras.length) * i}deg)` }}
          >
            {letra}
          </span>
        ))}
      </div>
    </div>
  );
}
