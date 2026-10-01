import assert from 'node:assert/strict';
import { novaIdentidade } from '../lib/identidade';
import { planningFields, preparePlanningOperation } from '../lib/sync-tournament-planning';
import type { TournamentSnapshot } from '../lib/sync-tournament-reader';

const owner = novaIdentidade(), id = novaIdentidade();
const snapshot: TournamentSnapshot = { tournament: {
  id, created_by: owner, name: 'Mesa', format: 'regular', status: 'upcoming', buy_in: 35,
  re_entry_allowed: true, max_re_entries: 2, start_time: new Date(2100, 0, 2, 20, 30).toISOString(),
  current_level: 0, seconds_remaining: 1200, revision: 7, deleted_at: null,
  updated_at: '2026-10-01T12:00:00Z', clock_ends_at: null, clock_hand_for_hand: false,
  details: { location: 'Sala', capacity: 9, suit: 'copas' }, blind_levels: [],
}, players: [], invites: [] };
const draft = { day: '02/01/2100', time: '20:30', location: '  Outra sala  ', capacity: '' };
const now = new Date(2026, 9, 1);
const before = JSON.stringify(snapshot);
assert.deepEqual(planningFields(snapshot), { day: '02/01/2100', time: '20:30', location: 'Sala', capacity: '9' });
const operation = preparePlanningOperation(snapshot, draft, now);
assert.equal(operation.expectedRevision, 7);
assert.equal(operation.ownerId, owner); assert.equal(operation.entityId, id);
assert.equal(operation.kind, 'tournament.update');
assert.deepEqual(operation.payload, { startTime: new Date(2100, 0, 2, 20, 30).toISOString(),
  location: 'Outra sala', capacity: null });
assert.equal(JSON.stringify(snapshot), before);
for (const day of ['31/02/2100', '02/01/2020', '', '2100-01-02']) {
  assert.throws(() => preparePlanningOperation(snapshot, { ...draft, day }, now), /data futura/);
}
for (const time of ['25:00', '20:99', '1:30', '']) {
  assert.throws(() => preparePlanningOperation(snapshot, { ...draft, time }, now), /horário/);
}
for (const capacity of ['1', '1001', '-2', '2.5', '2e2', 'abc']) {
  assert.throws(() => preparePlanningOperation(snapshot, { ...draft, capacity }, now));
}
assert.equal(preparePlanningOperation(snapshot, { ...draft, capacity: ' 1000 ' }, now).payload.capacity, 1000);
assert.throws(() => preparePlanningOperation(snapshot, { ...draft, location: 'x'.repeat(201) }, now), /200/);
assert.throws(() => planningFields({ ...snapshot, tournament: { ...snapshot.tournament, details: { capacity: '9' } } }));
assert.throws(() => preparePlanningOperation({ ...snapshot, tournament: { ...snapshot.tournament,
  status: 'running' } }, draft, now), /agendadas/);
assert.throws(() => preparePlanningOperation({ ...snapshot, tournament: { ...snapshot.tournament,
  deleted_at: '2026-10-01T13:00:00Z' } }, draft, now), /agendadas/);
const playerId = novaIdentidade();
const occupied: TournamentSnapshot = { ...snapshot,
  players: [{ id: playerId, display_name: 'Ana' } as TournamentSnapshot['players'][number]],
  invites: [
    { name: 'Bia', deleted_at: null, player_id: null, status: 'confirmed' },
    { name: 'Carla', deleted_at: null, player_id: null, status: 'confirmed' },
    { name: 'Ana', deleted_at: null, player_id: playerId, status: 'confirmed' },
    { deleted_at: '2026-10-01T13:00:00Z', player_id: null, status: 'confirmed' },
    { deleted_at: null, player_id: null, status: 'waiting' },
  ] as TournamentSnapshot['invites'],
};
assert.throws(() => preparePlanningOperation(occupied, { ...draft, capacity: '2' }, now), /entre 3/);
assert.equal(preparePlanningOperation(occupied, { ...draft, capacity: '3' }, now).payload.capacity, 3);
assert.equal(preparePlanningOperation({ ...occupied, invites: occupied.invites.map(invite => ({ ...invite, player_id: null })) },
  { ...draft, capacity: '3' }, now).payload.capacity, 3);
console.log('Online planning: strict date/time, capacity/reservations, exact payload, ownership/revision, status and no snapshot mutation passed.');
