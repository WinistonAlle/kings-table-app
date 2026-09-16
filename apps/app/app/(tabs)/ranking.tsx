import { useMemo } from 'react';
import { ScrollView, View, StyleSheet, Pressable } from 'react-native';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors, Elevacao, Radius, Space } from '@/constants/tokens';
import { KTScreen } from '@/components/ui/Screen';
import { KTSurface } from '@/components/ui/Surface';
import { KTText } from '@/components/ui/Text';
import { KTButton } from '@/components/ui/Button';
import { Coroa, Filete, Naipe } from '@/components/ui/Ornamento';
import { useTournamentStore } from '@/stores/tournamentStore';
import { calcularClassificacao, type Standing } from '@/lib/standings';

/* A liga.
 *
 * O pódio antigo eram três blocos cinzas de alturas diferentes, com um naipe
 * solto em cima. Aqui ele vira o que um pódio é: uma peça só, com o primeiro
 * lugar maior, mais claro e com coroa, e os outros dois recuando em tamanho e
 * em brilho. Hierarquia por três canais ao mesmo tempo (altura, cor e corpo) é
 * o que faz ler o campeão antes de ler o nome.
 */

const METAL: Record<number, readonly [string, string]> = {
  1: [Colors.gold100, Colors.gold400],
  2: ['#d8d8d8', '#8e8e8e'],
  3: ['#d9a273', '#8a5a33'],
};

const dinheiro = (v: number) =>
  `${v < 0 ? '−' : ''}R$ ${Math.abs(v).toLocaleString('pt-BR')}`;

const NAIPES = ['espada', 'copas', 'ouros', 'paus'] as const;
/* Naipe derivado do nome, não sorteado: o mesmo jogador tem que ter sempre a
   mesma marca, ou o ranking pisca de identidade a cada render. */
function naipeDe(nome: string) {
  let soma = 0;
  for (let i = 0; i < nome.length; i++) soma += nome.charCodeAt(i);
  return NAIPES[soma % NAIPES.length];
}

export default function Liga() {
  const tournaments = useTournamentStore((s) => s.tournaments);
  const classificacao = useMemo(() => calcularClassificacao(tournaments), [tournaments]);
  const noites = tournaments.filter((t) => t.status === 'finished').length;

  if (classificacao.length === 0) {
    return (
      <KTScreen>
        <View style={styles.vazio}>
          <Coroa tamanho={34} cor={Colors.gold500} />
          <KTText papel="titulo" color={Colors.gold100} style={{ marginTop: Space.lg }}>
            Nenhum resultado ainda
          </KTText>
          <KTText papel="corpo" color={Colors.text2} style={styles.vazioTexto}>
            O ranking reúne os resultados das mesas encerradas.
          </KTText>
          <KTButton
            label="Criar mesa"
            onPress={() => router.push('/tournament/create' as any)}
            style={{ marginTop: Space.xl }}
          />
        </View>
      </KTScreen>
    );
  }

  const [primeiro, segundo, terceiro] = classificacao;
  const resto = classificacao.slice(3);

  return (
    <KTScreen>
      <ScrollView contentContainerStyle={styles.conteudo} showsVerticalScrollIndicator={false}>
        <View style={styles.cabecalho}>
          <KTText papel="rotulo" color={Colors.text1}>Resultados</KTText>
          <KTText papel="titulo" color={Colors.gold100}>Ranking</KTText>
          <KTText papel="apoio" color={Colors.text2} style={{ marginTop: 2 }}>
            {classificacao.length} {classificacao.length === 1 ? 'jogador' : 'jogadores'} ·{' '}
            {noites} {noites === 1 ? 'noite' : 'noites'}
          </KTText>
          <View style={{ marginTop: Space.lg }}>
            <Filete largura={92} />
          </View>
        </View>

        {/* ------------------------------------------------------- pódio */}
        <View style={styles.podio}>
          <Degrau lugar={2} pessoa={segundo} />
          <Degrau lugar={1} pessoa={primeiro} />
          <Degrau lugar={3} pessoa={terceiro} />
        </View>

        {/* ------------------------------------------------- o resto da liga */}
        {resto.length ? (
          <View style={{ gap: Space.sm }}>
            {resto.map((p) => (
              <KTSurface key={p.name} nivel="card" padding={Space.lg} style={styles.linha}>
                <KTText papel="numero" color={Colors.text3} style={styles.posicao}>
                  {p.rank}
                </KTText>
                <Naipe tipo={naipeDe(p.name)} tamanho={15} cor={Colors.gold600} />
                <View style={{ flex: 1 }}>
                  <KTText papel="corpoForte" color={Colors.text0} numberOfLines={1}>{p.name}</KTText>
                  <KTText papel="apoio" color={Colors.text2}>
                    {p.tournamentsPlayed} {p.tournamentsPlayed === 1 ? 'noite' : 'noites'} · {dinheiro(p.saldo)}
                  </KTText>
                </View>
                <KTText papel="numero" size={17} color={Colors.gold300}>{p.points}</KTText>
              </KTSurface>
            ))}
          </View>
        ) : null}

        <View style={{ height: 120 }} />
      </ScrollView>
    </KTScreen>
  );
}

