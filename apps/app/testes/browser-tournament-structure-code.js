export default async function run(page, fixture, sdkSource) {
  const origin = 'http://localhost:8091';
  await page.goto(`${origin}/app?teste=1`);
  await page.getByText('Modo de teste · Dados locais', { exact: true }).waitFor();
  await page.evaluate(async ({ fixture, sdkSource }) => {
    const url = URL.createObjectURL(new Blob([sdkSource], { type: 'text/javascript' }));
    try {
      const kit = await import(url);
      const client = kit.createBrowserClient(fixture.apiUrl, fixture.anonKey, { isSingleton: false, cookieOptions: { sameSite: 'lax', secure: false } });
      const login = await client.auth.signInWithPassword({ email: fixture.accounts[0].email, password: fixture.accounts[0].password });
      if (login.error) throw Error('Local QA login failed');
      sessionStorage.removeItem('kt-test-access');
    } finally { URL.revokeObjectURL(url); }
  }, { fixture, sdkSource });
  await page.goto(`${origin}/app/history`);
  await page.getByRole('button', { name: 'Consultar Noite da conta A', exact: true }).click();
  await page.getByRole('button', { name: 'Editar blinds e intervalos online', exact: true }).click();
  await page.getByRole('textbox', { name: 'Small, linha 1', exact: true }).fill('37');
  await page.getByRole('textbox', { name: 'Big, linha 1', exact: true }).fill('74');
  await page.getByRole('textbox', { name: 'Minutos, linha 1', exact: true }).fill('7');
  await page.getByRole('textbox', { name: 'Minutos, linha 2', exact: true }).fill('3');
  for (const name of ['Editar agendamento online', 'Adicionar convidado online', 'Adicionar jogador online']) {
    const button = page.getByRole('button', { name, exact: true });
    if (await button.count() && await button.isEnabled()) throw Error(`Parallel editing enabled: ${name}`);
  }
  for (const width of [320, 390, 1440]) {
    await page.setViewportSize({ width, height: width === 1440 ? 1000 : 844 });
    await page.getByRole('textbox', { name: 'Small, linha 1', exact: true }).scrollIntoViewIfNeeded();
    if (await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)) throw Error('Horizontal overflow');
    await page.screenshot({ path: `output/playwright/structure-online-${width}.png` });
  }
  page.once('dialog', dialog => dialog.dismiss());
  await page.getByRole('button', { name: 'Cancelar edição da estrutura', exact: true }).click();
  if (await page.getByRole('textbox', { name: 'Small, linha 1', exact: true }).inputValue() !== '37') throw Error('Cancelled confirmation discarded draft');
  page.once('dialog', dialog => dialog.dismiss());
  await page.getByRole('button', { name: 'Salvar estrutura na conta', exact: true }).click();
  if (await page.getByRole('textbox', { name: 'Small, linha 1', exact: true }).inputValue() !== '37') throw Error('Cancelled save lost draft');
  page.once('dialog', dialog => dialog.accept());
  await page.getByRole('button', { name: 'Salvar estrutura na conta', exact: true }).click();
  await page.getByText(/^Revisão 3 ·/).waitFor({ timeout: 30000 });
  await page.reload();
  await page.getByRole('button', { name: 'Consultar Noite da conta A', exact: true }).click();
  await page.getByText(/^Revisão 3 ·/).waitFor({ timeout: 30000 });
  const confirmed = await page.evaluate(async ({ fixture, sdkSource }) => {
    const url = URL.createObjectURL(new Blob([sdkSource], { type: 'text/javascript' }));
    try {
      const kit = await import(url);
      const client = kit.createBrowserClient(fixture.apiUrl, fixture.anonKey, { isSingleton: false, cookieOptions: { sameSite: 'lax', secure: false } });
      const row = await client.from('tournaments').select('revision,blind_levels,seconds_remaining,clock_ends_at').eq('id', fixture.tournaments[0]).single();
      const audit = await client.from('sync_operation_audit').select('operation_id').eq('entity_id', fixture.tournaments[0]).eq('kind', 'clock.structure');
      if (row.error || audit.error) throw Error('Read failed');
      if (row.data.revision !== 3 || row.data.seconds_remaining !== 420 || row.data.clock_ends_at !== null
        || row.data.blind_levels[0].smallBlind !== 37 || row.data.blind_levels[0].bigBlind !== 74
        || row.data.blind_levels[1].durationMinutes !== 3 || audit.data.length !== 1) throw Error('Unexpected structure state');
      return { revision: row.data.revision, seconds: row.data.seconds_remaining, structureAuditRows: audit.data.length };
    } finally { URL.revokeObjectURL(url); }
  }, { fixture, sdkSource });
  return { ...confirmed, persistedAfterReload: true, rejectedConfirmationsPreservedDraft: true, noOverflow: true };
}
