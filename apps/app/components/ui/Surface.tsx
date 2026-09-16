import { View, StyleSheet, type ViewProps } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors, Degrade, Elevacao, Radius, Space } from '@/constants/tokens';

/* Superfície elevada.
 *
 * O card antigo era `backgroundColor` + borda de 1px, igual em todo lugar. O
 * que falta nisso é LUZ: um objeto real recebe mais luz na face de cima e
 * projeta sombra embaixo. Aqui isso é feito com três coisas de uma vez:
 *
 * - um degradê interno que clareia para o topo (a face que "pega" a luz),
 * - uma borda superior mais clara que as outras (o fio da aresta),
 * - sombra projetada.
 *
 * React Native não tem `box-shadow: inset`, então o fio de luz é uma view de
 * 1px posicionada no topo, e não uma sombra. É o truque que faz a diferença
 * entre parecer um objeto e parecer um retângulo pintado.
 */

type Nivel = 'plana' | 'card' | 'alta' | 'ouro';

interface SurfaceProps extends ViewProps {
  /** Elevação: muda sombra e intensidade do fio de luz. */
  nivel?: Nivel;
  /** Borda acesa, para o elemento em foco. */
  destaque?: boolean;
  padding?: number;
  radius?: number;
}

export function KTSurface({
  nivel = 'card',
  destaque = false,
  padding = Space.lg,
  radius = Radius.lg,
  style,
  children,
  ...props
}: SurfaceProps) {
  return (
    /* O padding fica NESTA view e os filhos são diretos, sem embrulho.
       Antes havia um `<View style={{ padding }}>` em volta deles, e o efeito
       colateral era silencioso e caro: quem passava `style={{ flexDirection:
       'row' }}` estilizava a caixa de fora, enquanto os filhos continuavam
       empilhados na coluna do embrulho. Meia dúzia de telas ficou com linha
       virada em coluna por causa disso. */
    <View
      style={[
        styles.base,
        { borderRadius: radius, borderColor: destaque ? Colors.borderHot : Colors.border, padding },
        Elevacao[nivel],
        style,
      ]}
      {...props}
    >
      {/* `zIndex: -1` e fundo do próprio degradê.
          No react-native-web, filho ESTÁTICO é pintado abaixo de irmão
          POSICIONADO, independente da ordem no código. Com o degradê em
          `absoluteFill` sem z-index, ele cobria o conteúdo — e num círculo com
          um só ícone dentro, o ícone simplesmente sumia. Jogando a camada
          decorativa para trás e deixando ela carregar a cor de fundo, o
          conteúdo volta a ficar por cima nas duas plataformas. */}
      <LinearGradient
        colors={[Colors.bg2, Colors.bg1]}
        style={[StyleSheet.absoluteFill, { borderRadius: radius, zIndex: -1 }]}
      />
      {/* O fio de luz na aresta de cima. Fica DENTRO do raio, por isso a
          margem lateral: sem ela a linha atravessa o canto arredondado e
          aparece um risco fora da curva. */}
      <View
        pointerEvents="none"
        style={[styles.luz, { top: 0, left: radius * 0.6, right: radius * 0.6 }]}
      />
      {/* eslint-disable-next-line */}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    /* Sem cor aqui: quem pinta é o degradê atrás, senão ele ficaria escondido
       pelo próprio fundo do card. */
    backgroundColor: 'transparent',
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  luz: {
    position: 'absolute',
    height: 1,
    backgroundColor: Colors.luzTopo,
  },
});
