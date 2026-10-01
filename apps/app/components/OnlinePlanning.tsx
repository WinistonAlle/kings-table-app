import { useEffect, useRef, useState } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Fonts, Radius, Space } from '@/constants/tokens';
import { confirmarAcao } from '@/lib/confirmar';
import { playerOperationLabel } from '@/lib/sync-tournament-players';
import { planningFields, planningPayloadSchema, preparePlanningOperation, type PlanningDraft } from '@/lib/sync-tournament-planning';
import type { SyncOperation } from '@/lib/sync-operation';
import type { OutboxEntry } from '@/lib/sync-outbox';
import type { TournamentCatalogView } from '@/lib/sync-tournament-model';
import type { TournamentSnapshot } from '@/lib/sync-tournament-reader';
import type { TournamentSyncValue } from './TournamentSync.web';
import { KTButton } from './ui/Button';
import { KTText } from './ui/Text';

function fields(snapshot: TournamentSnapshot) {
  try { return planningFields(snapshot); } catch { return null; }
}
function Attempt({ entry }: { entry: OutboxEntry }) {
  const parsed = entry.operation.kind === 'tournament.update' ? planningPayloadSchema.safeParse(entry.operation.payload) : null;
  return <View style={styles.attempt}>
    <KTText papel="apoio" color={Colors.text1}>{parsed?.success ? 'Agendamento' : playerOperationLabel(entry.operation) ?? 'Alteração da mesa'} · {new Date(entry.operation.createdAt).toLocaleString('pt-BR')}</KTText>
    {parsed?.success ? <KTText papel="apoio" color={Colors.text1}>
      {new Date(parsed.data.startTime).toLocaleString('pt-BR')} · {parsed.data.location || 'Local a combinar'} · {parsed.data.capacity ? `${parsed.data.capacity} vagas` : 'Sem limite de vagas'}
    </KTText> : null}
    {entry.status === 'cancelled' ? <KTText papel="apoio" color={Colors.text2}>Tentativa arquivada · Versão da conta mantida</KTText>
      : <KTText papel="apoio" color={Colors.gold200}>{entry.status === 'conflict' ? 'Conflito: a mesa foi alterada'
        : entry.status === 'rejected' ? 'Alteração não aceita pela conta' : entry.status === 'sending' ? 'Enviando alteração' : 'Aguardando envio'}</KTText>}
  </View>;
}

