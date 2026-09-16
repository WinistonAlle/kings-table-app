import { z } from 'zod';
import { validarEstrutura } from './estrutura';

const count = z.number().int().nonnegative().safe();
const positive = z.number().int().positive().safe();
const money = z.number().nonnegative().max(1000000000);
const id = z.string().min(1).max(200);
const seat = z.object({ id, tableNumber: positive.optional(), seatNumber: positive.optional() });
const level = z.object({
  level: count, smallBlind: count, bigBlind: count, ante: count,
  durationMinutes: positive.max(240), isBreak: z.boolean().optional(),
});
const structure = z.array(level).max(500).refine(v => !validarEstrutura(v), 'Estrutura de blinds invalida');
const player = seat.extend({
  userId: z.string(), name: z.string().min(1), avatar: z.string().optional(),
  buyIns: count, reEntries: count, addOns: count, position: positive.optional(),
  prize: money.optional(), paymentStatus: z.enum(['pending', 'confirmed', 'disputed']),
  eliminatedAt: z.string().optional(),
}).passthrough();
const tournament = z.object({
  id, name: z.string().min(1), leagueId: id.optional(),
  format: z.enum(['deep', 'regular', 'turbo', 'hyper', 'rebuy', 'bounty']),
  status: z.enum(['upcoming', 'running', 'finished', 'cancelled']),
  buyIn: money, reEntryAllowed: z.boolean(), maxReEntries: count,
  startTime: z.string(), createdAt: z.string(), createdBy: z.string(),
  blindStructure: structure, currentLevel: count, players: z.array(player).max(10000),
  seatsPerTable: positive.optional(),
  seatUndo: z.object({ seatsPerTable: positive, players: z.array(seat) }).optional(),
  location: z.string().optional(), capacity: positive.optional(), color: z.string().optional(),
  suit: z.enum(['espada', 'copas', 'ouros', 'paus']).optional(),
  invitees: z.array(z.object({
    id, name: z.string(), status: z.enum(['confirmed', 'maybe', 'absent', 'waiting']),
    createdAt: z.string(), playerId: id.optional(),
  })).optional(),
  audit: z.array(z.object({
    id, at: z.string(), actor: z.string(), summary: z.string(),
    changes: z.array(z.object({ label: z.string(), before: z.string(), after: z.string() })),
  })).optional(),
}).passthrough();
const clock = z.object({
  structure: z.array(level).max(500), currentLevel: count,
  secondsRemaining: z.number().nonnegative(), levelEndsAt: z.number().nonnegative().nullable(),
  isRunning: z.boolean(),
});
const schema = z.object({
  version: z.literal(1), tournaments: z.array(tournament).max(10000),
  activeTournamentId: id.nullable(),
  presets: z.array(z.object({ id, name: z.string().min(1), levels: structure })).max(1000),
  blinds: clock.extend({ tournamentId: id.nullable(), clocks: z.record(id, clock) }),
}).superRefine((data, ctx) => {
  const issue = () => ctx.addIssue({ code: 'custom', message: 'Referencias ou relogios invalidos' });
  const unique = (items: { id: string }[]) => new Set(items.map(v => v.id)).size === items.length;
  if (!unique(data.tournaments) || !unique(data.presets)) issue();
  const ids = new Set(data.tournaments.map(t => t.id));
  if (data.activeTournamentId && !ids.has(data.activeTournamentId)) issue();
  for (const t of data.tournaments) {
    if (!unique(t.players) || t.currentLevel >= t.blindStructure.length) issue();
    if (t.invitees && (!unique(t.invitees) || t.invitees.some(i => i.playerId && !t.players.some(p => p.id === i.playerId)))) issue();
  }
  const validClock = (c: z.infer<typeof clock>, tournamentId: string | null) => {
    if (c.isRunning && (!tournamentId || c.levelEndsAt === null)) issue();
    if (tournamentId && !ids.has(tournamentId)) issue();
    if (c.structure.length && (validarEstrutura(c.structure) || c.currentLevel >= c.structure.length)) issue();
    if (!c.structure.length && (c.isRunning || c.currentLevel !== 0)) issue();
  };
  validClock(data.blinds, data.blinds.tournamentId);
  for (const [key, value] of Object.entries(data.blinds.clocks)) validClock(value, key);
});

export type AccountSnapshot = z.infer<typeof schema>;

export function parseBackup(value: unknown): AccountSnapshot {
  const result = schema.safeParse(value);
  if (!result.success) throw new Error('A copia online esta incompleta ou em um formato incompatível. Nenhum dado foi substituido.');
  if (new TextEncoder().encode(JSON.stringify(result.data)).length > 5 * 1024 * 1024) {
    throw new Error('A copia excede o limite de 5 MB.');
  }
  return result.data;
}
