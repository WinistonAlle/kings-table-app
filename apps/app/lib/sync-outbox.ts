import { openDB, type DBSchema, type IDBPDatabase, type IDBPTransaction } from 'idb';
import { z } from 'zod';
import { novaIdentidade } from './identidade';
import { createOperation, operationContent, operationSchema, parseOperation, type SyncOperation } from './sync-operation';
import { applyPresetOperation, preparePresetPayload, presetBaseSchema, projectPreset, type PresetBase } from './sync-preset-model';
import { tournamentSummarySchema, type TournamentSummary } from './sync-tournament-catalog';
import { parseTournamentSnapshot, type TournamentSnapshot } from './sync-tournament-reader';
import { projectTournamentCatalog, type TournamentCatalogView } from './sync-tournament-model';

const safeCount = z.number().int().nonnegative().safe();
const leaseSchema = z.strictObject({ token: z.uuid(), until: safeCount });
const receiptSchema = z.strictObject({ operationId: z.uuid(), revision: safeCount });
const issueSchema = z.strictObject({ code: z.string().min(1).max(100), message: z.string().min(1).max(1000) });
const resolutionSchema = z.strictObject({
  id: z.uuid(), kind: z.enum(['keep_remote', 'save_copy']), createdAt: z.iso.datetime(),
  copiedTo: z.uuid().optional(), copyOperationId: z.uuid().optional(),
}).refine(value => value.kind === 'save_copy'
  ? !!value.copiedTo && !!value.copyOperationId : !value.copiedTo && !value.copyOperationId,
  'Referencia da copia inconsistente');
