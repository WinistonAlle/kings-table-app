import { useEffect, useRef, useCallback } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { useBlindsStore } from '@/stores/blindsStore';

export function useBlindsTimer() {
  const { isRunning, tick } = useBlindsStore();
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const backgroundedAt = useRef<number | null>(null);

  const clearTimer = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  const startTimer = useCallback(() => {
    clearTimer();
    intervalRef.current = setInterval(() => {
      useBlindsStore.getState().tick();
    }, 1000);
  }, [clearTimer]);

  // Start/stop based on running state
  useEffect(() => {
    if (isRunning) {
      startTimer();
    } else {
      clearTimer();
    }
    return clearTimer;
  }, [isRunning, startTimer, clearTimer]);

  // Compensate for time spent in background (RNF-01, RNF-03)
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state: AppStateStatus) => {
      if (state === 'background' || state === 'inactive') {
        backgroundedAt.current = Date.now();
      } else if (state === 'active' && backgroundedAt.current !== null) {
        const elapsed = Math.floor((Date.now() - backgroundedAt.current) / 1000);
        backgroundedAt.current = null;
        if (useBlindsStore.getState().isRunning) {
          for (let i = 0; i < elapsed; i++) {
            useBlindsStore.getState().tick();
          }
        }
      }
    });
    return () => sub.remove();
  }, []);

  return useBlindsStore();
}
