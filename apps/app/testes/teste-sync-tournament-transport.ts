import assert from 'node:assert/strict';
import { createClient } from '@supabase/supabase-js';
import type { Database } from '../types/supabase';
import { novaIdentidade } from '../lib/identidade';
import { createOperation } from '../lib/sync-operation';
import { createTournamentTransport } from '../lib/sync-tournament-transport';

async function main() {
  const actor = novaIdentidade();
  const op = createOperation({ ownerId: actor, entityId: novaIdentidade(), entity: 'tournament',
    kind: 'tournament.create', expectedRevision: 0, payload: { name: 'Mesa QA' } });
  const edit = createOperation({ ownerId: actor, entityId: op.entityId, entity: 'tournament',
    kind: 'tournament.update', expectedRevision: 1,
    payload: { startTime: new Date(Date.now() + 86400000).toISOString(), location: 'QA', capacity: 9 } });
  let expectedOp = op;
  let body: unknown = { operationId: op.id, revision: 1 }, status = 200, calls = 0;
  let fail = false;
  const client = createClient<Database>('http://localhost:59999', 'qa-public-key', {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { fetch: async (url, init) => {
      calls++;
      assert.equal(new URL(String(url)).pathname, '/rest/v1/rpc/apply_tournament_operation');
      assert.deepEqual(JSON.parse(String(init?.body)), { p_operation: expectedOp });
      if (fail) throw new Error('Connection lost');
      return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
    } },
  });
  const send = createTournamentTransport(client, actor);
  const signal = new AbortController().signal;
  assert.equal((await send(op, signal)).status, 'confirmed');
  expectedOp = edit;
  body = { operationId: edit.id, revision: 2 };
  assert.equal((await send(edit, signal)).status, 'confirmed');
  expectedOp = op;
  body = { operationId: op.id, revision: 1 };
  for (const bad of [null, {}, { operationId: novaIdentidade(), revision: 1 },
    { operationId: op.id, revision: 2 }, { operationId: op.id, revision: 1, extra: true }]) {
    body = bad;
    const result = await send(op, signal);
    assert.equal(result.status, 'retry');
    assert.equal(result.issue.code, 'invalid_receipt');
  }
  for (const [code, expected, http] of [
    ['40001', 'conflict', 409], ['42501', 'rejected', 403], ['22023', 'rejected', 400],
    ['55000', 'rejected', 400],
    ['PGRST301', 'retry', 401], ['PGRST202', 'retry', 404], ['XX000', 'retry', 500],
  ] as const) {
    status = http;
    body = { code, message: 'Private server details', details: null, hint: null };
    const result = await send(op, signal);
    assert.equal(result.status, expected);
    assert.ok(!JSON.stringify(result).includes('Private server details'));
  }
  fail = true;
  assert.equal((await send(op, signal)).status, 'retry');
  const before = calls;
  const mismatch = await send({ ...op, ownerId: novaIdentidade() }, signal);
  assert.notEqual(mismatch.status, 'confirmed');
  if (mismatch.status !== 'confirmed') assert.equal(mismatch.issue.code, 'actor_mismatch');
  const unsupported = await send(createOperation({ ...op, kind: 'tournament.start' }), signal);
  assert.notEqual(unsupported.status, 'confirmed');
  if (unsupported.status !== 'confirmed') assert.equal(unsupported.issue.code, 'unsupported_operation');
  const invalid = await send({ ...op, expectedRevision: -1 }, signal);
  assert.notEqual(invalid.status, 'confirmed');
  if (invalid.status !== 'confirmed') assert.equal(invalid.issue.code, 'invalid_operation');
  assert.equal(calls, before);

  const controller = new AbortController();
  controller.abort();
  await assert.rejects(send(op, controller.signal), { name: 'AbortError' });
  assert.equal(calls, before);
  let finish!: (response: Response) => void;
  let started!: () => void;
  const ready = new Promise<void>(resolve => { started = resolve; });
  const heldClient = createClient<Database>('http://localhost:59999', 'qa-public-key', {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { fetch: async () => {
      started();
      return new Promise<Response>(resolve => { finish = resolve; });
    } },
  });
  const lateController = new AbortController();
  const late = createTournamentTransport(heldClient, actor)(op, lateController.signal);
  await ready;
  lateController.abort();
  finish(new Response(JSON.stringify({ operationId: op.id, revision: 1 }), { status: 200 }));
  await assert.rejects(late, { name: 'AbortError' });
  console.log('Tournament transport: SDK HTTP, receipts, errors, account scope and abort passed.');
}

main().catch(error => { console.error(error); process.exitCode = 1; });
