import 'fake-indexeddb/auto';
import assert from 'node:assert/strict';
import { deleteDB } from 'idb';
import { novaIdentidade } from '../lib/identidade';
import { createOperation } from '../lib/sync-operation';
import { SyncOutbox, type TournamentResolutionRequest } from '../lib/sync-outbox';
import { TournamentSyncSession } from '../lib/sync-tournament-session';
import type { TournamentSummary } from '../lib/sync-tournament-catalog';

async function main() {
  const name = `qa-tournament-resolution-${novaIdentidade()}`;
  const owner = novaIdentidade(), other = novaIdentidade(), id = novaIdentidade();
  let one = new SyncOutbox(name), two = new SyncOutbox(name);
  const signal = () => new AbortController().signal;
  const summary = (revision: number, deletedAt: string | null = null): TournamentSummary => ({
    ownerId: owner, id, revision, name: 'Mesa da conta', format: 'regular', status: 'upcoming',
    buyIn: 35, startTime: null, updatedAt: '2026-10-01T12:00:00Z', deletedAt,
  });
  const command = (expectedRevision: number) => createOperation({ ownerId: owner, entityId: id,
    entity: 'tournament', kind: 'tournament.update', expectedRevision,
    payload: { startTime: '2027-01-01T20:00:00Z', location: 'Sala', capacity: 8 } });
  const request = async (): Promise<TournamentResolutionRequest> => {
    const view = (await one.tournamentView(owner)).views.find(row => row.id === id)!;
    return { expectedBase: view.confirmed, pendingOperationIds: view.pending.map(row => row.operation.id),
      decision: { kind: 'keep_remote' } };
  };
  try {
    await one.mergeTournamentSummaries(owner, [summary(1)], signal());
    const first = await one.enqueueTournament(command(1));
    const dependent = await two.enqueueTournament(command(2));
    await assert.rejects(one.resolveTournament(owner, id, await request()), /definitiva/);
    const lease = (await one.claim(owner, 1000, 30000, 'tournament'))!;
    await assert.rejects(two.resolveTournament(owner, id, await request()), /definitiva/);
    await one.fail(owner, first.operation.id, lease.lease!.token, 'retry',
      { code: 'transport', message: 'Resultado desconhecido' });
    await assert.rejects(two.resolveTournament(owner, id, await request()), /definitiva/);
    const retry = (await two.claim(owner, 32000, 30000, 'tournament'))!;
    await two.fail(owner, first.operation.id, retry.lease!.token, 'conflict',
      { code: '40001', message: 'Revisao alterada no servidor' });
    const stale = await request();
    await two.mergeTournamentSummaries(owner, [summary(3)], signal());
    await assert.rejects(one.resolveTournament(owner, id, stale), /mudou/);
    const current = await request();
    await assert.rejects(one.resolveTournament(other, id, current), /mudou/);
    await assert.rejects(one.resolveTournament(owner, id, { ...current, pendingOperationIds: [first.operation.id] }), /mudou/);
    await assert.rejects(one.resolveTournament(owner, id, { ...current,
      expectedBase: { ...current.expectedBase!, name: 'Changed without revision' } }), /mudou/);
    await assert.rejects(one.resolveTournament(owner, id, { ...current,
      decision: { kind: 'save_copy' } } as unknown as TournamentResolutionRequest));

    const put = IDBObjectStore.prototype.put;
    let writes = 0;
    IDBObjectStore.prototype.put = function(...args) {
      if (this.name === 'operations' && args[0].status === 'cancelled' && ++writes === 2) {
        throw new DOMException('QA quota', 'QuotaExceededError');
      }
      return put.apply(this, args);
    };
    try { await assert.rejects(one.resolveTournament(owner, id, current), { name: 'QuotaExceededError' }); }
    finally { IDBObjectStore.prototype.put = put; }
    assert.deepEqual((await one.tournamentView(owner)).pending.map(row => row.status), ['conflict', 'queued']);
    const abort = new AbortController();
    IDBObjectStore.prototype.put = function(...args) {
      const result = put.apply(this, args);
      if (this.name === 'operations' && args[0].status === 'cancelled') abort.abort();
      return result;
    };
    try { await assert.rejects(one.resolveTournament(owner, id, current, abort.signal), { name: 'AbortError' }); }
    finally { IDBObjectStore.prototype.put = put; }
    assert.equal((await one.tournamentView(owner)).pending.length, 2);
    const results = await Promise.allSettled([
      one.resolveTournament(owner, id, current), two.resolveTournament(owner, id, current),
    ]);
    assert.deepEqual(results.map(row => row.status).sort(), ['fulfilled', 'rejected']);
    const history = await one.list(owner);
    assert.deepEqual(history.map(row => row.status), ['cancelled', 'cancelled']);
    assert.deepEqual(history[0].operation, first.operation);
    assert.deepEqual(history[1].operation, dependent.operation);
    assert.equal(history[0].attempts, 2);
    assert.equal(history[0].issue?.code, '40001');
    assert.equal(history[0].resolution?.kind, 'keep_remote');
    assert.deepEqual(history[0].resolution, history[1].resolution);
    assert.equal((await one.tournamentView(owner)).views[0].reconciliationNeeded, false);
    assert.equal(await one.confirm(owner, first.operation.id, retry.lease!.token,
      { operationId: first.operation.id, revision: 2 }), false);
    assert.equal((await one.enqueueTournament(first.operation)).status, 'cancelled');
    const next = await one.enqueueTournament(command(3));
    assert.equal(next.sequence, dependent.sequence + 1);
    assert.equal((await two.claim(owner, 32001, 30000, 'tournament'))?.operation.id, next.operation.id);
    assert.deepEqual(await one.list(other), []);
    await one.close(); await two.close();
    one = new SyncOutbox(name); two = new SyncOutbox(name);
    assert.deepEqual((await one.list(owner)).slice(0, 2), history);

    const removed = novaIdentidade();
    await one.mergeTournamentSummaries(owner, [{ ...summary(1), id: removed }], signal());
    const removal = await one.enqueueTournament(createOperation({ ...command(1), entityId: removed,
      kind: 'tournament.delete', payload: {} }));
    const removalLease = (await one.claim(owner, 32002, 30000, 'tournament'))!;
    assert.equal(removalLease.operation.id, removal.operation.id);
    await one.fail(owner, removal.operation.id, removalLease.lease!.token, 'conflict',
      { code: '40001', message: 'Removed remotely' });
    const tombstone = { ...summary(2, '2026-10-01T13:00:00Z'), id: removed };
    await one.mergeTournamentSummaries(owner, [tombstone], signal());
    await one.resolveTournament(owner, removed, { expectedBase: tombstone,
      pendingOperationIds: [removal.operation.id], decision: { kind: 'keep_remote' } });
    await assert.rejects(one.enqueueTournament(createOperation({ ...command(2), entityId: removed })), /Atualize/);

    const rejectedId = novaIdentidade();
    const creation = await one.enqueueTournament(createOperation({ ...command(0), entityId: rejectedId,
      kind: 'tournament.create' }));
    const creationLease = (await one.claim(owner, 32003, 30000, 'tournament'))!;
    assert.equal(creationLease.operation.id, creation.operation.id);
    await one.fail(owner, creation.operation.id, creationLease.lease!.token, 'rejected',
      { code: '22023', message: 'Invalid creation' });
    await one.resolveTournament(owner, rejectedId, { expectedBase: null,
      pendingOperationIds: [creation.operation.id], decision: { kind: 'keep_remote' } });
    const rejectedView = (await one.tournamentView(owner)).views.find(row => row.id === rejectedId)!;
    assert.equal(rejectedView.projectedRevision, null);
    assert.equal(rejectedView.pending.length, 0);
    assert.equal(rejectedView.reconciliationNeeded, false);
    assert.equal((await one.list(owner)).find(row => row.operation.id === creation.operation.id)?.issue?.code, '22023');
  } finally { await one.close(); await two.close(); await deleteDB(name); }

  const sessionName = `${name}-session`, box = new SyncOutbox(sessionName);
  let unavailable = false;
  const session = new TournamentSyncSession(owner, box, async () => {
    if (unavailable) throw new Error('Offline');
    return [summary(1)];
  }, async () => ({ status: 'rejected', issue: { code: '22023', message: 'Invalid planning' } }));
  try {
    await box.mergeTournamentSummaries(owner, [summary(1)], signal());
    await session.enqueue(command(1));
    const input = async () => {
      const row = (await box.tournamentView(owner)).views[0];
      return { expectedBase: row.confirmed, pendingOperationIds: row.pending.map(item => item.operation.id),
        decision: { kind: 'keep_remote' as const } };
    };
    await assert.rejects(session.resolve(id, await input()), /Atualize/);
    await session.synchronize();
    unavailable = true;
    await session.synchronize();
    await assert.rejects(session.resolve(id, await input()), /Atualize/);
    unavailable = false;
    await session.synchronize();
    await session.resolve(id, await input());
    assert.equal(session.snapshot().pending.length, 0);
    assert.equal((await box.list(owner))[0].status, 'cancelled');
    await session.enqueue(command(1));
    await session.synchronize();
    const stoppedInput = await input();
    const put = IDBObjectStore.prototype.put;
    IDBObjectStore.prototype.put = function(...args) {
      const result = put.apply(this, args);
      if (this.name === 'operations' && args[0].status === 'cancelled') session.stop();
      return result;
    };
    try {
      const resolving = session.resolve(id, stoppedInput);
      const idle = session.waitForIdle();
      await assert.rejects(resolving, { name: 'AbortError' });
      await idle;
    } finally { IDBObjectStore.prototype.put = put; }
    assert.equal((await box.tournamentView(owner)).pending[0].status, 'rejected', 'Account exit rolls back resolution');
    assert.throws(() => session.resolve(id, { expectedBase: summary(1), pendingOperationIds: [novaIdentidade()],
      decision: { kind: 'keep_remote' } }), { name: 'AbortError' });
  } finally { session.stop(); await session.waitForIdle(); await box.close(); await deleteDB(sessionName); }
  console.log('Tournament resolution: definitive outcomes, stale guards, atomic archive, races, quota/abort rollback, isolation, reload and session recovery passed (IndexedDB simulated).');
}
main().catch(error => { console.error(error); process.exitCode = 1; });
