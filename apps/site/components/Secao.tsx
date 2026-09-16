import type { ReactNode } from 'react';
import { SpecularRim } from './SpecularRim';

/* Peças de layout que se repetem na página inteira. Existirem soltas é o que
   mantém o ritmo: mesma largura de coluna, mesmo respiro entre blocos, mesma
   distância entre rótulo e título. Página de vendas com espaçamento irregular
   lê como amadora antes de qualquer palavra ser lida. */

export function Secao({
  children,
  className = '',
  id,
}: {
  children: ReactNode;
  className?: string;
  id?: string;
}) {
  return (
    <section id={id} className={`relative w-full ${className}`}>
      <div className="mx-auto w-full max-w-6xl px-6 lg:px-10">{children}</div>
    </section>
  );
}

export function Rotulo({ children }: { children: ReactNode }) {
  return <p className="rotulo text-gold500">{children}</p>;
}

/** Título de seção. O destaque em serifa itálica marca UMA expressão. */
export function Titulo({
  children,
  className = '',
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <h2 className={`titulo mt-4 t-secao text-text0 ${className}`}>
      {children}
    </h2>
  );
}

/** A expressão destacada dentro de um título. */
export function Realce({ children }: { children: ReactNode }) {
  return <em className="text-gold300 not-italic">{children}</em>;
}

/** Filete com losango ao centro, o mesmo ornamento do app. */
export function Filete({ largura = 120 }: { largura?: number }) {
  return (
    <svg width={largura} height={9} viewBox={`0 0 ${largura} 9`} aria-hidden="true">
      <defs>
        <linearGradient id="filete" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#8b6d3c" stopOpacity="0" />
          <stop offset="0.5" stopColor="#8b6d3c" stopOpacity="0.85" />
          <stop offset="1" stopColor="#8b6d3c" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={`M0 4.5 H${largura}`} stroke="url(#filete)" strokeWidth={1} />
      <path
        d={`M${largura / 2} 0.8 L${largura / 2 + 3.6} 4.5 L${largura / 2} 8.2 L${largura / 2 - 3.6} 4.5 Z`}
        fill="#8b6d3c"
      />
    </svg>
  );
}

export function BotaoOuro({
  children,
  href,
  className = '',
}: {
  children: ReactNode;
  href: string;
  className?: string;
}) {
  return (
    <a
      href={href}
      className={`botao-ouro inline-flex items-center gap-2 rounded-full px-7 py-3.5 t-apoio font-semibold ${className}`}
    >
      <SpecularRim />
      {children}
    </a>
  );
}

export function BotaoFantasma({
  children,
  href,
}: {
  children: ReactNode;
  href: string;
}) {
  return (
    <a
      href={href}
      className="botao-especular inline-flex items-center gap-2 rounded-full border border-lineStrong px-7 py-3.5 t-apoio font-medium text-text1 transition-colors hover:border-gold500 hover:text-text0"
    >
      <SpecularRim />
      {children}
    </a>
  );
}
