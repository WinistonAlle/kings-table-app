import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { View, Text, Pressable, ActivityIndicator } from 'react-native';
import type { User } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import { loadAccountData } from '@/lib/account-storage';
import { PresetSyncProvider } from './PresetSync';
import { TournamentSyncProvider } from './TournamentSync';
import { waitForLocalSaves } from '@/lib/armazenamento';
import { AccessTimeoutError, waitForAccess } from '@/lib/access-deadline';
import { KTButton } from './ui/Button';

const Account = createContext<User | null>(null);
export const useAccount = () => useContext(Account);
const configuredSite = process.env.EXPO_PUBLIC_SITE_URL;
function siteUrl() {
  return window.location.pathname === '/app' || window.location.pathname.startsWith('/app/')
    ? window.location.origin : configuredSite;
}

export function AuthGate({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [preview, setPreview] = useState(false);
  const loadedAccount = useRef<string | null>(null);
  const stopSync = useRef<(() => void) | null>(null);
  const stopTournamentSync = useRef<(() => void) | null>(null);
  useEffect(() => {
    let alive = true;
    let verification = 0;
    let request = new AbortController();
    const fail = (reason: unknown) => setError(reason instanceof AccessTimeoutError
      ? 'A verificação demorou mais que o esperado. Confira sua conexão e tente novamente.'
      : 'Não foi possível verificar seu acesso.');
    const stopSessions = () => { stopSync.current?.(); stopTournamentSync.current?.(); };
    if (['localhost', '127.0.0.1'].includes(window.location.hostname)
      && (new URLSearchParams(window.location.search).get('teste') === '1' || sessionStorage.getItem('kt-test-access') === '1')) {
      sessionStorage.setItem('kt-test-access', '1');
      void waitForAccess(() => loadAccountData('preview-local'), request.signal)
        .then(() => { if (alive) setPreview(true); }).catch(reason => { if (alive) fail(reason); });
      return () => { alive = false; request.abort(); };
    }
    async function verify() {
      const current = ++verification;
      request.abort(); request = new AbortController();
      const signal = request.signal;
      try {
        const { data, error: authError } = await waitForAccess(async () => {
          const result = await supabase.auth.getUser();
          signal.throwIfAborted();
          if (!alive || current !== verification) throw new DOMException('Verification superseded', 'AbortError');
          if (result.data.user) {
            if (loadedAccount.current !== result.data.user.id) { stopSessions(); setUser(null); }
            await loadAccountData(result.data.user.id);
            signal.throwIfAborted();
          }
          return result;
        }, signal);
        if (!alive || current !== verification) return;
        if (!data.user) {
          stopSessions();
          setUser(null);
          if (authError && authError.status !== 401 && authError.status !== 403 && authError.name !== 'AuthSessionMissingError') { fail(authError); return; }
          if (siteUrl()) window.location.replace(`${siteUrl()}/login`);
          else fail(authError);
          return;
        }
        if (alive && current === verification) {
          loadedAccount.current = data.user.id;
          setUser(data.user);
          setError(null);
        }
      } catch (reason) { if (alive && current === verification) { request.abort(); stopSessions(); setUser(null); fail(reason); } }
    }
    void verify();
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT') {
        stopSessions();
        alive = false;
        ++verification;
        request.abort();
        loadedAccount.current = null;
        setUser(null);
        if (siteUrl()) window.location.replace(`${siteUrl()}/login`);
        return;
      }
      if (event === 'SIGNED_IN' && loadedAccount.current !== session?.user.id) {
        stopSessions();
        ++verification;
        loadedAccount.current = null;
        setUser(null);
      }
      setTimeout(() => { if (alive) void verify(); }, 0);
    });
    window.addEventListener('focus', verify);
    return () => { alive = false; request.abort(); stopSessions(); subscription.unsubscribe(); window.removeEventListener('focus', verify); };
  }, [attempt]);

  if (!user && !preview) return <View style={{ flex: 1, minHeight: '100%', backgroundColor: '#080808', alignItems: 'center', justifyContent: 'center', gap: 20, padding: 24 }}>
    <Text style={{ color: '#d3b27e', fontSize: 24, fontWeight: '700' }}>King’s Table</Text>
    {error ? <><Text accessibilityLiveRegion="polite" style={{ color: '#bab8b5', maxWidth: 360, textAlign: 'center', lineHeight: 24 }}>{error}</Text><KTButton label="Tentar novamente" style={{ alignSelf: 'center' }} onPress={() => { setError(null); setAttempt(value => value + 1); }} /></> : <ActivityIndicator color="#d3b27e" accessibilityLabel="Verificando acesso" />}
  </View>;
  return <Account.Provider value={user}>
    {preview ? <View style={{ flex: 1 }}>
      <View style={{ backgroundColor: '#181818', padding: 10, flexDirection: 'row', justifyContent: 'space-between', gap: 16 }}>
        <Text style={{ color: '#d3b27e', fontSize: 12 }}>Modo de teste · Dados locais</Text>
        <Pressable accessibilityRole="button" onPress={async () => {
          if (!await waitForLocalSaves()) { window.alert('Há alterações não salvas. Salve novamente antes de sair do teste.'); return; }
          sessionStorage.removeItem('kt-test-access');
          if (siteUrl()) window.location.replace(`${siteUrl()}/login`);
        }}><Text style={{ color: '#bab8b5', fontSize: 12 }}>Sair do teste</Text></Pressable>
      </View>
      {children}
    </View> : user ? <PresetSyncProvider key={user.id} ownerId={user.id} stopRef={stopSync}>
      <TournamentSyncProvider key={user.id} ownerId={user.id} stopRef={stopTournamentSync}>{children}</TournamentSyncProvider>
    </PresetSyncProvider> : children}
  </Account.Provider>;
}
