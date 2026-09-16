import { View, StyleSheet } from 'react-native';

export function SpecularRim({ danger = false }: { danger?: boolean }) {
  return <View pointerEvents="none" style={[StyleSheet.absoluteFill, { borderRadius: 8, borderWidth: 1, borderColor: danger ? 'rgba(200,90,90,.5)' : 'rgba(227,203,166,.35)' }]} />;
}
