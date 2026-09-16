import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from './supabase';
import { parseBackup, type AccountSnapshot } from './backup';
import { useTournamentStore } from '@/stores/tournamentStore';
import { usePresetsStore } from '@/stores/presetsStore';
import { useBlindsStore } from '@/stores/blindsStore';
import type { Json } from '@/types/supabase';

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
  // Preservar a copia anterior antes de qualquer substituicao na memoria.
  await AsyncStorage.setItem(`kt-before-restore:${userId}`, JSON.stringify(captureBackup(userId)));
  await checkAccount(userId);
  useTournamentStore.setState({ tournaments: snapshot.tournaments, activeTournamentId: snapshot.activeTournamentId });
  usePresetsStore.setState({ presets: snapshot.presets });
  useBlindsStore.setState(snapshot.blinds);
  useBlindsStore.getState().sync();
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
