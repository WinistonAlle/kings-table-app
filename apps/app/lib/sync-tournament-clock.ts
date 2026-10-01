import { z } from 'zod';
import { createOperation } from './sync-operation';
import { presetPayloadSchema } from './sync-preset-model';
import type { TournamentClockSnapshot, TournamentSnapshot } from './sync-tournament-reader';

const actionSchema = z.discriminatedUnion('kind', [
  z.strictObject({ kind: z.literal('startNight') }),
  z.strictObject({ kind: z.literal('resume') }),
  z.strictObject({ kind: z.literal('pause') }),
  z.strictObject({ kind: z.literal('reset') }),
  z.strictObject({ kind: z.literal('level'), level: z.number().int().nonnegative() }),
  z.strictObject({ kind: z.literal('hand'), enabled: z.boolean() }),
]);
export type AccountClockAction = z.infer<typeof actionSchema>;
export type ClockObservation = { clock: TournamentClockSnapshot; receivedAt: number; roundTripMs: number };

export function clockOperationLabel(operation: { kind: string; payload: Record<string, unknown> }): string | null {
  switch (operation.kind) {
    case 'tournament.start': return 'Iniciar noite';
    case 'clock.start': return 'Retomar relógio';
    case 'clock.pause': return 'Pausar relógio';
    case 'clock.reset': return 'Reiniciar relógio';
    case 'clock.level': return 'Alterar nível do relógio';
    case 'clock.handForHand': return operation.payload.enabled ? 'Congelar hand-for-hand' : 'Encerrar hand-for-hand';
    default: return null;
  }
}

export function clockLevels(snapshot: TournamentSnapshot) {
  return presetPayloadSchema.parse({ name: snapshot.tournament.name, levels: snapshot.tournament.blind_levels }).levels;
}

// Monotonic elapsed time avoids changing the display when the device wall clock changes.
export function observedClockSeconds(observation: ClockObservation, now: number): number {
  const { clock, receivedAt, roundTripMs } = observation;
  if (![receivedAt, roundTripMs, now].every(Number.isFinite) || roundTripMs < 0 || now < receivedAt) {
    throw new Error('Referencia de tempo invalida.');
  }
  if (!clock.isRunning) return clock.secondsRemaining;
  const left = Date.parse(clock.levelEndsAt!) - Date.parse(clock.serverNow)
    - roundTripMs / 2 - (now - receivedAt);
  return Math.max(0, Math.ceil(left / 1000));
}

export function clockMatchesSnapshot(snapshot: TournamentSnapshot, clock: TournamentClockSnapshot) {
  const levels = clockLevels(snapshot);
  return clock.revision === snapshot.tournament.revision && clock.currentLevel < levels.length
    && clock.secondsRemaining <= levels[clock.currentLevel].durationMinutes * 60
    && clock.handForHand === snapshot.tournament.clock_hand_for_hand
    && (!clock.isRunning || snapshot.tournament.status === 'running');
}

export function prepareClockOperation(snapshot: TournamentSnapshot, clock: TournamentClockSnapshot, input: AccountClockAction) {
  const action = actionSchema.parse(input);
  const table = snapshot.tournament;
  if (!clockMatchesSnapshot(snapshot, clock) || table.deleted_at) throw new Error('Atualize o relogio e os detalhes da mesa antes de alterar.');
  let kind: 'tournament.start' | 'clock.start' | 'clock.pause' | 'clock.reset' | 'clock.level' | 'clock.handForHand';
  let payload: Record<string, number | boolean> = {};
  if (action.kind === 'startNight') {
    if (table.status !== 'upcoming' || !snapshot.players.some(player => player.position === null)) {
      throw new Error('Adicione um jogador antes de iniciar esta mesa em preparacao.');
    }
    kind = 'tournament.start';
  } else {
    if (table.status !== 'running') throw new Error('O controle do relogio exige uma mesa em andamento.');
    switch (action.kind) {
      case 'resume':
        if (clock.isRunning || clock.handForHand || clock.secondsRemaining <= 0) throw new Error('O relogio nao pode ser retomado neste estado.');
        kind = 'clock.start'; break;
      case 'pause':
        if (!clock.isRunning) throw new Error('O relogio ja esta parado.');
        kind = 'clock.pause'; break;
      case 'reset': kind = 'clock.reset'; break;
      case 'level':
        if (action.level >= clockLevels(snapshot).length) throw new Error('Nivel fora da estrutura da mesa.');
        kind = 'clock.level'; payload = { level: action.level }; break;
      case 'hand':
        if (action.enabled === clock.handForHand) throw new Error('Este ja e o estado do hand-for-hand.');
        kind = 'clock.handForHand'; payload = { enabled: action.enabled }; break;
    }
  }
  return createOperation({ ownerId: table.created_by, entityId: table.id, entity: 'tournament',
    expectedRevision: table.revision, kind, payload });
}
