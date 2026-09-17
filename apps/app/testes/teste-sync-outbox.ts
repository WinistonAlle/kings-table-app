import 'fake-indexeddb/auto';
import assert from 'node:assert/strict';
import { deleteDB } from 'idb';
import { novaIdentidade } from '../lib/identidade';
import { createOperation, parseOperation } from '../lib/sync-operation';
import { SyncOutbox } from '../lib/sync-outbox';

async function main() {
  const name = `qa-outbox-${novaIdentidade()}`;
  const a = novaIdentidade(), b = novaIdentidade(), entity = novaIdentidade();
  const first = createOperation({ ownerId: a, entityId: entity, entity: 'tournament',
    kind: 'tournament.create', expectedRevision: 0, payload: { name: 'Mesa A', details: { one: 1, two: 2 } } });
  let one = new SyncOutbox(name), two = new SyncOutbox(name);
  try {
    const [saved, duplicate] = await Promise.all([one.enqueue(first), two.enqueue(first)]);
    assert.equal(saved.sequence, duplicate.sequence);
    assert.equal((await one.list(a)).length, 1);
    const reordered = { ...first, payload: { details: { two: 2, one: 1 }, name: 'Mesa A' } };
    assert.equal((await two.enqueue(reordered)).sequence, saved.sequence, 'ordem das chaves nao muda a operacao');
    await assert.rejects(two.enqueue({ ...first, payload: { name: 'Outro nome' } }), /outro conteudo/);
    assert.equal((await one.list(a))[0].operation.payload.name, 'Mesa A');

    const next = createOperation({ ...first, expectedRevision: 1, kind: 'tournament.update', payload: { name: 'Nome atualizado' } });
    const other = createOperation({ ...first, entityId: novaIdentidade() });
    const foreign = createOperation({ ...first, ownerId: b });
    await one.enqueue(next); await two.enqueue(other); await two.enqueue(foreign);
    const claims = await Promise.all([one.claim(a, 1000), two.claim(a, 1000)]);
    assert.deepEqual(new Set(claims.map(e => e!.operation.id)), new Set([first.id, other.id]), 'duas conexoes nao enviam a mesma entidade simultaneamente');
    assert.equal(await one.claim(a, 1000), null, 'ordem por entidade preservada');
    assert.equal((await one.list(b))[0].attempts, 0, 'conta B nao foi enviada por A');
    const initialLease = claims.find(e => e!.operation.id === first.id)!;
    const renewed = (await two.claim(a, 32000))!;
    assert.equal(renewed.operation.id, first.id);
    assert.equal(renewed.attempts, 2);
    assert.deepEqual(renewed.operation, first, 'timeout reenvia o mesmo ID e payload');
    assert.notEqual(renewed.lease!.token, initialLease.lease!.token);
    const receipt = { operationId: first.id, revision: 1 };
    assert.equal(await one.confirm(a, first.id, initialLease.lease!.token, receipt), false, 'resposta de lease antiga nao altera a fila');
    assert.equal(await one.confirm(b, first.id, renewed.lease!.token, receipt), false, 'confirmacao da conta errada nao altera A');
    await assert.rejects(one.confirm(a, first.id, renewed.lease!.token, { ...receipt, revision: 2 }), /Revisao/);
    await assert.rejects(one.confirm(a, first.id, renewed.lease!.token, { operationId: other.id, revision: 1 }), /outra operacao/);
    assert.equal(await two.confirm(a, first.id, renewed.lease!.token, receipt), true);
    assert.equal(await two.confirm(a, first.id, renewed.lease!.token, receipt), false);
    assert.equal((await one.enqueue(first)).status, 'confirmed', 'reenqueue nao ressuscita operacao confirmada');

    const leasedNext = (await one.claim(a, 32001))!;
    assert.equal(leasedNext.operation.id, next.id);
    await one.fail(a, next.id, leasedNext.lease!.token, 'conflict', { code: '40001', message: 'Revisao mudou' });
    const dependent = createOperation({ ...next, expectedRevision: 2 });
    await two.enqueue(dependent);
    const independent = (await two.claim(a, 32001))!;
    assert.equal(independent.operation.id, other.id, 'conflito nao bloqueia outra mesa');
    await two.fail(a, other.id, independent.lease!.token, 'retry', { code: 'network', message: 'Conexao perdida' });
    const retry = (await one.claim(a, 32002))!;
    assert.deepEqual(retry.operation, other);
    await one.fail(a, other.id, retry.lease!.token, 'rejected', { code: '42501', message: 'Sem permissao' });
    assert.equal(await two.claim(a, 999999), null, 'rejeicao/conflito nao sao descartados nem ultrapassados');
    assert.equal((await one.list(a)).find(e => e.operation.id === dependent.id)!.status, 'queued');

    const before = await one.list(a);
    const add = IDBObjectStore.prototype.add;
    IDBObjectStore.prototype.add = function (value: unknown, key?: IDBValidKey) {
      if (this.name === 'operations') throw new DOMException('Quota de teste', 'QuotaExceededError');
      return add.call(this, value, key);
    };
    try { await assert.rejects(one.enqueue(createOperation({ ...other })), { name: 'QuotaExceededError' }); }
    finally { IDBObjectStore.prototype.add = add; }
    assert.deepEqual(await one.list(a), before, 'falha de escrita nao altera a fila');
    const recovered = await one.enqueue(createOperation({ ...other }));
    assert.equal(recovered.sequence, Math.max(...before.map(e => e.sequence), (await one.list(b))[0].sequence) + 1, 'counter tambem faz rollback');

    await one.close(); await two.close();
    one = new SyncOutbox(name); two = new SyncOutbox(name);
    assert.equal((await one.list(a)).find(e => e.operation.id === first.id)!.status, 'confirmed');
    assert.equal((await two.list(a)).find(e => e.operation.id === next.id)!.status, 'conflict');
    assert.equal((await one.list(b)).length, 1);
    assert.throws(() => parseOperation({ ...first, entityId: 't_legado' }));
    assert.throws(() => parseOperation({ ...first, expectedRevision: -1 }));
    assert.throws(() => parseOperation({ ...first, entity: 'preset' }));
    assert.throws(() => parseOperation({ ...first, payload: { unsupported: undefined } }));
    assert.throws(() => parseOperation({ ...first, payload: { large: 'x'.repeat(1024 * 1024) } }), /1 MB/);
    await assert.rejects(one.list('preview-local'));
  } finally { await one.close(); await two.close(); await deleteDB(name); }
  console.log('Outbox: persistencia, isolamento, concorrencia, FIFO por entidade, lease, retry, recibos, conflitos e rollback passaram (IndexedDB simulado).');
}
main().catch(error => { console.error(error); process.exitCode = 1; });
