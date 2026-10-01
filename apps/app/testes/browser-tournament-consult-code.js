// Run against an app configured with the local API and tournament sync flag.
export default async function run(page, fixture, sdkSource) {
  if (fixture.apiUrl !== 'http://127.0.0.1:55321') throw new Error('Only local fixtures allowed');
  await page.goto('http://localhost:8081/app?teste=1');
  await page.getByText('Modo de teste · Dados locais', { exact: true }).waitFor();
  const login = async account => page.evaluate(async ({ account, fixture, sdkSource }) => {
    const url = URL.createObjectURL(new Blob([sdkSource], { type: 'text/javascript' }));
    try {
      const kit = await import(url);
      const client = kit.createBrowserClient(fixture.apiUrl, fixture.anonKey, { isSingleton: false,
        cookieOptions: { sameSite: 'lax', secure: false } });
      const result = await client.auth.signInWithPassword({ email: account.email, password: account.password });
      if (result.error || result.data.user?.id !== account.id) throw new Error('Local login failed');
      sessionStorage.removeItem('kt-test-access');
    } finally { URL.revokeObjectURL(url); }
  }, { account, fixture, sdkSource });
  await login(fixture.accounts[0]);
  await page.goto('http://localhost:8081/app/history');
  await page.getByText('Noite da conta A', { exact: true }).waitFor({ timeout: 30000 });
  if (await page.getByText('Noite da conta B', { exact: true }).count()) throw new Error('Foreign table visible');
  const saved = await page.evaluate(() => JSON.stringify(Object.entries(localStorage).sort()));
  await page.getByRole('button', { name: 'Consultar Noite da conta A', exact: true }).click();
  await page.getByText('Ana QA', { exact: true }).waitFor();
  await page.getByText('Pagamento: Pendente', { exact: true }).waitFor();
  const sizeCheck = async () => {
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
    if (overflow) throw new Error('Horizontal overflow');
  };
  await page.setViewportSize({ width: 1440, height: 900 });
  await sizeCheck();
  await page.screenshot({ path: 'output/playwright/tournament-consult-desktop.png' });
  await page.setViewportSize({ width: 390, height: 844 });
  await sizeCheck();
  await page.screenshot({ path: 'output/playwright/tournament-consult-mobile.png' });
  const pattern = 'http://127.0.0.1:55321/rest/v1/**';
  await page.route(pattern, route => route.abort('failed'));
  try {
    await page.getByRole('button', { name: 'Atualizar detalhes', exact: true }).click();
    await page.getByText('Não foi possível atualizar esta mesa.', { exact: true }).waitFor();
    await page.getByText('Ana QA', { exact: true }).waitFor();
    await page.reload();
    await page.getByText('Atualização indisponível. Exibindo a última lista salva.', { exact: true }).waitFor();
    await page.getByRole('button', { name: 'Consultar Noite da conta A', exact: true }).click();
    await page.getByText('Não foi possível atualizar esta mesa.', { exact: true }).waitFor();
    await page.getByText('Ana QA', { exact: true }).waitFor();
  } finally { await page.unroute(pattern); }
  await page.getByRole('button', { name: 'Atualizar detalhes', exact: true }).click();
  await page.getByText('Ana QA', { exact: true }).waitFor();
  await page.getByText('Não foi possível atualizar esta mesa.', { exact: true }).waitFor({ state: 'hidden' });
  const after = await page.evaluate(() => JSON.stringify(Object.entries(localStorage).sort()));
  if (saved !== after) throw new Error('Read-only consultation modified local account storage');
  await login(fixture.accounts[1]);
  await page.goto('http://localhost:8081/app/history');
  await page.getByText('Noite da conta B', { exact: true }).waitFor();
  if (await page.getByText('Noite da conta A', { exact: true }).count()) throw new Error('Account switch leaked table');
  await page.getByRole('button', { name: 'Consultar Noite da conta B', exact: true }).click();
  await page.getByText('Bia QA', { exact: true }).waitFor();
  if (await page.getByText('Ana QA', { exact: true }).count()) throw new Error('Account switch leaked details');
  await page.context().clearCookies();
  await page.goto('http://localhost:8081/app?teste=1');
  return { passed: true, auth: 'local real', storage: 'browser IndexedDB',
    coverage: 'scoped UI detail, read-only local storage, cache after reload/network failure, retry, account switch, desktop/mobile' };
}
