import { Alert, Platform } from 'react-native';

export function confirmarAcao(title: string, action: () => void) {
  if (Platform.OS === 'web') { if (window.confirm(title)) action(); }
  else Alert.alert(title, undefined, [{ text: 'Voltar', style: 'cancel' }, { text: 'Confirmar', onPress: action }]);
}
