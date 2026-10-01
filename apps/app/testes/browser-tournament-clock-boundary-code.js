export default async function run(page, fixture, sdkSource) {
  if (fixture.apiUrl !== 'http://127.0.0.1:55321') throw Error('Local fixtures only');
  const server = () => page.evaluate(async ({ fixture, sdkSource }) => {
    const url = URL.createObjectURL(new Blob([sdkSource], { type: 'text/javascript' }));
    try {
      const kit = await import(url);
      const client = kit.createBrowserClient(fixture.apiUrl, fixture.anonKey, { isSingleton: false,
        cookieOptions: { sameSite: 'lax', secure: false } });
      const result = await client.rpc('read_tournament_clock', { p_tournament_id: fixture.tournaments[0] });
      const table = await client.from('tournaments').select('status,revision').eq('id', fixture.tournaments[0]).single();
      if (result.error || table.error) throw Error('Server verification failed');
      return { clock: result.data, table: table.data };
    } finally { URL.revokeObjectURL(url); }
  }, { fixture, sdkSource });
  const button = name => page.getByRole('button', { name, exact: true });
  const time = page.getByLabel('Tempo do relógio online', { exact: true });
  const warn = page.getByText('Sem confirmação recente. O tempo exibido é estimado; atualize antes de controlar.', { exact: true });
  const rpc = 'http://127.0.0.1:55321/rest/v1/rpc/read_tournament_clock';
  const capture = async name => {
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    await time.evaluate(element => element.scrollIntoView({ block: 'center' }));
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    if (await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)) throw Error('Clock overflow');
    await page.screenshot({ path: `output/playwright/clock-boundary-${name}.png` });
  };
  await page.goto('http://localhost:8081/app?teste=1');
  await page.getByText('Modo de teste · Dados locais', { exact: true }).waitFor();
  await page.evaluate(async ({ fixture, sdkSource }) => {
    const url = URL.createObjectURL(new Blob([sdkSource], { type: 'text/javascript' }));
    try {
      const kit = await import(url);
      const client = kit.createBrowserClient(fixture.apiUrl, fixture.anonKey, { isSingleton: false,
        cookieOptions: { sameSite: 'lax', secure: false } });
      const account = fixture.accounts[0];
      const result = await client.auth.signInWithPassword({ email: account.email, password: account.password });
      if (result.error || result.data.user?.id !== account.id) throw Error('Local login failed');
      sessionStorage.removeItem('kt-test-access');
    } finally { URL.revokeObjectURL(url); }
  }, { fixture, sdkSource });
  await page.goto('http://localhost:8081/app/history');
  await page.evaluate(() => { window.confirm = () => true; });
  await button('Consultar Noite da conta A').click();
  await page.getByText(/^Revisão 2 ·/).waitFor();
  const localBefore = await page.evaluate(() => JSON.stringify(Object.entries(localStorage).sort()));
  await button('Iniciar noite na conta').click();
  await page.getByText(/^Revisão 3 ·/).waitFor();
  await button('Retomar relógio online').click();
  await page.getByText(/^Revisão 4 ·/).waitFor();
  await time.filter({ hasText: '00:03' }).waitFor({ timeout: 70000 });
  let failedReads = 0;
  await page.route(rpc, route => { failedReads++; return route.abort('failed'); });
  try {
    await warn.waitFor({ timeout: 18000 });
    await page.getByText('Aguardando próximo nível', { exact: true }).waitFor();
    await page.waitForTimeout(5000);
    if (failedReads > 2) throw Error('Boundary failure caused aggressive retries');
    if (await button('Pausar relógio online').isEnabled()) throw Error('Failed reading allowed control');
    await page.setViewportSize({ width: 390, height: 844 }); await capture('failure-390');
  } finally { await page.unroute(rpc); }
  await button('Atualizar relógio online').click();
  await page.getByText('Intervalo', { exact: true }).waitFor();
  const interval = await server();
  if (interval.clock.currentLevel !== 1 || !interval.clock.isRunning || interval.table.revision !== 4) throw Error('Interval did not follow server');
  await capture('interval-390');
  await page.getByText('Nível 2', { exact: true }).waitFor({ timeout: 75000 });
  const level = await server();
  if (level.clock.currentLevel !== 2 || !level.clock.isRunning || level.table.revision !== 4) throw Error('Next blind did not follow server');
  await page.reload();
  await button('Consultar Noite da conta A').click();
  await page.getByText('Nível 2', { exact: true }).waitFor();
  await page.setViewportSize({ width: 1440, height: 900 }); await capture('level-1440');
  await page.getByText('Estrutura concluída', { exact: true }).waitFor({ timeout: 75000 });
  if (await time.innerText() !== '00:00' || await button('Retomar relógio online').isEnabled()) throw Error('Expired clock resumed or went negative');
  await page.getByText('O tempo da estrutura terminou. A partida continua até o resultado final.', { exact: true }).waitFor();
  const finished = await server();
  if (finished.clock.currentLevel !== 2 || finished.clock.isRunning || finished.clock.secondsRemaining !== 0
    || finished.table.status !== 'running' || finished.table.revision !== 4) throw Error('Expiry changed tournament results or revision');
  await capture('end-1440');

  // Leave a real HTTP read unresolved longer than the session deadline.
  let delayed = 0;
  await page.route(rpc, async route => {
    delayed++;
    await new Promise(resolve => setTimeout(resolve, 14000));
    try { await route.continue(); } catch { /* The timed-out request is already cancelled. */ }
  });
  try {
    await button('Atualizar relógio online').click();
    await warn.waitFor({ timeout: 18000 });
    if (await button('Reiniciar relógio online').isEnabled()) throw Error('Timeout allowed control');
    await page.waitForTimeout(2500);
    if (delayed !== 1) throw Error('Timeout unexpectedly multiplied requests');
  } finally { await page.unroute(rpc); }
  await button('Atualizar relógio online').click();
  await warn.waitFor({ state: 'hidden' });
  if (await page.evaluate(() => JSON.stringify(Object.entries(localStorage).sort())) !== localBefore) throw Error('Local stores changed');
  await page.context().clearCookies();
  return { passed: true, revision: 4, automaticTransitions: 3, failedReads, delayedReads: delayed };
}
