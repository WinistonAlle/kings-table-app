import { Pressable, View, StyleSheet, type ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors, Degrade, Elevacao, Fonts, Radius, Space, Type } from '@/constants/tokens';
import { KTText } from './Text';

/* Botão.
 *
 * O ouro antigo era `backgroundColor: gold200` — um retângulo amarelo chapado.
 * Metal não é uma cor só: é claro onde a luz bate e escuro onde ela sai. Aqui
 * o preenchimento é degradê de cima para baixo, com um fio branco na aresta
 * superior e um fio escuro na inferior. São três detalhes de 1px que decidem
 * se a peça parece uma ficha ou um retângulo pintado.
 *
 * `Pressable` no lugar de `TouchableOpacity` para o toque afundar o botão em
 * vez de apagá-lo: sumir 30% da opacidade é resposta de link, não de peça
 * física.
 */

type Variante = 'ouro' | 'fantasma' | 'perigo';
type Tamanho = 'sm' | 'md' | 'lg';

const ALTURAS: Record<Tamanho, number> = { sm: 38, md: 50, lg: 58 };
const CORPOS: Record<Tamanho, number> = { sm: 13, md: 15, lg: 16 };
const LADOS: Record<Tamanho, number> = { sm: Space.lg, md: Space.xl, lg: Space.xxl };

interface ButtonProps {
  label: string;
  onPress: () => void;
  variant?: Variante;
  size?: Tamanho;
  disabled?: boolean;
  fullWidth?: boolean;
  style?: ViewStyle;
  /** Ícone à esquerda do rótulo. */
  icone?: React.ReactNode;
}

export function KTButton({
  label,
  onPress,
  variant = 'ouro',
  size = 'md',
  disabled,
  fullWidth,
  style,
  icone,
}: ButtonProps) {
  const ouro = variant === 'ouro';

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.base,
        {
          height: ALTURAS[size],
          paddingHorizontal: LADOS[size],
          alignSelf: fullWidth ? 'stretch' : 'flex-start',
          opacity: disabled ? 0.4 : 1,
          /* Afunda 1px e encolhe de leve: o toque tem que parecer peso. */
          transform: [{ translateY: pressed ? 1 : 0 }, { scale: pressed ? 0.985 : 1 }],
        },
        variant === 'fantasma' && styles.fantasma,
        variant === 'perigo' && styles.perigo,
        ouro && Elevacao.card,
        style,
      ]}
    >
      {ouro ? (
        <>
          <LinearGradient colors={Degrade.ouro} style={StyleSheet.absoluteFill} />
          {/* Aresta de cima: onde a luz bate. */}
          <View pointerEvents="none" style={[styles.aresta, styles.arestaTopo]} />
          {/* Aresta de baixo: onde ela sai. */}
          <View pointerEvents="none" style={[styles.aresta, styles.arestaBase]} />
        </>
      ) : null}

      <View style={styles.conteudo}>
        {icone}
        <KTText
          papel="corpoForte"
          size={CORPOS[size]}
          color={ouro ? '#1a1206' : variant === 'perigo' ? Colors.danger : Colors.text0}
          style={styles.rotulo}
        >
          {label}
        </KTText>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: Radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  fantasma: { borderWidth: StyleSheet.hairlineWidth, borderColor: Colors.borderStrong },
  perigo:   { borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(200,90,90,0.4)' },
  conteudo: { flexDirection: 'row', alignItems: 'center', gap: Space.sm },
  rotulo:   { letterSpacing: 0.2 },
  aresta:   { position: 'absolute', left: 0, right: 0, height: 1 },
  arestaTopo: { top: 0, backgroundColor: 'rgba(255,255,255,0.45)' },
  arestaBase: { bottom: 0, backgroundColor: 'rgba(0,0,0,0.18)' },
});
