import 'fake-indexeddb/auto';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { deleteDB } from 'idb';
import type { Database } from '../types/supabase';
import { createOperation } from '../lib/sync-operation';
import { createTournamentTransport } from '../lib/sync-tournament-transport';
import { SyncOutbox } from '../lib/sync-outbox';
import { SyncSender } from '../lib/sync-sender';

async function main() {
  // This runner accepts no project URL or credentials from arguments/env.
  const local = JSON.parse(execFileSync('npx', ['supabase','status','--workdir','../../packages/db','-o','json'],
    { encoding: 'utf8', stdio: ['ignore','pipe','pipe'] }));
  const url = local.API_URL;
  assert.equal(url, 'http://127.0.0.1:55321');
  const options = { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } };
  const admin = createClient<Database>(url, local.SERVICE_ROLE_KEY, options);
  const a = createClient<Database>(url, local.ANON_KEY, options);
  const b = createClient<Database>(url, local.ANON_KEY, options);
  const users: string[] = [];
  const tableIds = [randomUUID(), randomUUID()];
  const dbName = `qa-tournament-create-${randomUUID()}`;
  const outbox = new SyncOutbox(dbName);
  const password = `Qa-${randomUUID()}!`;
  try {
    for (const client of [a, b]) {
      const email = `${randomUUID()}@example.invalid`;
      const signup = await client.auth.signUp({ email, password });
      assert.equal(signup.error, null);
      assert.ok(signup.data.user);
      users.push(signup.data.user.id);
      const login = await client.auth.signInWithPassword({ email, password });
      assert.equal(login.error, null);
      assert.ok(login.data.session?.access_token);
    }
    const signal = new AbortController().signal;
    const send = createTournamentTransport(a, users[0]);
    const payload = { name: 'Mesa HTTP QA', format: 'regular', buyIn: 37.5,
      reEntryAllowed: true, maxReEntries: 2, startTime: new Date().toISOString(),
      suit: 'copas', color: '#78a885', location: 'Casa QA', capacity: 9,
      levels: [{ level: 1, smallBlind: 25, bigBlind: 50, ante: 0, durationMinutes: 20 }] };
    const op = createOperation({ ownerId: users[0], entityId: tableIds[0], entity: 'tournament',
      kind: 'tournament.create', expectedRevision: 0, payload });
    const created = await send(op, signal);
    assert.equal(created.status, 'confirmed');
    assert.deepEqual(await send(op, signal), created);
    const own = await a.from('tournaments').select('id,name,revision,details,blind_levels').eq('id', tableIds[0]).single();
    assert.equal(own.error, null);
    assert.equal(own.data?.revision, 1);
    assert.equal(own.data?.name, 'Mesa HTTP QA');
    assert.equal((own.data?.details as { capacity: number }).capacity, 9);
    assert.equal((own.data?.blind_levels as unknown[]).length, 1);
    const foreign = await b.from('tournaments').select('id').eq('id', tableIds[0]);
    assert.equal(foreign.error, null);
    assert.deepEqual(foreign.data, []);
    const bypass = await a.from('tournaments').update({ name: 'Bypass' }).eq('id', tableIds[0]);
    assert.equal(bypass.error?.code, '42501');
    const spoof = await b.rpc('apply_tournament_operation', { p_operation: op });
    assert.equal(spoof.error?.code, '42501');
    const stale = await send(createOperation({ ...op }), signal);
    assert.equal(stale.status, 'conflict');
    const changedId = await send({ ...op, payload: { ...payload, name: 'Alterada' } }, signal);
    assert.equal(changedId.status, 'rejected');
    const invalid = await send(createOperation({ ...op, entityId: randomUUID(), payload: { ...payload, buyIn: 37.501 } }), signal);
    assert.equal(invalid.status, 'rejected');
    const unsupported = await send(createOperation({ ...op, kind: 'player.add', payload: {} }), signal);
    assert.equal(unsupported.status, 'rejected');

    const session = (await a.auth.getSession()).data.session!;
    let loseResponse = true;
    const uncertainClient = createClient<Database>(url, local.ANON_KEY, { ...options,
      global: { headers: { Authorization: `Bearer ${session.access_token}` }, fetch: async (input, init) => {
        const response = await fetch(input, init);
        if (loseResponse && String(input).includes('/rpc/apply_tournament_operation') && response.ok) {
          loseResponse = false;
          throw new Error('QA response lost after commit');
        }
        return response;
      } } });
    const second = createOperation({ ...op, entityId: tableIds[1] });
    await outbox.enqueue(second);
    const sender = new SyncSender(users[0], outbox, createTournamentTransport(uncertainClient, users[0]));
    await sender.run();
    assert.equal((await outbox.list(users[0]))[0].status, 'queued');
    await sender.run();
    assert.equal((await outbox.list(users[0]))[0].status, 'confirmed');
    sender.stop();
    const rows = await a.from('tournaments').select('id').in('id', tableIds);
    assert.equal(rows.error, null);
    assert.equal(rows.data?.length, 2);
    const audit = await a.from('sync_operation_audit').select('operation_id').eq('entity_id', tableIds[1]);
    assert.equal(audit.error, null);
    assert.equal(audit.data?.length, 1);
    console.log('PASS: local Auth/HTTP tournament create, RLS, direct-write denial, validation, conflict and lost-response retry.');
  } finally {
    await outbox.close();
    await deleteDB(dbName);
    const errors: string[] = [];
    if (users.length) {
      const deleted = await admin.from('tournaments').delete().in('id', tableIds).in('created_by', users);
      if (deleted.error) errors.push('Fixture tournament cleanup failed');
    }
    for (const id of users) {
      const deleted = await admin.auth.admin.deleteUser(id);
      if (deleted.error) errors.push('Fixture account cleanup failed');
    }
    assert.deepEqual(errors, []);
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
