'use client';

import { useEffect, useState } from 'react';
import { BotaoOuro, Rotulo, Secao, Titulo, Realce } from './Secao';
import { ListaLinhas } from './ListaLinhas';
import { FEATURES, FEATURE_NAMES } from './features';

export function Recursos() {
  const [ativo, setAtivo] = useState(0);
  const grupo = FEATURES[ativo];

  useEffect(() => {
    const selecionar = (event: Event) => {
      const index = (event as CustomEvent<number>).detail;
      if (Number.isInteger(index) && index >= 0 && index < FEATURES.length) setAtivo(index);
    };
    window.addEventListener('feature-selecionada', selecionar);
    return () => window.removeEventListener('feature-selecionada', selecionar);
  }, []);

  return (
    <Secao id="recursos" className="z-20 py-24 lg:py-32">
      <div className="max-w-2xl">
        <Rotulo>Por dentro do King's Table</Rotulo>
        <Titulo>Menos trabalho para organizar. <Realce>Mais tempo para jogar.</Realce></Titulo>
      </div>
      <div className="mt-14 grid gap-12 lg:grid-cols-[minmax(0,23rem)_1fr] lg:gap-16">
        <nav aria-label="Áreas do sistema">
          <ListaLinhas itens={FEATURE_NAMES} ativo={ativo} onEscolher={setAtivo} />
        </nav>
        <div key={grupo.nome} className="painel-recursos" aria-live="polite">
          <p className="rotulo text-gold500">{grupo.futuro ? 'Em desenvolvimento' : 'Disponível no app atual'}</p>
          <h3 className="titulo mt-3 t-sub text-text0">{grupo.resumo}</h3>
          <p className="mt-4 t-corpo text-gold200">{grupo.beneficio}</p>
          <dl className="mt-8 divide-y divide-line border-y border-line">
            {grupo.itens.map(([titulo, texto], i) => (
              <div key={titulo} className="painel-recursos__item py-5" style={{ animationDelay: `${i * 70}ms` }}>
                <dt className="titulo t-card text-text0">{titulo}</dt>
                <dd className="mt-2 t-apoio text-text2">{texto}</dd>
              </div>
            ))}
          </dl>
          <BotaoOuro href="#lista" className="mt-8">Entrar na lista de espera</BotaoOuro>
        </div>
      </div>
    </Secao>
  );
}
