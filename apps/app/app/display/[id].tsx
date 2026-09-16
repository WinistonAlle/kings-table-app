import { View, ScrollView, Pressable, StyleSheet, useWindowDimensions } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors, Space } from '@/constants/tokens';
import { KTText } from '@/components/ui/Text';
import { KTButton } from '@/components/ui/Button';
import { Anel } from '@/components/ui/Anel';
import { Naipe } from '@/components/ui/Ornamento';
import { useBlindsTimer } from '@/hooks/useBlindsTimer';
import { useFullscreen } from '@/hooks/useFullscreen';
import { useAwakeScreen } from '@/hooks/useAwakeScreen';
import { useTournamentStore } from '@/stores/tournamentStore';
import { distribuirPremios, entriesOf, prizePool } from '@/lib/payouts';
import type { BlindLevel } from '@/types';
import { ClockSound } from '@/components/ClockSound';

const money = (value: number) => value.toLocaleString('pt-BR', {
  style: 'currency', currency: 'BRL', maximumFractionDigits: 2,
});
const time = (seconds: number) => `${Math.floor(seconds / 60).toString().padStart(2, '0')}:${(seconds % 60).toString().padStart(2, '0')}`;
const number = (value: number) => value.toLocaleString('pt-BR');

export default function Display() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const tournament = useTournamentStore(s => s.tournaments.find(t => t.id === id));
  const clock = useBlindsTimer(id);
  const fullscreen = useFullscreen();
  useAwakeScreen('kingstable-display');
  const { width, height } = useWindowDimensions();
  const compact = width < 900;
  const ring = compact ? Math.min(width - 64, 340) : Math.min(height * 0.46, 440);

  const close = async () => {
    try { await fullscreen.exit(); } catch { /* Navigation remains available if the browser rejects fullscreen exit. */ }
    router.replace(`/blinds/${id}`);
  };

  if (!tournament) return (
    <SafeAreaView style={[styles.root, styles.empty]}>
      <KTText papel="titulo">Mesa não encontrada</KTText>
      <KTButton label="Voltar para mesas" onPress={() => router.replace('/history')} />
    </SafeAreaView>
  );

  const ready = clock.tournamentId === id;
  const current = ready ? clock.structure[clock.currentLevel] : undefined;
  const next = ready ? clock.structure[clock.currentLevel + 1] : undefined;
  const ended = tournament.status === 'finished' || tournament.status === 'cancelled';
  const done = ready && clock.secondsRemaining === 0 && !next;
  const remaining = tournament.players.filter(p => !p.position).length;
  const entries = tournament.players.reduce((sum, p) => sum + entriesOf(p), 0);
  const pool = prizePool(tournament);
  const payouts = distribuirPremios(pool, tournament.players.length);
  const color = ended ? Colors.text1 : clock.secondsRemaining <= 30 ? Colors.danger
    : clock.secondsRemaining <= 60 ? Colors.warn : tournament.color ?? Colors.gold200;
  const status = !ready ? 'Carregando relógio' : ended ? tournament.status === 'finished' ? 'Torneio encerrado' : 'Torneio cancelado'
    : done ? 'Estrutura concluída' : clock.handForHand ? 'Hand-for-hand · relógio congelado' : clock.isRunning ? current?.isBreak ? 'Intervalo' : 'Em andamento' : 'Relógio pausado';

  return (
    <SafeAreaView style={styles.root}>
      <StatusBar hidden />
      <ScrollView contentContainerStyle={[styles.content, compact && styles.compactContent]}>
        <View style={styles.header}>
          <View style={styles.identity}>
            <Naipe tipo={tournament.suit ?? 'espada'} tamanho={24} cor={tournament.color ?? Colors.gold300} />
            <View style={{ flex: 1 }}>
              <KTText papel="rotulo" color={Colors.text1}>King's Table</KTText>
              <KTText papel="subtitulo" numberOfLines={2}>{tournament.name}</KTText>
            </View>
          </View>
          <View style={styles.actions}>
            {fullscreen.supported && <IconButton label={fullscreen.active ? 'Sair da tela cheia' : 'Tela cheia'} icon={fullscreen.active ? 'contract' : 'expand'} onPress={fullscreen.toggle} />}
            <IconButton label="Voltar ao controle do relógio" icon="close" onPress={close} />
          </View>
        </View>
        {fullscreen.error && <KTText papel="apoio" color={Colors.warn} accessibilityRole="alert">{fullscreen.error}</KTText>}
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 16 }}>
          <ClockSound />
        </View>

        <View style={[styles.stage, compact && styles.compactStage]}>
          <View style={[styles.side, compact && styles.compactSide]}>
            <Level label="Agora" level={current} active />
          </View>
          <View style={styles.timer}>
            <KTText papel="corpoForte" color={ended || done ? Colors.text1 : clock.isRunning ? Colors.ok : Colors.warn}>{status}</KTText>
            <View style={{ width: ring, height: ring, alignItems: 'center', justifyContent: 'center' }}>
              <View style={StyleSheet.absoluteFill}>
                <Anel tamanho={ring} espessura={5} progresso={ready && current ? 1 - clock.secondsRemaining / (current.durationMinutes * 60) : 0} cor={color} />
              </View>
              <KTText papel="numeroForte" size={compact ? 64 : ring >= 400 ? 96 : 80} color={color} style={styles.clock} numberOfLines={1} adjustsFontSizeToFit>{ended ? '--:--' : ready ? time(clock.secondsRemaining) : '--:--'}</KTText>
              <KTText papel="corpo" color={Colors.text1}>{current?.isBreak ? 'Tempo de intervalo' : 'Tempo restante'}</KTText>
            </View>
          </View>
          <View style={[styles.side, compact && styles.compactSide]}>
            <Level label="A seguir" level={next} />
          </View>
        </View>

        <View style={styles.stats}>
          <Metric label="Jogadores" value={`${remaining} / ${tournament.players.length}`} />
          <Metric label="Entradas" value={String(entries)} />
          <Metric label="Buy-in" value={money(tournament.buyIn)} />
          <Metric label="Premiação total" value={money(pool)} highlight />
        </View>
        <View style={styles.payouts}>
          <KTText papel="rotulo" color={Colors.text1}>Premiação</KTText>
          <View style={styles.payoutRow}>
            {tournament.players.length === 0 ? <KTText color={Colors.text1}>Aguardando jogadores</KTText> : payouts.map(payout => (
              <View key={payout.place} style={styles.payout}>
                <KTText papel="corpoForte" color={Colors.gold300}>{payout.place}º</KTText>
                <KTText papel="numeroForte" size={compact ? 20 : 24}>{money(payout.amount)}</KTText>
              </View>
            ))}
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function IconButton({ label, icon, onPress }: { label: string; icon: 'close' | 'expand' | 'contract'; onPress: () => void }) {
  return <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} style={({ pressed }) => [styles.iconButton, pressed && { backgroundColor: Colors.bg3 }]}>
    <Ionicons name={icon} size={22} color={Colors.text1} />
  </Pressable>;
}

