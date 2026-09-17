import 'fake-indexeddb/auto';
import assert from 'node:assert/strict';
import { openDB, deleteDB } from 'idb';
import { novaIdentidade } from '../lib/identidade';
import { createOperation } from '../lib/sync-operation';
import { SyncOutbox } from '../lib/sync-outbox';
import { preparePresetPayload } from '../lib/sync-preset-model';

async function main() {
  const name = `qa-preset-cache-${novaIdentidade()}`, owner = novaIdentidade(), other = novaIdentidade();
  const id = novaIdentidade();
  const payload = (name: string) => ({ name, levels: [
    { level: 99, smallBlind: 25, bigBlind: 50, ante: 0, durationMinutes: 20 },
  ] });
  const legacy = createOperation({ ownerId: owner, entityId: novaIdentidade(), entity: 'tournament',
    kind: 'tournament.create', expectedRevision: 0, payload: { name: 'Preserved v1' } });
  assert.equal(Array.from(preparePresetPayload(payload('\u{1f0a1}'.repeat(120))).name).length,120);
  assert.throws(()=>preparePresetPayload(payload('\u{1f0a1}'.repeat(121))));
  const old = await openDB(name,1,{ upgrade(db) {
    const store = db.createObjectStore('operations',{ keyPath: ['operation.ownerId','operation.id'] });
    store.createIndex('owner','operation.ownerId');store.createIndex('ownerStatus',['operation.ownerId','status']);
    db.createObjectStore('counter');
  } });
  await old.put('operations',{ sequence: 42, operation: legacy, status: 'confirmed', attempts: 1,
    receipt: { operationId: legacy.id, revision: 1 } });
  await old.put('counter',42,'sequence');old.close();
  const one = new SyncOutbox(name), two = new SyncOutbox(name);
  try {
    assert.equal((await one.list(owner))[0].operation.id,legacy.id);
    await assert.rejects(one.mutatePreset(owner,id,{kind:'preset.save',payload:payload('   ')}));
    await assert.rejects(one.mutatePreset(owner,id,{kind:'preset.save',payload:{name:'Invalid',levels:[]}}));
    const [first,second] = await Promise.all([
      one.mutatePreset(owner,id,{kind:'preset.save',payload:payload(' First ')}),
      two.mutatePreset(owner,id,{kind:'preset.save',payload:payload('Second')}),
    ]);
    assert.deepEqual([first.sequence,second.sequence],[43,44]);
    assert.deepEqual([first.operation.expectedRevision,second.operation.expectedRevision],[0,1]);
    let view = await one.presetView(owner,id);
    assert.equal(view.confirmed,null);
    assert.equal(view.projected?.payload?.name,'Second');
    assert.equal(view.projected?.payload?.levels[0].level,1);
    assert.equal(view.pending.length,2);
    let entry = (await one.claim(owner,1000))!;
    await one.confirm(owner,entry.operation.id,entry.lease!.token,{operationId:entry.operation.id,revision:1});
    view = await two.presetView(owner,id);
    assert.equal(view.confirmed?.payload?.name,'First');
    assert.equal(view.projected?.payload?.name,'Second');
    assert.equal(view.pending.length,1);
    entry = (await one.claim(owner,1001))!;
    const put = IDBObjectStore.prototype.put;
    IDBObjectStore.prototype.put = function(...args) {
      if(this.name==='presetBases')throw new DOMException('QA cache quota','QuotaExceededError');
      return put.apply(this,args);
    };
    try { await assert.rejects(one.confirm(owner,entry.operation.id,entry.lease!.token,
      {operationId:entry.operation.id,revision:2}),{name:'QuotaExceededError'}); }
    finally { IDBObjectStore.prototype.put = put; }
    assert.equal((await one.presetView(owner,id)).confirmed?.revision,1);
    assert.equal((await one.list(owner)).find(row=>row.operation.id===second.operation.id)!.status,'sending');
    await two.confirm(owner,entry.operation.id,entry.lease!.token,{operationId:entry.operation.id,revision:2});
    const base = (await one.presetView(owner,id)).confirmed!;
    assert.equal(base.revision,2);
    assert.equal(await one.mergePresetBase({...base,revision:1}),false);
    assert.equal(await one.mergePresetBase({...base}),false);
    await assert.rejects(one.mergePresetBase({...base,payload:{...base.payload!,name:'Different'}}),/divergentes/);
    const pending = await one.mutatePreset(owner,id,{kind:'preset.save',payload:payload('Local intention')});
    await two.mergePresetBase({...base,revision:3,payload:{...base.payload!,name:'Another device'}});
    view = await one.presetView(owner,id);
    assert.equal(view.reconciliationNeeded,true);
    assert.equal(view.pending[0].operation.id,pending.operation.id);
    assert.equal(view.projected?.payload?.name,'Another device');
    await assert.rejects(one.mutatePreset(owner,id,{kind:'preset.save',payload:payload('No silent rebase')}),/pendentes/);
    entry = (await two.claim(owner,1002))!;
    await one.fail(owner,entry.operation.id,entry.lease!.token,'conflict',{code:'40001',message:'Revision changed'});
    assert.equal((await two.presetView(owner,id)).pending[0].status,'conflict');
    assert.equal((await two.presetView(other,id)).confirmed,null);
    assert.equal((await two.presetView(other,id)).pending.length,0);

    const removedId = novaIdentidade();
    await one.mergePresetBase({...base,id:removedId,revision:1});
    const removal = await one.mutatePreset(owner,removedId,{kind:'preset.remove'});
    assert.equal((await one.presetView(owner,removedId)).confirmed?.deleted,false);
    assert.equal((await one.presetView(owner,removedId)).projected?.deleted,true);
    await assert.rejects(one.mutatePreset(owner,removedId,{kind:'preset.save',payload:payload('Resurrect')}),/removida/);
    entry = (await one.claim(owner,1003))!;
    assert.equal(entry.operation.id,removal.operation.id);
    await one.confirm(owner,entry.operation.id,entry.lease!.token,{operationId:entry.operation.id,revision:2});
    const tombstone = (await one.presetView(owner,removedId)).confirmed!;
    await assert.rejects(one.mergePresetBase({...tombstone,revision:3,deleted:false}),/ressurgir/);
    const observedId = novaIdentidade();
    const observed = await one.mutatePreset(owner,observedId,{kind:'preset.save',payload:payload('Observed commit')});
    await one.mergePresetBase({ownerId:owner,id:observedId,revision:1,deleted:false,payload:observed.operation.payload as typeof base.payload});
    assert.equal((await one.presetView(owner,observedId)).reconciliationNeeded,true);
    entry = (await one.claim(owner,1004))!;
    await one.confirm(owner,entry.operation.id,entry.lease!.token,{operationId:entry.operation.id,revision:1});
    assert.equal((await one.presetView(owner,observedId)).reconciliationNeeded,false);
    const opaqueId = novaIdentidade();
    await one.enqueue(createOperation({ownerId:owner,entityId:opaqueId,entity:'preset',kind:'preset.remove',expectedRevision:5,payload:{}}));
    entry = (await one.claim(owner,1005))!;
    await one.confirm(owner,entry.operation.id,entry.lease!.token,{operationId:entry.operation.id,revision:6});
    assert.equal((await one.presetView(owner,opaqueId)).confirmed?.payload,null);
    assert.equal(await one.mergePresetBase({...tombstone,id:opaqueId,revision:6}),true);
    assert.ok((await one.presetView(owner,opaqueId)).confirmed?.payload);
    await one.close();await two.close();
    const reopened = new SyncOutbox(name);
    try {
      assert.equal((await reopened.presetView(owner,id)).reconciliationNeeded,true);
      assert.equal((await reopened.presetView(owner,removedId)).confirmed?.deleted,true);
      assert.equal((await reopened.list(owner))[0].sequence,42);
    } finally { await reopened.close(); }
  } finally { await one.close();await two.close();await deleteDB(name); }
  console.log('Preset cache: v1 upgrade, atomic revisions/ack, quota rollback, projections, stale pulls, conflicts and tombstones passed (IndexedDB simulated).');
}
main().catch(error=>{console.error(error);process.exitCode=1;});
