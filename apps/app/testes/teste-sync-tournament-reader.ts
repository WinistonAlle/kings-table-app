import assert from 'node:assert/strict';
import { createClient } from '@supabase/supabase-js';
import type { Database } from '../types/supabase';
import { novaIdentidade } from '../lib/identidade';
import { createTournamentReader, createTournamentClockReader } from '../lib/sync-tournament-reader';
import { distribuirPremios } from '../lib/payouts';

async function main() {
  const owner = novaIdentidade(), tableId = novaIdentidade();
  const ids = [novaIdentidade(), novaIdentidade()].sort();
  const table = (revision = 1) => ({ id: tableId, created_by: owner, name: 'Mesa QA',
    format: 'regular', status: 'upcoming', buy_in: 37.5, re_entry_allowed: false,
    max_re_entries: 0, start_time: '2026-09-29T12:00:00+00:00', current_level: 0,
    seconds_remaining: 1200, revision, deleted_at: null,
    updated_at: `2026-09-29T12:00:0${revision}+00:00`,
    clock_ends_at: null, clock_hand_for_hand: false,
    blind_levels: [{ level: 1, smallBlind: 25, bigBlind: 50, ante: 0, durationMinutes: 20 }],
    details: { suit: 'copas', capacity: 9 } });
  const player = (id: string) => ({ id, tournament_id: tableId, user_id: null,
    display_name: 'Ana QA', buy_ins: 1, re_entries: 0, add_ons: 0, position: null,
    prize: null, payment_status: 'pending', financial_activity_recorded: false,
    eliminated_at: null, registered_at: '2026-09-29T12:00:00+00:00' });
  let tables: unknown[] = [table(), table()];
  let pages: unknown[] = [[player(ids[0])], [player(ids[1])], []];
  const inviteIds = [novaIdentidade(), novaIdentidade()].sort();
  const invite = (id: string, playerId: string | null = null) => ({ id, tournament_id: tableId,
    name: 'Bia QA', status: 'confirmed', player_id: playerId,
    created_at: '2026-09-29T12:00:00+00:00', waiting_since: null, deleted_at: null });
  let invitePages: unknown[] = [[invite(inviteIds[0], ids[0])], [invite(inviteIds[1])], []];
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
      assert.ok(['/rest/v1/tournament_players', '/rest/v1/tournament_invites'].includes(parsed.pathname));
      assert.equal(parsed.searchParams.get('tournament_id'), `eq.${tableId}`);
      assert.equal(parsed.searchParams.get('order'), 'id.asc');
      assert.equal(parsed.searchParams.get('limit'), '200');
      const rows = parsed.pathname === '/rest/v1/tournament_players'
        ? (pages.length ? pages.shift() : []) : (invitePages.length ? invitePages.shift() : []);
      return new Response(JSON.stringify(rows), { status,
        headers: { 'Content-Type': 'application/json' } });
    } },
  });
  const read = createTournamentReader(client, owner, tableId);
  const signal = new AbortController().signal;
  const snapshot = await read(signal);
  assert.equal(snapshot?.tournament.revision, 1);
  assert.deepEqual(snapshot?.players.map(p => p.id), ids);
  assert.deepEqual(snapshot?.invites.map(i => i.id), inviteIds);
  assert.equal(calls, 8, 'Short pages must not truncate players or invitations');
  invitePages = [];

  const resultIds = [...ids, novaIdentidade()].sort();
  const resultPlayers = resultIds.map((id, index) => ({ ...player(id), position: index + 1,
    prize: distribuirPremios(37.5 * resultIds.length, resultIds.length).find(payout => payout.place === index + 1)?.amount ?? 0,
    eliminated_at: index ? '2026-09-29T12:10:00+00:00' : null }));
  const resultTable = { ...table(), status: 'finished' };
  tables = [resultTable, resultTable]; pages = [resultPlayers, []];
  assert.deepEqual((await read(signal))?.players.map(p => p.position), [1, 2, 3]);
  for (const invalid of [
    resultPlayers.map((row, i) => i === 1 ? { ...row, prize: null } : row),
    resultPlayers.map((row, i) => i === 1 ? { ...row, position: 3 } : row),
    resultPlayers.map((row, i) => i === 1 ? { ...row, prize: row.prize + 0.01 } : row),
    resultPlayers.map((row, i) => i === 1 ? { ...row, prize: row.prize + 0.001 } : row),
    resultPlayers.map((row, i) => i === 0 ? { ...row, eliminated_at: '2026-09-29T12:10:00+00:00' } : row),
  ]) {
    tables = [resultTable, resultTable]; pages = [invalid, []];
    await assert.rejects(read(signal), { code: 'invalid_response' });
  }
  for (const invalid of [
    [invite(inviteIds[1]), invite(inviteIds[0])],
    [{ ...invite(inviteIds[0]), tournament_id: novaIdentidade() }],
    [{ ...invite(inviteIds[0]), status: 'invalid' }],
    [{ ...invite(inviteIds[0]), status: 'waiting' }],
    [{ ...invite(inviteIds[0]), waiting_since: '2026-09-29T12:01:00+00:00' }],
    [{ ...invite(inviteIds[0]), player_id: novaIdentidade() }],
    null,
  ]) {
    tables = [table(), table()]; pages = [[]]; invitePages = [invalid];
    await assert.rejects(read(signal), { code: 'invalid_response' });
  }
  invitePages = [];
  const runningTable = { ...table(), status: 'running' };
  const runningPlayers = resultPlayers.map((row, i) => ({ ...row, position: i === 2 ? 3 : null,
    prize: null, eliminated_at: i === 2 ? '2026-09-29T12:10:00+00:00' : null }));
  tables = [runningTable, runningTable]; pages = [runningPlayers, []];
  assert.equal((await read(signal))?.players[2].position, 3);
  for (const invalid of [
    runningPlayers.map((row, i) => i === 2 ? { ...row, position: 2 } : row),
    runningPlayers.map((row, i) => i === 2 ? { ...row, eliminated_at: null } : row),
    runningPlayers.map((row, i) => i === 0 ? { ...row, prize: 1 } : row),
  ]) {
    tables = [runningTable, runningTable]; pages = [invalid, []];
    await assert.rejects(read(signal), { code: 'invalid_response' });
  }

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
  const goodClock = { currentLevel: 0, secondsRemaining: 60,
    levelEndsAt: null, isRunning: false, handForHand: false,
    revision: 1, serverNow: '2026-09-29T12:00:00+00:00' };
  let clockBody: unknown = goodClock;
  let clockStatus = 200, clockNetworkFail = false;
  const clockClient = createClient<Database>('http://localhost:59999', 'qa-public-key', {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { fetch: async (url, init) => {
      assert.equal(new URL(String(url)).pathname, '/rest/v1/rpc/read_tournament_clock');
      assert.deepEqual(JSON.parse(String(init?.body)), { p_tournament_id: tableId });
      if (clockNetworkFail) throw new Error('Private network details');
      return new Response(JSON.stringify(clockBody), { status: clockStatus,
        headers: { 'Content-Type': 'application/json' } });
    } },
  });
  const readClock = createTournamentClockReader(clockClient, tableId);
  assert.equal((await readClock(signal)).secondsRemaining, 60);
  for (const bad of [null, {}, { ...goodClock, revision: -1 },
    { ...goodClock, isRunning: true }, { ...goodClock, extra: true }]) {
    clockBody = bad;
    await assert.rejects(readClock(signal), { code: 'invalid_response' });
  }
  clockBody = { code: '42501', message: 'Private database details' }; clockStatus = 403;
  await assert.rejects(readClock(signal), error => (error as { code: string }).code === 'unavailable'
    && !String(error).includes('Private'));
  clockStatus = 200; clockNetworkFail = true;
  await assert.rejects(readClock(signal), { code: 'unavailable' });
  const stopped = new AbortController(); stopped.abort();
  await assert.rejects(readClock(stopped.signal), { name: 'AbortError' });
  assert.throws(() => createTournamentClockReader(clockClient, 'bad-id'));
  console.log('Tournament reader: scope, pages, revision drift, validation, errors and abort passed (HTTP simulated).');
}
main().catch(error => { console.error(error); process.exitCode = 1; });
