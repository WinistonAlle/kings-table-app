import AsyncStorage from '@react-native-async-storage/async-storage';
import { createJSONStorage, type StateStorage } from 'zustand/middleware';

/* Onde o estado do app sobrevive ao app fechar.
 *
 * É AsyncStorage e não MMKV, apesar de o MMKV estar no package.json e ser mais
 * rápido: o MMKV 4 é módulo nativo com Nitro e exige build própria. Este
 * projeto não tem `expo-dev-client`, ou seja, roda no Expo Go, onde importar
 * MMKV quebra na hora. AsyncStorage funciona nos dois mundos.
 *
 * Se um dia houver build própria, trocar é mudar só este arquivo.
 */
const failed = new Map<string, string | null>();
const latest = new Map<string, string | null>();
const writes = new Map<string, Promise<void>>();
const listeners = new Set<() => void>();

export const localSaveFailureCount = () => failed.size;
export const hasPendingLocalSaves = () => failed.size > 0 || writes.size > 0;
export const subscribeLocalSaveFailures = (listener: () => void) => {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
};

function report(key: string, value: string | null, success: boolean) {
  const before = failed.size;
  if (success) failed.delete(key);
  else failed.set(key, value);
  if (failed.size !== before) listeners.forEach(listener => listener());
}

function enqueue(key: string, value: string | null): Promise<void> {
  latest.set(key, value);
  const previous = writes.get(key) ?? Promise.resolve();
  const task = previous.then(async () => {
    try {
      if (value === null) await AsyncStorage.removeItem(key);
      else await AsyncStorage.setItem(key, value);
      report(key, value, true);
    } catch {
      // Zustand does not await writes from synchronous store actions.
      // Keep the latest snapshot in memory and surface the failure to the user.
      report(key, value, false);
    }
  });
  writes.set(key, task);
  void task.then(() => {
    if (writes.get(key) === task) {
      writes.delete(key);
      if (!failed.has(key)) latest.delete(key);
    }
  });
  return task;
}

export async function retryPendingLocalSaves(): Promise<boolean> {
  await Promise.all([...failed.keys()].map(key => enqueue(key, latest.has(key) ? latest.get(key)! : failed.get(key)!)));
  return failed.size === 0;
}

export async function waitForLocalSaves(timeoutMs = 5000): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  while (writes.size > 0) {
    const remaining = deadline - Date.now();
    if (remaining <= 0) return false;
    const completed = await new Promise<boolean>(resolve => {
      const timer = setTimeout(() => resolve(false), remaining);
      void Promise.all([...writes.values()]).then(() => { clearTimeout(timer); resolve(true); });
    });
    if (!completed) return false;
  }
  return failed.size === 0;
}

const storage: StateStorage = {
  getItem: async key => {
    await writes.get(key);
    return AsyncStorage.getItem(key);
  },
  setItem: (key, value) => enqueue(key, value),
  removeItem: key => enqueue(key, null),
};

export const armazenamento = createJSONStorage(() => storage);
