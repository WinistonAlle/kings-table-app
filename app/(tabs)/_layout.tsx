import { Tabs } from 'expo-router';
import { View, StyleSheet, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BlurViewFallback } from '@/components/ui/Barra';
import { Colors, Fonts, Space } from '@/constants/tokens';

/* Barra de abas.
 *
 * Duas mudanças de fundo em relação à anterior. Os ícones passam a ser de
 * CONTORNO, não preenchidos: peso cheio em quatro ícones lado a lado brigava
 * com o conteúdo da tela, que é onde o olho deveria estar. E a aba ativa ganha
 * um losango minúsculo em cima do ícone, no lugar de só mudar de cor —
 * diferença de cor sozinha é frágil no escuro e desaparece em tela clara ao
 * sol, que é exatamente onde alguém abre o app na mesa.
 */

const ICONES = {
  index:   { on: 'home',    off: 'home-outline' },
  ranking: { on: 'trophy',  off: 'trophy-outline' },
  ai:      { on: 'sparkles', off: 'sparkles-outline' },
  profile: { on: 'person',  off: 'person-outline' },
} as const;

function Icone({ rota, focado }: { rota: keyof typeof ICONES; focado: boolean }) {
  return (
    <View style={styles.icone}>
      <View style={[styles.marca, focado && styles.marcaAtiva]} />
      <Ionicons
        name={(focado ? ICONES[rota].on : ICONES[rota].off) as never}
        size={21}
        color={focado ? Colors.gold200 : Colors.text2}
      />
    </View>
  );
}

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarBackground: () => <BlurViewFallback />,
        tabBarStyle: {
          position: 'absolute',
          backgroundColor: 'transparent',
          borderTopColor: Colors.border,
          borderTopWidth: StyleSheet.hairlineWidth,
          height: Platform.OS === 'ios' ? 88 : 68,
          paddingBottom: Platform.OS === 'ios' ? 30 : 10,
          paddingTop: Space.md,
          elevation: 0,
        },
        tabBarActiveTintColor: Colors.gold200,
        tabBarInactiveTintColor: Colors.text2,
        tabBarLabelStyle: {
          fontFamily: Fonts.uiMedium,
          fontSize: 10,
          letterSpacing: 0.6,
          marginTop: 2,
        },
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'Mesa', tabBarIcon: ({ focused }) => <Icone rota="index" focado={focused} /> }} />
      <Tabs.Screen name="ranking" options={{ title: 'Liga', tabBarIcon: ({ focused }) => <Icone rota="ranking" focado={focused} /> }} />
      <Tabs.Screen name="ai" options={{ title: 'Rainha', tabBarIcon: ({ focused }) => <Icone rota="ai" focado={focused} /> }} />
      <Tabs.Screen name="profile" options={{ title: 'Perfil', tabBarIcon: ({ focused }) => <Icone rota="profile" focado={focused} /> }} />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  icone: { alignItems: 'center', justifyContent: 'center', gap: 4 },
  marca: {
    width: 5, height: 5, borderRadius: 1,
    transform: [{ rotate: '45deg' }],
    backgroundColor: 'transparent',
  },
  marcaAtiva: { backgroundColor: Colors.gold300 },
});
