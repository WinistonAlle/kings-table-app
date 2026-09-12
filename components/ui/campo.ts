import { Platform } from 'react-native';

/* O navegador desenha um anel de foco azul em volta de todo campo de texto, e
   ele não tem nada a ver com a paleta do app. No aparelho isso não existe —
   é só no preview web, que é onde a gente julga o visual por enquanto.
   `outlineStyle` não faz parte da tipagem de estilo do React Native, daí o
   cast: é estilo que só o react-native-web lê. */
export const semAnelDeFoco = Platform.OS === 'web'
  ? ({ outlineStyle: 'none' } as unknown as object)
  : {};
