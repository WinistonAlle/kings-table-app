import type { SyncOperation } from './sync-operation';
import type { SyncOutbox, OperationIssue, OperationReceipt } from './sync-outbox';

export type SyncOutcome = { status: 'confirmed'; receipt: OperationReceipt }
  | { status: 'retry' | 'conflict' | 'rejected'; issue: OperationIssue };
export type OperationTransport = (operation: SyncOperation, signal: AbortSignal) => Promise<SyncOutcome>;

export class SyncSender {
  private stopped = false;
  private controller = new AbortController();
  private inFlight: Promise<void> | null = null;

  constructor(
    private ownerId: string,
    private outbox: SyncOutbox,
    private transport: OperationTransport,
    private now: () => number = Date.now,
  ) {}

  run(): Promise<void> {
    if (this.stopped) return Promise.resolve();
    if (!this.inFlight) this.inFlight = this.drain().finally(() => { this.inFlight = null; });
    return this.inFlight;
  }

  stop(): void {
    this.stopped = true;
    this.controller.abort();
  }

  private async drain(): Promise<void> {
    while (!this.stopped) {
      const entry = await this.outbox.claim(this.ownerId, this.now());
      if (!entry || this.stopped) return;
      const { id } = entry.operation;
      const token = entry.lease!.token;
      let outcome: SyncOutcome;
      try { outcome = await this.transport(entry.operation, this.controller.signal); }
      catch {
        if (this.stopped) return;
        await this.outbox.fail(this.ownerId, id, token, 'retry', {
          code: 'transport', message: 'Nao foi possivel confirmar o envio. O reenvio preservara a operacao.',
        });
        return;
      }
      // Abort nao garante que o servidor deixou de gravar. Manter o mesmo ID
      // para reconciliar depois, sem aplicar respostas da conta anterior.
      if (this.stopped) return;
      const applied = outcome.status === 'confirmed'
        ? await this.outbox.confirm(this.ownerId, id, token, outcome.receipt)
        : await this.outbox.fail(this.ownerId, id, token, outcome.status, outcome.issue);
      if (!applied || outcome.status === 'retry') return;
    }
  }
}
