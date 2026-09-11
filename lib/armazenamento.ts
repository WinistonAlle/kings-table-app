import AsyncStorage from '@react-native-async-storage/async-storage';
import { createJSONStorage } from 'zustand/middleware';

/* Onde o estado do app sobrevive ao app fechar.
 *
 * É AsyncStorage e não MMKV, apesar de o MMKV estar no package.json e ser mais
 * rápido: o MMKV 4 é módulo nativo com Nitro e exige build própria. Este
 * projeto não tem `expo-dev-client`, ou seja, roda no Expo Go, onde importar
 * MMKV quebra na hora. AsyncStorage funciona nos dois mundos.
 *
 * Se um dia houver build própria, trocar é mudar só este arquivo.
 */
export const armazenamento = createJSONStorage(() => AsyncStorage);
