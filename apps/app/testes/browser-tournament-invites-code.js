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
      const id = fixture.tournaments[0];
      if (job === 'audit') {
        const result = await client.from('sync_operation_audit').select('operation_id,after_revision').eq('entity_id', id);
        if (result.error) throw Error('Audit read failed');
        return { count: result.data.length, revisions: new Set(result.data.map(row => row.after_revision)).size };
      }
      const table = await client.from('tournaments').select('id,revision,status').eq('id', id).single();
      const invites = await client.from('tournament_invites').select('id,name,status,player_id,waiting_since,deleted_at').eq('tournament_id', id);
      const players = await client.from('tournament_players').select('id,display_name,buy_ins,payment_status').eq('tournament_id', id);
      if (table.error || invites.error || players.error) throw Error('Account read failed');
      if (job === 'concurrent') {
        const eva = invites.data.find(row => row.name === 'Eva QA');
        const result = await client.rpc('apply_tournament_operation', { p_operation: kit.createOperation({
          ownerId: fixture.accounts[0].id, entityId: id, entity: 'tournament', expectedRevision: table.data.revision,
          kind: 'invite.attendance', payload: { inviteId: eva.id, status: 'absent' },
        }) });
        if (result.error) throw Error('Concurrent attendance failed');
      }
      return { table: table.data, invites: invites.data, players: players.data };
    } finally { URL.revokeObjectURL(url); }
  }, { fixture, sdkSource, job, args });
  const button = name => page.getByRole('button', { name, exact: true });
  const open = () => button('Consultar Noite da conta A').click();
  const confirmed = revision => page.getByText(new RegExp(`^Revisão ${revision} ·`)).waitFor({ timeout: 30000 });
  const manage = name => button(`Gerenciar convidado ${name}`).click();
  const presence = (name, label) => page.getByRole('radiogroup', { name: `Presença de ${name}`, exact: true }).getByRole('radio', { name: label, exact: true }).click();
  const consent = () => page.evaluate(() => { window.confirm = () => true; });
  const add = async (name, revision) => {
    await button('Adicionar convidado online').click();
    await page.getByRole('textbox', { name: 'Nome do convidado online', exact: true }).fill(name);
    await page.getByRole('radiogroup', { name: 'Presença do novo convidado', exact: true }).getByRole('radio', { name: 'Confirmado', exact: true }).click();
    await button('Registrar convidado na conta').click();
    if (revision) await confirmed(revision);
  };
  const invite = async name => {
    const state = await account('read');
    const row = state.invites.find(row => row.name === name && !row.deleted_at);
    if (!row) throw Error('Invitation missing');
    return { row, element: page.getByTestId(`online-invite-${row.id}`) };
  };
  await page.context().clearCookies();
  await page.goto('http://localhost:8081/app?teste=1');
  await page.getByText('Modo de teste · Dados locais', { exact: true }).waitFor();
  await account('login', 0);
  await page.goto('http://localhost:8081/app/history');
  await consent(); await open(); await confirmed(2);
  const localBefore = await page.evaluate(() => JSON.stringify(Object.entries(localStorage).sort()));
  await button('Editar agendamento online').click();
  await page.getByRole('textbox', { name: 'Data do agendamento online', exact: true }).fill('02/01/2100');
  await page.getByRole('textbox', { name: 'Limite de jogadores online', exact: true }).fill('2');
  await button('Salvar agendamento na conta').click();
  await button('Atualizar detalhes').click(); await confirmed(3);
  await add('Bia QA', 4); await add('Carla QA', 5); await add('Duda QA', 6);
  const carla = await invite('Carla QA'), duda = await invite('Duda QA');
  if (carla.row.status !== 'waiting' || duda.row.status !== 'waiting') throw Error('Full table failed to waitlist');
  await carla.element.getByText('Em espera · 1º na espera', { exact: true }).waitFor();
  await duda.element.getByText('Em espera · 2º na espera', { exact: true }).waitFor();
  await button('Adicionar convidado online').click();
  await page.getByRole('textbox', { name: 'Nome do convidado online', exact: true }).fill(' carla qa ');
  if (await button('Editar agendamento online').isEnabled() || await button('Adicionar jogador online').isEnabled()) throw Error('Parallel editing was allowed');
  await button('Registrar convidado na conta').click();
  await page.getByText('Já existe um convidado com este nome.', { exact: true }).waitFor();
  await button('Cancelar edição do convidado').click();
  await manage('Bia QA'); await presence('Bia QA', 'Ausente'); await confirmed(7);
  if ((await invite('Carla QA')).row.status !== 'confirmed') throw Error('First waiting invite not promoted');
  await manage('Carla QA'); await presence('Carla QA', 'Em espera'); await confirmed(8);
  if ((await invite('Duda QA')).row.status !== 'confirmed') throw Error('Released place not promoted');
  await add('Eva QA', 9);
  await manage('Duda QA'); await button('Retirar convidado Duda QA').click(); await confirmed(10);
  if ((await invite('Carla QA')).row.status !== 'confirmed') throw Error('Removal did not promote oldest waiter');
  await manage('Carla QA'); await button('Registrar chegada de Carla QA').click(); await confirmed(11);
  const arrived = await invite('Carla QA');
  await arrived.element.getByText('Já entrou na mesa', { exact: true }).waitFor();
  if (!arrived.row.player_id || await button('Gerenciar convidado Carla QA').count()) throw Error('Checked-in invite remained editable');
  const players = (await account('read')).players;
  if (players.length !== 2 || players.find(row => row.display_name === 'Carla QA')?.buy_ins !== 1) throw Error('Check-in failed single entry');
  await add('Ana QA', 12); await manage('Ana QA'); await button('Registrar chegada de Ana QA').click(); await confirmed(13);
  if ((await account('read')).players.length !== 2) throw Error('Existing player duplicated by check-in');
  await account('concurrent');
  await manage('Eva QA'); await presence('Eva QA', 'Ausente');
  await page.getByText('Conflito: a mesa foi alterada', { exact: true }).waitFor({ timeout: 30000 });
  await button('Atualizar mesas').click(); await button('Atualizar detalhes').click(); await confirmed(14);
  await button('Manter versão da conta').click();
  await page.getByRole('button', { name: /^Ver tentativas arquivadas/ }).click();
  await page.getByText('Tentativa arquivada · Versão da conta mantida', { exact: true }).waitFor();
  let lost = false;
  const rpc = `${fixture.apiUrl}/rest/v1/rpc/apply_tournament_operation`;
  await page.route(rpc, async route => {
    if (lost) return route.continue();
    lost = true; const response = await route.fetch();
    if (response.status() !== 200) throw Error('Expected committed command');
    await route.abort('failed');
  });
  try {
    await add('Fabi QA');
    await page.getByText(/^Adicionar convidado: Fabi QA ·/).waitFor({ timeout: 30000 });
    await page.reload(); await consent(); await open(); await confirmed(15);
  } finally { await page.unroute(rpc); }
  // Reload cannot steal another tab's live sending lease; recover after its real deadline.
  await page.waitForTimeout(31000);
  await button('Atualizar mesas').click(); await button('Atualizar detalhes').click(); await confirmed(15);
  const final = await account('read');
  if (!lost || final.invites.filter(row => row.name === 'Fabi QA').length !== 1 || final.table.revision !== 15) throw Error('Lost receipt duplicated invitation');
  const audit = await account('audit');
  if (audit.count !== 15 || audit.revisions !== 15) throw Error('Unexpected committed audit count');
  if (await page.evaluate(() => JSON.stringify(Object.entries(localStorage).sort())) !== localBefore) throw Error('Online invitations changed local stores');
  await page.setViewportSize({ width: 390, height: 844 });
  await button('Adicionar convidado online').click();
  await page.getByRole('textbox', { name: 'Nome do convidado online', exact: true }).scrollIntoViewIfNeeded();
  await page.evaluate(() => document.querySelector('[aria-label="Nome do convidado online"]').parentElement.scrollIntoView({ block: 'center' }));
  if (await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)) throw Error('Mobile overflow');
  await page.screenshot({ path: 'output/playwright/invites-online-390.png' });
  await button('Cancelar edição do convidado').click();
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.getByText('Convidados e presença', { exact: true }).scrollIntoViewIfNeeded();
  await page.screenshot({ path: 'output/playwright/invites-online-1440.png' });
  await account('login', 1); await page.reload();
  await button('Consultar Noite da conta B').waitFor({ timeout: 30000 });
  if (await button('Consultar Noite da conta A').count() || await page.getByText('Fabi QA', { exact: true }).count()) throw Error('Other account leaked invitation');
  return { realLocalAuth: true, fullTableWaitlisted: true, queuePromoted: true, reentryOrder: true,
    checkInSingleEntry: true, existingPlayerReused: true, realRevisionConflict: true, lostReceiptIdempotent: true,
    localDataUnchanged: true, accountIsolation: true, finalRevision: final.table.revision };
}
