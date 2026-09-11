import { useMemo, useState } from 'react';
import {
  ScrollView,
  View,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Fonts, Radius } from '@/constants/tokens';
import { KTText } from '@/components/ui/Text';
import { KTCard } from '@/components/ui/Card';
import { KTButton } from '@/components/ui/Button';
import { useTournamentStore } from '@/stores/tournamentStore';
import { distribuirPremios, entriesOf, payoutLabel, prizePool } from '@/lib/payouts';
import type { TournamentPlayer } from '@/types';

type ProofState = 'idle' | 'analyzing' | 'done';

export default function TournamentDetailsScreen() {
  const params = useLocalSearchParams<{ id?: string }>();
  const tournamentId = typeof params.id === 'string' ? params.id : '';
  const { tournaments, addPlayer, updatePlayer, setActive, eliminatePlayer, undoElimination } =
    useTournamentStore();
  const [playerName, setPlayerName] = useState('');
  const [proofStates, setProofStates] = useState<Record<string, ProofState>>({});

  const tournament = tournaments.find((item) => item.id === tournamentId);

  const prizeSummary = useMemo(() => {
    if (!tournament) return null;
    const entries = tournament.players.reduce((sum, player) => sum + entriesOf(player), 0);
    const pool = prizePool(tournament);
    /* `distribuirPremios` e não `getPayouts`: é a distribuição COM a sobra de
       arredondamento resolvida, a mesma que o encerramento grava no jogador.
       Mostrar uma e pagar outra é como se paga um campeão diferente do que
       esteve escrito na tela a noite inteira. */
    const payouts = distribuirPremios(pool, tournament.players.length);
    const paidCount = tournament.players.filter((player) => player.paymentStatus === 'confirmed').length;
    return {
      entries,
      pool,
      payouts,
      paidCount,
      pendingCount: tournament.players.length - paidCount,
    };
  }, [tournament]);

  /* Ordem da lista: quem está de pé primeiro, na ordem em que sentou, e os
     eliminados embaixo já na ordem de classificação. No fim da noite a metade
     de baixo vira o resultado final, lido de cima pra baixo. */
  const ordenados = useMemo(() => {
    if (!tournament) return [];
    const vivos = tournament.players.filter((p) => !p.position);
    const caidos = tournament.players
      .filter((p) => p.position)
      .sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
    return [...vivos, ...caidos];
  }, [tournament]);

  const emPe = ordenados.filter((p) => !p.position).length;

  if (!tournament || !prizeSummary) {
    return (
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <View style={styles.missingWrap}>
          <KTText variant="display" size={28} color={Colors.gold200}>Torneio não encontrado</KTText>
          <KTText variant="ui" size={14} color={Colors.text2} style={{ marginTop: 8, textAlign: 'center' }}>
            Esse fluxo ainda usa dados locais. Se o app foi recarregado, o estado do torneio foi perdido.
          </KTText>
          <KTButton label="Voltar ao início" onPress={() => router.replace('/(tabs)')} style={{ marginTop: 20 }} />
        </View>
      </SafeAreaView>
    );
  }

  const handleAddPlayer = () => {
    const cleanName = playerName.trim();
    if (!cleanName) return;
    addPlayer(tournament.id, {
      userId: `guest_${Date.now()}`,
      name: cleanName,
      buyIns: 1,
      reEntries: 0,
      addOns: 0,
      paymentStatus: 'pending',
    });
    setPlayerName('');
  };

  const cyclePaymentStatus = (player: TournamentPlayer) => {
    const nextStatus = getNextPaymentStatus(player.paymentStatus);
    updatePlayer(tournament.id, player.id, { paymentStatus: nextStatus });
  };

  const updateEntryCount = (player: TournamentPlayer, field: 'reEntries' | 'addOns', delta: number) => {
    const nextValue = Math.max(0, player[field] + delta);
    updatePlayer(tournament.id, player.id, { [field]: nextValue });
  };

  const analyzeProof = (player: TournamentPlayer) => {
    setProofStates((current) => ({ ...current, [player.id]: 'analyzing' }));
    setTimeout(() => {
      updatePlayer(tournament.id, player.id, { paymentStatus: 'confirmed' });
      setProofStates((current) => ({ ...current, [player.id]: 'done' }));
    }, 1800);
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.iconBtn} onPress={() => router.back()}>
            <Ionicons name="chevron-back" size={18} color={Colors.text1} />
          </TouchableOpacity>

          <View style={{ flex: 1 }}>
            <KTText variant="label" color={Colors.text2}>Mesa</KTText>
            <KTText variant="display" size={28} color={Colors.gold200} style={{ marginTop: 4 }}>
              {tournament.name}
            </KTText>
          </View>

          <TouchableOpacity
            style={styles.iconBtn}
            onPress={() => {
              setActive(tournament.id);
              router.push(`/blinds/${tournament.id}` as any);
            }}
          >
            <Ionicons name="timer-outline" size={18} color={Colors.gold200} />
          </TouchableOpacity>
        </View>

        <KTCard level={2} borderHot style={styles.heroCard}>
          <View style={styles.heroTop}>
            <View>
              <KTText variant="label" color={Colors.text2}>Resumo</KTText>
              <KTText variant="uiSemiBold" size={18} color={Colors.text0} style={{ marginTop: 8 }}>
                {labelForFormat(tournament.format)}
              </KTText>
            </View>
            <View style={styles.statusPill}>
              <KTText variant="label" color={Colors.gold300}>{tournament.status}</KTText>
            </View>
          </View>

          <View style={styles.summaryGrid}>
            <SummaryCell label="Buy-in" value={formatMoney(tournament.buyIn)} sub="por entrada" />
            <SummaryCell label="Entradas" value={String(prizeSummary.entries)} sub={`${tournament.players.length} jogadores`} />
            <SummaryCell label="Prize pool" value={formatMoney(prizeSummary.pool)} sub={payoutLabel(prizeSummary.payouts.length)} />
            <SummaryCell label="Pagos" value={`${prizeSummary.paidCount}/${tournament.players.length}`} sub="buy-ins confirmados" />
            {/* Enquanto roda, o que interessa é quanta gente sobrou. Quando
                acaba, é quem ganhou. A mesma célula serve às duas perguntas,
                porque nunca são feitas ao mesmo tempo. */}
            {tournament.status === 'finished' ? (
              <SummaryCell
                label="Campeão"
                value={tournament.players.find((p) => p.position === 1)?.name.split(' ')[0] ?? '—'}
                sub={formatMoney(tournament.players.find((p) => p.position === 1)?.prize ?? 0)}
              />
            ) : (
              <SummaryCell
                label="De pé"
                value={`${emPe}/${tournament.players.length}`}
                sub={emPe <= 1 ? 'aguardando o fim' : 'ainda na mesa'}
              />
            )}
          </View>
        </KTCard>

        <KTText variant="label" color={Colors.text2} style={styles.sectionTitle}>Jogadores</KTText>
        <KTCard level={2} style={styles.inputCard}>
          <KTText variant="ui" size={13} color={Colors.text2} style={{ marginBottom: 12 }}>
            Cadastre quem entrou na mesa. O app usa isso para prize pool e confirmação de pagamento.
          </KTText>
          <View style={styles.addRow}>
            <TextInput
              style={styles.input}
              placeholder="Nome do jogador"
              placeholderTextColor={Colors.text3}
              value={playerName}
              onChangeText={setPlayerName}
              returnKeyType="done"
              onSubmitEditing={handleAddPlayer}
            />
            <KTButton label="Adicionar" onPress={handleAddPlayer} size="sm" />
          </View>
        </KTCard>

        {tournament.players.length === 0 ? (
          <KTCard level={2} style={styles.emptyCard}>
            <KTText variant="display" size={36}>♣</KTText>
            <KTText variant="uiMedium" size={16} color={Colors.text1} style={{ marginTop: 10 }}>
              Nenhum jogador registrado
            </KTText>
            <KTText variant="ui" size={13} color={Colors.text2} style={{ marginTop: 6, textAlign: 'center' }}>
              O próximo passo natural do fluxo é preencher a lista da mesa para liberar prize pool e pagamentos.
            </KTText>
          </KTCard>
        ) : (
          <View style={{ gap: 12 }}>
            {ordenados.map((player, index) => {
              const proofState = proofStates[player.id] ?? 'idle';
              return (
                <KTCard key={player.id} level={2} style={styles.playerCard}>
                  <View style={styles.playerTop}>
                    <View style={styles.playerIdentity}>
                      <View style={[styles.playerIndex, player.position ? styles.playerIndexOut : null]}>
                        <KTText
                          variant="monoBold"
                          size={12}
                          color={player.position ? Colors.text2 : Colors.gold300}
                        >
                          {player.position ? `${player.position}º` : index + 1}
                        </KTText>
                      </View>
                      <View>
                        <KTText variant="uiSemiBold" size={16} color={Colors.text0}>{player.name}</KTText>
                        <KTText variant="ui" size={12} color={Colors.text2} style={{ marginTop: 2 }}>
                          {entryLabel(player)} · {paymentLabel(player.paymentStatus)}
                        </KTText>
                      </View>
                    </View>

                    <TouchableOpacity style={statusBadgeStyle(player.paymentStatus)} onPress={() => cyclePaymentStatus(player)}>
                      <KTText variant="label" color={statusTextColor(player.paymentStatus)}>
                        {player.paymentStatus}
                      </KTText>
                    </TouchableOpacity>
                  </View>

                  <View style={styles.counterRow}>
                    <CounterChip
                      label="Reentrada"
                      value={player.reEntries}
                      onMinus={() => updateEntryCount(player, 'reEntries', -1)}
                      onPlus={() => updateEntryCount(player, 'reEntries', 1)}
                    />
                    <CounterChip
                      label="Add-on"
                      value={player.addOns}
                      onMinus={() => updateEntryCount(player, 'addOns', -1)}
                      onPlus={() => updateEntryCount(player, 'addOns', 1)}
                    />
                  </View>

                  {/* Eliminar / desfazer. É o que faz a noite andar: cada
                      queda registrada define uma posição, e a última fecha o
                      torneio e distribui os prêmios sozinha. */}
                  <View style={styles.outRow}>
                    {player.position ? (
                      <>
                        <View style={{ flex: 1 }}>
                          <KTText variant="uiSemiBold" size={13} color={Colors.text1}>
                            {player.position}º lugar
                          </KTText>
                          <KTText variant="ui" size={12} color={Colors.text2} style={{ marginTop: 2 }}>
                            {player.prize ? `Prêmio ${formatMoney(player.prize)}` : 'Fora do ITM'}
                          </KTText>
                        </View>
                        <TouchableOpacity
                          style={styles.undoBtn}
                          onPress={() => undoElimination(tournament.id, player.id)}
                        >
                          <KTText variant="uiSemiBold" size={13} color={Colors.text1}>Desfazer</KTText>
                        </TouchableOpacity>
                      </>
                    ) : (
                      <>
                        <KTText variant="ui" size={12} color={Colors.text2} style={{ flex: 1 }}>
                          {emPe <= 1
                            ? 'Último de pé. O torneio fecha quando o penúltimo cair.'
                            : `Cai agora em ${emPe}º lugar`}
                        </KTText>
                        <TouchableOpacity
                          style={[styles.outBtn, emPe <= 1 && { opacity: 0.35 }]}
                          disabled={emPe <= 1}
                          onPress={() => eliminatePlayer(tournament.id, player.id)}
                        >
                          <KTText variant="uiSemiBold" size={13} color={Colors.red}>Eliminar</KTText>
                        </TouchableOpacity>
                      </>
                    )}
                  </View>

                  <View style={styles.analysisRow}>
                    <View style={{ flex: 1 }}>
                      <KTText variant="label" color={Colors.text2}>Leitura IA</KTText>
                      <KTText variant="ui" size={12} color={Colors.text2} style={{ marginTop: 4 }}>
                        {proofState === 'done'
                          ? 'Valor e identidade conferem com o buy-in.'
                          : proofState === 'analyzing'
                            ? 'Extraindo valor, data e destinatário do comprovante.'
                            : 'Fluxo simulado pronto para conectar ao upload de comprovante.'}
                      </KTText>
                    </View>

                    <TouchableOpacity
                      style={[styles.analysisBtn, proofState === 'done' && styles.analysisBtnDone]}
                      onPress={() => analyzeProof(player)}
                      disabled={proofState === 'analyzing'}
                    >
                      {proofState === 'analyzing' ? (
                        <ActivityIndicator size="small" color={Colors.gold200} />
                      ) : (
                        <KTText variant="uiSemiBold" size={13} color={proofState === 'done' ? '#102015' : Colors.gold200}>
                          {proofState === 'done' ? 'Confirmado' : 'Analisar'}
                        </KTText>
                      )}
                    </TouchableOpacity>
                  </View>
                </KTCard>
              );
            })}
          </View>
        )}

        <KTText variant="label" color={Colors.text2} style={styles.sectionTitle}>Premiação</KTText>
        <KTCard level={2} style={styles.prizeCard}>
          <View style={styles.prizeHeader}>
            <View>
              <KTText variant="uiSemiBold" size={16} color={Colors.text0}>Distribuição sugerida</KTText>
              <KTText variant="ui" size={12} color={Colors.text2} style={{ marginTop: 4 }}>
                Cálculo local baseado no número de jogadores cadastrados e no buy-in atual.
              </KTText>
            </View>
            <View style={styles.prizePoolPill}>
              <KTText variant="monoBold" size={14} color={Colors.gold200}>{formatMoney(prizeSummary.pool)}</KTText>
            </View>
          </View>

          <View style={{ gap: 10, marginTop: 18 }}>
            {prizeSummary.payouts.map((payout) => (
              <View key={payout.place} style={styles.payoutRow}>
                <View style={styles.placeBadge}>
                  <KTText variant="monoBold" size={12} color={Colors.gold300}>{payout.place}º</KTText>
                </View>
                <View style={{ flex: 1 }}>
                  <KTText variant="uiMedium" size={15} color={Colors.text0}>{formatMoney(payout.amount)}</KTText>
                  <KTText variant="ui" size={12} color={Colors.text2} style={{ marginTop: 2 }}>
                    {payout.percent}% do prize pool
                  </KTText>
                </View>
              </View>
            ))}
          </View>
        </KTCard>
      </ScrollView>
    </SafeAreaView>
  );
}

