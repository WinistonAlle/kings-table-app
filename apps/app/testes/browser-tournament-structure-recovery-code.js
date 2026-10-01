export default async function run(page, fixture, sdkSource) {
  if (fixture.apiUrl !== 'http://127.0.0.1:55321') throw Error('Local fixtures only');
  const origin = 'http://localhost:8091';
  const account = (job, value) => page.evaluate(async ({ fixture, sdkSource, job, value }) => {
    const url = URL.createObjectURL(new Blob([sdkSource], { type: 'text/javascript' }));
    try {
      const kit = await import(url);
      const client = kit.createBrowserClient(fixture.apiUrl, fixture.anonKey, { isSingleton: false, cookieOptions: { sameSite: 'lax', secure: false } });
      if (job === 'login') {
        const user = fixture.accounts[value];
        const login = await client.auth.signInWithPassword({ email: user.email, password: user.password });
        if (login.error || login.data.user?.id !== user.id) throw Error('Local login failed');
        sessionStorage.removeItem('kt-test-access'); return;
      }
      const read = await client.from('tournaments').select('revision,blind_levels,seconds_remaining,start_time').eq('id', fixture.tournaments[0]).single();
      if (read.error) throw Error('Scoped read failed');
      if (job === 'concurrent') {
        const op = kit.createOperation({ ownerId: fixture.accounts[0].id, entityId: fixture.tournaments[0], entity: 'tournament',
          kind: 'clock.structure', expectedRevision: read.data.revision,
          payload: { levels: read.data.blind_levels.map((row, index) => index === 0 ? { ...row, durationMinutes: value } : row) } });
        const response = await client.rpc('apply_tournament_operation', { p_operation: op });
        if (response.error) throw Error('Concurrent operation failed'); return;
      }
      const audit = await client.from('sync_operation_audit').select('operation_id,after_revision').eq('entity_id', fixture.tournaments[0]);
      if (audit.error) throw Error('Audit read failed');
      const box = new kit.SyncOutbox();
      try { return { table: read.data, audit: audit.data,
        pending: (await box.list(fixture.accounts[0].id)).filter(entry => !['cancelled', 'confirmed'].includes(entry.status)) }; }
      finally { await box.close(); }
    } finally { URL.revokeObjectURL(url); }
  }, { fixture, sdkSource, job, value });
  const button = name => page.getByRole('button', { name, exact: true });
  const open = () => button('Consultar Noite da conta A').click();
  const revision = n => page.getByText(new RegExp(`^Revisão ${n} ·`)).waitFor({ timeout: 30000 });
  const edit = async minutes => {
    await button('Editar blinds e intervalos online').click();
    await page.getByRole('textbox', { name: 'Minutos, linha 1', exact: true }).fill(String(minutes));
  };
  const save = async () => {
    await page.evaluate(() => { window.confirm = () => true; });
    await button('Salvar estrutura na conta').click();
  };
  await page.goto(`${origin}/app?teste=1`);
  await page.getByText('Modo de teste · Dados locais', { exact: true }).waitFor();
  await account('login', 0);
  await page.goto(`${origin}/app/history`);
  await open(); await revision(2);
  const localBefore = await page.evaluate(() => JSON.stringify(Object.entries(localStorage).sort()));
  const rpc = `${fixture.apiUrl}/rest/v1/rpc/apply_tournament_operation`;
  await edit(8);
  await page.route(rpc, route => route.abort('failed'));
  try {
    await save();
    await page.getByText('Aguardando envio', { exact: true }).waitFor({ timeout: 30000 });
    if ((await account('read')).table.revision !== 2) throw Error('Disconnected operation changed server');
    await page.reload(); await open();
    await page.getByText('Aguardando envio', { exact: true }).waitFor({ timeout: 30000 });
    if (await button('Editar blinds e intervalos online').isEnabled()) throw Error('Pending structure editable');
  } finally { await page.unroute(rpc); }
  await button('Atualizar mesas').click();
  await page.getByText('Alterações pendentes', { exact: true }).waitFor({ state: 'hidden', timeout: 30000 });
  await button('Atualizar detalhes').click(); await revision(3);
  if ((await account('read')).table.seconds_remaining !== 480) throw Error('Recovered duration missing');
  await edit(9);
  await account('concurrent', 10);
  await save();
  await page.getByText('Conflito: a mesa foi alterada', { exact: true }).waitFor({ timeout: 30000 });
  await button('Atualizar mesas').click(); await button('Atualizar detalhes').click(); await revision(4);
  await page.evaluate(() => { window.confirm = () => false; });
  await button('Manter versão da conta').click();
  await page.getByText('Conflito: a mesa foi alterada', { exact: true }).waitFor();
  await page.evaluate(() => { window.confirm = () => true; });
  await button('Manter versão da conta').click();
  await page.getByRole('button', { name: /^Ver tentativas arquivadas/ }).click();
  await page.getByText('Tentativa arquivada · Versão da conta mantida', { exact: true }).waitFor();
  await page.getByText(/^Estrutura de blinds e intervalos ·/).waitFor();
  await page.setViewportSize({ width: 390, height: 844 });
  await button('Manter versão da conta').waitFor({ state: 'hidden' });
  await page.getByText('Tentativa arquivada · Versão da conta mantida', { exact: true }).scrollIntoViewIfNeeded();
  await page.screenshot({ path: 'output/playwright/structure-conflict-390.png' });
  await edit(11); await save(); await revision(5);
  let lost = false;
  let committed;
  const committedResponse = new Promise(resolve => { committed = resolve; });
  await edit(12);
  await page.route(rpc, async route => {
    if (lost) return route.continue();
    lost = true;
    const response = await route.fetch();
    if (response.status() !== 200) throw Error('Expected committed operation');
    await route.abort('failed');
    committed();
  });
  try { await save(); await committedResponse; await page.reload(); await open(); }
  finally { await page.unroute(rpc); }
  await page.waitForTimeout(31000);
  await button('Atualizar mesas').click(); await button('Atualizar detalhes').click(); await revision(6);
  const final = await account('read');
  if (!lost || final.table.seconds_remaining !== 720 || final.audit.length !== 6
    || new Set(final.audit.map(row => row.after_revision)).size !== 6 || final.pending.length) throw Error('Lost receipt recovery duplicated or retained operation');
  if (await page.evaluate(() => JSON.stringify(Object.entries(localStorage).sort())) !== localBefore) throw Error('Separate local stores changed');
  await edit(13);
  await account('login', 1); await page.reload();
  await button('Consultar Noite da conta B').waitFor({ timeout: 30000 });
  if (await button('Consultar Noite da conta A').count() || await button('Salvar estrutura na conta').count()) throw Error('Draft leaked into foreign account');
  return { offlineReloadRetry: true, realConflictArchived: true, lostReceiptIdempotent: true,
    accountIsolationAfterReload: true, localStoresUnchanged: true, finalRevision: 6 };
}
