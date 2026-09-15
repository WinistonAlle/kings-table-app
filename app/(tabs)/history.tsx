import { useMemo, useState } from 'react';
import { ScrollView, View, TextInput, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { KTScreen } from '@/components/ui/Screen';
import { KTText } from '@/components/ui/Text';
import { KTButton } from '@/components/ui/Button';
import { Colors, Fonts, Radius, Space } from '@/constants/tokens';
import { useTournamentStore } from '@/stores/tournamentStore';
import { listarMesas, type FiltroMesa } from '@/lib/mesas';
import { prizePool } from '@/lib/payouts';

const FILTROS: { valor: FiltroMesa; nome: string }[] = [
  { valor: 'todas', nome: 'Todas' }, { valor: 'abertas', nome: 'Abertas' }, { valor: 'encerradas', nome: 'Encerradas' },
];
const STATUS = { upcoming: 'Preparando', running: 'Em andamento', finished: 'Encerrada', cancelled: 'Cancelada' };

export default function Historico() {
  const torneios = useTournamentStore(s => s.tournaments);
  const [busca, setBusca] = useState('');
  const [filtro, setFiltro] = useState<FiltroMesa>('todas');
  const mesas = useMemo(() => listarMesas(torneios, filtro, busca), [torneios, filtro, busca]);
  return <KTScreen>
    <ScrollView contentContainerStyle={styles.conteudo} keyboardShouldPersistTaps="handled">
      <View><KTText papel="rotulo" color={Colors.gold400}>King’s Table</KTText><KTText papel="titulo" style={{ marginTop: 8 }}>Suas mesas</KTText><KTText color={Colors.text1} style={{ marginTop: 8 }}>Da primeira entrada ao último resultado.</KTText></View>
      <View style={styles.busca}><Ionicons name="search-outline" size={20} color={Colors.text2} /><TextInput accessibilityLabel="Buscar mesa pelo nome" placeholder="Buscar uma mesa" placeholderTextColor={Colors.text2} value={busca} onChangeText={setBusca} style={styles.campo} />{busca ? <Pressable accessibilityRole="button" accessibilityLabel="Limpar busca" onPress={() => setBusca('')} hitSlop={10}><Ionicons name="close-circle" size={20} color={Colors.text1} /></Pressable> : null}</View>
      <View style={styles.filtros}>{FILTROS.map(f => <Pressable key={f.valor} accessibilityRole="button" accessibilityState={{ selected: filtro === f.valor }} onPress={() => setFiltro(f.valor)} style={[styles.filtro, filtro === f.valor && styles.selecionado]}><KTText papel="corpoForte" color={filtro === f.valor ? Colors.gold100 : Colors.text1}>{f.nome}</KTText></Pressable>)}</View>
      <KTText papel="apoio" color={Colors.text2}>{mesas.length} {mesas.length === 1 ? 'mesa' : 'mesas'}</KTText>
      <View>{mesas.map(t => {
        const campeao = t.players.find(p => p.position === 1);
        return <Pressable key={t.id} accessibilityRole="button" accessibilityLabel={`Abrir ${t.name}, ${STATUS[t.status]}`} onPress={() => router.push(`/tournament/${t.id}` as never)} style={({ pressed }) => [styles.mesa, pressed && { backgroundColor: Colors.bg2 }]}>
          <View style={styles.linha}><KTText papel="apoio" color={t.status === 'running' ? Colors.ok : Colors.text2}>{STATUS[t.status]}</KTText><KTText papel="apoio" color={Colors.text2}>{new Date(t.createdAt).toLocaleDateString('pt-BR')}</KTText></View>
          <View style={[styles.linha, { marginTop: 10 }]}><KTText papel="subtitulo" style={{ flex: 1 }}>{t.name}</KTText><Ionicons name="chevron-forward" size={18} color={Colors.gold400} /></View>
          <KTText papel="apoio" color={Colors.text1} style={{ marginTop: 8 }}>{t.players.length} jogadores · Buy-in R$ {t.buyIn.toLocaleString('pt-BR')} · Bolo R$ {prizePool(t).toLocaleString('pt-BR')}</KTText>
          {campeao && t.status === 'finished' ? <View style={[styles.linha, { justifyContent: 'flex-start', gap: 8, marginTop: 12 }]}><Ionicons name="trophy-outline" size={16} color={Colors.gold300} /><KTText papel="apoio" color={Colors.gold200}>{campeao.name} venceu</KTText></View> : null}
        </Pressable>;
      })}</View>
      {!mesas.length ? <View style={styles.vazio}><Ionicons name="albums-outline" size={36} color={Colors.gold400} /><KTText papel="subtitulo" style={{ marginTop: 16, textAlign: 'center' }}>{torneios.length ? 'Nenhuma mesa encontrada' : 'A primeira noite começa aqui'}</KTText><KTText color={Colors.text1} style={{ textAlign: 'center', marginTop: 8 }}>{torneios.length ? 'Tente outro nome ou escolha um filtro diferente.' : 'Crie sua mesa. Os resultados ficam guardados neste aparelho.'}</KTText>{torneios.length ? <KTButton label="Limpar filtros" variant="fantasma" onPress={() => { setBusca(''); setFiltro('todas'); }} style={{ marginTop: 24, alignSelf: 'center' }} /> : <KTButton label="Criar mesa" onPress={() => router.push('/tournament/create')} style={{ marginTop: 24, alignSelf: 'center' }} />}</View> : null}
    </ScrollView>
  </KTScreen>;
}

const styles = StyleSheet.create({
  conteudo: { padding: Space.xl, paddingBottom: 120, gap: Space.xl, width: '100%', maxWidth: 760, alignSelf: 'center' },
  busca: { flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 1, borderColor: Colors.borderStrong, borderRadius: Radius.sm, paddingHorizontal: 16, minHeight: 50, backgroundColor: Colors.bg1 },
  campo: { flex: 1, minWidth: 0, color: Colors.text0, fontFamily: Fonts.ui, fontSize: 15, paddingVertical: 12 },
  filtros: { flexDirection: 'row', gap: 4, padding: 4, backgroundColor: Colors.bg1, borderRadius: Radius.sm },
  filtro: { flex: 1, alignItems: 'center', justifyContent: 'center', minHeight: 44, borderRadius: Radius.xs },
  selecionado: { backgroundColor: Colors.bg3 },
  linha: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  mesa: { paddingVertical: 24, paddingHorizontal: 8, borderBottomWidth: 1, borderBottomColor: Colors.border },
  vazio: { alignItems: 'center', paddingVertical: 32 },
});
