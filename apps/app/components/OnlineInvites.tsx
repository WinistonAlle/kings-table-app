import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Fonts, Radius, Space } from '@/constants/tokens';
import { confirmarAcao } from '@/lib/confirmar';
import { accountInviteRoster, attendanceLabels, prepareInviteOperation, type AccountAttendance, type InviteAction } from '@/lib/sync-tournament-invites';
import type { SyncOperation } from '@/lib/sync-operation';
import type { TournamentSnapshot } from '@/lib/sync-tournament-reader';
import type { TournamentCatalogView } from '@/lib/sync-tournament-model';
import type { TournamentSyncValue } from './TournamentSync.web';
import { KTButton } from './ui/Button';
import { KTText } from './ui/Text';

function AttendanceChoices({ value, onChange, disabled, label }: {
  value: AccountAttendance; onChange: (status: AccountAttendance) => void; disabled: boolean; label: string;
}) {
  return <View accessibilityRole="radiogroup" accessibilityLabel={label} style={styles.choices}>
    {(Object.keys(attendanceLabels) as AccountAttendance[]).map(status => <Pressable key={status}
      accessibilityRole="radio" accessibilityLabel={attendanceLabels[status]}
      accessibilityState={{ checked: value === status, disabled }} disabled={disabled}
      onPress={() => { if (status !== value) onChange(status); }} style={[styles.choice, value === status && styles.chosen, disabled && { opacity: 0.5 }]}>
      <Ionicons name={value === status ? 'radio-button-on-outline' : 'radio-button-off-outline'} size={18}
        color={value === status ? Colors.gold200 : Colors.text2} />
      <KTText papel="apoio" color={value === status ? Colors.gold200 : Colors.text1}>{attendanceLabels[status]}</KTText>
    </Pressable>)}
  </View>;
}