function Level({ label, level, active = false }: { label: string; level?: BlindLevel; active?: boolean }) {
  return <View style={styles.level}>
    <KTText papel="rotulo" color={Colors.text1}>{label}</KTText>
    <KTText papel="subtitulo" color={active ? Colors.text0 : Colors.text1}>{!level ? 'Fim da estrutura' : level.isBreak ? 'Intervalo' : `Nível ${level.level}`}</KTText>
    {level && <>
      <KTText papel="numeroForte" size={active ? 32 : 26} numberOfLines={1} adjustsFontSizeToFit color={active ? Colors.text0 : Colors.text1}>{level.isBreak ? `${level.durationMinutes} min` : `${number(level.smallBlind)} / ${number(level.bigBlind)}`}</KTText>
      {!level.isBreak && <KTText color={Colors.text1}>{level.ante ? `Ante ${number(level.ante)}` : 'Sem ante'}</KTText>}
    </>}
  </View>;
}

function Metric({ label, value, highlight = false }: { label: string; value: string; highlight?: boolean }) {
  return <View style={styles.metric}>
    <KTText papel="rotulo" color={Colors.text1}>{label}</KTText>
    <KTText papel="numeroForte" size={24} color={highlight ? Colors.gold200 : Colors.text0} numberOfLines={1} adjustsFontSizeToFit>{value}</KTText>
  </View>;
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.bg0 },
  empty: { alignItems: 'center', justifyContent: 'center', gap: Space.xl, padding: Space.xl },
  content: { flexGrow: 1, paddingHorizontal: Space.xxxl, paddingTop: Space.xl, paddingBottom: Space.xl, gap: Space.xl },
  compactContent: { paddingHorizontal: Space.lg },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: Space.lg },
  identity: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: Space.md },
  actions: { flexDirection: 'row', gap: Space.xs },
  iconButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 8 },
  stage: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Space.xl },
  compactStage: { flex: undefined, flexGrow: 0, flexShrink: 0, flexBasis: 'auto', flexDirection: 'column', gap: Space.xl },
  side: { flex: 1, minWidth: 0 },
  compactSide: { flex: undefined, flexGrow: 0, flexShrink: 0, flexBasis: 'auto', width: '100%' },
  level: { alignItems: 'center', gap: Space.sm },
  timer: { alignItems: 'center', gap: Space.md, flexShrink: 0 },
  clock: { letterSpacing: 0, textAlign: 'center', width: '84%' },
  stats: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', borderTopWidth: 1, borderBottomWidth: 1, borderColor: Colors.borderStrong, paddingVertical: Space.xl, gap: Space.xl },
  metric: { minWidth: 130, maxWidth: 300, flexGrow: 1, alignItems: 'center', gap: Space.sm },
  payouts: { alignItems: 'center', gap: Space.md },
  payoutRow: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: Space.xl },
  payout: { flexDirection: 'row', alignItems: 'center', gap: Space.sm },
});
