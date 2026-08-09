import { ScrollView, View, TouchableOpacity, StyleSheet, Dimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Fonts, Radius } from '@/constants/tokens';
import { KTText } from '@/components/ui/Text';
import { KTCard } from '@/components/ui/Card';
import { KTButton } from '@/components/ui/Button';
import { useTournamentStore } from '@/stores/tournamentStore';
import { useBlindsStore } from '@/stores/blindsStore';

const { width } = Dimensions.get('window');

export default function Dashboard() {
  const { tournaments, activeTournamentId, setActive } = useTournamentStore();
  const { currentLevel, secondsRemaining, isRunning, structure } = useBlindsStore();

  const activeTournament = tournaments.find((t) => t.id === activeTournamentId);
  const upcomingTournaments = tournaments.filter((t) => t.status === 'upcoming');

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60).toString().padStart(2, '0');
    const s = (secs % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  const currentBlind = structure[currentLevel];

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>

        {/* Header */}
        <View style={styles.header}>
          <View>
            <KTText variant="display" size={32} color={Colors.gold200}>King's Table</KTText>
            <KTText variant="ui" size={13} color={Colors.text2} style={{ marginTop: 2 }}>
              Bem-vindo de volta
            </KTText>
          </View>
          <TouchableOpacity
            onPress={() => router.push('/tournament/create')}
            style={styles.newBtn}
          >
            <Ionicons name="add" size={22} color={Colors.gold200} />
          </TouchableOpacity>
        </View>

        {/* Active tournament + blinds clock card */}
        {activeTournament ? (
          <TouchableOpacity onPress={() => router.push(`/blinds/${activeTournament.id}`)}>
            <KTCard level={2} borderHot style={styles.activeCard}>
              <View style={styles.activeHeader}>
                <View style={styles.liveBadge}>
                  <View style={[styles.liveDot, isRunning && styles.liveDotPulsing]} />
                  <KTText variant="label" color={isRunning ? Colors.ok : Colors.text2}>
                    {isRunning ? 'AO VIVO' : 'PAUSADO'}
                  </KTText>
                </View>
                <KTText variant="label" color={Colors.text2}>
                  {activeTournament.name}
                </KTText>
              </View>

              {/* Timer display */}
              <View style={styles.timerRow}>
                <KTText variant="monoBold" size={72} color={Colors.text0} style={styles.timerText}>
                  {formatTime(secondsRemaining)}
                </KTText>
              </View>

              {/* Level info */}
              <View style={styles.blindsRow}>
                <View style={styles.blindStat}>
                  <KTText variant="label" color={Colors.text2}>NÍVEL</KTText>
                  <KTText variant="monoMedium" size={20} color={Colors.gold200}>
                    {currentLevel + 1}
                  </KTText>
                </View>
                <View style={styles.blindDivider} />
                <View style={styles.blindStat}>
                  <KTText variant="label" color={Colors.text2}>SMALL BLIND</KTText>
                  <KTText variant="monoMedium" size={20} color={Colors.text0}>
                    {currentBlind?.smallBlind?.toLocaleString() ?? '—'}
                  </KTText>
                </View>
                <View style={styles.blindDivider} />
                <View style={styles.blindStat}>
                  <KTText variant="label" color={Colors.text2}>BIG BLIND</KTText>
                  <KTText variant="monoMedium" size={20} color={Colors.text0}>
                    {currentBlind?.bigBlind?.toLocaleString() ?? '—'}
                  </KTText>
                </View>
                {currentBlind?.ante > 0 && (
                  <>
                    <View style={styles.blindDivider} />
                    <View style={styles.blindStat}>
                      <KTText variant="label" color={Colors.text2}>ANTE</KTText>
                      <KTText variant="monoMedium" size={20} color={Colors.warn}>
                        {currentBlind.ante.toLocaleString()}
                      </KTText>
                    </View>
                  </>
                )}
              </View>

              <KTText variant="label" color={Colors.gold400} style={{ marginTop: 12, textAlign: 'center' }}>
                TOQUE PARA ABRIR O RELÓGIO ↗
              </KTText>
            </KTCard>
          </TouchableOpacity>
        ) : (
          /* Empty state — no active tournament */
          <KTCard level={2} style={styles.emptyCard}>
            <KTText variant="display" size={40} style={{ textAlign: 'center' }}>♠</KTText>
            <KTText variant="uiMedium" size={16} color={Colors.text1} style={{ textAlign: 'center', marginTop: 8 }}>
              Nenhum torneio ativo
            </KTText>
            <KTText variant="ui" size={13} color={Colors.text2} style={{ textAlign: 'center', marginTop: 4 }}>
              Crie um torneio para começar a jogar
            </KTText>
            <KTButton
              label="Criar torneio"
              onPress={() => router.push('/tournament/create')}
              style={{ marginTop: 20, alignSelf: 'center' }}
            />
          </KTCard>
        )}

        {/* Quick actions */}
        <KTText variant="label" color={Colors.text2} style={styles.sectionLabel}>
          AÇÕES RÁPIDAS
        </KTText>
        <View style={styles.quickGrid}>
          {QUICK_ACTIONS.map(action => (
            <TouchableOpacity
              key={action.id}
              style={styles.quickBtn}
              onPress={() => router.push(action.route as any)}
            >
              <KTCard level={3} padding={16} style={styles.quickCard}>
                <Ionicons name={action.icon as any} size={24} color={Colors.gold300} />
                <KTText variant="uiMedium" size={13} color={Colors.text1} style={{ marginTop: 8 }}>
                  {action.label}
                </KTText>
              </KTCard>
            </TouchableOpacity>
          ))}
        </View>

        {/* Upcoming tournaments */}
        {upcomingTournaments.length > 0 && (
          <>
            <KTText variant="label" color={Colors.text2} style={styles.sectionLabel}>
              PRÓXIMOS TORNEIOS
            </KTText>
            {upcomingTournaments.map((t) => (
              <TouchableOpacity
                key={t.id}
                onPress={() => {
                  setActive(t.id);
                  router.push(`/tournament/${t.id}` as any);
                }}
              >
                <KTCard level={2} style={styles.tournamentRow}>
                  <View style={styles.tournamentInfo}>
                    <KTText variant="uiSemiBold" size={15} color={Colors.text0}>{t.name}</KTText>
                    <KTText variant="ui" size={12} color={Colors.text2} style={{ marginTop: 2 }}>
                      Buy-in: R$ {t.buyIn} · {t.players.length} jogadores
                    </KTText>
                  </View>
                  <View style={styles.formatBadge}>
                    <KTText variant="label" color={Colors.gold400}>{t.format.toUpperCase()}</KTText>
                  </View>
                </KTCard>
              </TouchableOpacity>
            ))}
          </>
        )}

        {activeTournament && (
          <>
            <KTText variant="label" color={Colors.text2} style={styles.sectionLabel}>
              OPERAÇÃO DA MESA
            </KTText>
            <KTButton
              label="Gerenciar jogadores, premiação e pagamentos"
              variant="ghost"
              fullWidth
              onPress={() => router.push(`/tournament/${activeTournament.id}` as any)}
            />
          </>
        )}

        <View style={{ height: 32 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const QUICK_ACTIONS = [
  { id: 'create', label: 'Novo torneio',  icon: 'add-circle-outline',  route: '/tournament/create' },
  { id: 'ranking', label: 'Ranking',      icon: 'trophy-outline',       route: '/(tabs)/ranking' },
  { id: 'ai',      label: 'Chat IA',      icon: 'sparkles-outline',     route: '/(tabs)/ai' },
  { id: 'study',   label: 'Estudar',      icon: 'book-outline',         route: '/(tabs)/ai' },
];

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.bg0 },
  scroll: { flex: 1 },
  content: { padding: 20 },

  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 },
  newBtn: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: Colors.bg2,
    borderWidth: 1, borderColor: Colors.borderStrong,
    alignItems: 'center', justifyContent: 'center',
  },

  activeCard: { marginBottom: 24 },
  activeHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  liveBadge: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  liveDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: Colors.text2 },
  liveDotPulsing: { backgroundColor: Colors.ok },

  timerRow: { alignItems: 'center', paddingVertical: 8 },
  timerText: { letterSpacing: -2 },

  blindsRow: { flexDirection: 'row', justifyContent: 'center', gap: 8, flexWrap: 'wrap' },
  blindStat: { alignItems: 'center', gap: 4 },
  blindDivider: { width: 1, backgroundColor: Colors.border, alignSelf: 'stretch', marginHorizontal: 4 },

  emptyCard: { alignItems: 'center', paddingVertical: 40, marginBottom: 24 },

  sectionLabel: { marginBottom: 12 },

  quickGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 28 },
  quickBtn: { width: (width - 52) / 2 },
  quickCard: { gap: 0 },

  tournamentRow: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between', marginBottom: 10,
  },
  tournamentInfo: { flex: 1 },
  formatBadge: {
    paddingHorizontal: 10, paddingVertical: 4,
    backgroundColor: Colors.gold800,
    borderRadius: Radius.xs,
    borderWidth: 1, borderColor: Colors.borderStrong,
  },
});
