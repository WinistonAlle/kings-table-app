import { createContext, useContext, useEffect, useRef, useState, type MutableRefObject, type ReactNode } from 'react';
import { supabase } from '@/lib/supabase';
import { SyncOutbox } from '@/lib/sync-outbox';
import { TournamentSyncSession, type TournamentSessionState } from '@/lib/sync-tournament-session';
import { createTournamentCatalogReader } from '@/lib/sync-tournament-catalog';
import { createTournamentReader, type TournamentSnapshot } from '@/lib/sync-tournament-reader';
import { createTournamentTransport } from '@/lib/sync-tournament-transport';
import type { SyncOperation } from '@/lib/sync-operation';
import type { TournamentResolutionRequest } from '@/lib/sync-outbox';

export type TournamentSyncValue = {
  state: TournamentSessionState;
  refresh: () => Promise<void>;
  read: (id: string) => Promise<TournamentSnapshot | null>;
  cached: (id: string) => Promise<TournamentSnapshot | null>;
  send: (operation: SyncOperation) => Promise<void>;
  resolve: (id: string, request: TournamentResolutionRequest) => Promise<void>;
};
const Context = createContext<TournamentSyncValue | null>(null);
export const useTournamentSync = () => useContext(Context);
const initial: TournamentSessionState = { phase: 'idle', tables: [], pending: [], views: [], error: null };

export function TournamentSyncProvider({ children, ownerId, stopRef }: {
  children: ReactNode; ownerId: string; stopRef: MutableRefObject<(() => void) | null>;
}) {
  const enabled = process.env.EXPO_PUBLIC_TOURNAMENT_SYNC_ENABLED === '1';
  const [state, setState] = useState(initial);
  const [attempt, setAttempt] = useState(0);
  const session = useRef<TournamentSyncSession | null>(null);
  useEffect(() => {
    if (!enabled) return;
    let alive = true;
    setState(initial);
    let outbox: SyncOutbox;
    try { outbox = new SyncOutbox(); }
    catch { setState({ ...initial, phase: 'error', error: 'local_storage' }); return; }
    const controller = new TournamentSyncSession(ownerId, outbox,
      createTournamentCatalogReader(supabase, ownerId), createTournamentTransport(supabase, ownerId),
      next => { if (alive) setState(next); }, Date.now,
      (id, signal) => createTournamentReader(supabase, ownerId, id)(signal));
    session.current = controller;
    const stop = () => {
      controller.stop();
      if (session.current === controller) session.current = null;
    };
    stopRef.current = stop;
    const refresh = () => { void controller.synchronize(true); };
    refresh();
    window.addEventListener('online', refresh);
    window.addEventListener('focus', refresh);
    return () => {
      alive = false;
      stop();
      if (stopRef.current === stop) stopRef.current = null;
      window.removeEventListener('online', refresh);
      window.removeEventListener('focus', refresh);
      void controller.waitForIdle().then(() => outbox.close()).catch(() => undefined);
    };
  }, [enabled, ownerId, stopRef, attempt]);
  if (!enabled) return children;
  const active = () => {
    if (!session.current) throw new Error('A consulta das mesas ainda nao esta pronta. Tente novamente.');
    return session.current;
  };
  return <Context.Provider value={{ state,
    refresh: async () => {
      if (!session.current || state.error === 'local_storage') setAttempt(value => value + 1);
      else await session.current.synchronize(true);
    },
    read: id => active().refreshTournament(id),
    cached: id => active().cachedTournament(id),
    send: async operation => {
      const controller = active();
      await controller.enqueue(operation);
      await controller.synchronize(true);
    },
    resolve: (id, request) => active().resolve(id, request),
  }}>{children}</Context.Provider>;
}
