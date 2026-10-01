import assert from 'node:assert/strict';
import { AccessTimeoutError, waitForAccess } from '../lib/access-deadline';

async function main() {
  const controller = new AbortController();
  assert.equal(await waitForAccess(async () => 'verified', controller.signal, 100), 'verified');
  await assert.rejects(waitForAccess(async () => { throw Error('read failed'); }, controller.signal, 100), /read failed/);
  let release!: (value: string) => void;
  const late = waitForAccess(() => new Promise<string>(resolve => { release = resolve; }), controller.signal, 20);
  await assert.rejects(late, AccessTimeoutError);
  release('late');
  await new Promise(resolve => setTimeout(resolve, 5));
  const cancelled = new AbortController();
  const waiting = waitForAccess(() => new Promise<string>(() => undefined), cancelled.signal, 100);
  const rejected = assert.rejects(waiting, { name: 'AbortError' });
  cancelled.abort(); await rejected;
  let started = false;
  assert.throws(() => waitForAccess(async () => { started = true; }, cancelled.signal), { name: 'AbortError' });
  assert.equal(started, false);
  assert.throws(() => waitForAccess(async () => true, controller.signal, 0));
  assert.throws(() => waitForAccess(async () => true, controller.signal, NaN));
  console.log('Access deadline: success, failure, finite wait, ignored late settlement and cancellation passed.');
}
main().catch(error => { console.error(error); process.exitCode = 1; });
