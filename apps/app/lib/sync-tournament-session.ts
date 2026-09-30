import { z } from 'zod';
import { SyncSender, type OperationTransport } from './sync-sender';
import type { SyncOutbox, OutboxEntry } from './sync-outbox';
import { parseOperation, type SyncOperation } from './sync-operation';
import type { TournamentSummary } from './sync-tournament-catalog';
import type { TournamentCatalogView } from './sync-tournament-model';

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
  private state: TournamentSessionState = { phase: 'idle', tables: [], pending: [], views: [], error: null };

  constructor(private ownerId: string, private outbox: SyncOutbox,
    private read: (signal: AbortSignal) => Promise<TournamentSummary[]>, transport: OperationTransport,
    private onUpdate: (state: TournamentSessionState) => void = () => undefined,
    now: () => number = Date.now) {
    z.uuid().parse(ownerId);
    this.sender = new SyncSender(ownerId, outbox, transport, now, 'tournament');
  }

  snapshot(): TournamentSessionState { return structuredClone(this.state); }
  waitForIdle(): Promise<void> { return this.inFlight ?? Promise.resolve(); }

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
