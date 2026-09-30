import 'fake-indexeddb/auto';
import assert from 'node:assert/strict';
import { deleteDB } from 'idb';
import { novaIdentidade } from '../lib/identidade';
import { createOperation } from '../lib/sync-operation';
import { SyncOutbox } from '../lib/sync-outbox';
import { TournamentSyncSession, type TournamentSessionState } from '../lib/sync-tournament-session';
import type { TournamentSummary } from '../lib/sync-tournament-catalog';
import type { OperationTransport } from '../lib/sync-sender';

async function main() {
  const name = `qa-tournament-session-${novaIdentidade()}`;
  const owner = novaIdentidade(), other = novaIdentidade(), tableId = novaIdentidade();
  const outbox = new SyncOutbox(name), sessions: TournamentSyncSession[] = [];
  const updates: TournamentSessionState[] = [], sent: string[] = [];
  const remote = new Map<string, TournamentSummary>();
  const table = (revision: number): TournamentSummary => ({
    id: tableId, ownerId: owner, revision, name: 'Mesa da quarta', format: 'regular',
    status: 'upcoming', buyIn: 42, startTime: null,
    updatedAt: '2026-09-30T12:00:00+00:00', deletedAt: null,
  });
  const transport: OperationTransport = async operation => {
    sent.push(operation.id);
    remote.set(operation.entityId, table(operation.expectedRevision + 1));
    return { status: 'confirmed', receipt: { operationId: operation.id, revision: operation.expectedRevision + 1 } };
  };
  const session = new TournamentSyncSession(owner, outbox, async () => [...remote.values()], transport,
    state => updates.push(state));
  sessions.push(session);
  try {
    const preset = createOperation({ ownerId: owner, entityId: novaIdentidade(), entity: 'preset',
      kind: 'preset.save', expectedRevision: 0, payload: { name: 'Nao enviar' } });
    const foreign = createOperation({ ownerId: other, entityId: novaIdentidade(), entity: 'tournament',
      kind: 'tournament.create', expectedRevision: 0, payload: { name: 'Outra conta' } });
    await outbox.enqueue(preset);
    await outbox.enqueue(foreign);
    const create = createOperation({ ownerId: owner, entityId: tableId, entity: 'tournament',
      kind: 'tournament.create', expectedRevision: 0, payload: { name: 'Mesa da quarta' } });
    await assert.rejects(session.enqueue(foreign), /outra conta/);
    await assert.rejects(session.enqueue(preset), /outra conta ou entidade/);
    await session.enqueue(create);
    assert.equal(session.snapshot().pending[0].operation.id, create.id);
    assert.deepEqual(session.snapshot().tables, []);
    const first = session.synchronize();
    assert.equal(session.synchronize(), first);
    await first;
    assert.deepEqual(sent, [create.id], 'Only this account and entity are sent');
    assert.equal(session.snapshot().phase, 'ready');
    assert.equal(session.snapshot().tables[0].revision, 1);
    assert.deepEqual(session.snapshot().pending, []);
    assert.equal(session.snapshot().views[0].awaitingCatalog, false);
    assert.equal(session.snapshot().views[0].projectedRevision, 1);
    assert.equal((await outbox.list(owner)).find(entry => entry.operation.id === preset.id)?.status, 'queued');
    assert.equal((await outbox.list(other)).find(entry => entry.operation.id === foreign.id)?.status, 'queued');
    const copy = session.snapshot(); copy.tables.length = 0;
    assert.equal(session.snapshot().tables.length, 1, 'Snapshots do not expose mutable internal state');

    const update = createOperation({ ownerId: owner, entityId: tableId, entity: 'tournament',
      kind: 'tournament.update', expectedRevision: 1, payload: { name: 'Mudanca offline' } });
    const offline = new TournamentSyncSession(owner, outbox,
      async () => { throw new Error('Private network details'); },
      async () => ({ status: 'retry', issue: { code: 'transport', message: 'Sem conexao' } }));
    sessions.push(offline);
    await offline.enqueue(update);
    await offline.synchronize();
    assert.equal(offline.snapshot().phase, 'error');
    assert.equal(offline.snapshot().error, 'remote_read');
    assert.equal(offline.snapshot().tables[0].revision, 1);
    assert.equal(offline.snapshot().pending[0].operation.id, update.id);
    assert.equal(offline.snapshot().pending[0].status, 'queued');
    assert.equal(offline.snapshot().views[0].projectedRevision, 2);
    assert.equal(offline.snapshot().views[0].reconciliationNeeded, false);
    assert.ok(!JSON.stringify(offline.snapshot()).includes('Private'));
    offline.stop();
    await outbox.close();
    const reopened = new SyncOutbox(name);
    try {
      const reconnect = new TournamentSyncSession(owner, reopened, async () => [...remote.values()], transport);
      sessions.push(reconnect);
      await reconnect.refreshLocal();
      assert.equal(reconnect.snapshot().pending[0].operation.id, update.id);
      assert.equal(reconnect.snapshot().tables[0].revision, 1);
      await reconnect.synchronize();
      assert.equal(reconnect.snapshot().tables[0].revision, 2);
      assert.deepEqual(reconnect.snapshot().pending, []);
      assert.deepEqual(sent, [create.id, update.id]);

      const conflict = createOperation({ ownerId: owner, entityId: tableId, entity: 'tournament',
        kind: 'tournament.update', expectedRevision: 2, payload: { name: 'Conflito' } });
      const rejected = new TournamentSyncSession(owner, reopened, async () => [...remote.values()],
        async () => ({ status: 'conflict', issue: { code: 'revision_conflict', message: 'Revisao mudou' } }));
      sessions.push(rejected);
      await rejected.enqueue(conflict);
      await rejected.synchronize();
      assert.equal(rejected.snapshot().phase, 'ready');
      assert.equal(rejected.snapshot().pending[0].status, 'conflict', 'A read can succeed while a command conflicts');
      assert.equal(rejected.snapshot().tables[0].revision, 2);
      assert.equal(rejected.snapshot().views[0].reconciliationNeeded, true);

      const staleName = `qa-tournament-stale-${novaIdentidade()}`;
      const staleOutbox = new SyncOutbox(staleName);
      try {
        await staleOutbox.mergeTournamentSummaries(owner, [table(1)], new AbortController().signal);
        const staleUpdate = createOperation({ ownerId: owner, entityId: tableId, entity: 'tournament',
          kind: 'tournament.update', expectedRevision: 1, payload: { name: 'Atualizacao confirmada' } });
        const staleTransport: OperationTransport = async operation => ({ status: 'confirmed',
          receipt: { operationId: operation.id, revision: operation.expectedRevision + 1 } });
        let stale = true;
        const lagged = new TournamentSyncSession(owner, staleOutbox,
          async () => [table(stale ? 1 : 2)], staleTransport);
        sessions.push(lagged);
        await lagged.enqueue(staleUpdate);
        await lagged.synchronize();
        assert.equal(lagged.snapshot().phase, 'ready');
        assert.deepEqual(lagged.snapshot().pending, []);
        assert.equal(lagged.snapshot().views[0].awaitingCatalog, true,
          'A confirmed receipt is not proof the catalog has shown that revision');
        assert.equal(lagged.snapshot().views[0].reconciliationNeeded, false);
        stale = false;
        await lagged.synchronize();
        assert.equal(lagged.snapshot().views[0].awaitingCatalog, false);
        assert.equal(lagged.snapshot().views[0].confirmed?.revision, 2);

        const failedRead = new TournamentSyncSession(owner, staleOutbox,
          async () => { throw new Error('Private network details'); }, staleTransport);
        sessions.push(failedRead);
        await failedRead.enqueue(createOperation({ ownerId: owner, entityId: tableId,
          entity: 'tournament', kind: 'tournament.update', expectedRevision: 2, payload: { name: 'Outra edicao' } }));
        await failedRead.synchronize();
        assert.equal(failedRead.snapshot().phase, 'error');
        assert.equal(failedRead.snapshot().error, 'remote_read');
        assert.deepEqual(failedRead.snapshot().pending, []);
        assert.equal(failedRead.snapshot().views[0].awaitingCatalog, true);
        const recoveredRead = new TournamentSyncSession(owner, staleOutbox, async () => [table(3)], staleTransport);
        sessions.push(recoveredRead);
        await recoveredRead.synchronize();
        assert.equal(recoveredRead.snapshot().phase, 'ready');
        assert.equal(recoveredRead.snapshot().views[0].awaitingCatalog, false);
        assert.equal(recoveredRead.snapshot().views[0].confirmed?.revision, 3);
      } finally { await staleOutbox.close(); await deleteDB(staleName); }

      let releasePull!: (rows: TournamentSummary[]) => void, pullStarted!: () => void;
      const pulling = new Promise<void>(resolve => { pullStarted = resolve; });
      let pulls = 0;
      const duringPull = new TournamentSyncSession(owner, reopened, async () => {
        if (++pulls === 1) { pullStarted(); return new Promise(resolve => { releasePull = resolve; }); }
        return [...remote.values()];
      }, transport);
      sessions.push(duringPull);
      const running = duringPull.synchronize(); await pulling;
      assert.equal(duringPull.synchronize(true), running);
      releasePull([...remote.values()]); await running;
      assert.equal(pulls, 2, 'Reconnect requested during a pull runs one more round');

      let releaseLate!: (rows: TournamentSummary[]) => void, lateStarted!: () => void;
      const waiting = new Promise<void>(resolve => { lateStarted = resolve; });
      let readSignal!: AbortSignal;
      const lateUpdates: TournamentSessionState[] = [];
      const late = new TournamentSyncSession(owner, reopened, async signal => {
        readSignal = signal; lateStarted(); return new Promise(resolve => { releaseLate = resolve; });
      }, transport, state => lateUpdates.push(state));
      sessions.push(late);
      const pending = late.synchronize(); await waiting;
      late.stop(); assert.equal(readSignal.aborted, true);
      assert.equal(late.waitForIdle(), pending);
      const count = lateUpdates.length;
      releaseLate([{ ...table(3), name: 'Resposta tardia' }]); await pending;
      assert.equal(lateUpdates.length, count);
      assert.deepEqual(late.snapshot(), { phase: 'stopped', tables: [], pending: [], views: [], error: null });
      assert.equal((await reopened.tournamentSummaries(owner))[0].revision, 2);
      await assert.rejects(late.enqueue(create), { name: 'AbortError' });

      const otherSession = new TournamentSyncSession(other, reopened, async () => [], transport);
      sessions.push(otherSession);
      await otherSession.refreshLocal();
      assert.deepEqual(otherSession.snapshot().tables, []);
      assert.equal(otherSession.snapshot().pending[0].operation.id, foreign.id);
      assert.ok(updates.some(state => state.phase === 'syncing'));
      assert.throws(() => new TournamentSyncSession('invalid', reopened, async () => [], transport));
    } finally { sessions.forEach(value => value.stop()); await reopened.close(); }
  } finally {
    sessions.forEach(value => value.stop());
    await outbox.close(); await deleteDB(name);
  }
  console.log('Tournament session: scoped sending, offline recovery, conflicts, coalescing, isolation and late response safety passed.');
}
main().catch(error => { console.error(error); process.exitCode = 1; });
