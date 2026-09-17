import { createContext, useContext, useEffect, useRef, useState, type ReactNode, type MutableRefObject } from 'react';
import type { BlindLevel } from '@/types';
import { supabase } from '@/lib/supabase';
import { SyncOutbox } from '@/lib/sync-outbox';
import { PresetSyncSession, type PresetSessionState } from '@/lib/sync-preset-session';
import { createPresetReader } from '@/lib/sync-preset-reader';
import { createPresetTransport } from '@/lib/sync-preset-transport';
import { novaIdentidade } from '@/lib/identidade';

export type PresetSyncValue = {
  state: PresetSessionState; available: boolean;
  save: (name: string, levels: BlindLevel[]) => Promise<void>;
  remove: (id: string) => Promise<void>; refresh: () => Promise<void>;
};
const Context = createContext<PresetSyncValue | null>(null);
export const usePresetSync = () => useContext(Context);
const initial: PresetSessionState = {phase:'idle',library:[],error:null};

export function PresetSyncProvider({children,ownerId,stopRef}:{children:ReactNode;ownerId:string;
  stopRef:MutableRefObject<(() => void)|null>}) {
  const enabled = process.env.EXPO_PUBLIC_PRESET_SYNC_ENABLED === '1';
  const [state,setState] = useState<PresetSessionState>(initial);
  const [available,setAvailable] = useState(false);
  const [attempt,setAttempt] = useState(0);
  const session = useRef<PresetSyncSession | null>(null);
  useEffect(() => {
    if (!enabled) return;
    let alive = true;
    setState(initial);setAvailable(false);
    let outbox: SyncOutbox;
    try {outbox=new SyncOutbox();}
    catch {setState({phase:'error',library:[],error:'local_storage'});return;}
    const controller = new PresetSyncSession(ownerId,outbox,createPresetReader(supabase,ownerId),
      createPresetTransport(supabase,ownerId),next => {if(alive){setState(next);if(next.phase==='ready')setAvailable(true);}});
    session.current = controller;
    const stop = () => {controller.stop();session.current=null;setAvailable(false);};
    stopRef.current = stop;
    // Both initial and event-driven requests share the account-bound coordinator.
    const refresh = () => { void controller.synchronize(true); };
    void controller.refreshLocal().then(() => {
      if(alive && session.current===controller){setAvailable(true);refresh();}
    }).catch(() => {if(alive)setAvailable(false);});
    window.addEventListener('online',refresh);
    window.addEventListener('focus',refresh);
    return () => {
      alive=false;controller.stop();session.current=null;
      if(stopRef.current===stop)stopRef.current=null;
      window.removeEventListener('online',refresh);window.removeEventListener('focus',refresh);
      // synchronize resolves after abort; closing earlier could interrupt a local transaction.
      void controller.waitForIdle().then(() => outbox.close()).catch(() => undefined);
    };
  },[enabled,ownerId,stopRef,attempt]);
  if(!enabled)return children;
  const active = () => {
    if(!session.current || !available)throw new Error('A biblioteca ainda nao esta pronta. Tente novamente.');
    return session.current;
  };
  return <Context.Provider value={{state,available,
    save:async(name,levels)=>{const current=active();await current.mutate(novaIdentidade(),{kind:'preset.save',payload:{name,levels}});void current.synchronize(true);},
    remove:async(id)=>{const current=active();await current.mutate(id,{kind:'preset.remove'});void current.synchronize(true);},
    refresh:async()=>{if(session.current)await session.current.synchronize(true);else setAttempt(value=>value+1);},
  }}>{children}</Context.Provider>;
}
