import assert from 'node:assert/strict';

async function main() {
  const memory = new Map<string, string>();
  Object.defineProperty(globalThis, 'window', { value: { localStorage: {
    getItem: (key: string) => memory.get(key) ?? null,
    setItem: (key: string, value: string) => memory.set(key, value),
    removeItem: (key: string) => memory.delete(key),
  } }, configurable: true });
  const { loadAccountData } = await import('../lib/account-storage');
  const { useTournamentStore } = await import('../stores/tournamentStore');
  const { usePresetsStore } = await import('../stores/presetsStore');
  const { useBlindsStore } = await import('../stores/blindsStore');
  await Promise.all([useTournamentStore.persist.rehydrate(), usePresetsStore.persist.rehydrate(), useBlindsStore.persist.rehydrate()]);
  const create = (name: string) => useTournamentStore.getState().createTournament({
    name, format: 'regular', buyIn: 37.5, reEntryAllowed: false, maxReEntries: 0,
    startTime: '', blindStructure: [], createdBy: 'local',
  });
  create('Mesa antiga');
  await useTournamentStore.persist.rehydrate();
  const legacy = memory.get('kt-tournaments');
  await loadAccountData('conta-a');
  assert.equal(useTournamentStore.getState().tournaments.length, 0, 'nao atribui dados antigos a primeira conta');
  create('Mesa A');
  useBlindsStore.getState().setLevel(2);
  const levels = useBlindsStore.getState().structure;
  usePresetsStore.getState().save('Estrutura A', levels);
  await loadAccountData('conta-b');
  assert.equal(useTournamentStore.getState().tournaments.length, 0, 'B nao ve mesas de A');
  assert.equal(usePresetsStore.getState().presets.length, 0, 'B nao ve estruturas de A');
  assert.equal(useBlindsStore.getState().currentLevel, 0, 'B tem seu proprio relogio');
  create('Mesa B');
  await loadAccountData('conta-a');
  assert.equal(useTournamentStore.getState().tournaments[0].name, 'Mesa A', 'voltar a A restaura seus dados');
  assert.equal(usePresetsStore.getState().presets[0].name, 'Estrutura A');
  assert.equal(useBlindsStore.getState().currentLevel, 2);
  await loadAccountData('conta-a');
  assert.equal(useTournamentStore.getState().tournaments.length, 1, 'verificar a mesma conta nao reseta a memoria');
  await loadAccountData('conta-b');
  assert.equal(useTournamentStore.getState().tournaments[0].name, 'Mesa B');
  assert.equal(memory.get('kt-tournaments'), legacy, 'arquivo legado preservado');
  console.log('Isolamento por conta, estruturas, relogios e preservacao dos dados antigos: tudo passou.');
}
main().catch(error => { console.error(error); process.exitCode = 1; });
