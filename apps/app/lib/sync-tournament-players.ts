import { z } from 'zod';
import { novaIdentidade } from './identidade';
import { createOperation, type SyncOperation } from './sync-operation';
import type { TournamentSnapshot } from './sync-tournament-reader';

const name = z.string().trim().min(1, 'Informe o nome do jogador.').max(60, 'Use até 60 caracteres no nome.');
const playerId = z.uuid();
export const playerActionSchema = z.discriminatedUnion('kind', [
  z.strictObject({ kind: z.literal('add'), name }),
  z.strictObject({ kind: z.literal('rename'), playerId, name }),
  z.strictObject({ kind: z.literal('remove'), playerId }),
  z.strictObject({ kind: z.literal('eliminate'), playerId }),
  z.strictObject({ kind: z.literal('undoElimination'), playerId }),
  z.strictObject({ kind: z.literal('entry'), playerId, entryKind: z.enum(['reEntry', 'addOn']), delta: z.union([z.literal(-1), z.literal(1)]) }),
  z.strictObject({ kind: z.literal('payment'), playerId, status: z.enum(['pending', 'confirmed', 'disputed']) }),
]);
export type PlayerAction = z.infer<typeof playerActionSchema>;
export type AccountPlayer = TournamentSnapshot['players'][number];

export function playerTotalCents(snapshot: TournamentSnapshot, player: AccountPlayer): number {
  const unit = snapshot.tournament.buy_in * 100;
  const count = player.buy_ins + player.re_entries + player.add_ons;
  const total = Math.round(unit) * count;
  if (player.tournament_id !== snapshot.tournament.id || Math.abs(unit - Math.round(unit)) > 0.000001
    || !Number.isSafeInteger(count) || count < 1 || !Number.isSafeInteger(total) || total < 1) {
    throw new Error('Valor do jogador inconsistente. Atualize a mesa.');
  }
  return total;
}

export function canRemoveAccountPlayer(snapshot: TournamentSnapshot, player: AccountPlayer) {
  return snapshot.tournament.status === 'upcoming' && !snapshot.tournament.deleted_at
    && player.tournament_id === snapshot.tournament.id && player.buy_ins === 1
    && player.re_entries === 0 && player.add_ons === 0 && player.payment_status === 'pending'
    && player.position === null && player.prize === null && player.eliminated_at === null
    && !player.financial_activity_recorded;
}

export function canUndoAccountElimination(snapshot: TournamentSnapshot, player: AccountPlayer) {
  const places = snapshot.players.flatMap(row => row.position !== null && row.position > 1 ? [row.position] : []);
  return !snapshot.tournament.deleted_at && ['running', 'finished'].includes(snapshot.tournament.status)
    && player.tournament_id === snapshot.tournament.id && player.position !== null && player.position > 1
    && player.position === Math.min(...places);
}