export function OnlinePlanning({ snapshot, view, sync, onDirtyChange, otherEditing = false }: {
  snapshot: TournamentSnapshot; view: TournamentCatalogView; sync: TournamentSyncValue;
  onDirtyChange: (dirty: boolean) => void; otherEditing?: boolean;
}) {
  const initial = fields(snapshot);
  const [draft, setDraft] = useState<PlanningDraft>(initial ?? { day: '', time: '', location: '', capacity: '' });
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [showHistory, setShowHistory] = useState(false);
  const [retry, setRetry] = useState(false);
  const operation = useRef<SyncOperation | null>(null);
  const alive = useRef(true);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  useEffect(() => {
    onDirtyChange(editing || retry);
    return () => onDirtyChange(false);
  }, [editing, retry, onDirtyChange]);
  useEffect(() => {
    if (!editing && !operation.current) {
      const next = fields(snapshot);
      if (next) setDraft(next);
    }
  }, [snapshot, editing]);
  const current = snapshot.tournament.revision === view.confirmed?.revision;
  const ready = current && !view.pending.length && !view.awaitingCatalog && !view.reconciliationNeeded
    && snapshot.tournament.status === 'upcoming' && !snapshot.tournament.deleted_at && !!initial && !otherEditing;
  const busy = sync.state.phase === 'syncing' || sync.state.phase === 'idle';
  const definitive = ['conflict', 'rejected'].includes(view.pending[0]?.status)
    && view.pending.every(entry => ['queued', 'conflict', 'rejected'].includes(entry.status));
  const canResolve = current && definitive && sync.state.phase === 'ready';
  const change = (key: keyof PlanningDraft, value: string) => setDraft(previous => ({ ...previous, [key]: value }));

  async function save() {
    if (saving || (!operation.current && !ready)) return;
    setSaving(true); setMessage('');
    try {
      // Preserve the same command identity after a failed or uncertain local acknowledgement.
      operation.current ??= preparePlanningOperation(snapshot, draft);
      await sync.send(operation.current);
      if (!alive.current) return;
      operation.current = null; setRetry(false); setEditing(false);
      setMessage('Alteração registrada neste aparelho. Atualize os detalhes para conferir a versão da conta.');
    } catch (error) {
      if (!alive.current) return;
      setRetry(!!operation.current);
      setMessage(operation.current ? 'Não foi possível confirmar o registro. Atualize ou tente registrar novamente.'
        : error instanceof Error ? error.message : 'Não foi possível registrar o agendamento.');
    } finally { if (alive.current) setSaving(false); }
  }
  async function resolve() {
    setSaving(true); setMessage('');
    try {
      await sync.resolve(snapshot.tournament.id, { expectedBase: view.confirmed,
        pendingOperationIds: view.pending.map(entry => entry.operation.id), decision: { kind: 'keep_remote' } });
      if (!alive.current) return;
      operation.current = null; setRetry(false); setEditing(false);
      setMessage('Versão da conta mantida. As tentativas ficaram no histórico deste aparelho.');
    } catch { if (alive.current) setMessage('A mesa ou a fila mudou. Atualize os detalhes e revise novamente.'); }
    finally { if (alive.current) setSaving(false); }
  }

  return <View style={styles.section}>
    <View style={styles.heading}><Ionicons name="calendar-outline" size={22} color={Colors.gold300} />
      <KTText papel="corpoForte">Agendamento da conta</KTText></View>
    <KTText color={Colors.text1}>{snapshot.tournament.start_time
      ? new Date(snapshot.tournament.start_time).toLocaleString('pt-BR', { dateStyle: 'long', timeStyle: 'short' }) : 'Data a combinar'}</KTText>
    <KTText papel="apoio" color={Colors.text1}>{initial?.location || 'Local a combinar'} · {initial?.capacity ? `${initial.capacity} vagas` : 'Sem limite de vagas'}</KTText>
    {!current ? <KTText papel="apoio" color={Colors.warn}>Agendamento desatualizado. Atualize os detalhes antes de editar.</KTText> : null}
    {!initial ? <KTText papel="apoio" color={Colors.danger}>Configuração de agendamento inconsistente. Atualize os detalhes.</KTText> : null}
    {editing ? <View style={styles.form}>
      <View style={styles.dates}>
        <View style={styles.field}><KTText papel="apoio" color={Colors.text1}>Data</KTText>
          <TextInput accessibilityLabel="Data do agendamento online" value={draft.day} onChangeText={value => change('day', value)}
            placeholder="DD/MM/AAAA" placeholderTextColor={Colors.text2} maxLength={10} editable={!saving && !retry} style={styles.input} /></View>
        <View style={styles.field}><KTText papel="apoio" color={Colors.text1}>Horário</KTText>
          <TextInput accessibilityLabel="Horário do agendamento online" value={draft.time} onChangeText={value => change('time', value)}
            placeholder="HH:MM" placeholderTextColor={Colors.text2} maxLength={5} editable={!saving && !retry} style={styles.input} /></View>
      </View>
      <KTText papel="apoio" color={Colors.text1}>Local</KTText>
      <TextInput accessibilityLabel="Local do agendamento online" value={draft.location} onChangeText={value => change('location', value)}
        maxLength={200} editable={!saving && !retry} style={styles.input} />
      <KTText papel="apoio" color={Colors.text1}>Limite de jogadores</KTText>
      <TextInput accessibilityLabel="Limite de jogadores online" value={draft.capacity} onChangeText={value => change('capacity', value)}
        placeholder="Sem limite" placeholderTextColor={Colors.text2} maxLength={4} keyboardType="number-pad" editable={!saving && !retry} style={styles.input} />
      <View style={styles.heading}>
        <KTButton label={saving ? 'Registrando…' : retry ? 'Tentar registrar novamente' : 'Salvar agendamento na conta'}
          disabled={saving || (!retry && !ready)} onPress={() => { void save(); }}
          icone={<Ionicons name="save-outline" size={18} color={Colors.bg0} />} />
        {!retry ? <KTButton label="Cancelar edição" variant="fantasma" disabled={saving}
          onPress={() => { setEditing(false); setMessage(''); }} /> : null}
      </View>
    </View> : ready ? <KTButton label="Editar agendamento online" variant="fantasma" size="sm" disabled={saving || busy}
      icone={<Ionicons name="create-outline" size={18} color={Colors.gold200} />}
      onPress={() => { onDirtyChange(true); setEditing(true); setMessage(''); }} /> : null}
    {view.awaitingCatalog ? <KTText papel="apoio" color={Colors.gold200}>Envio confirmado. Aguardando atualização dos dados da conta.</KTText> : null}
    {view.pending.map(entry => <Attempt key={entry.operation.id} entry={entry} />)}
    {definitive ? <>
      <KTText papel="apoio" color={Colors.text1}>A versão da conta e suas tentativas foram preservadas.</KTText>
      <KTButton label="Manter versão da conta" variant="fantasma" disabled={!canResolve || saving}
        onPress={() => confirmarAcao('Manter a versão da conta? As tentativas acima não serão reaplicadas e ficarão arquivadas neste aparelho.', () => { void resolve(); })} />
      {!canResolve ? <KTText papel="apoio" color={Colors.text2}>Atualize as mesas e os detalhes para revisar esta decisão.</KTText> : null}
    </> : null}
    {view.archived.length ? <>
      <KTButton label={showHistory ? 'Ocultar tentativas arquivadas' : `Ver tentativas arquivadas (${view.archived.length})`}
        variant="fantasma" size="sm" onPress={() => setShowHistory(!showHistory)} />
      {showHistory ? view.archived.map(entry => <Attempt key={entry.operation.id} entry={entry} />) : null}
    </> : null}
    {message ? <KTText accessibilityLiveRegion="polite" papel="apoio" color={Colors.gold200}>{message}</KTText> : null}
  </View>;
}

const styles = StyleSheet.create({
  section: { gap: Space.md, paddingVertical: Space.md, borderTopWidth: 1, borderColor: Colors.border },
  heading: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: Space.sm },
  form: { gap: Space.sm }, dates: { flexDirection: 'row', flexWrap: 'wrap', gap: Space.md },
  field: { flex: 1, minWidth: 130, gap: Space.sm },
  input: { minHeight: 48, width: '100%', padding: 14, borderWidth: 1, borderColor: Colors.borderStrong,
    borderRadius: Radius.sm, backgroundColor: Colors.bg1, color: Colors.text0, fontFamily: Fonts.ui, fontSize: 16 },
  attempt: { gap: 6, paddingVertical: Space.sm, borderTopWidth: 1, borderColor: Colors.border },
});
