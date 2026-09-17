import { z } from 'zod';
import { SyncSender, type OperationTransport } from './sync-sender';
import type { SyncOutbox } from './sync-outbox';
import type { PresetBase } from './sync-preset-model';

export type PresetLibrary = Awaited<ReturnType<SyncOutbox['presetViews']>>;
export type PresetSessionState = {
  phase: 'idle' | 'syncing' | 'ready' | 'error' | 'stopped';
  library: PresetLibrary;
  error: 'local_storage' | 'remote_read' | null;
};

// One instance belongs to one verified account. Caller owns/ closes the outbox.
export class PresetSyncSession {
  private controller = new AbortController();
  private sender: SyncSender;
  private inFlight: Promise<void> | null = null;
  private state: PresetSessionState = { phase: 'idle', library: [], error: null };

  constructor(private ownerId: string, private outbox: SyncOutbox,
    private read: (signal: AbortSignal) => Promise<PresetBase[]>, transport: OperationTransport,
    private onUpdate: (state: PresetSessionState) => void = () => undefined,
    now: () => number = Date.now) {
    z.uuid().parse(ownerId);
    this.sender = new SyncSender(ownerId, outbox, transport, now, 'preset');
  }

  snapshot(): PresetSessionState { return structuredClone(this.state); }

  stop(): void {
    if (this.controller.signal.aborted) return;
    this.controller.abort(); this.sender.stop();
    this.state = { phase: 'stopped', library: [], error: null };
    this.onUpdate(this.snapshot());
  }

  async refreshLocal(): Promise<void> {
    this.controller.signal.throwIfAborted();
    try {
      const library = await this.outbox.presetViews(this.ownerId);
      this.controller.signal.throwIfAborted();
      this.publish({ ...this.state, library });
    } catch (error) {
      if (!this.controller.signal.aborted) this.publish({ ...this.state, phase: 'error', error: 'local_storage' });
      throw error;
    }
  }

  async mutate(id: string, mutation: Parameters<SyncOutbox['mutatePreset']>[2]): Promise<void> {
    this.controller.signal.throwIfAborted();
    await this.outbox.mutatePreset(this.ownerId, id, mutation);
    // A command committed before stop remains durable for that account, not sent here.
    this.controller.signal.throwIfAborted();
    await this.refreshLocal();
  }

  synchronize(): Promise<void> {
    if (this.controller.signal.aborted) return Promise.resolve();
    if (!this.inFlight) this.inFlight = this.synchronizeOnce().finally(() => { this.inFlight = null; });
    return this.inFlight;
  }

  private async synchronizeOnce(): Promise<void> {
    const signal = this.controller.signal;
    this.publish({ ...this.state, phase: 'syncing', error: null });
    let stage: PresetSessionState['error'] = 'local_storage';
    try {
      await this.refreshLocal();
      await this.sender.run();
      signal.throwIfAborted();
      stage = 'remote_read';
      const bases = await this.read(signal);
      signal.throwIfAborted();
      stage = 'local_storage';
      await this.outbox.mergePresetBases(this.ownerId, bases, signal);
      await this.refreshLocal();
      this.publish({ ...this.state, phase: 'ready', error: null });
    } catch {
      if (signal.aborted) return;
      // A failed pull/send never clears commands or the previously recovered cache.
      try { await this.refreshLocal(); } catch { stage = 'local_storage'; }
      this.publish({ ...this.state, phase: 'error', error: stage });
    }
  }

  private publish(state: PresetSessionState): void {
    if (this.controller.signal.aborted) return;
    this.state = state;
    this.onUpdate(this.snapshot());
  }
}
