import { useMemo } from 'react';
import { ScrollView, View, StyleSheet, Pressable } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors, Radius, Space } from '@/constants/tokens';
import { KTScreen } from '@/components/ui/Screen';
import { KTSurface } from '@/components/ui/Surface';
import { KTText } from '@/components/ui/Text';
import { KTButton } from '@/components/ui/Button';
import { Anel } from '@/components/ui/Anel';
import { Coroa, Naipe } from '@/components/ui/Ornamento';
import { useTournamentStore } from '@/stores/tournamentStore';
import { useBlindsTimer } from '@/hooks/useBlindsTimer';
import { calcularClassificacao } from '@/lib/standings';
import { prizePool } from '@/lib/payouts';
import { MesasHeader } from '@/components/MesasHeader';

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

const dinheiro = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

export default function Mesa() {
  const { tournaments, activeTournamentId, setActive } = useTournamentStore();
  const abertas = tournaments.filter(t => t.status === 'upcoming' || t.status === 'running');
  const ativo = abertas.find(t => t.id === activeTournamentId) ?? abertas[abertas.length - 1];
  const { currentLevel, secondsRemaining, isRunning, structure } = useBlindsTimer(ativo?.id);
  const proximos = abertas.filter(t => t.id !== ativo?.id);
  const nivel = structure[currentLevel];
  const proximo = structure[currentLevel + 1];

  const temporada = useMemo(() => calcularClassificacao(tournaments), [tournaments]);
  const minhaLinha = temporada[0];

  /* Fração já corrida do nível, para o anel. */
  const progresso = nivel ? 1 - secondsRemaining / (nivel.durationMinutes * 60) : 0;

  return (
    <KTScreen>
      <MesasHeader title="Início" />
      <ScrollView contentContainerStyle={styles.conteudo} showsVerticalScrollIndicator={false}>
        {/* ------------------------------------------------ torneio ao vivo */}
        {ativo ? (
          <View style={{ gap: Space.md }}>
            <View style={styles.secaoTopo}>
              <KTText papel="corpoForte">Mesa em foco</KTText>
              <Pressable accessibilityRole="button" onPress={() => router.push('/history')} style={styles.trocar}>
                <KTText papel="apoio" color={Colors.gold200}>Trocar mesa</KTText>
                <Ionicons name="swap-horizontal" size={18} color={Colors.gold200} />
              </Pressable>
            </View>
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
                <KTText papel="corpoForte" numberOfLines={2} style={{ flex: 1, textAlign: 'right' }}>{ativo.name}</KTText>
              </View>

              {/* O relógio dentro do anel. */}
              <View style={styles.relogio}>
                <View style={StyleSheet.absoluteFill as never}>
                  <View style={styles.anelWrap}>
                    <Anel tamanho={196} progresso={progresso} />
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
          </View>
        ) : (
          <KTSurface nivel="card" padding={Space.xxl} style={styles.vazio}>
            <Naipe tipo="espada" tamanho={30} cor={Colors.gold400} opacidade={0.55} />
            <KTText papel="subtitulo" color={Colors.text0} style={{ marginTop: Space.lg }}>
              Nenhuma mesa aberta
            </KTText>
            <KTText papel="apoio" color={Colors.text2} style={styles.vazioTexto}>
              Suas mesas abertas aparecerão aqui.
            </KTText>
          </KTSurface>
        )}

        {/* --------------------------------------------- gerenciar a mesa */}
        {ativo ? (
          <View style={{ gap: Space.md }}>
            <KTButton label="Abrir relógio" fullWidth variant="fantasma" onPress={() => { setActive(ativo.id); router.push(`/blinds/${ativo.id}`); }} icone={<Ionicons name="timer-outline" size={22} color={Colors.gold200} />} />
            <KTButton label="Gerenciar mesa" fullWidth variant="fantasma" onPress={() => { setActive(ativo.id); router.push(`/tournament/${ativo.id}`); }} icone={<Ionicons name="people-outline" size={20} color={Colors.gold200} />} />
          </View>
        ) : null}

        {/* -------------------------------------------------- a temporada */}
        {minhaLinha ? (
          <>
            <KTText papel="rotulo" color={Colors.text1} style={styles.secao}>Ranking</KTText>
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
                <KTText papel="apoio" color={Colors.gold200}>Ver ranking completo</KTText>
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
                <Pressable key={t.id} accessibilityRole="button" accessibilityLabel={`Gerenciar mesa ${t.name}`} onPress={() => { setActive(t.id); router.push(`/tournament/${t.id}`); }}>
                  <KTSurface nivel="card" style={styles.marcada}>
                    <Naipe tipo={t.suit ?? 'ouros'} tamanho={18} cor={t.color ?? Colors.gold300} />
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
      <KTText papel="numero" color={Colors.text0} numberOfLines={1} adjustsFontSizeToFit style={{ marginTop: 3, maxWidth: '100%', textAlign: 'center' }}>{valor}</KTText>
    </View>
  );
}

const styles = StyleSheet.create({
  conteudo: { paddingHorizontal: Space.xl, paddingTop: Space.sm, gap: Space.lg, width: '100%', maxWidth: 760, alignSelf: 'center' },
  secaoTopo: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: Space.md },
  trocar: { flexDirection: 'row', alignItems: 'center', gap: Space.sm, minHeight: 44 },

  palco: { overflow: 'hidden' },
  brilhoPalco: { position: 'absolute', top: 0, left: 0, right: 0, height: 260 },
  palcoTopo: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: Space.lg,
    paddingHorizontal: Space.lg, paddingTop: Space.lg,
  },
  aoVivo: { flexDirection: 'row', alignItems: 'center', gap: Space.sm },
  ponto: { width: 6, height: 6, borderRadius: 3, backgroundColor: Colors.ok },

  relogio: { alignItems: 'center', paddingVertical: Space.lg, minHeight: 212, justifyContent: 'center' },
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
