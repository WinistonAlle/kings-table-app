import assert from 'node:assert/strict';
import { novaIdentidade } from '../lib/identidade';
import { preparePlayerOperation, playerTotalCents, canRemoveAccountPlayer, canUndoAccountElimination } from '../lib/sync-tournament-players';
import type { TournamentSnapshot } from '../lib/sync-tournament-reader';

const owner = novaIdentidade(), id = novaIdentidade(), playerId = novaIdentidade();
const snapshot: TournamentSnapshot = { tournament: {
  id, created_by: owner, name: 'Mesa', format: 'regular', status: 'upcoming', buy_in: 73.29,
  re_entry_allowed: true, max_re_entries: 2, start_time: '2026-10-02T20:00:00Z',
  current_level: 0, seconds_remaining: 1200, revision: 7, deleted_at: null,
  updated_at: '2026-10-01T12:00:00Z', clock_ends_at: null, clock_hand_for_hand: false,
  details: { capacity: 2 }, blind_levels: [],
}, players: [{ id: playerId, tournament_id: id, user_id: null, display_name: 'Ana', buy_ins: 1,
  re_entries: 0, add_ons: 0, position: null, prize: null, payment_status: 'pending',
  financial_activity_recorded: false, eliminated_at: null, registered_at: '2026-10-01T12:00:00Z' }], invites: [] };
const before = JSON.stringify(snapshot);
const command = preparePlayerOperation(snapshot, { kind: 'add', name: '  Bia  ' });
assert.equal(command.ownerId, owner); assert.equal(command.entityId, id); assert.equal(command.expectedRevision, 7);
assert.equal(command.kind, 'player.add'); assert.equal(command.payload.name, 'Bia');
assert.notEqual(command.payload.playerId, playerId); assert.notEqual(command.payload.playerId, command.id);
assert.throws(() => preparePlayerOperation(snapshot, { kind: 'add', name: ' ana ' }), /Já existe/);
assert.throws(() => preparePlayerOperation(snapshot, { kind: 'add', name: ' ' }));
assert.throws(() => preparePlayerOperation(snapshot, { kind: 'add', name: 'x'.repeat(61) }));
const reserved = { ...snapshot, invites: [{ name: 'Carla', deleted_at: null, player_id: null, status: 'confirmed' }] as TournamentSnapshot['invites'] };
assert.throws(() => preparePlayerOperation(reserved, { kind: 'add', name: 'Bia' }), /reservadas/);
const checkedIn = { ...snapshot, invites: [{ name: 'Ana', deleted_at: null, player_id: playerId, status: 'confirmed' }] as TournamentSnapshot['invites'] };
assert.equal(preparePlayerOperation(checkedIn, { kind: 'add', name: 'Bia' }).kind, 'player.add');
assert.equal(preparePlayerOperation({ ...checkedIn, invites: [{ ...checkedIn.invites[0], player_id: null }] }, { kind: 'add', name: 'Bia' }).kind, 'player.add');
assert.equal(preparePlayerOperation(snapshot, { kind: 'rename', playerId, name: ' Ana Maria ' }).payload.name, 'Ana Maria');
assert.throws(() => preparePlayerOperation(snapshot, { kind: 'rename', playerId, name: 'Ana' }), /não foi alterado/);
assert.throws(() => preparePlayerOperation(snapshot, { kind: 'rename', playerId: novaIdentidade(), name: 'Bia' }), /não encontrado/);
assert.equal(playerTotalCents(snapshot, snapshot.players[0]), 7329);
assert.equal(preparePlayerOperation(snapshot, { kind: 'payment', playerId, status: 'confirmed' }).payload.expectedAmountCents, 7329);
assert.throws(() => preparePlayerOperation(snapshot, { kind: 'payment', playerId, status: 'pending' }), /já é/);
assert.equal(preparePlayerOperation(snapshot, { kind: 'entry', playerId, entryKind: 'reEntry', delta: 1 }).payload.expectedTotalCents, 7329);
assert.throws(() => preparePlayerOperation(snapshot, { kind: 'entry', playerId, entryKind: 'addOn', delta: -1 }), /correção/);
const purchased = { ...snapshot, players: [{ ...snapshot.players[0], re_entries: 2, add_ons: 1, financial_activity_recorded: true }] };
assert.equal(playerTotalCents(purchased, purchased.players[0]), 29316);
assert.throws(() => preparePlayerOperation(purchased, { kind: 'entry', playerId, entryKind: 'reEntry', delta: 1 }), /limite/);
assert.equal(preparePlayerOperation(purchased, { kind: 'entry', playerId, entryKind: 'reEntry', delta: -1 }).payload.expectedTotalCents, 29316);
assert.throws(() => preparePlayerOperation({ ...purchased, players: [{ ...purchased.players[0], payment_status: 'confirmed' }] },
  { kind: 'entry', playerId, entryKind: 'reEntry', delta: -1 }), /pendente/);
