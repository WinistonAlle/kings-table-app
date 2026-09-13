import { BotaoOuro, Rotulo, Secao, Titulo, Realce } from './Secao';

/* Preço.
 *
 * ATENÇÃO: os valores abaixo são MARCADOR DE LUGAR. O modelo de cobrança
 * ainda não foi decidido, e inventar preço numa página de vendas é o tipo de
 * chute que custa caro: ele ancora a percepção de valor antes de existir
 * decisão, e mudar depois parece que a empresa não sabe o que faz.
 *
 * A estrutura está pronta para receber os números reais: três colunas, a do
 * meio destacada, e o texto de cada plano dizendo PARA QUEM ele é, não quantos
 * recursos tem.
 */

const PLANOS = [
  {
    nome: 'Mesa única',
    preco: '—',
    periodo: 'por mês',
    para: 'Para quem toca um home game e quer parar de usar planilha.',
    itens: [
      'Um clube, jogadores sem limite',
      'Relógio, premiação e ranking',
      'Histórico da temporada',
    ],
    cta: 'Começar',
    destaque: false,
  },
  {
    nome: 'Clube',
    preco: '—',
    periodo: 'por mês',
    para: 'Para quem organiza mais de uma mesa ou divide a organização.',
    itens: [
      'Vários clubes e temporadas',
      'Organizadores auxiliares',
      'Comprovante conferido por leitura automática',
      'Estruturas de blind próprias',
    ],
    cta: 'Começar',
    destaque: true,
  },
  {
    nome: 'Casa',
    preco: '—',
    periodo: 'sob consulta',
    para: 'Para clube com muitas mesas simultâneas e mais de um organizador.',
    itens: [
      'Tudo do Clube',
      'Mesas simultâneas',
      'Marca própria no app',
      'Suporte direto',
    ],
    cta: 'Falar com a gente',
    destaque: false,
  },
];

export function Precos() {
  return (
    <Secao id="precos" className="py-24 lg:py-32">
      <div className="max-w-2xl">
        <Rotulo>Planos</Rotulo>
        <Titulo>
          Custa menos que <Realce>um buy-in</Realce>.
        </Titulo>
        <p className="mt-6 text-lg leading-relaxed text-text2">
          Um mês inteiro de mesas organizadas pelo preço de uma entrada da sua
          noite. Sem fidelidade, sem taxa por jogador.
        </p>
      </div>

      <div className="mt-16 grid gap-6 lg:grid-cols-3">
        {PLANOS.map((p) => (
          <div
            key={p.nome}
            className={`superficie flex flex-col rounded-2xl p-8 ${
              p.destaque ? 'border-lineStrong lg:-mt-4 lg:pb-12' : ''
            }`}
          >
            {p.destaque ? (
              <span className="rotulo mb-4 inline-block w-fit rounded-full border border-gold600 bg-gold800 px-3 py-1 text-gold200">
                Mais escolhido
              </span>
            ) : null}

            <h3 className="titulo text-[1.7rem] text-gold200">{p.nome}</h3>
            <p className="mt-2 text-[0.92rem] leading-relaxed text-text2">
              {p.para}
            </p>

            <div className="mt-7 flex items-baseline gap-2">
              <span className="font-mono text-[2.6rem] leading-none text-text0">
                {p.preco}
              </span>
              <span className="text-[0.85rem] text-text3">{p.periodo}</span>
            </div>

            <ul className="mt-7 flex flex-1 flex-col gap-3">
              {p.itens.map((i) => (
                <li key={i} className="flex items-start gap-3 text-[0.93rem] text-text1">
                  <span aria-hidden className="mt-[7px] block h-1 w-1 shrink-0 rotate-45 bg-gold400" />
                  {i}
                </li>
              ))}
            </ul>

            <div className="mt-9">
              {p.destaque ? (
                <BotaoOuro href="#" className="w-full justify-center">
                  {p.cta}
                </BotaoOuro>
              ) : (
                <a
                  href="#"
                  className="inline-flex w-full items-center justify-center rounded-full border border-lineStrong px-7 py-3.5 text-[0.95rem] font-medium text-text1 transition-colors hover:border-gold500 hover:text-text0"
                >
                  {p.cta}
                </a>
              )}
            </div>
          </div>
        ))}
      </div>
    </Secao>
  );
}
