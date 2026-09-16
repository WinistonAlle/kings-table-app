import type { ReactNode } from 'react';
import { View, StyleSheet, type ViewStyle } from 'react-native';
import { SafeAreaView, type Edge } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Defs, Filter, FeTurbulence, Rect } from 'react-native-svg';
import { Colors, Degrade } from '@/constants/tokens';

/* O chão de toda tela.
 *
 * Antes cada tela era `backgroundColor: bg0` — preto chapado, que lê como
 * papel, não como material. Aqui o fundo ganha duas camadas que custam quase
 * nada e mudam tudo:
 *
 * 1. Um clarão quente no alto, como luminária pendurada sobre a mesa. É o que
 *    dá direção à luz: sem fonte de luz definida, nenhuma sombra depois faz
 *    sentido, e as superfícies elevadas parecem adesivo.
 * 2. Grão de filme, bem fraco. O olho lê ruído sutil como superfície física;
 *    preto perfeitamente liso ele lê como tela desligada. É o mesmo truque do
 *    mockup original, que tinha uma camada de turbulência por cima de tudo.
 */

export function Grao({ opacidade = 0.035 }: { opacidade?: number }) {
  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, { opacity: opacidade }]}>
      <Svg width="100%" height="100%">
        <Defs>
          {/* baseFrequency alta = grão fino. Abaixo de ~0.6 vira nuvem, e aí
              parece sujeira na tela em vez de textura. */}
          <Filter id="grao">
            <FeTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves={2} stitchTiles="stitch" />
          </Filter>
        </Defs>
        <Rect width="100%" height="100%" filter="url(#grao)" />
      </Svg>
    </View>
  );
}

export function KTScreen({
  children,
  edges = ['top'],
  style,
  brilho = true,
}: {
  children: ReactNode;
  edges?: readonly Edge[];
  style?: ViewStyle;
  /** Desliga o clarão em telas que têm luz própria, como o relógio de blinds. */
  brilho?: boolean;
}) {
  return (
    <View style={styles.raiz}>
      {brilho ? (
        <LinearGradient
          colors={Degrade.fundo}
          locations={[0, 0.45, 1]}
          style={StyleSheet.absoluteFill}
        />
      ) : null}
      <Grao />
      <SafeAreaView style={[styles.safe, style]} edges={edges}>
        {children}
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  raiz: { flex: 1, backgroundColor: Colors.bg0 },
  safe: { flex: 1 },
});