assert.ok(canRemoveAccountPlayer(snapshot, snapshot.players[0]));
assert.equal(preparePlayerOperation(snapshot, { kind: 'remove', playerId }).kind, 'player.remove');
assert.equal(canRemoveAccountPlayer(purchased, purchased.players[0]), false);
assert.throws(() => preparePlayerOperation(purchased, { kind: 'remove', playerId }), /histórico/);
assert.throws(() => preparePlayerOperation({ ...snapshot, tournament: { ...snapshot.tournament, status: 'paused' } },
  { kind: 'add', name: 'Bia' }), /preparação/);
assert.throws(() => preparePlayerOperation({ ...snapshot, tournament: { ...snapshot.tournament, status: 'cancelled' } },
  { kind: 'rename', playerId, name: 'Bia' }), /não aceita/);
assert.throws(() => playerTotalCents({ ...snapshot, tournament: { ...snapshot.tournament, buy_in: 73.291 } }, snapshot.players[0]), /inconsistente/);
assert.throws(() => preparePlayerOperation(snapshot, { kind: 'add', name: 'Bia', extra: true } as never));
assert.equal(JSON.stringify(snapshot), before);
const secondId = novaIdentidade(), thirdId = novaIdentidade();
const running = { ...snapshot, tournament: { ...snapshot.tournament, status: 'running' as const },
  players: [...snapshot.players, { ...snapshot.players[0], id: secondId, display_name: 'Bia' }] };
assert.equal(preparePlayerOperation(running, { kind: 'eliminate', playerId }).kind, 'player.eliminate');
assert.throws(() => preparePlayerOperation(snapshot, { kind: 'eliminate', playerId }));
assert.throws(() => preparePlayerOperation({ ...running, players: snapshot.players }, { kind: 'eliminate', playerId }));
const finished = { ...running, tournament: { ...running.tournament, status: 'finished' as const }, players: [
  { ...running.players[0], position: 1, prize: 100 },
  { ...running.players[1], position: 2, prize: 46.58 },
  { ...running.players[1], id: thirdId, position: 3, prize: 0 },
] };
assert.ok(canUndoAccountElimination(finished, finished.players[1]));
assert.equal(canUndoAccountElimination(finished, finished.players[0]), false);
assert.equal(canUndoAccountElimination(finished, finished.players[2]), false);
assert.equal(preparePlayerOperation(finished, { kind: 'undoElimination', playerId: secondId }).kind, 'player.undoElimination');
assert.throws(() => preparePlayerOperation(finished, { kind: 'undoElimination', playerId: thirdId }));
assert.throws(() => preparePlayerOperation(finished, { kind: 'eliminate', playerId }));
assert.throws(() => preparePlayerOperation(finished, { kind: 'payment', playerId, status: 'confirmed' }));
console.log('Online players: identities, revision/scope, names, capacity/reservations, cents, entries, payment and removal guards passed.');
