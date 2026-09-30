import 'fake-indexeddb/auto';
import assert from 'node:assert/strict';
import { deleteDB } from 'idb';
import { novaIdentidade } from '../lib/identidade';
import { createOperation } from '../lib/sync-operation';
import { SyncOutbox } from '../lib/sync-outbox';
import type { TournamentSummary } from '../lib/sync-tournament-catalog';
import { projectTournamentCatalog } from '../lib/sync-tournament-model';

async function main() {
  const name = `qa-tournament-reservation-${novaIdentidade()}`;
  const owner = novaIdentidade(), other = novaIdentidade(), tableId = novaIdentidade();
  let one = new SyncOutbox(name), two = new SyncOutbox(name);
  const summary = (revision: number, deletedAt: string | null = null): TournamentSummary => ({
    ownerId: owner, id: tableId, revision, name: 'Mesa', format: 'regular', status: 'upcoming',
    buyIn: 20, startTime: null, updatedAt: '2026-09-30T12:00:00+00:00', deletedAt,
  });
  const make = (kind: 'tournament.create' | 'tournament.update' | 'tournament.delete',
    expectedRevision: number) => createOperation({ ownerId: owner, entityId: tableId, entity: 'tournament',
      kind, expectedRevision, payload: { name: 'Mesa' } });
  try {
    const initial = make('tournament.create', 0);
    await assert.rejects(one.enqueueTournament(make('tournament.update', 1)), /Atualize a mesa/);
    await assert.rejects(one.enqueueTournament(createOperation({ ...initial, entity: 'preset', kind: 'preset.save' })),
      /nao pertence/);
    const saved = await one.enqueueTournament(initial);
    assert.equal((await two.enqueueTournament(initial)).sequence, saved.sequence);
    await assert.rejects(two.enqueueTournament({ ...initial, payload: { name: 'Outro' } }), /outro conteudo/);
    await assert.rejects(two.enqueueTournament(make('tournament.create', 0)), /historico local/);
    const competing = [make('tournament.update', 1), make('tournament.update', 1)];
    const outcomes = await Promise.allSettled([one.enqueueTournament(competing[0]), two.enqueueTournament(competing[1])]);
    assert.deepEqual(outcomes.map(result => result.status).sort(), ['fulfilled', 'rejected'],
      'Two tabs cannot reserve the same revision for different commands');
    assert.equal((await one.tournamentView(owner)).pending.length, 2);
    const winner = outcomes[0].status === 'fulfilled' ? competing[0] : competing[1];
    const dependent = make('tournament.update', 2);
    await two.enqueueTournament(dependent);
    assert.deepEqual((await one.tournamentView(owner)).pending.map(entry => entry.operation.expectedRevision), [0, 1, 2]);
    await assert.rejects(one.enqueueTournament(make('tournament.update', 2)), /revise a versao/i);
    assert.equal((await one.tournamentView(other)).pending.length, 0);

    for (const [expected, operation] of [initial, winner, dependent].entries()) {
      const claim = await one.claim(owner, 1000 + expected, 30000, 'tournament');
      assert.equal(claim?.operation.id, operation.id);
      assert.equal(await two.confirm(owner, operation.id, claim!.lease!.token,
        { operationId: operation.id, revision: expected + 1 }), true);
    }
    const beforeCatalog = await one.tournamentView(owner);
    assert.deepEqual(beforeCatalog.pending, []);
    assert.equal(beforeCatalog.views[0].confirmed, null);
    assert.equal(beforeCatalog.views[0].projectedRevision, 3);
    assert.equal(beforeCatalog.views[0].awaitingCatalog, true);
    assert.equal(beforeCatalog.views[0].reconciliationNeeded, false);
    assert.throws(() => projectTournamentCatalog(null, [
      { ...saved, status: 'queued' },
      { ...saved, operation: { ...saved.operation, ownerId: other } },
    ]), /inconsistente/);
    await one.mergeTournamentSummaries(owner, [summary(1)], new AbortController().signal);
    assert.equal((await one.tournamentView(owner)).views[0].awaitingCatalog, true);
    await one.close(); await two.close();
    one = new SyncOutbox(name); two = new SyncOutbox(name);
    const next = make('tournament.update', 3);
    await one.enqueueTournament(next);
    assert.equal((await two.tournamentView(owner)).pending[0].operation.id, next.id,
      'Confirmed revisions and pending commands survive reload with a stale catalog');
    const claimed = await two.claim(owner, 10000, 30000, 'tournament');
    assert.equal(claimed?.operation.id, next.id);
    await two.fail(owner, next.id, claimed!.lease!.token, 'conflict',
      { code: '40001', message: 'Outra aba mudou a mesa' });
    await assert.rejects(one.enqueueTournament(make('tournament.update', 4)), /Revise as alteracoes pendentes/);
    await one.mergeTournamentSummaries(owner, [summary(4)], new AbortController().signal);
    await assert.rejects(one.enqueueTournament(make('tournament.update', 4)), /Revise as alteracoes pendentes/,
      'A newer catalog does not silently discard conflicting intent');

    const deletedId = novaIdentidade();
    await one.mergeTournamentSummaries(owner, [{ ...summary(1, '2026-09-30T13:00:00+00:00'), id: deletedId }],
      new AbortController().signal);
    await assert.rejects(one.enqueueTournament(createOperation({ ...next, entityId: deletedId })),
      /Atualize a mesa/);
    assert.equal((await one.tournamentView(owner)).views.find(view => view.id === deletedId)?.projectedDeleted, true);
    const scheduledDelete = novaIdentidade();
    await one.mergeTournamentSummaries(owner, [{ ...summary(1), id: scheduledDelete }], new AbortController().signal);
    await one.enqueueTournament(createOperation({ ...next, entityId: scheduledDelete,
      kind: 'tournament.delete', expectedRevision: 1, payload: {} }));
    assert.equal((await one.tournamentView(owner)).views.find(view => view.id === scheduledDelete)?.projectedDeleted, true);
    await assert.rejects(one.enqueueTournament(createOperation({ ...next, entityId: scheduledDelete,
      expectedRevision: 2 })), /Atualize a mesa/);
    assert.equal((await one.list(owner)).filter(entry => entry.operation.entityId === tableId).length, 4);
  } finally { await one.close(); await two.close(); await deleteDB(name); }
  console.log('Tournament reservation: atomic cross-tab revisions, idempotence, reload, conflicts, isolation and tombstones passed.');
}
main().catch(error => { console.error(error); process.exitCode = 1; });
