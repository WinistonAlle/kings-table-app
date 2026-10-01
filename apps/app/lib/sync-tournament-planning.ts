import { z } from 'zod';
import { dataAgendada } from './noite';
import { createOperation, type SyncOperation } from './sync-operation';
import type { TournamentSnapshot } from './sync-tournament-reader';

export const planningPayloadSchema = z.strictObject({
  startTime: z.iso.datetime(), location: z.string().trim().max(200),
  capacity: z.number().int().min(2).max(1000).nullable(),
});
export type PlanningDraft = { day: string; time: string; location: string; capacity: string };

export function planningFields(snapshot: TournamentSnapshot): PlanningDraft {
  const date = snapshot.tournament.start_time ? new Date(snapshot.tournament.start_time) : null;
  const details = z.object({ location: z.string().max(200).optional(),
    capacity: z.number().int().min(2).max(1000).optional() }).parse(snapshot.tournament.details);
  return { day: date?.toLocaleDateString('pt-BR') ?? '',
    time: date ? `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}` : '',
    location: details.location ?? '', capacity: details.capacity ? String(details.capacity) : '' };
}

export function preparePlanningOperation(snapshot: TournamentSnapshot, draft: PlanningDraft,
  now = new Date()): SyncOperation {
  const table = snapshot.tournament;
  if (table.deleted_at || table.status !== 'upcoming') throw new Error('Somente mesas agendadas podem ser alteradas.');
  const startTime = dataAgendada(draft.day, draft.time, now);
  if (!startTime) throw new Error('Informe uma data futura válida e horário HH:MM.');
  if (draft.location.trim().length > 200) throw new Error('O local deve ter até 200 caracteres.');
  if (draft.capacity.trim() && !/^\d+$/.test(draft.capacity.trim())) throw new Error('Informe um número inteiro de vagas.');
  const capacity = draft.capacity.trim() ? Number(draft.capacity.trim()) : null;
  const occupied = snapshot.players.length + snapshot.invites.filter(invite =>
    !invite.deleted_at && !invite.player_id && invite.status === 'confirmed').length;
  if (capacity !== null && (!Number.isInteger(capacity) || capacity < Math.max(2, occupied) || capacity > 1000)) {
    throw new Error(`O limite deve ter entre ${Math.max(2, occupied)} e 1.000 vagas e comportar os participantes.`);
  }
  const payload = planningPayloadSchema.parse({ startTime, location: draft.location, capacity });
  return createOperation({ ownerId: table.created_by, entityId: table.id, entity: 'tournament',
    kind: 'tournament.update', expectedRevision: table.revision, payload });
}
