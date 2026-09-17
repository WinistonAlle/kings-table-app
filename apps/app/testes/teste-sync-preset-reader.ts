import assert from 'node:assert/strict';
import { createClient } from '@supabase/supabase-js';
import type { Database } from '../types/supabase';
import { novaIdentidade } from '../lib/identidade';
import { createPresetReader } from '../lib/sync-preset-reader';

async function main() {
  const owner = novaIdentidade();
  const ids = [novaIdentidade(), novaIdentidade(), novaIdentidade()].sort();
  const row = (id: string) => ({ id, owner_id: owner, name: 'Estrutura', revision: 1,
    is_default: false, deleted_at: null as string | null,
    levels: [{ level: 1, smallBlind: 25, bigBlind: 50, ante: 0, durationMinutes: 20 }] });
  let pages: unknown[] = [[row(ids[0])], [{...row(ids[1]), deleted_at: '2026-09-17T03:00:00+00:00'}], []];
  let calls = 0, status = 200, networkFail = false;
  const cursors: (string | null)[] = [];
  const client = createClient<Database>('http://localhost:59999', 'qa-public-key', {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { fetch: async (url) => {
      const query = new URL(String(url));
      assert.equal(query.pathname, '/rest/v1/blind_structures');
      assert.equal(query.searchParams.get('owner_id'), `eq.${owner}`);
      assert.equal(query.searchParams.get('is_default'), 'eq.false');
      assert.equal(query.searchParams.get('order'), 'id.asc');
      assert.equal(query.searchParams.get('limit'), '200');
      cursors.push(query.searchParams.get('id'));
      calls++;
      if (networkFail) throw new Error('Private connection details');
      return new Response(JSON.stringify(pages.shift()), {status, headers: {'Content-Type':'application/json'}});
    } },
  });
  const read = createPresetReader(client, owner), signal = new AbortController().signal;
  const bases = await read(signal);
  assert.deepEqual(bases.map(base => base.id), ids.slice(0,2));
  assert.equal(bases[1].deleted, true);
  assert.equal(calls, 3, 'Short pages must not truncate the library');
  assert.deepEqual(cursors, [null, `gt.${ids[0]}`, `gt.${ids[1]}`]);
  for (const bad of [null, {}, [row(ids[0]), row(ids[0])], [row(ids[1]),row(ids[0])],
    [{...row(ids[0]),owner_id:novaIdentidade()}], [{...row(ids[0]),is_default:true}],
    [{...row(ids[0]),revision:-1}], [{...row(ids[0]),levels:[]}], [{...row(ids[0]),extra:true}]]) {
    pages = [bad]; calls = 0;
    await assert.rejects(read(signal), {code:'invalid_response'});
  }
  pages = [[row(ids[0])], [row(ids[0])]]; calls = 0;
  await assert.rejects(read(signal), {code:'invalid_response'});
  pages = [[row(ids[0])], [{...row(ids[1]),levels:[]}]]; calls = 0;
  await assert.rejects(read(signal), {code:'invalid_response'}, 'A bad later page must not return a partial library');
  pages = [{code:'42501',message:'Private database details'}]; status = 403; calls = 0;
  await assert.rejects(read(signal), error => !String(error).includes('Private') && (error as {code:string}).code === 'unavailable');
  networkFail = true;
  await assert.rejects(read(signal), {code:'unavailable'});
  const before = calls, aborted = new AbortController(); aborted.abort();
  await assert.rejects(read(aborted.signal), {name:'AbortError'});
  assert.equal(calls, before);
  assert.throws(() => createPresetReader(client, 'invalid-owner'));
  assert.throws(() => createPresetReader(client, owner, 0));
  let finish!: (value: Response) => void, started!: () => void;
  const ready = new Promise<void>(resolve => { started = resolve; });
  const held = createClient<Database>('http://localhost:59999','qa-public-key', {
    auth: {persistSession:false,autoRefreshToken:false,detectSessionInUrl:false},
    global: {fetch: async () => { started(); return new Promise<Response>(resolve => {finish = resolve;}); }},
  });
  const controller = new AbortController(), pending = createPresetReader(held,owner)(controller.signal);
  await ready; controller.abort(); finish(new Response(JSON.stringify([row(ids[0])]),{status:200}));
  await assert.rejects(pending,{name:'AbortError'});
  console.log('Preset reader: scoped keyset pages, short pages, tombstones, validation, errors and late abort passed (HTTP simulated).');
}
main().catch(error => {console.error(error);process.exitCode=1;});
