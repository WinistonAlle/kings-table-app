'use client';

import { useEffect, useRef, useState } from 'react';
import { Rotulo, Secao, Titulo, Realce } from './Secao';

/* Uma noite inteira, vista de cima.
 *
 * Esta dobra vem logo depois dos três passos, e é de propósito: lá o laço da
 * noite está escrito em palavras, aqui ele ACONTECE. Cartas saem, os blinds
 * sobem, os jogadores caem em ordem e cada um recebe a posição na hora; no
 * fim sobra um e a premiação aparece calculada. É o produto inteiro em sete
 * segundos, sem uma única captura de tela.
 *
 * Por que desenho e não render 3D: a mesa é vista DE CIMA, e de cima uma mesa
 * é uma elipse com marcas em volta. Modelar isso em três dimensões custaria
 * um segundo contexto WebGL nesta página (que já tem o vídeo do herói e a
 * cena da ficha) para chegar ao mesmo desenho. O SVG escala sozinho, imprime
 * nítido em qualquer densidade de tela e não depende de GPU.
 *
 * Os números são os DE VERDADE: as faixas 50/30/20 saem de `percentuais()` em
 * `lib/payouts.ts` do aplicativo, para oito jogadores. Uma demonstração que
 * inventa a conta é pior que nenhuma demonstração.
 */

const LUGARES = 8;
const BUY_IN = 50;
const BOLO = LUGARES * BUY_IN;
/* 50/30/20 é o que o app aplica para campos de 6 a 9 jogadores. */
const PREMIOS = [
  { posicao: '1º', valor: BOLO * 0.5 },
  { posicao: '2º', valor: BOLO * 0.3 },
  { posicao: '3º', valor: BOLO * 0.2 },
];

/* A ordem em que os lugares caem. Não é em volta da mesa de propósito: numa
   noite real quem cai primeiro está em qualquer cadeira, e uma sequência
   horária denunciaria o roteiro. O lugar 0 (embaixo, no centro) é o último a
   ficar de pé, porque é para ele que o olho vai primeiro. */
const QUEDAS = [5, 2, 7, 3, 6, 1, 4];

const PASSO_MS = 720;
const ESPERA_INICIAL = 1100;

/* A geometria da mesa, em coordenadas do viewBox.
   Os lugares ficam bem FORA do aro (+64 e +58): encostados, eles leem como
   marcas no feltro em vez de cadeiras, e o número da posição some contra a
   borda. */
const CX = 400;
const CY = 238;
const RX = 248;
const RY = 136;
const AFASTA_X = 64;
const AFASTA_Y = 58;

function posicaoDoLugar(i: number) {
  /* Começa embaixo e anda no sentido horário. O raio dos lugares é maior que
     o da mesa: eles ficam FORA do feltro, como cadeiras. */
  const angulo = (Math.PI / 2 + (i * 2 * Math.PI) / LUGARES) * -1 + Math.PI;
  return {
    x: CX + (RX + AFASTA_X) * Math.cos(angulo),
    y: CY + (RY + AFASTA_Y) * Math.sin(angulo),
    /* Quanto a carta gira para "apontar" para o centro da mesa. Só as CARTAS
       giram: o número da posição fica na horizontal, senão metade da mesa
       teria número de cabeça para baixo. */
    giro:
      (Math.atan2(-(RY + AFASTA_Y) * Math.sin(angulo), -(RX + AFASTA_X) * Math.cos(angulo)) * 180) /
        Math.PI +
      90,
  };
}

const LUGARES_POS = Array.from({ length: LUGARES }, (_, i) => posicaoDoLugar(i));

