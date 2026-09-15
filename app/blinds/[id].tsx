import { useEffect, useRef, useState } from 'react';
import { View, Pressable, StyleSheet, Dimensions, Animated, useWindowDimensions } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors, Radius, Space } from '@/constants/tokens';
import { KTText } from '@/components/ui/Text';
import { Anel } from '@/components/ui/Anel';
import { Grao } from '@/components/ui/Screen';
import { KTButton } from '@/components/ui/Button';
import { Filete, Naipe } from '@/components/ui/Ornamento';
import { useBlindsTimer } from '@/hooks/useBlindsTimer';
import { useTournamentStore } from '@/stores/tournamentStore';

/* Relógio de blinds, em paisagem.
 *
 * É a tela que fica horas de pé no meio da mesa, vista de longe e de lado,
 * muitas vezes por alguém que já bebeu. Isso dita tudo:
 *
 * - Um único herói. O tempo é o maior elemento por larga margem; blinds e
 *   nível são satélites. A versão antiga dava peso quase igual a seis números
 *   ao mesmo tempo, e de longe nenhum deles lia.
 * - Nada de toque preciso. Os alvos são grandes e ficam nas bordas, longe do
 *   centro, onde a mão passa pra pegar ficha.
 * - Aviso por COR e por TAMANHO. Nos últimos 60 segundos o relógio esquenta;
 *   nos últimos 30, pulsa. Quem está de costas percebe pelo canto do olho.
 */

const formatar = (s: number) =>
  `${Math.floor(s / 60).toString().padStart(2, '0')}:${(s % 60).toString().padStart(2, '0')}`;

const curto = (n: number) =>
  n >= 1000 ? `${(n / 1000).toFixed(n % 1000 === 0 ? 0 : 1)}K` : String(n);

