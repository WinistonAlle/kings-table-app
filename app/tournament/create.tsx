import { useState } from 'react';
import { ScrollView, View, TextInput, TouchableOpacity, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Fonts, Radius } from '@/constants/tokens';
import { KTText } from '@/components/ui/Text';
import { KTCard } from '@/components/ui/Card';
import { KTButton } from '@/components/ui/Button';
import { useTournamentStore } from '@/stores/tournamentStore';
import { useBlindsStore, BLIND_PRESETS } from '@/stores/blindsStore';
import { TournamentFormat } from '@/types';

const STEPS = ['Básico', 'Formato', 'Blinds', 'Jogadores'];
const FORMATS: { id: TournamentFormat; label: string; desc: string }[] = [
  { id: 'deep',    label: 'Deep Stack', desc: '30 min/nível, ação mais lenta' },
  { id: 'regular', label: 'Regular',    desc: '20 min/nível, padrão' },
  { id: 'turbo',   label: 'Turbo',      desc: '10 min/nível, ação rápida' },
  { id: 'hyper',   label: 'Hyper Turbo',desc: '5 min/nível, super rápido' },
  { id: 'rebuy',   label: 'Rebuy',      desc: 'Com reentradas ilimitadas' },
  { id: 'bounty',  label: 'Bounty',     desc: 'Com prêmio por eliminação' },
];

