import { useState, useSyncExternalStore } from 'react';
import { View, Switch } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useBlindsStore } from '@/stores/blindsStore';
import { useTournamentStore } from '@/stores/tournamentStore';
import { clockAlert } from '@/lib/clock-alerts';
import { clockAnnouncement } from '@/lib/clock-announcement';
import { Colors } from '@/constants/tokens';
import { KTText } from './ui/Text';
import { KTButton } from './ui/Button';

let context: AudioContext | null = null;
let soundEnabled = false;
let voiceEnabled = false;
let voiceError = '';
let unsubscribe: (() => void) | null = null;
const listeners = new Set<() => void>();
const subscribe = (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; };
const notify = () => listeners.forEach(listener => listener());
function tone(count = 1) {
  if (!context || context.state !== 'running') return;
  for (let i = 0; i < count; i++) {
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    const at = context.currentTime + i * 0.28;
    oscillator.type = 'sine'; oscillator.frequency.value = i % 2 ? 660 : 880;
    gain.gain.setValueAtTime(0, at);
    gain.gain.linearRampToValueAtTime(0.12, at + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, at + 0.18);
    oscillator.connect(gain); gain.connect(context.destination);
    oscillator.start(at); oscillator.stop(at + 0.2);
    oscillator.onended = () => { oscillator.disconnect(); gain.disconnect(); };
  }
}

function speak(message: string) {
  try {
    const utterance = new SpeechSynthesisUtterance(message);
    utterance.lang = 'pt-BR';
    utterance.rate = 0.92;
    const voice = window.speechSynthesis.getVoices().find(item => item.lang.toLowerCase() === 'pt-br');
    if (voice) utterance.voice = voice;
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utterance);
  } catch {
    voiceEnabled = false;
    voiceError = 'A voz parou de funcionar neste navegador. Tente ativá-la novamente.';
    updateSubscription();
  }
}

function updateSubscription() {
  if ((soundEnabled || voiceEnabled) && !unsubscribe) {
    unsubscribe = useBlindsStore.subscribe((next, previous) => {
      const tournament = useTournamentStore.getState().tournaments.find(t => t.id === next.tournamentId);
      if (tournament?.status !== 'running' || document.visibilityState !== 'visible') return;
      const event = clockAlert(previous, next);
      if (!event) return;
      if (soundEnabled) tone(event === 'minute' ? 1 : event === 'end' ? 3 : 2);
      if (voiceEnabled) {
        const message = clockAnnouncement(event, next, next.structure);
        if (message) speak(message);
      }
    });
  } else if (!soundEnabled && !voiceEnabled && unsubscribe) {
    unsubscribe();
    unsubscribe = null;
  }
  notify();
}

export function ClockSound() {
  const sound = useSyncExternalStore(subscribe, () => soundEnabled, () => false);
  const voice = useSyncExternalStore(subscribe, () => voiceEnabled, () => false);
  const voiceFailure = useSyncExternalStore(subscribe, () => voiceError, () => '');
  const [error, setError] = useState('');
  async function activateSound() {
    try {
      if (!context) context = new AudioContext();
      await context.resume();
      if (context.state !== 'running') throw new Error('Audio bloqueado');
      setError('');
      soundEnabled = true;
      updateSubscription();
      tone(2);
    } catch { setError('Não foi possível ativar o áudio. Confira as permissões do navegador.'); }
  }
  function activateVoice() {
    if (!('speechSynthesis' in window) || !('SpeechSynthesisUtterance' in window)) {
      voiceError = 'Este navegador não oferece anúncios por voz.';
      notify();
      return;
    }
    setError('');
    voiceError = '';
    voiceEnabled = true;
    updateSubscription();
    speak('Avisos por voz ativados.');
  }
  return <View style={{ gap: 8, alignItems: 'center' }}>
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
      <Ionicons name={sound ? 'volume-high-outline' : 'volume-mute-outline'} size={20} color={Colors.gold300} />
      <KTText papel="apoio">Avisos sonoros</KTText>
      <Switch accessibilityLabel="Ativar avisos sonoros" value={sound} onValueChange={value => {
        if (value) void activateSound();
        else { soundEnabled = false; updateSubscription(); }
      }} trackColor={{ false: Colors.bg3, true: Colors.gold700 }} thumbColor={Colors.gold200} />
      {sound && <KTButton label="Testar som" size="sm" variant="fantasma" onPress={() => tone(2)} />}
    </View>
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
      <Ionicons name="mic-outline" size={20} color={Colors.gold300} />
      <KTText papel="apoio">Anunciar blinds</KTText>
      <Switch accessibilityLabel="Ativar anúncios por voz" value={voice} onValueChange={value => {
        if (value) activateVoice();
        else { voiceEnabled = false; voiceError = ''; window.speechSynthesis?.cancel(); updateSubscription(); }
      }} trackColor={{ false: Colors.bg3, true: Colors.gold700 }} thumbColor={Colors.gold200} />
      {voice && <KTButton label="Testar voz" size="sm" variant="fantasma" onPress={() => speak('Próximo nível em breve.')} />}
    </View>
    {!!(error || voiceFailure) && <KTText papel="apoio" color={Colors.warn} accessibilityRole="alert">{error || voiceFailure}</KTText>}
  </View>;
}
