import { z } from 'zod';
import { novaIdentidade } from './identidade';
import { createOperation, type SyncOperation } from './sync-operation';
import type { TournamentSnapshot } from './sync-tournament-reader';

const attendance = z.enum(['confirmed', 'maybe', 'absent', 'waiting']);
export type AccountAttendance = z.infer<typeof attendance>;
export const attendanceLabels: Record<AccountAttendance, string> = {
  confirmed: 'Confirmado', maybe: 'Talvez', absent: 'Ausente', waiting: 'Em espera',
};
const actionSchema = z.discriminatedUnion('kind', [
  z.strictObject({ kind: z.literal('add'), name: z.string().trim().min(1, 'Informe o nome do convidado.').max(60), status: attendance }),
  z.strictObject({ kind: z.literal('attendance'), inviteId: z.uuid(), status: attendance }),
  z.strictObject({ kind: z.literal('remove'), inviteId: z.uuid() }),
  z.strictObject({ kind: z.literal('checkIn'), inviteId: z.uuid() }),
]);
export type InviteAction = z.infer<typeof actionSchema>;
const nameKey = (name: string) => name.trim().toLowerCase();
function compareInstants(a: string, b: string): number {
  const milliseconds = Date.parse(a) - Date.parse(b);
  if (milliseconds) return milliseconds;
  // Date truncates Postgres microseconds. Retain those digits when milliseconds tie.
  const fraction = (value: string) => (value.match(/\.(\d+)(?:Z|[+-]\d{2}:\d{2})$/)?.[1] ?? '').padEnd(9, '0');
  return fraction(a).localeCompare(fraction(b));
}

export function accountReservedPlaces(snapshot: TournamentSnapshot): number {
  const names = new Set(snapshot.players.map(player => nameKey(player.display_name)));
  for (const invite of snapshot.invites) if (!invite.deleted_at && invite.status === 'confirmed') names.add(nameKey(invite.name));
  return names.size;
}

export function accountInviteRoster(snapshot: TournamentSnapshot) {
  const invites = snapshot.invites.filter(invite => !invite.deleted_at);
  const waiting = invites.filter(invite => invite.status === 'waiting' && !invite.player_id)
    .sort((a, b) => compareInstants(a.waiting_since ?? a.created_at, b.waiting_since ?? b.created_at)
      || a.id.localeCompare(b.id));
  const positions = new Map(waiting.map((invite, index) => [invite.id, index + 1]));
  const capacity = z.object({ capacity: z.number().int().min(2).max(1000).optional() }).parse(snapshot.tournament.details).capacity;
  return { invites: [...invites].sort((a, b) => compareInstants(a.created_at, b.created_at) || a.id.localeCompare(b.id)),
    positions, waiting: waiting.length, reserved: accountReservedPlaces(snapshot), capacity: capacity ?? null };
}

export function prepareInviteOperation(snapshot: TournamentSnapshot, input: InviteAction): SyncOperation {
  const action = actionSchema.parse(input);
  const table = snapshot.tournament;
  if (table.deleted_at || table.status !== 'upcoming') throw Error('Os convidados só podem ser alterados antes do início da noite.');
  const command = (kind: SyncOperation['kind'], payload: SyncOperation['payload']) => createOperation({
    ownerId: table.created_by, entityId: table.id, entity: 'tournament', expectedRevision: table.revision, kind, payload,
  });
  if (action.kind === 'add') {
    if (snapshot.invites.some(invite => !invite.deleted_at && nameKey(invite.name) === nameKey(action.name))) {
      throw Error('Já existe um convidado com este nome.');
    }
    return command('invite.add', { inviteId: novaIdentidade(), name: action.name, status: action.status });
  }
  const invite = snapshot.invites.find(row => row.id === action.inviteId && !row.deleted_at && row.tournament_id === table.id);
  if (!invite) throw Error('Convidado não encontrado. Atualize os detalhes.');
  if (invite.player_id) throw Error('Este convidado já entrou na mesa. Gerencie sua entrada em jogadores.');
  if (action.kind === 'remove') return command('invite.remove', { inviteId: invite.id });
  if (action.kind === 'attendance') {
    if (invite.status === action.status) throw Error('Esta já é a confirmação de presença.');
    // The server decides whether a confirmation reserves a place or joins the waiting list.
    return command('invite.attendance', { inviteId: invite.id, status: action.status });
  }
  if (invite.status !== 'confirmed') throw Error('Confirme a presença e aguarde uma vaga antes de registrar a chegada.');
  const existing = snapshot.players.find(player => nameKey(player.display_name) === nameKey(invite.name));
  return command('invite.checkIn', { inviteId: invite.id, playerId: existing?.id ?? novaIdentidade() });
}

export function inviteOperationLabel(operation: SyncOperation): string | null {
  switch (operation.kind) {
    case 'invite.add': return `Adicionar convidado: ${typeof operation.payload.name === 'string' ? operation.payload.name : 'nome indisponível'}`;
    case 'invite.attendance': return `Presença: ${attendance.safeParse(operation.payload.status).success
      ? attendanceLabels[operation.payload.status as AccountAttendance] : 'estado indisponível'}`;
    case 'invite.remove': return 'Retirar convidado';
    case 'invite.checkIn': return 'Registrar chegada do convidado';
    default: return null;
  }
}
