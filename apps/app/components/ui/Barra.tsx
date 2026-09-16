import { View, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors } from '@/constants/tokens';

/* Fundo da barra de abas.
 *
 * Não usa `expo-blur`: desfoque de verdade custa caro em aparelho antigo e,
 * sobre um fundo quase preto, quase não se distingue de um degradê opaco. O
 * que a barra realmente precisa é não ter uma aresta dura contra o conteúdo,
 * e isso um degradê que sobe para transparente resolve.
 */
export function BlurViewFallback() {
  return (
    <View style={StyleSheet.absoluteFill}>
      <LinearGradient
        colors={['rgba(10,8,7,0.72)', 'rgba(10,8,7,0.96)', Colors.bg0]}
        locations={[0, 0.4, 1]}
        style={StyleSheet.absoluteFill}
      />
    </View>
  );
}
