import { openDB, type DBSchema, type IDBPDatabase, type IDBPTransaction } from 'idb';
import { z } from 'zod';
import { novaIdentidade } from './identidade';
import { createOperation, operationContent, operationSchema, parseOperation, type SyncOperation } from './sync-operation';
import { applyPresetOperation, preparePresetPayload, presetBaseSchema, projectPreset, type PresetBase } from './sync-preset-model';

const safeCount = z.number().int().nonnegative().safe();
const leaseSchema = z.strictObject({ token: z.uuid(), until: safeCount });
const receiptSchema = z.strictObject({ operationId: z.uuid(), revision: safeCount });
const issueSchema = z.strictObject({ code: z.string().min(1).max(100), message: z.string().min(1).max(1000) });
const entrySchema = z.strictObject({
  sequence: z.number().int().positive().safe(), operation: operationSchema,
  status: z.enum(['queued', 'sending', 'conflict', 'rejected', 'confirmed']),
  attempts: safeCount, lease: leaseSchema.optional(),
  receipt: receiptSchema.optional(), issue: issueSchema.optional(),
}).superRefine((entry, ctx) => {
  if ((entry.status === 'sending') !== !!entry.lease || (entry.status === 'confirmed') !== !!entry.receipt) {
    ctx.addIssue({ code: 'custom', message: 'Estado da fila inconsistente' });
  }
  if ((entry.status === 'conflict' || entry.status === 'rejected') && !entry.issue) {
    ctx.addIssue({ code: 'custom', message: 'Motivo da pendencia ausente' });
  }
  if (entry.receipt && (entry.receipt.operationId !== entry.operation.id || entry.receipt.revision !== entry.operation.expectedRevision + 1)) {
    ctx.addIssue({ code: 'custom', message: 'Recibo da fila inconsistente' });
  }
});

export type OutboxEntry = z.infer<typeof entrySchema>;
export type OperationReceipt = z.infer<typeof receiptSchema>;
export type OperationIssue = z.infer<typeof issueSchema>;
type Key = [string, string];
interface OutboxDatabase extends DBSchema {
  operations: { key: Key; value: OutboxEntry; indexes: { owner: string; ownerStatus: [string, OutboxEntry['status']]; entity: [string, SyncOperation['entity'], string] } };
  counter: { key: string; value: number };
  presetBases: { key: Key; value: PresetBase };
}
type WriteTransaction = IDBPTransaction<OutboxDatabase, ['operations', 'counter', 'presetBases'], 'readwrite'>;

function parseEntry(value: unknown): OutboxEntry {
  const entry = entrySchema.parse(value);
  parseOperation(entry.operation);
  return entry;
}

export class SyncOutbox {
  private connection: Promise<IDBPDatabase<OutboxDatabase>>;

  constructor(name = 'kt-sync-outbox') {
    this.connection = openDB<OutboxDatabase>(name, 2, {
      upgrade(db, oldVersion, _newVersion, tx) {
        if (oldVersion < 1) {
          const store = db.createObjectStore('operations', { keyPath: ['operation.ownerId', 'operation.id'] });
          store.createIndex('owner', 'operation.ownerId');
          store.createIndex('ownerStatus', ['operation.ownerId', 'status']);
          db.createObjectStore('counter');
        }
        if (oldVersion < 2) {
          db.createObjectStore('presetBases', { keyPath: ['ownerId', 'id'] });
          tx.objectStore('operations').createIndex('entity', ['operation.ownerId', 'operation.entity', 'operation.entityId']);
        }
      },
      blocking: () => { void this.close(); },
    });
  }

  private async write<T>(work: (transaction: WriteTransaction) => Promise<T>): Promise<T> {
    const db = await this.connection;
    const transaction = db.transaction(['operations', 'counter', 'presetBases'], 'readwrite', { durability: 'strict' });
    try {
      const result = await work(transaction);
      await transaction.done;
      return result;
    } catch (error) {
      try { transaction.abort(); } catch { /* A transacao pode ja estar abortada. */ }
      await transaction.done.catch(() => undefined);
      throw error;
    }
  }

  async enqueue(value: SyncOperation): Promise<OutboxEntry> {
    const operation = parseOperation(value);
    return this.write(transaction => this.add(transaction, operation));
  }

