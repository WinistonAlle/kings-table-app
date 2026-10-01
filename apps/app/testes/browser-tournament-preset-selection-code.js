export default async function run(page, fixture, sdkSource) {
  if (fixture.apiUrl !== 'http://127.0.0.1:55321') throw Error('Local fixtures only');
  const origin = 'http://localhost:8091';
  const presetId = fixture.presets[0], name = 'Estrutura reutilizavel QA';
  const levels = [
    { level: 1, smallBlind: 75, bigBlind: 150, ante: 0, durationMinutes: 5 },
    { level: 1, smallBlind: 0, bigBlind: 0, ante: 0, durationMinutes: 4, isBreak: true },
    { level: 2, smallBlind: 100, bigBlind: 200, ante: 25, durationMinutes: 8 },
  ];
  const account = (job, value) => page.evaluate(async ({ fixture, sdkSource, job, value, levels, name, presetId }) => {
    const url = URL.createObjectURL(new Blob([sdkSource], { type: 'text/javascript' }));
    try {
      const kit = await import(url);
      const client = kit.createBrowserClient(fixture.apiUrl, fixture.anonKey, { isSingleton: false, cookieOptions: { sameSite: 'lax', secure: false } });
      if (job === 'login') {
        const user = fixture.accounts[value];
        const result = await client.auth.signInWithPassword({ email: user.email, password: user.password });
        if (result.error || result.data.user?.id !== user.id) throw Error('Local login failed');
        sessionStorage.removeItem('kt-test-access'); return;
      }
      if (job === 'seed') {
        const operation = kit.createOperation({ ownerId: fixture.accounts[0].id, entityId: presetId, entity: 'preset',
          kind: 'preset.save', expectedRevision: 0, payload: { name, levels } });
        const result = await client.rpc('apply_preset_operation', { p_operation: operation });
        if (result.error) throw Error('Local preset creation failed'); return;
      }
      if (job === 'pending') {
        const box = new kit.SyncOutbox();
        try { await box.mutatePreset(fixture.accounts[0].id, presetId, { kind: 'preset.save',
          payload: { name, levels: levels.map((row, index) => index === 0 ? { ...row, smallBlind: 80 } : row) } }); }
        finally { await box.close(); } return;
      }
      const table = await client.from('tournaments').select('revision,blind_levels').eq('id', fixture.tournaments[0]).single();
      const preset = await client.from('blind_structures').select('revision,levels').eq('id', presetId).single();
      if (table.error || preset.error) throw Error('Scoped verification failed');
      return { table: table.data, preset: preset.data };
    } finally { URL.revokeObjectURL(url); }
  }, { fixture, sdkSource, job, value, levels, name, presetId });
  const button = name => page.getByRole('button', { name, exact: true });
  const firstSmall = () => page.getByRole('textbox', { name: 'Small, linha 1', exact: true });
  await page.goto(`${origin}/app?teste=1`);
  await page.getByText('Modo de teste · Dados locais', { exact: true }).waitFor();
  await account('login', 0); await account('seed');
  await page.goto(`${origin}/app/history`);
  await button('Consultar Noite da conta A').click();
  await page.getByText(/^Revisão 2 ·/).waitFor();
  await button('Editar blinds e intervalos online').click();
  await button(`Usar ${name}`).waitFor({ timeout: 30000 });
  await page.evaluate(() => { window.confirm = () => false; });
  await button(`Usar ${name}`).click();
  if (await firstSmall().inputValue() !== '25') throw Error('Refused replacement modified draft');
  await page.evaluate(() => { window.confirm = () => true; });
  await button(`Usar ${name}`).click();
  if (await firstSmall().inputValue() !== '75') throw Error('Preset not applied');
  if ((await account('read')).table.revision !== 2) throw Error('Preset selection wrote table prematurely');
  await page.getByRole('textbox', { name: 'Minutos, linha 1', exact: true }).fill('6');
  for (const width of [390, 1440]) {
    await page.setViewportSize({ width, height: width === 390 ? 844 : 1000 });
    await button(`Usar ${name}`).scrollIntoViewIfNeeded();
    if (await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)) throw Error('Overflow');
    await page.screenshot({ path: `output/playwright/structure-preset-${width}.png` });
  }
  await button('Salvar estrutura na conta').click();
  await page.getByText(/^Revisão 3 ·/).waitFor({ timeout: 30000 });
  let read = await account('read');
  if (read.table.blind_levels[0].durationMinutes !== 6 || read.preset.levels[0].durationMinutes !== 5 || read.preset.revision !== 1) throw Error('Preset aliased or table lost edit');
  await button('Editar blinds e intervalos online').click();
  const rpc = `${fixture.apiUrl}/rest/v1/rpc/apply_preset_operation`;
  await page.route(rpc, route => route.abort('failed'));
  try {
    await account('pending'); await button('Atualizar estruturas').click();
    await page.getByText('Alteração pendente', { exact: true }).waitFor({ timeout: 30000 });
    if (await button(`Usar ${name}`).isEnabled()) throw Error('Unconfirmed preset selectable');
  } finally { await page.unroute(rpc); }
  await button('Atualizar estruturas').click();
  await page.getByText('Confirmada na conta', { exact: true }).waitFor({ timeout: 30000 });
  if (!await button(`Usar ${name}`).isEnabled()) throw Error('Confirmed preset still blocked');
  await page.evaluate(() => { window.confirm = () => true; });
  await button(`Usar ${name}`).click();
  if (await firstSmall().inputValue() !== '80') throw Error('Recovered preset not selected');
  await button('Cancelar edição da estrutura').click();
  read = await account('read');
  if (read.table.revision !== 3 || read.table.blind_levels[0].smallBlind !== 75 || read.preset.revision !== 2) throw Error('Cancelled draft changed persisted structure');
  await account('login', 1); await page.reload();
  await button('Consultar Noite da conta B').click();
  await button('Editar blinds e intervalos online').click();
  await page.getByText('Nenhuma estrutura salva na conta.', { exact: true }).waitFor({ timeout: 30000 });
  if (await button(`Usar ${name}`).count()) throw Error('Foreign preset visible');
  return { confirmedPresetApplied: true, unconfirmedPresetBlocked: true, copyIndependent: true,
    cancelledDraftPreservedTable: true, accountIsolation: true, finalTableRevision: 3, finalPresetRevision: 2 };
}
