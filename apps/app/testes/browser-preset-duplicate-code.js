export default async function run(page, fixture, sdkSource) {
  if (fixture.apiUrl !== 'http://127.0.0.1:55321') throw Error('Local fixtures only');
  const origin = 'http://localhost:8091', sourceName = 'Estrutura original QA', copyName = 'Variacao da noite QA';
  const levels = [
    { level: 1, smallBlind: 75, bigBlind: 150, ante: 0, durationMinutes: 5 },
    { level: 1, smallBlind: 0, bigBlind: 0, ante: 0, durationMinutes: 4, isBreak: true },
    { level: 2, smallBlind: 100, bigBlind: 200, ante: 25, durationMinutes: 8 },
  ];
  const account = (job, value) => page.evaluate(async ({ fixture, sdkSource, job, value, levels, sourceName, copyName }) => {
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
      if (job === 'seed') {
        const result = await client.rpc('apply_preset_operation', { p_operation: kit.createOperation({
          ownerId: fixture.accounts[0].id, entityId: fixture.presets[0], entity: 'preset',
          kind: 'preset.save', expectedRevision: 0, payload: { name: sourceName, levels },
        }) });
        if (result.error) throw Error('Local seed failed'); return;
      }
      const presets = await client.from('blind_structures').select('id,revision,name,levels').in('name', [sourceName, copyName]);
      const table = await client.from('tournaments').select('revision,blind_levels').eq('id', fixture.tournaments[0]).single();
      if (presets.error || table.error) throw Error('Scoped verification failed');
      return { presets: presets.data, table: table.data };
    } finally { URL.revokeObjectURL(url); }
  }, { fixture, sdkSource, job, value, levels, sourceName, copyName });
  const button = name => page.getByRole('button', { name, exact: true });
  await page.goto(`${origin}/app?teste=1`);
  await page.getByText('Modo de teste · Dados locais', { exact: true }).waitFor();
  await account('login', 0); await account('seed');
  await page.goto(`${origin}/app/history`);
  await button('Consultar Noite da conta A').click();
  await button('Editar blinds e intervalos online').click();
  await button(`Duplicar ${sourceName}`).waitFor({ timeout: 30000 });
  await button(`Duplicar ${sourceName}`).click();
  const section = page.getByText('Criar uma cópia', { exact: true }).locator('..');
  const input = section.getByRole('textbox', { name: 'Nome da nova estrutura na biblioteca', exact: true });
  if (await input.inputValue() !== `${sourceName} (cópia)`) throw Error('Copy name not suggested');
  await page.evaluate(() => { window.confirm = () => false; });
  await button(`Fechar cópia de ${sourceName}`).click();
  if (!await input.count()) throw Error('Refused close lost copy');
  await input.fill(' ');
  if (await section.getByRole('button', { name: 'Salvar nova estrutura na biblioteca', exact: true }).isEnabled()) throw Error('Empty name allowed');
  await input.fill(copyName);
  for (const width of [390, 1440]) {
    await page.setViewportSize({ width, height: width === 390 ? 844 : 1000 });
    await input.evaluate(element => element.scrollIntoView({ block: 'center' }));
    if (await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)) throw Error('Copy overflow');
    await page.screenshot({ path: `output/playwright/preset-duplicate-${width}.png` });
  }
  const rpc = `${fixture.apiUrl}/rest/v1/rpc/apply_preset_operation`;
  await page.route(rpc, route => route.abort('failed'));
  try {
    await section.getByRole('button', { name: 'Salvar nova estrutura na biblioteca', exact: true }).click();
    await section.getByText('Registrada na biblioteca. Confira a confirmação da conta.', { exact: true }).waitFor();
    await page.getByText('Alteração pendente', { exact: true }).waitFor({ timeout: 30000 });
    if (await button(`Duplicar ${copyName}`).count() && await button(`Duplicar ${copyName}`).isEnabled()) throw Error('Pending copy duplicable');
    if ((await account('read')).presets.length !== 1) throw Error('Failed request wrote copy remotely');
    await page.reload();
    await button('Consultar Noite da conta A').click();
    await button('Editar blinds e intervalos online').click();
    await page.getByText('Alteração pendente', { exact: true }).waitFor({ timeout: 30000 });
  } finally { await page.unroute(rpc); }
  await button('Atualizar estruturas').click();
  await button(`Duplicar ${copyName}`).waitFor({ timeout: 30000 });
  if (!await button(`Duplicar ${copyName}`).isEnabled()) throw Error('Confirmed copy unavailable');
  const saved = await account('read');
  const source = saved.presets.find(preset => preset.name === sourceName), copy = saved.presets.find(preset => preset.name === copyName);
  if (saved.presets.length !== 2 || source.id === copy.id || source.revision !== 1 || copy.revision !== 1
    || JSON.stringify(source.levels) !== JSON.stringify(copy.levels) || saved.table.revision !== 2) throw Error('Copy not independent or table modified');
  await page.evaluate(() => { window.confirm = () => true; });
  await button(`Usar ${copyName}`).click();
  await page.getByRole('textbox', { name: 'Minutos, linha 1', exact: true }).fill('6');
  await button('Salvar estrutura na conta').click();
  await page.getByText(/^Revisão 3 ·/).waitFor({ timeout: 30000 });
  const edited = await account('read');
  if (edited.table.blind_levels[0].durationMinutes !== 6 || edited.presets.some(preset => preset.levels[0].durationMinutes !== 5 || preset.revision !== 1)) throw Error('Using copy aliased preset');
  await account('login', 1); await page.reload();
  await button('Consultar Noite da conta B').click();
  await button('Editar blinds e intervalos online').click();
  await page.getByText('Nenhuma estrutura salva na conta.', { exact: true }).waitFor({ timeout: 30000 });
  if (await button(`Duplicar ${sourceName}`).count() || await button(`Duplicar ${copyName}`).count()) throw Error('Copies leaked between accounts');
  return { confirmedSourceOnly: true, nameValidation: true, cancelledClosePreservesDraft: true,
    offlineReloadRetry: true, independentPresetIds: true, unchangedOriginal: true, useDoesNotAlias: true, accountIsolation: true };
}
