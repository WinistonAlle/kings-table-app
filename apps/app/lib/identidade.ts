export function novaIdentidade(): string {
  return globalThis.crypto.randomUUID();
}
