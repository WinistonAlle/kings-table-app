import type { SupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';
import type { Database, Json } from '../types/supabase';
import { parseOperation } from './sync-operation';
import type { OperationTransport, SyncOutcome } from './sync-sender';

const receiptSchema = z.strictObject({
  operationId: z.uuid(), revision: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
});
const outcome = (status: 'retry' | 'conflict' | 'rejected', code: string, message: string): SyncOutcome =>
  ({ status, issue: { code, message } });

// One account and only server-backed commands. Other player, clock and
// tournament mutations must wait for their own domain rules and revisions.
export function createTournamentTransport(client: Pick<SupabaseClient<Database>, 'rpc'>, ownerId: string): OperationTransport {
  z.uuid().parse(ownerId);
  return async (input, signal) => {
    signal.throwIfAborted();
    let operation;
    try { operation = parseOperation(input); }
    catch { return outcome('rejected', 'invalid_operation', 'O comando local da mesa é inválido. Revise os dados antes de continuar.'); }
    if (operation.ownerId !== ownerId) {
      return outcome('rejected', 'actor_mismatch', 'Este comando pertence a outra conta.');
    }
    if (operation.entity !== 'tournament' || !['tournament.create', 'tournament.update', 'player.add', 'player.remove'].includes(operation.kind)) {
      return outcome('rejected', 'unsupported_operation', 'Este comando da mesa ainda não está disponível online.');
    }
    try {
      const { data, error, status } = await client.rpc('apply_tournament_operation', {
        p_operation: operation as unknown as Json,
      }).abortSignal(signal);
      signal.throwIfAborted();
      if (error) {
        if (error.code === '40001') return outcome('conflict', '40001', 'Esta mesa mudou em outra tela. Revise a versão atual antes de reenviar.');
        if (status === 401 || ['PGRST301', 'PGRST302', 'PGRST303'].includes(error.code)) {
          return outcome('retry', 'session_required', 'Entre novamente para confirmar o envio. O comando continua salvo.');
        }
        if (error.code === '42501') return outcome('rejected', '42501', 'Sua conta não tem permissão para alterar esta mesa.');
        if (['22023', '22P02', '23505', '23514', '55000'].includes(error.code)) {
          return outcome('rejected', error.code, 'O servidor recusou o comando. Revise as regras e os dados informados.');
        }
        return outcome('retry', 'remote_unavailable', 'Não foi possível confirmar o envio. O comando continua salvo para reenvio.');
      }
      const parsed = receiptSchema.safeParse(data);
      if (!parsed.success || parsed.data.operationId !== operation.id || parsed.data.revision !== operation.expectedRevision + 1) {
        return outcome('retry', 'invalid_receipt', 'A confirmação recebida é inválida. O reenvio usará o mesmo ID.');
      }
      return { status: 'confirmed', receipt: parsed.data };
    } catch {
      signal.throwIfAborted();
      return outcome('retry', 'transport', 'A conexão falhou antes da confirmação. O comando continua salvo.');
    }
  };
}
