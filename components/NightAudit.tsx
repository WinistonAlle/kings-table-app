import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { KTText } from '@/components/ui/Text';
import { KTButton } from '@/components/ui/Button';
import { Colors, Space } from '@/constants/tokens';
import type { Tournament } from '@/types';

export function NightAudit({ tournament: t }: { tournament: Tournament }) {
  const [expanded, setExpanded] = useState(false);
  const [limit, setLimit] = useState(8);
  const [selected, setSelected] = useState<string | null>(null);
  const events = [...(t.audit ?? [])].reverse();
  return <View style={{ gap: Space.md }}>
    <Pressable accessibilityRole="button" accessibilityLabel="Histórico de alterações" accessibilityState={{ expanded }} onPress={() => setExpanded(!expanded)} style={styles.heading}><Ionicons name="time-outline" size={22} color={Colors.gold300} /><KTText papel="subtitulo" style={{ flex: 1 }}>Histórico de alterações</KTText><KTText papel="numero" color={Colors.text2}>{events.length}</KTText><Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={18} color={Colors.text1} /></Pressable>
    {expanded && <>
      {!events.length && <KTText papel="apoio" color={Colors.text2}>Nenhuma alteração registrada nesta mesa. O histórico começa nas próximas ações.</KTText>}
      {events.slice(0, limit).map(e => <View key={e.id} style={styles.event}>
        <Pressable accessibilityRole="button" accessibilityLabel={`Detalhes: ${e.summary}`} accessibilityState={{ expanded: selected === e.id }} onPress={() => setSelected(selected === e.id ? null : e.id)} style={{ gap: 6, minHeight: 44 }}><KTText papel="corpoForte">{e.summary}</KTText><KTText papel="apoio" color={Colors.text2}>{new Date(e.at).toLocaleString('pt-BR')} · {e.actor}</KTText><KTText papel="apoio" color={Colors.gold200}>{selected === e.id ? 'Ocultar detalhes' : `${e.changes.length} ${e.changes.length === 1 ? 'alteração' : 'alterações'} · ver detalhes`}</KTText></Pressable>
        {selected === e.id && e.changes.map((c, i) => <View key={i} style={{ marginTop: 14, gap: 4 }}><KTText papel="apoio" color={Colors.text1}>{c.label}</KTText><KTText papel="apoio" color={Colors.text2}>Antes: {c.before}</KTText><KTText papel="apoio" color={Colors.gold200}>Depois: {c.after}</KTText></View>)}
      </View>)}
      {events.length > limit && <KTButton label="Ver mais alterações" variant="fantasma" onPress={() => setLimit(limit + 8)} />}
    </>}
  </View>;
}
const styles = StyleSheet.create({
  heading: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 48 },
  event: { paddingVertical: 16, borderBottomWidth: 1, borderColor: Colors.border },
});
