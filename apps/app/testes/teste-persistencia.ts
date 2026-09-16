/* Simula o ciclo "usa, fecha o app, reabre" sem React Native: troca o
   AsyncStorage por um Map e roda os mesmos stores. */
import { sincronizar, iniciar, type EstadoRelogio } from '../lib/timer';
import { eliminar } from '../lib/torneio';
import type { BlindLevel, Tournament } from '../types';

let falhas = 0;
const ok = (c: boolean, m: string) => { if (!c) { falhas++; console.log('  FALHOU:', m); } else console.log('  ok:', m); };

// --- o que o persist guarda do relógio, serializado como JSON ---
const E: BlindLevel[] = [
  { level: 1, smallBlind: 25, bigBlind: 50, ante: 0, durationMinutes: 20 },
  { level: 2, smallBlind: 50, bigBlind: 100, ante: 0, durationMinutes: 20 },
  { level: 3, smallBlind: 75, bigBlind: 150, ante: 25, durationMinutes: 20 },
];
const T0 = 1_700_000_000_000;

let relogio: EstadoRelogio = iniciar(
  { currentLevel: 0, levelEndsAt: null, secondsRemaining: 20 * 60, isRunning: false }, T0);

// "fecha o app" = serializa e esquece tudo
const disco = JSON.stringify(relogio);
const reaberto: EstadoRelogio = JSON.parse(disco);
// reabre 35 minutos depois: onRehydrateStorage chama sync()
const depois = sincronizar(E, reaberto, T0 + 35 * 60_000);
ok(depois.currentLevel === 1, `reabriu 35min depois no nivel 2 (deu ${depois.currentLevel + 1})`);
ok(depois.secondsRemaining === 5 * 60, `faltando 5min no nivel 2 (deu ${depois.secondsRemaining / 60})`);
ok(depois.isRunning === true, 'continua correndo depois de reabrir');

// pausado sobrevive pausado
const pausado: EstadoRelogio = { currentLevel: 1, levelEndsAt: null, secondsRemaining: 7 * 60, isRunning: false };
const pausadoDepois = sincronizar(E, JSON.parse(JSON.stringify(pausado)), T0 + 99 * 60_000);
ok(pausadoDepois.secondsRemaining === 7 * 60, 'pausado reabre com o mesmo tempo');

// --- torneio sobrevive ao ciclo, com posições e prêmios ---
let t: Tournament = {
  id: 't1', name: 'Quarta', format: 'regular', status: 'upcoming', buyIn: 500,
  reEntryAllowed: false, maxReEntries: 0, startTime: '', blindStructure: [],
  currentLevel: 0, createdBy: 'me', createdAt: '',
  players: ['A','B','C','D','E'].map((n, i) => ({
    id: `p${i}`, userId: `u${i}`, name: n, buyIns: 1, reEntries: 0, addOns: 0,
    paymentStatus: 'confirmed' as const,
  })),
};
t = eliminar(t, 'p4');
t = eliminar(t, 'p3');

const torneioNoDisco: Tournament = JSON.parse(JSON.stringify(t));
ok(torneioNoDisco.players.find(p => p.id === 'p4')!.position === 5, 'posicao sobrevive ao disco');
ok(torneioNoDisco.status === 'running', 'status sobrevive ao disco');

let t2 = eliminar(torneioNoDisco, 'p2');
t2 = eliminar(t2, 'p1');
ok(t2.status === 'finished', 'da pra terminar o torneio depois de reabrir');
ok(t2.players.reduce((s, p) => s + (p.prize ?? 0), 0) === 2500, 'premios somam o bolo apos o ciclo');

console.log(falhas ? `\n${falhas} FALHA(S)` : '\nTudo passou');
process.exit(falhas ? 1 : 0);
