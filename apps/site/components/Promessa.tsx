'use client';

import { useEffect, useRef, useState } from 'react';
import { Secao } from './Secao';

/* A promessa, logo depois do herói.
 *
 * Esta frase morava como subtítulo do herói, e lá ela não tinha chance: o
 * vídeo estava correndo, a ficha subindo da maleta, e o texto saía de cena
 * na primeira metade da rolagem. Era a frase que diz o que o produto FAZ,
 * competindo com o momento em que a página só tem um assunto.
 *
 * Sozinha, numa dobra própria, ela tem tempo de ser lida. E é aqui que a
 * ficha 3D para, com o nome girando em volta (ver `POSE_PAUSA` em
 * `Ficha3D.tsx`): a peça acaba de sair da maleta na dobra anterior, e esta é
 * a primeira vez que ela fica quieta para a pessoa olhar.
 *
 * O surgimento é por cláusula, não por letra. Animar letra a letra fica
 * bonito num título de três palavras e vira gagueira numa frase de vinte —
 * aqui cada pedaço da frase sobe inteiro, na ordem em que se lê, e a pausa
 * entre eles é a mesma que a leitura faria sozinha.
 */

/* A frase, quebrada onde a voz quebra. O `destaque` é o que fica em ouro:
   um por cláusula, nunca a cláusula inteira. */
const CLAUSULAS = [
  { texto: 'Relógio de blinds', destaque: 'que não atrasa,' },
  { texto: 'controle de', destaque: 'quem pagou,' },
  { texto: 'premiação', destaque: 'calculada na hora' },
  { texto: 'e o ranking da temporada', destaque: 'saindo sozinho' },
  { texto: 'de cada noite.', destaque: null },
];

export function Promessa() {
  const alvo = useRef<HTMLDivElement>(null);
  const [visivel, setVisivel] = useState(false);

  useEffect(() => {
    const el = alvo.current;
    if (!el) return;
    /* Sem IntersectionObserver (navegador antigo), aparece logo: melhor sem o
       efeito do que sem a frase. */
    if (typeof IntersectionObserver === 'undefined') {
      setVisivel(true);
      return;
    }
    const obs = new IntersectionObserver(
      ([e]) => {
        if (!e.isIntersecting) return;
        setVisivel(true);
        /* Uma vez só: reanimar a cada passada transforma um efeito de entrada
           num piscar toda vez que a pessoa volta a rolar para cima. */
        obs.disconnect();
      },
      { rootMargin: '-15% 0px -20% 0px' },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  return (
    <Secao id="promessa" className="promessa-dobra py-28 lg:py-40">
      {/* No desktop o texto ocupa ~62% e cede a direita para a ficha, que para
          exatamente ali. É coluna reservada, não sobra: uma peça grande e
          parada ao LADO do que se lê vira parte da página; espremida num vão,
          vira enfeite de canto. */}
      <div ref={alvo} className="lg:w-[62%]">
        <p
          className={`titulo t-secao text-balance text-text0 promessa ${
            visivel ? 'promessa--visivel' : ''
          }`}
        >
          {CLAUSULAS.map((c, i) => (
            <span
              key={i}
              className="promessa__linha"
              style={{ transitionDelay: `${i * 240}ms` }}
            >
              {c.texto}
              {c.destaque ? <em className="not-italic text-gold300"> {c.destaque}</em> : null}{' '}
            </span>
          ))}
        </p>
      </div>
    </Secao>
  );
}