export default function Relogio() {
  const params = useLocalSearchParams<{ id?: string }>();
  const id = typeof params.id === 'string' ? params.id : undefined;
  const { structure, currentLevel, secondsRemaining, isRunning, start, pause, nextLevel, prevLevel } =
    useBlindsTimer(id);
  const torneio = useTournamentStore((s) =>
    s.tournaments.find((t) => t.id === (id ?? s.activeTournamentId)),
  );

  const { width, height } = useWindowDimensions();
  const L = Math.max(width, height);
  const A = Math.min(width, height);

  const atual = structure[currentLevel];
  const proximo = structure[currentLevel + 1];
  const total = atual ? atual.durationMinutes * 60 : 1;
  const progresso = 1 - secondsRemaining / total;

  const alerta = secondsRemaining <= 60;
  const critico = secondsRemaining <= 30;
  const corTempo = critico ? Colors.danger : alerta ? Colors.warn : torneio?.color ?? Colors.gold50;

  /* Pulso nos últimos 30s. Só a opacidade, não a escala: número que muda de
     tamanho é ilegível de longe, que é justamente quando isto importa. */
  const pulso = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (!critico || !isRunning) {
      pulso.setValue(1);
      return;
    }
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(pulso, { toValue: 0.45, duration: 500, useNativeDriver: true }),
        Animated.timing(pulso, { toValue: 1, duration: 500, useNativeDriver: true }),
      ]),
    );
    anim.start();
    return () => anim.stop();
  }, [critico, isRunning, pulso]);

  /* Clarão na virada de nível: a mesa inteira precisa perceber sem ninguém
     avisar em voz alta. */
  const [virou, setVirou] = useState(false);
  const clarao = useRef(new Animated.Value(0)).current;
  const nivelAnterior = useRef(currentLevel);
  useEffect(() => {
    if (currentLevel === nivelAnterior.current) return;
    nivelAnterior.current = currentLevel;
    setVirou(true);
    clarao.setValue(0);
    Animated.sequence([
      Animated.timing(clarao, { toValue: 1, duration: 220, useNativeDriver: true }),
      Animated.delay(900),
      Animated.timing(clarao, { toValue: 0, duration: 600, useNativeDriver: true }),
    ]).start(() => setVirou(false));
  }, [currentLevel, clarao]);

  /* O anel tem que caber ENTRE o cabeçalho e os controles, não na altura
     inteira: com 0.74 ele subia por baixo do nome do torneio. */
  const retrato = width < 700;
  const anel = retrato ? Math.min(width * 0.78, height * 0.38, 340) : Math.min(height * 0.6, 420);

  return (
    <View style={styles.raiz}>
      {/* Feltro: vinheta radial quente ao centro, escurecendo para as bordas. */}
      <LinearGradient colors={[Colors.bg2, Colors.bg0, '#050505']} locations={[0, 0.55, 1]} style={StyleSheet.absoluteFill} />
      <Grao opacidade={0.045} />

      {/* ------------------------------------------------ barra de título */}
      <View style={styles.topo}>
        <Pressable style={styles.botaoCanto} onPress={() => router.back()} hitSlop={16}>
          <Ionicons name="chevron-down" size={20} color={Colors.text2} />
        </Pressable>
        <View style={styles.tituloCentro}>
          <KTText papel="subtitulo" color={torneio?.color ?? Colors.gold200} numberOfLines={2} style={{ textAlign: 'center' }}>{torneio?.name ?? 'Mesa'}</KTText>
          {torneio ? (
            <KTText papel="rotulo" color={Colors.text3} style={{ marginTop: 2 }}>
              {torneio.players.filter((p) => !p.position).length} de pé
            </KTText>
          ) : null}
        </View>
        <View style={styles.botaoCanto} />
      </View>

      {/* ------------------------------------------------------ o palco */}
      <View style={[styles.palco, retrato && { flexDirection: 'column', justifyContent: 'space-evenly', paddingHorizontal: 16 }]}>
        {/* Esquerda: o nível corrente. */}
        <Lado
          rotulo="Agora"
          nivel={atual?.level}
          sb={atual?.smallBlind}
          bb={atual?.bigBlind}
          ante={atual?.ante}
          intervalo={atual?.isBreak}
          destaque
          compacto={retrato}
        />

        {/* Centro: o tempo. */}
        <Pressable
          style={[styles.centro, { width: anel, height: anel }]}
          onPress={isRunning ? pause : start}
          accessibilityRole="button"
          disabled={secondsRemaining === 0}
          accessibilityLabel={isRunning ? 'Pausar relógio' : 'Iniciar relógio'}
        >
          <View style={StyleSheet.absoluteFill}>
            <Anel
              tamanho={anel}
              espessura={4}
              progresso={progresso}
              cor={corTempo}
            />
          </View>
          <Animated.View style={{ opacity: pulso, alignItems: 'center' }}>
            <KTText papel="rotulo" color={atual?.isBreak ? Colors.ok : Colors.text1}>{atual?.isBreak ? 'Intervalo' : 'Tempo restante'}</KTText>
            <KTText
              papel="numero"
              color={corTempo}
              size={Math.min(anel * 0.25, 96)}
              style={styles.tempo}
            >
              {formatar(secondsRemaining)}
            </KTText>
            <KTText papel="rotulo" color={Colors.text3}>
              {isRunning ? 'toque para pausar' : 'toque para seguir'}
            </KTText>
          </Animated.View>
        </Pressable>

        {/* Direita: o que vem. */}
        <Lado
          rotulo="A seguir"
          nivel={proximo?.level}
          sb={proximo?.smallBlind}
          bb={proximo?.bigBlind}
          ante={proximo?.ante}
          intervalo={proximo?.isBreak}
          compacto={retrato}
        />
      </View>

      <View style={{ alignItems: 'center', paddingBottom: 16 }}><KTButton label={isRunning ? 'Pausar relógio' : secondsRemaining === 0 ? 'Estrutura concluída' : 'Iniciar relógio'} disabled={secondsRemaining === 0} onPress={isRunning ? pause : start} icone={<Ionicons name={isRunning ? 'pause' : 'play'} size={18} color={Colors.bg0} />} style={{ alignSelf: 'center' }} /></View>

      {/* ---------------------------------------------------- os controles */}
      <View style={styles.rodape}>
        <Pressable style={styles.passo} onPress={prevLevel} hitSlop={12}>
          <Ionicons name="play-skip-back" size={15} color={Colors.text2} />
          <KTText papel="rotulo" color={Colors.text2}>Anterior</KTText>
        </Pressable>

        <View style={styles.marcaCentro}>
          <Filete largura={64} />
          <Naipe tipo={torneio?.suit ?? 'espada'} tamanho={16} cor={torneio?.color ?? Colors.gold300} />
        </View>

        <Pressable style={styles.passo} onPress={nextLevel} hitSlop={12}>
          <KTText papel="rotulo" color={Colors.text2}>Próximo</KTText>
          <Ionicons name="play-skip-forward" size={15} color={Colors.text2} />
        </Pressable>
      </View>

      {/* Clarão da virada, por cima de tudo. */}
      {virou ? (
        <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.clarao, { opacity: clarao }]}>
          <LinearGradient colors={['rgba(232,213,160,0.22)', 'transparent']} style={StyleSheet.absoluteFill} />
          <KTText papel="titulo" color={Colors.gold100}>{atual?.isBreak ? 'Intervalo' : `Nível ${atual?.level ?? currentLevel + 1}`}</KTText>
        </Animated.View>
      ) : null}
    </View>
  );
}

