import { sincronizar, iniciar, pausar, irParaNivel, type EstadoRelogio } from '../lib/timer';
import type { BlindLevel } from '../types';

let falhas = 0;
const ok = (c: boolean, m: string) => { if (!c) { falhas++; console.log('  FALHOU:', m); } else console.log('  ok:', m); };

const E: BlindLevel[] = [
  { level: 1, smallBlind: 25, bigBlind: 50, ante: 0, durationMinutes: 20 },
  { level: 2, smallBlind: 50, bigBlind: 100, ante: 0, durationMinutes: 20 },
  { level: 3, smallBlind: 75, bigBlind: 150, ante: 25, durationMinutes: 15 },
  { level: 4, smallBlind: 100, bigBlind: 200, ante: 25, durationMinutes: 15 },
];
const T0 = 1_700_000_000_000;
const parado: EstadoRelogio = { currentLevel: 0, levelEndsAt: null, secondsRemaining: 20 * 60, isRunning: false };

// corre 5 min
let s = iniciar(parado, T0);
s = sincronizar(E, s, T0 + 5 * 60_000);
ok(s.secondsRemaining === 15 * 60, `5min corridos -> faltam 15min (deu ${s.secondsRemaining / 60})`);
ok(s.currentLevel === 0, 'ainda no nivel 1');

// ficou 40 minutos em background: tem que pular pro nivel 3, sem laco
s = iniciar(parado, T0);
s = sincronizar(E, s, T0 + 40 * 60_000);
ok(s.currentLevel === 2, `40min -> nivel 3 (deu nivel ${s.currentLevel + 1})`);
ok(s.secondsRemaining === 15 * 60, `resta o nivel 3 inteiro (deu ${s.secondsRemaining / 60}min)`);

// app fechado por 3 horas: estrutura acaba, relogio para no fim
s = iniciar(parado, T0);
s = sincronizar(E, s, T0 + 180 * 60_000);
ok(s.isRunning === false && s.secondsRemaining === 0, 'estrutura esgotada -> para, sem contar negativo');
ok(s.currentLevel === E.length - 1, 'fica no ultimo nivel');

// pausa congela e nao anda mais
s = iniciar(parado, T0);
s = pausar(E, s, T0 + 3 * 60_000);
ok(s.isRunning === false && s.secondsRemaining === 17 * 60, `pausa em 17min (deu ${s.secondsRemaining / 60})`);
const depois = sincronizar(E, s, T0 + 90 * 60_000);
ok(depois.secondsRemaining === 17 * 60, 'pausado nao anda mesmo depois de 1h30');

// retomar continua de onde parou
let r = iniciar(s, T0 + 90 * 60_000);
r = sincronizar(E, r, T0 + 91 * 60_000);
ok(r.secondsRemaining === 16 * 60, `retomou e correu 1min (deu ${r.secondsRemaining / 60})`);

// pular nivel
let p = iniciar(parado, T0);
p = irParaNivel(E, p, 2, T0 + 60_000);
ok(p.currentLevel === 2 && p.secondsRemaining === 15 * 60, 'pulou pro nivel 3 com tempo cheio');
ok(p.isRunning === true, 'continua correndo depois de pular');
p = sincronizar(E, p, T0 + 60_000 + 60_000);
ok(p.secondsRemaining === 14 * 60, 'e conta a partir do salto');

// limites
const acima = irParaNivel(E, parado, 99, T0);
ok(acima.currentLevel === E.length - 1, 'nao passa do ultimo nivel');
const abaixo = irParaNivel(E, parado, -5, T0);
ok(abaixo.currentLevel === 0, 'nao passa do primeiro nivel');

// ceil: no ultimo segundo ainda mostra 1, nao 0
let c = iniciar(parado, T0);
c = sincronizar(E, c, T0 + 20 * 60_000 - 500);
ok(c.secondsRemaining === 1, `meio segundo antes do fim mostra 1 (deu ${c.secondsRemaining})`);

console.log(falhas ? `\n${falhas} FALHA(S)` : '\nTudo passou');
process.exit(falhas ? 1 : 0);
