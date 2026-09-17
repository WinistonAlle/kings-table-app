import type { ReactNode, MutableRefObject } from 'react';
import type { PresetSyncValue } from './PresetSync.web';
export function PresetSyncProvider({ children }: { children: ReactNode; ownerId: string;
  stopRef: MutableRefObject<(() => void) | null> }) { return children; }
export function usePresetSync(): PresetSyncValue | null { return null; }
