import type { Tournament, TournamentPlayer } from '@/types';

/* Premiação do torneio.
 *
 * Estava dentro da tela de detalhe, como função solta no fim do arquivo. Saiu
 * de lá porque agora duas coisas precisam da MESMA resposta: a tela, que
 * mostra a distribuição, e o encerramento do torneio, que grava o prêmio de
 * cada jogador. Duas cópias da tabela é como se paga um campeão diferente do
 * que estava escrito na tela a noite inteira.
 */

export type Payout = { place: number; percent: number; amount: number };

/** Quantas entradas o jogador comprou, somando re-entradas e add-ons. */
export function entriesOf(player: TournamentPlayer) {
  return player.buyIns + player.reEntries + player.addOns;
}

/** Total arrecadado: toda entrada paga vale um buy-in. */
export function prizePool(tournament: Tournament) {
  const entradas = tournament.players.reduce((soma, p) => soma + entriesOf(p), 0);
  return entradas * tournament.buyIn;
}

/* Faixas por tamanho de campo. É a escada de home game: mesa curta paga dois,
   mesa cheia paga três, e acima de nove paga quatro. */
function percentuais(playerCount: number) {
  if (playerCount <= 5) return [65, 35];
  if (playerCount <= 9) return [50, 30, 20];
  return [40, 30, 20, 10];
}

export function getPayouts(pool: number, playerCount: number): Payout[] {
  return percentuais(playerCount).map((percent, i) => ({
    place: i + 1,
    percent,
    /* Arredonda pra real inteiro: ninguém paga centavo em mesa de casa. A
       sobra do arredondamento vai pro campeão em `distribuirPremios`. */
    amount: Math.round((pool * percent) / 100),
  }));
}

/**
 * Prêmio de cada posição, já com a sobra de arredondamento resolvida.
 *
 * Sem esse acerto, somar os prêmios dava alguns reais a mais ou a menos que o
 * bolo — e num jogo de casa a conta é conferida na mesa, em dinheiro, por
 * pessoas que sabem somar.
 */
export function distribuirPremios(pool: number, playerCount: number): Payout[] {
  const faixas = getPayouts(pool, playerCount);
  if (faixas.length === 0) return faixas;
  const soma = faixas.reduce((s, f) => s + f.amount, 0);
  const sobra = pool - soma;
  return faixas.map((f, i) => (i === 0 ? { ...f, amount: f.amount + sobra } : f));
}

/** Quanto o jogador leva, dada a posição final. Fora do ITM, zero. */
export function premioDaPosicao(pool: number, playerCount: number, position: number) {
  const faixa = distribuirPremios(pool, playerCount).find((f) => f.place === position);
  return faixa ? faixa.amount : 0;
}

export function payoutLabel(length: number) {
  return length === 1 ? '1 faixa ITM' : `${length} faixas ITM`;
}