export function preparePlayerOperation(snapshot: TournamentSnapshot, input: PlayerAction): SyncOperation {
  const action = playerActionSchema.parse(input);
  const table = snapshot.tournament;
  if (table.deleted_at || table.status === 'cancelled') throw new Error('Esta mesa não aceita alterações.');
  if (!['rename', 'undoElimination'].includes(action.kind) && !['upcoming', 'running'].includes(table.status)) {
    throw new Error('Esta ação exige uma mesa em preparação ou em andamento.');
  }
  const command = (kind: SyncOperation['kind'], payload: SyncOperation['payload']) => createOperation({
    ownerId: table.created_by, entityId: table.id, entity: 'tournament', expectedRevision: table.revision, kind, payload,
  });
  const usedName = (value: string, except?: string) => snapshot.players.some(player => player.id !== except
    && player.display_name.trim().toLowerCase() === value.toLowerCase());
  if (action.kind === 'add') {
    if (usedName(action.name)) throw new Error('Já existe um jogador com este nome na mesa.');
    const capacity = z.object({ capacity: z.number().int().min(2).max(1000).optional() }).parse(table.details).capacity;
    const occupied = snapshot.players.filter(player => table.status === 'upcoming' || player.position === null).length
      + snapshot.invites.filter(invite => !invite.deleted_at && !invite.player_id && invite.status === 'confirmed').length;
    if (capacity !== undefined && occupied >= capacity) throw new Error('As vagas estão ocupadas ou reservadas para convidados.');
    return command('player.add', { playerId: novaIdentidade(), name: action.name });
  }
  const player = snapshot.players.find(row => row.id === action.playerId);
  if (!player) throw new Error('Jogador não encontrado nesta mesa. Atualize os detalhes.');
  if (action.kind === 'eliminate') {
    if (table.status !== 'running' || player.position !== null || snapshot.players.filter(row => row.position === null).length <= 1) {
      throw new Error('Este jogador não pode ser eliminado agora.');
    }
    return command('player.eliminate', { playerId: player.id });
  }
  if (action.kind === 'undoElimination') {
    if (!canUndoAccountElimination(snapshot, player)) throw new Error('Somente a última eliminação pode ser desfeita.');
    return command('player.undoElimination', { playerId: player.id });
  }
  if (action.kind === 'rename') {
    if (action.name === player.display_name) throw new Error('O nome não foi alterado.');
    if (usedName(action.name, player.id)) throw new Error('Já existe um jogador com este nome na mesa.');
    return command('player.update', { playerId: player.id, name: action.name });
  }
  if (action.kind === 'remove') {
    if (!canRemoveAccountPlayer(snapshot, player)) throw new Error('Somente uma entrada sem histórico pode ser retirada antes do início.');
    return command('player.remove', { playerId: player.id });
  }
  const cents = playerTotalCents(snapshot, player);
  if (action.kind === 'payment') {
    if (player.payment_status === action.status) throw new Error('Este já é o estado do pagamento.');
    return command('player.payment.set', { playerId: player.id, status: action.status, expectedAmountCents: cents });
  }
  const count = action.entryKind === 'reEntry' ? player.re_entries : player.add_ons;
  if (action.delta === 1) {
    if (action.entryKind === 'reEntry' && (!table.re_entry_allowed || count >= table.max_re_entries)) {
      throw new Error('O limite de reentradas deste jogador foi atingido.');
    }
    if (action.entryKind === 'addOn' && count >= 1000) throw new Error('O limite de add-ons foi atingido.');
  } else if (count < 1 || player.payment_status !== 'pending') {
    throw new Error('A correção exige uma compra existente com pagamento pendente.');
  }
  const after = cents + action.delta * Math.round(table.buy_in * 100);
  if (!Number.isSafeInteger(after) || after < 1) throw new Error('O novo total está fora do limite permitido.');
  return command('player.entries.adjust', { playerId: player.id, entryKind: action.entryKind,
    delta: action.delta, expectedTotalCents: cents });
}

export function playerOperationLabel(operation: SyncOperation): string | null {
  const payload = operation.payload;
  switch (operation.kind) {
    case 'player.add': return `Adicionar jogador: ${typeof payload.name === 'string' ? payload.name : 'nome indisponível'}`;
    case 'player.update': return `Alterar nome: ${typeof payload.name === 'string' ? payload.name : 'nome indisponível'}`;
    case 'player.remove': return 'Retirar entrada do jogador';
    case 'player.eliminate': return 'Registrar eliminação';
    case 'player.undoElimination': return 'Desfazer última eliminação';
    case 'player.entries.adjust': return `${payload.delta === -1 ? 'Corrigir' : 'Registrar'} ${payload.entryKind === 'reEntry' ? 'reentrada' : 'add-on'}`;
    case 'player.payment.set': return `Pagamento: ${payload.status === 'confirmed' ? 'confirmado' : payload.status === 'disputed' ? 'em revisão' : 'pendente'}`;
    default: return null;
  }
}
