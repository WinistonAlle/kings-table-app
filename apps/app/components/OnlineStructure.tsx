import { useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Space } from '@/constants/tokens';
import { confirmarAcao } from '@/lib/confirmar';
import { prepareStructureOperation } from '@/lib/sync-tournament-structure';
import { presetPayloadSchema } from '@/lib/sync-preset-model';
import type { SyncOperation } from '@/lib/sync-operation';
import type { TournamentSnapshot } from '@/lib/sync-tournament-reader';
import type { TournamentCatalogView } from '@/lib/sync-tournament-model';
import type { BlindLevel } from '@/types';
import type { TournamentSyncValue } from './TournamentSync.web';
import { StructureEditor } from './StructureEditor';
import { KTButton } from './ui/Button';
import { KTText } from './ui/Text';

export function OnlineStructure({ snapshot, view, sync, otherEditing, onDirtyChange, onRefresh }: {
  snapshot: TournamentSnapshot; view: TournamentCatalogView; sync: TournamentSyncValue;
  otherEditing: boolean; onDirtyChange: (dirty: boolean) => void; onRefresh: () => Promise<void>;
}) {
  const [draft, setDraft] = useState<BlindLevel[] | null>(null);
  const [saving, setSaving] = useState(false);
  const [retry, setRetry] = useState(false);
  const [message, setMessage] = useState('');
  const operation = useRef<SyncOperation | null>(null);
  const alive = useRef(true), busy = useRef(false);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  useEffect(() => { onDirtyChange(!!draft || retry); return () => onDirtyChange(false); }, [draft, retry, onDirtyChange]);
  const current = snapshot.tournament.revision === view.confirmed?.revision;
  const upcoming = snapshot.tournament.status === 'upcoming' && !snapshot.tournament.deleted_at;
  const structure = presetPayloadSchema.safeParse({ name: snapshot.tournament.name, levels: snapshot.tournament.blind_levels });
  const ready = structure.success && current && upcoming && sync.state.phase === 'ready' && !otherEditing
    && !view.pending.length && !view.awaitingCatalog && !view.reconciliationNeeded;
  const levels = structure.success ? structure.data.levels : [];
  const blindCount = levels.filter(level => !level.isBreak).length;
  const breakCount = levels.filter(level => level.isBreak).length;

  async function send() {
    if (busy.current || (!operation.current && (!ready || !draft))) return;
    busy.current = true; setSaving(true); setMessage('');
    try {
      operation.current ??= prepareStructureOperation(snapshot, draft);
      await sync.send(operation.current);
      if (!alive.current) return;
      operation.current = null; setRetry(false); setDraft(null);
      setMessage('Estrutura registrada. Aguardando confirmação da conta.');
      await onRefresh();
    } catch (error) {
      if (!alive.current) return;
      setRetry(!!operation.current);
      setMessage(operation.current ? 'Registro não confirmado. Tente novamente com a mesma estrutura.'
        : error instanceof Error ? error.message : 'Não foi possível registrar a estrutura.');
    } finally { busy.current = false; if (alive.current) setSaving(false); }
  }

  return <View style={styles.section}>
    <View style={styles.heading}>
      <Ionicons name="list-outline" size={22} color={Colors.gold300} />
      <KTText papel="corpoForte">Blinds e intervalos</KTText>
    </View>
    <KTText papel="apoio" color={Colors.text1}>{blindCount} {blindCount === 1 ? 'nível' : 'níveis'} · {breakCount} {breakCount === 1 ? 'intervalo' : 'intervalos'} · {levels.reduce((total, level) => total + level.durationMinutes, 0)} minutos</KTText>
    {!current ? <KTText papel="apoio" color={Colors.warn}>Estrutura desatualizada. Atualize os detalhes antes de editar.</KTText> : null}
    {!structure.success ? <KTText papel="apoio" color={Colors.danger}>Estrutura indisponível. Atualize os detalhes.</KTText> : null}
    {!upcoming ? <KTText papel="apoio" color={Colors.text2}>Estrutura protegida após o início da noite.</KTText> : null}
    {draft ? <>
      <StructureEditor levels={draft} onChange={setDraft} disabled={saving || retry || !ready} />
      <View style={styles.heading}>
        <KTButton label={saving ? 'Registrando estrutura…' : retry ? 'Tentar registrar estrutura novamente' : 'Salvar estrutura na conta'}
          disabled={saving || (!retry && !ready)}
          onPress={() => retry ? void send() : confirmarAcao('Salvar esta estrutura? O relógio de preparação voltará à duração da primeira linha e permanecerá pausado.', () => { void send(); })}
          icone={<Ionicons name="save-outline" size={18} color={Colors.bg0} />} />
        {!retry ? <KTButton label="Cancelar edição da estrutura" variant="fantasma" disabled={saving}
          onPress={() => confirmarAcao('Descartar as alterações ainda não registradas da estrutura?', () => { setDraft(null); setMessage(''); })} /> : null}
      </View>
    </> : upcoming ? <KTButton label="Editar blinds e intervalos online" variant="fantasma" size="sm" disabled={!ready || saving}
      icone={<Ionicons name="create-outline" size={18} color={Colors.gold200} />}
      onPress={() => { onDirtyChange(true); setDraft(levels.map(level => ({ ...level }))); setMessage(''); }} /> : null}
    {message ? <KTText accessibilityLiveRegion="polite" papel="apoio" color={Colors.gold200}>{message}</KTText> : null}
  </View>;
}

const styles = StyleSheet.create({
  section: { gap: Space.md, paddingVertical: Space.md, borderTopWidth: 1, borderColor: Colors.border },
  heading: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: Space.sm },
});
