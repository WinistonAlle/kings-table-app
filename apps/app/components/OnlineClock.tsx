import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Space } from '@/constants/tokens';
import { confirmarAcao } from '@/lib/confirmar';
import { clockLevels, clockMatchesSnapshot, observedClockSeconds, prepareClockOperation,
  type AccountClockAction, type ClockObservation } from '@/lib/sync-tournament-clock';
import type { SyncOperation } from '@/lib/sync-operation';
import type { TournamentSnapshot } from '@/lib/sync-tournament-reader';
import type { TournamentCatalogView } from '@/lib/sync-tournament-model';
import type { TournamentSyncValue } from './TournamentSync.web';
import { KTButton } from './ui/Button';
import { KTText } from './ui/Text';

export function OnlineClock({ snapshot, view, sync, otherEditing, onBusyChange, onDirtyChange, onRefresh }: {
  snapshot: TournamentSnapshot; view: TournamentCatalogView; sync: TournamentSyncValue; otherEditing: boolean;
  onBusyChange: (busy: boolean) => void; onDirtyChange: (dirty: boolean) => void; onRefresh: () => Promise<void>;
}) {
  const [observation, setObservation] = useState<ClockObservation | null>(null);
  const [now, setNow] = useState(() => performance.now());
  const [reading, setReading] = useState(true);
  const [error, setError] = useState(false);
  const [saving, setSaving] = useState(false);
  const [retry, setRetry] = useState(false);
  const [message, setMessage] = useState('');
  const operation = useRef<SyncOperation | null>(null);
  const busy = useRef(false);
  const alive = useRef(true);
  const source = useRef(sync); source.current = sync;
  const update = useRef<() => Promise<void>>(async () => undefined);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  useEffect(() => {
    let active = true, pending = false, failed = false, lastAttempt = -Infinity;
    let latest: ClockObservation | null = null;
    async function read() {
      if (pending || !active) return;
      pending = true; lastAttempt = performance.now(); setReading(true);
      try {
        const clock = await source.current.clock(snapshot.tournament.id);
        if (!active) return;
        const receivedAt = performance.now();
        latest = { clock, receivedAt, roundTripMs: receivedAt - lastAttempt };
        failed = false;
        setObservation(latest); setNow(receivedAt); setError(false);
      } catch { if (active) { failed = true; setError(true); } }
      finally { pending = false; if (active) setReading(false); }
    }
    update.current = read;
    void read();
    const tick = setInterval(() => {
      if (document.visibilityState === 'hidden') return;
      const current = performance.now(); setNow(current);
      const boundary = !failed && latest?.clock.isRunning && observedClockSeconds(latest, current) === 0;
      if (current - lastAttempt >= 15000 || (boundary && current - lastAttempt >= 1000)) void read();
    }, 250);
    const refresh = () => { if (document.visibilityState !== 'hidden') void read(); };
    window.addEventListener('online', refresh); window.addEventListener('focus', refresh);
    document.addEventListener('visibilitychange', refresh);
    return () => {
      active = false; clearInterval(tick);
      window.removeEventListener('online', refresh); window.removeEventListener('focus', refresh);
      document.removeEventListener('visibilitychange', refresh);
    };
  }, [snapshot.tournament.id, snapshot.tournament.revision]);
  const levels = clockLevels(snapshot);
  const clock = observation?.clock;
  const matches = !!clock && clockMatchesSnapshot(snapshot, clock);
  const current = snapshot.tournament.revision === view.confirmed?.revision;
  const stale = !observation || now - observation.receivedAt > 30000;
  const blocking = reading || error || !matches || !current || stale || saving || retry;
  useEffect(() => { onBusyChange(blocking); return () => onBusyChange(false); }, [blocking, onBusyChange]);
  useEffect(() => { onDirtyChange(retry); return () => onDirtyChange(false); }, [retry, onDirtyChange]);
  const ready = !blocking && !otherEditing && !view.pending.length && !view.awaitingCatalog
    && !view.reconciliationNeeded && sync.state.phase === 'ready' && !snapshot.tournament.deleted_at;
  const seconds = observation ? observedClockSeconds(observation, now) : 0;
  const level = clock ? levels[clock.currentLevel] : null;
  const next = clock ? levels[clock.currentLevel + 1] : null;
  const running = snapshot.tournament.status === 'running';
  const state = snapshot.tournament.status === 'finished' ? 'Noite encerrada'
    : snapshot.tournament.status === 'upcoming' ? 'Em preparação'
      : clock?.handForHand ? 'Hand-for-hand · Congelado'
        : clock?.isRunning ? 'Em andamento' : seconds === 0 ? 'Estrutura concluída' : 'Pausado';

  async function send(action?: AccountClockAction) {
    if (busy.current || (!operation.current && (!ready || !clock || !action))) return;
    busy.current = true; setSaving(true); setMessage('');
    try {
      operation.current ??= prepareClockOperation(snapshot, clock!, action!);
      await sync.send(operation.current);
      if (!alive.current) return;
      operation.current = null; setRetry(false);
      setMessage('Comando registrado. Confira a confirmação na conta.');
      await onRefresh();
    } catch (error) {
      if (!alive.current) return;
      setRetry(!!operation.current);
      setMessage(operation.current ? 'Não foi possível confirmar o registro. Reenvie este mesmo comando.'
        : error instanceof Error ? error.message : 'Não foi possível alterar o relógio.');
    } finally { busy.current = false; if (alive.current) setSaving(false); }
  }
  const command = (action: AccountClockAction, text: string) => confirmarAcao(text, () => { void send(action); });
  return <View style={styles.section}>
    <View style={styles.heading}>
      <KTText papel="corpoForte">Relógio da conta</KTText>
      <KTButton label="Atualizar relógio online" variant="fantasma" size="sm" disabled={reading}
        icone={<Ionicons name="refresh-outline" size={18} color={Colors.gold200} />}
        onPress={() => { void update.current(); }} />
    </View>
    {!observation && reading ? <ActivityIndicator accessibilityLabel="Lendo relógio da conta" color={Colors.gold300} /> : null}
    <KTText papel="apoio" color={Colors.gold200}>{state}</KTText>
    {observation ? <>
      <KTText accessibilityLabel="Tempo do relógio online" papel="numeroForte" size={64}
        color={level?.isBreak ? Colors.ok : seconds <= 60 && clock?.isRunning ? Colors.warn : Colors.text0}
        style={styles.time}>{`${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`}</KTText>
      <KTText papel="corpoForte">{level?.isBreak ? 'Intervalo' : `Nível ${level?.level ?? 'indisponível'}`}</KTText>
      {level && !level.isBreak ? <KTText papel="numero">{level.smallBlind.toLocaleString('pt-BR')} / {level.bigBlind.toLocaleString('pt-BR')} · Ante {level.ante.toLocaleString('pt-BR')}</KTText> : null}
      <KTText papel="apoio" color={Colors.text1}>{next ? next.isBreak ? 'A seguir: intervalo'
        : `A seguir: ${next.smallBlind.toLocaleString('pt-BR')} / ${next.bigBlind.toLocaleString('pt-BR')} · Ante ${next.ante.toLocaleString('pt-BR')}` : 'Último nível da estrutura'}</KTText>
    </> : null}
    {error || stale ? <KTText papel="apoio" color={Colors.warn}>Sem confirmação recente. O tempo exibido é estimado; atualize antes de controlar.</KTText>
      : !matches || !current ? <KTText papel="apoio" color={Colors.warn}>A mesa mudou. Atualize os detalhes para alinhar o relógio.</KTText> : null}
    {snapshot.tournament.status === 'upcoming' ? <KTButton label="Iniciar noite na conta"
      disabled={!ready || !snapshot.players.length} icone={<Ionicons name="flag-outline" size={18} color={Colors.bg0} />}
      onPress={() => command({ kind: 'startNight' }, 'Iniciar esta noite na conta? O relógio fica pausado até você dar o primeiro play.')} /> : null}
    {running && clock ? <>
      <View style={styles.actions}>
        <KTButton label={clock.isRunning ? 'Pausar relógio online' : 'Retomar relógio online'}
          disabled={!ready || (!clock.isRunning && (clock.handForHand || seconds === 0))}
          icone={<Ionicons name={clock.isRunning ? 'pause-outline' : 'play-outline'} size={20} color={Colors.bg0} />}
          onPress={() => { void send({ kind: clock.isRunning ? 'pause' : 'resume' }); }} />
        <KTButton label="Nível anterior online" variant="fantasma" size="sm" disabled={!ready || clock.currentLevel === 0}
          icone={<Ionicons name="play-back-outline" size={18} color={Colors.gold200} />}
          onPress={() => command({ kind: 'level', level: clock.currentLevel - 1 }, 'Voltar um nível e reiniciar sua duração completa?')} />
        <KTButton label="Próximo nível online" variant="fantasma" size="sm" disabled={!ready || clock.currentLevel >= levels.length - 1}
          icone={<Ionicons name="play-forward-outline" size={18} color={Colors.gold200} />}
          onPress={() => command({ kind: 'level', level: clock.currentLevel + 1 }, 'Avançar um nível e iniciar sua duração completa?')} />
      </View>
      <View style={styles.actions}>
        <KTButton label={clock.handForHand ? 'Encerrar hand-for-hand online' : 'Congelar hand-for-hand online'} variant="fantasma" size="sm" disabled={!ready}
          onPress={() => command({ kind: 'hand', enabled: !clock.handForHand }, clock.handForHand
            ? 'Encerrar o hand-for-hand? O relógio fica pausado até a retomada.' : 'Congelar o relógio para hand-for-hand?')} />
        <KTButton label="Reiniciar relógio online" variant="perigo" size="sm" disabled={!ready}
          icone={<Ionicons name="refresh-outline" size={18} color={Colors.danger} />}
          onPress={() => command({ kind: 'reset' }, 'Reiniciar o relógio no primeiro nível, pausado? Jogadores e pagamentos serão preservados.')} />
      </View>
    </> : null}
    {retry ? <KTButton label="Reenviar comando do relógio" disabled={saving} onPress={() => { void send(); }} /> : null}
    {message ? <KTText papel="apoio" accessibilityLiveRegion="polite" color={Colors.gold200}>{message}</KTText> : null}
  </View>;
}

const styles = StyleSheet.create({
  section: { gap: Space.md, paddingVertical: Space.lg, borderTopWidth: 1, borderColor: Colors.border },
  heading: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: Space.sm },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: Space.sm },
  time: { fontVariant: ['tabular-nums'], width: '100%' },
});
