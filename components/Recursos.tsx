'use client';

import { useEffect, useState } from 'react';
import { BotaoOuro, Rotulo, Secao, Titulo, Realce } from './Secao';
import { ListaLinhas } from './ListaLinhas';
import { FEATURES, FEATURE_NAMES } from './features';

const CENARIOS = [
  [['Mesa de sexta', 'Nome da mesa'], ['R$ 50', 'Buy-in'], ['Regular', 'Ritmo dos blinds']],
  [['200 / 400', 'Blinds atuais'], ['00:30', 'Tempo restante'], ['300 / 600', 'Próximo nível']],
  [['1º · Ana', '128 pontos'], ['2º · Pedro', '104 pontos'], ['3º · Bia', '96 pontos']],
  [['8 jogadores', 'Na noite'], ['3 reentradas', 'Registradas'], ['6 de pé', 'Na disputa']],
  [['Pago', 'Ana · R$ 50'], ['A receber', 'Pedro · R$ 100'], ['Contestado', 'Bia · R$ 50']],
  [['1º · R$ 200', 'Campeão'], ['2º · R$ 120', 'Vice-campeão'], ['3º · R$ 80', 'Terceiro lugar']],
  [['No aparelho', 'Dados salvos'], ['Sem Wi-Fi', 'Mesa funcionando'], ['Toda a liga', 'Resultados reunidos']],
  [['Conversa', 'Protótipo local'], ['Análise de mãos', 'Planejada'], ['Treino', 'Planejado']],
];

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
      <div className="recursos-cabecalho">
        <Rotulo>Por dentro do King's Table</Rotulo>
        <Titulo>Seu home game, <Realce>por inteiro.</Realce></Titulo>
      </div>
      <div className="recursos-layout mt-12 grid gap-8 lg:grid-cols-[minmax(0,19rem)_1fr] lg:gap-12">
        <nav aria-label="Áreas do sistema" className="hidden self-start lg:sticky lg:top-24 lg:block">
          <ListaLinhas itens={FEATURE_NAMES} ativo={ativo} onEscolher={setAtivo} />
        </nav>
        <div>
          <label className="mb-8 block lg:hidden">
            <span className="rotulo mb-3 block text-gold500">Funcionalidade</span>
            <select value={ativo} onChange={event => setAtivo(Number(event.target.value))} className="w-full rounded border border-lineStrong bg-bg1 p-4 text-text0">
              {FEATURE_NAMES.map((nome, i) => <option key={nome} value={i}>{nome}</option>)}
            </select>
          </label>
        <div key={grupo.nome} className="painel-recursos recursos-detalhe" aria-live="polite">
          <div className="recursos-status"><span aria-hidden />{grupo.futuro ? 'Em desenvolvimento' : 'No King’s Table'}<span className="recursos-contador">{String(ativo + 1).padStart(2, '0')} / 08</span></div>
          <h3 className="titulo recursos-titulo text-text0">{grupo.resumo}</h3>
          <p className="mt-4 t-apoio text-text1">{grupo.beneficio}</p>
          <div className="recursos-demo" aria-label={grupo.futuro ? 'Etapas de desenvolvimento' : 'Exemplo ilustrativo da funcionalidade'}>
            <p className="recursos-demo__legenda">{grupo.futuro ? 'O que vem pela frente' : 'Uma noite com King’s Table · exemplo'}</p>
            <div className="recursos-demo__valores">
              {CENARIOS[ativo].map(([valor, legenda], i) => <div key={valor} style={{ animationDelay: `${i * 90}ms` }}><strong>{valor}</strong><span>{legenda}</span></div>)}
            </div>
          </div>
          <dl className="recursos-lista">
            {grupo.itens.map(([titulo, texto], i) => (
              <div key={titulo} className="painel-recursos__item recursos-linha" style={{ animationDelay: `${i * 70}ms` }}>
                <dt className="text-text0"><span aria-hidden>{String(i + 1).padStart(2, '0')}</span>{titulo}</dt>
                <dd className="text-text2">{texto}</dd>
              </div>
            ))}
          </dl>
        </div>
        </div>
      </div>
      <div className="recursos-rodape"><p className="t-apoio text-text1">Menos contas. Mais jogo.</p><BotaoOuro href="#lista">Quero organizar minha mesa</BotaoOuro></div>
    </Secao>
  );
}