/** Coluna lateral: nível, small, big e ante. */
function Lado({
  rotulo, nivel, sb, bb, ante, destaque = false, intervalo = false, compacto = false,
}: {
  rotulo: string; nivel?: number; sb?: number; bb?: number; ante?: number; destaque?: boolean; intervalo?: boolean; compacto?: boolean;
}) {
  const cor = destaque ? Colors.text0 : Colors.text2;
  return (
    <View style={[styles.lado, compacto && { width: '100%', alignItems: 'center' }]}>
      <KTText papel="rotulo" color={destaque ? Colors.gold500 : Colors.text3}>{rotulo}</KTText>
      {nivel !== undefined ? (
        <>
          <KTText papel="subtitulo" color={destaque ? Colors.gold200 : Colors.text2} style={{ marginTop: 2 }}>
            {intervalo ? 'Intervalo' : `Nível ${nivel}`}
          </KTText>
          <View style={{ marginTop: compacto ? 4 : Space.lg, alignItems: compacto ? 'center' : 'flex-start' }}>
            {/* `numberOfLines` é rede de segurança: blind de cinco dígitos no
                fim da estrutura ainda tem que caber numa linha só. */}
            <KTText
              papel="numeroForte"
              size={compacto ? destaque ? 24 : 18 : destaque ? 30 : 22}
              color={cor}
              numberOfLines={1}
              adjustsFontSizeToFit
            >
              {intervalo ? 'Pausa' : `${curto(sb ?? 0)} / ${curto(bb ?? 0)}`}
            </KTText>
            <KTText papel="rotulo" color={Colors.text3} style={{ marginTop: 6 }}>
              {intervalo ? 'Hora de respirar' : ante ? `ante ${curto(ante)}` : 'sem ante'}
            </KTText>
          </View>
        </>
      ) : (
        <KTText papel="apoio" color={Colors.text3} style={{ marginTop: Space.md }}>
          Fim da estrutura
        </KTText>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  raiz: { flex: 1, backgroundColor: '#050403' },

  topo: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: Space.xl, paddingTop: Space.lg,
  },
  botaoCanto: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  tituloCentro: { alignItems: 'center', flex: 1 },

  palco: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: Space.xxl, paddingTop: Space.sm,
  },
  lado: { width: 200 },
  centro: { alignItems: 'center', justifyContent: 'center' },
  tempo: { marginVertical: Space.xs },

  rodape: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: Space.xxl, paddingBottom: Space.xl,
  },
  passo: {
    flexDirection: 'row', alignItems: 'center', gap: Space.sm,
    paddingVertical: Space.md, paddingHorizontal: Space.lg,
    borderRadius: Radius.full,
    borderWidth: StyleSheet.hairlineWidth, borderColor: Colors.border,
  },
  marcaCentro: { alignItems: 'center', gap: 5 },

  clarao: { alignItems: 'center', justifyContent: 'center' },
});
