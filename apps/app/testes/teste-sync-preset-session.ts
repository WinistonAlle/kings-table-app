import 'fake-indexeddb/auto';
import assert from 'node:assert/strict';
import { deleteDB } from 'idb';
import { novaIdentidade } from '../lib/identidade';
import { createOperation } from '../lib/sync-operation';
import { SyncOutbox } from '../lib/sync-outbox';
import { PresetSyncSession, type PresetSessionState } from '../lib/sync-preset-session';
import { applyPresetOperation, type PresetBase } from '../lib/sync-preset-model';
import type { OperationTransport } from '../lib/sync-sender';

async function main() {
  const name = `qa-preset-session-${novaIdentidade()}`, owner = novaIdentidade(), other = novaIdentidade();
  const outbox = new SyncOutbox(name), id = novaIdentidade();
  const payload = {name:'Minha estrutura',levels:[{level:1,smallBlind:25,bigBlind:50,ante:0,durationMinutes:20}]};
  const remote = new Map<string, PresetBase>(), updates: PresetSessionState[] = [];
  const sessions: PresetSyncSession[] = [];
  const sent: string[] = [];
  const transport: OperationTransport = async op => {
    sent.push(op.id); remote.set(op.entityId, applyPresetOperation(remote.get(op.entityId) ?? null, op));
    return {status:'confirmed',receipt:{operationId:op.id,revision:op.expectedRevision+1}};
  };
  const session = new PresetSyncSession(owner,outbox,async () => [...remote.values()],transport,state=>updates.push(state));
  sessions.push(session);
  try {
    const tournament = createOperation({ownerId:owner,entityId:novaIdentidade(),entity:'tournament',
      kind:'tournament.create',expectedRevision:0,payload:{name:'Do not send with preset transport'}});
    await outbox.enqueue(tournament);
    await session.mutate(id,{kind:'preset.save',payload});
    assert.equal(session.snapshot().library[0].pending.length,1);
    const first = session.synchronize();
    assert.equal(session.synchronize(),first);
    await first;
    assert.equal(sent.length,1);
    assert.equal((await outbox.list(owner)).find(entry=>entry.operation.id===tournament.id)?.status,'queued');
    assert.equal(session.snapshot().phase,'ready');
    assert.equal(session.snapshot().library[0].confirmed?.revision,1);
    assert.equal(session.snapshot().library[0].pending.length,0);
    const copy = session.snapshot();copy.library.length=0;
    assert.equal(session.snapshot().library.length,1);

    const secondId = novaIdentidade();
    await outbox.mergePresetBase({...remote.get(id)!,id:secondId});
    const before = await outbox.presetViews(owner);
    const revised = {...remote.get(id)!,revision:2,payload:{...payload,name:'New server version'}};
    await assert.rejects(outbox.mergePresetBases(owner,[revised,{...revised,id:secondId,revision:1}],new AbortController().signal),/divergentes/);
    assert.deepEqual(await outbox.presetViews(owner),before,'Later divergence rolls back all earlier bases');
    await assert.rejects(outbox.mergePresetBases(owner,[revised,revised],new AbortController().signal),/inconsistente/);
    await assert.rejects(outbox.mergePresetBases(owner,[{...revised,ownerId:other}],new AbortController().signal),/inconsistente/);
    const aborted = new AbortController();aborted.abort();
    await assert.rejects(outbox.mergePresetBases(owner,[revised],aborted.signal),{name:'AbortError'});
    assert.deepEqual(await outbox.presetViews(owner),before);
    const midAbort = new AbortController(), originalPut = IDBObjectStore.prototype.put;
    IDBObjectStore.prototype.put = function(...args) {
      const request = originalPut.apply(this,args);
      if (this.name === 'presetBases') midAbort.abort();
      return request;
    };
    try { await assert.rejects(outbox.mergePresetBases(owner,[revised],midAbort.signal),{name:'AbortError'}); }
    finally { IDBObjectStore.prototype.put = originalPut; }
    assert.deepEqual(await outbox.presetViews(owner),before,'Abort during merge rolls back base writes');

    const offline = new PresetSyncSession(owner,outbox,async()=>{throw new Error('Private network details');},
      async()=>({status:'retry',issue:{code:'transport',message:'No connection'}}));
    sessions.push(offline);
    await offline.mutate(id,{kind:'preset.save',payload:{...payload,name:'Offline intention'}});
    await offline.synchronize();
    assert.equal(offline.snapshot().phase,'error');
    assert.equal(offline.snapshot().error,'remote_read');
    assert.equal(offline.snapshot().library.find(row=>row.id===id)?.pending.length,1);
    assert.equal(offline.snapshot().library.find(row=>row.id===id)?.projected?.payload?.name,'Offline intention');
    assert.ok(!JSON.stringify(offline.snapshot()).includes('Private'));
    offline.stop();
    await session.synchronize();
    assert.equal(session.snapshot().library.find(row=>row.id===id)?.pending.length,0);
    assert.equal(session.snapshot().library.find(row=>row.id===id)?.confirmed?.revision,2);

    let release!: (bases: PresetBase[])=>void, started!:()=>void;
    const waiting = new Promise<void>(resolve=>{started=resolve;});
    let readSignal!: AbortSignal;
    const lateUpdates: PresetSessionState[] = [];
    const late = new PresetSyncSession(owner,outbox,async signal=>{
      readSignal=signal;started();return new Promise(resolve=>{release=resolve;});
    },transport,state=>lateUpdates.push(state));sessions.push(late);
    const running = late.synchronize();await waiting;
    late.stop();assert.equal(readSignal.aborted,true);
    const count = lateUpdates.length;
    release([{...remote.get(id)!,revision:3,payload:{...payload,name:'Late response'}}]);
    await running;
    assert.equal(lateUpdates.length,count,'Stopped account emits no late state');
    assert.deepEqual(late.snapshot(),{phase:'stopped',library:[],error:null});
    assert.equal((await outbox.presetView(owner,id)).confirmed?.revision,2);
    await assert.rejects(late.mutate(id,{kind:'preset.remove'}),{name:'AbortError'});
    await late.synchronize();assert.equal(lateUpdates.length,count);

    const foreign = new PresetSyncSession(other,outbox,async()=>[],transport);
    sessions.push(foreign);await foreign.refreshLocal();
    assert.deepEqual(foreign.snapshot().library,[]);
    assert.ok(updates.some(state=>state.phase==='syncing'));
    assert.throws(()=>new PresetSyncSession('invalid',outbox,async()=>[],transport));
  } finally {
    sessions.forEach(session=>session.stop());
    await outbox.close();await deleteDB(name);
  }
  console.log('Preset session: scoped sending, coalesced sync, atomic pulls, offline recovery, isolation and stopped late responses passed (HTTP/IndexedDB simulated).');
}
main().catch(error=>{console.error(error);process.exitCode=1;});
