import { View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useBlindsStore } from '@/stores/blindsStore';
import { useTournamentStore } from '@/stores/tournamentStore';
import { Colors } from '@/constants/tokens';
import { confirmarAcao } from '@/lib/confirmar';
import { KTButton } from './ui/Button';
import { KTText } from './ui/Text';

export function HandForHand({ id }: { id?: string }) {
  const clock = useBlindsStore();
  const tournament = useTournamentStore(s => s.tournaments.find(t => t.id === id));
  if (!tournament || clock.tournamentId !== id) return null;
  return <View style={{ gap: 8, alignItems: 'center', paddingHorizontal: 16 }}>
    {clock.handForHand && <KTText papel="apoio" color={Colors.warn}>Hand-for-hand · relógio congelado</KTText>}
    <KTButton label={clock.handForHand ? 'Sair do hand-for-hand' : 'Ativar hand-for-hand'} variant="fantasma" disabled={tournament.status !== 'running'} onPress={() => confirmarAcao(clock.handForHand ? 'Sair do hand-for-hand? O relógio continuará pausado até você retomá-lo.' : 'Ativar hand-for-hand e congelar o relógio? Todas as mesas devem terminar cada mão antes da próxima.', () => {
      const current = useBlindsStore.getState();
      if (current.tournamentId === id && useTournamentStore.getState().tournaments.find(t => t.id === id)?.status === 'running') current.setHandForHand(!current.handForHand);
    })} icone={<Ionicons name="hand-left-outline" size={18} color={Colors.gold300} />} />
  </View>;
}
