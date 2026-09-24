import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from './supabase';
import { parseBackup, type AccountSnapshot } from './backup';
import { useTournamentStore } from '@/stores/tournamentStore';
import { usePresetsStore } from '@/stores/presetsStore';
import { useBlindsStore } from '@/stores/blindsStore';
import type { Json } from '@/types/supabase';
import { commitRestore } from './restore-transaction';
import { sincronizar } from './timer';
import { waitForLocalSaves } from './armazenamento';

export interface OnlineBackup { revision: number; updatedAt: string; snapshot: AccountSnapshot }

function checkStorage(userId: string) {
  const pairs = [
    [useTournamentStore.persist, 'kt-tournaments'],
    [usePresetsStore.persist, 'kt-structures'],
    [useBlindsStore.persist, 'kt-blinds'],
  ] as const;
  if (pairs.some(([persist, name]) => persist.getOptions().name !== `${name}:${userId}` || !persist.hasHydrated())) {
    throw new Error('A conta mudou. Entre novamente antes de continuar.');
  }
}

async function checkAccount(userId: string) {
  const { data, error } = await supabase.auth.getUser();
  if (error || data.user?.id !== userId) throw new Error('Sua sessao expirou. Entre novamente.');
  checkStorage(userId);
}

export function captureBackup(userId: string): AccountSnapshot {
  checkStorage(userId);
  const t = useTournamentStore.getState();
  const b = useBlindsStore.getState();
  return parseBackup({
    version: 1, tournaments: t.tournaments, activeTournamentId: t.activeTournamentId,
    presets: usePresetsStore.getState().presets,
    blinds: {
      tournamentId: b.tournamentId, clocks: b.clocks, structure: b.structure,
      currentLevel: b.currentLevel, secondsRemaining: b.secondsRemaining,
      levelEndsAt: b.levelEndsAt, isRunning: b.isRunning,
      handForHand: b.handForHand,
    },
  });
}

export async function readBackup(userId: string): Promise<OnlineBackup | null> {
  await checkAccount(userId);
  const { data, error } = await supabase.from('account_backups').select('revision,updated_at,snapshot').eq('owner_id', userId).maybeSingle();
  if (error) throw new Error('Nao foi possivel consultar a copia online. Verifique sua conexao.');
  checkStorage(userId);
  return data ? { revision: data.revision, updatedAt: data.updated_at, snapshot: parseBackup(data.snapshot) } : null;
}

export async function saveBackup(userId: string, expectedRevision: number) {
  await checkAccount(userId);
  const snapshot = captureBackup(userId);
  const { error } = await supabase.rpc('save_account_backup', {
    p_snapshot: snapshot as unknown as Json, p_expected_revision: expectedRevision,
  });
  if (error?.code === '40001') throw new Error('Outro aparelho atualizou a copia. Atualize a consulta antes de salvar novamente.');
  if (error) throw new Error('Nao foi possivel salvar online. Seus dados locais continuam intactos.');
  checkStorage(userId);
}

