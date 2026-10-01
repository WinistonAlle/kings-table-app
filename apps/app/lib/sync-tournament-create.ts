import { z } from 'zod';
import { novaIdentidade } from './identidade';
import { createOperation } from './sync-operation';
import { preparePresetPayload, presetPayloadSchema } from './sync-preset-model';

export const tournamentCreatePayloadSchema = z.strictObject({
  name: z.string().trim().min(1).max(120),
  format: z.enum(['deep', 'regular', 'turbo', 'hyper', 'rebuy', 'bounty']),
  buyIn: z.number().finite().min(0.01).max(99999999.99).refine(value =>
    Math.abs(value * 100 - Math.round(value * 100)) < 0.000001, 'Informe o buy-in em centavos.'),
  reEntryAllowed: z.boolean(), maxReEntries: z.number().int().min(0).max(100),
  startTime: z.iso.datetime(), levels: presetPayloadSchema.shape.levels,
  suit: z.enum(['espada', 'copas', 'ouros', 'paus']), color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  location: z.string().trim().max(200), capacity: z.number().int().min(2).max(1000).optional(),
}).superRefine((payload, ctx) => {
  if (!payload.reEntryAllowed && payload.maxReEntries !== 0) {
    ctx.addIssue({ code: 'custom', message: 'Limite de reentradas requer permissao de reentrada.' });
  }
  const parsed = presetPayloadSchema.safeParse({ name: payload.name, levels: payload.levels });
  if (!parsed.success) ctx.addIssue({ code: 'custom', message: 'Estrutura de blinds invalida.' });
});
export type TournamentCreatePayload = z.infer<typeof tournamentCreatePayloadSchema>;

export function prepareCreationOperation(ownerId: string, input: TournamentCreatePayload) {
  const structure = preparePresetPayload({ name: input.name, levels: input.levels });
  const { capacity, ...rest } = input;
  const payload = tournamentCreatePayloadSchema.parse({ ...rest, ...structure,
    ...(capacity === undefined ? {} : { capacity }) });
  return createOperation({ ownerId, entityId: novaIdentidade(), entity: 'tournament',
    kind: 'tournament.create', expectedRevision: 0, payload });
}
