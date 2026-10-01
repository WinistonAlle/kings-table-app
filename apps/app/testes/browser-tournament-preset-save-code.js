export default async function run(page, fixture, sdkSource) {
  if (fixture.apiUrl !== 'http://127.0.0.1:55321') throw Error('Local fixtures only');
  const origin = 'http://localhost:8091';
  const name = 'Estrutura criada no editor QA';
  const account = (job, value) => page.evaluate(async ({ fixture, sdkSource, job, value, name }) => {
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
      const table = await client.from('tournaments').select('revision,blind_levels').eq('id', fixture.tournaments[0]).single();
      const presets = await client.from('blind_structures').select('id,revision,levels,name').eq('name', name);
      if (table.error || presets.error) throw Error('Scoped verification failed');
      return { table: table.data, presets: presets.data };
    } finally { URL.revokeObjectURL(url); }
  }, { fixture, sdkSource, job, value, name });
  const button = name => page.getByRole('button', { name, exact: true });
  const small = () => page.getByRole('textbox', { name: 'Small, linha 1', exact: true });
  const presetName = () => page.getByRole('textbox', { name: 'Nome da nova estrutura na biblioteca', exact: true });
  await page.goto(`${origin}/app?teste=1`);
  await page.getByText('Modo de teste · Dados locais', { exact: true }).waitFor();
  await account('login', 0);
  await page.goto(`${origin}/app/history`);
  await button('Consultar Noite da conta A').click();
  await page.getByText(/^Revisão 2 ·/).waitFor();
  await button('Editar blinds e intervalos online').click();
  await small().fill('37');
  await presetName().fill(name);
  const rpc = `${fixture.apiUrl}/rest/v1/rpc/apply_preset_operation`;
  await page.route(rpc, route => route.abort('failed'));
  try {
    await button('Salvar nova estrutura na biblioteca').click();
    await page.getByText('Registrada na biblioteca. Confira a confirmação da conta.', { exact: true }).waitFor();
    await page.getByText('Alteração pendente', { exact: true }).waitFor({ timeout: 30000 });
    if (await button(`Usar ${name}`).isEnabled()) throw Error('Pending preset selectable');
    const read = await account('read');
    if (read.presets.length || read.table.revision !== 2 || read.table.blind_levels[0].smallBlind !== 25) throw Error('Offline save wrote remote state');
    if (await small().inputValue() !== '37') throw Error('Saving preset lost table draft');
    for (const width of [390, 1440]) {
      await page.setViewportSize({ width, height: width === 390 ? 844 : 1000 });
      await presetName().scrollIntoViewIfNeeded();
      if (await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)) throw Error('Overflow');
      await page.screenshot({ path: `output/playwright/structure-save-${width}.png` });
    }
    await page.reload();
    await button('Consultar Noite da conta A').click();
    await button('Editar blinds e intervalos online').click();
    await page.getByText('Alteração pendente', { exact: true }).waitFor({ timeout: 30000 });
  } finally { await page.unroute(rpc); }
  await button('Atualizar estruturas').click();
  await page.getByText('Confirmada na conta', { exact: true }).waitFor({ timeout: 30000 });
  const saved = await account('read');
  if (saved.presets.length !== 1 || saved.presets[0].revision !== 1 || saved.presets[0].levels[0].smallBlind !== 37
    || saved.table.revision !== 2 || saved.table.blind_levels[0].smallBlind !== 25) throw Error('Retry duplicated preset or changed table');
  await page.evaluate(() => { window.confirm = () => true; });
  await button(`Usar ${name}`).click();
  if (await small().inputValue() !== '37') throw Error('Saved preset unavailable');
  await button('Cancelar edição da estrutura').click();
  await page.reload();
  await button('Consultar Noite da conta A').click();
  await button('Editar blinds e intervalos online').click();
  await button(`Usar ${name}`).waitFor({ timeout: 30000 });
  const read = await account('read');
  if (read.table.revision !== 2 || read.presets.length !== 1) throw Error('Reload changed saved state');
  await account('login', 1); await page.reload();
  await button('Consultar Noite da conta B').click();
  await button('Editar blinds e intervalos online').click();
  await page.getByText('Nenhuma estrutura salva na conta.', { exact: true }).waitFor({ timeout: 30000 });
  if (await button(`Usar ${name}`).count()) throw Error('Preset leaked between accounts');
  return { inlineSave: true, offlineReloadRetry: true, presetCount: 1, presetRevision: 1,
    tableUnchanged: true, tableRevision: 2, reusable: true, accountIsolationAfterReload: true };
}
