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
  const originalNow = Date.now;
  Date.now = () => 123456789;
  try {
    const first = create('Criacao simultanea A');
    const second = create('Criacao simultanea B');
    assert.notEqual(first.id, second.id, 'duas criacoes no mesmo milissegundo nao compartilham identidade');
    await useTournamentStore.persist.rehydrate();
    const third = create('Criacao apos recarregar');
    assert.equal(new Set([first.id, second.id, third.id]).size, 3, 'a protecao considera IDs persistidos');
    useTournamentStore.getState().addPlayer(first.id, {
      userId: 'local', name: 'Jogador A', buyIns: 1, reEntries: 0, addOns: 0, paymentStatus: 'pending',
    });
    assert.equal(useTournamentStore.getState().tournaments.find(t => t.id === second.id)!.players.length, 0);
    useTournamentStore.getState().deleteTournament(second.id);
    assert.ok(useTournamentStore.getState().tournaments.some(t => t.id === first.id));
    assert.ok(useTournamentStore.getState().tournaments.some(t => t.id === third.id));
  } finally { Date.now = originalNow; }
  const storage = useTournamentStore.persist.getOptions().storage!;
  let release!: () => void;
  let started!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; });
  const reading = new Promise<void>(resolve => { started = resolve; });
  let failOnce = true;
  useTournamentStore.persist.setOptions({ storage: {
    ...storage,
    getItem: async name => {
      if (name === 'kt-tournaments:conta-lenta') { started(); await gate; }
      if (name === 'kt-tournaments:conta-falha' && failOnce) {
        failOnce = false;
        throw new Error('Falha de leitura');
      }
      return storage.getItem(name);
    },
  } });
  try {
    const slow = loadAccountData('conta-lenta');
    await reading;
    const next = loadAccountData('conta-a');
    await Promise.resolve();
    assert.equal(useTournamentStore.persist.getOptions().name, 'kt-tournaments:conta-lenta', 'trocas nao intercalam enquanto a leitura anterior esta pendente');
    release();
    await slow;
    await next;
    assert.equal(useTournamentStore.persist.getOptions().name, 'kt-tournaments:conta-a');
    assert.equal(usePresetsStore.persist.getOptions().name, 'kt-structures:conta-a');
    assert.equal(useBlindsStore.persist.getOptions().name, 'kt-blinds:conta-a');
    assert.equal(useTournamentStore.getState().tournaments[0].name, 'Mesa A');
    await assert.rejects(loadAccountData('conta-falha'), /carregar os dados locais/, 'erro de hidratacao nao libera a conta');
    await loadAccountData('conta-a');
    assert.equal(useTournamentStore.getState().tournaments[0].name, 'Mesa A', 'falha nao trava a fila nem apaga a conta anterior');
  } finally {
    release();
    useTournamentStore.persist.setOptions({ storage });
  }
  console.log('Isolamento por conta, estruturas, relogios e preservacao dos dados antigos: tudo passou.');
}
main().catch(error => { console.error(error); process.exitCode = 1; });
