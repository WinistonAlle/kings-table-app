import { useCallback } from 'react';
import { useFocusEffect } from 'expo-router';
import { activateKeepAwakeAsync, deactivateKeepAwake, isAvailableAsync } from 'expo-keep-awake';

export function useAwakeScreen(tag: string) {
  useFocusEffect(useCallback(() => {
    let disposed = false;
    void (async () => {
      if (!await isAvailableAsync() || disposed) return;
      await activateKeepAwakeAsync(tag);
      if (disposed) await deactivateKeepAwake(tag);
    })().catch(() => {});
    return () => {
      disposed = true;
      void deactivateKeepAwake(tag).catch(() => {});
    };
  }, [tag]));
}
