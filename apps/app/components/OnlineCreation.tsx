import { useState } from 'react';
import { ScrollView, View, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { Colors, Space } from '@/constants/tokens';
import { confirmarAcao } from '@/lib/confirmar';
import { tournamentCreatePayloadSchema } from '@/lib/sync-tournament-create';
import type { SyncOperation } from '@/lib/sync-operation';
import type { TournamentCatalogView } from '@/lib/sync-tournament-model';
import type { TournamentSyncValue } from './TournamentSync.web';
import { KTScreen } from './ui/Screen';
import { KTText } from './ui/Text';
import { KTButton } from './ui/Button';

function CreationAttempt({ operation, view, sync }: {
  operation: SyncOperation; view?: TournamentCatalogView; sync: TournamentSyncValue;
}) {
  const [message, setMessage] = useState('');
  const [resolving, setResolving] = useState(false);
  const parsed = tournamentCreatePayloadSchema.safeParse(operation.payload);
  const first = view?.pending[0];
  const definitive = !!first && ['conflict', 'rejected'].includes(first.status)
    && view!.pending.every(entry => ['queued', 'conflict', 'rejected'].includes(entry.status));
  const archived = view?.archived.some(entry => entry.operation.id === operation.id);
  async function resolve() {
    if (!view) return;
    setResolving(true); setMessage('');
    try {
      await sync.resolve(operation.entityId, { expectedBase: view.confirmed,
        pendingOperationIds: view.pending.map(entry => entry.operation.id), decision: { kind: 'keep_remote' } });
      setMessage('Tentativa arquivada neste aparelho.');
    } catch { setMessage('A fila mudou ou não foi possível atualizá-la. Atualize as mesas e revise novamente.'); }
    finally { setResolving(false); }
  }
  return <View style={styles.attempt}>
    <KTText papel="corpoForte">{parsed.success ? parsed.data.name : 'Tentativa de criação'}</KTText>
    {parsed.success ? <>
      <KTText papel="apoio" color={Colors.text1}>Buy-in {parsed.data.buyIn.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} · {new Date(parsed.data.startTime).toLocaleString('pt-BR')}</KTText>
      <KTText papel="apoio" color={Colors.text1}>{parsed.data.location || 'Local a combinar'} · {parsed.data.capacity ? `${parsed.data.capacity} vagas` : 'Sem limite de vagas'}</KTText>
    </> : null}
    <KTText papel="apoio" color={archived ? Colors.text2 : Colors.gold200}>
      {archived ? 'Criação arquivada · Dados da tentativa preservados'
        : first?.status === 'rejected' ? 'A criação não foi aceita pela conta'
            : first?.status === 'conflict' ? 'A identidade desta mesa já mudou na conta'
              : view?.confirmed ? 'Mesa criada na conta · Em preparação'
              : view?.awaitingCatalog ? 'Criação confirmada · Aguardando a lista da conta'
                : first?.status === 'sending' ? 'Enviando criação da mesa' : 'Criação aguardando confirmação'}</KTText>
    {definitive ? <KTButton label="Arquivar tentativa de criação" variant="fantasma" size="sm"
      disabled={resolving || sync.state.phase !== 'ready'} onPress={() => confirmarAcao(
        'Arquivar esta tentativa e as alterações dependentes? Nada será removido da conta e os dados da tentativa serão preservados neste aparelho.', () => { void resolve(); })} /> : null}
    {message ? <KTText accessibilityLiveRegion="polite" papel="apoio" color={Colors.gold200}>{message}</KTText> : null}
  </View>;
}

export function UnconfirmedCreations({ sync }: { sync: TournamentSyncValue }) {
  const [history, setHistory] = useState(false);
  const views = sync.state.views.filter(view => !view.confirmed);
  const pending = views.filter(view => view.pending.some(entry => entry.operation.kind === 'tournament.create') || view.awaitingCatalog);
  const archived = views.filter(view => view.archived.some(entry => entry.operation.kind === 'tournament.create'));
  const source = (view: TournamentCatalogView) => [...view.pending, ...view.archived].find(entry => entry.operation.kind === 'tournament.create')?.operation;
  return <View style={{ gap: Space.md }}>
    {pending.map(view => {
      const operation = source(view);
      return operation ? <CreationAttempt key={view.id} operation={operation} view={view} sync={sync} />
        : <KTText key={view.id} papel="apoio" color={Colors.gold200}>Criação confirmada · Atualize a lista da conta</KTText>;
    })}
    {archived.length ? <KTButton label={history ? 'Ocultar criações arquivadas' : `Ver criações arquivadas (${archived.length})`}
      variant="fantasma" size="sm" onPress={() => setHistory(!history)} /> : null}
    {history ? archived.map(view => {
      const operation = source(view);
      return operation ? <CreationAttempt key={view.id} operation={operation} view={view} sync={sync} /> : null;
    }) : null}
  </View>;
}

export function OnlineCreationResult({ operation, sync, sending, error, retry }: {
  operation: SyncOperation; sync: TournamentSyncValue; sending: boolean; error: string; retry: () => void;
}) {
  const view = sync.state.views.find(row => row.id === operation.entityId);
  return <KTScreen edges={['top', 'bottom']}><ScrollView contentContainerStyle={styles.result}>
    <KTText papel="subtitulo">Criação na conta</KTText>
    <CreationAttempt operation={operation} view={view} sync={sync} />
    {error ? <KTText accessibilityLiveRegion="polite" color={Colors.danger}>{error}</KTText> : null}
    {!view?.confirmed && !view?.archived.length ? <KTButton label={sending ? 'Registrando criação…' : 'Tentar confirmar criação'}
      disabled={sending || !!view?.reconciliationNeeded} onPress={retry} /> : null}
    <KTButton label="Ver mesas" variant="fantasma" onPress={() => router.replace('/history')} />
  </ScrollView></KTScreen>;
}

const styles = StyleSheet.create({
  attempt: { gap: Space.sm, paddingVertical: Space.md, borderBottomWidth: 1, borderColor: Colors.border },
  result: { width: '100%', maxWidth: 760, alignSelf: 'center', padding: Space.xl, gap: Space.lg },
});
