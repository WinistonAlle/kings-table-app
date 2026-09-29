import { eliminar, desfazerEliminacao, emJogo, incluirJogador } from '../lib/torneio';
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
ok(u.players.every(p => p.prize === undefined), 'reabrir limpa todos os premios ate recalcular resultado');

// e refazer leva ao mesmo lugar
u = eliminar(u, 'p1');
ok(u.status === 'finished' && u.players.find(p => p.id === 'p0')!.position === 1, 'refazer encerra igual');
ok(u.players.reduce((s, p) => s + (p.prize ?? 0), 0) === 3500, 'premios voltam a somar o bolo');

// ranking so conta o encerrado
const cl = calcularClassificacao([u]);
ok(cl[0].name === 'Rafael' && cl[0].wins === 1, 'campeao lidera a classificacao');
ok(cl.reduce((s, x) => s + x.saldo, 0) === 0, 'saldo da liga soma zero');

let fracionado: Tournament = {
  ...t, id: 'centavos', status: 'running', buyIn: 0.55,
  players: Array.from({ length: 10 }, (_, i) => ({
    id: `centavos-${i}`, userId: `convidado-${i}`, name: `Jogador ${i}`,
    buyIns: 1, reEntries: 0, addOns: 0, paymentStatus: 'pending' as const,
  })),
};
for (let i = 9; i >= 1; i--) fracionado = eliminar(fracionado, `centavos-${i}`);
const premiosCentavos = fracionado.players.map(p => Math.round((p.prize ?? 0) * 100));
ok(fracionado.status === 'finished', 'mesa com buy-in fracionado encerra');
ok(premiosCentavos.reduce((sum, value) => sum + value, 0) === 550,
  'premios gravados em centavos somam exatamente o bolo');
ok(premiosCentavos[0] >= premiosCentavos[1] && premiosCentavos.every(value => value >= 0),
  'resultado gravado nao inverte premiacao nem cria premio negativo');
const reaberto = desfazerEliminacao(fracionado, 'centavos-1');
ok(reaberto.status === 'running' && reaberto.players[0].prize === undefined,
  'desfazer elimina premios calculados em centavos');

let tardia: Tournament = {
  ...t, id: 'tardia', status: 'running',
  players: t.players.map(p => ({ ...p, position: undefined, prize: undefined, eliminatedAt: undefined })),
};
tardia = eliminar(tardia, 'p6');
ok(tardia.players.find(p => p.id === 'p6')?.position === 7, 'primeira queda tem colocacao inicial');
tardia = incluirJogador(tardia, {
  id: 'late', userId: 'guest-late', name: 'Entrada tardia', buyIns: 1,
  reEntries: 0, addOns: 0, paymentStatus: 'pending',
});
ok(tardia.players.find(p => p.id === 'p6')?.position === 8 && emJogo(tardia).length === 7,
  'entrada tardia desloca quedas anteriores sem duplicar colocacao');
tardia = eliminar(tardia, 'late');
ok(tardia.players.find(p => p.id === 'late')?.position === 7, 'queda seguinte ocupa a nova posicao');
ok(desfazerEliminacao(tardia, 'p6') === tardia, 'nao desfaz queda antiga fora de ordem');
tardia = desfazerEliminacao(tardia, 'late');
ok(tardia.players.find(p => p.id === 'late')?.position === undefined,
  'ultima queda apos entrada tardia ainda pode ser desfeita');
tardia = eliminar(tardia, 'late');
for (let i = 5; i >= 1; i--) tardia = eliminar(tardia, `p${i}`);
const posicoesTardias = tardia.players.map(p => p.position).sort((a, b) => a! - b!);
ok(JSON.stringify(posicoesTardias) === JSON.stringify([1, 2, 3, 4, 5, 6, 7, 8]),
  'resultado final com entrada tardia tem todas as posicoes sem repeticao');
ok(tardia.players.reduce((sum, p) => sum + (p.prize ?? 0), 0) === prizePool(tardia),
  'premiacao da entrada tardia conserva o bolo');

console.log(falhas ? `\n${falhas} FALHA(S)` : '\nTudo passou');
process.exit(falhas ? 1 : 0);
