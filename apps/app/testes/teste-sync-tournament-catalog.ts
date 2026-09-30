import 'fake-indexeddb/auto';
import assert from 'node:assert/strict';
import { createClient } from '@supabase/supabase-js';
import { deleteDB, openDB } from 'idb';
import type { Database } from '../types/supabase';
import { novaIdentidade } from '../lib/identidade';
import { createOperation } from '../lib/sync-operation';
import { SyncOutbox } from '../lib/sync-outbox';
import { createTournamentCatalogReader } from '../lib/sync-tournament-catalog';

async function main() {
  const owner = novaIdentidade(), other = novaIdentidade();
  const ids = [novaIdentidade(), novaIdentidade(), novaIdentidade()].sort();
  const row = (id: string, revision = 1) => ({ id, created_by: owner, revision,
    name: `Mesa ${id.slice(0, 4)}`, format: 'regular', status: 'upcoming', buy_in: 37.5,
    start_time: '2026-09-29T12:00:00+00:00', updated_at: '2026-09-29T12:00:00+00:00',
    deleted_at: null });
  let pages: unknown[] = [[row(ids[0])], [row(ids[1])], []];
  let networkFail = false, status = 200, calls = 0;
  const cursors: (string | null)[] = [];
  const client = createClient<Database>('http://localhost:59999', 'qa-public-key', {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { fetch: async url => {
      calls++;
      if (networkFail) throw new Error('Private network details');
      const parsed = new URL(String(url));
      assert.equal(parsed.pathname, '/rest/v1/tournaments');
      assert.equal(parsed.searchParams.get('created_by'), `eq.${owner}`);
      assert.equal(parsed.searchParams.get('order'), 'id.asc');
      assert.equal(parsed.searchParams.get('limit'), '2');
      cursors.push(parsed.searchParams.get('id'));
      return new Response(JSON.stringify(pages.length ? pages.shift() : []), { status,
        headers: { 'Content-Type': 'application/json' } });
    } },
  });
  const read = createTournamentCatalogReader(client, owner, 2);
  const signal = new AbortController().signal;
  const initial = await read(signal);
  assert.deepEqual(initial.map(item => item.id), ids.slice(0, 2));
  assert.equal(calls, 3, 'Short pages must not truncate the catalog');
  assert.deepEqual(cursors, [null, `gt.${ids[0]}`, `gt.${ids[1]}`]);
  for (const invalid of [
    [row(ids[0]), row(ids[0])], [{ ...row(ids[0]), created_by: other }],
    [{ ...row(ids[0]), revision: 0 }], [{ ...row(ids[0]), extra: true }],
  ]) {
    pages = [invalid];
    await assert.rejects(read(signal), { code: 'invalid_response' });
  }
  pages = [[row(ids[0])], [{ ...row(ids[1]), buy_in: -1 }]];
  await assert.rejects(read(signal), { code: 'invalid_response' }, 'A bad later page must not return a partial catalog');
  status = 403; pages = [{ code: '42501', message: 'Private database details' }];
  await assert.rejects(read(signal), error => (error as { code: string }).code === 'unavailable'
    && !String(error).includes('Private'));
  status = 200; networkFail = true;
  await assert.rejects(read(signal), { code: 'unavailable' });
  const aborted = new AbortController(); aborted.abort();
  const beforeAbort = calls;
  await assert.rejects(read(aborted.signal), { name: 'AbortError' });
  assert.equal(calls, beforeAbort);
  assert.throws(() => createTournamentCatalogReader(client, 'wrong', 2));
  assert.throws(() => createTournamentCatalogReader(client, owner, 0));

  const name = `qa-catalog-${novaIdentidade()}`;
  const preexisting = createOperation({ ownerId: owner, entityId: ids[1], entity: 'tournament',
    kind: 'player.add', expectedRevision: 1, payload: { playerId: novaIdentidade(), name: 'Bia' } });
  const old = await openDB(name, 3, { upgrade(db) {
    const operations = db.createObjectStore('operations', { keyPath: ['operation.ownerId', 'operation.id'] });
    operations.createIndex('owner', 'operation.ownerId');
    operations.createIndex('ownerStatus', ['operation.ownerId', 'status']);
    operations.createIndex('entity', ['operation.ownerId', 'operation.entity', 'operation.entityId']);
    db.createObjectStore('counter');
    db.createObjectStore('presetBases', { keyPath: ['ownerId', 'id'] });
  } });
  await old.put('operations', { sequence: 1, operation: preexisting, status: 'queued', attempts: 0 });
  await old.put('counter', 1, 'sequence');
  old.close();
  const outbox = new SyncOutbox(name);
  try {
    assert.equal((await outbox.list(owner)).find(entry => entry.operation.id === preexisting.id)?.status, 'queued');
    const pending = createOperation({ ownerId: owner, entityId: ids[0], entity: 'tournament',
      kind: 'player.add', expectedRevision: 1, payload: { playerId: novaIdentidade(), name: 'Ana' } });
    await outbox.enqueue(pending);
    await outbox.mergeTournamentSummaries(owner, initial, signal);
    assert.deepEqual((await outbox.tournamentSummaries(owner)).map(item => item.id), ids.slice(0, 2));
    assert.deepEqual(await outbox.tournamentSummaries(other), []);
    await assert.rejects(outbox.mergeTournamentSummaries(other, initial, signal));
    const newer = { ...initial[0], revision: 2, name: 'Nome novo' };
    await outbox.mergeTournamentSummaries(owner, [newer], signal);
    await outbox.mergeTournamentSummaries(owner, [initial[0]], signal);
    assert.equal((await outbox.tournamentSummaries(owner))[0].name, 'Nome novo');
    await assert.rejects(outbox.mergeTournamentSummaries(owner, [{ ...newer, name: 'Mesmo numero, outro nome' }], signal));
    const tombstone = { ...newer, revision: 3, deletedAt: '2026-09-29T13:00:00+00:00' };
    await outbox.mergeTournamentSummaries(owner, [tombstone], signal);
    await assert.rejects(outbox.mergeTournamentSummaries(owner, [{ ...tombstone, revision: 4, deletedAt: null }], signal));
    await assert.rejects(outbox.mergeTournamentSummaries(owner, [
      { ...initial[1], revision: 2, name: 'Would roll back' },
      { ...tombstone, name: 'Divergent tombstone' },
    ], signal));
    const after = await outbox.tournamentSummaries(owner);
    assert.equal(after[0].deletedAt, tombstone.deletedAt);
    assert.equal(after[1].revision, 1, 'A failed merge must roll back earlier rows');
    assert.equal((await outbox.list(owner)).find(entry => entry.operation.id === pending.id)?.status, 'queued');
    assert.equal((await outbox.list(owner)).find(entry => entry.operation.id === preexisting.id)?.status, 'queued');
    const stop = new AbortController(); stop.abort();
    await assert.rejects(outbox.mergeTournamentSummaries(owner,
      [{ ...initial[1], id: ids[2], revision: 1 }], stop.signal), { name: 'AbortError' });
    assert.equal((await outbox.tournamentSummaries(owner)).length, 2);
    await outbox.close();
    const reopened = new SyncOutbox(name);
    try {
      assert.equal((await reopened.tournamentSummaries(owner))[0].deletedAt, tombstone.deletedAt);
      assert.equal((await reopened.list(owner)).find(entry => entry.operation.id === preexisting.id)?.status, 'queued');
      assert.deepEqual(await reopened.tournamentSummaries(other), []);
    } finally { await reopened.close(); }
  } finally {
    await outbox.close();
    await deleteDB(name);
  }
  console.log('Tournament catalog: scoped pages, cache upgrade/reload, tombstones, rollback and pending queue passed.');
}
main().catch(error => { console.error(error); process.exitCode = 1; });
