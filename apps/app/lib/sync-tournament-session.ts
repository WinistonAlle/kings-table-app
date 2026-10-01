import { z } from 'zod';
import { SyncSender, type OperationTransport } from './sync-sender';
import type { SyncOutbox, OutboxEntry, TournamentResolutionRequest } from './sync-outbox';
import { parseOperation, type SyncOperation } from './sync-operation';
import type { TournamentSummary } from './sync-tournament-catalog';
import type { TournamentCatalogView } from './sync-tournament-model';
import { parseTournamentSnapshot, type TournamentSnapshot } from './sync-tournament-reader';

export type TournamentDetailReader = (tableId: string, signal: AbortSignal) => Promise<TournamentSnapshot | null>;

export class TournamentDetailError extends Error {
  constructor(public readonly code: 'remote_read' | 'invalid_response' | 'local_storage') {
    super(code === 'remote_read' ? 'Nao foi possivel atualizar os detalhes da mesa. Tente novamente.'
      : code === 'invalid_response' ? 'Os detalhes recebidos sao inconsistentes. Tente atualizar a mesa.'
      : 'Nao foi possivel acessar os detalhes salvos neste aparelho. Tente novamente.');
  }
}

export type TournamentSessionState = {
  phase: 'idle' | 'syncing' | 'ready' | 'error' | 'stopped';
  tables: TournamentSummary[];
  pending: OutboxEntry[];
  views: TournamentCatalogView[];
  error: 'local_storage' | 'remote_read' | null;
};

// This coordinates the online catalog and commands; it never replaces the local tournament store.
export class TournamentSyncSession {
  private controller = new AbortController();
  private sender: SyncSender;
  private inFlight: Promise<void> | null = null;
  private repeat = false;
  private detailReads = new Map<string, Promise<TournamentSnapshot | null>>();
  private resolutions = new Set<Promise<void>>();
  private state: TournamentSessionState = { phase: 'idle', tables: [], pending: [], views: [], error: null };

  constructor(private ownerId: string, private outbox: SyncOutbox,
    private read: (signal: AbortSignal) => Promise<TournamentSummary[]>, transport: OperationTransport,
    private onUpdate: (state: TournamentSessionState) => void = () => undefined,
    now: () => number = Date.now,
    private readDetail?: TournamentDetailReader) {
    z.uuid().parse(ownerId);
    this.sender = new SyncSender(ownerId, outbox, transport, now, 'tournament');
  }

  snapshot(): TournamentSessionState { return structuredClone(this.state); }
  waitForIdle(): Promise<void> {
    if (!this.detailReads.size && !this.resolutions.size) return this.inFlight ?? Promise.resolve();
    return Promise.allSettled([this.inFlight, ...this.detailReads.values(), ...this.resolutions]).then(() => undefined);
  }

  async cachedTournament(tableId: string): Promise<TournamentSnapshot | null> {
    z.uuid().parse(tableId);
    this.controller.signal.throwIfAborted();
    try {
      const cached = await this.outbox.tournamentSnapshot(this.ownerId, tableId);
      this.controller.signal.throwIfAborted();
      return cached;
    } catch {
      this.controller.signal.throwIfAborted();
      throw new TournamentDetailError('local_storage');
    }
  }

  refreshTournament(tableId: string): Promise<TournamentSnapshot | null> {
    z.uuid().parse(tableId);
    this.controller.signal.throwIfAborted();
    if (!this.readDetail) throw new Error('A leitura dos detalhes da mesa nao esta configurada.');
    const existing = this.detailReads.get(tableId);
    if (existing) return existing;
    const task = this.readTournament(tableId).finally(() => { this.detailReads.delete(tableId); });
    this.detailReads.set(tableId, task);
    return task;
  }

