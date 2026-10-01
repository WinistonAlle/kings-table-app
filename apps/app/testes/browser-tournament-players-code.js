export default async function run(page, fixture, sdkSource) {
  if (fixture.apiUrl !== 'http://127.0.0.1:55321') throw new Error('Only local fixtures allowed');
  const inAccount = (job, args) => page.evaluate(async ({ fixture, sdkSource, job, args }) => {
    const url = URL.createObjectURL(new Blob([sdkSource], { type: 'text/javascript' }));
    try {
      const kit = await import(url);
      const client = kit.createBrowserClient(fixture.apiUrl, fixture.anonKey, { isSingleton: false,
        cookieOptions: { sameSite: 'lax', secure: false } });
      if (job === 'login') {
        const account = fixture.accounts[args];
        const result = await client.auth.signInWithPassword({ email: account.email, password: account.password });
        if (result.error || result.data.user?.id !== account.id) throw new Error('Local login failed');
        sessionStorage.removeItem('kt-test-access'); return;
      }
      if (job === 'concurrent') {
        const operation = kit.createOperation({ ownerId: fixture.accounts[0].id, entityId: fixture.tournaments[0],
          entity: 'tournament', expectedRevision: args, kind: 'player.add',
          payload: { playerId: crypto.randomUUID(), name: 'Concorrente QA' } });
        const result = await client.rpc('apply_tournament_operation', { p_operation: operation });
        if (result.error) throw new Error('Concurrent real command failed'); return;
      }
      const { data, error } = await client.from('tournaments').select('revision').eq('id', fixture.tournaments[0]).single();
      const players = await client.from('tournament_players').select('id,display_name,buy_ins,re_entries,add_ons,payment_status,financial_activity_recorded')
        .eq('tournament_id', fixture.tournaments[0]);
      const events = await client.from('player_entry_events').select('operation_id,delta,total_after_cents').eq('tournament_id', fixture.tournaments[0]);
      const payments = await client.from('player_payment_events').select('operation_id,status_after,amount_cents').eq('tournament_id', fixture.tournaments[0]);
      if (error || players.error || events.error || payments.error) throw new Error('Server verification failed');
      const box = new kit.SyncOutbox();
      try { return { revision: data.revision, players: players.data, events: events.data, payments: payments.data,
        entries: (await box.list(fixture.accounts[0].id)).map(entry => ({ id: entry.operation.id, kind: entry.operation.kind, status: entry.status })) }; }
      finally { await box.close(); }
    } finally { URL.revokeObjectURL(url); }
  }, { fixture, sdkSource, job, args });
  await page.goto('http://localhost:8081/app?teste=1');
  await page.getByText('Modo de teste · Dados locais', { exact: true }).waitFor();
  await inAccount('login', 0);
  await page.goto('http://localhost:8081/app/history');
  const localBefore = await page.evaluate(() => JSON.stringify(Object.entries(localStorage).sort()));
  const open = () => page.getByRole('button', { name: 'Consultar Noite da conta A', exact: true }).click();
  const revision = async number => {
    await page.getByText(new RegExp(`^Revisão ${number} ·`)).waitFor({ timeout: 30000 });
    if (await page.getByText('Agendamento da conta', { exact: true }).count() !== 1
      || await page.getByText('Jogadores da conta', { exact: true }).count() !== 1) throw new Error('Duplicated operation panels');
  };
  const manage = name => page.getByRole('button', { name: `Gerenciar ${name}`, exact: true }).click();
  const add = async name => {
    await page.getByRole('button', { name: 'Adicionar jogador online', exact: true }).click();
    await page.getByRole('textbox', { name: 'Nome do jogador online', exact: true }).fill(name);
    await page.getByRole('button', { name: 'Registrar jogador na conta', exact: true }).click();
  };
  await open(); await revision(2);
  await page.getByRole('button', { name: 'Editar agendamento online', exact: true }).click();
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  if (await page.getByRole('button', { name: 'Adicionar jogador online', exact: true }).isEnabled()) throw new Error('Planning draft not protected');
  await page.getByRole('button', { name: 'Cancelar edição', exact: true }).click();
  await add('ana qa');
  await page.getByText('Já existe um jogador com este nome na mesa.', { exact: true }).waitFor();
  await page.getByRole('textbox', { name: 'Nome do jogador online', exact: true }).fill('Carla QA');
  await page.getByRole('button', { name: 'Registrar jogador na conta', exact: true }).click(); await revision(3);
  await manage('Carla QA');
  await page.getByRole('button', { name: 'Alterar nome de Carla QA', exact: true }).click();
  await page.getByRole('textbox', { name: 'Nome do jogador online', exact: true }).fill('Carla Maria QA');
  await page.getByRole('button', { name: 'Salvar nome na conta', exact: true }).click(); await revision(4);
  await manage('Carla Maria QA');
  await page.evaluate(() => { window.confirm = () => false; });
  await page.getByRole('button', { name: 'Confirmado · Carla Maria QA', exact: true }).click(); await revision(4);
  await page.evaluate(() => { window.confirm = () => true; });
  await page.getByRole('button', { name: 'Confirmado · Carla Maria QA', exact: true }).click(); await revision(5);
  await manage('Carla Maria QA');
  await page.getByRole('button', { name: 'Registrar add-on de Carla Maria QA', exact: true }).click(); await revision(6);
  await manage('Carla Maria QA');
  await page.getByText('Total R$ 147,00 · Pagamento: Pendente', { exact: true }).waitFor();
  await page.getByRole('button', { name: 'Registrar reentrada de Carla Maria QA', exact: true }).click(); await revision(7);
  await manage('Carla Maria QA');
  await page.getByRole('button', { name: 'Corrigir reentrada de Carla Maria QA', exact: true }).click(); await revision(8);
  await manage('Carla Maria QA');
  if (await page.getByRole('button', { name: 'Retirar entrada de Carla Maria QA', exact: true }).count()) throw new Error('Financial history removal allowed');
  for (const viewport of [{ width: 1440, height: 900 }, { width: 390, height: 844 }]) {
    await page.setViewportSize(viewport);
    await page.getByRole('button', { name: 'Confirmado · Carla Maria QA', exact: true }).scrollIntoViewIfNeeded();
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    if (await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)) throw new Error('Players overflow');
    await page.screenshot({ path: `output/playwright/players-online-${viewport.width}.png` });
  }
  await add('Daniel QA'); await revision(9); await manage('Daniel QA');
  await page.getByRole('button', { name: 'Retirar entrada de Daniel QA', exact: true }).click(); await revision(10);
  if (await page.getByText('Daniel QA', { exact: true }).count()) throw new Error('Removed player remains');
  const rpc = 'http://127.0.0.1:55321/rest/v1/rpc/**';
  await page.route(rpc, route => route.abort('failed'));
  try {
    await add('Eva QA');
    await page.getByText(/^Adicionar jogador: Eva QA ·/).waitFor();
    await page.reload(); await open();
    await page.getByText(/^Adicionar jogador: Eva QA ·/).waitFor();
  } finally { await page.unroute(rpc); }
  await page.getByRole('button', { name: 'Atualizar mesas', exact: true }).click();
  await open(); await revision(11); await manage('Carla Maria QA');
  await page.evaluate(() => { window.confirm = () => true; });
  let lost;
  await page.route(rpc, async route => {
    lost = route.request().postDataJSON().p_operation;
    const response = await route.fetch();
    if (!response.ok()) throw new Error('Actual server did not accept payment');
    await route.fulfill({ response, body: '{}' });
  });
  try {
    await page.getByRole('button', { name: 'Confirmado · Carla Maria QA', exact: true }).click();
    await page.getByText('Revisão de alterações necessária', { exact: true }).waitFor();
  } finally { await page.unroute(rpc); }
  if (!lost) throw new Error('Lost receipt scenario did not execute');
  await page.getByRole('button', { name: 'Atualizar mesas', exact: true }).click();
  await open(); await revision(12); await manage('Carla Maria QA');
  if (await page.getByRole('button', { name: 'Corrigir add-on de Carla Maria QA', exact: true }).isEnabled()) throw new Error('Paid entry correction enabled');
  await page.getByRole('button', { name: 'Alterar nome de Carla Maria QA', exact: true }).click();
  await page.getByRole('textbox', { name: 'Nome do jogador online', exact: true }).fill('Nome conflitante QA');
  await inAccount('concurrent', 12);
  await page.getByRole('button', { name: 'Salvar nome na conta', exact: true }).click(); await revision(13);
  await page.getByText('Conflito: a mesa foi alterada', { exact: true }).waitFor();
  await page.evaluate(() => { window.confirm = () => false; });
  await page.getByRole('button', { name: 'Manter versão da conta', exact: true }).click();
  await page.getByText('Conflito: a mesa foi alterada', { exact: true }).waitFor();
  await page.evaluate(() => { window.confirm = () => true; });
  await page.getByRole('button', { name: 'Manter versão da conta', exact: true }).click();
  await page.getByText('Versão da conta mantida. As tentativas ficaram no histórico deste aparelho.', { exact: true }).waitFor();
  await page.getByRole('button', { name: 'Ver tentativas arquivadas (1)', exact: true }).click();
  await page.getByText(/^Alterar nome: Nome conflitante QA ·/).waitFor();
  await manage('Carla Maria QA');
  await page.getByRole('button', { name: 'Alterar nome de Carla Maria QA', exact: true }).click();
  await page.getByRole('textbox', { name: 'Nome do jogador online', exact: true }).fill('Carla Final QA');
  await page.getByRole('button', { name: 'Salvar nome na conta', exact: true }).click(); await revision(14);
  const verified = await inAccount('verify');
  const carla = verified.players.find(player => player.display_name === 'Carla Final QA');
  if (verified.revision !== 14 || verified.players.length !== 4 || !carla || carla.re_entries !== 0
    || carla.add_ons !== 1 || carla.payment_status !== 'confirmed' || !carla.financial_activity_recorded
    || verified.events.length !== 3 || verified.payments.length !== 3
    || verified.entries.find(entry => entry.id === lost.id)?.status !== 'confirmed'
    || verified.entries.filter(entry => entry.status === 'cancelled').length !== 1) throw new Error('Player/account/audit verification failed');
  const localAfter = await page.evaluate(() => JSON.stringify(Object.entries(localStorage).sort()));
  if (localBefore !== localAfter) throw new Error('Local operational stores modified');
  await inAccount('login', 1);
  await page.goto('http://localhost:8081/app/history');
  await page.getByRole('button', { name: 'Consultar Noite da conta B', exact: true }).click();
  await page.getByText('Bia QA', { exact: true }).waitFor();
  if (await page.getByText('Carla Final QA', { exact: true }).count()) throw new Error('Account isolation failed');
  await page.context().clearCookies();
  await page.goto('http://localhost:8081/app?teste=1');
  return { passed: true, coverage: ['real local Auth/HTTP/IndexedDB', 'names/add/remove', 'entries/payment/reversal guards',
    'actual financial events', 'offline/reload', 'lost receipt/idempotent retry', 'real concurrent conflict/recovery',
    'account isolation', 'local stores unchanged', 'planning/player draft isolation', 'desktop/mobile layout'] };
}
