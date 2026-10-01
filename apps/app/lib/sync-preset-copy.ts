import { presetBaseSchema, type PresetBase } from './sync-preset-model';
import type { PresetLibrary } from './sync-preset-session';

export function preparePresetCopyDraft(row: PresetLibrary[number]) {
  if (!row.confirmed || row.pending.length || row.reconciliationNeeded) {
    throw new Error('Atualize e confirme a estrutura antes de criar uma copia.');
  }
  const source: PresetBase = presetBaseSchema.parse(row.confirmed);
  if (row.id !== source.id) throw new Error('A identidade da estrutura nao corresponde a versao confirmada.');
  if (source.deleted || !source.payload) throw new Error('Esta estrutura foi removida da biblioteca.');
  const suffix = ' (cópia)';
  return {
    ownerId: source.ownerId, sourceId: source.id, sourceRevision: source.revision,
    sourceName: source.payload.name,
    name: Array.from(source.payload.name).slice(0, 120 - Array.from(suffix).length).join('').trimEnd() + suffix,
    levels: source.payload.levels.map(level => ({ ...level })),
  };
}
