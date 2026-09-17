import { randomUUID } from 'expo-crypto';

export function novaIdentidade(): string {
  return randomUUID();
}
