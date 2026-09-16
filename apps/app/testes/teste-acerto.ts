import assert from 'node:assert/strict';
import type { Tournament, TournamentPlayer } from '../types';
import { settlement, settlementSummary, ORGANIZER } from '../lib/acerto';

const player = (id: string, prize: number, paid = false): TournamentPlayer => ({
  id, userId: id, name: id, buyIns: 1, reEntries: 0, addOns: 0,
  position: Number(id.slice(1)), prize, paymentStatus: paid ? 'confirmed' : 'pending',
});
const mesa = (players: TournamentPlayer[]): Tournament => ({
  id: 'teste', name: 'Quinta', format: 'regular', status: 'finished', buyIn: 100,
  reEntryAllowed: false, maxReEntries: 0, startTime: '', createdAt: '', createdBy: 'local',
  blindStructure: [], currentLevel: 0, players,
});
function check(t: Tournament) {
  const before = JSON.stringify(t);
  const plan = settlement(t);
  assert.equal(plan.error, null);
  const remaining = new Map(plan.balances.map(b => [b.id, b.cents]));
  assert.equal(plan.balances.reduce((s, b) => s + b.cents, 0), 0);
  for (const x of plan.transfers) {
    assert.ok(Number.isSafeInteger(x.cents) && x.cents > 0);
    assert.notEqual(x.from, x.to);
    remaining.set(x.from, remaining.get(x.from)! + x.cents);
    remaining.set(x.to, remaining.get(x.to)! - x.cents);
  }
  assert.ok([...remaining.values()].every(v => v === 0), 'transferencias zeram todos os saldos');
  assert.ok(plan.transfers.length <= Math.max(0, plan.balances.filter(b => b.cents !== 0).length - 1));
  assert.equal(JSON.stringify(t), before, 'sugestao nao altera pagamentos nem premios');
  return plan;
}
const unpaid = check(mesa([player('p1', 130), player('p2', 70)]));
assert.deepEqual(unpaid.transfers, [{ from: 'p2', to: 'p1', cents: 3000 }]);
const paid = check(mesa([player('p1', 130, true), player('p2', 70, true)]));
assert.equal(paid.balances.find(b => b.id === ORGANIZER)?.cents, -20000);
assert.ok(paid.transfers.every(x => x.from === ORGANIZER), 'nao cobra novamente entradas confirmadas');
const mixed = check(mesa([player('p1', 130, true), player('p2', 70)]));
assert.equal(mixed.balances.find(b => b.id === 'p2')?.cents, -3000);
assert.ok(settlementSummary(mesa([]), mixed).includes('não confirma pagamentos'));
assert.ok(settlement({ ...mesa([]), status: 'running' }).error);
assert.ok(settlement(mesa([])).error);
assert.ok(settlement(mesa([{ ...player('p1', 100), paymentStatus: 'disputed' }])).error);
assert.ok(settlement(mesa([player('p1', 99)])).error);
assert.ok(settlement(mesa([player('p1', Number.NaN)])).error);
assert.ok(settlement(mesa([player('p1', 200), player('p1', 0)])).error);
assert.ok(settlement(mesa([{ ...player('p1', 100), buyIns: -1 }])).error);
for (let n = 2; n <= 30; n++) {
  const players = Array.from({ length: n }, (_, i) => player(`p${i + 1}`, 0, i % 3 === 0));
  const t = { ...mesa(players), buyIn: 37.5 };
  players[0].prize = 37.5 * n;
  check(t);
}
const decimal = mesa([player('p1', 48.75), player('p2', 26.25)]);
decimal.buyIn = 37.5;
assert.equal(check(decimal).transfers[0].cents, 1125);
console.log('Acerto: caixa, pendentes, centavos, bloqueios, conservacao e ausencia de mutacao passaram.');