export function Mesa() {
  const alvo = useRef<HTMLDivElement>(null);
  /* -1 = parada. 0 = cartas na mesa. 1..7 = quedas. 8 = campeão e premiação. */
  const [passo, setPasso] = useState(-1);

  useEffect(() => {
    const el = alvo.current;
    if (!el) return;

    const menosMovimento =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    /* Movimento reduzido recebe o ESTADO FINAL, não o vazio: a informação da
       dobra é o resultado da noite, e ela não pode depender de animação. */
    if (menosMovimento || typeof IntersectionObserver === 'undefined') {
      setPasso(8);
      return;
    }

    let temporizadores: number[] = [];
    let tocando = false;

    const limpar = () => {
      temporizadores.forEach(clearTimeout);
      temporizadores = [];
    };

    const tocar = () => {
      /* Não reinicia no meio. A dobra pode entrar e sair de vista enquanto a
         pessoa ajusta a rolagem, e a primeira versão disto limpava os
         temporizadores na saída: a noite congelava no sexto eliminado e nunca
         chegava ao campeão. Uma vez começada, ela termina. */
      if (tocando) return;
      tocando = true;
      limpar();
      setPasso(0);
      for (let i = 1; i <= QUEDAS.length + 1; i++) {
        temporizadores.push(
          window.setTimeout(() => {
            setPasso(i);
            if (i === QUEDAS.length + 1) tocando = false;
          }, ESPERA_INICIAL + (i - 1) * PASSO_MS),
        );
      }
    };

    const obs = new IntersectionObserver(
      ([e]) => {
        /* Toca de novo a cada entrada, ao contrário do texto da promessa.
           Lá repetir seria um piscar; aqui é uma demonstração, e quem volta
           para rever quer ver de novo. */
        if (e.isIntersecting) tocar();
      },
      { threshold: 0.35 },
    );
    obs.observe(el);
    return () => {
      obs.disconnect();
      limpar();
    };
  }, []);

  const quedasFeitas = Math.max(0, Math.min(passo, QUEDAS.length));
  const restantes = LUGARES - quedasFeitas;
  /* Os blinds sobem a cada duas quedas: é o ritmo de uma mesa que encolhe. */
  const nivel = 1 + Math.floor(quedasFeitas / 2);
  const acabou = passo > QUEDAS.length;

  /** Em que posição este lugar terminou, ou null se ainda está de pé. */
  const posicaoDe = (lugar: number) => {
    const ordem = QUEDAS.indexOf(lugar);
    if (ordem === -1) return acabou ? 1 : null;
    return ordem < quedasFeitas ? LUGARES - ordem : null;
  };

  return (
    <Secao id="mesa" className="py-24 lg:py-32">
      <div className="max-w-2xl">
        <Rotulo>A noite, de cima</Rotulo>
        <Titulo>
          Oito na mesa. No fim, <Realce>um nome e três prêmios</Realce>.
        </Titulo>
      </div>

      <div
        ref={alvo}
        className="mt-14 grid items-center gap-10 lg:grid-cols-[1fr_minmax(0,17rem)] lg:gap-14"
      >
        <svg
          viewBox="0 0 800 476"
          className="mesa w-full"
          role="img"
          aria-label={`Mesa de oito jogadores vista de cima. ${
            acabou
              ? 'A noite terminou: um campeão e três prêmios.'
              : `Nível ${nivel}, ${restantes} jogadores de pé.`
          }`}
        >
          <defs>
            <radialGradient id="feltro" cx="50%" cy="42%" r="72%">
              <stop offset="0%" stopColor="#1a1a1a" />
              <stop offset="100%" stopColor="#0c0c0c" />
            </radialGradient>
          </defs>

          {/* O aro e o feltro. Dois traços concêntricos: o de fora é a borda
              acolchoada, o de dentro é a linha onde as cartas comunitárias
              param numa mesa de verdade. */}
          <ellipse cx={CX} cy={CY} rx={RX + 16} ry={RY + 16} fill="none" stroke="var(--color-gold700)" strokeWidth="10" />
          <ellipse cx={CX} cy={CY} rx={RX} ry={RY} fill="url(#feltro)" stroke="var(--color-gold600)" strokeWidth="1.5" />
          <ellipse cx={CX} cy={CY} rx={RX - 54} ry={RY - 54} fill="none" stroke="var(--color-gold700)" strokeWidth="1" strokeDasharray="3 7" />

          {/* O centro: o bolo da noite. */}
          <g className={`mesa__bolo ${passo >= 0 ? 'mesa__bolo--vivo' : ''}`}>
            {/* O rótulo e o valor ficam ABAIXO do centro: o centro é onde a
                ficha 3D pousa, virando o bolo em objeto. Centralizados, eles
                sumiam atrás dela — e o valor é justamente o que esta dobra
                existe para mostrar. */}
            <text x={CX} y={CY + 60} textAnchor="middle" className="mesa__rotulo">
              BOLO
            </text>
            <text x={CX} y={CY + 94} textAnchor="middle" className="mesa__bolo-valor">
              R$ {BOLO}
            </text>
          </g>

          {/* Os lugares. */}
          {LUGARES_POS.map((p, i) => {
            const posicao = posicaoDe(i);
            const caiu = posicao !== null && posicao !== 1;
            const campeao = acabou && posicao === 1;
            return (
              <g
                key={i}
                className={`mesa__lugar ${passo >= 0 ? 'mesa__lugar--servido' : ''} ${
                  caiu ? 'mesa__lugar--caiu' : ''
                } ${campeao ? 'mesa__lugar--campeao' : ''}`}
                style={{ transitionDelay: `${i * 55}ms` }}
              >
                {/* As duas cartas, viradas para o centro da mesa. */}
                <g transform={`translate(${p.x} ${p.y}) rotate(${p.giro})`}>
                  <rect className="mesa__carta" x="-21" y="-16" width="19" height="27" rx="3" />
                  <rect className="mesa__carta" x="2" y="-16" width="19" height="27" rx="3" />
                </g>

                {/* O campeão ganha um anel, e é a única coisa cheia e dourada
                    da mesa no fim. Sem ele, o primeiro lugar seria só mais um
                    número cinza entre sete. */}
                <circle
                  cx={p.x}
                  cy={p.y}
                  r="26"
                  className={`mesa__anel ${campeao ? 'mesa__anel--visivel' : ''}`}
                />

                {/* A marca da posição final, no lugar das cartas. */}
                <text
                  x={p.x}
                  y={p.y + 6}
                  textAnchor="middle"
                  className={`mesa__posicao ${posicao !== null ? 'mesa__posicao--visivel' : ''}`}
                >
                  {posicao === 1 ? '1º' : posicao ? `${posicao}º` : ''}
                </text>
              </g>
            );
          })}
        </svg>

        {/* O painel ao lado: o que o app mostraria enquanto isso acontece. */}
        <dl className="mesa__painel superficie rounded-2xl p-6 lg:p-7">
          <div>
            <dt className="rotulo text-gold500">Nível</dt>
            <dd className="font-mono t-ornamento text-text0">{nivel}</dd>
          </div>
          <div className="mt-6">
            <dt className="rotulo text-gold500">De pé</dt>
            <dd className="font-mono t-ornamento text-text0">
              {restantes}
              <span className="t-apoio text-text3"> / {LUGARES}</span>
            </dd>
          </div>
          <div className="mt-6 border-t border-line pt-5">
            <dt className="rotulo text-gold500">Premiação</dt>
            <dd className="mt-3 flex flex-col gap-2">
              {PREMIOS.map((p, i) => (
                <span
                  key={p.posicao}
                  className={`mesa__premio flex items-baseline justify-between gap-4 t-apoio ${
                    acabou ? 'mesa__premio--visivel' : ''
                  }`}
                  style={{ transitionDelay: `${i * 90}ms` }}
                >
                  <span className="font-mono text-gold300">{p.posicao}</span>
                  <span className="text-text1">R$ {p.valor.toFixed(0)}</span>
                </span>
              ))}
            </dd>
          </div>
        </dl>
      </div>

      <p className="medida mt-10 t-apoio text-text2">
        Ninguém digitou nada disso. As posições saem de quem ainda está de pé, e
        as faixas de premiação acompanham o tamanho do campo — 50, 30 e 20 por
        cento para uma mesa de oito.
      </p>
    </Secao>
  );
}
