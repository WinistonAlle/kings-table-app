import type { SupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';
import type { Database } from '../types/supabase';
import { presetPayloadSchema } from './sync-preset-model';

const playerSchema = z.strictObject({
  id: z.uuid(), tournament_id: z.uuid(), user_id: z.uuid().nullable(),
  display_name: z.string().trim().min(1), buy_ins: z.number().int().nonnegative().safe(),
  re_entries: z.number().int().nonnegative().safe(), add_ons: z.number().int().nonnegative().safe(),
  position: z.number().int().positive().safe().nullable(), prize: z.number().nonnegative().finite().nullable(),
  payment_status: z.enum(['pending', 'confirmed', 'disputed']),
  financial_activity_recorded: z.boolean(), eliminated_at: z.iso.datetime({ offset: true }).nullable(),
  registered_at: z.iso.datetime({ offset: true }),
});
const tournamentSchema = z.strictObject({
  id: z.uuid(), created_by: z.uuid(), name: z.string().trim().min(1),
  format: z.enum(['deep', 'regular', 'turbo', 'hyper', 'rebuy', 'bounty']),
  status: z.enum(['upcoming', 'running', 'paused', 'finished', 'cancelled']),
  buy_in: z.number().positive().finite(), re_entry_allowed: z.boolean(),
  max_re_entries: z.number().int().nonnegative().safe(),
  start_time: z.iso.datetime({ offset: true }).nullable(),
  current_level: z.number().int().nonnegative().safe(),
  seconds_remaining: z.number().int().nonnegative().safe().nullable(),
  revision: z.number().int().positive().safe(),
  deleted_at: z.iso.datetime({ offset: true }).nullable(),
  updated_at: z.iso.datetime({ offset: true }),
  clock_ends_at: z.iso.datetime({ offset: true }).nullable(), clock_hand_for_hand: z.boolean(),
  blind_levels: z.unknown(),
  details: z.record(z.string(), z.json()),
});
export type TournamentSnapshot = { tournament: z.infer<typeof tournamentSchema>;
  players: z.infer<typeof playerSchema>[] };

export class TournamentReadError extends Error {
  constructor(public readonly code: 'unavailable' | 'invalid_response' | 'changed_during_read') {
    super(code === 'unavailable' ? 'Nao foi possivel carregar a mesa. Os dados locais continuam salvos.'
      : code === 'changed_during_read' ? 'A mesa mudou durante a leitura. Tente novamente.'
      : 'A resposta da mesa e inconsistente. Os dados locais continuam salvos.');
  }
}

export function createTournamentReader(client: Pick<SupabaseClient<Database>, 'from'>,
  ownerId: string, tableId: string, pageSize = 200): (signal: AbortSignal) => Promise<TournamentSnapshot | null> {
  z.uuid().parse(ownerId);
  z.uuid().parse(tableId);
  z.number().int().min(1).max(1000).parse(pageSize);
  return async signal => {
    const readTable = async () => {
      signal.throwIfAborted();
      let response;
      try {
        response = await client.from('tournaments')
          .select('id,created_by,name,format,status,buy_in,re_entry_allowed,max_re_entries,start_time,current_level,seconds_remaining,revision,deleted_at,updated_at,clock_ends_at,clock_hand_for_hand,blind_levels,details')
          .eq('id', tableId).eq('created_by', ownerId).abortSignal(signal).maybeSingle();
      } catch { signal.throwIfAborted(); throw new TournamentReadError('unavailable'); }
      signal.throwIfAborted();
      if (response.error) throw new TournamentReadError('unavailable');
      if (response.data === null) return null;
      try {
        const table = tournamentSchema.parse(response.data);
        if (table.id !== tableId || table.created_by !== ownerId) throw new Error('Wrong table scope');
        if (!table.deleted_at) presetPayloadSchema.parse({ name: table.name, levels: table.blind_levels });
        return table;
      } catch { throw new TournamentReadError('invalid_response'); }
    };

    for (let attempt = 0; attempt < 3; attempt++) {
      const tournament = await readTable();
      if (!tournament) return null; // Absence is not a deletion signal for the local store.
      const players: TournamentSnapshot['players'] = [];
      let cursor: string | null = null;
      while (true) {
        signal.throwIfAborted();
        let query = client.from('tournament_players')
          .select('id,tournament_id,user_id,display_name,buy_ins,re_entries,add_ons,position,prize,payment_status,financial_activity_recorded,eliminated_at,registered_at')
          .eq('tournament_id', tableId).order('id', { ascending: true }).limit(pageSize);
        if (cursor) query = query.gt('id', cursor);
        let response;
        try { response = await query.abortSignal(signal); }
        catch { signal.throwIfAborted(); throw new TournamentReadError('unavailable'); }
        signal.throwIfAborted();
        if (response.error) throw new TournamentReadError('unavailable');
        try {
          const rows = z.array(playerSchema).max(pageSize).parse(response.data);
          if (!rows.length) break;
          for (const row of rows) {
            const id = row.id.toLowerCase();
            if (row.tournament_id !== tableId || (cursor && id <= cursor)) throw new Error('Invalid player page');
            players.push(row);
            cursor = id;
          }
        } catch { throw new TournamentReadError('invalid_response'); }
      }
      const after = await readTable();
      if (after && after.revision === tournament.revision && after.updated_at === tournament.updated_at) {
        return { tournament: after, players };
      }
    }
    throw new TournamentReadError('changed_during_read');
  };
}

const clockSchema = z.strictObject({
  currentLevel: z.number().int().nonnegative().safe(),
  secondsRemaining: z.number().int().nonnegative().safe(),
  levelEndsAt: z.iso.datetime({ offset: true }).nullable(),
  isRunning: z.boolean(), handForHand: z.boolean(),
  revision: z.number().int().positive().safe(),
  serverNow: z.iso.datetime({ offset: true }),
}).refine(clock => clock.isRunning === (clock.levelEndsAt !== null)
  && !(clock.isRunning && clock.handForHand), 'Clock anchor is inconsistent');
export type TournamentClockSnapshot = z.infer<typeof clockSchema>;

export function createTournamentClockReader(client: Pick<SupabaseClient<Database>, 'rpc'>,
  tableId: string): (signal: AbortSignal) => Promise<TournamentClockSnapshot> {
  z.uuid().parse(tableId);
  return async signal => {
    signal.throwIfAborted();
    let response;
    try { response = await client.rpc('read_tournament_clock', { p_tournament_id: tableId }).abortSignal(signal); }
    catch { signal.throwIfAborted(); throw new TournamentReadError('unavailable'); }
    signal.throwIfAborted();
    if (response.error) throw new TournamentReadError('unavailable');
    const parsed = clockSchema.safeParse(response.data);
    if (!parsed.success) throw new TournamentReadError('invalid_response');
    return parsed.data;
  };
}
