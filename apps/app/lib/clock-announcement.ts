import type { BlindLevel } from '@/types';
import type { AlertClock } from './clock-alerts';

type ClockEvent = 'level' | 'minute' | 'end';

const number = (value: number) => value.toLocaleString('pt-BR');

export function clockAnnouncement(event: ClockEvent, clock: AlertClock, structure: BlindLevel[]): string | null {
  const current = structure[clock.currentLevel];
  if (!current) return null;
  if (event === 'minute') return current.isBreak
    ? 'Falta um minuto para o fim do intervalo.'
    : 'Falta um minuto para o próximo nível.';
  if (event === 'end') return 'A estrutura de blinds terminou.';
  if (current.isBreak) return `Intervalo de ${current.durationMinutes} minutos.`;
  return `Nível ${current.level}. Small blind ${number(current.smallBlind)}. Big blind ${number(current.bigBlind)}.${current.ante ? ` Ante ${number(current.ante)}.` : ''}`;
}
