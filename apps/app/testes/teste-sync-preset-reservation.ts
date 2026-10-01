import 'fake-indexeddb/auto';
import assert from 'node:assert/strict';
import { deleteDB } from 'idb';
import { novaIdentidade } from '../lib/identidade';
import { createOperation } from '../lib/sync-operation';
import { SyncOutbox } from '../lib/sync-outbox';
import { PresetSyncSession } from '../lib/sync-preset-session';

async function main() {
  const name = `qa-preset-reservation-${novaIdentidade()}`, owner = novaIdentidade(), other = novaIdentidade(), id = novaIdentidade();
  const a = new SyncOutbox(name), b = new SyncOutbox(name);
  const levels = [{ level: 1, smallBlind: 37, bigBlind: 74, ante: 0, durationMinutes: 7 }];
  const create = () => createOperation({ ownerId: owner, entityId: id, entity: 'preset', kind: 'preset.save', expectedRevision: 0, payload: { name: 'Minha estrutura', levels } });
    const op = create();
  try {
    const repeated = await Promise.all([a.enqueuePreset(op), b.enqueuePreset(op)]);
    assert.equal(repeated[0].operation.id, repeated[1].operation.id);
    assert.equal((await a.list(owner)).length, 1);
    await assert.rejects(a.enqueuePreset({ ...op, id: novaIdentidade(), payload: { name: 'Invalid', levels: [] } }));
    await assert.rejects(a.enqueuePreset(createOperation({ ownerId: owner, entityId: novaIdentidade(), entity: 'tournament', kind: 'tournament.create', expectedRevision: 0, payload: {} })), /estrutura/);
    await assert.rejects(a.enqueuePreset({ ...op, id: novaIdentidade(), kind: 'preset.remove', payload: { name: 'Invalid removal' } }), /Remocao/);
    assert.equal((await a.list(owner)).length, 1, 'Invalid commands must not reserve an entry');
    const raceId = novaIdentidade();
    const race = () => createOperation({ ownerId: other, entityId: raceId, entity: 'preset', kind: 'preset.save', expectedRevision: 0, payload: { name: 'Disputa', levels } });
    const raced = await Promise.allSettled([a.enqueuePreset(race()), b.enqueuePreset(race())]);
    assert.equal(raced.filter(result => result.status === 'fulfilled').length, 1);
    assert.equal(raced.filter(result => result.status === 'rejected').length, 1);
    assert.equal((await a.list(other)).length, 1);
    await assert.rejects(b.enqueuePreset(create()), /mudou/);
    await assert.rejects(b.enqueuePreset({ ...op, payload: { name: 'Outra', levels } }), /conteudo|conteúdo|diferente/i);
    assert.equal((await a.presetViews(owner))[0].projected?.revision, 1);
    const second = createOperation({ ownerId: owner, entityId: id, entity: 'preset', kind: 'preset.save', expectedRevision: 1, payload: { name: 'Revisada', levels } });
    await a.enqueuePreset(second);
    assert.equal((await a.presetViews(owner))[0].projected?.revision, 2);
    const remove = createOperation({ ownerId: owner, entityId: id, entity: 'preset', kind: 'preset.remove', expectedRevision: 2, payload: {} });
    await a.enqueuePreset(remove);
    await assert.rejects(a.enqueuePreset({ ...second, id: novaIdentidade(), expectedRevision: 3 }), /removida/);
    await a.enqueuePreset(remove);
    assert.equal((await a.list(owner)).length, 3);
    const foreign = new PresetSyncSession(other, b, async () => [], async () => { throw Error('Must not send'); });
    await assert.rejects(foreign.enqueue(op), /outra conta/);
    foreign.stop();
    const session = new PresetSyncSession(owner, a, async () => [], async () => ({ status: 'retry', issue: { code: 'offline', message: 'Offline' } }));
    await session.enqueue(op);
    assert.equal(session.snapshot().library[0].pending.length, 3);
    session.stop();
    await assert.rejects(session.enqueue(op), { name: 'AbortError' });
    const missing = createOperation({ ownerId: owner, entityId: novaIdentidade(), entity: 'preset', kind: 'preset.remove', expectedRevision: 0, payload: {} });
    await assert.rejects(a.enqueuePreset(missing), /inexistente/);
    const fresh = createOperation({ ownerId: owner, entityId: novaIdentidade(), entity: 'preset', kind: 'preset.save', expectedRevision: 0, payload: { name: 'Rollback', levels } });
    const put = IDBObjectStore.prototype.add;
    IDBObjectStore.prototype.add = function(...args) {
      if (this.name === 'operations') throw new DOMException('Storage full', 'QuotaExceededError');
      return put.apply(this, args);
    };
    try { await assert.rejects(a.enqueuePreset(fresh), { name: 'QuotaExceededError' }); }
    finally { IDBObjectStore.prototype.add = put; }
    assert.equal((await a.list(owner)).length, 3);
    const recovered = await a.enqueuePreset(fresh);
    assert.equal(recovered.sequence, 5, 'Aborted insertion must not consume a sequence');
    assert.equal((await a.list(owner)).length, 4);
    await b.close();
    const reopened = new SyncOutbox(name);
    try { await reopened.enqueuePreset(fresh); assert.equal((await reopened.list(owner)).length, 4); }
    finally { await reopened.close(); }
    const uncertain = createOperation({ ownerId: owner, entityId: novaIdentidade(), entity: 'preset', kind: 'preset.save', expectedRevision: 0, payload: { name: 'Uncertain acknowledgement', levels } });
    const reliable = new PresetSyncSession(owner, a, async () => [], async () => ({ status: 'retry', issue: { code: 'offline', message: 'Offline' } }));
    const read = a.presetViews.bind(a);
    a.presetViews = async () => { throw Error('Acknowledgement lost after committed queue write'); };
    try { await assert.rejects(reliable.enqueue(uncertain), /Acknowledgement lost/); }
    finally { a.presetViews = read; }
    await reliable.enqueue(uncertain);
    assert.equal((await a.list(owner)).filter(entry => entry.operation.id === uncertain.id).length, 1);
    reliable.stop();
  } finally { await a.close(); await b.close(); await deleteDB(name); }
  console.log('Preset reservation: stable retry, revision race, scope, removal, rollback and reload passed (IndexedDB simulated).');
}
main().catch(error => { console.error(error); process.exitCode = 1; });
