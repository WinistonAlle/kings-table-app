export default async function run(page, fixture, sdkSource) {
  if (fixture.apiUrl !== 'http://127.0.0.1:55321') throw Error('Local fixtures only');
  await page.context().clearCookies();
  await page.goto('http://localhost:8081/app?teste=1');
  await page.getByText('Modo de teste · Dados locais', { exact: true }).waitFor();
  await page.evaluate(async ({ fixture, sdkSource }) => {
    const url = URL.createObjectURL(new Blob([sdkSource], { type: 'text/javascript' }));
    try {
      const kit = await import(url);
      const client = kit.createBrowserClient(fixture.apiUrl, fixture.anonKey, {
        isSingleton: false, cookieOptions: { sameSite: 'lax', secure: false },
      });
      const user = fixture.accounts[0];
      const result = await client.auth.signInWithPassword({ email: user.email, password: user.password });
      if (result.error || result.data.user?.id !== user.id) throw Error('Local login failed');
      sessionStorage.removeItem('kt-test-access');
    } finally { URL.revokeObjectURL(url); }
  }, { fixture, sdkSource });
  const protectedButton = page.getByRole('button', { name: 'Criar mesa', exact: true });
  const assertCenteredRetry = async () => {
    const box = await page.getByRole('button', { name: 'Tentar novamente', exact: true }).boundingBox();
    if (!box || Math.abs(box.x + box.width / 2 - page.viewportSize().width / 2) > 2) throw Error('Retry button is not centered');
  };
  await page.goto('http://localhost:8081/app');
  await protectedButton.waitFor({ timeout: 30000 });
  const before = await page.evaluate(() => JSON.stringify(Object.entries(localStorage).sort()));
  const cookieNames = async () => (await page.context().cookies()).map(cookie => cookie.name).sort().join('|');
  const cookiesBefore = await cookieNames();
  const userUrl = `${fixture.apiUrl}/auth/v1/user`;
  let release;
  let reads = 0;
  const held = new Promise(resolve => { release = resolve; });
  await page.route(userUrl, async route => {
    reads++;
    const response = await route.fetch();
    if (response.status() !== 200) throw Error('Expected real authenticated user');
    await held;
    await route.fulfill({ response });
  });
  try {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.reload();
    await page.getByText('A verificação demorou mais que o esperado. Confira sua conexão e tente novamente.', { exact: true }).waitFor({ timeout: 20000 });
    const retry = page.getByRole('button', { name: 'Tentar novamente', exact: true });
    await retry.waitFor();
    await assertCenteredRetry();
    if (await protectedButton.count()) throw Error('Timeout exposed protected content');
    if (await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)) throw Error('Mobile overflow');
    await page.screenshot({ path: 'output/playwright/access-timeout-390.png' });
    release();
    await page.waitForTimeout(2000);
    if (await protectedButton.count() || !await retry.isVisible()) throw Error('Late auth response reopened account');
    await page.unroute(userUrl);
    await retry.click();
    await protectedButton.waitFor({ timeout: 30000 });
  } finally { release(); await page.unroute(userUrl); }
  if (await cookieNames() !== cookiesBefore) throw Error('Auth timeout discarded cookies');
  if (await page.evaluate(() => JSON.stringify(Object.entries(localStorage).sort())) !== before) throw Error('Auth retry changed local data');
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.route(userUrl, route => route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ message: 'Temporary local QA failure' }) }));
  try {
    await page.reload();
    await page.getByText('Não foi possível verificar seu acesso.', { exact: true }).waitFor({ timeout: 20000 });
    if (await protectedButton.count()) throw Error('HTTP failure exposed protected content');
    await assertCenteredRetry();
    await page.screenshot({ path: 'output/playwright/access-failure-1440.png' });
  } finally { await page.unroute(userUrl); }
  await page.getByRole('button', { name: 'Tentar novamente', exact: true }).click();
  await protectedButton.waitFor({ timeout: 30000 });
  await page.screenshot({ path: 'output/playwright/access-recovered-1440.png' });
  if (await cookieNames() !== cookiesBefore) throw Error('HTTP failure discarded session');
  if (await page.evaluate(() => JSON.stringify(Object.entries(localStorage).sort())) !== before) throw Error('HTTP retry changed local data');
  return { realLocalAuth: true, delayedReads: reads, timeoutBlocked: true, lateSuccessIgnored: true,
    retryRecovered: true, temporaryHttpFailureBlocked: true, cookiesPreserved: true, localDataPreserved: true };
}
