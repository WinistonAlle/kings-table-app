import { createOperation } from './sync-operation';
import { preparePresetPayload, presetPayloadSchema } from './sync-preset-model';
import type { TournamentSnapshot } from './sync-tournament-reader';

export function prepareStructureOperation(snapshot: TournamentSnapshot, input: unknown) {
  const table = snapshot.tournament;
  if (table.deleted_at || table.status !== 'upcoming') throw Error('A estrutura só pode ser alterada antes do início da noite.');
  const { levels } = preparePresetPayload({ name: table.name, levels: input });
  const previous = presetPayloadSchema.parse({ name: table.name, levels: table.blind_levels }).levels;
  const same = previous.length === levels.length && previous.every((row, index) => {
    const next = levels[index];
    return row.level === next.level && row.smallBlind === next.smallBlind && row.bigBlind === next.bigBlind
      && row.ante === next.ante && row.durationMinutes === next.durationMinutes && !!row.isBreak === !!next.isBreak;
  });
  if (same) throw Error('A estrutura não foi alterada.');
  return createOperation({ ownerId: table.created_by, entityId: table.id, entity: 'tournament',
    kind: 'clock.structure', expectedRevision: table.revision, payload: { levels } });
}
