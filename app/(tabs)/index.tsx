import { useMemo } from 'react';
import { ScrollView, View, StyleSheet, Pressable } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors, Elevacao, Radius, Space } from '@/constants/tokens';
import { KTScreen } from '@/components/ui/Screen';
import { KTSurface } from '@/components/ui/Surface';
import { KTText } from '@/components/ui/Text';
import { KTButton } from '@/components/ui/Button';
import { Anel } from '@/components/ui/Anel';
import { Coroa, Filete, Naipe } from '@/components/ui/Ornamento';
import { useTournamentStore } from '@/stores/tournamentStore';
import { useBlindsTimer } from '@/hooks/useBlindsTimer';
import { calcularClassificacao } from '@/lib/standings';
import { prizePool } from '@/lib/payouts';

/* A mesa (home).
 *
 * A tela antiga tratava tudo com o mesmo peso: o torneio ao vivo era um
 * retângulo cinza igual aos quatro atalhos abaixo dele. Mas essas coisas não
 * têm a mesma importância — durante a noite, a única pergunta é "quanto falta
 * pro próximo nível". Aqui o relógio é o herói, com anel, brilho e corpo
 * grande, e tudo o mais recua para apoio.
 */

const hora = (s: number) =>
  `${Math.floor(s / 60).toString().padStart(2, '0')}:${(s % 60).toString().padStart(2, '0')}`;

const dinheiro = (v: number) => `R$ ${v.toLocaleString('pt-BR')}`;