/** Um degrau do pódio. O primeiro lugar é maior por todos os canais de uma vez. */
function Degrau({ lugar, pessoa }: { lugar: 1 | 2 | 3; pessoa?: Standing }) {
  if (!pessoa) return <View style={{ flex: 1 }} />;

  const rei = lugar === 1;
  const alturas = { 1: 132, 2: 100, 3: 82 };
  const [claro, escuro] = METAL[lugar];

  return (
    <View style={styles.degrau}>
      {rei ? <Coroa tamanho={24} cor={Colors.gold100} /> : null}

      <View style={[styles.medalha, rei && styles.medalhaRei]}>
        <Naipe tipo={naipeDe(pessoa.name)} tamanho={rei ? 22 : 17} cor={claro} />
      </View>

      <KTText
        papel="corpoForte"
        size={rei ? 15 : 13}
        color={rei ? Colors.text0 : Colors.text1}
        numberOfLines={1}
        style={styles.nomeDegrau}
      >
        {pessoa.name.split(' ')[0]}
      </KTText>
      <KTText papel="numeroForte" size={rei ? 22 : 17} color={claro}>
        {pessoa.points}
      </KTText>

      {/* O bloco. Degradê de metal e fio de luz no topo, como as outras
          superfícies do app: pódio chapado parecia gráfico de barras. */}
      <View style={[styles.bloco, { height: alturas[lugar] }, rei && Elevacao.ouro]}>
        <LinearGradient
          colors={rei ? [Colors.gold700, Colors.gold800] : [Colors.bg3, Colors.bg1]}
          style={[StyleSheet.absoluteFill, { zIndex: -1 }]}
        />
        <View style={[styles.blocoLuz, { backgroundColor: rei ? 'rgba(231,208,172,0.35)' : Colors.luzTopo }]} />
        <KTText papel="numeroForte" size={rei ? 30 : 22} color={rei ? Colors.gold100 : escuro}>
          {lugar}
        </KTText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  conteudo: { paddingHorizontal: Space.xl, paddingTop: Space.md, gap: Space.xxl },
  cabecalho: { alignItems: 'flex-start' },

  vazio: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: Space.xxl },
  vazioTexto: { textAlign: 'center', marginTop: Space.md, maxWidth: 290 },

  podio: { flexDirection: 'row', alignItems: 'flex-end', gap: Space.md },
  degrau: { flex: 1, alignItems: 'center', gap: Space.xs },
  medalha: {
    width: 44, height: 44, borderRadius: Radius.full,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth, borderColor: Colors.border,
    backgroundColor: Colors.bg2,
    marginBottom: 2,
  },
  medalhaRei: { width: 54, height: 54, borderColor: Colors.borderHot, backgroundColor: Colors.gold800 },
  nomeDegrau: { maxWidth: '100%' },
  bloco: {
    width: '100%', marginTop: Space.sm,
    borderTopLeftRadius: Radius.sm, borderTopRightRadius: Radius.sm,
    alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
  },
  blocoLuz: { position: 'absolute', top: 0, left: 6, right: 6, height: 1 },

  linha: { flexDirection: 'row', alignItems: 'center', gap: Space.md },
  posicao: { width: 24 },
});