export function OnlineInvites({ snapshot, view, sync, onDirtyChange, onRefresh, otherEditing }: {
  snapshot: TournamentSnapshot; view: TournamentCatalogView; sync: TournamentSyncValue;
  onDirtyChange: (dirty: boolean) => void; onRefresh: () => Promise<void>; otherEditing: boolean;
}) {
  const [draft, setDraft] = useState<{ name: string; status: AccountAttendance } | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [retry, setRetry] = useState(false);
  const [message, setMessage] = useState('');
  const operation = useRef<SyncOperation | null>(null);
  const busy = useRef(false), alive = useRef(true);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  useEffect(() => { onDirtyChange(!!draft || retry); return () => onDirtyChange(false); }, [draft, retry, onDirtyChange]);
  const roster = accountInviteRoster(snapshot);
  const current = snapshot.tournament.revision === view.confirmed?.revision;
  const upcoming = snapshot.tournament.status === 'upcoming' && !snapshot.tournament.deleted_at;
  const ready = current && upcoming && !view.pending.length && !view.awaitingCatalog && !view.reconciliationNeeded
    && sync.state.phase === 'ready' && !otherEditing;
  const locked = !ready || saving || !!draft || retry;

  async function send(action?: InviteAction) {
    if (busy.current || (!operation.current && (!ready || !action))) return;
    busy.current = true; setSaving(true); setMessage('');
    try {
      operation.current ??= prepareInviteOperation(snapshot, action!);
      await sync.send(operation.current);
      if (!alive.current) return;
      operation.current = null; setRetry(false); setDraft(null);
      setMessage('Alteração registrada. Confira a confirmação e as vagas nos dados da conta.');
      await onRefresh();
    } catch (error) {
      if (!alive.current) return;
      setRetry(!!operation.current);
      setMessage(operation.current ? 'Não foi possível confirmar o registro. Tente novamente com a mesma alteração.'
        : error instanceof Error ? error.message : 'Não foi possível alterar o convidado.');
    } finally { busy.current = false; if (alive.current) setSaving(false); }
  }

  return <View style={styles.section}>
    <View style={styles.heading}>
      <KTText papel="corpoForte">Convidados e presença</KTText>
      {upcoming ? <KTButton label="Adicionar convidado online" size="sm" disabled={locked}
        icone={<Ionicons name="person-add-outline" size={18} color={Colors.bg0} />}
        onPress={() => { onDirtyChange(true); setDraft({ name: '', status: 'maybe' }); setMessage(''); }} /> : null}
    </View>
    <KTText papel="apoio" color={Colors.text1}>{roster.capacity === null ? `${roster.reserved} vagas ocupadas ou reservadas`
      : `${roster.reserved}/${roster.capacity} vagas ocupadas ou reservadas`} · {roster.waiting} em espera</KTText>
    {!current ? <KTText papel="apoio" color={Colors.warn}>Presença desatualizada. Atualize os detalhes antes de alterar.</KTText> : null}
    {!upcoming ? <KTText papel="apoio" color={Colors.text2}>Lista de convidados fechada para alterações.</KTText> : null}
    {draft ? <View style={styles.form}>
      <KTText papel="apoio" color={Colors.text1}>Nome do convidado</KTText>
      <TextInput accessibilityLabel="Nome do convidado online" value={draft.name} maxLength={60} editable={!saving && !retry}
        onChangeText={name => setDraft({ ...draft, name })} placeholder="Nome ou apelido" placeholderTextColor={Colors.text2} style={styles.input} />
      <AttendanceChoices value={draft.status} label="Presença do novo convidado" disabled={saving || retry}
        onChange={status => setDraft({ ...draft, status })} />
      <View style={styles.actions}>
        <KTButton label="Registrar convidado na conta" disabled={!ready || saving || retry || !draft.name.trim()}
          onPress={() => { void send({ kind: 'add', ...draft }); }} />
        {!retry ? <KTButton label="Cancelar edição do convidado" variant="fantasma" disabled={saving}
          onPress={() => { setDraft(null); setMessage(''); }} /> : null}
      </View>
    </View> : null}
    {retry ? <KTButton label="Tentar registrar convidado novamente" disabled={saving} onPress={() => { void send(); }} /> : null}
    {message ? <KTText accessibilityLiveRegion="polite" papel="apoio" color={Colors.gold200}>{message}</KTText> : null}
    {!roster.invites.length ? <KTText papel="apoio" color={Colors.text2}>Nenhum convidado nesta noite.</KTText> : null}
    {roster.invites.map(invite => {
      const active = selected === invite.id;
      const player = snapshot.players.find(row => row.id === invite.player_id
        || row.display_name.trim().toLowerCase() === invite.name.trim().toLowerCase());
      return <View key={invite.id} testID={`online-invite-${invite.id}`} style={styles.invite}>
        <View style={styles.heading}>
          <View style={styles.identity}><KTText papel="corpoForte">{invite.name}</KTText>
            <KTText papel="apoio" color={invite.status === 'confirmed' ? Colors.gold200 : Colors.text1}>
              {invite.player_id ? 'Já entrou na mesa' : `${attendanceLabels[invite.status]}${roster.positions.has(invite.id) ? ` · ${roster.positions.get(invite.id)}º na espera` : ''}`}
            </KTText></View>
          {upcoming && !invite.player_id ? <Pressable accessibilityRole="button" accessibilityLabel={`Gerenciar convidado ${invite.name}`}
            accessibilityState={{ expanded: active }} style={styles.icon} onPress={() => setSelected(active ? null : invite.id)}>
            <Ionicons name={active ? 'chevron-up-outline' : 'chevron-down-outline'} size={22} color={Colors.gold200} />
          </Pressable> : null}
        </View>
        {active && upcoming && !invite.player_id ? <View style={styles.form}>
          <AttendanceChoices value={invite.status} label={`Presença de ${invite.name}`} disabled={locked}
            onChange={status => { void send({ kind: 'attendance', inviteId: invite.id, status }); }} />
          <View style={styles.actions}>
            {invite.status === 'confirmed' ? <KTButton label="Registrar chegada" accessibilityLabel={`Registrar chegada de ${invite.name}`}
              size="sm" disabled={locked} icone={<Ionicons name="checkmark-outline" size={18} color={Colors.bg0} />}
              onPress={() => confirmarAcao(player ? `Vincular ${invite.name} ao jogador ${player.display_name} já registrado, sem cobrar outra entrada?`
                : `Registrar a chegada de ${invite.name}? Uma entrada será criada no valor do buy-in e ficará com pagamento pendente.`,
              () => { void send({ kind: 'checkIn', inviteId: invite.id }); })} /> : null}
            <KTButton label="Retirar convidado" accessibilityLabel={`Retirar convidado ${invite.name}`} size="sm" variant="perigo" disabled={locked}
              icone={<Ionicons name="trash-outline" size={18} color={Colors.danger} />}
              onPress={() => confirmarAcao(`Retirar ${invite.name} da lista? Se houver uma vaga reservada, ela será liberada para quem está em espera.`,
                () => { void send({ kind: 'remove', inviteId: invite.id }); })} />
          </View>
        </View> : null}
      </View>;
    })}
  </View>;
}

const styles = StyleSheet.create({
  section: { gap: Space.md, paddingVertical: Space.md, borderTopWidth: 1, borderColor: Colors.border },
  heading: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: Space.sm },
  identity: { flex: 1, minWidth: 150, gap: 6 },
  icon: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  invite: { gap: Space.sm, paddingVertical: Space.md, borderBottomWidth: 1, borderColor: Colors.border },
  form: { gap: Space.sm }, actions: { flexDirection: 'row', flexWrap: 'wrap', gap: Space.sm },
  choices: { flexDirection: 'row', flexWrap: 'wrap', gap: 4 },
  choice: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 10,
    borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.sm },
  chosen: { borderColor: Colors.gold300, backgroundColor: Colors.bg1 },
  input: { minHeight: 48, width: '100%', padding: 14, borderWidth: 1, borderColor: Colors.borderStrong,
    borderRadius: Radius.sm, backgroundColor: Colors.bg1, color: Colors.text0, fontFamily: Fonts.ui, fontSize: 16 },
});