export default function CreateTournament() {
  const [step, setStep] = useState(0);
  const [name, setName] = useState('');
  const [buyIn, setBuyIn] = useState('100');
  const [format, setFormat] = useState<TournamentFormat>('regular');
  const [reEntry, setReEntry] = useState(false);

  const { createTournament, setActive } = useTournamentStore();
  const { setStructure } = useBlindsStore();

  const canNext = [
    name.trim().length >= 2,
    true,
    true,
    true,
  ][step];

  const handleCreate = () => {
    const structure = BLIND_PRESETS[format] ?? BLIND_PRESETS.regular;
    setStructure(structure);
    const t = createTournament({
      name: name.trim(),
      format,
      buyIn: parseFloat(buyIn) || 100,
      reEntryAllowed: reEntry,
      maxReEntries: reEntry ? 2 : 0,
      startTime: new Date().toISOString(),
      blindStructure: structure,
      createdBy: 'local',
    });
    setActive(t.id);
    router.replace(`/blinds/${t.id}`);
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="close" size={24} color={Colors.text1} />
        </TouchableOpacity>
        <KTText variant="uiSemiBold" size={16} color={Colors.text0}>Novo Torneio</KTText>
        <View style={{ width: 24 }} />
      </View>

      {/* Step indicator */}
      <View style={styles.steps}>
        {STEPS.map((s, i) => (
          <View key={i} style={styles.stepItem}>
            <View style={[styles.stepDot, i <= step && styles.stepDotActive]}>
              {i < step
                ? <Ionicons name="checkmark" size={12} color="#1a1206" />
                : <KTText variant="monoBold" size={11} color={i === step ? '#1a1206' : Colors.text3}>{i + 1}</KTText>
              }
            </View>
            {i < STEPS.length - 1 && (
              <View style={[styles.stepLine, i < step && styles.stepLineActive]} />
            )}
          </View>
        ))}
      </View>
      <View style={styles.stepLabels}>
        {STEPS.map((s, i) => (
          <KTText key={i} variant="label" size={9} color={i === step ? Colors.gold300 : Colors.text3} style={{ flex: 1, textAlign: 'center' }}>
            {s}
          </KTText>
        ))}
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
        {/* Step 0: Basic info */}
        {step === 0 && (
          <View style={styles.stepContent}>
            <KTText variant="display" size={28} color={Colors.gold200} style={{ marginBottom: 4 }}>
              Qual o nome?
            </KTText>
            <KTText variant="ui" size={14} color={Colors.text2} style={{ marginBottom: 28 }}>
              Dê um nome ao seu torneio
            </KTText>
            <TextInput
              style={styles.input}
              placeholder="Ex: Liga do Rei — Edição #12"
              placeholderTextColor={Colors.text3}
              value={name}
              onChangeText={setName}
              autoFocus
              returnKeyType="next"
              onSubmitEditing={() => name.trim().length >= 2 && setStep(1)}
            />
            <View style={styles.inputRow}>
              <View style={{ flex: 1 }}>
                <KTText variant="label" color={Colors.text2} style={{ marginBottom: 8 }}>BUY-IN (R$)</KTText>
                <TextInput
                  style={styles.input}
                  placeholder="100"
                  placeholderTextColor={Colors.text3}
                  value={buyIn}
                  onChangeText={setBuyIn}
                  keyboardType="numeric"
                />
              </View>
              <View style={{ flex: 1 }}>
                <KTText variant="label" color={Colors.text2} style={{ marginBottom: 8 }}>REENTRADA</KTText>
                <TouchableOpacity
                  style={[styles.toggle, reEntry && styles.toggleActive]}
                  onPress={() => setReEntry(!reEntry)}
                >
                  <KTText variant="uiMedium" size={14} color={reEntry ? '#1a1206' : Colors.text2}>
                    {reEntry ? 'Sim' : 'Não'}
                  </KTText>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        )}

        {/* Step 1: Format */}
        {step === 1 && (
          <View style={styles.stepContent}>
            <KTText variant="display" size={28} color={Colors.gold200} style={{ marginBottom: 4 }}>
              Formato
            </KTText>
            <KTText variant="ui" size={14} color={Colors.text2} style={{ marginBottom: 24 }}>
              Escolha a estrutura do torneio
            </KTText>
            {FORMATS.map(f => (
              <TouchableOpacity key={f.id} onPress={() => setFormat(f.id)}>
                <KTCard
                  level={format === f.id ? 3 : 2}
                  borderHot={format === f.id}
                  style={styles.formatCard}
                >
                  <View style={styles.formatRow}>
                    <View style={{ flex: 1 }}>
                      <KTText variant="uiSemiBold" size={15} color={format === f.id ? Colors.gold200 : Colors.text0}>
                        {f.label}
                      </KTText>
                      <KTText variant="ui" size={12} color={Colors.text2} style={{ marginTop: 2 }}>
                        {f.desc}
                      </KTText>
                    </View>
                    {format === f.id && (
                      <Ionicons name="checkmark-circle" size={22} color={Colors.gold300} />
                    )}
                  </View>
                </KTCard>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* Step 2: Blind structure preview */}
        {step === 2 && (
          <View style={styles.stepContent}>
            <KTText variant="display" size={28} color={Colors.gold200} style={{ marginBottom: 4 }}>
              Estrutura de Blinds
            </KTText>
            <KTText variant="ui" size={14} color={Colors.text2} style={{ marginBottom: 24 }}>
              Estrutura {format} — {BLIND_PRESETS[format]?.[0]?.durationMinutes} min/nível
            </KTText>
            <View style={styles.blindsTable}>
              <View style={[styles.blindRow, styles.blindHeader]}>
                <KTText variant="label" color={Colors.text2} style={{ flex: 1 }}>NÍV.</KTText>
                <KTText variant="label" color={Colors.text2} style={{ flex: 2 }}>SB / BB</KTText>
                <KTText variant="label" color={Colors.text2} style={{ flex: 1 }}>ANTE</KTText>
                <KTText variant="label" color={Colors.text2} style={{ flex: 1 }}>MIN</KTText>
              </View>
              {(BLIND_PRESETS[format] ?? BLIND_PRESETS.regular).slice(0, 10).map((l: import('@/types').BlindLevel, i: number) => (
                <View key={i} style={[styles.blindRow, i % 2 === 0 && styles.blindRowAlt]}>
                  <KTText variant="mono" size={13} color={Colors.text1} style={{ flex: 1 }}>{l.level}</KTText>
                  <KTText variant="mono" size={13} color={Colors.text0} style={{ flex: 2 }}>
                    {l.smallBlind}/{l.bigBlind}
                  </KTText>
                  <KTText variant="mono" size={13} color={l.ante > 0 ? Colors.warn : Colors.text3} style={{ flex: 1 }}>
                    {l.ante || '—'}
                  </KTText>
                  <KTText variant="mono" size={13} color={Colors.text2} style={{ flex: 1 }}>
                    {l.durationMinutes}
                  </KTText>
                </View>
              ))}
            </View>
            <KTText variant="ui" size={12} color={Colors.text3} style={{ marginTop: 12 }}>
              +{Math.max(0, (BLIND_PRESETS[format]?.length ?? 15) - 10)} níveis adicionais
            </KTText>
          </View>
        )}

        {/* Step 3: Ready to start */}
        {step === 3 && (
          <View style={[styles.stepContent, { alignItems: 'center' }]}>
            <KTText variant="display" size={64} style={{ marginBottom: 8 }}>♠</KTText>
            <KTText variant="display" size={28} color={Colors.gold200} style={{ textAlign: 'center', marginBottom: 8 }}>
              Pronto para jogar
            </KTText>
            <KTText variant="ui" size={14} color={Colors.text2} style={{ textAlign: 'center', marginBottom: 32 }}>
              {name} · {format} · R$ {buyIn} buy-in
            </KTText>
            <KTButton label="Iniciar torneio" onPress={handleCreate} size="lg" />
            <KTText variant="ui" size={12} color={Colors.text3} style={{ marginTop: 16, textAlign: 'center' }}>
              Você pode adicionar jogadores depois de iniciar
            </KTText>
          </View>
        )}
      </ScrollView>

      {/* Footer navigation */}
      <View style={styles.footer}>
        {step > 0 && (
          <KTButton label="Voltar" variant="ghost" onPress={() => setStep(s => s - 1)} />
        )}
        <KTButton
          label={step === STEPS.length - 1 ? 'Criar' : 'Próximo'}
          onPress={step === STEPS.length - 1 ? handleCreate : () => setStep(s => s + 1)}
          disabled={!canNext}
          style={{ flex: 1 }}
          fullWidth
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.bg0 },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingVertical: 16,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  steps: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 32, paddingTop: 24,
  },
  stepItem: { flex: 1, flexDirection: 'row', alignItems: 'center' },
  stepDot: {
    width: 24, height: 24, borderRadius: 12,
    backgroundColor: Colors.bg3, borderWidth: 1, borderColor: Colors.borderStrong,
    alignItems: 'center', justifyContent: 'center',
  },
  stepDotActive: { backgroundColor: Colors.gold200, borderColor: Colors.gold200 },
  stepLine: { flex: 1, height: 1, backgroundColor: Colors.border, marginHorizontal: 4 },
  stepLineActive: { backgroundColor: Colors.gold500 },
  stepLabels: { flexDirection: 'row', paddingHorizontal: 20, paddingTop: 6, paddingBottom: 16 },

  scroll: { flex: 1 },
  content: { padding: 24, paddingBottom: 8 },
  stepContent: {},

  input: {
    backgroundColor: Colors.bg3,
    borderWidth: 1, borderColor: Colors.borderStrong,
    borderRadius: Radius.sm,
    paddingHorizontal: 16, paddingVertical: 14,
    fontFamily: Fonts.ui, fontSize: 16, color: Colors.text0,
    marginBottom: 16,
  },
  inputRow: { flexDirection: 'row', gap: 12 },
  toggle: {
    backgroundColor: Colors.bg3,
    borderWidth: 1, borderColor: Colors.borderStrong,
    borderRadius: Radius.sm,
    paddingHorizontal: 16, paddingVertical: 14,
    alignItems: 'center',
  },
  toggleActive: { backgroundColor: Colors.gold200, borderColor: Colors.gold200 },

  formatCard: { marginBottom: 10 },
  formatRow: { flexDirection: 'row', alignItems: 'center' },

  blindsTable: {
    backgroundColor: Colors.bg2, borderRadius: Radius.sm,
    borderWidth: 1, borderColor: Colors.border, overflow: 'hidden',
  },
  blindHeader: { backgroundColor: Colors.bg3, paddingVertical: 10 },
  blindRow: { flexDirection: 'row', paddingHorizontal: 16, paddingVertical: 9 },
  blindRowAlt: { backgroundColor: 'rgba(255,255,255,0.02)' },

  footer: {
    flexDirection: 'row', gap: 12, padding: 20,
    borderTopWidth: 1, borderTopColor: Colors.border,
  },
});
