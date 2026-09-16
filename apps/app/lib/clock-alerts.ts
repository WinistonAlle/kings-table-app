export interface AlertClock { tournamentId: string | null; currentLevel: number; secondsRemaining: number; isRunning: boolean }
export function clockAlert(previous: AlertClock, next: AlertClock): 'level' | 'minute' | 'end' | null {
  if (!next.tournamentId || previous.tournamentId !== next.tournamentId || !previous.isRunning) return null;
  if (next.currentLevel > previous.currentLevel) return 'level';
  if (next.currentLevel !== previous.currentLevel) return null;
  if (previous.secondsRemaining > 0 && next.secondsRemaining === 0) return 'end';
  if (next.isRunning && previous.secondsRemaining > 60 && next.secondsRemaining <= 60 && next.secondsRemaining > 0) return 'minute';
  return null;
}
