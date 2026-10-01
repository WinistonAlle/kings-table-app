export default async function run(page, fixture, sdkSource) {
  if (fixture.apiUrl !== 'http://127.0.0.1:55321') throw new Error('Only local fixtures allowed');
  const account = fixture.accounts[0], id = fixture.tournaments[0];
  const sdk = async ({ fixture, account, sdkSource, id, change }) => {
    const url = URL.createObjectURL(new Blob([sdkSource], { type: 'text/javascript' }));
    try {
      const kit = await import(url);
      const client = kit.createBrowserClient(fixture.apiUrl, fixture.anonKey, { isSingleton: false,
        cookieOptions: { sameSite: 'lax', secure: false } });
      if (!change) {
        const result = await client.auth.signInWithPassword({ email: account.email, password: account.password });
        if (result.error || result.data.user?.id !== account.id) throw new Error('Local login failed');
        sessionStorage.removeItem('kt-test-access');
        return;
      }
      const { data, error } = await client.from('tournaments').select('revision,start_time,details').eq('id', id).single();
      if (error) throw new Error('Unable to read QA table');
      const response = await kit.createTournamentTransport(client, account.id)(kit.createOperation({
        ownerId: account.id, entityId: id, entity: 'tournament', kind: 'tournament.update',
        expectedRevision: data.revision, payload: { startTime: new Date(data.start_time).toISOString(),
          location: 'Sala de outro aparelho', capacity: 12 },
      }), new AbortController().signal);
      if (response.status !== 'confirmed') throw new Error('Concurrent QA edit was not confirmed');
    } finally { URL.revokeObjectURL(url); }
  };
  await page.goto('http://localhost:8081/app?teste=1');
  await page.getByText('Modo de teste · Dados locais', { exact: true }).waitFor();
  await page.evaluate(sdk, { fixture, account, sdkSource, id, change: false });
  await page.goto('http://localhost:8081/app/history');
  await page.getByText('Noite da conta A', { exact: true }).waitFor({ timeout: 30000 });
  if (await page.getByText('Noite da conta B', { exact: true }).count()) throw new Error('Foreign table visible');
  const localBefore = await page.evaluate(() => JSON.stringify(Object.entries(localStorage).sort()));
  const open = async () => {
    await page.getByRole('button', { name: 'Consultar Noite da conta A', exact: true }).click();
    await page.getByText('Ana QA', { exact: true }).waitFor();
  };
  await open();
  await page.getByRole('button', { name: 'Editar agendamento online', exact: true }).click();
  const day = new Date(Date.now() + 7 * 86400000).toLocaleDateString('pt-BR');
  await page.getByRole('textbox', { name: 'Data do agendamento online', exact: true }).fill(day);
  await page.getByRole('textbox', { name: 'Horário do agendamento online', exact: true }).fill('20:30');
  await page.getByRole('textbox', { name: 'Local do agendamento online', exact: true }).fill('Sala atualizada QA');
  await page.getByRole('textbox', { name: 'Limite de jogadores online', exact: true }).fill('1');
  await page.getByRole('button', { name: 'Salvar agendamento na conta', exact: true }).click();
  await page.getByText('O limite deve ter entre 2 e 1.000 vagas e comportar os participantes.', { exact: true }).waitFor();
  await page.getByRole('textbox', { name: 'Limite de jogadores online', exact: true }).fill('12');
  await page.evaluate(() => { window.confirm = () => false; });
  await page.getByRole('button', { name: 'Atualizar detalhes', exact: true }).click();
  if (await page.getByRole('textbox', { name: 'Local do agendamento online', exact: true }).inputValue() !== 'Sala atualizada QA') {
    throw new Error('Refusing to discard a draft must preserve edited fields');
  }
  for (const viewport of [{ width: 1440, height: 900 }, { width: 390, height: 844 }]) {
    await page.setViewportSize(viewport);
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    if (await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)) throw new Error('Horizontal overflow');
    await page.screenshot({ path: `output/playwright/planning-edit-${viewport.width}.png` });
  }
  const rpc = 'http://127.0.0.1:55321/rest/v1/rpc/**';
  await page.route(rpc, route => route.abort('failed'));
  try {
    await page.getByRole('button', { name: 'Salvar agendamento na conta', exact: true }).click();
    await page.getByText('Aguardando envio', { exact: true }).waitFor();
    await page.reload();
    await page.getByText('Alterações pendentes', { exact: true }).waitFor();
    await open();
    await page.getByText('Aguardando envio', { exact: true }).waitFor();
  } finally { await page.unroute(rpc); }
  await page.getByRole('button', { name: 'Atualizar mesas', exact: true }).click();
  await page.getByText('Alterações pendentes', { exact: true }).waitFor({ state: 'hidden' });
  await page.getByRole('button', { name: 'Atualizar detalhes', exact: true }).click();
  await page.getByText('Sala atualizada QA · 12 vagas', { exact: true }).waitFor();
  await page.getByRole('button', { name: 'Editar agendamento online', exact: true }).click();
  await page.getByRole('textbox', { name: 'Local do agendamento online', exact: true }).fill('Minha tentativa QA');
  await page.evaluate(sdk, { fixture, account, sdkSource, id, change: true });
  await page.getByRole('button', { name: 'Salvar agendamento na conta', exact: true }).click();
  await page.getByText('Conflito: a mesa foi alterada', { exact: true }).waitFor();
  await page.getByRole('button', { name: 'Atualizar detalhes', exact: true }).click();
  await page.getByText('Sala de outro aparelho · 12 vagas', { exact: true }).waitFor();
  const decision = page.getByRole('button', { name: 'Manter versão da conta', exact: true });
  await page.evaluate(() => { window.confirm = () => false; });
  await decision.click();
  await page.getByText('Conflito: a mesa foi alterada', { exact: true }).waitFor();
  await page.evaluate(() => { window.confirm = () => true; });
  await decision.click();
  await page.getByText('Versão da conta mantida. As tentativas ficaram no histórico deste aparelho.', { exact: true }).waitFor();
  await page.getByRole('button', { name: 'Ver tentativas arquivadas (1)', exact: true }).click();
  await page.getByText('Tentativa arquivada · Versão da conta mantida', { exact: true }).waitFor();
  await page.screenshot({ path: 'output/playwright/planning-conflict-mobile.png' });
  await page.getByRole('button', { name: 'Editar agendamento online', exact: true }).click();
  await page.getByRole('textbox', { name: 'Local do agendamento online', exact: true }).fill('Sala final QA');
  await page.getByRole('button', { name: 'Salvar agendamento na conta', exact: true }).click();
  await page.getByText('Alteração registrada neste aparelho. Atualize os detalhes para conferir a versão da conta.', { exact: true }).waitFor();
  await page.getByRole('button', { name: 'Atualizar detalhes', exact: true }).click();
  await page.getByText('Sala final QA · 12 vagas', { exact: true }).waitFor();
  const revision = await page.evaluate(async ({ fixture, sdkSource, id }) => {
    const url = URL.createObjectURL(new Blob([sdkSource], { type: 'text/javascript' }));
    try {
      const kit = await import(url);
      const client = kit.createBrowserClient(fixture.apiUrl, fixture.anonKey, { isSingleton: false,
        cookieOptions: { sameSite: 'lax', secure: false } });
      const { data, error } = await client.from('tournaments').select('revision').eq('id', id).single();
      if (error) throw new Error('Final server read failed');
      return data.revision;
    } finally { URL.revokeObjectURL(url); }
  }, { fixture, sdkSource, id });
  if (revision !== 5) throw new Error('Unexpected server revision: retry duplicated or lost an edit');
  const localAfter = await page.evaluate(() => JSON.stringify(Object.entries(localStorage).sort()));
  if (localBefore !== localAfter) throw new Error('Online editing modified the separate local stores');
  await page.context().clearCookies();
  await page.goto('http://localhost:8081/app?teste=1');
  return { passed: true, coverage: ['real local Auth/HTTP', 'scoped editing', 'client validation', 'offline queue/reload/retry',
    'real concurrent revision conflict', 'explicit cancel/accept decision', 'retained attempt', 'edit after recovery',
    'local stores preserved', 'desktop/mobile overflow'] };
}