  private async add(transaction: WriteTransaction, operation: SyncOperation): Promise<OutboxEntry> {
    const store = transaction.objectStore('operations');
    const existing = await store.get([operation.ownerId, operation.id]);
    if (existing) {
      const entry = parseEntry(existing);
      if (operationContent(entry.operation) !== operationContent(operation)) {
        throw new Error('O ID da operacao ja existe com outro conteudo.');
      }
      return entry;
    }
    const counter = transaction.objectStore('counter');
    const sequence = (await counter.get('sequence') ?? 0) + 1;
    const entry = parseEntry({ sequence, operation, status: 'queued', attempts: 0 });
    await counter.put(sequence, 'sequence');
    await store.add(entry);
    return entry;
  }

  async presetView(ownerId: string, id: string) {
    z.uuid().parse(ownerId); z.uuid().parse(id);
    const db = await this.connection;
    const tx = db.transaction(['operations', 'presetBases'], 'readonly');
    try {
      const stored = await tx.objectStore('presetBases').get([ownerId, id]);
      const entries = (await tx.objectStore('operations').index('entity').getAll([ownerId, 'preset', id])).map(parseEntry);
      await tx.done;
      return projectPreset(stored ? presetBaseSchema.parse(stored) : null, entries);
    } catch (error) { await tx.done.catch(() => undefined); throw error; }
  }

  async presetViews(ownerId: string) {
    z.uuid().parse(ownerId);
    const db = await this.connection;
    const tx = db.transaction(['operations', 'presetBases'], 'readonly');
    try {
      const bases = (await tx.objectStore('presetBases').getAll(
        IDBKeyRange.bound([ownerId, ''], [ownerId, '\uffff']),
      )).map(value => presetBaseSchema.parse(value));
      const entries = (await tx.objectStore('operations').index('owner').getAll(ownerId))
        .map(parseEntry).filter(entry => entry.operation.entity === 'preset');
      await tx.done;
      const grouped = new Map<string, OutboxEntry[]>();
      for (const entry of entries) {
        const id = entry.operation.entityId;
        const group = grouped.get(id) ?? [];
        group.push(entry);
        grouped.set(id, group);
      }
      const confirmed = new Map(bases.map(base => [base.id, base]));
      const ids = new Set([...confirmed.keys(), ...grouped.keys()]);
      return [...ids].sort().map(id => ({
        id, ...projectPreset(confirmed.get(id) ?? null, grouped.get(id) ?? []),
      }));
    } catch (error) { await tx.done.catch(() => undefined); throw error; }
  }

  async mergePresetBase(value: PresetBase): Promise<boolean> {
    const incoming = presetBaseSchema.parse(value);
    return this.write(async tx => {
      const store = tx.objectStore('presetBases');
      const stored = await store.get([incoming.ownerId, incoming.id]);
      if (stored) {
        const current = presetBaseSchema.parse(stored);
        if (current.revision > incoming.revision) return false;
        if (current.revision === incoming.revision) {
          if (current.deleted && incoming.deleted && current.payload === null && incoming.payload !== null) {
            await store.put(incoming);
            return true;
          }
          if (JSON.stringify(current) !== JSON.stringify(incoming)) throw new Error('Mesma revisao com dados divergentes.');
          return false;
        }
        if (current.deleted && !incoming.deleted) throw new Error('Uma estrutura removida nao pode ressurgir.');
      }
      await store.put(incoming);
      return true;
    });
  }

  async mutatePreset(ownerId: string, id: string, mutation: { kind: 'preset.save'; payload: unknown } | { kind: 'preset.remove' }): Promise<OutboxEntry> {
    z.uuid().parse(ownerId); z.uuid().parse(id);
    const payload = mutation.kind === 'preset.save' ? preparePresetPayload(mutation.payload) : {};
    return this.write(async tx => {
      const stored = await tx.objectStore('presetBases').get([ownerId, id]);
      const entries = (await tx.objectStore('operations').index('entity').getAll([ownerId, 'preset', id])).map(parseEntry);
      const view = projectPreset(stored ? presetBaseSchema.parse(stored) : null, entries);
      if (view.reconciliationNeeded) throw new Error('Revise as alteracoes pendentes antes de continuar.');
      if (view.projected?.deleted || (mutation.kind === 'preset.remove' && !view.projected)) throw new Error('Estrutura removida ou inexistente.');
      const operation = createOperation({ ownerId, entityId: id, entity: 'preset', kind: mutation.kind,
        payload, expectedRevision: view.projected?.revision ?? 0 });
      return this.add(tx, operation);
    });
  }

