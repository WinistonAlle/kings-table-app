import { ScrollView, View, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors, Radius } from '@/constants/tokens';
import { KTText } from '@/components/ui/Text';
import { KTCard } from '@/components/ui/Card';

const MOCK_STANDINGS = [
  { rank: 1, name: 'Rafael M.',  points: 1240, wins: 4, played: 8,  avatar: '♠' },
  { rank: 2, name: 'Bruno K.',   points: 1180, wins: 3, played: 9,  avatar: '♥' },
  { rank: 3, name: 'Lucas P.',   points: 990,  wins: 2, played: 7,  avatar: '♦' },
  { rank: 4, name: 'Ana C.',     points: 870,  wins: 1, played: 6,  avatar: '♣' },
  { rank: 5, name: 'Felipe A.',  points: 720,  wins: 1, played: 8,  avatar: '♠' },
  { rank: 6, name: 'Thiago R.',  points: 640,  wins: 0, played: 5,  avatar: '♥' },
  { rank: 7, name: 'Mariana S.', points: 520,  wins: 0, played: 4,  avatar: '♦' },
  { rank: 8, name: 'Diego F.',   points: 410,  wins: 0, played: 6,  avatar: '♣' },
];

const RANK_COLORS: Record<number, string> = {
  1: Colors.gold200,
  2: '#c0c0c0',
  3: '#cd7f32',
};

export default function Ranking() {
  const top3 = MOCK_STANDINGS.slice(0, 3);
  const rest = MOCK_STANDINGS.slice(3);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content}>
        <KTText variant="display" size={28} color={Colors.gold200} style={{ marginBottom: 4 }}>Ranking</KTText>
        <KTText variant="ui" size={13} color={Colors.text2} style={{ marginBottom: 28 }}>Liga do Rei · Temporada 2026</KTText>

        {/* Podium */}
        <View style={styles.podium}>
          {[top3[1], top3[0], top3[2]].map((p, i) => {
            const heights = [100, 130, 80];
            const ranks = [2, 1, 3];
            const rank = ranks[i];
            return (
              <View key={p.rank} style={[styles.podiumCol, { height: heights[i] + 60 }]}>
                <KTText variant="display" size={28}>{p.avatar}</KTText>
                <KTText variant="uiSemiBold" size={13} color={RANK_COLORS[rank] ?? Colors.text1} style={{ textAlign: 'center', marginTop: 4 }}>
                  {p.name.split(' ')[0]}
                </KTText>
                <KTText variant="monoBold" size={16} color={RANK_COLORS[rank] ?? Colors.text1}>
                  {p.points}
                </KTText>
                <View style={[styles.podiumBlock, { height: heights[i], backgroundColor: rank === 1 ? Colors.gold700 : Colors.bg3 }]}>
                  <KTText variant="monoBold" size={20} color={RANK_COLORS[rank] ?? Colors.text2}>
                    {rank}
                  </KTText>
                </View>
              </View>
            );
          })}
        </View>

        {/* Rest of standings */}
        <View style={{ gap: 8 }}>
          {rest.map(p => (
            <KTCard key={p.rank} level={2} style={styles.row}>
              <KTText variant="monoMedium" size={15} color={Colors.text2} style={{ width: 28 }}>
                {p.rank}
              </KTText>
              <KTText variant="display" size={22} style={{ width: 32 }}>{p.avatar}</KTText>
              <View style={{ flex: 1 }}>
                <KTText variant="uiMedium" size={15} color={Colors.text0}>{p.name}</KTText>
                <KTText variant="ui" size={12} color={Colors.text2}>
                  {p.played} torneios · {p.wins} {p.wins === 1 ? 'vitória' : 'vitórias'}
                </KTText>
              </View>
              <KTText variant="monoBold" size={16} color={Colors.gold300}>{p.points}</KTText>
            </KTCard>
          ))}
        </View>

        <View style={{ height: 32 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.bg0 },
  content: { padding: 20 },
  podium: {
    flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'center',
    gap: 8, marginBottom: 32,
  },
  podiumCol: { flex: 1, alignItems: 'center', justifyContent: 'flex-end', gap: 0 },
  podiumBlock: {
    width: '100%', borderTopLeftRadius: Radius.sm, borderTopRightRadius: Radius.sm,
    alignItems: 'center', justifyContent: 'center',
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
});
