import 'fake-indexeddb/auto';
import assert from 'node:assert/strict';
import { deleteDB, openDB } from 'idb';
import { novaIdentidade } from '../lib/identidade';
import { SyncOutbox, type PresetResolutionRequest } from '../lib/sync-outbox';
import { PresetSyncSession } from '../lib/sync-preset-session';

async function main() {
  const name = `qa-preset-resolution-${novaIdentidade()}`;
  const owner = novaIdentidade(), other = novaIdentidade(), id = novaIdentidade();
  const payload = (name: string) => ({ name, levels: [
    { level: 1, smallBlind: 25, bigBlind: 50, ante: 0, durationMinutes: 20 },
  ] });
  const one = new SyncOutbox(name), two = new SyncOutbox(name);
  async function request(target = id, decision: PresetResolutionRequest['decision'] = { kind: 'keep_remote' }) {
    const view = await one.presetView(owner, target);
    return { expectedBase: view.confirmed, pendingOperationIds: view.pending.map(entry => entry.operation.id), decision };
  }
  try {
    const first = await one.mutatePreset(owner, id, { kind: 'preset.save', payload: payload('First intention') });
    const second = await two.mutatePreset(owner, id, { kind: 'preset.save', payload: payload('Latest intention') });
    await assert.rejects(one.resolvePreset(owner, id, await request()), /definitiva/);
    const lease = (await one.claim(owner, 1000))!;
    await assert.rejects(two.resolvePreset(owner, id, await request()), /definitiva/);
    await one.fail(owner, first.operation.id, lease.lease!.token, 'retry', { code: 'transport', message: 'Unknown outcome' });
    await assert.rejects(two.resolvePreset(owner, id, await request()), /definitiva/);
    const retried = (await two.claim(owner, 32000))!;
    await two.fail(owner, first.operation.id, retried.lease!.token, 'conflict', { code: '40001', message: 'Revision changed' });
    await one.mergePresetBase({ ownerId: owner, id, revision: 1, deleted: false, payload: payload('Server version') });
    const stale = await request();
    await two.mergePresetBase({ ownerId: owner, id, revision: 2, deleted: false, payload: payload('New server version') });
    await assert.rejects(one.resolvePreset(owner, id, stale), /mudou/);
    const copyRequest = await request(id, { kind: 'save_copy', name: ' My preserved copy ' });
    await assert.rejects(two.resolvePreset(other, id, copyRequest), /mudou/);
    await assert.rejects(two.resolvePreset(owner, id, { ...copyRequest, pendingOperationIds: [first.operation.id] }), /mudou/);
    await assert.rejects(two.resolvePreset(owner, id, { ...copyRequest, decision: { kind: 'save_copy', name: '' } }));

    const put = IDBObjectStore.prototype.put;
    IDBObjectStore.prototype.put = function(...args) {
      if (this.name === 'operations' && args[0].status === 'cancelled') {
        throw new DOMException('QA quota', 'QuotaExceededError');
      }
      return put.apply(this, args);
    };
    try { await assert.rejects(one.resolvePreset(owner, id, copyRequest), { name: 'QuotaExceededError' }); }
    finally { IDBObjectStore.prototype.put = put; }
    assert.equal((await one.list(owner)).length, 2, 'Copy and archive must roll back together');
    assert.equal((await one.presetView(owner, id)).pending.length, 2);

    const results = await Promise.allSettled([
      one.resolvePreset(owner, id, copyRequest), two.resolvePreset(owner, id, copyRequest),
    ]);
    assert.equal(results.filter(result => result.status === 'fulfilled').length, 1);
    const result = results.find(result => result.status === 'fulfilled') as PromiseFulfilledResult<Awaited<ReturnType<SyncOutbox['resolvePreset']>>>;
    const copy = result.value!;
    assert.ok(copy);
    assert.notEqual(copy.operation.entityId, id);
    assert.notEqual(copy.operation.id, first.operation.id);
    assert.equal(copy.sequence, second.sequence + 1, 'Failed transaction must not consume sequence');
    assert.equal(copy.operation.expectedRevision, 0);
    assert.equal(copy.operation.payload.name, 'My preserved copy');
    assert.deepEqual(copy.operation.payload.levels, second.operation.payload.levels);
    const view = await two.presetView(owner, id);
    assert.equal(view.pending.length, 0);
    assert.equal(view.reconciliationNeeded, false);
    assert.equal(view.confirmed?.revision, 2);
    assert.equal(view.projected?.payload?.name, 'New server version');
    assert.equal(view.archived.length, 2);
    assert.deepEqual(view.archived[0].operation, first.operation);
    assert.equal(view.archived[0].attempts, 2);
    assert.equal(view.archived[0].issue?.code, '40001');
    assert.equal(view.archived[0].resolution?.copiedTo, copy.operation.entityId);
    assert.deepEqual(view.archived[0].resolution, view.archived[1].resolution);
    assert.equal((await one.enqueue(first.operation)).status, 'cancelled');
    assert.equal(await one.confirm(owner, first.operation.id, retried.lease!.token,
      { operationId: first.operation.id, revision: 1 }), false);
    assert.equal((await one.claim(owner, 32001))?.operation.id, copy.operation.id);
    assert.deepEqual(await one.presetViews(other), []);

    const removalId = novaIdentidade();
    await one.mergePresetBase({ ownerId: owner, id: removalId, revision: 1, deleted: false, payload: payload('Before deletion') });
    const removal = await one.mutatePreset(owner, removalId, { kind: 'preset.remove' });
    const removalLease = (await one.claim(owner, 32002))!;
    assert.equal(removalLease.operation.id, removal.operation.id);
    await one.fail(owner, removal.operation.id, removalLease.lease!.token, 'conflict', { code: '40001', message: 'Already removed remotely' });
    await one.mergePresetBase({ ownerId: owner, id: removalId, revision: 2, deleted: true, payload: payload('Before deletion') });
    assert.equal(await one.resolvePreset(owner, removalId, await request(removalId)), null);
    assert.equal((await two.presetView(owner, removalId)).projected?.deleted, true);
    await assert.rejects(one.mutatePreset(owner, removalId, { kind: 'preset.save', payload: payload('Never resurrect') }), /removida/);

    const rejectedId = novaIdentidade();
    const rejected = await one.mutatePreset(owner, rejectedId, { kind: 'preset.save', payload: payload('Rejected creation') });
    const rejectedLease = (await one.claim(owner, 32003))!;
    assert.equal(rejectedLease.operation.id, rejected.operation.id);
    await one.fail(owner, rejected.operation.id, rejectedLease.lease!.token, 'rejected', { code: '22023', message: 'Validation failed' });
    const rejectedRequest = await request(rejectedId);
    const aborted = new AbortController(); aborted.abort();
    await assert.rejects(one.resolvePreset(owner, rejectedId, rejectedRequest, aborted.signal), { name: 'AbortError' });
    const midAbort = new AbortController();
    IDBObjectStore.prototype.put = function(...args) {
      const result = put.apply(this, args);
      if (this.name === 'operations' && args[0].status === 'cancelled') midAbort.abort();
      return result;
    };
    try { await assert.rejects(one.resolvePreset(owner, rejectedId, rejectedRequest, midAbort.signal), { name: 'AbortError' }); }
    finally { IDBObjectStore.prototype.put = put; }
    assert.equal((await one.presetView(owner, rejectedId)).pending[0].status, 'rejected');
    await one.resolvePreset(owner, rejectedId, rejectedRequest);
    const rejectedView = await one.presetView(owner, rejectedId);
    assert.equal(rejectedView.confirmed, null);
    assert.equal(rejectedView.pending.length, 0);
    assert.equal(rejectedView.archived[0].operation.payload.name, 'Rejected creation');
    await one.close(); await two.close();
    await assert.rejects(openDB(name, 2), { name: 'VersionError' }, 'Older clients must not reopen v3 records');
    const reopened = new SyncOutbox(name);
    try {
      assert.deepEqual(await reopened.presetView(owner, id), view);
      assert.deepEqual(await reopened.presetView(owner, rejectedId), rejectedView);
    } finally { await reopened.close(); }
  } finally { await one.close(); await two.close(); await deleteDB(name); }

  const sessionName = `${name}-session`, sessionBox = new SyncOutbox(sessionName), sessionId = novaIdentidade();
  const session = new PresetSyncSession(owner, sessionBox, async () => [], async () => ({
    status: 'rejected', issue: { code: '22023', message: 'Server rejected the command' },
  }));
  try {
    await session.mutate(sessionId, { kind: 'preset.save', payload: payload('Session intention') });
    let row = (await sessionBox.presetView(owner, sessionId));
    const input = () => ({ expectedBase: row.confirmed, pendingOperationIds: row.pending.map(entry => entry.operation.id),
      decision: { kind: 'keep_remote' as const } });
    await assert.rejects(session.resolve(sessionId, input()), /Atualize/);
    await session.synchronize();
    row = await sessionBox.presetView(owner, sessionId);
    await session.resolve(sessionId, input());
    assert.equal(session.snapshot().library[0].pending.length, 0);
    assert.equal(session.snapshot().library[0].archived.length, 1);
    session.stop();
    await assert.rejects(session.resolve(sessionId, input()), { name: 'AbortError' });
  } finally { session.stop(); await session.waitForIdle(); await sessionBox.close(); await deleteDB(sessionName); }
  console.log('Preset resolution: definitive rejection, snapshot guards, atomic archive/copy, concurrency, quota rollback, isolation and reload passed (IndexedDB simulated).');
}
main().catch(error => { console.error(error); process.exitCode = 1; });
