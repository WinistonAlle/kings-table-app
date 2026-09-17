export default async function run(page, bundleUrl) {
  return page.evaluate(async url => {
    const { SyncOutbox } = await import(url);
    const owner = crypto.randomUUID(), other = crypto.randomUUID(), id = crypto.randomUUID();
    const name = `qa-preset-library-${crypto.randomUUID()}`;
    const one = new SyncOutbox(name), two = new SyncOutbox(name);
    const check = (condition, message) => { if (!condition) throw new Error(message); };
    const payload = { name: 'Biblioteca', levels: [
      { level: 1, smallBlind: 25, bigBlind: 50, ante: 0, durationMinutes: 20 },
    ] };
    try {
      await one.mutatePreset(owner, id, { kind: 'preset.save', payload });
      let views = await two.presetViews(owner);
      check(views.length === 1 && views[0].confirmed === null, 'Pending creation missing');
      check(views[0].projected.payload.name === payload.name, 'Pending projection missing');
      check((await two.presetViews(other)).length === 0, 'Account leaked');
      await one.mergePresetBase({ ownerId: other, id, revision: 1, deleted: false,
        payload: { ...payload, name: 'Other account' } });
      check((await one.presetViews(owner))[0].projected.payload.name === payload.name, 'Same ID mixed accounts');
      const entry = await one.claim(owner, Date.now());
      await one.confirm(owner, entry.operation.id, entry.lease.token,
        { operationId: entry.operation.id, revision: 1 });
      await two.mutatePreset(owner, id, { kind: 'preset.remove' });
      views = await one.presetViews(owner);
      check(views[0].confirmed.deleted === false && views[0].projected.deleted === true, 'Pending removal hidden');
      check(views[0].pending.length === 1, 'Pending command missing');
      await one.close(); await two.close();
      const reopened = new SyncOutbox(name);
      try {
        check(JSON.stringify(await reopened.presetViews(owner)) === JSON.stringify(views), 'Reopen lost library state');
        check((await reopened.presetViews(other))[0].confirmed.payload.name === 'Other account', 'Other account changed');
      } finally { await reopened.close(); }
      return { passed: true, storage: 'real IndexedDB', scope: 'library projections and account isolation; no HTTP/Auth/UI claim' };
    } finally {
      await one.close(); await two.close();
      await new Promise((resolve, reject) => {
        const request = indexedDB.deleteDatabase(name);
        request.onsuccess = resolve; request.onerror = () => reject(request.error);
        request.onblocked = () => reject(new Error('QA database deletion blocked'));
      });
    }
  }, bundleUrl);
}
