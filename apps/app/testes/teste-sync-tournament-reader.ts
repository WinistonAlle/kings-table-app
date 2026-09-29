import assert from 'node:assert/strict';
import { createClient } from '@supabase/supabase-js';
import type { Database } from '../types/supabase';
import { novaIdentidade } from '../lib/identidade';
import { createTournamentReader } from '../lib/sync-tournament-reader';

async function main() {
  const owner = novaIdentidade(), tableId = novaIdentidade();
  const ids = [novaIdentidade(), novaIdentidade()].sort();
  const table = (revision = 1) => ({ id: tableId, created_by: owner, name: 'Mesa QA',
    format: 'regular', status: 'upcoming', buy_in: 37.5, re_entry_allowed: false,
    max_re_entries: 0, start_time: '2026-09-29T12:00:00+00:00', current_level: 0,
    seconds_remaining: 1200, revision, deleted_at: null,
    updated_at: `2026-09-29T12:00:0${revision}+00:00`,
    blind_levels: [{ level: 1, smallBlind: 25, bigBlind: 50, ante: 0, durationMinutes: 20 }],
    details: { suit: 'copas', capacity: 9 } });
  const player = (id: string) => ({ id, tournament_id: tableId, user_id: null,
    display_name: 'Ana QA', buy_ins: 1, re_entries: 0, add_ons: 0, position: null,
    prize: null, payment_status: 'pending', financial_activity_recorded: false,
    eliminated_at: null, registered_at: '2026-09-29T12:00:00+00:00' });
  let tables: unknown[] = [table(), table()];
  let pages: unknown[] = [[player(ids[0])], [player(ids[1])], []];
  let status = 200, networkFail = false, calls = 0;
  const client = createClient<Database>('http://localhost:59999', 'qa-public-key', {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { fetch: async url => {
      calls++;
      if (networkFail) throw new Error('Private network details');
      const parsed = new URL(String(url));
      if (parsed.pathname === '/rest/v1/tournaments') {
        assert.equal(parsed.searchParams.get('id'), `eq.${tableId}`);
        assert.equal(parsed.searchParams.get('created_by'), `eq.${owner}`);
        return new Response(JSON.stringify(tables.shift() ?? null), { status,
          headers: { 'Content-Type': 'application/json' } });
      }
      assert.equal(parsed.pathname, '/rest/v1/tournament_players');
      assert.equal(parsed.searchParams.get('tournament_id'), `eq.${tableId}`);
      assert.equal(parsed.searchParams.get('order'), 'id.asc');
      assert.equal(parsed.searchParams.get('limit'), '200');
      return new Response(JSON.stringify(pages.length ? pages.shift() : []), { status,
        headers: { 'Content-Type': 'application/json' } });
    } },
  });
  const read = createTournamentReader(client, owner, tableId);
  const signal = new AbortController().signal;
  const snapshot = await read(signal);
  assert.equal(snapshot?.tournament.revision, 1);
  assert.deepEqual(snapshot?.players.map(p => p.id), ids);
  assert.equal(calls, 5, 'Short pages must not truncate players');

  tables = [null]; pages = []; calls = 0;
  assert.equal(await read(signal), null);
  assert.equal(calls, 1, 'No foreign or missing table should reveal players');

  tables = [table(1), table(2), table(2), table(2)]; pages = [[], []];
  assert.equal((await read(signal))?.tournament.revision, 2);
  tables = [table(1), table(2), table(2), table(3), table(3), table(4)]; pages = [[], [], []];
  await assert.rejects(read(signal), { code: 'changed_during_read' });

  for (const invalid of [
    { ...table(), created_by: novaIdentidade() }, { ...table(), blind_levels: [] },
    { ...table(), revision: -1 }, { ...table(), details: [] }, { ...table(), extra: true },
  ]) {
    tables = [invalid]; pages = [];
    await assert.rejects(read(signal), { code: 'invalid_response' });
  }
  tables = [table()]; pages = [[player(ids[0])], [{ ...player(ids[1]), tournament_id: novaIdentidade() }]];
  await assert.rejects(read(signal), { code: 'invalid_response' }, 'A bad later page must not return a partial table');
  for (const invalid of [
    [player(ids[1]), player(ids[0])], [{ ...player(ids[0]), tournament_id: novaIdentidade() }],
    [{ ...player(ids[0]), financial_activity_recorded: 'yes' }], null,
  ]) {
    tables = [table()]; pages = [invalid];
    await assert.rejects(read(signal), { code: 'invalid_response' });
  }
  tables = [{ code: '42501', message: 'Private database details' }]; pages = []; status = 403;
  await assert.rejects(read(signal), error => (error as { code: string }).code === 'unavailable'
    && !String(error).includes('Private'));
  status = 200; networkFail = true;
  await assert.rejects(read(signal), { code: 'unavailable' });
  const before = calls, controller = new AbortController(); controller.abort();
  await assert.rejects(read(controller.signal), { name: 'AbortError' });
  assert.equal(calls, before);
  assert.throws(() => createTournamentReader(client, 'bad-id', tableId));
  assert.throws(() => createTournamentReader(client, owner, tableId, 0));
  let finish!: (value: Response) => void, started!: () => void;
  const ready = new Promise<void>(resolve => { started = resolve; });
  const held = createClient<Database>('http://localhost:59999', 'qa-public-key', {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { fetch: async () => {
      started();
      return new Promise<Response>(resolve => { finish = resolve; });
    } },
  });
  const lateController = new AbortController();
  const pending = createTournamentReader(held, owner, tableId)(lateController.signal);
  await ready;
  lateController.abort();
  finish(new Response(JSON.stringify(table()), { status: 200 }));
  await assert.rejects(pending, { name: 'AbortError' });
  console.log('Tournament reader: scope, pages, revision drift, validation, errors and abort passed (HTTP simulated).');
}
main().catch(error => { console.error(error); process.exitCode = 1; });
