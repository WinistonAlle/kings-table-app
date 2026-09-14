import { Rotulo, Secao, Titulo, Realce } from './Secao';

/* Tudo que o sistema faz, em detalhe.
 *
 * A lista foi levantada lendo `lib/` e `stores/` do app, não de memória: cada
 * item abaixo corresponde a código que existe. Quatro grupos, porque quinze
 * cartões soltos não se leem — e os grupos são as quatro coisas que uma noite
 * de home game tem: o relógio, o dinheiro, a mesa e a temporada.
 *
 * A REGRA que vale desde a primeira versão desta seção: só entra o que o app
 * faz hoje. O que ainda não existe vai num bloco à parte, marcado, no fim.
 * Misturar as duas coisas é como se perde a confiança de quem compra — e num
 * produto de nicho vendido para pares, a primeira mentira é a última venda.
 */

const GRUPOS = [
  {
    nome: 'A noite',
    resumo: 'O relógio que ninguém precisa vigiar.',
    itens: [
      ['O relógio não atrasa', 'Ele é ancorado no relógio de parede, não num contador. Bloqueie a tela, atenda o telefone, feche o app: quando voltar, o nível é o certo.'],
      ['Voltou depois de uma hora?', 'Ele já pulou os níveis que passaram, em vez de recuperar um a um na frente da mesa.'],
      ['Pausa de verdade', 'Pausar, retomar e pular para um nível específico, quando a mesa decide esticar ou encurtar a noite.'],
      ['Funciona sem sinal', 'Sala sem Wi-Fi, celular sem dados, tanto faz. A noite inteira roda no aparelho.'],
    ],
  },
  {
    nome: 'O dinheiro',
    resumo: 'A conta fecha com o que está na mesa.',
    itens: [
      ['Buy-in, rebuy e add-on', 'Cada entrada soma no bolo sozinha. Ninguém precisa lembrar de somar no fim.'],
      ['Quem pagou, sem você virar cobrador', 'Cada jogador tem o estado dele: a receber, pago, contestado.'],
      ['A premiação sai calculada', 'As faixas acompanham o tamanho do campo e o valor é recalculado a cada entrada nova.'],
      ['O prêmio fica gravado', 'Ao encerrar, cada posição guarda o valor daquela noite. Não é uma conta refeita depois, é o que foi pago.'],
    ],
  },
  {
    nome: 'A mesa',
    resumo: 'Um toque por eliminação, e nada de contar de cabeça.',
    itens: [
      ['Eliminação com um toque', 'Caiu com sete na mesa, terminou em sétimo. A posição sai de quem ainda está de pé.'],
      ['Tem desfazer', 'Erro de dedo acontece, e acontece na mesa. Desfazer devolve o jogador ao jogo e a posição à fila.'],
      ['Entra e sai jogador', 'A mesa da quarta nunca é a mesma da quarta passada. Adicionar e remover não quebra nada.'],
      ['O torneio fecha sozinho', 'Quando sobra um, acabou: posições atribuídas, premiação distribuída, noite gravada.'],
    ],
  },
  {
    nome: 'A temporada',
    resumo: 'O campeonato que hoje só existe na memória de quem ganhou.',
    itens: [
      ['O ranking existe', 'Pontos por posição e tamanho de campo. Ganhar numa mesa de doze pesa mais que numa de cinco.'],
      ['Vitórias, ITM e saldo', 'Quantas venceu, quantas terminou no dinheiro, e quanto entrou menos quanto saiu.'],
      ['O histórico de cada noite', 'Quem jogou, quem caiu quando, quanto cada posição levou. A noite de três meses atrás continua lá.'],
    ],
  },
];

/* O que ainda não existe. Vai separado e dito com todas as letras. */
const POR_VIR = [
  'Conta e sincronização entre aparelhos',
  'Leitura automática do comprovante de pagamento',
  'Rainha GTO: conversa e treino de mão',
  'Trilha de estudos',
];

export function Recursos() {
  return (
    <Secao className="py-24 lg:py-32">
      <div className="max-w-2xl">
        <Rotulo>O que ele faz</Rotulo>
        <Titulo>
          Feito por quem <Realce>organiza a mesa</Realce>, não por quem
          imagina uma.
        </Titulo>
      </div>

      <div className="mt-16 flex flex-col gap-14 lg:gap-16">
        {GRUPOS.map((g) => (
          <div key={g.nome} className="grid gap-8 lg:grid-cols-[minmax(0,15rem)_1fr] lg:gap-14">
            {/* O nome do grupo fica na coluna da esquerda no desktop e vira
                cabeçalho no celular: é a mesma hierarquia, sem media query
                própria. */}
            <div className="lg:pt-1">
              <h3 className="titulo t-sub text-gold200">{g.nome}</h3>
              <p className="mt-2 t-apoio text-text2">{g.resumo}</p>
            </div>

            <dl className="grid gap-px overflow-hidden rounded-2xl border border-line bg-line sm:grid-cols-2">
              {g.itens.map(([titulo, texto]) => (
                <div key={titulo} className="bg-bg1 p-6 lg:p-7">
                  <dt className="titulo t-card text-text0">{titulo}</dt>
                  <dd className="mt-2 t-apoio text-text2">{texto}</dd>
                </div>
              ))}
            </dl>
          </div>
        ))}
      </div>

      {/* O que está por vir, dito como tal. */}
      <div className="superficie mt-16 rounded-2xl p-7 lg:mt-20 lg:p-9">
        <h3 className="rotulo text-gold500">Ainda não, mas vem</h3>
        <p className="medida mt-3 t-apoio text-text2">
          Nada acima é promessa: é o que o aplicativo faz hoje. Estas quatro
          ainda estão sendo construídas, e você vai saber quando chegarem.
        </p>
        <ul className="mt-5 flex flex-wrap gap-x-8 gap-y-2">
          {POR_VIR.map((i) => (
            <li key={i} className="flex items-center gap-2.5 t-apoio text-text1">
              <span aria-hidden className="text-gold600">
                ◆
              </span>
              {i}
            </li>
          ))}
        </ul>
      </div>
    </Secao>
  );
}
