import { View, Text, Pressable } from 'react-native';
import { useState } from 'react';
import { useAccount } from './AuthGate.web';
import { supabase } from '@/lib/supabase';

export function AccountDetails() {
  const user = useAccount();
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);
  if (!user) return null;
  return <View style={{ alignItems: 'center', gap: 10, marginVertical: 18 }}>
    <Text style={{ color: '#ebebea', fontSize: 18, fontWeight: '600' }}>{String(user.user_metadata.name || user.email)}</Text>
    <Text style={{ color: '#bab8b5', fontSize: 14 }}>{user.email}</Text>
    <Pressable accessibilityRole="button" disabled={pending} onPress={async () => {
      setPending(true); setError('');
      try {
        const { error: err } = await supabase.auth.signOut({ scope: 'local' });
        if (err) throw err;
      } catch { setError('Não foi possível sair. Tente novamente.'); }
      finally { setPending(false); }
    }} style={{ padding: 12 }}><Text style={{ color: '#d3b27e', fontWeight: '600' }}>{pending ? 'Saindo...' : 'Sair da conta'}</Text></Pressable>
    {!!error && <Text style={{ color: '#c85a5a' }}>{error}</Text>}
  </View>;
}
