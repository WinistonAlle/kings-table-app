import assert from 'node:assert/strict';
import { normalizarEstrutura, validarEstrutura, valorBuyIn } from '../lib/estrutura';
import { iniciar, sincronizar } from '../lib/timer';

const levels = normalizarEstrutura([
  { level: 0, smallBlind: 25, bigBlind: 50, ante: 0, durationMinutes: 1 },
  { level: 0, isBreak: true, smallBlind: 0, bigBlind: 0, ante: 0, durationMinutes: 2 },
  { level: 0, smallBlind: 50, bigBlind: 100, ante: 10, durationMinutes: 1 },
]);
assert.equal(validarEstrutura(levels), null);
assert.deepEqual(levels.map(n => n.level), [1, 1, 2]);
assert.ok(validarEstrutura([]));
assert.ok(validarEstrutura([{ ...levels[0], durationMinutes: 0 }]));
assert.ok(validarEstrutura([{ ...levels[0], smallBlind: 100 }]));
assert.ok(validarEstrutura([{ ...levels[0], bigBlind: NaN }]));
assert.ok(validarEstrutura([levels[1]]));
assert.equal(valorBuyIn(''), 0);
assert.equal(valorBuyIn('27,50'), 27.5);
assert.equal(valorBuyIn('1.25'), 1.25);
assert.equal(valorBuyIn('abc'), 0);
assert.equal(valorBuyIn('10,999'), 0);
const inicial = iniciar({ currentLevel: 0, secondsRemaining: 60, isRunning: false, levelEndsAt: null }, 0);
const pausa = sincronizar(levels, inicial, 90000);
assert.equal(pausa.currentLevel, 1);
assert.equal(pausa.secondsRemaining, 90);
const retomado = sincronizar(levels, inicial, 190000);
assert.equal(retomado.currentLevel, 2);
assert.equal(retomado.secondsRemaining, 50);
console.log('Buy-in livre, validacao de estruturas e intervalos passaram.');
