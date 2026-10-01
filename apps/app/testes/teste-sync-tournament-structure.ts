import assert from 'node:assert/strict';
import { novaIdentidade } from '../lib/identidade';
import { prepareStructureOperation } from '../lib/sync-tournament-structure';
import type { TournamentSnapshot } from '../lib/sync-tournament-reader';

const snapshot: TournamentSnapshot = { tournament: {
  id: novaIdentidade(), created_by: novaIdentidade(), name: 'Mesa', format: 'regular', status: 'upcoming', buy_in: 35,
  re_entry_allowed: true, max_re_entries: 2, start_time: '2100-01-02T20:00:00Z',
  current_level: 0, seconds_remaining: 1200, revision: 7, deleted_at: null,
  updated_at: '2026-10-01T12:00:00Z', clock_ends_at: null, clock_hand_for_hand: false, details: {},
  blind_levels: [{ level: 1, smallBlind: 25, bigBlind: 50, ante: 0, durationMinutes: 20 }],
}, players: [], invites: [] };
const input = [
  { level: 0, smallBlind: 40, bigBlind: 80, ante: 10, durationMinutes: 7 },
  { level: 0, smallBlind: 999, bigBlind: 999, ante: 999, durationMinutes: 3, isBreak: true },
  { level: 0, smallBlind: 75, bigBlind: 150, ante: 15, durationMinutes: 9 },
];
const before = JSON.stringify({ snapshot, input });
const op = prepareStructureOperation(snapshot, input);
assert.equal(op.kind, 'clock.structure'); assert.equal(op.ownerId, snapshot.tournament.created_by);
assert.equal(op.entityId, snapshot.tournament.id); assert.equal(op.expectedRevision, 7);
assert.deepEqual(op.payload.levels, [
  { ...input[0], level: 1 },
  { ...input[1], level: 1, smallBlind: 0, bigBlind: 0, ante: 0 },
  { ...input[2], level: 2 },
]);
assert.throws(() => prepareStructureOperation(snapshot, snapshot.tournament.blind_levels), /não foi alterada/);
assert.throws(() => prepareStructureOperation(snapshot, [{ durationMinutes: 20, ante: 0, bigBlind: 50, smallBlind: 25, level: 1, isBreak: false }]), /não foi alterada/);
for (const value of [[], null, [{ ...input[0], durationMinutes: 0 }], [{ ...input[0], smallBlind: 99 }],
  [{ ...input[0], extra: true }], [{ ...input[0], bigBlind: NaN }]]) assert.throws(() => prepareStructureOperation(snapshot, value));
for (const status of ['running', 'paused', 'finished', 'cancelled'] as const) {
  assert.throws(() => prepareStructureOperation({ ...snapshot, tournament: { ...snapshot.tournament, status } }, input), /antes do início/);
}
assert.throws(() => prepareStructureOperation({ ...snapshot, tournament: { ...snapshot.tournament, deleted_at: '2026-10-01T13:00:00Z' } }, input));
assert.equal(JSON.stringify({ snapshot, input }), before);
console.log('Account structure: normalized custom blinds/breaks, strict validation, unchanged detection, scope, revision, lifecycle and immutable input passed.');
