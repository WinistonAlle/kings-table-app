import assert from 'node:assert/strict';
import { clockAlert } from '../lib/clock-alerts';

const before = { tournamentId: 'a', currentLevel: 0, secondsRemaining: 61, isRunning: true };
assert.equal(clockAlert(before, { ...before, secondsRemaining: 60 }), 'minute');
assert.equal(clockAlert({ ...before, secondsRemaining: 60 }, { ...before, secondsRemaining: 59 }), null);
assert.equal(clockAlert(before, { ...before, currentLevel: 1, secondsRemaining: 600 }), 'level');
assert.equal(clockAlert(before, { ...before, secondsRemaining: 0, isRunning: false }), 'end');
assert.equal(clockAlert(before, { ...before, tournamentId: 'b', currentLevel: 1 }), null);
assert.equal(clockAlert({ ...before, isRunning: false }, { ...before, secondsRemaining: 60 }), null);
assert.equal(clockAlert({ ...before, currentLevel: 1 }, before), null);

async function main() {
  const memory = new Map<string, string>();
  Object.defineProperty(globalThis, 'window', { value: { localStorage: {
    getItem: (key: string) => memory.get(key) ?? null,
    setItem: (key: string, value: string) => memory.set(key, value),
    removeItem: (key: string) => memory.delete(key),
  } }, configurable: true });
  const originalNow = Date.now;
  let now = 1000000;
  Date.now = () => now;
  try {
    const { useBlindsStore: store } = await import('../stores/blindsStore');
    await store.persist.rehydrate();
    const levels = [{ level: 1, smallBlind: 25, bigBlind: 50, ante: 0, durationMinutes: 1 }, { level: 2, smallBlind: 50, bigBlind: 100, ante: 0, durationMinutes: 1 }];
    store.getState().selectTournament('a', levels);
    store.getState().start();
    now += 5000;
    store.getState().setHandForHand(true);
    assert.equal(store.getState().secondsRemaining, 55);
    assert.equal(store.getState().levelEndsAt, null);
    now += 600000;
    store.getState().sync();
    store.getState().start();
    assert.equal(store.getState().isRunning, false);
    assert.equal(store.getState().secondsRemaining, 55);
    assert.equal(store.getState().currentLevel, 0);
    store.getState().selectTournament('b', levels);
    assert.equal('clocks' in store.getState().clocks.a, false, 'salvar uma mesa nao aninha todos os outros relogios');
    assert.equal(store.getState().handForHand, false);
    store.getState().start();
    now += 10000;
    store.getState().selectTournament('a', levels);
    assert.equal(store.getState().handForHand, true);
    assert.equal(store.getState().secondsRemaining, 55);
    await store.persist.rehydrate();
    assert.equal(store.getState().handForHand, true);
    assert.equal(store.getState().isRunning, false);
    store.getState().setHandForHand(false);
    assert.equal(store.getState().isRunning, false, 'sair do modo nao retoma sem comando');
    store.getState().start();
    now += 10000;
    store.getState().sync();
    assert.equal(store.getState().secondsRemaining, 45);
    store.getState().setHandForHand(true);
    store.getState().reset();
    assert.equal(store.getState().handForHand, false);
    assert.equal(store.getState().secondsRemaining, 60);
  } finally { Date.now = originalNow; }
  console.log('Relogio: avisos sem duplicacao, hand-for-hand, troca de mesa, persistencia e retomada passaram.');
}
main().catch(error => { console.error(error); process.exitCode = 1; });
