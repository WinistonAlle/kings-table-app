import { View, StyleSheet, useWindowDimensions } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Space } from '@/constants/tokens';
import { KTText } from '@/components/ui/Text';
import { KTButton } from '@/components/ui/Button';

export function MesasHeader({ title }: { title: string }) {
  const compact = useWindowDimensions().width < 600;
  return <View style={[styles.header, compact && styles.compact]}>
    <View>
      <KTText papel="rotulo" color={Colors.text1}>King's Table</KTText>
      <KTText papel="titulo" style={{ letterSpacing: 0 }}>{title}</KTText>
    </View>
    <KTButton label="Criar mesa" fullWidth={compact} onPress={() => router.push('/tournament/create')}
      icone={<Ionicons name="add" size={22} color={Colors.bg0} />} />
  </View>;
}

const styles = StyleSheet.create({
  header: { width: '100%', maxWidth: 760, alignSelf: 'center', paddingHorizontal: Space.xl, paddingTop: Space.lg, paddingBottom: Space.lg, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: Space.lg },
  compact: { flexDirection: 'column', alignItems: 'stretch', gap: Space.md },
});
