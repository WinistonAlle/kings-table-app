import type { CSSProperties } from 'react';

export function FichasCaindo() {
  return (
    <div className="fichas-fundo" aria-hidden="true">
      <div className="fichas-janela">
        {Array.from({ length: 12 }, (_, i) => (
          <span
            key={i}
            className="ficha-caindo"
            style={{
              left: `${4 + (i * 29) % 92}%`,
              '--tamanho': `${44 + (i * 13) % 38}px`,
              '--duracao': `${18 + (i * 7) % 12}s`,
              '--atraso': `${-i * 2.7}s`,
              '--deriva': `${i % 2 ? -60 : 60}px`,
            } as CSSProperties}
          />
        ))}
      </div>
    </div>
  );
}
