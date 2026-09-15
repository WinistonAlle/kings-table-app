import { View, StyleSheet } from 'react-native';
import Svg, { Path, Circle, Defs, LinearGradient as SvgGradient, Stop } from 'react-native-svg';
import { Colors, Space } from '@/constants/tokens';

/* Ornamento.
 *
 * A diferença entre "app escuro com detalhe dourado" e "clube" está aqui. São
 * marcas pequenas, usadas com parcimônia, que dizem de onde o produto vem:
 * naipe, coroa, e o filete com losango no meio, que é o mesmo recurso de um
 * convite gravado ou de um verso de carta.
 *
 * Regra de uso: no máximo um ornamento por bloco. Ornamento repetido vira
 * padronagem, e padronagem cansa.
 */

type Naipe = 'espada' | 'copas' | 'ouros' | 'paus';

const CAMINHOS: Record<Naipe, string> = {
  espada: 'M12 2C12 2 5 8.5 5 13a4.2 4.2 0 0 0 6.2 3.7c-.2 1.9-.8 3.4-2.2 4.3h6c-1.4-.9-2-2.4-2.2-4.3A4.2 4.2 0 0 0 19 13c0-4.5-7-11-7-11z',
  copas:  'M12 21L3.8 12.8C-1 8 5.4 1 10.2 5.8L12 7.6l1.8-1.8C18.6 1 25 8 20.2 12.8L12 21z',
  ouros:  'M12 2l7 10-7 10-7-10 7-10z',
  paus:   'M12 2a4 4 0 0 0-3.5 6A4.5 4.5 0 1 0 11 15.7c-.1 2.5-.8 4.2-2 5.3h6c-1.2-1.1-1.9-2.8-2-5.3A4.5 4.5 0 1 0 15.5 8 4 4 0 0 0 12 2z',
};

export function Naipe({
  tipo = 'espada',
  tamanho = 16,
  cor = Colors.gold300,
  opacidade = 1,
}: {
  tipo?: Naipe;
  tamanho?: number;
  cor?: string;
  opacidade?: number;
}) {
  return (
    <Svg width={tamanho} height={tamanho} viewBox="0 0 24 24" opacity={opacidade} style={{ flexShrink: 0 }} pointerEvents="none">
      <Path d={CAMINHOS[tipo]} fill={cor} />
    </Svg>
  );
}

export function Coroa({ tamanho = 20, cor = Colors.gold300 }: { tamanho?: number; cor?: string }) {
  return (
    <Svg width={tamanho} height={tamanho} viewBox="0 0 24 24">
      <Path
        d="M3 8l3.6 3L12 4.5 17.4 11 21 8l-1.7 10.5H4.7L3 8z"
        fill="none"
        stroke={cor}
        strokeWidth={1.4}
        strokeLinejoin="round"
      />
      <Circle cx="12" cy="20.6" r="0.9" fill={cor} />
    </Svg>
  );
}

/**
 * Filete com losango ao centro.
 *
 * A linha não tem espessura constante: ela nasce transparente nas pontas e
 * ganha corpo no meio. Um traço de ponta a ponta com opacidade fixa parece
 * divisória de formulário; este parece gravação.
 */
export function Filete({ largura = 120, cor = Colors.gold500 }: { largura?: number; cor?: string }) {
  return (
    <View style={styles.fileteWrap}>
      <Svg width={largura} height={9} viewBox={`0 0 ${largura} 9`}>
        <Defs>
          <SvgGradient id="filete" x1="0" y1="0" x2="1" y2="0">
            <Stop offset="0" stopColor={cor} stopOpacity="0" />
            <Stop offset="0.5" stopColor={cor} stopOpacity="0.85" />
            <Stop offset="1" stopColor={cor} stopOpacity="0" />
          </SvgGradient>
        </Defs>
        <Path d={`M0 4.5 H${largura}`} stroke="url(#filete)" strokeWidth={1} />
        <Path
          d={`M${largura / 2} 0.8 L${largura / 2 + 3.6} 4.5 L${largura / 2} 8.2 L${largura / 2 - 3.6} 4.5 Z`}
          fill={cor}
        />
      </Svg>
    </View>
  );
}

/** Rótulo de seção: filete curto, texto em caixa alta, filete curto. */
export function TituloSecao({ children }: { children: React.ReactNode }) {
  return (
    <View style={styles.secao}>
      <View style={styles.secaoLinha} />
      {children}
      <View style={styles.secaoLinha} />
    </View>
  );
}

const styles = StyleSheet.create({
  fileteWrap: { alignItems: 'center', justifyContent: 'center' },
  secao: { flexDirection: 'row', alignItems: 'center', gap: Space.md },
  secaoLinha: { flex: 1, height: StyleSheet.hairlineWidth, backgroundColor: Colors.border },
});
