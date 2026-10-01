export default async function run(page, fixture, sdkSource) {
  if (fixture.apiUrl !== 'http://127.0.0.1:55321') throw Error('Local fixtures only');
  const account = (job, args) => page.evaluate(async ({ fixture, sdkSource, job, args }) => {
    const url = URL.createObjectURL(new Blob([sdkSource], { type: 'text/javascript' }));
    try {
      const kit = await import(url);
      const client = kit.createBrowserClient(fixture.apiUrl, fixture.anonKey, { isSingleton: false,
        cookieOptions: { sameSite: 'lax', secure: false } });
      if (job === 'login') {
        const user = fixture.accounts[args];
        const result = await client.auth.signInWithPassword({ email: user.email, password: user.password });
        if (result.error || result.data.user?.id !== user.id) throw Error('Local login failed');
        sessionStorage.removeItem('kt-test-access'); return;
      }
      const tableId = fixture.tournaments[0];
      const table = await client.from('tournaments').select('revision,status,clock_ends_at').eq('id', tableId).single();
      const players = await client.from('tournament_players').select('id,display_name,position,prize').eq('tournament_id', tableId);
      if (table.error || players.error) throw Error('Server read failed');
      if (job === 'pause') {
        const result = await client.rpc('apply_tournament_operation', { p_operation: kit.createOperation({
          ownerId: fixture.accounts[0].id, entityId: tableId, entity: 'tournament',
          expectedRevision: table.data.revision, kind: 'clock.pause', payload: {},
        }) });
        if (result.error) throw Error('Concurrent pause failed');
      }
      return { table: table.data, players: players.data };
    } finally { URL.revokeObjectURL(url); }
  }, { fixture, sdkSource, job, args });
  const button = name => page.getByRole('button', { name, exact: true });
  const confirmed = async revision => {
    await page.getByText(new RegExp(`^Revisão ${revision} ·`)).waitFor({ timeout: 30000 });
    await button('Atualizar relógio online').waitFor();
  };
  const open = () => button('Consultar Noite da conta A').click();
  const consent = () => page.evaluate(() => { window.confirm = () => true; });
  await page.goto('http://localhost:8081/app?teste=1');
  await page.getByText('Modo de teste · Dados locais', { exact: true }).waitFor();
  await account('login', 0);
  await page.goto('http://localhost:8081/app/history');
  await consent();
  await open(); await confirmed(2);
  const localBefore = await page.evaluate(() => JSON.stringify(Object.entries(localStorage).sort()));
  await button('Adicionar jogador online').click();
  await page.getByRole('textbox', { name: 'Nome do jogador online', exact: true }).fill('Carla QA');
  await button('Registrar jogador na conta').click(); await confirmed(3);
  await button('Iniciar noite na conta').click(); await confirmed(4);
  await page.getByText('Pausado', { exact: true }).waitFor();
  await button('Retomar relógio online').click(); await confirmed(5);
  await page.getByText('Em andamento', { exact: true }).waitFor();
  const time = page.getByLabel('Tempo do relógio online', { exact: true });
  const start = await time.innerText();
  await page.waitForTimeout(2200);
  if (await time.innerText() === start) throw Error('Clock did not count');
  await button('Pausar relógio online').click(); await confirmed(6);
  const stopped = await time.innerText(); await page.waitForTimeout(1200);
  if (await time.innerText() !== stopped) throw Error('Paused clock moved');
  await button('Próximo nível online').click(); await confirmed(7);
  await page.getByText('Intervalo', { exact: true }).waitFor();
  await button('Congelar hand-for-hand online').click(); await confirmed(8);
  await page.getByText('Hand-for-hand · Congelado', { exact: true }).waitFor();
  if (await button('Retomar relógio online').isEnabled()) throw Error('Hand-for-hand allowed resume');
  await button('Encerrar hand-for-hand online').click(); await confirmed(9);
  await button('Reiniciar relógio online').click(); await confirmed(10);
  await page.getByText('Nível 1', { exact: true }).waitFor();
  const rpc = 'http://127.0.0.1:55321/rest/v1/rpc/apply_tournament_operation';
  await page.route(rpc, route => route.abort('failed'));
  try {
    await button('Retomar relógio online').click();
    await page.getByText(/^Retomar relógio ·/).waitFor();
    await page.reload(); await consent(); await open();
    await page.getByText(/^Retomar relógio ·/).waitFor();
  } finally { await page.unroute(rpc); }
  await button('Atualizar mesas').click(); await open(); await confirmed(11);
  await button('Pausar relógio online').click(); await confirmed(12);
  await button('Retomar relógio online').click(); await confirmed(13);
  await account('pause'); await button('Atualizar relógio online').click();
  await page.getByText('A mesa mudou. Atualize os detalhes para alinhar o relógio.', { exact: true }).waitFor();
  if (await button('Retomar relógio online').isEnabled()) throw Error('Stale revision allowed command');
  await button('Atualizar detalhes').click(); await confirmed(14);
  await button('Gerenciar Carla QA').click();
  await button('Eliminar Carla QA').click(); await confirmed(15);
  await page.getByText('Noite encerrada', { exact: true }).waitFor();
  const ended = await account('read');
  if (ended.table.status !== 'finished' || ended.table.clock_ends_at !== null
    || ended.players.map(player => player.position).sort().join(',') !== '1,2'
    || Math.round(ended.players.reduce((sum, player) => sum + Number(player.prize), 0) * 100) !== 14700) throw Error('Wrong final results');
  await button('Gerenciar Carla QA').click();
  await button('Desfazer eliminação de Carla QA').click(); await confirmed(16);
  await page.getByText('Pausado', { exact: true }).waitFor();
  const reopened = await account('read');
  if (reopened.table.status !== 'running' || reopened.table.clock_ends_at !== null
    || reopened.players.some(player => player.position !== null || player.prize !== null)) throw Error('Undo did not reopen paused and clear results');
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: width === 390 ? 844 : 900 });
    await time.scrollIntoViewIfNeeded();
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    if (await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)) throw Error('Clock overflow');
    await page.screenshot({ path: `output/playwright/clock-online-${width}.png` });
  }
  if (await page.evaluate(() => JSON.stringify(Object.entries(localStorage).sort())) !== localBefore) throw Error('Local stores changed');
  await account('login', 1); await page.goto('http://localhost:8081/app/history');
  await button('Consultar Noite da conta B').waitFor();
  if (await button('Consultar Noite da conta A').count()) throw Error('Account isolation failed');
  await page.context().clearCookies();
  console.log('Clock UI: real local Auth/HTTP/IndexedDB, start/count/pause/break/hand/reset, interrupted RPC+reload/retry, external revision, results/undo, scope and unchanged local stores passed.');
}
