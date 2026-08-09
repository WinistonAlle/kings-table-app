import { useEffect, useRef, useState } from 'react';
import { View, TouchableOpacity, StyleSheet, Dimensions, Animated } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Fonts, Radius } from '@/constants/tokens';
import { KTText } from '@/components/ui/Text';
import { useBlindsTimer } from '@/hooks/useBlindsTimer';
import { useTournamentStore } from '@/stores/tournamentStore';

const { width, height } = Dimensions.get('window');
const W = Math.max(width, height);
const H = Math.min(width, height);

export default function BlindsScreen() {
  const params = useLocalSearchParams<{ id?: string }>();
  const tournamentId = typeof params.id === 'string' ? params.id : undefined;
  const { structure, currentLevel, secondsRemaining, isRunning, start, pause, nextLevel, prevLevel, reset } = useBlindsTimer();
  const activeTournament = useTournamentStore((s) =>
    s.tournaments.find((t) => t.id === (tournamentId ?? s.activeTournamentId))
  );

  const current = structure[currentLevel];
  const next = structure[currentLevel + 1];
  const totalSeconds = current ? current.durationMinutes * 60 : 1;
  const progress = 1 - secondsRemaining / totalSeconds;

  // Flash animation on level change
  const flashAnim = useRef(new Animated.Value(0)).current;
  const prevLevelRef = useRef(currentLevel);
  const [showLevelUp, setShowLevelUp] = useState(false);

  useEffect(() => {
    if (prevLevelRef.current !== currentLevel) {
      prevLevelRef.current = currentLevel;
      setShowLevelUp(true);
      Animated.sequence([
        Animated.timing(flashAnim, { toValue: 1, duration: 200, useNativeDriver: true }),
        Animated.timing(flashAnim, { toValue: 0, duration: 800, useNativeDriver: true }),
      ]).start(() => setShowLevelUp(false));
    }
  }, [currentLevel]);

  // Warning colors
  const isWarning = secondsRemaining <= 60;
  const isDanger = secondsRemaining <= 30;
  const timeColor = isDanger ? Colors.danger : isWarning ? Colors.warn : Colors.text0;

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60).toString().padStart(2, '0');
    const s = (secs % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  const formatBlind = (n: number) => {
    if (n >= 1000) return `${(n / 1000).toFixed(n % 1000 === 0 ? 0 : 1)}K`;
    return n.toString();
  };

  // Radial progress ring (SVG-like via border trick)
  const RING_SIZE = Math.min(H * 0.58, 260);
  const ringProgress = progress;

  return (
    <View style={styles.container}>
      {/* Background vignette */}
      <View style={styles.vignette} pointerEvents="none" />

      {/* Level-up flash overlay */}
      {showLevelUp && (
        <Animated.View style={[styles.flashOverlay, { opacity: flashAnim }]} pointerEvents="none">
          <KTText variant="display" size={48} color={Colors.gold200}>
            Level {currentLevel + 1}
          </KTText>
        </Animated.View>
      )}

      {/* Close button */}
      <TouchableOpacity style={styles.closeBtn} onPress={() => router.back()}>
        <Ionicons name="chevron-down" size={20} color={Colors.text2} />
      </TouchableOpacity>

      {/* Main 3-column layout */}
      <View style={styles.main}>

        {/* LEFT — current blinds */}
        <View style={styles.sidePanel}>
          <KTText variant="label" color={Colors.text2} style={styles.panelLabel}>NOW PLAYING</KTText>
          <KTText variant="label" color={Colors.text2} style={{ marginTop: 16 }}>LEVEL</KTText>
          <KTText variant="monoBold" size={40} color={Colors.gold200} style={{ marginTop: 2 }}>
            {currentLevel + 1}
          </KTText>
          <View style={styles.dividerH} />
          <KTText variant="label" color={Colors.text2}>SMALL BLIND</KTText>
          <KTText variant="monoBold" size={28} color={Colors.text0} style={{ marginTop: 2 }}>
            {current ? formatBlind(current.smallBlind) : '—'}
          </KTText>
          <View style={styles.dividerH} />
          <KTText variant="label" color={Colors.text2}>BIG BLIND</KTText>
          <KTText variant="monoBold" size={28} color={Colors.text0} style={{ marginTop: 2 }}>
            {current ? formatBlind(current.bigBlind) : '—'}
          </KTText>
          {current?.ante > 0 && (
            <>
              <View style={styles.dividerH} />
              <KTText variant="label" color={Colors.warn}>ANTE</KTText>
              <KTText variant="monoBold" size={24} color={Colors.warn} style={{ marginTop: 2 }}>
                {formatBlind(current.ante)}
              </KTText>
            </>
          )}
        </View>

        {/* CENTER — clock */}
        <View style={styles.center}>
          {/* Ornamental top flourish */}
          <KTText variant="display" size={20} color={Colors.gold600} style={{ letterSpacing: 8 }}>
            ◆ ♠ ◆
          </KTText>

          {/* Time display */}
          <KTText
            variant="monoBold"
            size={RING_SIZE * 0.42}
            color={timeColor}
            style={[styles.timerNum, isWarning && styles.timerWarn]}
          >
            {formatTime(secondsRemaining)}
          </KTText>

          {/* Progress bar */}
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${progress * 100}%` as any, backgroundColor: isDanger ? Colors.danger : isWarning ? Colors.warn : Colors.gold400 }]} />
          </View>

          {/* Controls */}
          <View style={styles.controls}>
            <TouchableOpacity style={styles.controlBtn} onPress={prevLevel}>
              <Ionicons name="play-skip-back" size={22} color={Colors.text1} />
            </TouchableOpacity>

            <TouchableOpacity style={styles.playBtn} onPress={isRunning ? pause : start}>
              <Ionicons name={isRunning ? 'pause' : 'play'} size={32} color="#1a1206" />
            </TouchableOpacity>

            <TouchableOpacity style={styles.controlBtn} onPress={nextLevel}>
              <Ionicons name="play-skip-forward" size={22} color={Colors.text1} />
            </TouchableOpacity>
          </View>

          {/* Ornamental bottom */}
          <KTText variant="display" size={20} color={Colors.gold600} style={{ letterSpacing: 8, marginTop: 8 }}>
            ◆ ♥ ◆
          </KTText>
        </View>

        {/* RIGHT — next level */}
        <View style={[styles.sidePanel, styles.sidePanelRight]}>
          <KTText variant="label" color={Colors.text2} style={styles.panelLabel}>COMING UP</KTText>
          {next ? (
            <>
              <KTText variant="label" color={Colors.text2} style={{ marginTop: 16 }}>LEVEL</KTText>
              <KTText variant="monoBold" size={40} color={Colors.text2} style={{ marginTop: 2 }}>
                {currentLevel + 2}
              </KTText>
              <View style={styles.dividerH} />
              <KTText variant="label" color={Colors.text2}>SMALL BLIND</KTText>
              <KTText variant="monoBold" size={28} color={Colors.text2} style={{ marginTop: 2 }}>
                {formatBlind(next.smallBlind)}
              </KTText>
              <View style={styles.dividerH} />
              <KTText variant="label" color={Colors.text2}>BIG BLIND</KTText>
              <KTText variant="monoBold" size={28} color={Colors.text2} style={{ marginTop: 2 }}>
                {formatBlind(next.bigBlind)}
              </KTText>
              {next.ante > 0 && (
                <>
                  <View style={styles.dividerH} />
                  <KTText variant="label" color={Colors.text2}>ANTE</KTText>
                  <KTText variant="monoBold" size={24} color={Colors.text2} style={{ marginTop: 2 }}>
                    {formatBlind(next.ante)}
                  </KTText>
                </>
              )}
            </>
          ) : (
            <KTText variant="ui" size={13} color={Colors.text3} style={{ marginTop: 16 }}>
              Último nível
            </KTText>
          )}
        </View>
      </View>

      {/* Tournament name footer */}
      {activeTournament && (
        <TouchableOpacity onPress={() => router.push(`/tournament/${activeTournament.id}` as any)}>
          <KTText variant="label" color={Colors.text3} style={styles.footer}>
            {activeTournament.name.toUpperCase()} · ABRIR MESA
          </KTText>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1, backgroundColor: Colors.bg0,
    alignItems: 'center', justifyContent: 'center',
  },
  vignette: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'transparent',
  },
  flashOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(232,213,160,0.06)',
    alignItems: 'center', justifyContent: 'center',
    zIndex: 100,
  },
  closeBtn: {
    position: 'absolute', top: 52, right: 24,
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: Colors.bg2,
    borderWidth: 1, borderColor: Colors.border,
    alignItems: 'center', justifyContent: 'center',
  },
  main: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 24, gap: 24, width: '100%',
  },
  sidePanel: {
    flex: 1, alignItems: 'flex-start',
    paddingVertical: 8,
  },
  sidePanelRight: { alignItems: 'flex-end' },
  panelLabel: { borderBottomWidth: 1, borderBottomColor: Colors.border, paddingBottom: 6, alignSelf: 'stretch' },
  dividerH: { height: 1, backgroundColor: Colors.border, alignSelf: 'stretch', marginVertical: 12 },

  center: {
    flex: 2, alignItems: 'center', justifyContent: 'center', gap: 4,
  },
  timerNum: { letterSpacing: -3, lineHeight: undefined },
  timerWarn: {},

  progressTrack: {
    width: '80%', height: 3, backgroundColor: Colors.bg3,
    borderRadius: 2, marginTop: 12, overflow: 'hidden',
  },
  progressFill: { height: '100%', borderRadius: 2 },

  controls: { flexDirection: 'row', alignItems: 'center', gap: 20, marginTop: 20 },
  controlBtn: {
    width: 48, height: 48, borderRadius: 24,
    backgroundColor: Colors.bg2,
    borderWidth: 1, borderColor: Colors.borderStrong,
    alignItems: 'center', justifyContent: 'center',
  },
  playBtn: {
    width: 68, height: 68, borderRadius: 34,
    backgroundColor: Colors.gold200,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: Colors.gold200, shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.4, shadowRadius: 16,
  },

  footer: {
    position: 'absolute', bottom: 28, letterSpacing: 3,
  },
});
