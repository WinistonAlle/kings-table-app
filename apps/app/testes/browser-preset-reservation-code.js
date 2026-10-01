export default async function run(page, sdkSource) {
  await page.goto('http://localhost:3001/app?teste=1');
  const fixture = await page.evaluate(() => ({ owner: crypto.randomUUID(), other: crypto.randomUUID(), id: crypto.randomUUID(),
    name: `qa-preset-reservation-${crypto.randomUUID()}`, operationId: crypto.randomUUID() }));
  const levels = [{ level: 1, smallBlind: 37, bigBlind: 74, ante: 0, durationMinutes: 7 }];
  const operation = { version: 1, id: fixture.operationId, ownerId: fixture.owner, entityId: fixture.id,
    entity: 'preset', kind: 'preset.save', expectedRevision: 0, createdAt: new Date().toISOString(), payload: { name: 'Reservation QA', levels } };
  const second = await page.context().newPage();
  const use = (target, command) => target.evaluate(async ({ fixture, sdkSource, command }) => {
    const url = URL.createObjectURL(new Blob([sdkSource], { type: 'text/javascript' }));
    const kit = await import(url), box = new kit.SyncOutbox(fixture.name);
    try {
      if (command.kind === 'enqueue') {
        try { const entry = await box.enqueuePreset(command.operation); return { accepted: true, id: entry.operation.id, sequence: entry.sequence }; }
        catch (error) { return { accepted: false, error: error.message }; }
      }
      return { own: (await box.list(fixture.owner)).length, foreign: (await box.list(fixture.other)).length,
        revision: (await box.presetViews(fixture.owner))[0]?.projected?.revision };
    } finally { await box.close(); URL.revokeObjectURL(url); }
  }, { fixture, sdkSource, command });
  try {
    await second.goto('http://localhost:3001/app?teste=1');
    const repeated = await Promise.all([use(page, { kind: 'enqueue', operation }), use(second, { kind: 'enqueue', operation })]);
    if (repeated.some(result => !result.accepted) || repeated[0].id !== repeated[1].id || repeated[0].sequence !== repeated[1].sequence) throw Error('Duplicate reservation was not idempotent');
    const race = [crypto.randomUUID(), crypto.randomUUID()].map(id => ({ ...operation, id, expectedRevision: 1, payload: { name: 'Revised QA', levels } }));
    const raced = await Promise.all([use(page, { kind: 'enqueue', operation: race[0] }), use(second, { kind: 'enqueue', operation: race[1] })]);
    if (raced.filter(result => result.accepted).length !== 1) throw Error('Both revision competitors won or both failed');
    const reused = await use(page, { kind: 'enqueue', operation: { ...operation, payload: { name: 'Changed content', levels } } });
    if (reused.accepted) throw Error('Reused identity changed content');
    await page.reload();
    const after = await use(page, { kind: 'read' });
    if (after.own !== 2 || after.foreign !== 0 || after.revision !== 2) throw Error('Reload/scope/revision did not preserve reservation');
    const again = await use(second, { kind: 'enqueue', operation });
    if (!again.accepted || (await use(page, { kind: 'read' })).own !== 2) throw Error('Retry after revision progression duplicated operation');
    return { realIndexedDB: true, twoTabs: true, singleRevisionWinner: true, stableRetry: true, accountScope: true, reload: true };
  } finally {
    await second.close();
    await page.evaluate(name => new Promise((resolve, reject) => {
      const request = indexedDB.deleteDatabase(name);
      request.onsuccess = () => resolve(); request.onerror = () => reject(request.error);
      request.onblocked = () => reject(Error('QA database remained open'));
    }), fixture.name);
  }
}
