export default async function run(page, sdkSource) {
  const second = await page.context().newPage();
  const fixture = { name: `qa-resolution-${crypto.randomUUID()}`, owner: crypto.randomUUID(),
    other: crypto.randomUUID(), id: crypto.randomUUID() };
  const setup = async target => {
    await target.goto('http://localhost:3001/app?teste=1');
    await target.evaluate(async ({ sdkSource, fixture }) => {
      const url = URL.createObjectURL(new Blob([sdkSource], { type: 'text/javascript' }));
      try {
        const { SyncOutbox } = await import(url);
        const box = new SyncOutbox(fixture.name);
        window.ktResolutionQA = { box, fixture };
      } finally { URL.revokeObjectURL(url); }
    }, { sdkSource, fixture });
  };
  const require = (condition, message) => { if (!condition) throw new Error(message); };
  try {
    await setup(page); await setup(second);
    await page.evaluate(async () => {
      const { box, fixture: f } = window.ktResolutionQA;
      const base = { ownerId: f.owner, id: f.id, revision: 1, name: 'QA mesa', format: 'regular',
        status: 'upcoming', buyIn: 25, startTime: null, updatedAt: new Date().toISOString(), deletedAt: null };
      await box.mergeTournamentSummaries(f.owner, [base], new AbortController().signal);
      for (const revision of [1, 2]) await box.enqueueTournament({ version: 1, id: crypto.randomUUID(),
        ownerId: f.owner, entityId: f.id, entity: 'tournament', kind: 'tournament.update',
        expectedRevision: revision, createdAt: new Date().toISOString(),
        payload: { startTime: '2027-01-01T20:00:00Z', location: 'QA sala', capacity: 8 } });
      const entry = await box.claim(f.owner, Date.now(), 30000, 'tournament');
      await box.fail(f.owner, entry.operation.id, entry.lease.token, 'conflict',
        { code: '40001', message: 'QA concurrent revision' });
    });
    const request = await page.evaluate(async () => {
      const { box, fixture: f } = window.ktResolutionQA;
      const view = (await box.tournamentView(f.owner)).views[0];
      return { expectedBase: view.confirmed, pendingOperationIds: view.pending.map(row => row.operation.id),
        decision: { kind: 'keep_remote' } };
    });
    const resolve = target => target.evaluate(async request => {
      const { box, fixture: f } = window.ktResolutionQA;
      try { await box.resolveTournament(f.owner, f.id, request); return 'resolved'; }
      catch { return 'refused'; }
    }, request);
    const outcomes = await Promise.all([resolve(page), resolve(second)]);
    require(outcomes.filter(value => value === 'resolved').length === 1, 'Only one tab may resolve the reviewed queue');
    const result = await page.evaluate(async () => {
      const { box, fixture: f } = window.ktResolutionQA;
      const records = await box.list(f.owner);
      const view = await box.tournamentView(f.owner);
      return { statuses: records.map(row => row.status), revisions: records.map(row => row.operation.expectedRevision),
        preservedIssue: records[0].issue.code, sharedResolution: records[0].resolution.id === records[1].resolution.id,
        pending: view.pending.length, reconciliation: view.views[0].reconciliationNeeded,
        other: (await box.list(f.other)).length };
    });
    require(JSON.stringify(result.statuses) === '["cancelled","cancelled"]', 'Queue must archive atomically');
    require(JSON.stringify(result.revisions) === '[1,2]' && result.preservedIssue === '40001', 'Original history must survive');
    require(result.sharedResolution && !result.pending && !result.reconciliation && !result.other, 'Projection and isolation');
    await page.evaluate(async () => { await window.ktResolutionQA.box.close(); });
    await setup(page);
    const reloaded = await page.evaluate(async () => {
      const { box, fixture: f } = window.ktResolutionQA;
      return (await box.list(f.owner)).map(row => row.status);
    });
    require(JSON.stringify(reloaded) === JSON.stringify(result.statuses), 'Archive must survive a full reload');
    return { passed: true, coverage: ['real Chromium IndexedDB', 'two-tab race', 'retained command/issue history',
      'shared explicit decision', 'account isolation', 'reload', 'queue unblocked'] };
  } finally {
    for (const target of [page, second]) await target.evaluate(async () => {
      await window.ktResolutionQA?.box.close(); delete window.ktResolutionQA;
    }).catch(() => undefined);
    await page.evaluate(name => new Promise((resolve, reject) => {
      const request = indexedDB.deleteDatabase(name);
      request.onsuccess = () => resolve(); request.onerror = () => reject(request.error);
      request.onblocked = () => reject(new Error('QA database is still open'));
    }), fixture.name);
    await second.close();
  }
}