function SummaryCell({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <View style={styles.summaryCell}>
      <KTText variant="label" color={Colors.text2}>{label}</KTText>
      <KTText variant="display" size={24} color={Colors.gold200} style={{ marginTop: 8 }}>
        {value}
      </KTText>
      <KTText variant="ui" size={11} color={Colors.text2} style={{ marginTop: 4 }}>
        {sub}
      </KTText>
    </View>
  );
}

function CounterChip({
  label,
  value,
  onMinus,
  onPlus,
}: {
  label: string;
  value: number;
  onMinus: () => void;
  onPlus: () => void;
}) {
  return (
    <View style={styles.counterChip}>
      <KTText variant="label" color={Colors.text2}>{label}</KTText>
      <View style={styles.counterControls}>
        <TouchableOpacity style={styles.counterBtn} onPress={onMinus}>
          <Ionicons name="remove" size={14} color={Colors.text1} />
        </TouchableOpacity>
        <KTText variant="monoBold" size={18} color={Colors.text0}>{value}</KTText>
        <TouchableOpacity style={styles.counterBtn} onPress={onPlus}>
          <Ionicons name="add" size={14} color={Colors.text1} />
        </TouchableOpacity>
      </View>
    </View>
  );
}



function labelForFormat(format: string) {
  const labels: Record<string, string> = {
    deep: 'Deep Stack',
    regular: 'Regular',
    turbo: 'Turbo',
    hyper: 'Hyper Turbo',
    rebuy: 'Rebuy',
    bounty: 'Bounty',
  };
  return labels[format] ?? format;
}

