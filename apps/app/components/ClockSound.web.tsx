import { useState, useSyncExternalStore } from 'react';
import { View, Switch } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useBlindsStore } from '@/stores/blindsStore';
import { useTournamentStore } from '@/stores/tournamentStore';
import { clockAlert } from '@/lib/clock-alerts';
import { Colors } from '@/constants/tokens';
import { KTText } from './ui/Text';
import { KTButton } from './ui/Button';

let context: AudioContext | null = null;
let enabled = false;
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

export function ClockSound() {
  const active = useSyncExternalStore(subscribe, () => enabled, () => false);
  const [error, setError] = useState('');
  async function activate(test = false) {
    try {
      if (!context) context = new AudioContext();
      await context.resume();
      if (context.state !== 'running') throw new Error('Audio bloqueado');
      setError('');
      if (!enabled) {
        enabled = true;
        unsubscribe = useBlindsStore.subscribe((next, previous) => {
          const tournament = useTournamentStore.getState().tournaments.find(t => t.id === next.tournamentId);
          if (tournament?.status !== 'running' || document.visibilityState !== 'visible') return;
          const event = clockAlert(previous, next);
          if (event) tone(event === 'minute' ? 1 : event === 'end' ? 3 : 2);
        });
        notify();
      }
      if (test) tone(2);
    } catch { setError('Não foi possível ativar o áudio. Confira as permissões do navegador.'); }
  }
  return <View style={{ gap: 8, alignItems: 'center' }}>
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
      <Ionicons name={active ? 'volume-high-outline' : 'volume-mute-outline'} size={20} color={Colors.gold300} />
      <KTText papel="apoio">Avisos sonoros</KTText>
      <Switch accessibilityLabel="Ativar avisos sonoros" value={active} onValueChange={value => {
        if (value) void activate(true);
        else { enabled = false; unsubscribe?.(); unsubscribe = null; notify(); }
      }} trackColor={{ false: Colors.bg3, true: Colors.gold700 }} thumbColor={Colors.gold200} />
      {active && <KTButton label="Testar som" size="sm" variant="fantasma" onPress={() => void activate(true)} />}
    </View>
    {!!error && <KTText papel="apoio" color={Colors.warn} accessibilityRole="alert">{error}</KTText>}
  </View>;
}