export default function Mesa() {
  const { tournaments, activeTournamentId, setActive } = useTournamentStore();
  const { currentLevel, secondsRemaining, isRunning, structure } = useBlindsTimer(activeTournamentId);

  const ativo = tournaments.find((t) => t.id === activeTournamentId && t.status !== 'finished');
  const proximos = tournaments.filter((t) => (t.status === 'upcoming' || t.status === 'running') && t.id !== activeTournamentId);
  const nivel = structure[currentLevel];
  const proximo = structure[currentLevel + 1];

  const temporada = useMemo(() => calcularClassificacao(tournaments), [tournaments]);
  const minhaLinha = temporada[0];

  /* Fração já corrida do nível, para o anel. */
  const progresso = nivel ? 1 - secondsRemaining / (nivel.durationMinutes * 60) : 0;

  return (
    <KTScreen>
      <ScrollView contentContainerStyle={styles.conteudo} showsVerticalScrollIndicator={false}>
        {/* ---------------------------------------------------- cabeçalho */}
        <View style={styles.topo}>
          <View>
            <KTText papel="rotulo" color={Colors.gold500}>Clube privado</KTText>
            <KTText papel="titulo" color={Colors.gold100} style={{ marginTop: 2 }}>
              King&apos;s Table
            </KTText>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Criar nova mesa"
            style={styles.botaoTopo}
            onPress={() => router.push('/tournament/create' as any)}
          >
            <Ionicons name="add" size={20} color={Colors.gold200} />
          </Pressable>
        </View>

        <Filete largura={92} />

        {/* ------------------------------------------------ torneio ao vivo */}
        {ativo ? (
          <Pressable onPress={() => router.push(`/blinds/${ativo.id}` as any)}>
            <KTSurface nivel="alta" destaque padding={0} style={styles.palco}>
              {/* Clarão atrás do relógio: é o que faz a peça "acender". */}
              <LinearGradient
                colors={['rgba(232,213,160,0.10)', 'transparent']}
                style={styles.brilhoPalco}
              />

              <View style={styles.palcoTopo}>
                <View style={styles.aoVivo}>
                  <View style={[styles.ponto, !isRunning && { backgroundColor: Colors.text2 }]} />
                  <KTText papel="rotulo" color={isRunning ? Colors.ok : Colors.text2}>
                    {isRunning ? 'Ao vivo' : 'Pausado'}
                  </KTText>
                </View>
                <KTText papel="rotulo" color={Colors.text2}>{ativo.name}</KTText>
              </View>

              {/* O relógio dentro do anel. */}
              <View style={styles.relogio}>
                <View style={StyleSheet.absoluteFill as never}>
                  <View style={styles.anelWrap}>
                    <Anel tamanho={268} progresso={progresso} />
                  </View>
                </View>
                <KTText papel="rotulo" color={Colors.gold500}>{nivel?.isBreak ? 'Intervalo' : `Nível ${nivel?.level ?? currentLevel + 1}`}</KTText>
                <KTText papel="hero" color={Colors.gold50} style={styles.horaTexto}>
                  {hora(secondsRemaining)}
                </KTText>
                {nivel ? (
                  <>
                    <KTText papel="numero" size={17} color={Colors.text1}>
                      {nivel.isBreak ? 'Pausa para a mesa' : `${nivel.smallBlind} / ${nivel.bigBlind}`}
                    </KTText>
                    {/* O ante desce para uma linha própria: junto dos blinds a
                        frase ficava larga demais e encostava no anel. */}
                    {nivel.ante ? (
                      <KTText papel="rotulo" color={Colors.text3} style={{ marginTop: 5 }}>
                        ante {nivel.ante}
                      </KTText>
                    ) : null}
                  </>
                ) : null}
              </View>

              {/* Rodapé do palco: o que vem depois e quanta gente resta. */}
              <View style={styles.palcoRodape}>
                <Rodape rotulo="De pé" valor={`${ativo.players.filter((p) => !p.position).length}/${ativo.players.length}`} />
                <View style={styles.divisor} />
                <Rodape rotulo="Bolo" valor={dinheiro(prizePool(ativo))} />
                <View style={styles.divisor} />
                <Rodape
                  rotulo="Próximo"
                  valor={proximo?.isBreak ? 'Intervalo' : proximo ? `${proximo.smallBlind}/${proximo.bigBlind}` : 'Fim'}
                />
              </View>
            </KTSurface>
          </Pressable>
        ) : (
          <KTSurface nivel="card" padding={Space.xxl} style={styles.vazio}>
            <Naipe tipo="espada" tamanho={30} cor={Colors.gold400} opacidade={0.55} />
            <KTText papel="subtitulo" color={Colors.text0} style={{ marginTop: Space.lg }}>
              Nenhuma mesa aberta
            </KTText>
            <KTText papel="apoio" color={Colors.text2} style={styles.vazioTexto}>
              Crie um torneio para começar a noite. O relógio, a premiação e o
              ranking saem daí.
            </KTText>
            <KTButton
              label="Abrir mesa"
              onPress={() => router.push('/tournament/create' as any)}
              style={{ marginTop: Space.xl }}
            />
          </KTSurface>
        )}

        {/* --------------------------------------------- gerenciar a mesa */}
        {ativo ? (
          <Pressable
            style={styles.gerenciar}
            onPress={() => {
              setActive(ativo.id);
              router.push(`/tournament/${ativo.id}` as any);
            }}
          >
            <View style={{ flex: 1 }}>
              <KTText papel="corpoForte" color={Colors.text0}>Gerenciar a mesa</KTText>
              <KTText papel="apoio" color={Colors.text2}>
                Jogadores, eliminações e premiação
              </KTText>
            </View>
            <Ionicons name="chevron-forward" size={18} color={Colors.gold400} />
          </Pressable>
        ) : null}

        {/* -------------------------------------------------- a temporada */}
        {minhaLinha ? (
          <>
            <KTText papel="rotulo" color={Colors.text2} style={styles.secao}>A temporada</KTText>
            <KTSurface nivel="card">
              <View style={styles.lider}>
                <Coroa tamanho={22} />
                <View style={{ flex: 1 }}>
                  <KTText papel="corpoForte" color={Colors.text0}>{minhaLinha.name}</KTText>
                  <KTText papel="apoio" color={Colors.text2}>
                    {minhaLinha.tournamentsPlayed} {minhaLinha.tournamentsPlayed === 1 ? 'noite' : 'noites'} ·{' '}
                    {minhaLinha.wins} {minhaLinha.wins === 1 ? 'vitória' : 'vitórias'}
                  </KTText>
                </View>
                <KTText papel="numeroForte" color={Colors.gold200}>{minhaLinha.points}</KTText>
              </View>
              <Pressable style={styles.verTudo} onPress={() => router.push('/ranking' as any)}>
                <KTText papel="apoio" color={Colors.gold400}>Ver a liga inteira</KTText>
                <Ionicons name="arrow-forward" size={13} color={Colors.gold400} />
              </Pressable>
            </KTSurface>
          </>
        ) : null}

        {/* --------------------------------------------------- as próximas */}
        {proximos.length ? (
          <>
            <KTText papel="rotulo" color={Colors.text2} style={styles.secao}>Outras mesas abertas</KTText>
            <View style={{ gap: Space.md }}>
              {proximos.map((t) => (
                <Pressable key={t.id} accessibilityRole="button" onPress={() => router.push(`/tournament/${t.id}` as any)}>
                  <KTSurface nivel="card" style={styles.marcada}>
                    <Naipe tipo="ouros" tamanho={14} cor={Colors.gold500} />
                    <View style={{ flex: 1 }}>
                      <KTText papel="corpoForte">{t.name}</KTText>
                      <KTText papel="apoio" color={Colors.text2}>
                        {t.status === 'running' ? 'Em andamento' : 'Preparando'} · {dinheiro(t.buyIn)} · {t.players.length} inscritos
                      </KTText>
                    </View>
                    <Ionicons name="chevron-forward" size={16} color={Colors.text3} />
                  </KTSurface>
                </Pressable>
              ))}
            </View>
          </>
        ) : null}

        <Pressable accessibilityRole="button" onPress={() => router.push('/history' as never)} style={styles.gerenciar}>
          <Ionicons name="albums-outline" size={20} color={Colors.gold300} />
          <View style={{ flex: 1 }}><KTText papel="corpoForte">Todas as mesas</KTText><KTText papel="apoio" color={Colors.text1}>Mesas abertas, resultados e histórico</KTText></View>
          <Ionicons name="chevron-forward" size={18} color={Colors.text2} />
        </Pressable>
        <View style={{ height: 88 }} />
      </ScrollView>
    </KTScreen>
  );
}

