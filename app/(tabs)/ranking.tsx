import { useMemo } from 'react';
import { ScrollView, View, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Colors, Radius } from '@/constants/tokens';
import { KTText } from '@/components/ui/Text';
import { KTCard } from '@/components/ui/Card';
import { KTButton } from '@/components/ui/Button';
import { useTournamentStore } from '@/stores/tournamentStore';
import { calcularClassificacao } from '@/lib/standings';

/* O ranking era uma lista de oito nomes escritos à mão no código. Bonito e
   inútil: o pódio não mudava depois de jogar. Agora vem dos torneios que
   terminaram de verdade, e a fórmula de pontos está em lib/standings.ts. */

const RANK_COLORS: Record<number, string> = {
  1: Colors.gold200,
  2: '#c0c0c0',
  3: '#cd7f32',
};

/* Naipe só pra dar rosto a quem não tem avatar. É derivado do nome, e não
   sorteado, senão o mesmo jogador trocaria de símbolo a cada render. */
const NAIPES = ['♠', '♥', '♦', '♣'];
function naipeDe(nome: string) {
  let soma = 0;
  for (let i = 0; i < nome.length; i++) soma += nome.charCodeAt(i);
  return NAIPES[soma % NAIPES.length];
}

const dinheiro = (v: number) =>
  `${v < 0 ? '-' : ''}R$ ${Math.abs(v).toLocaleString('pt-BR')}`;

export default function Ranking() {
  const tournaments = useTournamentStore((s) => s.tournaments);
  const standings = useMemo(() => calcularClassificacao(tournaments), [tournaments]);

  const finalizados = tournaments.filter((t) => t.status === 'finished').length;
  const top3 = standings.slice(0, 3);
  const rest = standings.slice(3);

  if (standings.length === 0) {
    /* Vazio com explicação, não pódio com dado falso: a tela precisa dizer o
       que falta acontecer pra ela ter conteúdo. */
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={styles.vazio}>
          <KTText variant="display" size={28} color={Colors.gold200}>Ranking</KTText>
          <KTText variant="ui" size={14} color={Colors.text2} style={styles.vazioTexto}>
            A classificação aparece quando o primeiro torneio terminar. Ela é
            montada a partir dos resultados, então não tem nada a mostrar antes
            de alguém ganhar uma noite.
          </KTText>
          <KTButton label="Criar torneio" onPress={() => router.push('/tournament/create' as any)} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content}>
        <KTText variant="display" size={28} color={Colors.gold200} style={{ marginBottom: 4 }}>Ranking</KTText>
        <KTText variant="ui" size={13} color={Colors.text2} style={{ marginBottom: 28 }}>
          {standings.length} {standings.length === 1 ? 'jogador' : 'jogadores'} ·{' '}
          {finalizados} {finalizados === 1 ? 'torneio' : 'torneios'}
        </KTText>

        {/* Pódio. Com menos de três jogadores mostra só quem existe, em vez de
            desenhar degrau vazio. */}
        <View style={styles.podium}>
          {[top3[1], top3[0], top3[2]].map((p, i) => {
            if (!p) return <View key={`vazio-${i}`} style={{ flex: 1 }} />;
            const heights = [100, 130, 80];
            const rank = p.rank;
            return (
              <View key={p.name} style={[styles.podiumCol, { height: heights[i] + 60 }]}>
                <KTText variant="display" size={28}>{p.avatar ?? naipeDe(p.name)}</KTText>
                <KTText variant="uiSemiBold" size={13} color={RANK_COLORS[rank] ?? Colors.text1} style={{ textAlign: 'center', marginTop: 4 }}>
                  {p.name.split(' ')[0]}
                </KTText>
                <KTText variant="monoBold" size={16} color={RANK_COLORS[rank] ?? Colors.text1}>
                  {p.points}
                </KTText>
                <View style={[styles.podiumBlock, { height: heights[i], backgroundColor: rank === 1 ? Colors.gold700 : Colors.bg3 }]}>
                  <KTText variant="monoBold" size={20} color={RANK_COLORS[rank] ?? Colors.text2}>
                    {rank}
                  </KTText>
                </View>
              </View>
            );
          })}
        </View>

        <View style={{ gap: 8 }}>
          {rest.map(p => (
            <KTCard key={p.name} level={2} style={styles.row}>
              <KTText variant="monoMedium" size={15} color={Colors.text2} style={{ width: 28 }}>
                {p.rank}
              </KTText>
              <KTText variant="display" size={22} style={{ width: 32 }}>{p.avatar ?? naipeDe(p.name)}</KTText>
              <View style={{ flex: 1 }}>
                <KTText variant="uiMedium" size={15} color={Colors.text0}>{p.name}</KTText>
                <KTText variant="ui" size={12} color={Colors.text2}>
                  {p.tournamentsPlayed} {p.tournamentsPlayed === 1 ? 'torneio' : 'torneios'} ·{' '}
                  {p.wins} {p.wins === 1 ? 'vitória' : 'vitórias'} · {dinheiro(p.saldo)}
                </KTText>
              </View>
              <KTText variant="monoBold" size={16} color={Colors.gold300}>{p.points}</KTText>
            </KTCard>
          ))}
        </View>

        <View style={{ height: 32 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.bg0 },
  content: { padding: 20 },
  vazio: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 16 },
  vazioTexto: { textAlign: 'center', lineHeight: 21 },
  podium: {
    flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'center',
    gap: 8, marginBottom: 32,
  },
  podiumCol: { flex: 1, alignItems: 'center', justifyContent: 'flex-end', gap: 0 },
  podiumBlock: {
    width: '100%', borderTopLeftRadius: Radius.sm, borderTopRightRadius: Radius.sm,
    alignItems: 'center', justifyContent: 'center',
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
});
