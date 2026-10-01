import 'fake-indexeddb/auto';
import assert from 'node:assert/strict';
import { deleteDB } from 'idb';
import { novaIdentidade } from '../lib/identidade';
import { SyncOutbox } from '../lib/sync-outbox';
import { TournamentSyncSession } from '../lib/sync-tournament-session';
import type { TournamentSnapshot } from '../lib/sync-tournament-reader';

async function main() {
  const name = `qa-detail-session-${novaIdentidade()}`;
  const owner = novaIdentidade(), other = novaIdentidade(), tableId = novaIdentidade();
  const outbox = new SyncOutbox(name);
  const snapshot: TournamentSnapshot = { tournament: {
    id: tableId, created_by: owner, name: 'Mesa QA', format: 'regular', status: 'upcoming',
    buy_in: 20, re_entry_allowed: false, max_re_entries: 0,
    start_time: '2026-10-02T20:00:00+00:00', current_level: 0, seconds_remaining: 1200,
    revision: 1, deleted_at: null, updated_at: '2026-10-01T12:00:00+00:00',
    clock_ends_at: null, clock_hand_for_hand: false, details: {},
    blind_levels: [{ level: 1, smallBlind: 25, bigBlind: 50, ante: 0, durationMinutes: 20 }],
  }, players: [], invites: [] };
  let calls = 0;
  let respond: () => Promise<TournamentSnapshot | null> = async () => structuredClone(snapshot);
  const session = new TournamentSyncSession(owner, outbox, async () => [],
    async () => { throw new Error('Nenhum comando esperado'); }, undefined, Date.now,
    async (id, signal) => { assert.equal(id, tableId); assert.equal(signal.aborted, false); calls++; return respond(); });
  try {
    assert.equal(await session.cachedTournament(tableId), null);
    const first = session.refreshTournament(tableId);
    assert.equal(session.refreshTournament(tableId), first, 'duas telas compartilham a mesma leitura');
    assert.equal((await first)?.tournament.revision, 1);
    assert.equal(calls, 1);
    assert.equal(session.snapshot().tables[0].id, tableId, 'leitura detalhada atualiza o catalogo');
    respond = async () => null;
    assert.equal(await session.refreshTournament(tableId), null);
    assert.equal((await session.cachedTournament(tableId))?.tournament.revision, 1,
      'ausencia remota nao apaga o cache');
    respond = async () => { throw new Error('Falha de rede'); };
    await assert.rejects(session.refreshTournament(tableId), { code: 'remote_read' });
    assert.equal((await session.cachedTournament(tableId))?.tournament.revision, 1);
    respond = async () => ({ ...snapshot, tournament: { ...snapshot.tournament, created_by: other } });
    await assert.rejects(session.refreshTournament(tableId), { code: 'invalid_response' });
    respond = async () => ({ ...snapshot, tournament: { ...snapshot.tournament, id: novaIdentidade() } });
    await assert.rejects(session.refreshTournament(tableId), { code: 'invalid_response' });
    respond = async () => ({ ...snapshot, tournament: { ...snapshot.tournament, revision: 2 } });
    assert.equal((await session.refreshTournament(tableId))?.tournament.revision, 2,
      'retry depois de erro recupera a leitura');

    const mergeSnapshots = outbox.mergeTournamentSnapshots;
    outbox.mergeTournamentSnapshots = async () => { throw new Error('Internal storage diagnostic'); };
    try {
      await assert.rejects(session.refreshTournament(tableId), (error: unknown) => {
        assert.ok(error instanceof Error);
        assert.equal((error as Error & { code: string }).code, 'local_storage');
        assert.equal(error.message.includes('Internal storage diagnostic'), false);
        return true;
      });
      assert.equal((await session.cachedTournament(tableId))?.tournament.revision, 2,
        'falha de gravacao preserva os detalhes anteriores');
    } finally { outbox.mergeTournamentSnapshots = mergeSnapshots; }
    assert.equal((await session.refreshTournament(tableId))?.tournament.revision, 2);

    let release!: (value: TournamentSnapshot) => void;
    let started!: () => void;
    const waiting = new Promise<void>(resolve => { started = resolve; });
    respond = () => { started(); return new Promise(resolve => { release = resolve; }); };
    const late = session.refreshTournament(tableId);
    // Attach the rejection handler before aborting the session.
    const cancelled = assert.rejects(late, { name: 'AbortError' });
    await waiting;
    session.stop();
    let idle = false;
    const draining = session.waitForIdle().then(() => { idle = true; });
    await Promise.resolve();
    assert.equal(idle, false, 'encerramento espera a leitura em curso');
    release({ ...snapshot, tournament: { ...snapshot.tournament, revision: 3 } });
    await cancelled; await draining;
    assert.equal((await outbox.tournamentSnapshot(owner, tableId))?.tournament.revision, 2,
      'resposta tardia nao altera o cache');
    assert.deepEqual(session.snapshot().tables, []);
    assert.throws(() => session.refreshTournament(tableId), { name: 'AbortError' });
    await assert.rejects(session.cachedTournament(tableId), { name: 'AbortError' });
  } finally { session.stop(); await session.waitForIdle(); await outbox.close(); await deleteDB(name); }
  console.log('Tournament details: coalescing, account scope, absence, retry and shutdown passed.');
}
main().catch(error => { console.error(error); process.exitCode = 1; });