export async function restoreBackup(userId: string, backup: OnlineBackup) {
  const snapshot = parseBackup(backup.snapshot);
  await checkAccount(userId);
  if (!await waitForLocalSaves()) {
    throw new Error('Há alterações locais ainda não salvas. Salve novamente antes de restaurar a cópia online.');
  }
  checkStorage(userId);
  const previous = captureBackup(userId);
  const clock = snapshot.blinds;
  const target = {
    ...snapshot,
    blinds: {
      ...clock,
      ...sincronizar(clock.structure, clock.handForHand
        ? { ...clock, isRunning: false, levelEndsAt: null } : clock),
      handForHand: clock.handForHand ?? false,
    },
  };
  let editedDuringRestore = false;
  let applyingRestore = false;
  const tournamentState = useTournamentStore.getState();
  const presetsState = usePresetsStore.getState();
  const blindsState = useBlindsStore.getState();
  const unsubscribe = [
    useTournamentStore.subscribe(state => {
      if (!applyingRestore && (state.tournaments !== tournamentState.tournaments
        || state.activeTournamentId !== tournamentState.activeTournamentId)) editedDuringRestore = true;
    }),
    usePresetsStore.subscribe(state => {
      if (!applyingRestore && state.presets !== presetsState.presets) editedDuringRestore = true;
    }),
    useBlindsStore.subscribe(state => {
      if (!applyingRestore && (state.tournamentId !== blindsState.tournamentId
        || state.clocks !== blindsState.clocks || state.structure !== blindsState.structure
        || state.currentLevel !== blindsState.currentLevel || state.secondsRemaining !== blindsState.secondsRemaining
        || state.levelEndsAt !== blindsState.levelEndsAt || state.isRunning !== blindsState.isRunning
        || state.handForHand !== blindsState.handForHand)) editedDuringRestore = true;
    }),
  ];
  const apply = (data: AccountSnapshot) => {
    const t = useTournamentStore.persist;
    const p = usePresetsStore.persist;
    const b = useBlindsStore.persist;
    const storages = [t.getOptions().storage, p.getOptions().storage, b.getOptions().storage];
    const silentStorage = { getItem: () => null, setItem: () => undefined, removeItem: () => undefined };
    t.setOptions({ storage: silentStorage });
    p.setOptions({ storage: silentStorage });
    b.setOptions({ storage: silentStorage });
    applyingRestore = true;
    try {
      useTournamentStore.setState({ tournaments: data.tournaments, activeTournamentId: data.activeTournamentId });
      usePresetsStore.setState({ presets: data.presets });
      useBlindsStore.setState({ ...data.blinds, handForHand: data.blinds.handForHand ?? false });
    } finally {
      applyingRestore = false;
      t.setOptions({ storage: storages[0] });
      p.setOptions({ storage: storages[1] });
      b.setOptions({ storage: storages[2] });
    }
  };
  try {
    await checkAccount(userId);
    if (!await waitForLocalSaves()) {
      throw new Error('Há alterações locais ainda não salvas. Salve novamente antes de restaurar a cópia online.');
    }
    if (editedDuringRestore) throw new Error('Os dados foram alterados durante a restauração. Tente novamente.');
    await commitRestore(userId, target, previous, () => checkStorage(userId),
      () => { if (editedDuringRestore) throw new Error('Os dados foram alterados durante a restauração.'); },
      () => apply(target), () => { if (!editedDuringRestore) apply(previous); });
  } catch (error) {
    // The transaction rolled back its disk writes. Re-persist any newer edits
    // made while it was running, including edits queued during that rollback.
    if (editedDuringRestore && !await AsyncStorage.getItem(`kt-restore-journal:${userId}`)) {
      checkStorage(userId);
      const t = useTournamentStore.getState();
      const p = usePresetsStore.getState();
      const b = useBlindsStore.getState();
      useTournamentStore.setState({ tournaments: t.tournaments, activeTournamentId: t.activeTournamentId });
      usePresetsStore.setState({ presets: p.presets });
      useBlindsStore.setState({ tournamentId: b.tournamentId, clocks: b.clocks, structure: b.structure,
        currentLevel: b.currentLevel, secondsRemaining: b.secondsRemaining, levelEndsAt: b.levelEndsAt,
        isRunning: b.isRunning, handForHand: b.handForHand });
      if (!await waitForLocalSaves()) {
        throw new Error('Os dados mudaram durante a restauração, mas ainda não foram salvos neste aparelho. Tente salvar novamente antes de sair.');
      }
      throw new Error('Os dados mudaram durante a restauração e foram preservados. Confira a mesa antes de tentar novamente.');
    }
    throw error;
  } finally {
    unsubscribe.forEach(stop => stop());
  }
}

export async function hasPreviousBackup(userId: string) {
  checkStorage(userId);
  return (await AsyncStorage.getItem(`kt-before-restore:${userId}`)) !== null;
}

export async function undoRestore(userId: string) {
  await checkAccount(userId);
  const previous = await AsyncStorage.getItem(`kt-before-restore:${userId}`);
  if (!previous) throw new Error('Nao existe uma copia anterior neste aparelho.');
  await restoreBackup(userId, { snapshot: parseBackup(JSON.parse(previous)), revision: 0, updatedAt: '' });
}
