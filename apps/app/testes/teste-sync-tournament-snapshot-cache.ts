import 'fake-indexeddb/auto';
import assert from 'node:assert/strict';
import { deleteDB, openDB } from 'idb';
import { novaIdentidade } from '../lib/identidade';
import { createOperation } from '../lib/sync-operation';
import { SyncOutbox } from '../lib/sync-outbox';
import { parseTournamentSnapshot, type TournamentSnapshot } from '../lib/sync-tournament-reader';

async function main() {
  const dbName = `qa-snapshot-${novaIdentidade()}`;
  const owner = novaIdentidade(), other = novaIdentidade();
  const ids = [novaIdentidade(), novaIdentidade()].sort();
  const time = '2026-09-30T12:00:00+00:00';
  const snapshot = (id: string, revision: number, name = 'Mesa QA'): TournamentSnapshot => ({
    tournament: {
      id, created_by: owner, name, format: 'regular', status: 'upcoming', buy_in: 20,
      re_entry_allowed: false, max_re_entries: 0, start_time: time, current_level: 0,
      seconds_remaining: 1200, revision, deleted_at: null,
      updated_at: `2026-09-30T12:00:${String(revision).padStart(2, '0')}+00:00`,
      clock_ends_at: null, clock_hand_for_hand: false,
      blind_levels: [{ level: 1, smallBlind: 25, bigBlind: 50, ante: 0, durationMinutes: 20 }],
      details: { capacity: 8, location: 'Casa QA' },
    }, players: [], invites: [],
  });
  const pending = createOperation({ ownerId: owner, entityId: ids[0], entity: 'tournament',
    kind: 'player.add', expectedRevision: 1, payload: { playerId: novaIdentidade(), name: 'Ana' } });
  const old = await openDB(dbName, 4, { upgrade(db) {
    const operations = db.createObjectStore('operations', { keyPath: ['operation.ownerId', 'operation.id'] });
    operations.createIndex('owner', 'operation.ownerId');
    operations.createIndex('ownerStatus', ['operation.ownerId', 'status']);
    operations.createIndex('entity', ['operation.ownerId', 'operation.entity', 'operation.entityId']);
    db.createObjectStore('counter');
    db.createObjectStore('presetBases', { keyPath: ['ownerId', 'id'] });
    db.createObjectStore('tournamentSummaries', { keyPath: ['ownerId', 'id'] });
  } });
  await old.put('operations', { sequence: 1, operation: pending, status: 'queued', attempts: 0 });
  await old.put('counter', 1, 'sequence');
  old.close();

  let one = new SyncOutbox(dbName), two = new SyncOutbox(dbName);
  const signal = new AbortController().signal;
  try {
    assert.equal((await one.list(owner))[0].operation.id, pending.id, 'upgrade preserva o comando');
    const first = snapshot(ids[0], 1), second = snapshot(ids[1], 1);
    await one.mergeTournamentSnapshots(owner, [first, second], signal);
    assert.equal((await one.tournamentSnapshot(owner, ids[0]))?.tournament.name, 'Mesa QA');
    assert.equal((await two.tournamentSnapshot(other, ids[0])), null);
    assert.deepEqual((await one.tournamentSummaries(owner)).map(row => row.id), ids);
    await assert.rejects(one.mergeTournamentSnapshots(other, [first], signal), /conta/);
    await assert.rejects(one.mergeTournamentSnapshots(owner, [first, first], signal), /inconsistente/);
    await assert.rejects(one.mergeTournamentSnapshots(owner, [{ ...first,
      players: [{ id: novaIdentidade(), tournament_id: ids[1] } as never] }], signal));

    await one.mergeTournamentSnapshots(owner, [{ ...first, tournament: { ...first.tournament,
      details: { location: 'Casa QA', capacity: 8 } } }], signal);
    await assert.rejects(one.mergeTournamentSnapshots(owner, [snapshot(ids[0], 1, 'Outra mesa')], signal),
      /divergem/);
    const changes = [snapshot(ids[0], 2, 'Versao 2'), snapshot(ids[0], 2, 'Conflito')];
    const race = await Promise.allSettled([
      one.mergeTournamentSnapshots(owner, [changes[0]], signal),
      two.mergeTournamentSnapshots(owner, [changes[1]], signal),
    ]);
    assert.deepEqual(race.map(result => result.status).sort(), ['fulfilled', 'rejected']);
    const winner = (await one.tournamentSnapshot(owner, ids[0]))!;
    assert.equal(winner.tournament.revision, 2);
    await one.mergeTournamentSnapshots(owner, [first], signal);
    assert.equal((await one.tournamentSnapshot(owner, ids[0]))?.tournament.name, winner.tournament.name);

    await assert.rejects(one.mergeTournamentSnapshots(owner,
      [snapshot(ids[1], 2), snapshot(ids[0], 2, 'Terceira variante')], signal), /divergem/);
    assert.equal((await one.tournamentSnapshot(owner, ids[1]))?.tournament.revision, 1,
      'falha na segunda mesa desfaz a primeira escrita');
    const aborted = new AbortController(); aborted.abort();
    await assert.rejects(one.mergeTournamentSnapshots(owner, [snapshot(ids[1], 2)], aborted.signal),
      { name: 'AbortError' });
    assert.equal((await one.tournamentSnapshot(owner, ids[1]))?.tournament.revision, 1);

    const newer = { ...winner.tournament, revision: 3, updated_at: '2026-09-30T12:00:03+00:00' };
    await one.mergeTournamentSummaries(owner, [{ ownerId: owner, id: ids[0], revision: 3,
      name: newer.name, format: newer.format, status: newer.status, buyIn: newer.buy_in,
      startTime: newer.start_time, updatedAt: newer.updated_at, deletedAt: null }], signal);
    assert.equal(await one.tournamentSnapshot(owner, ids[0]), null, 'catalogo novo invalida detalhe antigo');
    await one.mergeTournamentSnapshots(owner, [{ ...winner, tournament: newer }], signal);
    assert.equal((await one.tournamentSnapshot(owner, ids[0]))?.tournament.revision, 3);
    await assert.rejects(one.mergeTournamentSummaries(owner, [{ ownerId: owner, id: ids[0], revision: 3,
      name: 'Divergente', format: newer.format, status: newer.status, buyIn: newer.buy_in,
      startTime: newer.start_time, updatedAt: newer.updated_at, deletedAt: null }], signal), /divergentes/);

    const deletedAt = '2026-09-30T12:01:00+00:00';
    await one.mergeTournamentSnapshots(owner, [{ ...winner, tournament: {
      ...newer, revision: 4, status: 'cancelled', deleted_at: deletedAt,
      updated_at: deletedAt,
    } }], signal);
    assert.equal(await one.tournamentSnapshot(owner, ids[0]), null, 'tombstone nao vira mesa ativa');
    await assert.rejects(one.mergeTournamentSnapshots(owner, [snapshot(ids[0], 5)], signal), /ressurgir/);
    assert.equal((await one.tournamentSummaries(owner)).find(row => row.id === ids[0])?.deletedAt, deletedAt);

    await one.close(); await two.close();
    one = new SyncOutbox(dbName); two = new SyncOutbox(dbName);
    assert.equal((await one.tournamentSnapshot(owner, ids[1]))?.tournament.revision, 1);
    assert.equal(await one.tournamentSnapshot(owner, ids[0]), null);
    assert.equal((await one.list(owner))[0].operation.id, pending.id);
    assert.equal((await one.tournamentSummaries(other)).length, 0);
    assert.equal(parseTournamentSnapshot(second).tournament.id, ids[1]);
  } finally { await one.close(); await two.close(); await deleteDB(dbName); }
  console.log('Tournament snapshot cache: upgrade, account scope, races, rollback, tombstones and reload passed.');
}
main().catch(error => { console.error(error); process.exitCode = 1; });
