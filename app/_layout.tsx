import { useEffect } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
/* Três famílias, três papéis, e nada além disso.
   - Cormorant Garamond: a voz do clube. Serifa old-style de contraste alto,
     que é o que faz parecer convite gravado e não painel de controle. Entra o
     600 além do 500 e do 700: no escuro, o 500 some em corpo grande e o 700
     fecha demais os contra-formas em corpo pequeno.
   - Inter Tight: interface. Legível em 10px, some de vista quando deve.
   - DM Mono: algarismos. Substituiu a JetBrains Mono, que é fonte de editor de
     código — num produto que se vende como clube privado, ela denuncia a
     origem. A DM Mono é geométrica e leve, com o mesmo passo fixo que impede o
     relógio de tremer a cada segundo. */
import { useFonts,
  CormorantGaramond_500Medium,
  CormorantGaramond_500Medium_Italic,
  CormorantGaramond_600SemiBold,
  CormorantGaramond_700Bold,
} from '@expo-google-fonts/cormorant-garamond';
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
    CormorantGaramond_500Medium,
    CormorantGaramond_500Medium_Italic,
    CormorantGaramond_600SemiBold,
    CormorantGaramond_700Bold,
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
        <Stack.Screen name="tournament/create" options={{ presentation: 'modal' }} />
        <Stack.Screen name="tournament/[id]" />
      </Stack>
    </>
  );
}
