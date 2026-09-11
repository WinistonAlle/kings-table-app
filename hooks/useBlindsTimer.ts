import { useEffect, useRef } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { useBlindsStore } from '@/stores/blindsStore';

/**
 * Mantém o relógio de blinds em dia enquanto a tela estiver montada.
 *
 * O intervalo de 1s aqui existe só para REDESENHAR: quem sabe que horas são é
 * a âncora dentro do store (ver lib/timer.ts). Por isso voltar do segundo
 * plano é uma única chamada a `sync()`, e não a repetição de um tique por
 * segundo decorrido — trinta minutos de tela bloqueada eram 1.800 atualizações
 * de estado em sequência.
 */
export function useBlindsTimer() {
  const isRunning = useBlindsStore((s) => s.isRunning);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    const limpar = () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };

    if (isRunning) {
      /* Sincroniza já ao montar: a tela pode ter sido aberta muito depois de o
         nível começar. */
      useBlindsStore.getState().sync();
      limpar();
      intervalRef.current = setInterval(() => useBlindsStore.getState().sync(), 1000);
    } else {
      limpar();
    }

    return limpar;
  }, [isRunning]);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (state: AppStateStatus) => {
      if (state === 'active') useBlindsStore.getState().sync();
    });
    return () => sub.remove();
  }, []);

  return useBlindsStore();
}
