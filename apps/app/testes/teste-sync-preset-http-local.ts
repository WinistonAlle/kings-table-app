import 'fake-indexeddb/auto';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import type { Database } from '../types/supabase';
import { createOperation } from '../lib/sync-operation';
import { createPresetTransport } from '../lib/sync-preset-transport';
import { createPresetReader } from '../lib/sync-preset-reader';
import { PresetSyncSession } from '../lib/sync-preset-session';
import { SyncOutbox } from '../lib/sync-outbox';
import { SyncSender } from '../lib/sync-sender';
import { deleteDB } from 'idb';

async function main() {
  // No URL or credentials are accepted from the environment/arguments.
  const local = JSON.parse(execFileSync('npx', ['supabase','status','--workdir','../../packages/db','-o','json'],
    { encoding: 'utf8', stdio: ['ignore','pipe','pipe'] }));
  const url = local.API_URL;
  assert.equal(url, 'http://127.0.0.1:55321');
  const options = { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } };
  const admin = createClient(url, local.SERVICE_ROLE_KEY, options);
  const a = createClient<Database>(url, local.ANON_KEY, options);
  const b = createClient<Database>(url, local.ANON_KEY, options);
  const users: string[] = [], presetId = randomUUID(), secondPresetId = randomUUID();
  const dbName = `qa-http-sender-${randomUUID()}`;
  const outbox = new SyncOutbox(dbName);
  const password = `Qa-${randomUUID()}!`;
  try {
    for (const client of [a,b]) {
      const email = `${randomUUID()}@example.invalid`;
      const created = await client.auth.signUp({ email, password });
      assert.equal(created.error, null, 'Local signup failed');
      assert.ok(created.data.user);
      users.push(created.data.user.id);
      const signed = await client.auth.signInWithPassword({ email, password });
      assert.equal(signed.error, null, 'Local password login failed');
      assert.ok(signed.data.session?.access_token);
    }
    const send = createPresetTransport(a, users[0]), signal = new AbortController().signal;
    const op = createOperation({ ownerId: users[0], entityId: presetId, entity: 'preset', kind: 'preset.save',
      expectedRevision: 0, payload: { name: 'HTTP QA', levels: [
        { level: 1, smallBlind: 25, bigBlind: 50, ante: 0, durationMinutes: 20 },
      ] } });
    const created = await send(op, signal);
    assert.equal(created.status, 'confirmed');
    assert.deepEqual(await send(op, signal), created);
    assert.equal((await send(createOperation({...op, entityId: secondPresetId}), signal)).status, 'confirmed');
    const readPresets = createPresetReader(a, users[0], 1);
    const initialBases = await readPresets(signal);
    assert.equal(initialBases.length, 2);
    assert.deepEqual(initialBases.map(base => base.id), [presetId, secondPresetId].sort());
    assert.ok(initialBases.every(base => base.revision === 1));
    assert.deepEqual(await createPresetReader(b, users[1], 1)(signal), []);
    const outsider = createPresetTransport(b, users[1]);
    assert.equal((await outsider(createOperation({ ...op, ownerId: users[1] }), signal)).status, 'rejected');
    const spoof = await b.rpc('apply_preset_operation', { p_operation: op });
    assert.equal(spoof.error?.code, '42501');
    const { data: session } = await a.auth.getSession();
    assert.ok(session.session);
    const reader = createClient(url, local.ANON_KEY, { ...options,
      global: { headers: { Authorization: `Bearer ${session.session.access_token}` } } });
    const foreignSession = (await b.auth.getSession()).data.session!;
    const foreign = createClient(url, local.ANON_KEY, { ...options,
      global: { headers: { Authorization: `Bearer ${foreignSession.access_token}` } } });
    for (const table of ['blind_structures','sync_operation_receipts','sync_operation_audit']) {
      const query = await foreign.from(table).select('*').eq(table === 'blind_structures' ? 'id' : 'actor_id',
        table === 'blind_structures' ? presetId : users[0]);
      assert.equal(query.error, null);
      assert.deepEqual(query.data, []);
    }
    const direct = await reader.from('blind_structures').update({ name: 'Bypass' }).eq('id',presetId);
    assert.equal(direct.error?.code, '42501');
    const update = createOperation({ ...op, expectedRevision: 1 });
    const duplicate = await Promise.all([send(update,signal),send(update,signal)]);
    assert.deepEqual(duplicate[0], duplicate[1]);
    assert.equal(duplicate[0].status, 'confirmed');
    const race = await Promise.all([send(createOperation({ ...op, expectedRevision: 2 }),signal),
      send(createOperation({ ...op, expectedRevision: 2 }),signal)]);
    assert.deepEqual(race.map(result => result.status).sort(), ['confirmed','conflict']);

    // Force loss of the response AFTER a real successful server commit.
    let loseResponse = true;
    const uncertainClient = createClient<Database>(url,local.ANON_KEY,{ ...options,
      global: { headers: { Authorization: `Bearer ${session.session.access_token}` }, fetch: async (input,init) => {
        const response = await fetch(input,init);
        if (loseResponse && String(input).includes('/rpc/apply_preset_operation') && response.ok) {
          loseResponse = false;
          throw new Error('QA response lost after commit');
        }
        return response;
      } } });
    const uncertain = createPresetTransport(uncertainClient,users[0]);
    const next = createOperation({ ...op, expectedRevision: 3 });
    await outbox.enqueue(next);
    const sender = new SyncSender(users[0],outbox,uncertain);
    await sender.run();
    assert.equal((await outbox.list(users[0]))[0].status,'queued');
    await sender.run();
    assert.equal((await outbox.list(users[0]))[0].status,'confirmed');
    sender.stop();
    const persisted = await reader.from('blind_structures').select('revision').eq('id',presetId).single();
    assert.equal(persisted.error,null); assert.equal(persisted.data?.revision,4);
    const audit = await reader.from('sync_operation_audit').select('operation_id').eq('entity_id',presetId);
    assert.equal(audit.error,null); assert.equal(audit.data?.length,4);
    const remoteBases = await readPresets(signal);
    await outbox.mergePresetBase(remoteBases.find(base => base.id === presetId)!);
    assert.equal((await outbox.presetViews(users[0]))[0].confirmed?.revision, 4);
    assert.equal((await outbox.presetViews(users[0]))[0].reconciliationNeeded, false);
    const removal = createOperation({...op, kind: 'preset.remove', expectedRevision: 4, payload: {}});
    assert.equal((await send(removal, signal)).status, 'confirmed');
    const deletedBases = await readPresets(signal);
    assert.equal(deletedBases.length, 2);
    const tombstone = deletedBases.find(base => base.id === presetId)!;
    assert.equal(tombstone.deleted, true);
    assert.equal(tombstone.revision, 5);
    await outbox.mergePresetBase(tombstone);
    assert.equal((await outbox.presetViews(users[0]))[0].confirmed?.deleted, true);
    const coordinated = new PresetSyncSession(users[0],outbox,readPresets,send);
    try {
      await coordinated.synchronize();
      assert.equal(coordinated.snapshot().phase,'ready');
      assert.equal(coordinated.snapshot().library.length,2);
      await coordinated.mutate(secondPresetId,{kind:'preset.save',payload:{...op.payload,name:'Coordinated HTTP'}});
      assert.equal(coordinated.snapshot().library.find(row=>row.id===secondPresetId)?.pending.length,1);
      await coordinated.synchronize();
      const row = coordinated.snapshot().library.find(row=>row.id===secondPresetId)!;
      assert.equal(row.confirmed?.revision,2);
      assert.equal(row.confirmed?.payload?.name,'Coordinated HTTP');
      assert.equal(row.pending.length,0);
      assert.equal((await readPresets(signal)).find(base=>base.id===secondPresetId)?.payload?.name,'Coordinated HTTP');
    } finally { coordinated.stop(); }
    console.log('PASS: local signup/password JWT, HTTP transport/reader, keyset pages, isolation, conflict, tombstone cache and sender recovery after real commit (IndexedDB simulated).');
  } finally {
    await outbox.close(); await deleteDB(dbName);
    const cleanupErrors: string[] = [];
    if (users.length) {
      const removed = await admin.from('blind_structures').delete().in('id',[presetId,secondPresetId]).in('owner_id',users);
      if (removed.error) cleanupErrors.push('Fixture preset cleanup failed');
    }
    for (const id of users) {
      const deleted = await admin.auth.admin.deleteUser(id);
      if (deleted.error) cleanupErrors.push('Fixture account cleanup failed');
    }
    assert.deepEqual(cleanupErrors,[]);
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
