import { z } from 'zod';
import { novaIdentidade } from './identidade';

const revision = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER - 1);
export const operationSchema = z.strictObject({
  version: z.literal(1),
  id: z.uuid(), ownerId: z.uuid(), entityId: z.uuid(),
  entity: z.enum(['tournament', 'preset']),
  kind: z.enum([
    'tournament.create', 'tournament.update', 'tournament.delete', 'tournament.start',
    'player.add', 'player.remove', 'player.update', 'player.eliminate', 'player.undoElimination',
    'invite.add', 'invite.remove', 'invite.attendance', 'invite.checkIn',
    'seats.draw', 'seats.move', 'seats.undo', 'settlement.record', 'settlement.void',
    'clock.start', 'clock.pause', 'clock.reset', 'clock.level', 'clock.handForHand', 'clock.structure',
    'preset.save', 'preset.remove',
  ]),
  expectedRevision: revision,
  createdAt: z.iso.datetime(),
  payload: z.record(z.string(), z.json()),
}).refine(op => op.kind.startsWith('preset.') === (op.entity === 'preset'), 'Tipo de entidade inconsistente');

export type SyncOperation = z.infer<typeof operationSchema>;
export type NewOperation = Omit<SyncOperation, 'version' | 'id' | 'createdAt'>;

export function parseOperation(value: unknown): SyncOperation {
  const operation = operationSchema.parse(value);
  if (new TextEncoder().encode(JSON.stringify(operation)).length > 1024 * 1024) {
    throw new Error('A operacao excede o limite de 1 MB.');
  }
  return operation;
}

export function createOperation(input: NewOperation): SyncOperation {
  return parseOperation({ ...input, version: 1, id: novaIdentidade(), createdAt: new Date().toISOString() });
}

// Comparacao canonica de JSON: ordem das chaves nao muda a identidade do conteudo.
function canonical(value: z.infer<ReturnType<typeof z.json>>): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value !== null && typeof value === 'object') {
    return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${canonical(value[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

export function operationContent(operation: SyncOperation): string {
  return canonical(operation);
}
