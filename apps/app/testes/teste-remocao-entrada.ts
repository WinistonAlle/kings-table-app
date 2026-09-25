import assert from 'node:assert/strict';
import type { Tournament, TournamentPlayer } from '../types';
import { motivoBloqueioRemocao } from '../lib/torneio';

async function main() {
  const memory = new Map<string, string>();
  Object.defineProperty(globalThis, 'window', { value: { localStorage: {
    getItem: (key: string) => memory.get(key) ?? null,
    setItem: (key: string, value: string) => { memory.set(key, value); },
    removeItem: (key: string) => { memory.delete(key); },
  } }, configurable: true });
  const { useTournamentStore } = await import('../stores/tournamentStore');
  await useTournamentStore.persist.rehydrate();
  const player: TournamentPlayer = { id: 'entry', userId: 'guest', name: 'Ana',
    buyIns: 1, reEntries: 0, addOns: 0, paymentStatus: 'pending' };
  const base: Tournament = { id: 'table', name: 'Noite', format: 'regular', status: 'upcoming',
    buyIn: 20, reEntryAllowed: true, maxReEntries: 2, startTime: '', blindStructure: [],
    currentLevel: 0, players: [player], createdBy: 'local', createdAt: '',
    invitees: [{ id: 'invite', name: 'Ana', status: 'confirmed', playerId: player.id, createdAt: '' }] };
  const cases: { name: string; tournament: Tournament; player: TournamentPlayer }[] = [
    { name: 'paid', tournament: base, player: { ...player, paymentStatus: 'confirmed' } },
    { name: 'disputed', tournament: base, player: { ...player, paymentStatus: 'disputed' } },
    { name: 'running', tournament: { ...base, status: 'running' }, player },
    { name: 'finished', tournament: { ...base, status: 'finished' }, player },
    { name: 'reentry', tournament: base, player: { ...player, reEntries: 1 } },
    { name: 'addon', tournament: base, player: { ...player, addOns: 1 } },
    { name: 'result', tournament: base, player: { ...player, position: 1, prize: 40 } },
    { name: 'settlement', tournament: { ...base, settlementPayments: [{ id: 'settled', from: player.id,
      to: '__organizer__', cents: 2000, at: '', baseline: '', voidedAt: '' }] }, player },
  ];
  for (const test of cases) {
    const table = { ...test.tournament, players: [test.player] };
    assert.ok(motivoBloqueioRemocao(table, test.player), `${test.name}: removal needs a reason`);
    useTournamentStore.setState({ tournaments: [table], activeTournamentId: table.id });
    useTournamentStore.getState().removePlayer(table.id, test.player.id);
    const after = useTournamentStore.getState().tournaments[0];
    assert.equal(after.players.length, 1, `${test.name}: player must remain`);
    assert.equal(after.invitees?.[0].playerId, player.id, `${test.name}: invitation must stay linked`);
    assert.equal(after.audit?.length ?? 0, table.audit?.length ?? 0, `${test.name}: no false audit event`);
  }
  assert.equal(motivoBloqueioRemocao(base, player), null);
  useTournamentStore.setState({ tournaments: [base], activeTournamentId: base.id });
  useTournamentStore.getState().removePlayer(base.id, player.id);
  const after = useTournamentStore.getState().tournaments[0];
  assert.equal(after.players.length, 0);
  assert.equal(after.invitees?.[0].playerId, undefined);
  assert.match(after.audit?.at(-1)?.summary ?? '', /Entrada de Ana/);
  assert.match(after.audit?.at(-1)?.changes[0].after ?? '', /Removida/);
  await useTournamentStore.persist.rehydrate();
  assert.equal(useTournamentStore.getState().tournaments[0].players.length, 0);
  console.log('Entry removal: unsafe financial/game states blocked; valid removal and audit survive reload.');
}

main().catch(error => { console.error(error); process.exitCode = 1; });
