import type { MutableRefObject, ReactNode } from 'react';
import type { TournamentSyncValue } from './TournamentSync.web';

export function TournamentSyncProvider({ children }: { children: ReactNode; ownerId: string;
  stopRef: MutableRefObject<(() => void) | null> }) { return children; }
export function useTournamentSync(): TournamentSyncValue | null { return null; }
