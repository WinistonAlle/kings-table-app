import { useTournamentStore } from '@/stores/tournamentStore';
import { usePresetsStore } from '@/stores/presetsStore';
import { useBlindsStore } from '@/stores/blindsStore';

export async function loadAccountData(userId: string) {
  const stores = [
    { persist: useTournamentStore.persist, reset: () => useTournamentStore.setState(useTournamentStore.getInitialState(), true) },
    { persist: usePresetsStore.persist, reset: () => usePresetsStore.setState(usePresetsStore.getInitialState(), true) },
    { persist: useBlindsStore.persist, reset: () => useBlindsStore.setState(useBlindsStore.getInitialState(), true) },
  ];
  for (const store of stores) {
    if (!store.persist.hasHydrated()) await store.persist.rehydrate();
    const options = store.persist.getOptions();
    const baseName = options.name!.split(':')[0];
    const name = `${baseName}:${userId}`;
    if (options.name === name) continue;
    // Resetar a memoria sem sobrescrever o arquivo da conta que vamos abrir.
    store.persist.setOptions({ storage: { getItem: () => null, setItem: () => undefined, removeItem: () => undefined } });
    store.reset();
    store.persist.setOptions({ name, storage: options.storage as never });
    await store.persist.rehydrate();
  }
}
