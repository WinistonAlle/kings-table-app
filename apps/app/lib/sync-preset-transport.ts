import type { SupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';
import type { Database, Json } from '../types/supabase';
import { parseOperation } from './sync-operation';
import type { OperationTransport, SyncOutcome } from './sync-sender';

const receiptSchema = z.strictObject({
  operationId: z.uuid(), revision: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER),
});
const outcome = (status: 'retry' | 'conflict' | 'rejected', code: string, message: string): SyncOutcome =>
  ({ status, issue: { code, message } });

// Instantiate only for a fixed account lifecycle. Auth/store integration is separate.
export function createPresetTransport(client: Pick<SupabaseClient<Database>, 'rpc'>, ownerId: string): OperationTransport {
  z.uuid().parse(ownerId);
  return async (input, signal) => {
    signal.throwIfAborted();
    let operation;
    try { operation = parseOperation(input); }
    catch { return outcome('rejected', 'invalid_operation', 'A operacao local e invalida. Revise os dados antes de continuar.'); }
    if (operation.ownerId !== ownerId) {
      return outcome('rejected', 'actor_mismatch', 'Esta operacao pertence a outra conta.');
    }
    if (operation.entity !== 'preset') {
      return outcome('rejected', 'unsupported_operation', 'Este transporte aceita somente estruturas salvas.');
    }
    try {
      const { data, error, status } = await client.rpc('apply_preset_operation', {
        p_operation: operation as unknown as Json,
      }).abortSignal(signal);
      signal.throwIfAborted();
      if (error) {
        if (error.code === '40001') return outcome('conflict', '40001', 'A estrutura mudou em outra tela. Revise a versao atual antes de reenviar.');
        if (status === 401 || ['PGRST301', 'PGRST302', 'PGRST303'].includes(error.code)) {
          return outcome('retry', 'session_required', 'Entre novamente para confirmar o envio. A operacao continua salva.');
        }
        if (error.code === '42501') return outcome('rejected', '42501', 'Sua conta nao tem permissao para alterar esta estrutura.');
        if (['22023', '22P02', '23514', '55000'].includes(error.code)) {
          return outcome('rejected', error.code, 'O servidor recusou esta alteracao. Revise os dados ou a estrutura removida.');
        }
        return outcome('retry', 'remote_unavailable', 'Nao foi possivel confirmar o envio. A operacao continua salva para reenvio.');
      }
      const parsed = receiptSchema.safeParse(data);
      if (!parsed.success || parsed.data.operationId !== operation.id || parsed.data.revision !== operation.expectedRevision + 1) {
        return outcome('retry', 'invalid_receipt', 'A confirmacao recebida e invalida. O reenvio usara o mesmo ID.');
      }
      return { status: 'confirmed', receipt: parsed.data };
    } catch {
      signal.throwIfAborted();
      return outcome('retry', 'transport', 'A conexao falhou antes da confirmacao. A operacao continua salva.');
    }
  };
}
