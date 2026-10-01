import 'fake-indexeddb/auto';
import assert from 'node:assert/strict';
import { deleteDB } from 'idb';
import { novaIdentidade } from '../lib/identidade';
import { observedClockSeconds, clockMatchesSnapshot, prepareClockOperation } from '../lib/sync-tournament-clock';
import { parseTournamentClockSnapshot, type TournamentClockSnapshot, type TournamentSnapshot } from '../lib/sync-tournament-reader';
import { SyncOutbox } from '../lib/sync-outbox';
import { TournamentSyncSession } from '../lib/sync-tournament-session';

async function main() {
  const owner = novaIdentidade(), id = novaIdentidade();
  const snapshot: TournamentSnapshot = { tournament: {
    id, created_by: owner, name: 'Mesa QA', format: 'regular', status: 'running', buy_in: 20,
    re_entry_allowed: false, max_re_entries: 0, start_time: '2026-10-02T20:00:00Z',
    current_level: 0, seconds_remaining: 1200, revision: 3, deleted_at: null,
    updated_at: '2026-10-01T12:00:00Z', clock_ends_at: null, clock_hand_for_hand: false, details: {},
    blind_levels: [
      { level: 1, smallBlind: 25, bigBlind: 50, ante: 0, durationMinutes: 20 },
      { level: 1, smallBlind: 0, bigBlind: 0, ante: 0, durationMinutes: 5, isBreak: true },
      { level: 2, smallBlind: 50, bigBlind: 100, ante: 10, durationMinutes: 15 },
    ],
  }, players: [], invites: [] };
  const paused: TournamentClockSnapshot = { currentLevel: 0, secondsRemaining: 1200,
    levelEndsAt: null, isRunning: false, handForHand: false, revision: 3, serverNow: '2026-10-01T12:00:00Z' };
  const running = { ...paused, isRunning: true, levelEndsAt: '2026-10-01T12:20:00Z' };
  const before = JSON.stringify(snapshot);
  assert.equal(observedClockSeconds({ clock: running, receivedAt: 1000, roundTripMs: 200 }, 3000), 1198);
  assert.equal(observedClockSeconds({ clock: running, receivedAt: 1000, roundTripMs: 200 }, 2000000), 0);
  assert.equal(observedClockSeconds({ clock: paused, receivedAt: 1000, roundTripMs: 200 }, 2000000), 1200);
  assert.throws(() => observedClockSeconds({ clock: paused, receivedAt: 1000, roundTripMs: -1 }, 1000));
  assert.throws(() => observedClockSeconds({ clock: paused, receivedAt: 1000, roundTripMs: 0 }, 999));
  assert.throws(() => observedClockSeconds({ clock: paused, receivedAt: 1000, roundTripMs: 0 }, NaN));
  assert.deepEqual(parseTournamentClockSnapshot(running), running);
  assert.throws(() => parseTournamentClockSnapshot({ ...running, handForHand: true }));
  assert.throws(() => parseTournamentClockSnapshot({ ...paused, isRunning: true }));
  assert.throws(() => parseTournamentClockSnapshot({ ...paused, extra: true }));
  assert.ok(clockMatchesSnapshot(snapshot, paused));
  assert.equal(clockMatchesSnapshot(snapshot, { ...paused, revision: 4 }), false);
  assert.equal(clockMatchesSnapshot(snapshot, { ...paused, currentLevel: 3 }), false);
  assert.equal(clockMatchesSnapshot(snapshot, { ...paused, currentLevel: 1, secondsRemaining: 301 }), false);
  const resume = prepareClockOperation(snapshot, paused, { kind: 'resume' });
  assert.equal(resume.kind, 'clock.start'); assert.equal(resume.ownerId, owner);
  assert.equal(resume.entityId, id); assert.equal(resume.expectedRevision, 3);
  assert.equal(prepareClockOperation(snapshot, running, { kind: 'pause' }).kind, 'clock.pause');
  assert.throws(() => prepareClockOperation(snapshot, running, { kind: 'resume' }));
  assert.throws(() => prepareClockOperation(snapshot, paused, { kind: 'pause' }));
  assert.throws(() => prepareClockOperation(snapshot, { ...paused, secondsRemaining: 0 }, { kind: 'resume' }));
  assert.equal(prepareClockOperation(snapshot, paused, { kind: 'level', level: 1 }).payload.level, 1);
  assert.throws(() => prepareClockOperation(snapshot, paused, { kind: 'level', level: 3 }));
  assert.throws(() => prepareClockOperation(snapshot, paused, { kind: 'level', level: -1 }));
  assert.equal(prepareClockOperation(snapshot, running, { kind: 'hand', enabled: true }).payload.enabled, true);
  const hand = { ...snapshot, tournament: { ...snapshot.tournament, clock_hand_for_hand: true } };
  assert.throws(() => prepareClockOperation(hand, { ...paused, handForHand: true }, { kind: 'resume' }));
  assert.equal(prepareClockOperation(hand, { ...paused, handForHand: true }, { kind: 'hand', enabled: false }).kind, 'clock.handForHand');
  assert.throws(() => prepareClockOperation(snapshot, paused, { kind: 'hand', enabled: false }));
  assert.equal(prepareClockOperation(snapshot, paused, { kind: 'reset' }).kind, 'clock.reset');
  assert.throws(() => prepareClockOperation({ ...snapshot, tournament: { ...snapshot.tournament, deleted_at: paused.serverNow } }, paused, { kind: 'reset' }));
  assert.throws(() => prepareClockOperation({ ...snapshot, tournament: { ...snapshot.tournament, status: 'finished' } }, paused, { kind: 'reset' }));
  const upcoming = { ...snapshot, tournament: { ...snapshot.tournament, status: 'upcoming' as const } };
  assert.throws(() => prepareClockOperation(upcoming, paused, { kind: 'startNight' }), /jogador/);
  const withPlayer = { ...upcoming, players: [{ position: null }] as TournamentSnapshot['players'] };
  assert.equal(prepareClockOperation(withPlayer, paused, { kind: 'startNight' }).kind, 'tournament.start');
  assert.throws(() => prepareClockOperation(snapshot, paused, { kind: 'startNight' }));
  assert.equal(JSON.stringify(snapshot), before);

  const name = `qa-clock-session-${novaIdentidade()}`, outbox = new SyncOutbox(name);
  let calls = 0, respond: () => Promise<TournamentClockSnapshot> = async () => paused;
  let signal: AbortSignal | undefined;
  const session = new TournamentSyncSession(owner, outbox, async () => [],
    async () => { throw Error('No command expected'); }, undefined, Date.now, undefined,
    async (tableId, request) => { assert.equal(tableId, id); signal = request; calls++; return respond(); });
  try {
    const first = session.refreshClock(id);
    assert.equal(session.refreshClock(id), first);
    assert.deepEqual(await first, paused); assert.equal(calls, 1);
    assert.throws(() => session.refreshClock('invalid'));
    respond = async () => { throw Error('Internal HTTP diagnostic'); };
    await assert.rejects(session.refreshClock(id), { code: 'remote_read' });
    respond = async () => ({ ...paused, revision: -1 });
    await assert.rejects(session.refreshClock(id), { code: 'invalid_response' });
    respond = async () => paused;
    assert.deepEqual(await session.refreshClock(id), paused);
    assert.equal(await outbox.tournamentSnapshot(owner, id), null, 'clock observations do not persist as table snapshots');
    let release!: (value: TournamentClockSnapshot) => void;
    respond = () => new Promise(resolve => { release = resolve; });
    const late = session.refreshClock(id);
    const cancelled = assert.rejects(late, { name: 'AbortError' });
    session.stop(); assert.ok(signal?.aborted);
    let idle = false;
    const draining = session.waitForIdle().then(() => { idle = true; });
    await Promise.resolve(); assert.equal(idle, false);
    release(paused); await cancelled; await draining;
    assert.throws(() => session.refreshClock(id), { name: 'AbortError' });
  } finally { session.stop(); await session.waitForIdle(); await outbox.close(); await deleteDB(name); }
  console.log('Account clock: monotonic observations, revision/state guards, intervals, coalescing, retry and cancelled late response passed.');
}
main().catch(error => { console.error(error); process.exitCode = 1; });
