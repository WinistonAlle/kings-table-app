import { useCallback } from 'react';
import { AppState } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { useBlindsStore } from '@/stores/blindsStore';
import { useTournamentStore } from '@/stores/tournamentStore';

/**
 * Mantém o relógio de blinds em dia enquanto a tela estiver montada.
 *
 * O intervalo de 1s aqui existe só para REDESENHAR: quem sabe que horas são é
 * a âncora dentro do store (ver lib/timer.ts). Por isso voltar do segundo
 * plano é uma única chamada a `sync()`, e não a repetição de um tique por
 * segundo decorrido — trinta minutos de tela bloqueada eram 1.800 atualizações
 * de estado em sequência.
 */
export function useBlindsTimer(tournamentId?: string | null) {
  const torneio = useTournamentStore(s => s.tournaments.find(t => t.id === tournamentId));
  // Telas mantidas na pilha nao devem selecionar outra mesa em segundo plano.
  useFocusEffect(useCallback(() => {
    if (!torneio) return;
    useBlindsStore.getState().selectTournament(torneio.id, torneio.blindStructure);
    const sync = () => {
      const state = useBlindsStore.getState();
      if (state.tournamentId !== torneio.id) return;
      if (torneio.status !== 'running') {
        if (state.isRunning) state.pause();
      } else if (state.isRunning) state.sync();
    };
    sync();
    const interval = setInterval(sync, 1000);
    const sub = AppState.addEventListener('change', state => { if (state === 'active') sync(); });
    return () => { clearInterval(interval); sub.remove(); };
  }, [torneio?.id, torneio?.blindStructure, torneio?.status]));

  return useBlindsStore();
}
