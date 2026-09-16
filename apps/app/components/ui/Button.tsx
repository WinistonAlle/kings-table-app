import { Pressable, View, StyleSheet, useWindowDimensions, type ViewStyle } from 'react-native';
import { Colors, Radius, Space } from '@/constants/tokens';
import { KTText } from './Text';
import { SpecularRim } from './SpecularRim';

/* Preenchimento fosco e solido; o brilho fica apenas na borda. */

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
  const compact = useWindowDimensions().width < 600;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!disabled }}
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.base,
        {
          minHeight: compact ? Math.max(44, ALTURAS[size]) : ALTURAS[size],
          paddingVertical: 10,
          paddingHorizontal: LADOS[size],
          alignSelf: fullWidth ? 'stretch' : 'flex-start',
          opacity: disabled ? 0.4 : 1,
          /* Afunda 1px e encolhe de leve: o toque tem que parecer peso. */
          transform: [{ translateY: pressed ? 1 : 0 }, { scale: pressed ? 0.985 : 1 }],
        },
        variant === 'fantasma' && styles.fantasma,
        variant === 'perigo' && styles.perigo,
        ouro && styles.ouro,
        style,
      ]}
    >
      {!disabled && <SpecularRim danger={variant === 'perigo'} />}

      <View style={styles.conteudo}>
        {icone}
        <KTText
          papel="corpoForte"
          size={compact ? Math.max(14, CORPOS[size] + 1) : CORPOS[size]}
          color={ouro ? Colors.bg0 : variant === 'perigo' ? Colors.danger : Colors.text0}
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
    borderRadius: Radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'visible',
  },
  ouro: { backgroundColor: Colors.gold300, borderWidth: 1, borderColor: Colors.gold300 },
  fantasma: { borderWidth: 1, borderColor: Colors.borderStrong, backgroundColor: Colors.bg1 },
  perigo:   { borderWidth: 1, borderColor: 'rgba(200,90,90,0.4)', backgroundColor: 'rgba(200,90,90,0.06)' },
  conteudo: { flexDirection: 'row', alignItems: 'center', gap: Space.sm, zIndex: 2, maxWidth: '100%' },
  rotulo:   { letterSpacing: 0, flexShrink: 1, textAlign: 'center' },
});
