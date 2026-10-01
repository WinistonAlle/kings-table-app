import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Space } from '@/constants/tokens';
import { KTText } from './ui/Text';
import { KTButton } from './ui/Button';
import { useTournamentSync } from './TournamentSync';
import type { TournamentSnapshot } from '@/lib/sync-tournament-reader';

const status = { upcoming: 'Agendada', running: 'Em andamento', paused: 'Pausada',
  finished: 'Encerrada', cancelled: 'Cancelada' };
const payment = { pending: 'Pendente', confirmed: 'Confirmado', disputed: 'Em revisão' };
const money = (value: number) => value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const count = (value: number, singular: string, plural: string) => `${value} ${value === 1 ? singular : plural}`;

export function OnlineTables({ search, filter }: { search: string; filter: 'todas' | 'abertas' | 'encerradas' }) {
  const sync = useTournamentSync();
  const [selected, setSelected] = useState<string | null>(null);
  const [details, setDetails] = useState<TournamentSnapshot | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const sequence = useRef(0);
  useEffect(() => () => { sequence.current++; }, []);
  if (!sync) return null;
  const tables = sync.state.tables.filter(table => !table.deletedAt
    && table.name.toLocaleLowerCase('pt-BR').includes(search.trim().toLocaleLowerCase('pt-BR'))
    && (filter === 'todas' || (filter === 'abertas'
      ? ['upcoming', 'running', 'paused'].includes(table.status) : table.status === 'finished')));
  const summary = tables.find(table => table.id === selected);
  const detail = summary && details?.tournament.id === summary.id
    && details.tournament.revision === summary.revision ? details : null;

  async function open(id: string) {
    if (!sync) return;
    const request = ++sequence.current;
    setSelected(id); setDetails(null); setError(null); setLoading(true);
    try {
      const value = await sync.read(id);
      if (request !== sequence.current) return;
      setDetails(value);
      if (!value) setError('Esta mesa não está mais disponível para consulta.');
    } catch {
      if (request !== sequence.current) return;
      setError('Não foi possível atualizar esta mesa.');
      try {
        const cached = await sync.cached(id);
        if (request === sequence.current) setDetails(cached);
      } catch { /* Keep the error visible when the local cache is unavailable too. */ }
    } finally { if (request === sequence.current) setLoading(false); }
  }
  const busy = sync.state.phase === 'syncing' || sync.state.phase === 'idle';
  return <View style={styles.section}>
    <View style={styles.heading}>
      <KTText papel="subtitulo">Mesas da conta</KTText>
      <KTButton label="Atualizar mesas" size="sm" variant="fantasma" disabled={busy}
        icone={<Ionicons name="refresh-outline" size={18} color={Colors.gold200} />}
        onPress={() => { void sync.refresh(); }} />
    </View>
    {busy ? <View style={styles.line}><ActivityIndicator color={Colors.gold300} />
      <KTText papel="apoio" color={Colors.text1}>Atualizando mesas…</KTText></View> : null}
    {sync.state.error ? <KTText papel="apoio" color={Colors.danger}>
      {sync.state.error === 'local_storage' ? 'Não foi possível acessar as mesas salvas neste navegador.'
        : 'Atualização indisponível. Exibindo a última lista salva.'}</KTText> : null}
    {!tables.length && !busy ? <KTText papel="apoio" color={Colors.text2}>
      {sync.state.error ? 'Nenhuma mesa salva disponível para consulta.'
        : search || filter !== 'todas' ? 'Nenhuma mesa da conta corresponde aos filtros.' : 'Nenhuma mesa na conta.'}</KTText> : null}
    {tables.map(table => <View key={table.id} style={styles.row}>
      <View style={styles.rowText}>
        <KTText papel="corpoForte">{table.name}</KTText>
        <KTText papel="apoio" color={Colors.text1}>{status[table.status]} · Buy-in {money(table.buyIn)}</KTText>
        <KTText papel="apoio" color={Colors.text2}>Atualizada em {new Date(table.updatedAt).toLocaleString('pt-BR')}</KTText>
        {sync.state.views.find(view => view.id === table.id)?.reconciliationNeeded
          ? <KTText papel="apoio" color={Colors.danger}>Revisão de alterações necessária</KTText>
          : sync.state.views.find(view => view.id === table.id)?.pending.length
            ? <KTText papel="apoio" color={Colors.gold200}>Alterações pendentes</KTText>
            : sync.state.views.find(view => view.id === table.id)?.awaitingCatalog
              ? <KTText papel="apoio" color={Colors.gold200}>Aguardando atualização da conta</KTText> : null}
      </View>
      <Pressable accessibilityRole="button" accessibilityLabel={`Consultar ${table.name}`}
        accessibilityState={{ selected: selected === table.id, disabled: loading && selected === table.id }}
        disabled={loading && selected === table.id} onPress={() => { void open(table.id); }} style={styles.inspect}>
        <Ionicons name="chevron-forward" size={22} color={Colors.gold200} />
      </Pressable>
    </View>)}
    {summary ? <View style={styles.detail}>
      <View style={styles.heading}>
        <KTText papel="subtitulo" style={{ flex: 1 }}>{summary.name}</KTText>
        <Pressable accessibilityRole="button" accessibilityLabel="Fechar consulta" style={styles.inspect}
          onPress={() => { sequence.current++; setSelected(null); setDetails(null); setLoading(false); setError(null); }}>
          <Ionicons name="close-outline" size={24} color={Colors.text1} />
        </Pressable>
      </View>
      <KTText papel="apoio" color={Colors.gold200}>Consulta da conta · Somente leitura</KTText>
      {loading ? <ActivityIndicator accessibilityLabel="Carregando mesa" color={Colors.gold300} /> : null}
      {error ? <KTText papel="apoio" color={Colors.danger}>{error}</KTText> : null}
      {!loading && !detail && !error ? <KTText papel="apoio" color={Colors.text1}>A mesa mudou. Atualize os detalhes.</KTText> : null}
      {!loading ? <KTButton label="Atualizar detalhes" variant="fantasma" size="sm"
        onPress={() => { void open(summary.id); }}
        icone={<Ionicons name="refresh-outline" size={18} color={Colors.gold200} />} /> : null}
      {detail ? <>
        <KTText papel="apoio" color={Colors.text1}>{count(detail.players.length, 'jogador', 'jogadores')} · {count(detail.invites.filter(invite => !invite.deleted_at).length, 'convidado', 'convidados')}</KTText>
        <KTText papel="apoio" color={Colors.text2}>Revisão {detail.tournament.revision} · {new Date(detail.tournament.updated_at).toLocaleString('pt-BR')}</KTText>
        <KTText papel="corpoForte">Jogadores</KTText>
        {!detail.players.length ? <KTText papel="apoio" color={Colors.text2}>Nenhum jogador registrado.</KTText> : null}
        {detail.players.map(player => <View key={player.id} style={styles.player}>
          <KTText papel="corpoForte">{player.display_name}</KTText>
          <KTText papel="apoio" color={Colors.text1}>{count(player.buy_ins, 'entrada', 'entradas')} · {count(player.re_entries, 'reentrada', 'reentradas')} · {count(player.add_ons, 'add-on', 'add-ons')}</KTText>
          <KTText papel="apoio" color={Colors.text1}>Pagamento: {payment[player.payment_status]}{player.position ? ` · ${player.position}º lugar` : ''}{player.prize !== null ? ` · Prêmio ${money(player.prize)}` : ''}</KTText>
        </View>)}
      </> : null}
    </View> : null}
  </View>;
}

const styles = StyleSheet.create({
  section: { gap: Space.md, paddingVertical: Space.lg, borderTopWidth: 1, borderColor: Colors.border },
  heading: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: Space.md },
  line: { flexDirection: 'row', alignItems: 'center', gap: Space.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: Space.md, paddingVertical: Space.md, borderBottomWidth: 1, borderColor: Colors.border },
  rowText: { flex: 1, minWidth: 0, gap: 6 },
  inspect: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  detail: { paddingVertical: Space.lg, gap: Space.md },
  player: { paddingVertical: Space.sm, gap: 6, borderBottomWidth: 1, borderColor: Colors.border },
});
