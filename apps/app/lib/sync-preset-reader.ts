import type { SupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';
import type { Database } from '../types/supabase';
import { presetBaseSchema, type PresetBase } from './sync-preset-model';

const rowSchema = z.strictObject({
  id: z.uuid(), owner_id: z.uuid(), name: z.string(), levels: z.unknown(),
  revision: z.number().int().nonnegative().safe(),
  deleted_at: z.iso.datetime({ offset: true }).nullable(), is_default: z.literal(false),
});
export class PresetReadError extends Error {
  constructor(public readonly code: 'unavailable' | 'invalid_response') {
    super(code === 'unavailable' ? 'Nao foi possivel carregar suas estruturas. Os dados locais continuam salvos.'
      : 'A resposta das estruturas e inconsistente. Os dados locais continuam salvos.');
  }
}

// Paged reads are not a server snapshot. Never infer deletion from an absent row.
export function createPresetReader(client: Pick<SupabaseClient<Database>, 'from'>, ownerId: string,
  pageSize = 200): (signal: AbortSignal) => Promise<PresetBase[]> {
  z.uuid().parse(ownerId);
  z.number().int().min(1).max(1000).parse(pageSize);
  return async signal => {
    const result: PresetBase[] = [];
    let cursor: string | null = null;
    while (true) {
      signal.throwIfAborted();
      let query = client.from('blind_structures')
        .select('id,owner_id,name,levels,revision,deleted_at,is_default')
        .eq('owner_id', ownerId).eq('is_default', false).order('id', { ascending: true }).limit(pageSize);
      if (cursor) query = query.gt('id', cursor);
      let response;
      try { response = await query.abortSignal(signal); }
      catch { signal.throwIfAborted(); throw new PresetReadError('unavailable'); }
      signal.throwIfAborted();
      if (response.error) throw new PresetReadError('unavailable');
      try {
        const rows = z.array(rowSchema).max(pageSize).parse(response.data);
        if (!rows.length) return result;
        for (const row of rows) {
          const id = row.id.toLowerCase();
          if (row.owner_id !== ownerId || (cursor && id <= cursor)) throw new Error('Invalid page scope/order');
          result.push(presetBaseSchema.parse({ ownerId, id, revision: row.revision,
            deleted: row.deleted_at !== null, payload: { name: row.name, levels: row.levels } }));
          cursor = id;
        }
      } catch { throw new PresetReadError('invalid_response'); }
      // A server max_rows below pageSize can return a short page: continue until empty.
    }
  };
}
