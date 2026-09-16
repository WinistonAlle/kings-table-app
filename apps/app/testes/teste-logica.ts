import { distribuirPremios, prizePool, premioDaPosicao } from '../lib/payouts';
import { calcularClassificacao, pontosPor } from '../lib/standings';
import type { Tournament, TournamentPlayer } from '../types';

let falhas = 0;
function ok(cond: boolean, msg: string) {
  if (!cond) { falhas++; console.log('  FALHOU:', msg); } else console.log('  ok:', msg);
}

// ---- premiação soma exatamente o bolo ----
for (const [pool, n] of [[6000, 12], [2500, 9], [1000, 5], [3333, 7], [777, 11]] as [number, number][]) {
  const soma = distribuirPremios(pool, n).reduce((s, f) => s + f.amount, 0);
  ok(soma === pool, `bolo ${pool} com ${n} jogadores soma exato (deu ${soma})`);
}

// ---- pontuação: campo maior vale mais; posição pior vale menos ----
ok(pontosPor(1, 15) > pontosPor(1, 6), 'vencer mesa de 15 vale mais que mesa de 6');
ok(pontosPor(1, 10) > pontosPor(2, 10), '1o vale mais que 2o');
ok(pontosPor(9, 9) > 0, 'ultimo colocado ainda pontua (presenca)');

// ---- classificação a partir de torneios ----
const jog = (name: string, position: number): TournamentPlayer => ({
  id: name, userId: 'u_' + name, name, buyIns: 1, reEntries: 0, addOns: 0,
  paymentStatus: 'confirmed', position,
});
const torneio = (id: string, status: Tournament['status'], nomes: string[]): Tournament => ({
  id, name: id, format: 'regular', status, buyIn: 500, reEntryAllowed: false, maxReEntries: 0,
  startTime: '', blindStructure: [], currentLevel: 0, createdBy: 'x', createdAt: '',
  players: nomes.map((n, i) => jog(n, i + 1)),
});

const t1 = torneio('t1', 'finished', ['Rafael', 'Bruno', 'Lucas', 'Ana', 'Caio']);
const t2 = torneio('t2', 'finished', ['Bruno', 'Rafael', 'Ana', 'Lucas', 'Caio']);
const t3 = torneio('t3', 'running',  ['Rafael', 'Bruno', 'Lucas', 'Ana', 'Caio']);

const cl = calcularClassificacao([t1, t2, t3]);
ok(cl.length === 5, `5 jogadores na classificacao (deu ${cl.length})`);
ok(cl.every(s => s.tournamentsPlayed === 2), 'torneio em andamento nao entra na conta');
ok(cl[0].rank === 1 && cl[cl.length - 1].rank === cl.length, 'ranks sequenciais');
ok(cl[0].wins === 1, 'lider tem 1 vitoria');

const pool = prizePool(t1);
ok(pool === 2500, `bolo de 5 entradas a 500 = 2500 (deu ${pool})`);
const somaGanhos = cl.reduce((s, x) => s + x.ganhos, 0);
ok(somaGanhos === prizePool(t1) + prizePool(t2), `ganhos somam os dois bolos (deu ${somaGanhos})`);
const somaSaldo = cl.reduce((s, x) => s + x.saldo, 0);
ok(somaSaldo === 0, `jogo de soma zero: saldos somam 0 (deu ${somaSaldo})`);
ok(premioDaPosicao(2500, 5, 5) === 0, 'fora do ITM nao leva nada');

console.log(falhas ? `\n${falhas} FALHA(S)` : '\nTudo passou');
process.exit(falhas ? 1 : 0);
