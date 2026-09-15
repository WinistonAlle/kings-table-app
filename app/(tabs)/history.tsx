import { useMemo, useState } from 'react';
import { ScrollView, View, TextInput, Pressable, StyleSheet, useWindowDimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { KTScreen } from '@/components/ui/Screen';
import { KTText } from '@/components/ui/Text';
import { KTButton } from '@/components/ui/Button';
import { Colors, Fonts, Radius, Space } from '@/constants/tokens';
import { useTournamentStore } from '@/stores/tournamentStore';
import { listarMesas, type FiltroMesa } from '@/lib/mesas';
import { prizePool } from '@/lib/payouts';
import { MesasHeader } from '@/components/MesasHeader';

const FILTROS: { valor: FiltroMesa; nome: string }[] = [
  { valor: 'todas', nome: 'Todas' }, { valor: 'abertas', nome: 'Abertas' }, { valor: 'encerradas', nome: 'Encerradas' },
];
const STATUS = { upcoming: 'Agendada', running: 'Em andamento', finished: 'Encerrada', cancelled: 'Cancelada' };

export default function Historico() {
  const torneios = useTournamentStore(s => s.tournaments);
  const setActive = useTournamentStore(s => s.setActive);
  const compact = useWindowDimensions().width < 600;
  const [busca, setBusca] = useState('');
  const [filtro, setFiltro] = useState<FiltroMesa>('todas');
  const mesas = useMemo(() => listarMesas(torneios, filtro, busca), [torneios, filtro, busca]);
  return <KTScreen>
    <MesasHeader title="Mesas" />
    <ScrollView contentContainerStyle={styles.conteudo} keyboardShouldPersistTaps="handled">
      <View style={styles.busca}><Ionicons name="search-outline" size={20} color={Colors.text2} /><TextInput accessibilityLabel="Buscar mesa pelo nome" placeholder="Buscar uma mesa" placeholderTextColor={Colors.text2} value={busca} onChangeText={setBusca} style={styles.campo} />{busca ? <Pressable accessibilityRole="button" accessibilityLabel="Limpar busca" onPress={() => setBusca('')} hitSlop={10}><Ionicons name="close-circle" size={20} color={Colors.text1} /></Pressable> : null}</View>
      <View style={styles.filtros}>{FILTROS.map(f => <Pressable key={f.valor} accessibilityRole="button" accessibilityState={{ selected: filtro === f.valor }} onPress={() => setFiltro(f.valor)} style={[styles.filtro, filtro === f.valor && styles.selecionado]}><KTText papel="corpoForte" color={filtro === f.valor ? Colors.gold100 : Colors.text1}>{f.nome}</KTText></Pressable>)}</View>
      <KTText papel="apoio" color={Colors.text2}>{mesas.length} {mesas.length === 1 ? 'mesa' : 'mesas'}</KTText>
      <View>{mesas.map(t => {
        const campeao = t.players.find(p => p.position === 1);
        const aberta = t.status === 'running' || t.status === 'upcoming';
        return <View key={t.id} style={styles.mesa}>
          <View style={styles.linha}><KTText papel="apoio" color={t.status === 'running' ? Colors.ok : Colors.text2}>{STATUS[t.status]}</KTText><KTText papel="apoio" color={Colors.text2}>{new Date(t.createdAt).toLocaleDateString('pt-BR')}</KTText></View>
          <KTText papel="subtitulo" style={{ marginTop: 10, letterSpacing: 0 }}>{t.name}</KTText>
          {t.status === 'upcoming' && <KTText papel="apoio" color={Colors.gold200} style={{ marginTop: 8 }}>{new Date(t.startTime).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })} · {t.location || 'Local a combinar'} · {(t.invitees ?? []).filter(c => c.status === 'confirmed').length} confirmados</KTText>}
          <KTText papel="apoio" color={Colors.text1} style={{ marginTop: 8 }}>{t.players.length} {t.players.length === 1 ? 'jogador' : 'jogadores'} · Buy-in {t.buyIn.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} · Bolo {prizePool(t).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</KTText>
          {campeao && t.status === 'finished' ? <View style={[styles.linha, { justifyContent: 'flex-start', gap: 8, marginTop: 12 }]}><Ionicons name="trophy-outline" size={16} color={Colors.gold300} /><KTText papel="apoio" color={Colors.gold200}>{campeao.name} venceu</KTText></View> : null}
          <View style={[styles.acoes, compact && { flexDirection: 'column' }]}>
            <KTButton label={aberta ? 'Gerenciar mesa' : t.status === 'finished' ? 'Ver resultado' : 'Ver detalhes'} fullWidth={compact} variant="fantasma" onPress={() => { if (aberta) setActive(t.id); router.push(`/tournament/${t.id}`); }} icone={<Ionicons name={aberta ? 'people-outline' : 'trophy-outline'} size={18} color={Colors.gold200} />} />
            {aberta && <KTButton label="Abrir relógio" fullWidth={compact} variant="fantasma" onPress={() => { setActive(t.id); router.push(`/blinds/${t.id}`); }} icone={<Ionicons name="timer-outline" size={20} color={Colors.gold200} />} />}
          </View>
        </View>;
      })}</View>
      {!mesas.length ? <View style={styles.vazio}><Ionicons name="albums-outline" size={36} color={Colors.gold400} /><KTText papel="subtitulo" style={{ marginTop: 16, textAlign: 'center' }}>{torneios.length ? 'Nenhuma mesa encontrada' : 'Nenhuma mesa criada'}</KTText>{torneios.length ? <KTButton label="Limpar filtros" variant="fantasma" onPress={() => { setBusca(''); setFiltro('todas'); }} style={{ marginTop: 24, alignSelf: 'center' }} /> : null}</View> : null}
    </ScrollView>
  </KTScreen>;
}

const styles = StyleSheet.create({
  conteudo: { paddingHorizontal: Space.xl, paddingTop: Space.sm, paddingBottom: 120, gap: Space.lg, width: '100%', maxWidth: 760, alignSelf: 'center' },
  busca: { flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 1, borderColor: Colors.borderStrong, borderRadius: Radius.sm, paddingHorizontal: 16, minHeight: 50, backgroundColor: Colors.bg1 },
  campo: { flex: 1, minWidth: 0, color: Colors.text0, fontFamily: Fonts.ui, fontSize: 15, paddingVertical: 12 },
  filtros: { flexDirection: 'row', gap: 4, padding: 4, backgroundColor: Colors.bg1, borderRadius: Radius.sm },
  filtro: { flex: 1, alignItems: 'center', justifyContent: 'center', minHeight: 44, borderRadius: Radius.xs },
  selecionado: { backgroundColor: Colors.bg3 },
  linha: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  mesa: { paddingVertical: 24, paddingHorizontal: 8, borderBottomWidth: 1, borderBottomColor: Colors.border },
  acoes: { flexDirection: 'row', gap: Space.md, marginTop: Space.lg },
  vazio: { alignItems: 'center', paddingVertical: 32 },
});
