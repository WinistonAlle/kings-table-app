export default async function run(page, fixture, sdkSource) {
  if (fixture.apiUrl !== 'http://127.0.0.1:55321') throw new Error('Only local fixtures allowed');
  const login = account => page.evaluate(async ({ fixture, sdkSource, account }) => {
    const url = URL.createObjectURL(new Blob([sdkSource], { type: 'text/javascript' }));
    try {
      const kit = await import(url);
      const client = kit.createBrowserClient(fixture.apiUrl, fixture.anonKey, { isSingleton: false,
        cookieOptions: { sameSite: 'lax', secure: false } });
      const response = await client.auth.signInWithPassword({ email: account.email, password: account.password });
      if (response.error || response.data.user?.id !== account.id) throw new Error('Local login failed');
      sessionStorage.removeItem('kt-test-access');
    } finally { URL.revokeObjectURL(url); }
  }, { fixture, sdkSource, account });
  await page.goto('http://localhost:8081/app?teste=1');
  await page.getByText('Modo de teste · Dados locais', { exact: true }).waitFor();
  await login(fixture.accounts[0]);
  await page.goto('http://localhost:8081/app/history');
  await page.getByText('Nenhuma mesa na conta.', { exact: true }).waitFor({ timeout: 30000 });
  const localBefore = await page.evaluate(() => JSON.stringify(Object.entries(localStorage).sort()));
  const fill = async name => {
    await page.goto('http://localhost:8081/app/tournament/create');
    await page.getByRole('radio', { name: 'Salvar na conta', exact: true }).click();
    await page.getByRole('textbox', { name: 'Nome da mesa', exact: true }).fill(name);
    await page.getByRole('textbox', { name: 'Valor do buy-in em reais', exact: true }).fill('73,29');
    await page.getByRole('textbox', { name: 'Local da noite', exact: true }).fill('Sala QA online');
    await page.getByRole('textbox', { name: 'Limite de reentradas por jogador', exact: true }).fill('5');
  };
  await fill('Criação offline QA');
  await page.getByRole('button', { name: 'Criar estrutura do zero', exact: true }).click();
  await page.getByRole('button', { name: 'Adicionar nível', exact: true }).click();
  await page.getByRole('textbox', { name: 'Small, linha 1', exact: true }).fill('30');
  await page.getByRole('textbox', { name: 'Big, linha 1', exact: true }).fill('60');
  await page.getByRole('button', { name: 'Adicionar intervalo', exact: true }).click();
  for (const viewport of [{ width: 1440, height: 900 }, { width: 390, height: 844 }]) {
    await page.setViewportSize(viewport);
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    if (await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)) throw new Error('Creation overflow');
    await page.screenshot({ path: `output/playwright/create-online-${viewport.width}.png` });
  }
  const rpc = 'http://127.0.0.1:55321/rest/v1/rpc/**';
  await page.route(rpc, route => route.abort('failed'));
  try {
    await page.getByRole('button', { name: 'Criar mesa na conta', exact: true }).click();
    await page.getByText('Criação aguardando confirmação', { exact: true }).waitFor();
    await page.getByRole('button', { name: 'Ver mesas', exact: true }).click();
    await page.getByText('Criação offline QA', { exact: true }).waitFor();
    await page.reload();
    await page.getByText('Criação offline QA', { exact: true }).waitFor();
    await page.getByText('Criação aguardando confirmação', { exact: true }).waitFor();
  } finally { await page.unroute(rpc); }
  await page.getByRole('button', { name: 'Atualizar mesas', exact: true }).click();
  await page.getByRole('button', { name: 'Consultar Criação offline QA', exact: true }).waitFor();

  await fill('Confirmação perdida QA');
  let lost;
  await page.route(rpc, async route => {
    const request = route.request().postDataJSON();
    lost = request.p_operation;
    const response = await route.fetch();
    if (!response.ok()) throw new Error('Real server did not accept creation');
    await route.fulfill({ response, body: '{}' });
  });
  try {
    await page.getByRole('button', { name: 'Criar mesa na conta', exact: true }).click();
    await page.getByText('Mesa criada na conta · Em preparação', { exact: true }).waitFor();
    await page.getByRole('button', { name: 'Ver mesas', exact: true }).click();
    await page.getByText('Revisão de alterações necessária', { exact: true }).waitFor();
  } finally { await page.unroute(rpc); }
  if (!lost) throw new Error('Lost acknowledgement scenario did not execute');
  await page.getByRole('button', { name: 'Atualizar mesas', exact: true }).click();
  await page.getByText('Revisão de alterações necessária', { exact: true }).waitFor({ state: 'hidden' });
  const verified = await page.evaluate(async ({ fixture, sdkSource, lost }) => {
    const url = URL.createObjectURL(new Blob([sdkSource], { type: 'text/javascript' }));
    try {
      const kit = await import(url);
      const client = kit.createBrowserClient(fixture.apiUrl, fixture.anonKey, { isSingleton: false,
        cookieOptions: { sameSite: 'lax', secure: false } });
      const { data, error } = await client.from('tournaments').select('id,name,revision,buy_in,max_re_entries,blind_levels,details,status')
        .eq('created_by', fixture.accounts[0].id);
      if (error) throw new Error('Server verification failed');
      const box = new kit.SyncOutbox();
      try {
        const entries = await box.list(fixture.accounts[0].id);
        return { tables: data, retried: entries.find(entry => entry.operation.id === lost.id)?.status,
          copies: entries.filter(entry => entry.operation.entityId === lost.entityId).length };
      } finally { await box.close(); }
    } finally { URL.revokeObjectURL(url); }
  }, { fixture, sdkSource, lost });
  if (verified.tables.length !== 2 || verified.tables.some(table => table.revision !== 1 || table.status !== 'upcoming'
    || table.buy_in !== 73.29 || table.max_re_entries !== 5 || Object.hasOwn(table.details, 'capacity'))
    || verified.retried !== 'confirmed' || verified.copies !== 1) throw new Error('Creation duplicated or lost configuration');
  const custom = verified.tables.find(table => table.name === 'Criação offline QA');
  if (custom.blind_levels.length !== 2 || custom.blind_levels[0].smallBlind !== 30
    || custom.blind_levels[0].bigBlind !== 60 || !custom.blind_levels[1].isBreak) throw new Error('Custom levels/break not preserved');

  await fill('Criação rejeitada QA');
  await page.route(rpc, route => {
    const body = route.request().postDataJSON();
    body.p_operation.payload.buyIn = -1; // Fault injection; the actual SQL must reject it.
    return route.continue({ postData: JSON.stringify(body) });
  });
  try {
    await page.getByRole('button', { name: 'Criar mesa na conta', exact: true }).click();
    await page.getByText('A criação não foi aceita pela conta', { exact: true }).waitFor();
  } finally { await page.unroute(rpc); }
  await page.evaluate(() => { window.confirm = () => false; });
  await page.getByRole('button', { name: 'Arquivar tentativa de criação', exact: true }).click();
  await page.getByText('A criação não foi aceita pela conta', { exact: true }).waitFor();
  await page.evaluate(() => { window.confirm = () => true; });
  await page.getByRole('button', { name: 'Arquivar tentativa de criação', exact: true }).click();
  await page.getByText('Criação arquivada · Dados da tentativa preservados', { exact: true }).waitFor();
  await page.getByRole('button', { name: 'Ver mesas', exact: true }).click();
  await page.getByRole('button', { name: 'Ver criações arquivadas (1)', exact: true }).click();
  await page.getByText('Criação rejeitada QA', { exact: true }).waitFor();
  const localAfter = await page.evaluate(() => JSON.stringify(Object.entries(localStorage).sort()));
  if (localBefore !== localAfter) throw new Error('Online creation modified local operational data');
  await login(fixture.accounts[1]);
  await page.goto('http://localhost:8081/app/history');
  await page.getByText('Nenhuma mesa na conta.', { exact: true }).waitFor();
  if (await page.getByText('Criação offline QA', { exact: true }).count()
    || await page.getByText('Criação rejeitada QA', { exact: true }).count()) throw new Error('Account switch leaked creations');
  await page.context().clearCookies();
  await page.goto('http://localhost:8081/app?teste=1');
  return { passed: true, coverage: ['real local Auth/HTTP', 'offline creation/reload', 'accepted creation with lost receipt/retry',
    'one identity/command', 'custom blinds/break/reentry/cents', 'SQL rejection with request fault injection',
    'explicit archive/retained attempt', 'account isolation', 'local stores preserved', 'desktop/mobile overflow'] };
}
