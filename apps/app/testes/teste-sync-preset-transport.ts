import assert from 'node:assert/strict';
import { createClient } from '@supabase/supabase-js';
import type { Database } from '../types/supabase';
import { novaIdentidade } from '../lib/identidade';
import { createOperation } from '../lib/sync-operation';
import { createPresetTransport } from '../lib/sync-preset-transport';

async function main() {
  const actor = novaIdentidade();
  const op = createOperation({ ownerId: actor, entityId: novaIdentidade(), entity: 'preset',
    kind: 'preset.save', expectedRevision: 0, payload: { name: 'QA', levels: [] } });
  let body: unknown = { operationId: op.id, revision: 1 }, status = 200, calls = 0;
  let fail = false;
  const client = createClient<Database>('http://localhost:59999', 'qa-public-key', {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { fetch: async (url, init) => {
      calls++;
      assert.equal(new URL(String(url)).pathname, '/rest/v1/rpc/apply_preset_operation');
      assert.deepEqual(JSON.parse(String(init?.body)), { p_operation: op });
      if (fail) throw new Error('Connection lost');
      return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
    } },
  });
  const send = createPresetTransport(client, actor), signal = new AbortController().signal;
  assert.equal((await send(op, signal)).status, 'confirmed');
  for (const bad of [null, {}, { operationId: novaIdentidade(), revision: 1 },
    { operationId: op.id, revision: 2 }, { operationId: op.id, revision: 1, extra: true }]) {
    body = bad;
    const result = await send(op, signal);
    assert.equal(result.status, 'retry');
    assert.equal(result.issue.code, 'invalid_receipt');
  }
  for (const [code, expected, http] of [
    ['40001','conflict',409], ['42501','rejected',403], ['22023','rejected',400],
    ['55000','rejected',400], ['PGRST301','retry',401], ['PGRST202','retry',404],
    ['XX000','retry',500], ['rate_limit','retry',429],
  ] as const) {
    status = http; body = { code, message: 'Private server details', details: null, hint: null };
    const result = await send(op, signal);
    assert.equal(result.status, expected);
    assert.ok(!JSON.stringify(result).includes('Private server details'));
  }
  fail = true;
  assert.equal((await send(op, signal)).status, 'retry');
  const before = calls;
  assert.equal((await send({ ...op, ownerId: novaIdentidade() }, signal)).status, 'rejected');
  assert.equal((await send(createOperation({ ...op, entity: 'tournament', kind: 'tournament.create' }), signal)).status, 'rejected');
  assert.equal((await send({ ...op, expectedRevision: -1 }, signal)).status, 'rejected');
  assert.equal(calls, before);
  const controller = new AbortController(); controller.abort();
  await assert.rejects(send(op, controller.signal), { name: 'AbortError' });
  assert.equal(calls, before);
  let finish!: (response: Response) => void;
  let started!: () => void;
  const ready = new Promise<void>(resolve => { started = resolve; });
  const heldClient = createClient<Database>('http://localhost:59999','qa-public-key',{
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { fetch: async () => {
      started();
      return new Promise<Response>(resolve => { finish = resolve; });
    } },
  });
  const lateController = new AbortController();
  const late = createPresetTransport(heldClient,actor)(op,lateController.signal);
  await ready; lateController.abort();
  finish(new Response(JSON.stringify({ operationId: op.id, revision: 1 }), { status: 200 }));
  await assert.rejects(late,{ name: 'AbortError' });
  console.log('Preset transport: SDK with simulated HTTP, receipts, errors, account scope and abort passed.');
}
main().catch(error => { console.error(error); process.exitCode = 1; });
