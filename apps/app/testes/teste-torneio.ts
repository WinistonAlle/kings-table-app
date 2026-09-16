import { eliminar, desfazerEliminacao, emJogo } from '../lib/torneio';
import { prizePool } from '../lib/payouts';
import { calcularClassificacao } from '../lib/standings';
import type { Tournament } from '../types';

let falhas = 0;
const ok = (c: boolean, m: string) => { if (!c) { falhas++; console.log('  FALHOU:', m); } else console.log('  ok:', m); };

const nomes = ['Rafael', 'Bruno', 'Lucas', 'Ana', 'Caio', 'Thais', 'Diego'];
let t: Tournament = {
  id: 't1', name: 'Quarta da Realeza', format: 'regular', status: 'upcoming',
  buyIn: 500, reEntryAllowed: false, maxReEntries: 0, startTime: '', blindStructure: [],
  currentLevel: 0, createdBy: 'me', createdAt: '',
  players: nomes.map((n, i) => ({
    id: `p${i}`, userId: `u${i}`, name: n, buyIns: 1, reEntries: 0, addOns: 0,
    paymentStatus: 'confirmed' as const,
  })),
};

ok(emJogo(t).length === 7, '7 de pe no comeco');
ok(prizePool(t) === 3500, `bolo 7x500 = 3500 (deu ${prizePool(t)})`);

// elimina na ordem: p6 cai primeiro -> 7o lugar
t = eliminar(t, 'p6');
ok(t.players.find(p => p.id === 'p6')!.position === 7, 'primeiro a cair fica em 7o');
ok(t.status === 'running', 'torneio passa a em andamento');

t = eliminar(t, 'p5'); // 6o
t = eliminar(t, 'p4'); // 5o
t = eliminar(t, 'p3'); // 4o
ok(emJogo(t).length === 3, '3 de pe');
ok(t.status === 'running', 'ainda rodando com 3');

t = eliminar(t, 'p2'); // 3o
t = eliminar(t, 'p1'); // 2o -> sobra p0, encerra
ok(t.status === 'finished', 'encerrou sozinho ao sobrar um');
ok(t.players.find(p => p.id === 'p0')!.position === 1, 'quem sobrou e campeao');
ok(emJogo(t).length === 0, 'ninguem sem posicao no fim');

const posicoes = t.players.map(p => p.position).sort((a, b) => a! - b!);
ok(JSON.stringify(posicoes) === JSON.stringify([1,2,3,4,5,6,7]), `posicoes 1..7 sem buraco nem repeticao (deu ${posicoes})`);

const somaPremios = t.players.reduce((s, p) => s + (p.prize ?? 0), 0);
ok(somaPremios === 3500, `premios somam o bolo exato (deu ${somaPremios})`);
ok(t.players.find(p => p.id === 'p0')!.prize! > t.players.find(p => p.id === 'p1')!.prize!, 'campeao leva mais que o vice');
ok((t.players.find(p => p.id === 'p6')!.prize ?? 0) === 0, 'fora do ITM leva zero');

// nao da pra eliminar o ultimo
const antes = JSON.stringify(t);
const depois = eliminar(t, 'p0');
ok(JSON.stringify(depois) === antes, 'eliminar num torneio encerrado nao muda nada');

// desfazer a ultima eliminacao reabre o torneio
let u = desfazerEliminacao(t, 'p1');
ok(u.status === 'running', 'desfazer reabre o torneio');
ok(emJogo(u).length === 2, 'campeao volta pra mesa junto (2 de pe)');
ok(u.players.every(p => p.prize === undefined || p.position! > 2), 'premios do topo foram limpos');

// e refazer leva ao mesmo lugar
u = eliminar(u, 'p1');
ok(u.status === 'finished' && u.players.find(p => p.id === 'p0')!.position === 1, 'refazer encerra igual');
ok(u.players.reduce((s, p) => s + (p.prize ?? 0), 0) === 3500, 'premios voltam a somar o bolo');

// ranking so conta o encerrado
const cl = calcularClassificacao([u]);
ok(cl[0].name === 'Rafael' && cl[0].wins === 1, 'campeao lidera a classificacao');
ok(cl.reduce((s, x) => s + x.saldo, 0) === 0, 'saldo da liga soma zero');

console.log(falhas ? `\n${falhas} FALHA(S)` : '\nTudo passou');
process.exit(falhas ? 1 : 0);
