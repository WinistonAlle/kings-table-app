import assert from 'node:assert/strict';
import { novaIdentidade } from '../lib/identidade';
import { accountInviteRoster, inviteOperationLabel, prepareInviteOperation } from '../lib/sync-tournament-invites';
import type { TournamentSnapshot } from '../lib/sync-tournament-reader';

const owner = novaIdentidade(), id = novaIdentidade(), playerId = novaIdentidade(), inviteId = novaIdentidade();
const at = '2026-10-01T12:00:00Z';
const snapshot: TournamentSnapshot = { tournament: {
  id, created_by: owner, name: 'Mesa', format: 'regular', status: 'upcoming', buy_in: 73.29,
  re_entry_allowed: true, max_re_entries: 2, start_time: at, current_level: 0, seconds_remaining: 1200,
  revision: 7, deleted_at: null, updated_at: at, clock_ends_at: null, clock_hand_for_hand: false,
  details: { capacity: 2 }, blind_levels: [],
}, players: [{ id: playerId, tournament_id: id, user_id: null, display_name: 'Ana', buy_ins: 1,
  re_entries: 0, add_ons: 0, position: null, prize: null, payment_status: 'pending',
  financial_activity_recorded: false, eliminated_at: null, registered_at: at }],
invites: [{ id: inviteId, tournament_id: id, name: 'Ana', status: 'confirmed', player_id: null,
  created_at: at, waiting_since: null, deleted_at: null }] };
const before = JSON.stringify(snapshot);
const added = prepareInviteOperation(snapshot, { kind: 'add', name: ' Bia ', status: 'confirmed' });
assert.equal(added.ownerId, owner); assert.equal(added.entityId, id); assert.equal(added.expectedRevision, 7);
assert.equal(added.kind, 'invite.add'); assert.equal(added.payload.name, 'Bia');
assert.notEqual(added.payload.inviteId, inviteId); assert.notEqual(added.payload.inviteId, added.id);
assert.match(inviteOperationLabel(added)!, /Bia/);
assert.throws(() => prepareInviteOperation(snapshot, { kind: 'add', name: ' ana ', status: 'maybe' }), /Já existe/);
assert.throws(() => prepareInviteOperation(snapshot, { kind: 'add', name: ' ', status: 'confirmed' }));
assert.throws(() => prepareInviteOperation(snapshot, { kind: 'add', name: 'x'.repeat(61), status: 'confirmed' }));
assert.throws(() => prepareInviteOperation(snapshot, { kind: 'add', name: 'Bia', status: 'unknown' } as never));
assert.throws(() => prepareInviteOperation(snapshot, { kind: 'remove', inviteId, extra: true } as never));
assert.equal(prepareInviteOperation(snapshot, { kind: 'checkIn', inviteId }).payload.playerId, playerId);
const newPlayer = { ...snapshot, players: [] };
const checkIn = prepareInviteOperation(newPlayer, { kind: 'checkIn', inviteId });
assert.equal(checkIn.kind, 'invite.checkIn'); assert.notEqual(checkIn.payload.playerId, playerId);
assert.notEqual(checkIn.payload.playerId, checkIn.id);
assert.equal(prepareInviteOperation(snapshot, { kind: 'remove', inviteId }).kind, 'invite.remove');
assert.equal(prepareInviteOperation(snapshot, { kind: 'attendance', inviteId, status: 'waiting' }).payload.status, 'waiting');
assert.throws(() => prepareInviteOperation(snapshot, { kind: 'attendance', inviteId, status: 'confirmed' }), /já é/);
assert.throws(() => prepareInviteOperation(snapshot, { kind: 'remove', inviteId: novaIdentidade() }), /não encontrado/);
for (const status of ['running', 'paused', 'finished', 'cancelled'] as const) {
  assert.throws(() => prepareInviteOperation({ ...snapshot, tournament: { ...snapshot.tournament, status } }, { kind: 'remove', inviteId }), /antes do início/);
}
assert.throws(() => prepareInviteOperation({ ...snapshot, tournament: { ...snapshot.tournament, deleted_at: at } }, { kind: 'remove', inviteId }));
for (const status of ['waiting', 'maybe', 'absent'] as const) {
  assert.throws(() => prepareInviteOperation({ ...snapshot, invites: [{ ...snapshot.invites[0], status }] }, { kind: 'checkIn', inviteId }), /aguarde uma vaga/);
}
const checkedIn = { ...snapshot, invites: [{ ...snapshot.invites[0], player_id: playerId }] };
for (const action of [{ kind: 'checkIn', inviteId }, { kind: 'remove', inviteId }, { kind: 'attendance', inviteId, status: 'absent' }] as const) {
  assert.throws(() => prepareInviteOperation(checkedIn, action), /já entrou/);
}
const removed = { ...snapshot, invites: [{ ...snapshot.invites[0], deleted_at: at }] };
assert.equal(prepareInviteOperation(removed, { kind: 'add', name: 'Ana', status: 'maybe' }).kind, 'invite.add');
assert.throws(() => prepareInviteOperation(removed, { kind: 'remove', inviteId }), /não encontrado/);
assert.equal(accountInviteRoster(snapshot).reserved, 1); // Same registered player and reservation occupy one place.
assert.equal(accountInviteRoster(checkedIn).reserved, 1);
const older = novaIdentidade(), newer = novaIdentidade();
const queue = { ...snapshot, invites: [...snapshot.invites,
  { ...snapshot.invites[0], id: newer, name: 'Bia', status: 'waiting' as const, waiting_since: '2026-10-01T13:00:00Z' },
  { ...snapshot.invites[0], id: older, name: 'Carla', status: 'waiting' as const, created_at: '2026-10-01T12:30:00Z', waiting_since: '2026-10-01T12:40:00Z' },
] };
const roster = accountInviteRoster(queue);
assert.equal(roster.waiting, 2); assert.equal(roster.positions.get(older), 1); assert.equal(roster.positions.get(newer), 2);
assert.equal(roster.capacity, 2); assert.equal(roster.reserved, 1);
const sameMillisecond = { ...snapshot, invites: [
  { ...queue.invites[1], id: '00000000-0000-4000-8000-000000000001', waiting_since: '2026-10-01T12:00:00.123999Z' },
  { ...queue.invites[2], id: 'ffffffff-ffff-4fff-8fff-ffffffffffff', waiting_since: '2026-10-01T09:00:00.123001-03:00' },
] };
assert.equal(accountInviteRoster(sameMillisecond).positions.get(sameMillisecond.invites[1].id), 1);
const equalInstant = { ...sameMillisecond, invites: sameMillisecond.invites.map(row => ({ ...row, waiting_since: at })) };
assert.equal(accountInviteRoster(equalInstant).positions.get(sameMillisecond.invites[0].id), 1);
assert.equal(accountInviteRoster({ ...snapshot, tournament: { ...snapshot.tournament, details: {} } }).capacity, null);
assert.equal(JSON.stringify(snapshot), before);
console.log('Account invitations: scoped identities, validation, lifecycle, check-in reuse, reservations, queue order and immutable input passed.');
