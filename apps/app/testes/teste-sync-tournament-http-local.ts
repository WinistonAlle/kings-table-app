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
    const edit = createOperation({ ownerId: users[0], entityId: tableIds[0], entity: 'tournament',
      kind: 'tournament.update', expectedRevision: 1,
      payload: { startTime: new Date(Date.now() + 86400000).toISOString(), location: 'Sala nova', capacity: 2 } });
    const edited = await send(edit, signal);
    assert.equal(edited.status, 'confirmed');
    assert.deepEqual(await send(edit, signal), edited);
    const planned = await a.from('tournaments').select('revision,details').eq('id', tableIds[0]).single();
    assert.equal(planned.error, null);
    assert.equal(planned.data?.revision, 2);
    assert.equal((planned.data?.details as { location: string }).location, 'Sala nova');
    const staleEdit = await send(createOperation({ ...edit }), signal);
    assert.equal(staleEdit.status, 'conflict');
    const invalidEdit = await send(createOperation({ ...edit, expectedRevision: 2,
      payload: { ...edit.payload, capacity: 1 } }), signal);
    assert.equal(invalidEdit.status, 'rejected');
    const playerIds = [randomUUID(), randomUUID(), randomUUID()];
    const add = createOperation({ ownerId: users[0], entityId: tableIds[0], entity: 'tournament',
      kind: 'player.add', expectedRevision: 2,
      payload: { playerId: playerIds[0], name: ' Ana QA ' } });
    const added = await send(add, signal);
    assert.equal(added.status, 'confirmed');
    assert.deepEqual(await send(add, signal), added);
    const firstPlayer = await a.from('tournament_players').select('id,display_name,buy_ins,payment_status')
      .eq('id', playerIds[0]).single();
    assert.equal(firstPlayer.error, null);
    assert.equal(firstPlayer.data?.display_name, 'Ana QA');
    assert.equal(firstPlayer.data?.buy_ins, 1);
    assert.equal(firstPlayer.data?.payment_status, 'pending');
    const duplicateName = await send(createOperation({ ...add, expectedRevision: 3,
      payload: { playerId: playerIds[1], name: 'ana qa' } }), signal);
    assert.equal(duplicateName.status, 'rejected');
    const duplicateId = await send(createOperation({ ...add, expectedRevision: 3,
      payload: { playerId: playerIds[0], name: 'Outra pessoa' } }), signal);
    assert.equal(duplicateId.status, 'rejected');
    const secondPlayer = await send(createOperation({ ...add, expectedRevision: 3,
      payload: { playerId: playerIds[1], name: 'Bia QA' } }), signal);
    assert.equal(secondPlayer.status, 'confirmed');
    const full = await send(createOperation({ ...add, expectedRevision: 4,
      payload: { playerId: playerIds[2], name: 'Caio QA' } }), signal);
    assert.equal(full.status, 'rejected');
    const bypassPlayer = await a.from('tournament_players').insert({ id: playerIds[2],
      tournament_id: tableIds[0], user_id: null, display_name: 'Bypass', buy_ins: 1,
      re_entries: 0, add_ons: 0, position: null, prize: null,
      payment_status: 'confirmed', eliminated_at: null });
    assert.equal(bypassPlayer.error?.code, '42501');
    const bypassPayment = await a.from('tournament_players').update({ payment_status: 'confirmed' })
      .eq('id', playerIds[0]);
    assert.equal(bypassPayment.error?.code, '42501');
    const bypassRemoval = await a.from('tournament_players').delete().eq('id', playerIds[0]);
    assert.equal(bypassRemoval.error?.code, '42501');
    const foreign = await b.from('tournaments').select('id').eq('id', tableIds[0]);
    assert.equal(foreign.error, null);
    assert.deepEqual(foreign.data, []);
    const foreignPlayers = await b.from('tournament_players').select('id').eq('tournament_id', tableIds[0]);
    assert.equal(foreignPlayers.error, null);
    assert.deepEqual(foreignPlayers.data, []);
    const bypass = await a.from('tournaments').update({ name: 'Bypass' }).eq('id', tableIds[0]);
    assert.equal(bypass.error?.code, '42501');
    const spoof = await b.rpc('apply_tournament_operation', { p_operation: op });
    assert.equal(spoof.error?.code, '42501');
    const foreignEdit = await b.rpc('apply_tournament_operation', { p_operation: {
      ...edit, id: randomUUID(), ownerId: users[1], expectedRevision: 2,
    } });
    assert.equal(foreignEdit.error?.code, '42501');
    const foreignPlayer = await b.rpc('apply_tournament_operation', { p_operation: {
      ...add, id: randomUUID(), ownerId: users[1], expectedRevision: 4,
      payload: { playerId: playerIds[2], name: 'Foreign' },
    } });
    assert.equal(foreignPlayer.error?.code, '42501');
    const foreignRemoval = await b.rpc('apply_tournament_operation', { p_operation: {
      ...add, id: randomUUID(), kind: 'player.remove', ownerId: users[1], expectedRevision: 4,
      payload: { playerId: playerIds[0] },
    } });
    assert.equal(foreignRemoval.error?.code, '42501');
    const remove = createOperation({ ownerId: users[0], entityId: tableIds[0], entity: 'tournament',
      kind: 'player.remove', expectedRevision: 4, payload: { playerId: playerIds[1] } });
    const removed = await send(remove, signal);
    assert.equal(removed.status, 'confirmed');
    assert.deepEqual(await send(remove, signal), removed);
    const afterRemoval = await a.from('tournament_players').select('id').eq('tournament_id', tableIds[0]);
    assert.equal(afterRemoval.error, null);
    assert.deepEqual(afterRemoval.data?.map(row => row.id), [playerIds[0]]);
    assert.equal((await send(createOperation({ ...remove }), signal)).status, 'conflict');
    assert.equal((await send(createOperation({ ...remove, expectedRevision: 5,
      payload: { playerId: playerIds[1] } }), signal)).status, 'rejected');
    const stale = await send(createOperation({ ...op }), signal);
    assert.equal(stale.status, 'conflict');
    const changedId = await send({ ...op, payload: { ...payload, name: 'Alterada' } }, signal);
    assert.equal(changedId.status, 'rejected');
    const invalid = await send(createOperation({ ...op, entityId: randomUUID(), payload: { ...payload, buyIn: 37.501 } }), signal);
    assert.equal(invalid.status, 'rejected');
    const unsupported = await send(createOperation({ ...op, kind: 'player.update', payload: {} }), signal);
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
    loseResponse = true;
    const secondEdit = createOperation({ ownerId: users[0], entityId: tableIds[1], entity: 'tournament',
      kind: 'tournament.update', expectedRevision: 1,
      payload: { startTime: new Date(Date.now() + 172800000).toISOString(), location: 'Retry QA', capacity: null } });
    await outbox.enqueue(secondEdit);
    await sender.run();
    assert.equal((await outbox.list(users[0])).find(entry => entry.operation.id === secondEdit.id)?.status, 'queued');
    await sender.run();
    assert.equal((await outbox.list(users[0])).find(entry => entry.operation.id === secondEdit.id)?.status, 'confirmed');
    loseResponse = true;
    const secondPlayerOp = createOperation({ ownerId: users[0], entityId: tableIds[1], entity: 'tournament',
      kind: 'player.add', expectedRevision: 2,
      payload: { playerId: randomUUID(), name: 'Retry player' } });
    await outbox.enqueue(secondPlayerOp);
    await sender.run();
    assert.equal((await outbox.list(users[0])).find(entry => entry.operation.id === secondPlayerOp.id)?.status, 'queued');
    await sender.run();
    assert.equal((await outbox.list(users[0])).find(entry => entry.operation.id === secondPlayerOp.id)?.status, 'confirmed');
    loseResponse = true;
    const removeAfterLostResponse = createOperation({ ownerId: users[0], entityId: tableIds[1],
      entity: 'tournament', kind: 'player.remove', expectedRevision: 3,
      payload: { playerId: secondPlayerOp.payload.playerId } });
    await outbox.enqueue(removeAfterLostResponse);
    await sender.run();
    assert.equal((await outbox.list(users[0])).find(entry => entry.operation.id === removeAfterLostResponse.id)?.status, 'queued');
    await sender.run();
    assert.equal((await outbox.list(users[0])).find(entry => entry.operation.id === removeAfterLostResponse.id)?.status, 'confirmed');
    sender.stop();
    const rows = await a.from('tournaments').select('id').in('id', tableIds);
    assert.equal(rows.error, null);
    assert.equal(rows.data?.length, 2);
    const audit = await a.from('sync_operation_audit').select('operation_id').eq('entity_id', tableIds[1]);
    assert.equal(audit.error, null);
    assert.equal(audit.data?.length, 4);
    const final = await a.from('tournaments').select('revision,details').eq('id', tableIds[1]).single();
    assert.equal(final.error, null);
    assert.equal(final.data?.revision, 4);
    assert.equal((final.data?.details as { location: string }).location, 'Retry QA');
    const finalPlayers = await a.from('tournament_players').select('id').eq('tournament_id', tableIds[1]);
    assert.equal(finalPlayers.error, null);
    assert.equal(finalPlayers.data?.length, 0);
    console.log('PASS: local Auth/HTTP tournament, planning and player add/remove; isolation, revisions and lost-response retry.');
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
