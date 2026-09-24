import AsyncStorage from '@react-native-async-storage/async-storage';
import type { AccountSnapshot } from './backup';

type Entry = { key: string; value: string | null };
type Journal = { version: 1; ownerId: string; entries: Entry[]; previousBackup: string | null };

const dataKeys = (ownerId: string) => [
  `kt-tournaments:${ownerId}`, `kt-structures:${ownerId}`, `kt-blinds:${ownerId}`,
];
const journalKey = (ownerId: string) => `kt-restore-journal:${ownerId}`;
const beforeKey = (ownerId: string) => `kt-before-restore:${ownerId}`;

function parseJournal(raw: string, ownerId: string): Journal {
  let value: unknown;
  try { value = JSON.parse(raw); } catch { value = null; }
  const journal = value as Journal | null;
  const keys = dataKeys(ownerId);
  if (!journal || journal.version !== 1 || journal.ownerId !== ownerId
    || !Array.isArray(journal.entries) || journal.entries.length !== keys.length
    || !journal.entries.every((entry, index) => entry?.key === keys[index]
      && (entry.value === null || typeof entry.value === 'string'))
    || (journal.previousBackup !== null && typeof journal.previousBackup !== 'string')) {
    throw new Error('A recuperação local está incompleta. Nenhum dado foi carregado.');
  }
  return journal;
}

async function putRaw(key: string, value: string | null) {
  if (value === null) await AsyncStorage.removeItem(key);
  else await AsyncStorage.setItem(key, value);
}

async function rollback(journal: Journal) {
  for (const entry of journal.entries) await putRaw(entry.key, entry.value);
  await putRaw(beforeKey(journal.ownerId), journal.previousBackup);
}

export async function recoverInterruptedRestore(ownerId: string): Promise<boolean> {
  const key = journalKey(ownerId);
  const raw = await AsyncStorage.getItem(key);
  if (raw === null) return false;
  const journal = parseJournal(raw, ownerId);
  await rollback(journal);
  await AsyncStorage.removeItem(key);
  return true;
}

const restoring = new Set<string>();

export async function commitRestore(ownerId: string, target: AccountSnapshot, previous: AccountSnapshot,
  assertOwner: () => void, assertUnchanged: () => void, applyTarget: () => void, applyPrevious: () => void) {
  if (restoring.has(ownerId)) throw new Error('Outra restauração desta conta já está em andamento.');
  restoring.add(ownerId);
  try {
    if (await recoverInterruptedRestore(ownerId)) {
      throw new Error('Uma restauração anterior foi recuperada. Reabra a conta antes de tentar novamente.');
    }
    const keys = dataKeys(ownerId);
    const entries = await Promise.all(keys.map(async key => ({ key, value: await AsyncStorage.getItem(key) })));
    const journal: Journal = { version: 1, ownerId, entries,
      previousBackup: await AsyncStorage.getItem(beforeKey(ownerId)) };
    const next = [
      { tournaments: target.tournaments, activeTournamentId: target.activeTournamentId },
      { presets: target.presets },
      target.blinds,
    ];
    await AsyncStorage.setItem(journalKey(ownerId), JSON.stringify(journal));
    let applied = false;
    try {
      assertOwner();
      assertUnchanged();
      await AsyncStorage.setItem(beforeKey(ownerId), JSON.stringify(previous));
      for (let index = 0; index < keys.length; index++) {
        assertOwner();
        assertUnchanged();
        await AsyncStorage.setItem(keys[index], JSON.stringify({ state: next[index], version: 0 }));
      }
      assertOwner();
      assertUnchanged();
      applied = true;
      applyTarget();
      await AsyncStorage.removeItem(journalKey(ownerId));
    } catch {
      try {
        await rollback(journal);
        if (applied) { assertOwner(); applyPrevious(); }
        await AsyncStorage.removeItem(journalKey(ownerId));
      } catch {
        throw new Error('A restauração foi interrompida e não pôde ser revertida. Não altere os dados locais; libere espaço e reabra o aplicativo para recuperar a versão anterior.');
      }
      throw new Error('Não foi possível restaurar a cópia. Os dados locais anteriores foram preservados.');
    }
  } finally {
    restoring.delete(ownerId);
  }
}
