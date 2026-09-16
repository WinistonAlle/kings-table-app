import type { LeagueStanding, Tournament } from '@/types';
import { entriesOf, prizePool, premioDaPosicao } from './payouts';

/* Ranking da liga, calculado a partir dos torneios já encerrados.
 *
 * A tela de ranking mostrava oito nomes escritos à mão no código. Bonito e
 * inútil: o pódio não mudava depois de jogar.
 */

/**
 * Pontos de um resultado.
 *
 * A fórmula é a de home game consagrada: `sqrt(campo) / sqrt(posição)`,
 * normalizada por 100. Ela tem duas propriedades que importam numa liga onde a
 * mesa varia de cinco a vinte pessoas:
 *
 * 1. Vencer mesa cheia vale mais que vencer mesa curta, porque o numerador
 *    cresce com o tamanho do campo. Sem isso, quem só aparece nas noites
 *    fracas lidera a temporada.
 * 2. A queda entre posições é suave, não em degrau. Terminar em 4º numa mesa
 *    de 15 ainda vale bastante, que é o que mantém gente jogando depois de
 *    perder o stack grande.
 *
 * Os 10 pontos de presença valem pra quem sentou e não pontuou: numa liga, o
 * pior resultado possível ainda tem que ser melhor do que não ter ido.
 */
export function pontosPor(position: number, fieldSize: number) {
  if (position < 1 || fieldSize < 1) return 0;
  return Math.round(10 + (100 * Math.sqrt(fieldSize)) / Math.sqrt(position));
}

export type Standing = LeagueStanding & {
  /** Somatório de prêmios recebidos, para a coluna de dinheiro. */
  ganhos: number;
  /** Saldo: prêmios menos tudo que a pessoa pagou de entrada. */
  saldo: number;
};

/**
 * Constrói a classificação a partir dos torneios encerrados.
 *
 * Torneio que ainda está rodando fica de fora de propósito: ranking que muda
 * no meio da noite, enquanto a mesa ainda está de pé, é ranking que mente.
 */
export function calcularClassificacao(tournaments: Tournament[]): Standing[] {
  const finalizados = tournaments.filter((t) => t.status === 'finished');

  const porJogador = new Map<string, Standing>();

  for (const t of finalizados) {
    const campo = t.players.length;
    const pool = prizePool(t);

    for (const p of t.players) {
      /* Chave pelo nome normalizado, e não pelo id: hoje cada jogador avulso
         nasce com um id novo a cada torneio (`guest_<timestamp>`), então
         agrupar por id daria uma linha por noite pra mesma pessoa. Quando
         existir cadastro de verdade, isto passa a ser o userId. */
      const chave = p.name.trim().toLowerCase();
      if (!chave) continue;

      const atual = porJogador.get(chave) ?? {
        userId: p.userId,
        name: p.name.trim(),
        avatar: p.avatar,
        points: 0,
        tournamentsPlayed: 0,
        wins: 0,
        itmCount: 0,
        rank: 0,
        ganhos: 0,
        saldo: 0,
      };

      const premio = p.prize ?? (p.position ? premioDaPosicao(pool, campo, p.position) : 0);
      const pago = entriesOf(p) * t.buyIn;

      atual.tournamentsPlayed += 1;
      atual.points += p.position ? pontosPor(p.position, campo) : 0;
      atual.wins += p.position === 1 ? 1 : 0;
      atual.itmCount += premio > 0 ? 1 : 0;
      atual.ganhos += premio;
      atual.saldo += premio - pago;

      porJogador.set(chave, atual);
    }
  }

  return [...porJogador.values()]
    .sort((a, b) =>
      /* Empate em pontos se desempata por vitórias, e depois por saldo. Dois
         jogadores com a mesma pontuação e histórico diferente não podem cair
         numa ordem que muda a cada render. */
      b.points - a.points ||
      b.wins - a.wins ||
      b.saldo - a.saldo ||
      a.name.localeCompare(b.name),
    )
    .map((s, i) => ({ ...s, rank: i + 1 }));
}
