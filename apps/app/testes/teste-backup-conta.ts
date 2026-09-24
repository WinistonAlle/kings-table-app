import assert from 'node:assert/strict';

async function main() {
  const memory = new Map<string, string>();
  let failKey: string | null = null;
  let failCount = 0;
  Object.defineProperty(globalThis, 'window', { value: { localStorage: {
    getItem: (k: string) => memory.get(k) ?? null,
    setItem: (k: string, v: string) => {
      if (k === failKey && failCount-- > 0) throw new Error('QuotaExceededError');
      memory.set(k, v);
    },
    removeItem: (k: string) => memory.delete(k),
  } }, configurable: true });
  process.env.EXPO_PUBLIC_SUPABASE_URL = 'https://example.supabase.co';
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY = 'test-only';
  const { supabase } = await import('../lib/supabase');
  const { loadAccountData } = await import('../lib/account-storage');
  const { useTournamentStore: store } = await import('../stores/tournamentStore');
  const { useBlindsStore: blinds } = await import('../stores/blindsStore');
  const { captureBackup, saveBackup, restoreBackup, undoRestore } = await import('../lib/account-backup');
  let account = 'conta-a';
  supabase.auth.getUser = (async () => ({ data: { user: { id: account } }, error: null })) as typeof supabase.auth.getUser;
  let conflict = false;
  let revision = -1;
  supabase.rpc = (async (_name: string, args: { p_expected_revision: number }) => {
    revision = args.p_expected_revision;
    return { data: null, error: conflict ? { code: '40001' } : null };
  }) as unknown as typeof supabase.rpc;
  await loadAccountData(account);
  store.getState().createTournament({
    name: 'Original', format: 'regular', buyIn: 37.5, reEntryAllowed: false,
    maxReEntries: 0, startTime: '', blindStructure: blinds.getState().structure, createdBy: 'local',
  });
  const saved = captureBackup(account);
  await saveBackup(account, 3);
  assert.equal(revision, 3, 'envia revisao observada para o controle de concorrencia');
  conflict = true;
  await assert.rejects(() => saveBackup(account, 3), /Outro aparelho/);
  assert.equal(store.getState().tournaments[0].name, 'Original');
  const modified = structuredClone(saved);
  modified.tournaments[0].name = 'Online';
  const originalRaw = new Map(memory);
  failKey = 'kt-structures:conta-a';
  failCount = 1;
  await assert.rejects(() => restoreBackup(account, { snapshot: modified, revision: 4, updatedAt: '' }), /dados locais anteriores foram preservados/);
  failKey = null;
  assert.deepEqual([...memory], [...originalRaw], 'falha parcial reverte todos os arquivos e remove o diario');
  assert.equal(store.getState().tournaments[0].name, 'Original');

  await restoreBackup(account, { snapshot: modified, revision: 4, updatedAt: '' });
  assert.equal(store.getState().tournaments[0].name, 'Online');
  assert.ok(memory.has('kt-before-restore:conta-a'));
  assert.equal(JSON.parse(memory.get('kt-tournaments:conta-a')!).state.tournaments[0].name, 'Online');
  assert.equal(typeof store.getState().createTournament, 'function', 'restauracao preserva acoes');
  await undoRestore(account);
  assert.equal(store.getState().tournaments[0].name, 'Original');
  assert.equal(JSON.parse(memory.get('kt-tournaments:conta-a')!).state.tournaments[0].name, 'Original');

  const keys = ['kt-tournaments:conta-a', 'kt-structures:conta-a', 'kt-blinds:conta-a'];
  const before = memory.get('kt-before-restore:conta-a') ?? null;
  memory.set('kt-restore-journal:conta-a', JSON.stringify({
    version: 1, ownerId: 'conta-a',
    entries: keys.map(key => ({ key, value: memory.get(key) ?? null })),
    previousBackup: before,
  }));
  memory.set(keys[0], JSON.stringify({ state: { tournaments: modified.tournaments, activeTournamentId: modified.activeTournamentId }, version: 0 }));
  await loadAccountData(account);
  assert.equal(store.getState().tournaments[0].name, 'Original', 'reabertura recupera o estado anterior');
  assert.equal(JSON.parse(memory.get(keys[0])!).state.tournaments[0].name, 'Original');
  assert.ok(!memory.has('kt-restore-journal:conta-a'));

  failKey = 'kt-structures:conta-a';
  failCount = 2;
  await assert.rejects(() => restoreBackup(account, { snapshot: modified, revision: 4, updatedAt: '' }), /não pôde ser revertida/);
  assert.ok(memory.has('kt-restore-journal:conta-a'), 'diario permanece para nova tentativa de recuperacao');
  failKey = null;
  await loadAccountData(account);
  assert.equal(store.getState().tournaments[0].name, 'Original');
  assert.ok(!memory.has('kt-restore-journal:conta-a'));

  await assert.rejects(() => restoreBackup(account, { snapshot: { version: 2 } as never, revision: 1, updatedAt: '' }));
  assert.equal(store.getState().tournaments[0].name, 'Original');
  account = 'conta-b';
  await assert.rejects(() => saveBackup('conta-a', 4), /sessao/);
  await assert.rejects(() => restoreBackup('conta-a', { snapshot: saved, revision: 1, updatedAt: '' }), /sessao/);
  await loadAccountData(account);
  assert.equal(store.getState().tournaments.length, 0);
  assert.throws(() => captureBackup('conta-a'), /conta mudou/);
  console.log('Backup por conta: revisao, conflito, restauracao, recuperacao e troca de conta passaram.');
}
main().catch(error => { console.error(error); process.exitCode = 1; });