function Rodape({ rotulo, valor }: { rotulo: string; valor: string }) {
  return (
    <View style={styles.rodapeCel}>
      <KTText papel="rotulo" color={Colors.text3}>{rotulo}</KTText>
      <KTText papel="numero" color={Colors.text0} style={{ marginTop: 3 }}>{valor}</KTText>
    </View>
  );
}

const styles = StyleSheet.create({
  conteudo: { paddingHorizontal: Space.xl, paddingTop: Space.md, gap: Space.xl, width: '100%', maxWidth: 760, alignSelf: 'center' },

  topo: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  botaoTopo: {
    width: 42, height: 42, borderRadius: Radius.full,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth, borderColor: Colors.borderStrong,
    backgroundColor: Colors.bg1,
  },

  palco: { overflow: 'hidden' },
  brilhoPalco: { position: 'absolute', top: 0, left: 0, right: 0, height: 260 },
  palcoTopo: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: Space.lg, paddingTop: Space.lg,
  },
  aoVivo: { flexDirection: 'row', alignItems: 'center', gap: Space.sm },
  ponto: { width: 6, height: 6, borderRadius: 3, backgroundColor: Colors.ok },

  relogio: { alignItems: 'center', paddingVertical: Space.xxl, minHeight: 286, justifyContent: 'center' },
  anelWrap: { alignItems: 'center', justifyContent: 'center', flex: 1 },
  horaTexto: { marginVertical: Space.xs },

  palcoRodape: {
    flexDirection: 'row', alignItems: 'center',
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: Colors.border,
  },
  rodapeCel: { flex: 1, alignItems: 'center', paddingVertical: Space.lg },
  divisor: { width: StyleSheet.hairlineWidth, height: 30, backgroundColor: Colors.border },

  vazio: { alignItems: 'center' },
  vazioTexto: { textAlign: 'center', marginTop: Space.sm, maxWidth: 260 },

  gerenciar: {
    flexDirection: 'row', alignItems: 'center', gap: Space.md,
    paddingVertical: Space.lg, paddingHorizontal: Space.lg,
    borderRadius: Radius.lg,
    borderWidth: StyleSheet.hairlineWidth, borderColor: Colors.border,
    backgroundColor: 'rgba(255,250,235,0.02)',
  },

  secao: { marginBottom: -Space.md },
  lider: { flexDirection: 'row', alignItems: 'center', gap: Space.md },
  verTudo: {
    flexDirection: 'row', alignItems: 'center', gap: Space.sm,
    marginTop: Space.lg, paddingTop: Space.md,
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: Colors.border,
  },
  marcada: { flexDirection: 'row', alignItems: 'center', gap: Space.md },
});
