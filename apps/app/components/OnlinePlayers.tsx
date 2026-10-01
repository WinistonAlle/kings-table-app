import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Fonts, Radius, Space } from '@/constants/tokens';
import { confirmarAcao } from '@/lib/confirmar';
import { canRemoveAccountPlayer, playerTotalCents, preparePlayerOperation, type PlayerAction } from '@/lib/sync-tournament-players';
import type { SyncOperation } from '@/lib/sync-operation';
import type { TournamentSnapshot } from '@/lib/sync-tournament-reader';
import type { TournamentCatalogView } from '@/lib/sync-tournament-model';
import type { TournamentSyncValue } from './TournamentSync.web';
import { KTButton } from './ui/Button';
import { KTText } from './ui/Text';

const money = (cents: number) => (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const payment = { pending: 'Pendente', confirmed: 'Confirmado', disputed: 'Em revisão' };
type Draft = { kind: 'add'; name: string } | { kind: 'rename'; playerId: string; name: string };

export function OnlinePlayers({ snapshot, view, sync, onDirtyChange, onRefresh, otherEditing }: {
  snapshot: TournamentSnapshot; view: TournamentCatalogView; sync: TournamentSyncValue;
  onDirtyChange: (dirty: boolean) => void; onRefresh: () => Promise<void>; otherEditing: boolean;
}) {
  const [selected, setSelected] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [saving, setSaving] = useState(false);
  const [retry, setRetry] = useState(false);
  const [message, setMessage] = useState('');
  const operation = useRef<SyncOperation | null>(null);
  const busy = useRef(false);
  const alive = useRef(true);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  useEffect(() => { onDirtyChange(!!draft || retry); return () => onDirtyChange(false); }, [draft, retry, onDirtyChange]);
  const current = snapshot.tournament.revision === view.confirmed?.revision;
  const ready = current && !view.pending.length && !view.awaitingCatalog && !view.reconciliationNeeded
    && !snapshot.tournament.deleted_at && snapshot.tournament.status !== 'cancelled'
    && sync.state.phase === 'ready' && !otherEditing;
  const intake = ['upcoming', 'running'].includes(snapshot.tournament.status);

  async function send(action?: PlayerAction) {
    if (busy.current || (!operation.current && (!ready || !action))) return;
    busy.current = true; setSaving(true); setMessage('');
    try {
      // Keep the original payload and identity if durable enqueue cannot be acknowledged.
      operation.current ??= preparePlayerOperation(snapshot, action!);
      await sync.send(operation.current);
      if (!alive.current) return;
      operation.current = null; setRetry(false); setDraft(null);
      setMessage('Alteração registrada. A fila e os dados da conta mostram a confirmação.');
      await onRefresh();
    } catch (error) {
      if (!alive.current) return;
      setRetry(!!operation.current);
      setMessage(operation.current ? 'Não foi possível confirmar o registro. Tente novamente com a mesma alteração.'
        : error instanceof Error ? error.message : 'Não foi possível registrar esta alteração.');
    } finally { busy.current = false; if (alive.current) setSaving(false); }
  }
  const confirm = (action: PlayerAction, text: string) => confirmarAcao(text, () => { void send(action); });
  function openForm(next: Draft) { onDirtyChange(true); setDraft(next); setMessage(''); }

  return <View style={styles.section}>
    <View style={styles.heading}>
      <KTText papel="corpoForte">Jogadores da conta</KTText>
      {intake ? <KTButton label="Adicionar jogador online" size="sm" disabled={!ready || saving || !!draft || retry}
        icone={<Ionicons name="person-add-outline" size={18} color={Colors.bg0} />}
        onPress={() => openForm({ kind: 'add', name: '' })} /> : null}
    </View>
    {!current ? <KTText papel="apoio" color={Colors.warn}>Jogadores desatualizados. Atualize os detalhes antes de alterar.</KTText> : null}
    {draft ? <View style={styles.form}>
      <KTText papel="apoio" color={Colors.text1}>{draft.kind === 'add' ? 'Novo jogador · Uma entrada no valor do buy-in' : 'Nome do jogador'}</KTText>
      <TextInput accessibilityLabel="Nome do jogador online" value={draft.name} maxLength={60}
        editable={!saving && !retry} onChangeText={name => setDraft({ ...draft, name })}
        placeholder="Nome do jogador" placeholderTextColor={Colors.text2} style={styles.input} />
      <View style={styles.actions}>
        <KTButton label={draft.kind === 'add' ? 'Registrar jogador na conta' : 'Salvar nome na conta'}
          disabled={!ready || saving || retry || !draft.name.trim()} onPress={() => { void send(draft); }} />
        {!retry ? <KTButton label="Cancelar edição do jogador" variant="fantasma" disabled={saving}
          onPress={() => { setDraft(null); setMessage(''); }} /> : null}
      </View>
    </View> : null}
    {retry ? <KTButton label="Tentar registrar jogador novamente" disabled={saving} onPress={() => { void send(); }} /> : null}
    {message ? <KTText papel="apoio" accessibilityLiveRegion="polite" color={Colors.gold200}>{message}</KTText> : null}
    {!snapshot.players.length ? <KTText papel="apoio" color={Colors.text2}>Nenhum jogador registrado.</KTText> : null}
    {snapshot.players.map(player => {
      let total: number | null = null;
      try { total = playerTotalCents(snapshot, player); } catch { /* Invalid totals disable financial controls. */ }
      const locked = !ready || saving || !!draft || retry;
      const active = selected === player.id;
      return <View key={player.id} style={styles.player}>
        <View style={styles.heading}>
          <View style={styles.identity}>
            <KTText papel="corpoForte">{player.display_name}</KTText>
            <KTText papel="apoio" color={Colors.text1}>{player.buy_ins} entrada · {player.re_entries} reentradas · {player.add_ons} add-ons</KTText>
          </View>
          <Pressable accessibilityRole="button" accessibilityLabel={`Gerenciar ${player.display_name}`}
            accessibilityState={{ expanded: active }} style={styles.icon} onPress={() => setSelected(active ? null : player.id)}>
            <Ionicons name={active ? 'chevron-up-outline' : 'chevron-down-outline'} size={22} color={Colors.gold200} />
          </Pressable>
        </View>
        <KTText papel="apoio" color={Colors.text1}>{total === null ? 'Total indisponível' : `Total ${money(total)}`} · Pagamento: {payment[player.payment_status]}</KTText>
        {player.position ? <KTText papel="apoio" color={Colors.gold200}>{player.position}º lugar{player.prize !== null ? ` · Prêmio ${money(Math.round(player.prize * 100))}` : ''}</KTText> : null}
        {active ? <View style={styles.management}>
          <KTButton label="Alterar nome" accessibilityLabel={`Alterar nome de ${player.display_name}`} variant="fantasma" size="sm" disabled={locked}
            icone={<Ionicons name="create-outline" size={18} color={Colors.gold200} />}
            onPress={() => openForm({ kind: 'rename', playerId: player.id, name: player.display_name })} />
          {intake && total !== null ? <>
            <KTText papel="apoio" color={Colors.text1}>Compras · {money(Math.round(snapshot.tournament.buy_in * 100))} por unidade</KTText>
            <View style={styles.actions}>
              {(['reEntry', 'addOn'] as const).map(entryKind => {
                const count = entryKind === 'reEntry' ? player.re_entries : player.add_ons;
                const label = entryKind === 'reEntry' ? 'reentrada' : 'add-on';
                const limit = entryKind === 'reEntry' ? (!snapshot.tournament.re_entry_allowed || count >= snapshot.tournament.max_re_entries) : count >= 1000;
                return <View key={entryKind} style={styles.purchase}>
                  <KTButton label={`Registrar ${label}`} accessibilityLabel={`Registrar ${label} de ${player.display_name}`} size="sm" variant="fantasma" disabled={locked || limit}
                    icone={<Ionicons name="add-outline" size={18} color={Colors.gold200} />}
                    onPress={() => confirm({ kind: 'entry', playerId: player.id, entryKind, delta: 1 },
                      `Registrar ${label} para ${player.display_name}? Novo total: ${money(total! + Math.round(snapshot.tournament.buy_in * 100))}.`)} />
                  {count > 0 ? <KTButton label={`Corrigir ${label}`} accessibilityLabel={`Corrigir ${label} de ${player.display_name}`} size="sm" variant="fantasma"
                    disabled={locked || player.payment_status !== 'pending'}
                    icone={<Ionicons name="remove-outline" size={18} color={Colors.gold200} />}
                    onPress={() => confirm({ kind: 'entry', playerId: player.id, entryKind, delta: -1 },
                      `Retirar uma ${label} registrada por engano para ${player.display_name}? Novo total: ${money(total! - Math.round(snapshot.tournament.buy_in * 100))}. O histórico da correção será preservado.`)} /> : null}
                </View>;
              })}
            </View>
            <KTText papel="apoio" color={Colors.text1}>Pagamento do total · {money(total)}</KTText>
            <View style={styles.actions}>
              {(['pending', 'confirmed', 'disputed'] as const).map(status => <KTButton key={status}
                label={payment[status]} accessibilityLabel={`${payment[status]} · ${player.display_name}`} variant="fantasma" size="sm"
                disabled={locked || status === player.payment_status}
                onPress={() => confirm({ kind: 'payment', playerId: player.id, status },
                  `Marcar o pagamento de ${player.display_name} como ${payment[status].toLowerCase()}? Total: ${money(total!)}. Esta ação ficará no histórico da conta.`)} />)}
            </View>
          </> : null}
          {canRemoveAccountPlayer(snapshot, player) ? <KTButton label="Retirar entrada" accessibilityLabel={`Retirar entrada de ${player.display_name}`} variant="perigo" size="sm" disabled={locked}
            icone={<Ionicons name="trash-outline" size={18} color={Colors.danger} />}
            onPress={() => confirm({ kind: 'remove', playerId: player.id }, `Retirar a entrada de ${player.display_name} desta mesa? A conta verificará se não há comprovantes ou histórico que impeçam a retirada.`)} /> : null}
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
  player: { gap: Space.sm, paddingVertical: Space.md, borderBottomWidth: 1, borderColor: Colors.border },
  form: { gap: Space.sm }, management: { gap: Space.md, paddingTop: Space.sm },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: Space.sm }, purchase: { gap: Space.sm, maxWidth: '100%' },
  input: { minHeight: 48, width: '100%', padding: 14, borderWidth: 1, borderColor: Colors.borderStrong,
    borderRadius: Radius.sm, backgroundColor: Colors.bg1, color: Colors.text0, fontFamily: Fonts.ui, fontSize: 16 },
});
