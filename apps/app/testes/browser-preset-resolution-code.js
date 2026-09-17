export default async function run(page, bundleUrl) {
  return page.evaluate(async url => {
    const { SyncOutbox } = await import(url);
    const name = `qa-preset-resolution-${crypto.randomUUID()}`;
    const owner = crypto.randomUUID(), other = crypto.randomUUID(), id = crypto.randomUUID();
    const one = new SyncOutbox(name), two = new SyncOutbox(name);
    const check = (condition, message) => { if (!condition) throw new Error(message); };
    const payload = { name: 'Local intention', levels: [
      { level: 1, smallBlind: 25, bigBlind: 50, ante: 0, durationMinutes: 20 },
    ] };
    try {
      const first = await one.mutatePreset(owner, id, { kind: 'preset.save', payload });
      const second = await two.mutatePreset(owner, id, { kind: 'preset.save', payload: { ...payload, name: 'Latest intention' } });
      const lease = await one.claim(owner);
      await one.fail(owner, first.operation.id, lease.lease.token, 'conflict', { code: '40001', message: 'Definitive conflict fixture' });
      await two.mergePresetBase({ ownerId: owner, id, revision: 2, deleted: false,
        payload: { ...payload, name: 'Account version' } });
      const view = await one.presetView(owner, id);
      const request = { expectedBase: view.confirmed, pendingOperationIds: view.pending.map(entry => entry.operation.id),
        decision: { kind: 'save_copy', name: 'Preserved copy' } };
      const results = await Promise.allSettled([
        one.resolvePreset(owner, id, request), two.resolvePreset(owner, id, request),
      ]);
      check(results.filter(result => result.status === 'fulfilled').length === 1, 'Concurrent resolution duplicated');
      const copy = results.find(result => result.status === 'fulfilled').value;
      check(copy.operation.expectedRevision === 0 && copy.operation.entityId !== id, 'Copy reused original revision or identity');
      check(copy.operation.payload.name === 'Preserved copy', 'Copy payload missing');
      const resolved = await two.presetView(owner, id);
      check(resolved.pending.length === 0 && resolved.archived.length === 2, 'Resolution lost intentions');
      check(resolved.archived[1].operation.id === second.operation.id, 'Dependent intention lost');
      check(resolved.confirmed.payload.name === 'Account version', 'Resolution overwrote account version');
      check(resolved.archived[0].resolution.copiedTo === copy.operation.entityId, 'Copy history unlinked');
      check((await one.enqueue(first.operation)).status === 'cancelled', 'Archived operation resurrected');
      check((await one.claim(owner)).operation.id === copy.operation.id, 'Archived operation sent again');
      check((await one.presetViews(other)).length === 0, 'Resolution leaked another account');
      await one.close(); await two.close();
      const reopened = new SyncOutbox(name);
      try {
        check(JSON.stringify(await reopened.presetView(owner, id)) === JSON.stringify(resolved), 'Reload lost resolution history');
      } finally { await reopened.close(); }
      return { passed: true, storage: 'real Chrome IndexedDB', scope: 'atomic resolution/copy, concurrent connections, archive, isolation and reopen; no HTTP/Auth/UI claim' };
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
