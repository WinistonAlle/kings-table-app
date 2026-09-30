import 'fake-indexeddb/auto';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { deleteDB } from 'idb';
import type { Database } from '../types/supabase';
import { createOperation } from '../lib/sync-operation';
import { createTournamentTransport } from '../lib/sync-tournament-transport';
import { createTournamentReader, createTournamentClockReader } from '../lib/sync-tournament-reader';
import { SyncOutbox } from '../lib/sync-outbox';
import { SyncSender } from '../lib/sync-sender';
import { distribuirPremios } from '../lib/payouts';

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
  const tableIds = [randomUUID(), randomUUID(), randomUUID()];
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
    const payment = createOperation({ ownerId: users[0], entityId: tableIds[0], entity: 'tournament',
      kind: 'player.payment.set', expectedRevision: 5,
      payload: { playerId: playerIds[0], status: 'confirmed', expectedAmountCents: 3750 } });
    const paid = await send(payment, signal);
    assert.equal(paid.status, 'confirmed');
    assert.deepEqual(await send(payment, signal), paid);
    const paymentEvents = await a.from('player_payment_events').select('operation_id,status_before,status_after,amount_cents')
      .eq('tournament_id', tableIds[0]);
    assert.equal(paymentEvents.error, null);
    assert.deepEqual(paymentEvents.data, [{ operation_id: payment.id, status_before: 'pending',
      status_after: 'confirmed', amount_cents: 3750 }]);
    const foreignEvents = await b.from('player_payment_events').select('operation_id').eq('tournament_id', tableIds[0]);
    assert.equal(foreignEvents.error, null);
    assert.deepEqual(foreignEvents.data, []);
    const bypassEvent = await a.from('player_payment_events').delete().eq('operation_id', payment.id);
    assert.equal(bypassEvent.error?.code, '42501');
    const foreignPayment = await b.rpc('apply_tournament_operation', { p_operation: {
      ...payment, id: randomUUID(), ownerId: users[1], expectedRevision: 6,
    } });
    assert.equal(foreignPayment.error?.code, '42501');
    assert.equal((await send(createOperation({ ...payment, expectedRevision: 6,
      payload: { ...payment.payload, status: 'confirmed' } }), signal)).status, 'rejected');
    assert.equal((await send(createOperation({ ...payment, expectedRevision: 6,
      payload: { ...payment.payload, status: 'pending', expectedAmountCents: 3700 } }), signal)).status, 'conflict');
    const reversed = await send(createOperation({ ...payment, expectedRevision: 6,
      payload: { ...payment.payload, status: 'pending' } }), signal);
    assert.equal(reversed.status, 'confirmed');
    assert.equal((await send(createOperation({ ...remove, expectedRevision: 7,
      payload: { playerId: playerIds[0] } }), signal)).status, 'rejected');
    const preserved = await a.from('tournament_players').select('payment_status,financial_activity_recorded')
      .eq('id', playerIds[0]).single();
    assert.equal(preserved.error, null);
    assert.equal(preserved.data?.payment_status, 'pending');
    assert.equal(preserved.data?.financial_activity_recorded, true);
    const ownSnapshot = await createTournamentReader(a, users[0], tableIds[0], 1)(signal);
    assert.equal(ownSnapshot?.tournament.revision, 7);
    assert.deepEqual(ownSnapshot?.players.map(player => player.id), [playerIds[0]]);
    assert.equal(ownSnapshot?.players[0].financial_activity_recorded, true);
    assert.equal(await createTournamentReader(b, users[1], tableIds[0])(signal), null);
    const reentry = createOperation({ ownerId: users[0], entityId: tableIds[0], entity: 'tournament',
      kind: 'player.entries.adjust', expectedRevision: 7,
      payload: { playerId: playerIds[0], entryKind: 'reEntry', delta: 1, expectedTotalCents: 3750 } });
    const reentered = await send(reentry, signal);
    assert.equal(reentered.status, 'confirmed');
    assert.deepEqual(await send(reentry, signal), reentered);
    const entryEvents = await a.from('player_entry_events').select('operation_id,entry_kind,delta,total_after_cents')
      .eq('tournament_id', tableIds[0]);
    assert.equal(entryEvents.error, null);
    assert.deepEqual(entryEvents.data, [{ operation_id: reentry.id, entry_kind: 'reEntry', delta: 1,
      total_after_cents: 7500 }]);
    const foreignEntries = await b.from('player_entry_events').select('operation_id').eq('tournament_id', tableIds[0]);
    assert.equal(foreignEntries.error, null);
    assert.deepEqual(foreignEntries.data, []);
    const bypassEntry = await a.from('player_entry_events').delete().eq('operation_id', reentry.id);
    assert.equal(bypassEntry.error?.code, '42501');
    const foreignEntry = await b.rpc('apply_tournament_operation', { p_operation: {
      ...reentry, id: randomUUID(), ownerId: users[1], expectedRevision: 8,
    } });
    assert.equal(foreignEntry.error?.code, '42501');
    assert.equal((await send(createOperation({ ...reentry, expectedRevision: 8,
      payload: { ...reentry.payload, expectedTotalCents: 3750 } }), signal)).status, 'conflict');
    assert.equal((await send(createOperation({ ...reentry, expectedRevision: 8,
      payload: { ...reentry.payload, delta: -1, expectedTotalCents: 7500 } }), signal)).status, 'confirmed');
    const afterCorrection = await createTournamentReader(a, users[0], tableIds[0])(signal);
    assert.equal(afterCorrection?.tournament.revision, 9);
    assert.equal(afterCorrection?.players[0].re_entries, 0);
    assert.equal(afterCorrection?.players[0].financial_activity_recorded, true);
    const stale = await send(createOperation({ ...op }), signal);
    assert.equal(stale.status, 'conflict');
    const changedId = await send({ ...op, payload: { ...payload, name: 'Alterada' } }, signal);
    assert.equal(changedId.status, 'rejected');
    const invalid = await send(createOperation({ ...op, entityId: randomUUID(), payload: { ...payload, buyIn: 37.501 } }), signal);
    assert.equal(invalid.status, 'rejected');
    const unsupported = await send(createOperation({ ...op, kind: 'tournament.delete', payload: {} }), signal);
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
    const paidPlayer = createOperation({ ownerId: users[0], entityId: tableIds[1], entity: 'tournament',
      kind: 'player.add', expectedRevision: 4, payload: { playerId: randomUUID(), name: 'Paid retry player' } });
    assert.equal((await send(paidPlayer, signal)).status, 'confirmed');
    loseResponse = true;
    const paymentAfterLostResponse = createOperation({ ownerId: users[0], entityId: tableIds[1], entity: 'tournament',
      kind: 'player.payment.set', expectedRevision: 5,
      payload: { playerId: paidPlayer.payload.playerId, status: 'confirmed', expectedAmountCents: 3750 } });
    await outbox.enqueue(paymentAfterLostResponse);
    await sender.run();
    assert.equal((await outbox.list(users[0])).find(entry => entry.operation.id === paymentAfterLostResponse.id)?.status, 'queued');
    await sender.run();
    assert.equal((await outbox.list(users[0])).find(entry => entry.operation.id === paymentAfterLostResponse.id)?.status, 'confirmed');
    const retryEvents = await a.from('player_payment_events').select('operation_id').eq('tournament_id', tableIds[1]);
    assert.equal(retryEvents.error, null);
    assert.deepEqual(retryEvents.data, [{ operation_id: paymentAfterLostResponse.id }]);
    loseResponse = true;
    const entryAfterLostResponse = createOperation({ ownerId: users[0], entityId: tableIds[1], entity: 'tournament',
      kind: 'player.entries.adjust', expectedRevision: 6,
      payload: { playerId: paidPlayer.payload.playerId, entryKind: 'addOn', delta: 1, expectedTotalCents: 3750 } });
    await outbox.enqueue(entryAfterLostResponse);
    await sender.run();
    assert.equal((await outbox.list(users[0])).find(entry => entry.operation.id === entryAfterLostResponse.id)?.status, 'queued');
    await sender.run();
    assert.equal((await outbox.list(users[0])).find(entry => entry.operation.id === entryAfterLostResponse.id)?.status, 'confirmed');
    const retryEntryEvents = await a.from('player_entry_events').select('operation_id,total_after_cents')
      .eq('tournament_id', tableIds[1]);
    assert.equal(retryEntryEvents.error, null);
    assert.deepEqual(retryEntryEvents.data, [{ operation_id: entryAfterLostResponse.id, total_after_cents: 7500 }]);
    const retryPaymentEvents = await a.from('player_payment_events').select('operation_id,status_before,status_after')
      .eq('tournament_id', tableIds[1]).order('recorded_at');
    assert.equal(retryPaymentEvents.error, null);
    assert.deepEqual(retryPaymentEvents.data, [
      { operation_id: paymentAfterLostResponse.id, status_before: 'pending', status_after: 'confirmed' },
      { operation_id: entryAfterLostResponse.id, status_before: 'confirmed', status_after: 'pending' },
    ]);
    loseResponse = true;
    const startAfterLostResponse = createOperation({ ownerId: users[0], entityId: tableIds[1], entity: 'tournament',
      kind: 'tournament.start', expectedRevision: 7, payload: {} });
    await outbox.enqueue(startAfterLostResponse);
    await sender.run();
    assert.equal((await outbox.list(users[0])).find(entry => entry.operation.id === startAfterLostResponse.id)?.status, 'queued');
    await sender.run();
    assert.equal((await outbox.list(users[0])).find(entry => entry.operation.id === startAfterLostResponse.id)?.status, 'confirmed');
    const readClock = createTournamentClockReader(a, tableIds[1]);
    const beforeClock = await readClock(signal);
    assert.equal(beforeClock.revision, 8);
    assert.equal(beforeClock.isRunning, false);
    assert.equal(beforeClock.secondsRemaining, 1200);
    const foreignClock = await b.rpc('read_tournament_clock', { p_tournament_id: tableIds[1] });
    assert.equal(foreignClock.error?.code, '42501');
    const bypassClock = await a.from('tournaments').update({ clock_ends_at: new Date().toISOString() })
      .eq('id', tableIds[1]);
    assert.equal(bypassClock.error?.code, '42501');
    const clockStart = createOperation({ ownerId: users[0], entityId: tableIds[1], entity: 'tournament',
      kind: 'clock.start', expectedRevision: 8, payload: {} });
    assert.equal((await send(clockStart, signal)).status, 'confirmed');
    const ticking = await readClock(signal);
    assert.equal(ticking.revision, 9);
    assert.equal(ticking.isRunning, true);
    assert.ok(ticking.secondsRemaining > 0 && ticking.secondsRemaining <= 1200);
    assert.ok(Date.parse(ticking.levelEndsAt!) > Date.parse(ticking.serverNow));
    assert.equal((await send(createOperation({ ...clockStart, expectedRevision: 9,
      kind: 'clock.pause', payload: {} }), signal)).status, 'confirmed');
    const paused = await readClock(signal);
    assert.equal(paused.isRunning, false);
    assert.equal(paused.levelEndsAt, null);
    assert.ok(paused.secondsRemaining > 0 && paused.secondsRemaining <= 1200);
    assert.equal((await send(createOperation({ ...clockStart, expectedRevision: 10,
      kind: 'clock.level', payload: { level: 0 } }), signal)).status, 'confirmed');
    assert.equal((await readClock(signal)).secondsRemaining, 1200);
    assert.equal((await send(createOperation({ ...clockStart, expectedRevision: 11,
      kind: 'clock.handForHand', payload: { enabled: true } }), signal)).status, 'confirmed');
    assert.equal((await readClock(signal)).handForHand, true);
    assert.equal((await send(createOperation({ ...clockStart, expectedRevision: 12,
      kind: 'clock.start', payload: {} }), signal)).status, 'rejected');
    assert.equal((await send(createOperation({ ...clockStart, expectedRevision: 12,
      kind: 'clock.handForHand', payload: { enabled: false } }), signal)).status, 'confirmed');
    assert.equal((await send(createOperation({ ...clockStart, expectedRevision: 13,
      kind: 'clock.reset', payload: {} }), signal)).status, 'confirmed');
    assert.equal((await readClock(signal)).revision, 14);
    loseResponse = true;
    const renameAfterLostResponse = createOperation({ ownerId: users[0], entityId: tableIds[1],
      entity: 'tournament', kind: 'player.update', expectedRevision: 14,
      payload: { playerId: paidPlayer.payload.playerId, name: 'Nome corrigido' } });
    await outbox.enqueue(renameAfterLostResponse);
    await sender.run();
    assert.equal((await outbox.list(users[0])).find(entry => entry.operation.id === renameAfterLostResponse.id)?.status, 'queued');
    await sender.run();
    assert.equal((await outbox.list(users[0])).find(entry => entry.operation.id === renameAfterLostResponse.id)?.status, 'confirmed');
    const renamedSnapshot = await createTournamentReader(a, users[0], tableIds[1])(signal);
    assert.equal(renamedSnapshot?.tournament.revision, 15);
    assert.equal(renamedSnapshot?.players[0].display_name, 'Nome corrigido');
    const foreignRename = await b.rpc('apply_tournament_operation', { p_operation: {
      ...renameAfterLostResponse, id: randomUUID(), ownerId: users[1], expectedRevision: 15,
      payload: { ...renameAfterLostResponse.payload, name: 'Intruso' },
    } });
    assert.equal(foreignRename.error?.code, '42501');
    const lateBase = createOperation({ ownerId: users[0], entityId: tableIds[2], entity: 'tournament',
      kind: 'tournament.create', expectedRevision: 0,
      payload: { ...payload, name: 'Entrada tardia HTTP QA' } });
    assert.equal((await send(lateBase, signal)).status, 'confirmed');
    const latePlayers = [randomUUID(), randomUUID(), randomUUID()];
    for (const [i, playerId] of latePlayers.entries()) {
      assert.equal((await send(createOperation({ ...lateBase, kind: 'player.add', expectedRevision: i + 1,
        payload: { playerId, name: `Jogador ${i + 1}` } }), signal)).status, 'confirmed');
    }
    assert.equal((await send(createOperation({ ...lateBase, kind: 'tournament.start',
      expectedRevision: 4, payload: {} }), signal)).status, 'confirmed');
    const firstFall = createOperation({ ...lateBase, kind: 'player.eliminate', expectedRevision: 5,
      payload: { playerId: latePlayers[2] } });
    assert.equal((await send(firstFall, signal)).status, 'confirmed');
    const lateEntry = createOperation({ ...lateBase, kind: 'player.add', expectedRevision: 6,
      payload: { playerId: randomUUID(), name: 'Entrada tardia' } });
    const lateResult = await send(lateEntry, signal);
    assert.equal(lateResult.status, 'confirmed');
    assert.deepEqual(await send(lateEntry, signal), lateResult);
    const lateSnapshot = await createTournamentReader(a, users[0], tableIds[2])(signal);
    assert.equal(lateSnapshot?.tournament.revision, 7);
    assert.equal(lateSnapshot?.players.find(player => player.id === latePlayers[2])?.position, 4);
    assert.equal(lateSnapshot?.players.find(player => player.id === lateEntry.payload.playerId)?.position, null);
    assert.equal((await send(createOperation({ ...lateEntry,
      payload: { playerId: randomUUID(), name: 'Revisao antiga' } }), signal)).status, 'conflict');
    const foreignLate = await b.rpc('apply_tournament_operation', { p_operation: {
      ...lateEntry, id: randomUUID(), ownerId: users[1], expectedRevision: 7,
      payload: { playerId: randomUUID(), name: 'Intruso' },
    } });
    assert.equal(foreignLate.error?.code, '42501');
    assert.equal((await createTournamentReader(b, users[1], tableIds[2])(signal)), null);
    const lateFall = createOperation({ ...lateBase, kind: 'player.eliminate', expectedRevision: 7,
      payload: { playerId: lateEntry.payload.playerId } });
    assert.equal((await send(lateFall, signal)).status, 'confirmed');
    assert.equal((await send(createOperation({ ...lateFall, kind: 'player.undoElimination',
      expectedRevision: 8, payload: { playerId: latePlayers[2] } }), signal)).status, 'rejected');
    const finalFall = createOperation({ ...lateBase, kind: 'player.eliminate', expectedRevision: 8,
      payload: { playerId: latePlayers[1] } });
    const finished = await send(finalFall, signal);
    assert.equal(finished.status, 'confirmed');
    assert.deepEqual(await send(finalFall, signal), finished);
    const finishedSnapshot = await createTournamentReader(a, users[0], tableIds[2])(signal);
    assert.equal(finishedSnapshot?.tournament.status, 'finished');
    assert.deepEqual(finishedSnapshot?.players.map(player => player.position).sort((x, y) => (x ?? 0) - (y ?? 0)), [1, 2, 3, 4]);
    const expectedPrizes = distribuirPremios(4 * payload.buyIn, 4);
    for (const player of finishedSnapshot?.players ?? []) {
      assert.equal(player.prize, expectedPrizes.find(prize => prize.place === player.position)?.amount ?? 0);
    }
    assert.equal((await send(createOperation({ ...finalFall, kind: 'player.eliminate',
      expectedRevision: 9, payload: { playerId: latePlayers[0] } }), signal)).status, 'rejected');
    const undoFinal = createOperation({ ...lateBase, kind: 'player.undoElimination', expectedRevision: 9,
      payload: { playerId: latePlayers[1] } });
    const reopened = await send(undoFinal, signal);
    assert.equal(reopened.status, 'confirmed');
    assert.deepEqual(await send(undoFinal, signal), reopened);
    const reopenedSnapshot = await createTournamentReader(a, users[0], tableIds[2])(signal);
    assert.equal(reopenedSnapshot?.tournament.status, 'running');
    assert.equal(reopenedSnapshot?.players.filter(player => player.position === null).length, 2);
    assert.equal(reopenedSnapshot?.players.filter(player => player.prize !== null).length, 0);
    const foreignResult = await b.rpc('apply_tournament_operation', { p_operation: {
      ...lateFall, id: randomUUID(), ownerId: users[1], expectedRevision: 10,
      payload: { playerId: latePlayers[0] },
    } });
    assert.equal(foreignResult.error?.code, '42501');
    sender.stop();
    const rows = await a.from('tournaments').select('id').in('id', tableIds);
    assert.equal(rows.error, null);
    assert.equal(rows.data?.length, 3);
    const audit = await a.from('sync_operation_audit').select('operation_id').eq('entity_id', tableIds[1]);
    assert.equal(audit.error, null);
    assert.equal(audit.data?.length, 15);
    const final = await a.from('tournaments').select('revision,details').eq('id', tableIds[1]).single();
    assert.equal(final.error, null);
    assert.equal(final.data?.revision, 15);
    assert.equal((final.data?.details as { location: string }).location, 'Retry QA');
    const finalPlayers = await a.from('tournament_players').select('id,display_name,add_ons,payment_status').eq('tournament_id', tableIds[1]);
    assert.equal(finalPlayers.error, null);
    assert.deepEqual(finalPlayers.data, [{ id: paidPlayer.payload.playerId, display_name: 'Nome corrigido',
      add_ons: 1, payment_status: 'pending' }]);
    console.log('PASS: local Auth/HTTP tournament, players, late entry, results, rename, payment, entries, clock and scoped snapshots; isolation, revisions and lost-response retry.');
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
