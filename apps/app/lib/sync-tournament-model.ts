import type { OutboxEntry } from './sync-outbox';
import type { TournamentSummary } from './sync-tournament-catalog';

export type TournamentCatalogView = {
  id: string;
  confirmed: TournamentSummary | null;
  pending: OutboxEntry[];
  projectedRevision: number | null;
  projectedDeleted: boolean;
  awaitingCatalog: boolean;
  reconciliationNeeded: boolean;
};

// Operations reserve revisions, but only the server catalog can confirm tournament fields.
export function projectTournamentCatalog(confirmed: TournamentSummary | null,
  entries: OutboxEntry[]): TournamentCatalogView {
  const sorted = [...entries].sort((a, b) => a.sequence - b.sequence);
  const id = confirmed?.id ?? sorted[0]?.operation.entityId;
  const ownerId = confirmed?.ownerId ?? sorted[0]?.operation.ownerId;
  if (!id || sorted.some(entry => entry.operation.entity !== 'tournament'
    || entry.operation.entityId !== id || entry.operation.ownerId !== ownerId)) {
    throw new Error('Historico de mesa inconsistente.');
  }
  let revision = confirmed?.revision ?? 0;
  let exists = !!confirmed;
  let deleted = confirmed?.deletedAt != null;
  let awaitingCatalog = false;
  let reconciliationNeeded = false;
  for (const entry of sorted) {
    if (entry.status === 'cancelled') continue;
    const { operation } = entry;
    if (entry.status === 'confirmed' && entry.receipt!.revision <= revision) continue;
    if (reconciliationNeeded || deleted || entry.status === 'conflict' || entry.status === 'rejected'
      || operation.expectedRevision !== revision || (!exists && operation.kind !== 'tournament.create')) {
      reconciliationNeeded = true;
      continue;
    }
    exists = true;
    revision = operation.expectedRevision + 1;
    if (entry.status === 'confirmed') awaitingCatalog = true;
    if (operation.kind === 'tournament.delete') deleted = true;
  }
  return {
    id, confirmed,
    pending: sorted.filter(entry => entry.status !== 'confirmed' && entry.status !== 'cancelled'),
    projectedRevision: exists ? revision : null, projectedDeleted: deleted,
    awaitingCatalog, reconciliationNeeded,
  };
}
