import assert from 'node:assert/strict';

async function main() {
  const disk = new Map<string, string>();
  let failures = 0;
  const localStorage = {
    getItem: (key: string) => disk.get(key) ?? null,
    setItem: (key: string, value: string) => {
      if (key === 'kt-tournaments:save-a' && failures > 0) {
        failures--;
        throw new Error('Quota exceeded');
      }
      disk.set(key, value);
    },
    removeItem: (key: string) => { disk.delete(key); },
  };
  Object.defineProperty(globalThis, 'window', { value: { localStorage }, configurable: true });

  const { loadAccountData } = await import('../lib/account-storage');
  const { useTournamentStore } = await import('../stores/tournamentStore');
  const { armazenamento, hasPendingLocalSaves, localSaveFailureCount, retryPendingLocalSaves, waitForLocalSaves } = await import('../lib/armazenamento');
  const AsyncStorage = (await import('@react-native-async-storage/async-storage')).default;
  const create = (name: string) => useTournamentStore.getState().createTournament({
    name, format: 'regular', buyIn: 20, reEntryAllowed: false, maxReEntries: 0,
    startTime: '', blindStructure: [], createdBy: 'save-a',
  });
  const settled = () => new Promise(resolve => setTimeout(resolve, 0));

  await loadAccountData('save-a');
  failures = 2;
  create('Primeira mesa');
  await settled();
  assert.equal(localSaveFailureCount(), 1);
  assert.equal(disk.has('kt-tournaments:save-a'), false);
  create('Segunda mesa');
  await settled();
  assert.equal(useTournamentStore.getState().tournaments.length, 2);
  assert.equal(hasPendingLocalSaves(), true);
  assert.equal(await retryPendingLocalSaves(), true);
  assert.equal(localSaveFailureCount(), 0);
  assert.deepEqual(JSON.parse(disk.get('kt-tournaments:save-a')!).state.tournaments.map((t: { name: string }) => t.name),
    ['Primeira mesa', 'Segunda mesa'], 'retry salva o estado mais recente');

  failures = 1;
  create('Terceira mesa');
  await settled();
  assert.equal(hasPendingLocalSaves(), true);
  await loadAccountData('save-b');
  assert.equal(useTournamentStore.getState().tournaments.length, 0);
  assert.equal(await retryPendingLocalSaves(), true, 'retry ainda salva a conta anterior');
  await loadAccountData('save-a');
  assert.equal(useTournamentStore.getState().tournaments.length, 3);

  const slowKey = 'kt-structures:slow-write';
  const originalSetItem = AsyncStorage.setItem;
  let release!: () => void;
  let started!: () => void;
  const blocked = new Promise<void>(resolve => { release = resolve; });
  const writing = new Promise<void>(resolve => { started = resolve; });
  let first = true;
  Object.defineProperty(AsyncStorage, 'setItem', { configurable: true, value: async (key: string, value: string) => {
    if (key === slowKey && first) { first = false; started(); await blocked; }
    return originalSetItem(key, value);
  } });
  try {
    const one = armazenamento!.setItem(slowKey, { state: { name: 'primeira' }, version: 0 });
    await writing;
    const two = armazenamento!.setItem(slowKey, { state: { name: 'segunda' }, version: 0 });
    assert.equal(hasPendingLocalSaves(), true, 'escrita pendente bloqueia saida');
    assert.equal(await waitForLocalSaves(20), false, 'saida nao espera indefinidamente');
    assert.equal(disk.has(slowKey), false);
    release();
    await Promise.all([one, two]);
    assert.equal(await waitForLocalSaves(), true);
    assert.equal(JSON.parse(disk.get(slowKey)!).state.name, 'segunda', 'escritas na mesma chave respeitam a ordem');
  } finally {
    release();
    Object.defineProperty(AsyncStorage, 'setItem', { configurable: true, value: originalSetItem });
  }
  console.log('Falha de escrita, ultima versao, retry, isolamento e espera por escrita lenta passaram.');
}

main().catch(error => { console.error(error); process.exitCode = 1; });
