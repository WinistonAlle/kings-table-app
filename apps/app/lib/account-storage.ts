import { useTournamentStore } from '@/stores/tournamentStore';
import { usePresetsStore } from '@/stores/presetsStore';
import { useBlindsStore } from '@/stores/blindsStore';

let loading: Promise<void> = Promise.resolve();

export function loadAccountData(userId: string): Promise<void> {
  // Os tres stores devem trocar de conta como uma unica transicao serializada.
  const request = loading.then(() => hydrateAccount(userId));
  loading = request.catch(() => undefined);
  return request;
}

async function hydrateAccount(userId: string) {
  const stores = [
    { persist: useTournamentStore.persist, reset: () => useTournamentStore.setState(useTournamentStore.getInitialState(), true) },
    { persist: usePresetsStore.persist, reset: () => usePresetsStore.setState(usePresetsStore.getInitialState(), true) },
    { persist: useBlindsStore.persist, reset: () => useBlindsStore.setState(useBlindsStore.getInitialState(), true) },
  ];
  for (const store of stores) {
    if (!store.persist.hasHydrated()) await store.persist.rehydrate();
    if (!store.persist.hasHydrated()) throw new Error('Nao foi possivel carregar os dados locais da conta.');
    const options = store.persist.getOptions();
    const baseName = options.name!.split(':')[0];
    const name = `${baseName}:${userId}`;
    if (options.name === name) continue;
    // Resetar a memoria sem sobrescrever o arquivo da conta que vamos abrir.
    store.persist.setOptions({ storage: { getItem: () => null, setItem: () => undefined, removeItem: () => undefined } });
    store.reset();
    store.persist.setOptions({ name, storage: options.storage as never });
    await store.persist.rehydrate();
    if (!store.persist.hasHydrated()) throw new Error('Nao foi possivel carregar os dados locais da conta.');
  }
}
