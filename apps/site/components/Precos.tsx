import { BotaoOuro, Rotulo, Secao, Titulo, Realce } from './Secao';
import { SpecularRim } from './SpecularRim';

const PLANOS = [
  {
    nome: 'Home',
    preco: 'Gratuito',
    periodo: '',
    anual: null,
    para: 'Para quem toca um home game e quer parar de usar planilha.',
    itens: [
      'Uma mesa ativa, até 10 jogadores',
      'Relógio e estruturas sugeridas',
      'Entradas e premiação',
      'Histórico local limitado',
    ],
    cta: 'Entrar na lista',
    destaque: false,
  },
  {
    nome: 'Clube',
    preco: 'R$ 19,90',
    periodo: 'por mês',
    anual: 'R$ 199,90/ano',
    para: 'Para quem organiza mais de uma mesa ou divide a organização.',
    itens: [
      'Mesas e jogadores ilimitados',
      'Ranking e histórico da liga',
      'Blinds personalizados e intervalos',
      'Convites, QR Code e compartilhamento',
      'Backup, sincronização e exportação',
    ],
    cta: 'Quero testar o Clube',
    destaque: true,
  },
  {
    nome: 'Pro',
    preco: 'R$ 39,90',
    periodo: 'por mês',
    anual: 'R$ 399,90/ano',
    para: 'Para clube com muitas mesas simultâneas e mais de um organizador.',
    itens: [
      'Tudo do Clube',
      'Várias ligas e temporadas',
      'Permissões para a equipe',
      'Pontuação configurável',
      'Relatórios e histórico por jogador',
      'Comprovantes e notificações',
    ],
    cta: 'Entrar na lista',
    destaque: false,
  },
];

export function Precos() {
  return (
    <Secao id="precos" className="py-24 lg:py-32">
      <div className="max-w-2xl">
        <Rotulo>Planos</Rotulo>
        <Titulo>
          Menos planilha. <Realce>Mais poker.</Realce>
        </Titulo>
        <p className="medida mt-6 t-corpo text-text2">
          Deixe a calculadora e a confusão no grupo para trás. Comece grátis ou
          experimente o Clube por 14 dias. A assinatura é do organizador, não de cada jogador.
        </p>
      </div>

      <div className="mt-16 grid gap-6 lg:grid-cols-3">
        {PLANOS.map((p) => (
          <div
            key={p.nome}
            className={`superficie flex flex-col rounded-lg p-8 ${
              p.destaque ? 'border-lineStrong lg:-mt-4 lg:pb-12' : ''
            }`}
          >
            {p.destaque ? (
              <span className="rotulo mb-4 inline-block w-fit rounded-full border border-gold600 bg-gold800 px-3 py-1 text-gold200">
                Plano recomendado
              </span>
            ) : null}

            <h3 className="titulo t-sub text-gold200">{p.nome}</h3>
            <p className="mt-2 t-apoio text-text2">
              {p.para}
            </p>

            <div className="mt-7 flex flex-wrap items-baseline gap-2">
              {p.preco ? (
                <>
                  <span className="titulo text-3xl font-bold text-text0">
                    {p.preco}
                  </span>
                  <span className="t-micro text-text3">{p.periodo}</span>
                </>
              ) : (
                <span className="rotulo text-gold300">em breve</span>
              )}
            </div>
            {p.anual && <p className="mt-3 t-apoio text-gold200">Ou {p.anual}<span className="mt-1 block t-micro text-text2">Aproximadamente 2 meses grátis no anual.</span></p>}

            <ul className="mt-7 flex flex-1 flex-col gap-3">
              {p.itens.map((i) => (
                <li key={i} className="flex items-start gap-3 t-apoio text-text1">
                  <span aria-hidden className="mt-[7px] block h-1 w-1 shrink-0 rotate-45 bg-gold400" />
                  {i}
                </li>
              ))}
            </ul>

            <div className="mt-9">
              {p.destaque ? (
                <BotaoOuro href="#lista" className="w-full justify-center">
                  {p.cta}
                </BotaoOuro>
              ) : (
                <a
                  href="#lista"
                  className="botao-especular inline-flex w-full items-center justify-center rounded-full border border-lineStrong px-7 py-3.5 t-apoio font-medium text-text1 transition-colors hover:border-gold500 hover:text-text0"
                >
                  <SpecularRim />
                  {p.cta}
                </a>
              )}
            </div>
          </div>
        ))}
      </div>
      <div className="mt-8 flex flex-col gap-6 border-y border-line py-8 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h3 className="titulo t-sub text-gold200">Passe · R$ 7,90 por uma noite</h3>
          <p className="mt-3 t-apoio text-text2">Todos os recursos do Clube para um encontro, sem assinatura mensal.</p>
        </div>
        <a href="#lista" className="shrink-0 t-apoio font-medium text-gold200 underline underline-offset-4">Quero o Passe</a>
      </div>
      <p className="mt-6 t-micro text-text2">Teste gratuito de 14 dias do Clube. Entre na lista para receber o convite de acesso.</p>
    </Secao>
  );
}