function entryLabel(player: TournamentPlayer) {
  const totalEntries = player.buyIns + player.reEntries + player.addOns;
  return `${totalEntries} entrada${totalEntries > 1 ? 's' : ''}`;
}

function paymentLabel(status: TournamentPlayer['paymentStatus']) {
  const labels = {
    pending: 'pagamento pendente',
    confirmed: 'pagamento confirmado',
    disputed: 'pagamento contestado',
  };
  return labels[status];
}

function getNextPaymentStatus(status: TournamentPlayer['paymentStatus']): TournamentPlayer['paymentStatus'] {
  const order: TournamentPlayer['paymentStatus'][] = ['pending', 'confirmed', 'disputed'];
  return order[(order.indexOf(status) + 1) % order.length];
}

function statusTextColor(status: TournamentPlayer['paymentStatus']) {
  if (status === 'confirmed') return '#102015';
  if (status === 'disputed') return Colors.danger;
  return Colors.gold300;
}

function statusBadgeStyle(status: TournamentPlayer['paymentStatus']) {
  return [
    styles.statusBadge,
    status === 'confirmed' && styles.statusBadgeConfirmed,
    status === 'disputed' && styles.statusBadgeDisputed,
  ];
}

function formatMoney(value: number) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    maximumFractionDigits: 0,
  }).format(value);
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.bg0 },
  content: { padding: 20, paddingBottom: 40 },
  missingWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
    backgroundColor: Colors.bg0,
  },
  header: { flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 20 },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.bg2,
    borderWidth: 1,
    borderColor: Colors.borderStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroCard: { marginBottom: 24 },
  heroTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  statusPill: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: Radius.full,
    backgroundColor: Colors.gold800,
    borderWidth: 1,
    borderColor: Colors.borderStrong,
  },
  summaryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 18 },
  summaryCell: {
    width: '47%',
    backgroundColor: Colors.bg3,
    borderRadius: Radius.sm,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 14,
  },
  sectionTitle: { marginBottom: 12 },
  inputCard: { marginBottom: 12 },
  addRow: { flexDirection: 'row', gap: 10, alignItems: 'center' },
  input: {
    flex: 1,
    minHeight: 46,
    backgroundColor: Colors.bg3,
    borderWidth: 1,
    borderColor: Colors.borderStrong,
    borderRadius: Radius.full,
    paddingHorizontal: 16,
    fontFamily: Fonts.ui,
    fontSize: 15,
    color: Colors.text0,
  },
  emptyCard: { alignItems: 'center', paddingVertical: 30, marginBottom: 24 },
  playerCard: { marginBottom: 0 },
  playerTop: { flexDirection: 'row', justifyContent: 'space-between', gap: 12 },
  playerIdentity: { flexDirection: 'row', gap: 12, flex: 1 },
  playerIndex: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: Colors.bg3,
    alignItems: 'center',
    justifyContent: 'center',
  },
  playerIndexOut: { backgroundColor: 'transparent', borderWidth: 1, borderColor: Colors.border },
  /* A linha de eliminação fica separada por um filete: ela é a única ação do
     card que muda o resultado do torneio, e não pode ficar no meio dos
     contadores de reentrada, onde o dedo passa o tempo todo. */
  outRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    gap: 12, marginTop: 12, paddingTop: 12,
    borderTopWidth: 1, borderTopColor: Colors.border,
  },
  outBtn: {
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: Radius.full,
    borderWidth: 1, borderColor: 'rgba(200, 90, 90, 0.35)',
  },
  undoBtn: {
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: Radius.full,
    borderWidth: 1, borderColor: Colors.border,
  },
  statusBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: Radius.full,
    backgroundColor: Colors.gold800,
    borderWidth: 1,
    borderColor: Colors.borderStrong,
  },
  statusBadgeConfirmed: {
    backgroundColor: Colors.ok,
    borderColor: Colors.ok,
  },
  statusBadgeDisputed: {
    backgroundColor: 'transparent',
    borderColor: Colors.danger,
  },
  counterRow: { flexDirection: 'row', gap: 10, marginTop: 16 },
  counterChip: {
    flex: 1,
    backgroundColor: Colors.bg3,
    borderRadius: Radius.sm,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 12,
  },
  counterControls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 10,
  },
  counterBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: Colors.bg2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  analysisRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 16,
    alignItems: 'center',
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  analysisBtn: {
    minWidth: 104,
    minHeight: 40,
    paddingHorizontal: 14,
    borderRadius: Radius.full,
    borderWidth: 1,
    borderColor: Colors.borderStrong,
    backgroundColor: Colors.bg3,
    alignItems: 'center',
    justifyContent: 'center',
  },
  analysisBtnDone: {
    backgroundColor: Colors.ok,
    borderColor: Colors.ok,
  },
  prizeCard: { marginBottom: 24 },
  prizeHeader: { flexDirection: 'row', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start' },
  prizePoolPill: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: Radius.full,
    backgroundColor: Colors.gold800,
    borderWidth: 1,
    borderColor: Colors.borderStrong,
  },
  payoutRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: Colors.bg3,
    borderRadius: Radius.sm,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 12,
  },
  placeBadge: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.bg2,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
