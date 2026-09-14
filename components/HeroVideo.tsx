'use client';

import { useEffect, useRef, useState } from 'react';
import { useMenosMovimento, useProgresso, useTelaPequena } from './useRolagem';
import { BotaoOuro, Filete } from './Secao';

/* O herói: o vídeo da maleta, raspado pela rolagem.
 *
 * Duas coisas fazem isso funcionar, e as duas são sobre o vídeo, não sobre o
 * código:
 *
 * 1. O arquivo foi reencodado com quadro-chave em TODO quadro. Vídeo normal
 *    tem um a cada dois segundos; pra saltar pra um instante qualquer o
 *    navegador teria que decodificar desde o anterior, e o raspar engasga.
 *    Passou de 2 quadros-chave para 192.
 * 2. Nada de `play()`. O vídeo nunca toca — a rolagem escreve `currentTime`
 *    direto. Tocar e pausar brigaria com o dedo da pessoa.
 *
 * Enquanto o arquivo não terminou de baixar, o pôster segura a tela. Herói que
 * começa preto esperando 4 MB é pior que herói sem vídeo.
 */

const ALTURA_ROLAGEM = 260; // vh de percurso para o vídeo inteiro

export function HeroVideo() {
  const secao = useRef<HTMLDivElement>(null);
  const video = useRef<HTMLVideoElement>(null);
  const p = useProgresso(secao);
  const pequena = useTelaPequena();
  const menosMovimento = useMenosMovimento();
  const [pronto, setPronto] = useState(false);
  const alvo = useRef(0);
  const pedido = useRef(0);

  const semVideo = pequena === true || menosMovimento;

  /* Escreve o instante do vídeo fora do evento de rolagem. Buscar num vídeo é
     assíncrono; pedir uma busca nova antes de a anterior terminar faz o
     decodificador descartar trabalho e a imagem tremer. */
  useEffect(() => {
    if (!pronto || semVideo) return;
    const v = video.current;
    if (!v || !v.duration) return;

    alvo.current = p * v.duration;
    if (pedido.current) return;

    const aplicar = () => {
      pedido.current = 0;
      const v2 = video.current;
      if (!v2) return;
      const t = alvo.current;
      /* Menos de um quadro de diferença não vale uma busca. */
      if (Math.abs(v2.currentTime - t) < 1 / 48) return;
      if ('fastSeek' in v2 && typeof v2.fastSeek === 'function') v2.fastSeek(t);
      else v2.currentTime = t;
    };
    pedido.current = requestAnimationFrame(aplicar);
  }, [p, pronto, semVideo]);

  /* O texto sai de cena na primeira metade: a partir daí a ficha é o assunto,
     e título por cima dela competiria com o momento que a página inteira
     está construindo. */
  const opacidadeTexto = Math.max(0, 1 - p / 0.42);
  const subidaTexto = -p * 90;

  return (
    <section
      id="heroi"
      ref={secao}
      className="relative w-full"
      style={{ height: semVideo ? undefined : `${ALTURA_ROLAGEM}vh` }}
    >
      <div className="sticky top-0 flex h-screen w-full items-center justify-center overflow-hidden">
        {/* A cena */}
        <div className="absolute inset-0">
          {semVideo ? (
            /* Sem vídeo em tela estreita e para quem pediu menos movimento:
               a mesma cena, parada. Herói de landing não vale 4 MB e um
               decodificador de vídeo no celular de alguém. */
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src="/video/maleta-poster.jpg"
              alt=""
              className="h-full w-full object-cover"
            />
          ) : (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/video/maleta-poster.jpg"
                alt=""
                aria-hidden
                className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-500 ${
                  pronto ? 'opacity-0' : 'opacity-100'
                }`}
              />
              <video
                ref={video}
                src="/video/maleta.mp4"
                muted
                playsInline
                preload="auto"
                aria-hidden
                onCanPlayThrough={() => setPronto(true)}
                className="h-full w-full object-cover"
              />
            </>
          )}

          {/* Véu que ACOMPANHA o texto.
              Medido no primeiro quadro: atrás do subtítulo e dos botões o
              fundo tem p90 de 135 e picos de 227 — são as fichas douradas da
              maleta, bem no lugar onde o texto cai. Texto claro ali fica
              ilegível.

              Escurecer a cena inteira o tempo todo resolveria a legibilidade e
              mataria o herói: a graça é a ficha subindo com a luz batendo
              nela. Por isso o véu segue a opacidade do texto — forte enquanto
              há o que ler, e some quando a ficha vira o assunto. */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 bg-bg0"
            style={{ opacity: semVideo ? 0.45 : opacidadeTexto * 0.62 }}
          />
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0"
            style={{
              background:
                'linear-gradient(to bottom, rgba(10,8,7,0.5) 0%, transparent 32%, transparent 62%, rgba(10,8,7,0.8) 100%)',
            }}
          />
        </div>

        {/* O texto */}
        <div
          className="relative z-10 mx-auto w-full max-w-5xl px-6 text-center lg:px-10"
          style={{
            opacity: semVideo ? 1 : opacidadeTexto,
            transform: semVideo ? undefined : `translateY(${subidaTexto}px)`,
          }}
        >
          <h1 className="titulo text-[clamp(2.4rem,6vw,4.6rem)] text-balance text-text0 drop-shadow-[0_2px_24px_rgba(0,0,0,0.9)]">
            O seu home game merece mais que{' '}
            <em className="not-italic text-gold300">uma planilha</em> e{' '}
            <em className="not-italic text-gold300">boa memória</em>.
          </h1>

          <p className="mx-auto mt-7 max-w-2xl text-lg leading-relaxed text-text1 drop-shadow-[0_2px_16px_rgba(0,0,0,0.9)] lg:text-xl">
            Relógio de blinds que não atrasa, controle de quem pagou, premiação
            calculada na hora e o ranking da temporada saindo sozinho de cada
            noite.
          </p>

          <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
            <BotaoOuro href="#precos">Abrir o meu clube</BotaoOuro>
            <a
              href="#como-funciona"
              className="inline-flex items-center gap-2 rounded-full border border-lineStrong bg-bg0/40 px-7 py-3.5 text-[0.95rem] font-medium text-text1 backdrop-blur-sm transition-colors hover:border-gold500 hover:text-text0"
            >
              Ver como funciona
            </a>
          </div>

          {!semVideo ? (
            <div
              className="mt-14 flex flex-col items-center gap-3"
              style={{ opacity: Math.max(0, 1 - p / 0.12) }}
            >
              <Filete largura={110} />
              <span className="rotulo text-text3">Role para ver</span>
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}
