import assert from 'node:assert/strict';
import type { Tournament, TournamentPlayer } from '../types';
import { settlement, settlementSummary, recordSettlement, voidSettlement, ORGANIZER } from '../lib/acerto';
import { auditar } from '../lib/auditoria';
import { nightSummary, tournamentCsv } from '../lib/exportacao';
import { parseBackup } from '../lib/backup';

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

const original = mesa([player('p1', 130), player('p2', 70)]);
const partial = recordSettlement(original, 'p2', 'p1', 1000);
assert.equal(partial.error, null);
assert.equal(check(partial.tournament).transfers[0].cents, 2000);
assert.equal(original.settlementPayments, undefined);
assert.ok(recordSettlement(partial.tournament, 'p2', 'p1', 2001).error);
assert.ok(recordSettlement(original, 'p1', 'p2', 1000).error);
assert.ok(recordSettlement(original, 'p2', 'p1', 0).error);
assert.ok(recordSettlement(original, 'p2', 'p1', 0.5).error);
const final = recordSettlement(partial.tournament, 'p2', 'p1', 2000).tournament;
assert.equal(check(final).transfers.length, 0);
assert.ok(recordSettlement(final, 'p2', 'p1', 1000).error, 'nao aceita pagamento duplicado apos quitar');
const reversed = voidSettlement(final, final.settlementPayments![0].id);
assert.equal(check(reversed).transfers[0].cents, 1000);
assert.equal(reversed.settlementPayments!.length, 2, 'estorno preserva historico');
assert.equal(voidSettlement(reversed, reversed.settlementPayments![0].id), reversed, 'estorno idempotente');
const changed = { ...partial.tournament, players: partial.tournament.players.map(p => ({ ...p, paymentStatus: 'confirmed' as const })) };
assert.ok(settlement(changed).error?.includes('mudaram'), 'mudanca de entradas nao duplica os pagamentos');
assert.equal(settlement(voidSettlement(changed, changed.settlementPayments![0].id)).error, null);
assert.equal(settlement(JSON.parse(JSON.stringify(partial.tournament))).transfers[0].cents, 2000, 'historico serializavel');
assert.ok(auditar(original, partial.tournament).audit?.some(e => e.summary.startsWith('Acerto:')));
assert.ok(auditar(final, reversed).audit?.some(e => e.changes.some(c => c.after === 'Estornado')));
assert.ok(tournamentCsv(reversed, 'settlement').includes('Estornado'));
assert.ok(nightSummary(partial.tournament).includes('AINDA FALTA PAGAR'));
const backupMesa = { ...partial.tournament, blindStructure: [{ level: 1, smallBlind: 25, bigBlind: 50, ante: 0, durationMinutes: 15 }] };
const snapshot = { version: 1, tournaments: [backupMesa], activeTournamentId: null, presets: [], blinds: { tournamentId: null, clocks: {}, structure: [], currentLevel: 0, secondsRemaining: 0, levelEndsAt: null, isRunning: false } };
assert.equal(parseBackup(snapshot).tournaments[0].settlementPayments?.[0].cents, 1000, 'backup preserva pagamentos');
assert.throws(() => parseBackup({ ...snapshot, tournaments: [{ ...backupMesa, settlementPayments: [{ ...backupMesa.settlementPayments![0], from: 'inexistente' }] }] }));
console.log('Transferencias: parcial, quitacao, limites, estorno, conflito e serializacao passaram.');
