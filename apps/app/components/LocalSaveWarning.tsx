import { useEffect, useState, useSyncExternalStore } from 'react';
import { Platform, Pressable, StyleSheet, View } from 'react-native';
import { Colors, Space } from '@/constants/tokens';
import { KTText } from './ui/Text';
import {
  hasPendingLocalSaves, localSaveFailureCount, retryPendingLocalSaves, subscribeLocalSaveFailures,
} from '@/lib/armazenamento';

export function LocalSaveWarning() {
  const failed = useSyncExternalStore(subscribeLocalSaveFailures, localSaveFailureCount, () => 0);
  const [retrying, setRetrying] = useState(false);

  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const warn = (event: BeforeUnloadEvent) => {
      if (!hasPendingLocalSaves()) return;
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, []);

  if (failed === 0) return null;
  return <View style={styles.wrap} accessibilityRole="alert">
    <KTText papel="corpoForte" color={Colors.text0}>Alterações ainda não salvas</KTText>
    <KTText papel="apoio" color={Colors.text1}>
      O armazenamento deste aparelho falhou. Não feche esta página até conseguir salvar novamente.
    </KTText>
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Tentar salvar os dados locais novamente"
      disabled={retrying}
      onPress={async () => {
        setRetrying(true);
        try { await retryPendingLocalSaves(); } finally { setRetrying(false); }
      }}
      style={[styles.button, retrying && styles.disabled]}
    >
      <KTText papel="corpoForte" color={Colors.bg0}>{retrying ? 'Salvando...' : 'Tentar salvar novamente'}</KTText>
    </Pressable>
  </View>;
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute', bottom: Space.md, left: Space.md, right: Space.md,
    alignSelf: 'center', maxWidth: 560, padding: Space.lg, gap: Space.sm,
    backgroundColor: Colors.bg2, borderColor: Colors.danger, borderWidth: 1, borderRadius: 8,
    zIndex: 1000,
  },
  button: {
    minHeight: 44, alignSelf: 'flex-start', justifyContent: 'center',
    backgroundColor: Colors.gold200, paddingHorizontal: Space.lg, borderRadius: 8,
  },
  disabled: { opacity: 0.6 },
});
