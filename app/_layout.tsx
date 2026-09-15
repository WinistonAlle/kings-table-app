import { useEffect } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
/* Três famílias, três papéis, e nada além disso.
   - Sora: a voz da marca nos títulos. Geométrica e SEM SERIFA — substituiu a
     Cormorant Garamond, que era uma garalda de corpo de texto e sumia em
     título grande sobre preto. Só os pesos cheios (600/700/800): num sistema
     preto e dourado é a massa da letra que devolve o brilho do ouro, e letra
     fina deixa o dourado virar um fio.
   - Inter Tight: interface. Legível em 10px, some de vista quando deve.
   - DM Mono: algarismos. Substituiu a JetBrains Mono, que é fonte de editor de
     código — num produto que se vende como clube privado, ela denuncia a
     origem. A DM Mono é geométrica e leve, com o mesmo passo fixo que impede o
     relógio de tremer a cada segundo. */
import { useFonts } from 'expo-font';
import {
  Sora_600SemiBold,
  Sora_700Bold,
  Sora_800ExtraBold,
} from '@expo-google-fonts/sora';
import {
  InterTight_400Regular,
  InterTight_500Medium,
  InterTight_600SemiBold,
  InterTight_700Bold,
} from '@expo-google-fonts/inter-tight';
import {
  DMMono_300Light,
  DMMono_400Regular,
  DMMono_500Medium,
} from '@expo-google-fonts/dm-mono';
import * as SplashScreen from 'expo-splash-screen';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    Sora_600SemiBold,
    Sora_700Bold,
    Sora_800ExtraBold,
    InterTight_400Regular,
    InterTight_500Medium,
    InterTight_600SemiBold,
    InterTight_700Bold,
    DMMono_300Light,
    DMMono_400Regular,
    DMMono_500Medium,
  });

  useEffect(() => {
    if (fontsLoaded) SplashScreen.hideAsync();
  }, [fontsLoaded]);

  if (!fontsLoaded) return null;

  return (
    <>
      <StatusBar style="light" />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: '#0a0807' } }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="blinds/[id]" options={{ presentation: 'fullScreenModal' }} />
        <Stack.Screen name="display/[id]" />
        <Stack.Screen name="tournament/create" options={{ presentation: 'modal' }} />
        <Stack.Screen name="tournament/[id]" />
      </Stack>
    </>
  );
}
