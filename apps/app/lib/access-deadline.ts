export class AccessTimeoutError extends Error {
  constructor() { super('Access verification timed out'); this.name = 'AccessTimeoutError'; }
}

// Bounds the UI wait without pretending that an SDK request was cancelled.
export function waitForAccess<T>(read: () => Promise<T>, signal: AbortSignal, timeoutMs = 12000): Promise<T> {
  signal.throwIfAborted();
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) throw new Error('Invalid access deadline');
  return new Promise<T>((resolve, reject) => {
    let done = false;
    const finish = (deliver: () => void) => {
      if (done) return;
      done = true; clearTimeout(timer); signal.removeEventListener('abort', abort); deliver();
    };
    const abort = () => finish(() => reject(signal.reason));
    const timer = setTimeout(() => finish(() => reject(new AccessTimeoutError())), timeoutMs);
    signal.addEventListener('abort', abort, { once: true });
    Promise.resolve().then(() => { signal.throwIfAborted(); return read(); })
      .then(value => finish(() => resolve(value)), error => finish(() => reject(error)));
  });
}
