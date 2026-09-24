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
  const { hasPendingLocalSaves, localSaveFailureCount, retryPendingLocalSaves } = await import('../lib/armazenamento');
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
  console.log('Falha de escrita, ultima versao, retry e isolamento de contas passaram.');
}

main().catch(error => { console.error(error); process.exitCode = 1; });
