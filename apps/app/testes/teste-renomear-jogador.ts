import assert from 'node:assert/strict';
import type { Tournament, TournamentPlayer } from '../types';
import { corrigirNomeJogador, motivoBloqueioRemocao } from '../lib/torneio';

async function main() {
  const memory = new Map<string, string>();
  Object.defineProperty(globalThis, 'window', { value: { localStorage: {
    getItem: (key: string) => memory.get(key) ?? null,
    setItem: (key: string, value: string) => { memory.set(key, value); },
    removeItem: (key: string) => { memory.delete(key); },
  } }, configurable: true });
  const { useTournamentStore } = await import('../stores/tournamentStore');
  await useTournamentStore.persist.rehydrate();
  const ana: TournamentPlayer = { id: 'ana', userId: 'guest-ana', name: 'Ana', buyIns: 1,
    reEntries: 0, addOns: 0, paymentStatus: 'pending' };
  const bia: TournamentPlayer = { ...ana, id: 'bia', userId: 'guest-bia', name: 'Bia', position: 2 };
  const table: Tournament = { id: 'table', name: 'Noite', format: 'regular', status: 'running',
    buyIn: 25, reEntryAllowed: false, maxReEntries: 0, startTime: '', blindStructure: [],
    currentLevel: 0, players: [ana, bia], createdBy: 'local', createdAt: '',
    invitees: [{ id: 'invite-ana', name: 'Ana', status: 'confirmed', createdAt: '', playerId: ana.id },
      { id: 'invite-bia', name: 'Bia', status: 'confirmed', createdAt: '', playerId: bia.id }] };

  for (const name of ['', '   ', 'bIa', 'a'.repeat(61), 'Ana']) {
    const result = corrigirNomeJogador(table, ana.id, name);
    assert.ok(result.error, `Rejected invalid or duplicate name: ${name}`);
    assert.equal(result.tournament, table);
  }
  assert.ok(corrigirNomeJogador(table, 'missing', 'Nova').error);
  assert.ok(corrigirNomeJogador({ ...table, status: 'cancelled' }, ana.id, 'Nova').error);

  useTournamentStore.setState({ tournaments: [table], activeTournamentId: table.id });
  assert.equal(useTournamentStore.getState().renamePlayer(table.id, ana.id, '  Ana Maria  '), null);
  let current = useTournamentStore.getState().tournaments[0];
  assert.equal(current.players[0].name, 'Ana Maria');
  assert.equal(current.players[0].id, ana.id);
  assert.equal(current.invitees?.[0].name, 'Ana Maria');
  assert.equal(current.invitees?.[1].name, 'Bia');
  assert.match(current.audit?.at(-1)?.summary ?? '', /Nome de Ana/);
  assert.deepEqual(current.audit?.at(-1)?.changes[0],
    { label: 'Nome de Ana', before: 'Ana', after: 'Ana Maria' });
  const auditCount = current.audit?.length;
  assert.ok(useTournamentStore.getState().renamePlayer(table.id, ana.id, 'bia'));
  assert.equal(useTournamentStore.getState().tournaments[0].audit?.length, auditCount);
  assert.equal(useTournamentStore.getState().renamePlayer(table.id, bia.id, 'Bia Nova'), null);
  current = useTournamentStore.getState().tournaments[0];
  assert.equal(current.players[1].position, 2);
  assert.equal(current.players[1].name, 'Bia Nova');
  assert.equal(current.invitees?.[1].name, 'Bia Nova');

  useTournamentStore.setState({ tournaments: [{ ...current, status: 'finished' }], activeTournamentId: table.id });
  assert.equal(useTournamentStore.getState().renamePlayer(table.id, ana.id, 'Ana Final'), null);
  current = useTournamentStore.getState().tournaments[0];
  assert.equal(current.players[0].name, 'Ana Final');
  await useTournamentStore.persist.rehydrate();
  assert.equal(useTournamentStore.getState().tournaments[0].players[0].name, 'Ana Final');
  assert.equal(useTournamentStore.getState().tournaments[0].invitees?.[0].name, 'Ana Final');
  assert.ok(useTournamentStore.getState().renamePlayer('missing', ana.id, 'Nova'));
  useTournamentStore.setState({ tournaments: [{ ...current, status: 'cancelled' }], activeTournamentId: table.id });
  assert.ok(useTournamentStore.getState().renamePlayer(table.id, ana.id, 'Nao'));
  assert.equal(useTournamentStore.getState().tournaments[0].players[0].name, 'Ana Final');

  const paid = { ...table, status: 'upcoming' as const, players: [{ ...ana, paymentStatus: 'confirmed' as const }] };
  useTournamentStore.setState({ tournaments: [paid], activeTournamentId: table.id });
  assert.equal(useTournamentStore.getState().renamePlayer(table.id, ana.id, 'Ana Paga'), null);
  const afterPaidRename = useTournamentStore.getState().tournaments[0];
  assert.ok(motivoBloqueioRemocao(afterPaidRename, afterPaidRename.players[0]));
  console.log('Player rename: validation, invitation, audit, financial history and reload passed.');
}

main().catch(error => { console.error(error); process.exitCode = 1; });
