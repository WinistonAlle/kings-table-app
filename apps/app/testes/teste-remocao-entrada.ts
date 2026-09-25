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
    { name: 'financial activity', tournament: base, player: { ...player, financialActivityRecorded: true } },
    { name: 'running', tournament: { ...base, status: 'running' }, player },
    { name: 'finished', tournament: { ...base, status: 'finished' }, player },
    { name: 'reentry', tournament: base, player: { ...player, reEntries: 1 } },
    { name: 'addon', tournament: base, player: { ...player, addOns: 1 } },
    { name: 'result', tournament: base, player: { ...player, position: 1, prize: 40 } },
    { name: 'settlement', tournament: { ...base, settlementPayments: [{ id: 'settled', from: player.id,
      to: '__organizer__', cents: 2000, at: '', baseline: '', voidedAt: '' }] }, player },
    { name: 'legacy renamed payment', tournament: { ...base, audit: [
      { id: 'paid', at: '', actor: 'QA', summary: 'Pagamento de Ana',
        changes: [{ label: 'Pagamento de Ana', before: 'A receber', after: 'Pago' }] },
      { id: 'renamed', at: '', actor: 'QA', summary: 'Nome de Ana',
        changes: [{ label: 'Nome de Ana', before: 'Ana', after: 'Ana Nova' }] },
    ] }, player: { ...player, name: 'Ana Nova' } },
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
  const legacy = cases.find(test => test.name === 'legacy renamed payment')!;
  useTournamentStore.setState({ tournaments: [{ ...legacy.tournament, players: [legacy.player] }],
    activeTournamentId: base.id });
  useTournamentStore.getState().updatePlayer(base.id, player.id, { name: 'Ana Outra' });
  const migrated = useTournamentStore.getState().tournaments[0].players[0];
  assert.equal(migrated.financialActivityRecorded, true, 'editing a legacy record retains past activity');
  const reusedName = { ...legacy.tournament, players: [{ ...player, id: 'new-entry',
    financialActivityRecorded: false }] };
  assert.equal(motivoBloqueioRemocao(reusedName, reusedName.players[0]), null,
    'a new person may reuse a historical name');
  useTournamentStore.setState({ tournaments: [{ ...base, players: [] }], activeTournamentId: base.id });
  useTournamentStore.getState().addPlayer(base.id, { userId: 'guest-new', name: 'Nova',
    buyIns: 1, reEntries: 0, addOns: 0, paymentStatus: 'pending' });
  assert.equal(useTournamentStore.getState().tournaments[0].players[0].financialActivityRecorded, false);
  assert.equal(motivoBloqueioRemocao(base, player), null);
  useTournamentStore.setState({ tournaments: [base], activeTournamentId: base.id });
  useTournamentStore.getState().updatePlayer(base.id, player.id, { paymentStatus: 'confirmed' });
  useTournamentStore.getState().updatePlayer(base.id, player.id, { paymentStatus: 'disputed' });
  useTournamentStore.getState().updatePlayer(base.id, player.id, { paymentStatus: 'pending',
    financialActivityRecorded: false });
  const revertedPayment = useTournamentStore.getState().tournaments[0];
  assert.equal(revertedPayment.players[0].financialActivityRecorded, true);
  assert.ok(motivoBloqueioRemocao(revertedPayment, revertedPayment.players[0]));
  useTournamentStore.getState().removePlayer(base.id, player.id);
  assert.equal(useTournamentStore.getState().tournaments[0].players.length, 1);
  await useTournamentStore.persist.rehydrate();
  assert.equal(useTournamentStore.getState().tournaments[0].players[0].financialActivityRecorded, true);
  useTournamentStore.setState({ tournaments: [base], activeTournamentId: base.id });
  useTournamentStore.getState().updatePlayer(base.id, player.id, { reEntries: 1 });
  useTournamentStore.getState().updatePlayer(base.id, player.id, { reEntries: 0 });
  const revertedReentry = useTournamentStore.getState().tournaments[0];
  assert.equal(revertedReentry.players[0].financialActivityRecorded, true);
  assert.ok(motivoBloqueioRemocao(revertedReentry, revertedReentry.players[0]));
  useTournamentStore.setState({ tournaments: [base], activeTournamentId: base.id });
  useTournamentStore.getState().removePlayer(base.id, player.id);
  const after = useTournamentStore.getState().tournaments[0];
  assert.equal(after.players.length, 0);
  assert.equal(after.invitees?.[0].playerId, undefined);
  assert.match(after.audit?.at(-1)?.summary ?? '', /Entrada de Ana/);
  assert.match(after.audit?.at(-1)?.changes[0].after ?? '', /Removida/);
  await useTournamentStore.persist.rehydrate();
  assert.equal(useTournamentStore.getState().tournaments[0].players.length, 0);
  console.log('Entry removal: financial history stays blocked after reversal/reload; valid removal and audit survive reload.');
}

main().catch(error => { console.error(error); process.exitCode = 1; });