  async list(ownerId: string): Promise<OutboxEntry[]> {
    z.uuid().parse(ownerId);
    const db = await this.connection;
    return (await db.getAllFromIndex('operations', 'owner', ownerId)).map(parseEntry).sort((a, b) => a.sequence - b.sequence);
  }

  async claim(ownerId: string, now = Date.now(), leaseMilliseconds = 30000): Promise<OutboxEntry | null> {
    z.uuid().parse(ownerId);
    safeCount.parse(now);
    z.number().int().min(1000).max(300000).parse(leaseMilliseconds);
    safeCount.parse(now + leaseMilliseconds);
    return this.write(async transaction => {
      const store = transaction.objectStore('operations');
      const entries: OutboxEntry[] = [];
      for (const status of ['queued', 'sending', 'conflict', 'rejected'] as const) {
        entries.push(...(await store.index('ownerStatus').getAll([ownerId, status])).map(parseEntry));
      }
      entries.sort((a, b) => a.sequence - b.sequence);
      const blocked = new Set<string>();
      for (const entry of entries) {
        const entity = `${entry.operation.entity}:${entry.operation.entityId}`;
        if (blocked.has(entity)) continue;
        blocked.add(entity);
        // Somente a primeira pendencia de cada entidade pode ser enviada.
        if (entry.status === 'conflict' || entry.status === 'rejected' || (entry.lease && entry.lease.until > now)) continue;
        const leased = parseEntry({ ...entry, status: 'sending', attempts: entry.attempts + 1,
          lease: { token: novaIdentidade(), until: now + leaseMilliseconds }, issue: undefined });
        await store.put(leased);
        return leased;
      }
      return null;
    });
  }

  async confirm(ownerId: string, operationId: string, leaseToken: string, value: OperationReceipt): Promise<boolean> {
    const receipt = receiptSchema.parse(value);
    if (receipt.operationId !== operationId) throw new Error('O recibo pertence a outra operacao.');
    return this.finish(ownerId, operationId, leaseToken, entry => {
      if (receipt.revision !== entry.operation.expectedRevision + 1) throw new Error('Revisao do recibo inconsistente.');
      return { ...entry, status: 'confirmed', lease: undefined, issue: undefined, receipt };
    }, true);
  }

  async fail(ownerId: string, operationId: string, leaseToken: string, mode: 'retry' | 'conflict' | 'rejected', value: OperationIssue): Promise<boolean> {
    z.enum(['retry', 'conflict', 'rejected']).parse(mode);
    const issue = issueSchema.parse(value);
    return this.finish(ownerId, operationId, leaseToken, entry => ({
      ...entry, status: mode === 'retry' ? 'queued' : mode, lease: undefined, issue,
    }));
  }

  private async finish(ownerId: string, operationId: string, leaseToken: string, update: (entry: OutboxEntry) => OutboxEntry, confirmed = false): Promise<boolean> {
    z.uuid().parse(ownerId); z.uuid().parse(operationId); z.uuid().parse(leaseToken);
    return this.write(async transaction => {
      const store = transaction.objectStore('operations');
      const value = await store.get([ownerId, operationId]);
      if (!value) return false;
      const entry = parseEntry(value);
      if (entry.status !== 'sending' || entry.lease?.token !== leaseToken) return false;
      if (confirmed && entry.operation.entity === 'preset') {
        const bases = transaction.objectStore('presetBases');
        const stored = await bases.get([ownerId, entry.operation.entityId]);
        const base = stored ? presetBaseSchema.parse(stored) : null;
        const next = applyPresetOperation(base, entry.operation);
        if (!base || base.revision < next.revision) {
          if (base?.deleted && !next.deleted) throw new Error('Estrutura removida nao pode ressurgir.');
          await bases.put(next);
        } else if (base.revision === next.revision && JSON.stringify(base) !== JSON.stringify(next)) {
          throw new Error('Recibo diverge da versao confirmada.');
        }
      }
      await store.put(parseEntry(update(entry)));
      return true;
    });
  }

  async close(): Promise<void> { (await this.connection).close(); }
}
