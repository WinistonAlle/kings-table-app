export default async function run(page, fixture, sdkSource) {
  if (fixture.apiUrl !== 'http://127.0.0.1:55321') throw Error('Local fixtures only');
  const origin = 'http://localhost:8091', name = 'Retry local do editor QA', lostName = 'Recibo perdido do editor QA';
  const account = (job, value) => page.evaluate(async ({ fixture, sdkSource, job, value, name, lostName }) => {
    const url = URL.createObjectURL(new Blob([sdkSource], { type: 'text/javascript' }));
    try {
      const kit = await import(url);
      const client = kit.createBrowserClient(fixture.apiUrl, fixture.anonKey, { isSingleton: false,
        cookieOptions: { sameSite: 'lax', secure: false } });
      if (job === 'login') {
        const user = fixture.accounts[value];
        const result = await client.auth.signInWithPassword({ email: user.email, password: user.password });
        if (result.error || result.data.user?.id !== user.id) throw Error('Local login failed');
        sessionStorage.removeItem('kt-test-access'); return;
      }
      const box = new kit.SyncOutbox();
      let entries;
      try { entries = (await box.list(fixture.accounts[0].id)).filter(entry => entry.operation.entity === 'preset'
        && [name, lostName].includes(entry.operation.payload.name)); }
      finally { await box.close(); }
      const table = await client.from('tournaments').select('revision,blind_levels').eq('id', fixture.tournaments[0]).single();
      const presets = await client.from('blind_structures').select('id,revision,name,levels').in('name', [name, lostName]);
      if (table.error || presets.error) throw Error('Scoped verification failed');
      return { entries: entries.map(entry => ({ id: entry.operation.id, name: entry.operation.payload.name, status: entry.status })),
        table: table.data, presets: presets.data };
    } finally { URL.revokeObjectURL(url); }
  }, { fixture, sdkSource, job, value, name, lostName });
  const button = name => page.getByRole('button', { name, exact: true });
  const small = () => page.getByRole('textbox', { name: 'Small, linha 1', exact: true });
  const input = () => page.getByRole('textbox', { name: 'Nome da nova estrutura na biblioteca', exact: true });
  await page.goto(`${origin}/app?teste=1`);
  await page.getByText('Modo de teste · Dados locais', { exact: true }).waitFor();
  await account('login', 0); await page.goto(`${origin}/app/history`);
  await button('Consultar Noite da conta A').click();
  await button('Editar blinds e intervalos online').click();
  await small().fill('39'); await input().fill(name);
  const rpc = `${fixture.apiUrl}/rest/v1/rpc/apply_preset_operation`;
  await page.route(rpc, route => route.abort('failed'));
  // Inject one post-commit read failure, not a fake successful storage write.
  await page.evaluate(() => {
    const add = IDBObjectStore.prototype.add, getAll = IDBObjectStore.prototype.getAll;
    let armed = false;
    IDBObjectStore.prototype.add = function (value, ...args) {
      const result = add.call(this, value, ...args);
      if (this.name === 'operations' && value?.operation?.kind === 'preset.save') {
        armed = true;
      }
      return result;
    };
    IDBObjectStore.prototype.getAll = function (...args) {
      if (armed && this.name === 'presetBases' && this.transaction.mode === 'readonly') {
        armed = false;
        IDBObjectStore.prototype.add = add; IDBObjectStore.prototype.getAll = getAll;
        throw new DOMException('QA post-commit read failure', 'UnknownError');
      }
      return getAll.apply(this, args);
    };
  });
  await button('Salvar nova estrutura na biblioteca').click();
  await page.getByText('Registro não confirmado. Repita a mesma tentativa para evitar duplicações.', { exact: true }).waitFor();
  const pending = await account('read');
  if (pending.entries.length !== 1 || pending.presets.length || pending.table.revision !== 2) throw Error('Post-commit failure not reproduced');
  if (await input().isEditable() || await small().isEditable()
    || await button('Salvar estrutura na conta').isEnabled() || await button('Cancelar edição da estrutura').isEnabled()) throw Error('Uncertain attempt left editor unlocked');
  const retry = button('Tentar salvar na biblioteca novamente');
  await page.setViewportSize({ width: 390, height: 844 });
  await retry.evaluate(element => element.scrollIntoView({ block: 'center' }));
  if (await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)) throw Error('Retry overflow');
  await page.screenshot({ path: 'output/playwright/structure-save-retry-390.png' });
  await retry.click();
  await page.getByText('Registrada na biblioteca. Confira a confirmação da conta.', { exact: true }).waitFor();
  const retried = await account('read');
  if (retried.entries.length !== 1 || retried.entries[0].id !== pending.entries[0].id) throw Error('Local retry changed identity');
  await page.unroute(rpc); await button('Atualizar estruturas').click();
  await button(`Usar ${name}`).waitFor({ timeout: 30000 });
  await page.waitForFunction(label => {
    const buttons = [...document.querySelectorAll('[role="button"]')];
    return buttons.some(button => button.textContent.includes(label) && button.getAttribute('aria-disabled') !== 'true');
  }, `Usar ${name}`);
  const confirmed = await account('read');
  if (confirmed.presets.length !== 1 || confirmed.presets[0].revision !== 1 || confirmed.presets[0].levels[0].smallBlind !== 39) throw Error('Local retry not confirmed once');
  await input().fill(lostName);
  let resolveCommit;
  const commit = new Promise(resolve => { resolveCommit = resolve; });
  await page.route(rpc, async route => {
    const response = await route.fetch();
    if (!response.ok()) throw Error('Real preset commit failed');
    await route.abort('failed'); resolveCommit();
  });
  await button('Salvar nova estrutura na biblioteca').click();
  await commit;
  await page.unroute(rpc);
  await page.reload();
  await button('Consultar Noite da conta A').click();
  await button('Editar blinds e intervalos online').click();
  // A real wait allows an abandoned sender lease to expire after navigation.
  await page.waitForTimeout(31000);
  await button('Atualizar estruturas').click();
  await button(`Usar ${lostName}`).waitFor({ timeout: 30000 });
  const final = await account('read');
  if (final.presets.length !== 2 || final.presets.some(preset => preset.revision !== 1)
    || final.entries.length !== 2 || final.entries.some(entry => entry.status !== 'confirmed')
    || final.table.revision !== 2 || final.table.blind_levels[0].smallBlind !== 25) throw Error('Lost receipt duplicated data or failed recovery');
  return { postCommitLocalReadFailure: true, editorLockedUntilRetry: true, sameOperationId: true,
    realServerCommitLostResponseRecovered: true, presetCount: 2, tableUnchanged: true };
}