const resolutionRequestSchema = z.strictObject({
  expectedBase: presetBaseSchema.nullable(), pendingOperationIds: z.array(z.uuid()).min(1),
  decision: z.discriminatedUnion('kind', [
    z.strictObject({ kind: z.literal('keep_remote') }),
    z.strictObject({ kind: z.literal('save_copy'), name: z.string() }),
  ]),
});
export type PresetResolutionRequest = z.infer<typeof resolutionRequestSchema>;
const tournamentResolutionRequestSchema = z.strictObject({
  expectedBase: tournamentSummarySchema.nullable(),
  pendingOperationIds: z.array(z.uuid()).min(1),
  decision: z.strictObject({ kind: z.literal('keep_remote') }),
});
export type TournamentResolutionRequest = z.infer<typeof tournamentResolutionRequestSchema>;
const entrySchema = z.strictObject({
  sequence: z.number().int().positive().safe(), operation: operationSchema,
  status: z.enum(['queued', 'sending', 'conflict', 'rejected', 'confirmed', 'cancelled']),
  attempts: safeCount, lease: leaseSchema.optional(),
  receipt: receiptSchema.optional(), issue: issueSchema.optional(),
  resolution: resolutionSchema.optional(),
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
  if ((entry.status === 'cancelled') !== !!entry.resolution
    || (entry.resolution && entry.operation.entity === 'tournament' && entry.resolution.kind !== 'keep_remote')) {
    ctx.addIssue({ code: 'custom', message: 'Decisao da fila inconsistente' });
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
  tournamentSummaries: { key: Key; value: TournamentSummary };
  tournamentSnapshots: { key: Key; value: TournamentSnapshot };
}
type WriteTransaction = IDBPTransaction<OutboxDatabase, ['operations', 'counter', 'presetBases', 'tournamentSummaries'], 'readwrite'>;

function parseEntry(value: unknown): OutboxEntry {
  const entry = entrySchema.parse(value);
  parseOperation(entry.operation);
  return entry;
}

function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (value !== null && typeof value === 'object') {
    const object = value as Record<string, unknown>;
    return `{${Object.keys(object).sort().map(key => `${JSON.stringify(key)}:${canonicalJson(object[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

function summaryMatchesSnapshot(summary: TournamentSummary, snapshot: TournamentSnapshot): boolean {
  const table = snapshot.tournament;
  return summary.id === table.id && summary.ownerId === table.created_by
    && summary.revision === table.revision && summary.name === table.name
    && summary.format === table.format && summary.status === table.status
    && summary.buyIn === table.buy_in && summary.startTime === table.start_time
    && summary.updatedAt === table.updated_at && summary.deletedAt === table.deleted_at;
}

function summaryFromSnapshot(snapshot: TournamentSnapshot): TournamentSummary {
  const table = snapshot.tournament;
  return tournamentSummarySchema.parse({
    id: table.id, ownerId: table.created_by, revision: table.revision,
    name: table.name, format: table.format, status: table.status,
    buyIn: table.buy_in, startTime: table.start_time,
    updatedAt: table.updated_at, deletedAt: table.deleted_at,
  });
}

export class SyncOutbox {
  private connection: Promise<IDBPDatabase<OutboxDatabase>>;

  constructor(name = 'kt-sync-outbox') {
    // Upgrades add account-scoped table caches without touching pending commands.
    let rejectBlocked!: (reason: Error) => void;
    let blockedTimer: ReturnType<typeof setTimeout> | undefined;
    let timedOut = false;
    const blocked = new Promise<never>((_, reject) => { rejectBlocked = reject; });
    const opening = openDB<OutboxDatabase>(name, 5, {
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
        if (oldVersion < 4) db.createObjectStore('tournamentSummaries', { keyPath: ['ownerId', 'id'] });
        if (oldVersion < 5) db.createObjectStore('tournamentSnapshots',
          { keyPath: ['tournament.created_by', 'tournament.id'] });
      },
      blocked: () => {
        blockedTimer ??= setTimeout(() => {
          timedOut = true;
          rejectBlocked(new Error('Outra aba impediu a atualização da biblioteca local.'));
        }, 5000);
      },
      blocking: () => { void this.close().catch(() => undefined); },
    });
    void opening.then(db => { if (timedOut) db.close(); }, () => undefined);
    this.connection = Promise.race([opening, blocked]).finally(() => {
      if (blockedTimer) clearTimeout(blockedTimer);
    });
  }

  private async write<T>(work: (transaction: WriteTransaction) => Promise<T>): Promise<T> {
    const db = await this.connection;
    const transaction = db.transaction(['operations', 'counter', 'presetBases', 'tournamentSummaries'], 'readwrite', { durability: 'strict' });
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

  async enqueueTournament(value: SyncOperation): Promise<OutboxEntry> {
    const operation = parseOperation(value);
    if (operation.entity !== 'tournament') throw new Error('Comando nao pertence a uma mesa.');
    return this.write(async tx => {
      const store = tx.objectStore('operations');
      if (await store.get([operation.ownerId, operation.id])) return this.add(tx, operation);
      const stored = await tx.objectStore('tournamentSummaries').get([operation.ownerId, operation.entityId]);
      const base = stored ? tournamentSummarySchema.parse(stored) : null;
      const entries = (await store.index('entity').getAll([operation.ownerId, 'tournament', operation.entityId]))
        .map(parseEntry).sort((a, b) => a.sequence - b.sequence);
      if (operation.kind === 'tournament.create') {
        if (base || entries.length || operation.expectedRevision !== 0) {
          throw new Error('A mesa ja possui historico local. Atualize antes de criar.');
        }
        return this.add(tx, operation);
      }
      const view = base || entries.length ? projectTournamentCatalog(base, entries) : null;
      if (view?.reconciliationNeeded) throw new Error('Revise as alteracoes pendentes antes de continuar.');
      if (!view?.projectedRevision || view.projectedDeleted
        || operation.expectedRevision !== view.projectedRevision) {
        throw new Error('Atualize a mesa e revise a versao antes de continuar.');
      }
      return this.add(tx, operation);
    });
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
    return this.write(tx => this.mergeBase(tx, incoming));
  }

  async mergePresetBases(ownerId: string, values: PresetBase[], signal: AbortSignal): Promise<void> {
    z.uuid().parse(ownerId);
    signal.throwIfAborted();
    const incoming = values.map(value => presetBaseSchema.parse(value));
    if (incoming.some(base => base.ownerId !== ownerId)
      || new Set(incoming.map(base => base.id)).size !== incoming.length) {
      throw new Error('Biblioteca possui conta ou alvo inconsistente.');
    }
    await this.write(async tx => {
      for (const base of incoming) {
        signal.throwIfAborted();
        await this.mergeBase(tx, base);
      }
      signal.throwIfAborted();
    });
  }

  async tournamentSummaries(ownerId: string): Promise<TournamentSummary[]> {
    z.uuid().parse(ownerId);
    const db = await this.connection;
    const tx = db.transaction('tournamentSummaries', 'readonly');
    try {
      const rows = await tx.store.getAll(IDBKeyRange.bound([ownerId, ''], [ownerId, '\uffff']));
      await tx.done;
      return rows.map(row => tournamentSummarySchema.parse(row));
    } catch (error) { await tx.done.catch(() => undefined); throw error; }
  }

  async tournamentSnapshot(ownerId: string, tableId: string): Promise<TournamentSnapshot | null> {
    z.uuid().parse(ownerId); z.uuid().parse(tableId);
    const db = await this.connection;
    const tx = db.transaction(['tournamentSnapshots', 'tournamentSummaries'], 'readonly');
    try {
      const stored = await tx.objectStore('tournamentSnapshots').get([ownerId, tableId]);
      const summary = await tx.objectStore('tournamentSummaries').get([ownerId, tableId]);
      await tx.done;
      if (!stored) return null;
      const snapshot = parseTournamentSnapshot(stored);
      const current = summary ? tournamentSummarySchema.parse(summary) : null;
      if (snapshot.tournament.deleted_at !== null || current?.deletedAt !== null
        || (current && current.revision > snapshot.tournament.revision)) return null;
      if (current && current.revision === snapshot.tournament.revision
        && !summaryMatchesSnapshot(current, snapshot)) throw new Error('Catalogo e detalhes divergem.');
      return snapshot;
    } catch (error) { await tx.done.catch(() => undefined); throw error; }
  }

  async mergeTournamentSnapshots(ownerId: string, values: TournamentSnapshot[], signal: AbortSignal): Promise<void> {
    z.uuid().parse(ownerId);
    signal.throwIfAborted();
    const incoming = values.map(parseTournamentSnapshot);
    if (incoming.some(snapshot => snapshot.tournament.created_by !== ownerId)
      || new Set(incoming.map(snapshot => snapshot.tournament.id)).size !== incoming.length) {
      throw new Error('Detalhes possuem conta ou mesa inconsistente.');
    }
    const db = await this.connection;
    const tx = db.transaction(['tournamentSnapshots', 'tournamentSummaries'], 'readwrite', { durability: 'strict' });
    try {
      for (const snapshot of incoming) {
        signal.throwIfAborted();
        const table = snapshot.tournament;
        const key: Key = [ownerId, table.id];
        const summary = await tx.objectStore('tournamentSummaries').get(key);
        if (summary) {
          const current = tournamentSummarySchema.parse(summary);
          if (current.deletedAt !== null && table.deleted_at === null) {
            throw new Error('Mesa removida nao pode ressurgir.');
          }
          if (current.revision > table.revision) continue;
          if (current.revision === table.revision && !summaryMatchesSnapshot(current, snapshot)) {
            throw new Error('Catalogo e detalhes divergem na mesma revisao.');
          }
        }
        const previous = await tx.objectStore('tournamentSnapshots').get(key);
        if (previous) {
          const stored = parseTournamentSnapshot(previous);
          if (stored.tournament.revision > table.revision) continue;
          if (stored.tournament.deleted_at !== null && table.deleted_at === null) {
            throw new Error('Mesa removida nao pode ressurgir.');
          }
          if (stored.tournament.revision === table.revision) {
            if (canonicalJson(stored) !== canonicalJson(snapshot)) {
              throw new Error('Mesma revisao com detalhes divergentes.');
            }
            if (!summary) await tx.objectStore('tournamentSummaries').put(summaryFromSnapshot(snapshot));
            continue;
          }
        }
        await tx.objectStore('tournamentSnapshots').put(snapshot);
        await tx.objectStore('tournamentSummaries').put(summaryFromSnapshot(snapshot));
      }
      signal.throwIfAborted();
      await tx.done;
    } catch (error) {
      try { tx.abort(); } catch { /* A transacao pode ja estar abortada. */ }
      await tx.done.catch(() => undefined);
      throw error;
    }
  }

  async tournamentView(ownerId: string): Promise<{ tables: TournamentSummary[]; pending: OutboxEntry[];
    views: TournamentCatalogView[] }> {
    z.uuid().parse(ownerId);
    const db = await this.connection;
    const tx = db.transaction(['tournamentSummaries', 'operations'], 'readonly');
    try {
      const tables = await tx.objectStore('tournamentSummaries')
        .getAll(IDBKeyRange.bound([ownerId, ''], [ownerId, '\uffff']));
      const operations = await tx.objectStore('operations').index('owner').getAll(ownerId);
      await tx.done;
      const confirmed = tables.map(row => tournamentSummarySchema.parse(row));
      const entries = operations.map(parseEntry).filter(entry => entry.operation.entity === 'tournament');
      const byId = new Map<string, OutboxEntry[]>();
      for (const entry of entries) {
        const id = entry.operation.entityId;
        const group = byId.get(id);
        if (group) group.push(entry);
        else byId.set(id, [entry]);
      }
      const bySummary = new Map(confirmed.map(row => [row.id, row]));
      const ids = new Set([...bySummary.keys(), ...byId.keys()]);
      const views = [...ids].sort().map(id => projectTournamentCatalog(bySummary.get(id) ?? null, byId.get(id) ?? []));
      return { tables: confirmed, pending: views.flatMap(view => view.pending).sort((a, b) => a.sequence - b.sequence), views };
    } catch (error) { await tx.done.catch(() => undefined); throw error; }
  }

  async mergeTournamentSummaries(ownerId: string, values: TournamentSummary[], signal: AbortSignal): Promise<void> {
    z.uuid().parse(ownerId);
    signal.throwIfAborted();
    const incoming = values.map(value => tournamentSummarySchema.parse(value));
    if (incoming.some(row => row.ownerId !== ownerId)
      || new Set(incoming.map(row => row.id)).size !== incoming.length) {
      throw new Error('Catalogo possui conta ou mesa inconsistente.');
    }
    const db = await this.connection;
    const tx = db.transaction(['tournamentSummaries', 'tournamentSnapshots'], 'readwrite', { durability: 'strict' });
    try {
      for (const row of incoming) {
        signal.throwIfAborted();
        const stored = await tx.objectStore('tournamentSummaries').get([ownerId, row.id]);
        if (stored) {
          const current = tournamentSummarySchema.parse(stored);
          if (current.revision > row.revision) continue;
          if (current.revision === row.revision) {
            if (JSON.stringify(current) !== JSON.stringify(row)) throw new Error('Mesma revisao com mesas divergentes.');
            continue;
          }
          if (current.deletedAt !== null && row.deletedAt === null) {
            throw new Error('Mesa removida nao pode ressurgir.');
          }
        }
        const detail = await tx.objectStore('tournamentSnapshots').get([ownerId, row.id]);
        if (detail) {
          const snapshot = parseTournamentSnapshot(detail);
          if (snapshot.tournament.deleted_at !== null && row.deletedAt === null) {
            throw new Error('Mesa removida nao pode ressurgir.');
          }
          if (snapshot.tournament.revision === row.revision && !summaryMatchesSnapshot(row, snapshot)) {
            throw new Error('Catalogo e detalhes divergem na mesma revisao.');
          }
        }
        await tx.objectStore('tournamentSummaries').put(row);
      }
      signal.throwIfAborted();
      await tx.done;
    } catch (error) {
      try { tx.abort(); } catch { /* A transacao pode ja estar abortada. */ }
      await tx.done.catch(() => undefined);
      throw error;
    }
  }

  private async mergeBase(tx: WriteTransaction, incoming: PresetBase): Promise<boolean> {
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

  async resolvePreset(ownerId: string, id: string, value: PresetResolutionRequest,
    signal = new AbortController().signal): Promise<OutboxEntry | null> {
    z.uuid().parse(ownerId); z.uuid().parse(id);
    signal.throwIfAborted();
    const request = resolutionRequestSchema.parse(value);
    return this.write(async tx => {
      signal.throwIfAborted();
      const stored = await tx.objectStore('presetBases').get([ownerId, id]);
      const base = stored ? presetBaseSchema.parse(stored) : null;
      const store = tx.objectStore('operations');
      const entries = (await store.index('entity').getAll([ownerId, 'preset', id])).map(parseEntry);
      const { pending } = projectPreset(base, entries);
      if (JSON.stringify(base) !== JSON.stringify(request.expectedBase)
        || JSON.stringify(pending.map(entry => entry.operation.id)) !== JSON.stringify(request.pendingOperationIds)) {
        throw new Error('A estrutura mudou. Atualize e revise novamente.');
      }
      // A timeout or expired lease is not proof that the server rejected a command.
      if (!pending.length || !['conflict', 'rejected'].includes(pending[0].status)
        || pending.some(entry => !['queued', 'conflict', 'rejected'].includes(entry.status))) {
        throw new Error('Aguarde uma resposta definitiva antes de resolver a pendencia.');
      }
      let copy: OutboxEntry | null = null;
      if (request.decision.kind === 'save_copy') {
        const attempted = [...pending].reverse().find(entry => entry.operation.kind === 'preset.save');
        const source = attempted ? attempted.operation.payload : base?.payload;
        if (!source) throw new Error('Nao ha dados de estrutura para copiar.');
        const payload = preparePresetPayload({ ...source, name: request.decision.name });
        const copyId = novaIdentidade();
        if (await tx.objectStore('presetBases').get([ownerId, copyId])
          || (await store.index('entity').getAllKeys([ownerId, 'preset', copyId])).length) {
          throw new Error('Nao foi possivel gerar uma identidade nova para a copia.');
        }
        copy = await this.add(tx, createOperation({ ownerId, entityId: copyId, entity: 'preset',
          kind: 'preset.save', expectedRevision: 0, payload }));
      }
      const resolution = resolutionSchema.parse({ id: novaIdentidade(), kind: request.decision.kind,
        createdAt: new Date().toISOString(),
        ...(copy ? { copiedTo: copy.operation.entityId, copyOperationId: copy.operation.id } : {}),
      });
      for (const entry of pending) {
        signal.throwIfAborted();
        await store.put(parseEntry({ ...entry, status: 'cancelled', resolution }));
      }
      signal.throwIfAborted();
      return copy;
    });
  }

  async resolveTournament(ownerId: string, id: string, value: TournamentResolutionRequest,
    signal = new AbortController().signal): Promise<void> {
    z.uuid().parse(ownerId); z.uuid().parse(id);
    signal.throwIfAborted();
    const request = tournamentResolutionRequestSchema.parse(value);
    if (request.expectedBase && (request.expectedBase.ownerId !== ownerId || request.expectedBase.id !== id)) {
      throw new Error('A mesa mudou. Atualize e revise novamente.');
    }
    await this.write(async tx => {
      signal.throwIfAborted();
      const stored = await tx.objectStore('tournamentSummaries').get([ownerId, id]);
      const base = stored ? tournamentSummarySchema.parse(stored) : null;
      const store = tx.objectStore('operations');
      const entries = (await store.index('entity').getAll([ownerId, 'tournament', id])).map(parseEntry);
      const view = projectTournamentCatalog(base, entries);
      if (canonicalJson(base) !== canonicalJson(request.expectedBase)
        || canonicalJson(view.pending.map(entry => entry.operation.id)) !== canonicalJson(request.pendingOperationIds)) {
        throw new Error('A mesa mudou. Atualize e revise novamente.');
      }
      // Only a definitive rejection permits archiving dependent commands; uncertain sends must retry.
      if (!view.pending.length || !['conflict', 'rejected'].includes(view.pending[0].status)
        || view.pending.some(entry => !['queued', 'conflict', 'rejected'].includes(entry.status))) {
        throw new Error('Aguarde uma resposta definitiva antes de resolver a pendencia.');
      }
      const resolution = resolutionSchema.parse({ id: novaIdentidade(), kind: 'keep_remote',
        createdAt: new Date().toISOString() });
      for (const entry of view.pending) {
        signal.throwIfAborted();
        await store.put(parseEntry({ ...entry, status: 'cancelled', resolution }));
      }
      signal.throwIfAborted();
    });
  }

  async claim(ownerId: string, now = Date.now(), leaseMilliseconds = 30000, scope?: SyncOperation['entity']): Promise<OutboxEntry | null> {
    z.uuid().parse(ownerId);
    if (scope !== undefined) z.enum(['tournament', 'preset']).parse(scope);
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
        if (scope !== undefined && entry.operation.entity !== scope) continue;
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
