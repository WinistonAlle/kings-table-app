import { View, TextInput, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Fonts, Radius } from '@/constants/tokens';
import { KTText } from './ui/Text';
import { KTButton } from './ui/Button';
import type { BlindLevel } from '@/types';

export function StructureEditor({ levels, onChange }: { levels: BlindLevel[]; onChange: (levels: BlindLevel[]) => void }) {
  const update = (i: number, key: keyof BlindLevel, value: string) => onChange(levels.map((n, index) => index === i ? { ...n, [key]: value === '' ? NaN : Number(value.replace(/\D/g, '')) } : n));
  const add = (isBreak: boolean) => {
    const last = [...levels].reverse().find(n => !n.isBreak);
    onChange([...levels, { level: 0, isBreak, smallBlind: isBreak ? 0 : (last?.smallBlind || 25) * 2, bigBlind: isBreak ? 0 : (last?.bigBlind || 50) * 2, ante: isBreak ? 0 : last?.ante || 0, durationMinutes: isBreak ? 10 : 20 }]);
  };
  return <View style={{ gap: 12 }}>
    {levels.map((n, i) => <View key={i} style={styles.row}>
      <View style={styles.top}><KTText papel="corpoForte" color={n.isBreak ? Colors.ok : Colors.gold200}>{n.isBreak ? 'Intervalo' : `Nível ${levels.slice(0, i + 1).filter(l => !l.isBreak).length}`}</KTText><View style={{ flexDirection: 'row', gap: 8 }}>
        <Pressable accessibilityRole="button" accessibilityLabel={`Mover linha ${i + 1} para cima`} disabled={i === 0} onPress={() => { const copy = [...levels]; [copy[i - 1], copy[i]] = [copy[i], copy[i - 1]]; onChange(copy); }} style={styles.icon}><Ionicons name="arrow-up" size={18} color={i ? Colors.text1 : Colors.text3} /></Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel={`Remover linha ${i + 1}`} onPress={() => onChange(levels.filter((_, index) => index !== i))} style={styles.icon}><Ionicons name="trash-outline" size={18} color={Colors.danger} /></Pressable>
      </View></View>
      <View style={styles.fields}>{(n.isBreak ? ['durationMinutes'] : ['smallBlind', 'bigBlind', 'ante', 'durationMinutes']).map(key => {
        const campo = key as 'smallBlind' | 'bigBlind' | 'ante' | 'durationMinutes';
        const label = { smallBlind: 'Small', bigBlind: 'Big', ante: 'Ante', durationMinutes: 'Minutos' }[campo];
        return <View key={key} style={styles.field}><KTText papel="apoio" color={Colors.text1}>{label}</KTText><TextInput accessibilityLabel={`${label}, linha ${i + 1}`} keyboardType="number-pad" value={Number.isFinite(n[campo]) ? String(n[campo]) : ''} onChangeText={value => update(i, campo, value)} maxLength={8} style={styles.input} /></View>;
      })}</View>
    </View>)}
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}><KTButton label="Adicionar nível" variant="fantasma" onPress={() => add(false)} icone={<Ionicons name="add" size={18} color={Colors.gold200} />} /><KTButton label="Adicionar intervalo" variant="fantasma" onPress={() => add(true)} icone={<Ionicons name="cafe-outline" size={18} color={Colors.ok} />} /></View>
  </View>;
}
const styles = StyleSheet.create({
  row: { borderBottomWidth: 1, borderBottomColor: Colors.border, paddingVertical: 12, gap: 12 },
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  icon: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  fields: { flexDirection: 'row', gap: 8 }, field: { flex: 1, gap: 6 },
  input: { minHeight: 44, padding: 8, backgroundColor: Colors.bg1, borderRadius: Radius.xs, borderWidth: 1, borderColor: Colors.borderStrong, color: Colors.text0, fontFamily: Fonts.monoMedium, fontSize: 14 },
});
