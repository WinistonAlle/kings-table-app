import type { SupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';
import type { Database } from '../types/supabase';

export const tournamentSummarySchema = z.strictObject({
  id: z.uuid(), ownerId: z.uuid(), revision: z.number().int().positive().safe(),
  name: z.string().trim().min(1).max(120),
  format: z.enum(['deep', 'regular', 'turbo', 'hyper', 'rebuy', 'bounty']),
  status: z.enum(['upcoming', 'running', 'paused', 'finished', 'cancelled']),
  buyIn: z.number().positive().finite(),
  startTime: z.iso.datetime({ offset: true }).nullable(),
  updatedAt: z.iso.datetime({ offset: true }),
  deletedAt: z.iso.datetime({ offset: true }).nullable(),
});
export type TournamentSummary = z.infer<typeof tournamentSummarySchema>;

const rowSchema = z.strictObject({
  id: z.uuid(), created_by: z.uuid(), revision: z.number().int().positive().safe(),
  name: z.string().trim().min(1).max(120),
  format: z.enum(['deep', 'regular', 'turbo', 'hyper', 'rebuy', 'bounty']),
  status: z.enum(['upcoming', 'running', 'paused', 'finished', 'cancelled']),
  buy_in: z.number().positive().finite(),
  start_time: z.iso.datetime({ offset: true }).nullable(),
  updated_at: z.iso.datetime({ offset: true }),
  deleted_at: z.iso.datetime({ offset: true }).nullable(),
});

export class TournamentCatalogError extends Error {
  constructor(public readonly code: 'unavailable' | 'invalid_response') {
    super(code === 'unavailable' ? 'Nao foi possivel carregar suas mesas online.'
      : 'A lista de mesas online esta inconsistente. Os dados locais continuam salvos.');
  }
}

// Pages are not a server snapshot: a missing ID must never delete a cached table.
export function createTournamentCatalogReader(client: Pick<SupabaseClient<Database>, 'from'>,
  ownerId: string, pageSize = 200): (signal: AbortSignal) => Promise<TournamentSummary[]> {
  z.uuid().parse(ownerId);
  z.number().int().min(1).max(1000).parse(pageSize);
  return async signal => {
    const result: TournamentSummary[] = [];
    let cursor: string | null = null;
    while (true) {
      signal.throwIfAborted();
      let query = client.from('tournaments')
        .select('id,created_by,revision,name,format,status,buy_in,start_time,updated_at,deleted_at')
        .eq('created_by', ownerId).order('id', { ascending: true }).limit(pageSize);
      if (cursor) query = query.gt('id', cursor);
      let response;
      try { response = await query.abortSignal(signal); }
      catch { signal.throwIfAborted(); throw new TournamentCatalogError('unavailable'); }
      signal.throwIfAborted();
      if (response.error) throw new TournamentCatalogError('unavailable');
      try {
        const rows = z.array(rowSchema).max(pageSize).parse(response.data);
        if (!rows.length) return result;
        for (const row of rows) {
          const id = row.id.toLowerCase();
          if (row.created_by !== ownerId || (cursor && id <= cursor)) throw new Error('Invalid catalog page');
          result.push(tournamentSummarySchema.parse({ id, ownerId, revision: row.revision,
            name: row.name, format: row.format, status: row.status, buyIn: row.buy_in,
            startTime: row.start_time, updatedAt: row.updated_at, deletedAt: row.deleted_at }));
          cursor = id;
        }
      } catch { throw new TournamentCatalogError('invalid_response'); }
    }
  };
}
