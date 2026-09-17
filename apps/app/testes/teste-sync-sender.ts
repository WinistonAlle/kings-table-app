import 'fake-indexeddb/auto';
import assert from 'node:assert/strict';
import { deleteDB } from 'idb';
import { novaIdentidade } from '../lib/identidade';
import { createOperation } from '../lib/sync-operation';
import { SyncOutbox } from '../lib/sync-outbox';
import { SyncSender, type SyncOutcome } from '../lib/sync-sender';

async function main() {
  const name = `qa-sender-${novaIdentidade()}`, owner = novaIdentidade(), foreign = novaIdentidade();
  const outbox = new SyncOutbox(name);
  const operation = createOperation({ ownerId: owner, entityId: novaIdentidade(), entity: 'tournament',
    kind: 'tournament.create', expectedRevision: 0, payload: { name: 'QA' } });
  let now = 1000;
  const clock = () => now;
  const sent: string[] = [];
  try {
    await outbox.enqueue(operation);
    await outbox.enqueue(createOperation({ ...operation, ownerId: foreign }));
    let respond!: (result: SyncOutcome) => void;
    let started!: () => void;
    const waiting = new Promise<void>(resolve => { started = resolve; });
    const sender = new SyncSender(owner, outbox, async (op, signal) => {
      sent.push(op.id); started();
      const result = await new Promise<SyncOutcome>(resolve => { respond = resolve; });
      assert.equal(signal.aborted, true, 'stop cancela o sinal do transporte');
      return result;
    }, clock);
    const running = sender.run();
    assert.equal(sender.run(), running, 'run concorrente compartilha o processamento');
    await waiting;
    sender.stop();
    respond({ status: 'confirmed', receipt: { operationId: operation.id, revision: 1 } });
    await running;
    assert.equal((await outbox.list(owner))[0].status, 'sending', 'resposta apos stop nao confirma a conta anterior');
    await sender.run();
    assert.equal(sent.length, 1, 'sender encerrado nao reinicia');
    now = 32000;
    const resumed = new SyncSender(owner, outbox, async op => {
      sent.push(op.id);
      return { status: 'confirmed', receipt: { operationId: op.id, revision: op.expectedRevision + 1 } };
    }, clock);
    await resumed.run();
    assert.deepEqual(sent, [operation.id, operation.id], 'retomada reenvia o mesmo ID para recibo idempotente do servidor');
    assert.equal((await outbox.list(owner))[0].status, 'confirmed');
    assert.equal((await outbox.list(foreign))[0].status, 'queued');

    const networkOperation = createOperation({ ...operation, entityId: novaIdentidade() });
    await outbox.enqueue(networkOperation);
    let attempts = 0;
    const network = new SyncSender(owner, outbox, async op => {
      ++attempts;
      if (attempts === 1) throw new Error('Conexao perdida');
      return { status: 'confirmed', receipt: { operationId: op.id, revision: 1 } };
    }, clock);
    await network.run();
    assert.equal(attempts, 1, 'falha transitoria nao cria loop de reenvio');
    assert.equal((await outbox.list(owner)).find(e => e.operation.id === networkOperation.id)!.status, 'queued');
    await network.run();
    assert.equal(attempts, 2);

    const conflict = createOperation({ ...operation, entityId: novaIdentidade() });
    const dependent = createOperation({ ...conflict, kind: 'tournament.update', expectedRevision: 1 });
    const independent = createOperation({ ...operation, entityId: novaIdentidade() });
    await outbox.enqueue(conflict); await outbox.enqueue(dependent); await outbox.enqueue(independent);
    const processed: string[] = [];
    const conflicts = new SyncSender(owner, outbox, async op => {
      processed.push(op.id);
      return op.id === conflict.id
        ? { status: 'conflict', issue: { code: '40001', message: 'Revisao mudou' } }
        : { status: 'confirmed', receipt: { operationId: op.id, revision: 1 } };
    }, clock);
    await conflicts.run();
    assert.deepEqual(processed, [conflict.id, independent.id]);
    assert.equal((await outbox.list(owner)).find(e => e.operation.id === dependent.id)!.status, 'queued');
    resumed.stop(); network.stop(); conflicts.stop();
  } finally { await outbox.close(); await deleteDB(name); }
  console.log('Sender: cancelamento, resposta antiga, retomada, run concorrente, isolamento e retry finito passaram (transporte e IndexedDB simulados).');
}
main().catch(error => { console.error(error); process.exitCode = 1; });
