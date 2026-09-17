import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { View, Text, Pressable, ActivityIndicator } from 'react-native';
import type { User } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import { loadAccountData } from '@/lib/account-storage';
import { PresetSyncProvider } from './PresetSync';

const Account = createContext<User | null>(null);
export const useAccount = () => useContext(Account);
const site = process.env.EXPO_PUBLIC_SITE_URL;

export function AuthGate({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [preview, setPreview] = useState(false);
  const loadedAccount = useRef<string | null>(null);
  const stopSync = useRef<(() => void) | null>(null);
  useEffect(() => {
    let alive = true;
    let verification = 0;
    if (process.env.NODE_ENV !== 'production' && ['localhost', '127.0.0.1'].includes(window.location.hostname)
      && (new URLSearchParams(window.location.search).get('teste') === '1' || sessionStorage.getItem('kt-test-access') === '1')) {
      sessionStorage.setItem('kt-test-access', '1');
      void loadAccountData('preview-local').then(() => { if (alive) setPreview(true); }).catch(() => { if (alive) setError(true); });
      return () => { alive = false; };
    }
    async function verify() {
      const current = ++verification;
      try {
        const { data, error: authError } = await supabase.auth.getUser();
        if (!alive || current !== verification) return;
        if (!data.user) {
          stopSync.current?.();
          setUser(null);
          if (authError && authError.status !== 401 && authError.status !== 403 && authError.name !== 'AuthSessionMissingError') { setError(true); return; }
          if (site) window.location.replace(`${site}/login`);
          else setError(true);
          return;
        }
        if (loadedAccount.current !== data.user.id) { stopSync.current?.(); setUser(null); }
        await loadAccountData(data.user.id);
        if (alive && current === verification) {
          loadedAccount.current = data.user.id;
          setUser(data.user);
          setError(false);
        }
      } catch { if (alive && current === verification) { stopSync.current?.(); setUser(null); setError(true); } }
    }
    void verify();
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT') {
        stopSync.current?.();
        alive = false;
        ++verification;
        loadedAccount.current = null;
        setUser(null);
        if (site) window.location.replace(`${site}/login`);
        return;
      }
      if (event === 'SIGNED_IN' && loadedAccount.current !== session?.user.id) {
        stopSync.current?.();
        ++verification;
        loadedAccount.current = null;
        setUser(null);
      }
      setTimeout(() => { if (alive) void verify(); }, 0);
    });
    window.addEventListener('focus', verify);
    return () => { alive = false; stopSync.current?.(); subscription.unsubscribe(); window.removeEventListener('focus', verify); };
  }, [attempt]);

  if (!user && !preview) return <View style={{ flex: 1, minHeight: '100%', backgroundColor: '#080808', alignItems: 'center', justifyContent: 'center', gap: 20 }}>
    <Text style={{ color: '#d3b27e', fontSize: 24, fontWeight: '700' }}>King’s Table</Text>
    {error ? <><Text style={{ color: '#bab8b5' }}>Não foi possível verificar seu acesso.</Text><Pressable onPress={() => { setError(false); setAttempt(attempt + 1); }}><Text style={{ color: '#d3b27e' }}>Tentar novamente</Text></Pressable></> : <ActivityIndicator color="#d3b27e" accessibilityLabel="Verificando acesso" />}
  </View>;
  return <Account.Provider value={user}>
    {preview ? <View style={{ flex: 1 }}>
      <View style={{ backgroundColor: '#181818', padding: 10, flexDirection: 'row', justifyContent: 'space-between', gap: 16 }}>
        <Text style={{ color: '#d3b27e', fontSize: 12 }}>Modo de teste · Dados locais</Text>
        <Pressable accessibilityRole="button" onPress={() => { sessionStorage.removeItem('kt-test-access'); window.location.replace(`${site}/login`); }}><Text style={{ color: '#bab8b5', fontSize: 12 }}>Sair do teste</Text></Pressable>
      </View>
      {children}
    </View> : user ? <PresetSyncProvider key={user.id} ownerId={user.id} stopRef={stopSync}>{children}</PresetSyncProvider> : children}
  </Account.Provider>;
}
