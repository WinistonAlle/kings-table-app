import { ScrollView, View, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors, Radius } from '@/constants/tokens';
import { KTText } from '@/components/ui/Text';
import { KTCard } from '@/components/ui/Card';
import { KTButton } from '@/components/ui/Button';

export default function Profile() {
  const stats = [
    { label: 'TORNEIOS', value: '14' },
    { label: 'VITÓRIAS',  value: '3'  },
    { label: 'ITM',       value: '7'  },
    { label: 'ROI',       value: '+42%' },
  ];

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content}>
        {/* Avatar + name */}
        <View style={styles.profileHeader}>
          <View style={styles.avatar}>
            <KTText variant="display" size={36}>♠</KTText>
          </View>
          <KTText variant="display" size={26} color={Colors.gold200} style={{ marginTop: 12 }}>
            Jogador
          </KTText>
          <KTText variant="ui" size={13} color={Colors.text2} style={{ marginTop: 2 }}>
            Membro desde Jan 2026
          </KTText>

          {/* XP + level */}
          <View style={styles.xpRow}>
            <KTText variant="label" color={Colors.gold400}>NÍVEL 5</KTText>
            <KTText variant="label" color={Colors.text2}>· 500 / 800 XP</KTText>
          </View>
          <View style={styles.xpTrack}>
            <View style={[styles.xpFill, { width: '62%' }]} />
          </View>
        </View>

        {/* Stats row */}
        <View style={styles.statsRow}>
          {stats.map(s => (
            <View key={s.label} style={styles.statBox}>
              <KTText variant="monoBold" size={22} color={Colors.text0}>{s.value}</KTText>
              <KTText variant="label" color={Colors.text2} style={{ marginTop: 2 }}>{s.label}</KTText>
            </View>
          ))}
        </View>

        {/* Streak */}
        <KTCard level={2} style={styles.streakCard}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <View>
              <KTText variant="label" color={Colors.warn}>STREAK ATUAL 🔥</KTText>
              <KTText variant="monoBold" size={36} color={Colors.warn} style={{ marginTop: 4 }}>7 dias</KTText>
            </View>
            <KTText variant="display" size={48}>♛</KTText>
          </View>
        </KTCard>

        {/* Badges */}
        <KTText variant="label" color={Colors.text2} style={{ marginBottom: 12 }}>CONQUISTAS</KTText>
        <View style={styles.badges}>
          {BADGES.map(b => (
            <View key={b.id} style={[styles.badge, !b.unlocked && styles.badgeLocked]}>
              <KTText variant="display" size={24}>{b.icon}</KTText>
              <KTText variant="label" size={8} color={b.unlocked ? Colors.gold300 : Colors.text3} style={{ textAlign: 'center', marginTop: 4 }}>
                {b.name}
              </KTText>
            </View>
          ))}
        </View>

        {/* Login placeholder */}
        <View style={{ height: 24 }} />
        <KTButton label="Entrar / Criar conta" variant="ghost" fullWidth onPress={() => {}} />
        <KTText variant="ui" size={12} color={Colors.text3} style={{ textAlign: 'center', marginTop: 8 }}>
          Login com Google ou Apple em breve
        </KTText>

        <View style={{ height: 32 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const BADGES = [
  { id: 1, icon: '♛', name: 'PRIMEIRO WIN',   unlocked: true  },
  { id: 2, icon: '♠', name: 'SHARK',          unlocked: true  },
  { id: 3, icon: '🔥', name: '7-DAY STREAK',  unlocked: true  },
  { id: 4, icon: '♦', name: 'HIGH ROLLER',    unlocked: false },
  { id: 5, icon: '♣', name: 'KNOCKOUT KING',  unlocked: false },
  { id: 6, icon: '♥', name: 'RUNNER RUNNER',  unlocked: false },
];

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.bg0 },
  content: { padding: 20 },
  profileHeader: { alignItems: 'center', paddingBottom: 24 },
  avatar: {
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: Colors.gold800,
    borderWidth: 2, borderColor: Colors.gold500,
    alignItems: 'center', justifyContent: 'center',
  },
  xpRow: { flexDirection: 'row', gap: 6, marginTop: 12, marginBottom: 8 },
  xpTrack: {
    width: 200, height: 6, backgroundColor: Colors.bg3, borderRadius: 3,
  },
  xpFill: { height: '100%', backgroundColor: Colors.gold400, borderRadius: 3 },

  statsRow: {
    flexDirection: 'row', backgroundColor: Colors.bg2,
    borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.border,
    marginBottom: 20, overflow: 'hidden',
  },
  statBox: {
    flex: 1, alignItems: 'center', paddingVertical: 16,
    borderRightWidth: 1, borderRightColor: Colors.border,
  },

  streakCard: { marginBottom: 24 },

  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 24 },
  badge: {
    width: 72, height: 80, borderRadius: Radius.sm,
    backgroundColor: Colors.bg2, borderWidth: 1, borderColor: Colors.borderStrong,
    alignItems: 'center', justifyContent: 'center', padding: 8,
  },
  badgeLocked: { opacity: 0.35 },
});