  private async readTournament(tableId: string): Promise<TournamentSnapshot | null> {
    const signal = this.controller.signal;
    let stage: TournamentDetailError['code'] = 'remote_read';
    try {
      const value = await this.readDetail!(tableId, signal);
      signal.throwIfAborted();
      if (value === null) return null;
      stage = 'invalid_response';
      const snapshot = parseTournamentSnapshot(value);
      if (snapshot.tournament.id !== tableId || snapshot.tournament.created_by !== this.ownerId) {
        throw new Error('Wrong tournament scope');
      }
      stage = 'local_storage';
      await this.outbox.mergeTournamentSnapshots(this.ownerId, [snapshot], signal);
      signal.throwIfAborted();
      await this.refreshLocal();
      return await this.cachedTournament(tableId);
    } catch {
      signal.throwIfAborted();
      throw new TournamentDetailError(stage);
    }
  }

  stop(): void {
    if (this.controller.signal.aborted) return;
    this.controller.abort(); this.sender.stop();
    this.state = { phase: 'stopped', tables: [], pending: [], views: [], error: null };
    this.onUpdate(this.snapshot());
  }

  async refreshLocal(): Promise<void> {
    this.controller.signal.throwIfAborted();
    try {
      const view = await this.outbox.tournamentView(this.ownerId);
      this.controller.signal.throwIfAborted();
      this.publish({ ...this.state, ...view });
    } catch (error) {
      if (!this.controller.signal.aborted) this.publish({ ...this.state, phase: 'error', error: 'local_storage' });
      throw error;
    }
  }

  async enqueue(value: SyncOperation): Promise<void> {
    this.controller.signal.throwIfAborted();
    const operation = parseOperation(value);
    if (operation.ownerId !== this.ownerId || operation.entity !== 'tournament') {
      throw new Error('Comando de outra conta ou entidade.');
    }
    await this.outbox.enqueueTournament(operation);
    this.controller.signal.throwIfAborted();
    if (this.inFlight) this.repeat = true;
    await this.refreshLocal();
  }

  resolve(tableId: string, request: TournamentResolutionRequest): Promise<void> {
    this.controller.signal.throwIfAborted();
    if (this.inFlight || this.state.phase !== 'ready' || this.state.error) {
      return Promise.reject(new Error('Atualize as mesas antes de resolver a pendencia.'));
    }
    const task = this.outbox.resolveTournament(this.ownerId, tableId, request, this.controller.signal)
      .then(async () => {
        this.controller.signal.throwIfAborted();
        await this.refreshLocal();
      }).finally(() => { this.resolutions.delete(task); });
    this.resolutions.add(task);
    return task;
  }

  synchronize(repeatIfBusy = false): Promise<void> {
    if (this.controller.signal.aborted) return Promise.resolve();
    if (this.inFlight && repeatIfBusy) this.repeat = true;
    if (!this.inFlight) this.inFlight = this.drain().finally(() => { this.inFlight = null; });
    return this.inFlight;
  }

  private async drain(): Promise<void> {
    do {
      this.repeat = false;
      await this.synchronizeOnce();
    } while (this.repeat && !this.controller.signal.aborted);
  }

  private async synchronizeOnce(): Promise<void> {
    const signal = this.controller.signal;
    this.publish({ ...this.state, phase: 'syncing', error: null });
    let stage: TournamentSessionState['error'] = 'local_storage';
    try {
      await this.refreshLocal();
      await this.sender.run();
      signal.throwIfAborted();
      stage = 'remote_read';
      const tables = await this.read(signal);
      signal.throwIfAborted();
      stage = 'local_storage';
      await this.outbox.mergeTournamentSummaries(this.ownerId, tables, signal);
      await this.refreshLocal();
      this.publish({ ...this.state, phase: 'ready', error: null });
    } catch {
      if (signal.aborted) return;
      try { await this.refreshLocal(); } catch { stage = 'local_storage'; }
      this.publish({ ...this.state, phase: 'error', error: stage });
    }
  }

  private publish(state: TournamentSessionState): void {
    if (this.controller.signal.aborted) return;
    this.state = state;
    this.onUpdate(this.snapshot());
  }
}
