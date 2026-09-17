import { z } from 'zod';
import { normalizarEstrutura, validarEstrutura } from './estrutura';
import type { SyncOperation } from './sync-operation';
import type { OutboxEntry } from './sync-outbox';

const integer = z.number().int().nonnegative().safe();
const levelSchema = z.strictObject({
  level: integer, smallBlind: integer, bigBlind: integer, ante: integer,
  durationMinutes: z.number().int().min(1).max(240), isBreak: z.boolean().optional(),
});
const inputSchema = z.strictObject({ name: z.string(), levels: z.array(levelSchema).min(1).max(500) });
export const presetPayloadSchema = inputSchema.extend({
  name: z.string().trim().min(1).refine(name => Array.from(name).length <= 120, 'Use ate 120 caracteres.'),
}).superRefine((payload, ctx) => {
  const error = validarEstrutura(payload.levels);
  const normalized = normalizarEstrutura(payload.levels);
  if (error || normalized.some((level, index) =>
    ['level', 'smallBlind', 'bigBlind', 'ante'].some(key => level[key as keyof typeof level] !== payload.levels[index][key as keyof typeof level]))) {
    ctx.addIssue({ code: 'custom', message: error ?? 'A sequencia e os intervalos devem estar normalizados.' });
  }
});
export type PresetPayload = z.infer<typeof presetPayloadSchema>;
export function preparePresetPayload(value: unknown): PresetPayload {
  const input = inputSchema.parse(value);
  return presetPayloadSchema.parse({ name: input.name, levels: normalizarEstrutura(input.levels) });
}

export const presetBaseSchema = z.strictObject({
  ownerId: z.uuid(), id: z.uuid(), revision: integer, deleted: z.boolean(),
  payload: presetPayloadSchema.nullable(),
}).refine(base => base.deleted || base.payload !== null, 'Preset ativo precisa de dados');
export type PresetBase = z.infer<typeof presetBaseSchema>;

export function applyPresetOperation(base: PresetBase | null, operation: SyncOperation): PresetBase {
  if (operation.entity !== 'preset') throw new Error('Comando nao pertence a uma estrutura.');
  if (base && (base.ownerId !== operation.ownerId || base.id !== operation.entityId)) throw new Error('Alvo inconsistente.');
  if (operation.kind === 'preset.save') return presetBaseSchema.parse({
    ownerId: operation.ownerId, id: operation.entityId, revision: operation.expectedRevision + 1,
    deleted: false, payload: presetPayloadSchema.parse(operation.payload),
  });
  if (operation.kind !== 'preset.remove' || Object.keys(operation.payload).length) throw new Error('Remocao invalida.');
  return presetBaseSchema.parse({ ownerId: operation.ownerId, id: operation.entityId,
    revision: operation.expectedRevision + 1, deleted: true, payload: base?.payload ?? null });
}

export function projectPreset(base: PresetBase | null, entries: OutboxEntry[]) {
  let projected = base;
  let reconciliationNeeded = false;
  const pending = entries.filter(entry => entry.status !== 'confirmed').sort((a, b) => a.sequence - b.sequence);
  for (const entry of pending) {
    if (reconciliationNeeded || entry.status === 'conflict' || entry.status === 'rejected'
      || entry.operation.expectedRevision !== (projected?.revision ?? 0) || projected?.deleted) {
      reconciliationNeeded = true;
      continue;
    }
    projected = applyPresetOperation(projected, entry.operation);
  }
  if (!base && entries.some(entry => entry.status === 'confirmed')) reconciliationNeeded = true;
  return { confirmed: base, projected, pending, reconciliationNeeded };
}
