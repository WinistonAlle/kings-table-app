import assert from 'node:assert/strict';
import { novaIdentidade } from '../lib/identidade';
import { recordSettlement, settlementFingerprint, ORGANIZER } from '../lib/acerto';
import { parseBackup } from '../lib/backup';
import type { Tournament } from '../types';

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const levels = [{ level: 1, smallBlind: 25, bigBlind: 50, ante: 0, durationMinutes: 20 }];
const legacy: Tournament = {
  id: 't_antiga', name: 'Mesa antiga', format: 'regular', status: 'upcoming',
  buyIn: 10, reEntryAllowed: false, maxReEntries: 0, startTime: '',
  blindStructure: levels, currentLevel: 0, createdAt: '2026-01-01T00:00:00Z', createdBy: 'local',
  players: [{ id: 'p_antigo', userId: 'guest_antigo', name: 'Ana', buyIns: 1,
    reEntries: 0, addOns: 0, paymentStatus: 'confirmed' }],
  invitees: [{ id: 'i_antigo', name: 'Ana', status: 'confirmed', createdAt: '', playerId: 'p_antigo' }],
};

async function main() {
  const memory = new Map([['kt-tournaments', JSON.stringify({ state: { tournaments: [legacy], activeTournamentId: legacy.id }, version: 0 })]]);
  Object.defineProperty(globalThis, 'window', { configurable: true, value: { localStorage: {
    getItem: (key: string) => memory.get(key) ?? null,
    setItem: (key: string, value: string) => memory.set(key, value),
    removeItem: (key: string) => memory.delete(key),
  } } });
  const originalNow = Date.now;
  const originalRandom = Math.random;
  Date.now = () => 1;
  Math.random = () => { throw new Error('Identidade nao pode usar Math.random'); };
  try {
    const ids = Array.from({ length: 2000 }, novaIdentidade);
    assert.ok(ids.every(id => uuid.test(id)));
    assert.equal(new Set(ids).size, ids.length);
    const { useTournamentStore: store } = await import('../stores/tournamentStore');
    const { usePresetsStore: presets } = await import('../stores/presetsStore');
    await store.persist.rehydrate();
    await presets.persist.rehydrate();
    assert.deepEqual(store.getState().tournaments[0], legacy);
    assert.equal(store.getState().activeTournamentId, legacy.id);
    const created = store.getState().createTournament({
      name: 'Mesa nova', format: 'regular', buyIn: 10, reEntryAllowed: false,
      maxReEntries: 0, startTime: '', blindStructure: levels, createdBy: 'local',
    });
    assert.match(created.id, uuid);
    store.getState().addPlayer(created.id, { ...legacy.players[0], name: 'Bia' });
    store.getState().invite(created.id, 'Caio', 'confirmed');
    const guest = store.getState().tournaments.find(t => t.id === created.id)!.invitees![0];
    assert.match(guest.id, uuid);
    store.getState().checkIn(created.id, guest.id);
    const updated = store.getState().tournaments.find(t => t.id === created.id)!;
    assert.ok(updated.players.every(p => uuid.test(p.id)));
    assert.match(updated.players[1].userId, /^guest_/);
    assert.equal(updated.invitees![0].playerId, updated.players[1].id);
    assert.ok(updated.audit!.every(e => uuid.test(e.id)));
    assert.ok(presets.getState().save('Estrutura nova', levels));
    assert.match(presets.getState().presets[0].id, uuid);

    const finished: Tournament = { ...legacy, status: 'finished', players: [{ ...legacy.players[0], position: 1, prize: 10 }] };
    finished.settlementPayments = [{ id: 's_antigo', from: ORGANIZER, to: 'p_antigo', cents: 100,
      at: '', baseline: settlementFingerprint(finished) }];
    const result = recordSettlement(finished, ORGANIZER, 'p_antigo', 100);
    assert.equal(result.error, null);
    assert.deepEqual(result.tournament.settlementPayments![0], finished.settlementPayments[0]);
    assert.match(result.tournament.settlementPayments![1].id, uuid);
    assert.equal(result.tournament.settlementPayments![1].to, 'p_antigo');

    await store.persist.rehydrate();
    assert.deepEqual(store.getState().tournaments[0], legacy, 'registros legados nao sao renumerados');
    const clock = { structure: levels, currentLevel: 0, secondsRemaining: 1200, levelEndsAt: null, isRunning: false };
    const snapshot = parseBackup({ version: 1, tournaments: store.getState().tournaments,
      activeTournamentId: legacy.id, presets: presets.getState().presets,
      blinds: { ...clock, tournamentId: legacy.id, clocks: { [legacy.id]: clock } } });
    assert.equal(snapshot.blinds.tournamentId, legacy.id);
    assert.equal(snapshot.tournaments[0].invitees![0].playerId, 'p_antigo');
  } finally { Date.now = originalNow; Math.random = originalRandom; }
  console.log('Identidade: UUIDs sem horario/Math.random, novos registros e referencias legadas preservadas passaram.');
}
main().catch(error => { console.error(error); process.exitCode = 1; });
