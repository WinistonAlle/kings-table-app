import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { KTText } from '@/components/ui/Text';
import { KTButton } from '@/components/ui/Button';
import { Colors, Radius, Space } from '@/constants/tokens';
import { useTournamentStore } from '@/stores/tournamentStore';
import { lugarJogador, podeDesfazerAssentos } from '@/lib/assentos';
import { confirmarAcao } from '@/lib/confirmar';
import type { Tournament } from '@/types';

export function SeatManager({ tournament: t }: { tournament: Tournament }) {
  const { drawSeats, moveSeat, undoSeats } = useTournamentStore();
  const [size, setSize] = useState(t.seatsPerTable ?? 10);
  const [selected, setSelected] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);
  const players = t.players.filter(p => !p.position);
  const target = players.find(p => p.id === selected);
  const tables = Math.max(1, Math.ceil(players.length / (t.seatsPerTable ?? 10)), ...players.map(p => p.tableNumber ?? 0));
  const unassigned = players.filter(p => !p.tableNumber || !p.seatNumber).length;
  return <View style={styles.section}>
    <View style={styles.heading}><Ionicons name="grid-outline" size={22} color={Colors.gold300} /><KTText papel="subtitulo">Assentos</KTText></View>
    <KTText papel="apoio" color={Colors.text1}>{players.length} jogadores · {unassigned} sem assento · {t.seatsPerTable ?? 10} lugares por mesa</KTText>
    <View style={styles.heading}>
      <KTText papel="apoio" style={{ flex: 1 }}>Lugares por mesa no sorteio</KTText>
      <Pressable accessibilityRole="button" accessibilityLabel="Diminuir lugares por mesa" disabled={size <= 2} onPress={() => setSize(size - 1)} style={[styles.slot, size <= 2 && { opacity: 0.4 }]}><Ionicons name="remove" size={18} color={Colors.text1} /></Pressable>
      <KTText papel="numero" style={{ width: 26, textAlign: 'center' }}>{size}</KTText>
      <Pressable accessibilityRole="button" accessibilityLabel="Aumentar lugares por mesa" disabled={size >= 12} onPress={() => setSize(size + 1)} style={[styles.slot, size >= 12 && { opacity: 0.4 }]}><Ionicons name="add" size={18} color={Colors.text1} /></Pressable>
    </View>
    <View style={styles.actions}>
      <KTButton label="Sortear assentos" disabled={players.length < 2} onPress={() => confirmarAcao(`Sortear os ${players.length} jogadores em mesas de ${size} lugares? Os assentos atuais serão substituídos.`, () => { drawSeats(t.id, size); setExpanded(true); setSelected(null); })} icone={<Ionicons name="shuffle" size={18} color={Colors.bg0} />} />
      <KTButton label="Desfazer assentos" disabled={!podeDesfazerAssentos(t)} variant="fantasma" onPress={() => confirmarAcao('Restaurar os assentos anteriores? Entradas e pagamentos serão mantidos.', () => { undoSeats(t.id); setSize(useTournamentStore.getState().tournaments.find(n => n.id === t.id)?.seatsPerTable ?? 10); setSelected(null); })} icone={<Ionicons name="arrow-undo" size={18} color={Colors.gold200} />} />
    </View>
    <KTButton label={expanded ? 'Ocultar organização' : 'Ver e editar assentos'} variant="fantasma" disabled={!players.length} onPress={() => { setExpanded(!expanded); setSelected(null); }} />
    {expanded && <View style={styles.section}>
      {[...players].sort((a, b) => (a.tableNumber ?? 999) - (b.tableNumber ?? 999) || (a.seatNumber ?? 999) - (b.seatNumber ?? 999)).map(p => <Pressable key={p.id} accessibilityRole="button" accessibilityLabel={`Alterar assento de ${p.name}`} accessibilityState={{ expanded: selected === p.id }} onPress={() => setSelected(selected === p.id ? null : p.id)} style={[styles.row, selected === p.id && { borderColor: Colors.gold300 }]}><View style={{ flex: 1 }}><KTText papel="corpoForte">{p.name}</KTText><KTText papel="apoio" color={Colors.gold200}>{lugarJogador(p)}</KTText></View><Ionicons name="swap-horizontal" size={20} color={Colors.gold300} /></Pressable>)}
      {target && <View style={styles.picker}>
        <KTText papel="corpoForte">Novo lugar de {target.name}</KTText>
        {Array.from({ length: tables }, (_, i) => i + 1).map(table => <View key={table} style={styles.section}><KTText papel="rotulo" color={Colors.text1}>Mesa {table}</KTText><View style={styles.actions}>{Array.from({ length: t.seatsPerTable ?? 10 }, (_, i) => i + 1).map(seat => {
          const occupant = players.find(p => p.tableNumber === table && p.seatNumber === seat);
          const current = occupant?.id === target.id;
          return <Pressable key={seat} accessibilityRole="button" accessibilityLabel={`Mesa ${table}, assento ${seat}${occupant ? `, ${occupant.name}` : ', livre'}`} disabled={current} onPress={() => confirmarAcao(occupant ? `Trocar ${target.name} com ${occupant.name}?${target.seatNumber ? '' : ` ${occupant.name} ficará sem assento.`}` : `Mover ${target.name} para mesa ${table}, assento ${seat}?`, () => { moveSeat(t.id, target.id, table, seat); setSelected(null); })} style={[styles.slot, { borderColor: current ? Colors.gold300 : occupant ? Colors.borderStrong : Colors.border, backgroundColor: current ? Colors.gold800 : Colors.bg1 }]}><KTText papel="numero" color={occupant ? Colors.gold200 : Colors.text2}>{seat}</KTText></Pressable>;
        })}</View></View>)}
        <KTButton label="Fechar seleção de assento" variant="fantasma" onPress={() => setSelected(null)} />
      </View>}
    </View>}
  </View>;
}

const styles = StyleSheet.create({
  section: { gap: Space.md },
  heading: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  slot: { width: 44, height: 44, borderWidth: 1, borderColor: Colors.borderStrong, borderRadius: Radius.sm, alignItems: 'center', justifyContent: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, paddingHorizontal: 12, minHeight: 60, borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.sm },
  picker: { gap: 16, paddingVertical: 16, borderTopWidth: 1, borderColor: Colors.border },
});
