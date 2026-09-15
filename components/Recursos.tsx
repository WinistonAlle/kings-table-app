'use client';

import { useState } from 'react';
import { Rotulo, Secao, Titulo, Realce } from './Secao';
import { ListaLinhas } from './ListaLinhas';
import { PASSOS } from './AntesDepois';

/* Tudo que o sistema faz, navegável.
 *
 * Isto era quinze cartões parados, empilhados em quatro grades: a dobra mais
 * longa da página e a única em que nada acontecia enquanto se lia. Agora é um
 * ÍNDICE à esquerda e o detalhe à direita — quatro linhas para percorrer em
 * vez de quinze caixas para varrer, e a dobra encolheu para menos de metade
 * da altura.
 *
 * Os grupos não são categoria de catálogo: são as quatro coisas que uma noite
 * de home game tem. O relógio, o dinheiro, a mesa e a temporada. Quem
 * organiza reconhece as quatro antes de ler o que está embaixo.
 *
 * A lista foi levantada lendo `lib/` e `stores/` do app, não de memória. Cada
 * item precisa caber numa coisa que a pessoa reconhece como parte da noite, em
 * vez de virar catálogo solto de recursos.
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
  {
    nome: 'O app',
    resumo: 'A organização da mesa fora da noite também entra no mesmo lugar.',
    itens: [
      ['Conta e sincronização', 'Sua mesa, seu histórico e sua temporada acompanham você entre aparelhos.'],
      ['Comprovante sem conferência manual', 'O app lê o comprovante de pagamento e ajuda a registrar quem já acertou.'],
      ['Rainha GTO', 'Conversa e treino de mão para revisar spots sem misturar estudo com a planilha da noite.'],
      ['Trilha de estudos', 'Um caminho para estudar fora da mesa e voltar para a próxima noite mais preparado.'],
    ],
  },
];

export function Recursos() {
  const [ativo, setAtivo] = useState(0);
  const grupo = GRUPOS[ativo];

  return (
    <Secao id="recursos" className="z-20 py-24 lg:py-32">
      <div className="max-w-2xl">
        <Rotulo>O que ele faz</Rotulo>
        <Titulo>
          Feito por quem <Realce>organiza a mesa</Realce>, não por quem
          imagina uma.
        </Titulo>
      </div>

      <ol className="mt-12 grid gap-8 border-y border-line py-8 sm:grid-cols-3">
        {PASSOS.map((passo) => (
          <li key={passo.n}>
            <span aria-hidden className="titulo text-gold600">{passo.n}</span>
            <h3 className="titulo mt-2 t-card text-text0">{passo.titulo}</h3>
            <p className="mt-2 t-apoio text-text2">{passo.texto}</p>
          </li>
        ))}
      </ol>

      <div className="mt-16 grid gap-12 lg:grid-cols-[minmax(0,22rem)_1fr] lg:gap-20">
        <div className="lg:pt-2">
          <ListaLinhas
            itens={GRUPOS.map((g) => g.nome)}
            ativo={ativo}
            onEscolher={setAtivo}
          />
        </div>

        {/* O painel. `key` no grupo faz o React remontar a lista a cada troca,
            e é isso que redispara a animação de entrada — sem ela a troca
            seria um corte seco e o olho perderia que o conteúdo mudou. */}
        <div key={grupo.nome} className="painel-recursos">
          <p className="t-corpo text-gold200">{grupo.resumo}</p>

          <dl className="mt-8 grid gap-px overflow-hidden rounded-2xl border border-line bg-line sm:grid-cols-2">
            {grupo.itens.map(([titulo, texto], i) => (
              <div
                key={titulo}
                className="painel-recursos__item bg-bg1 p-6 lg:p-7"
                style={{ animationDelay: `${i * 70}ms` }}
              >
                <dt className="titulo t-card text-text0">{titulo}</dt>
                <dd className="mt-2 t-apoio text-text2">{texto}</dd>
              </div>
            ))}
          </dl>
        </div>
      </div>

    </Secao>
  );
}
