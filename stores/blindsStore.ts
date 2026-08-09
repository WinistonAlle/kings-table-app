import { create } from 'zustand';
import { BlindLevel } from '@/types';

const DEFAULT_STRUCTURE: BlindLevel[] = [
  { level: 1,  smallBlind: 25,   bigBlind: 50,   ante: 0,    durationMinutes: 20 },
  { level: 2,  smallBlind: 50,   bigBlind: 100,  ante: 0,    durationMinutes: 20 },
  { level: 3,  smallBlind: 75,   bigBlind: 150,  ante: 25,   durationMinutes: 20 },
  { level: 4,  smallBlind: 100,  bigBlind: 200,  ante: 25,   durationMinutes: 20 },
  { level: 5,  smallBlind: 150,  bigBlind: 300,  ante: 50,   durationMinutes: 20 },
  { level: 6,  smallBlind: 200,  bigBlind: 400,  ante: 50,   durationMinutes: 15 },
  { level: 7,  smallBlind: 300,  bigBlind: 600,  ante: 75,   durationMinutes: 15 },
  { level: 8,  smallBlind: 400,  bigBlind: 800,  ante: 100,  durationMinutes: 15 },
  { level: 9,  smallBlind: 500,  bigBlind: 1000, ante: 100,  durationMinutes: 15 },
  { level: 10, smallBlind: 600,  bigBlind: 1200, ante: 200,  durationMinutes: 12 },
  { level: 11, smallBlind: 800,  bigBlind: 1600, ante: 200,  durationMinutes: 12 },
  { level: 12, smallBlind: 1000, bigBlind: 2000, ante: 300,  durationMinutes: 12 },
  { level: 13, smallBlind: 1500, bigBlind: 3000, ante: 400,  durationMinutes: 10 },
  { level: 14, smallBlind: 2000, bigBlind: 4000, ante: 500,  durationMinutes: 10 },
  { level: 15, smallBlind: 3000, bigBlind: 6000, ante: 1000, durationMinutes: 10 },
];

interface BlindsStore {
  structure: BlindLevel[];
  currentLevel: number;
  secondsRemaining: number;
  isRunning: boolean;
  totalElapsed: number;

  setStructure: (s: BlindLevel[]) => void;
  start: () => void;
  pause: () => void;
  tick: () => void;
  nextLevel: () => void;
  prevLevel: () => void;
  reset: () => void;
  setLevel: (level: number) => void;
}

export const useBlindsStore = create<BlindsStore>((set, get) => ({
  structure: DEFAULT_STRUCTURE,
  currentLevel: 0,
  secondsRemaining: DEFAULT_STRUCTURE[0].durationMinutes * 60,
  isRunning: false,
  totalElapsed: 0,

  setStructure: (structure) =>
    set({ structure, currentLevel: 0, secondsRemaining: structure[0].durationMinutes * 60, isRunning: false }),

  start: () => set({ isRunning: true }),
  pause: () => set({ isRunning: false }),

  tick: () => {
    const { secondsRemaining, currentLevel, structure, totalElapsed, isRunning } = get();
    if (!isRunning) return;
    if (secondsRemaining > 0) {
      set({ secondsRemaining: secondsRemaining - 1, totalElapsed: totalElapsed + 1 });
    } else {
      const nextLevel = currentLevel + 1;
      if (nextLevel < structure.length) {
        set({
          currentLevel: nextLevel,
          secondsRemaining: structure[nextLevel].durationMinutes * 60,
          totalElapsed: totalElapsed + 1,
        });
      } else {
        set({ isRunning: false });
      }
    }
  },

  nextLevel: () => {
    const { currentLevel, structure } = get();
    const next = currentLevel + 1;
    if (next < structure.length) {
      set({ currentLevel: next, secondsRemaining: structure[next].durationMinutes * 60 });
    }
  },

  prevLevel: () => {
    const { currentLevel, structure } = get();
    const prev = Math.max(0, currentLevel - 1);
    set({ currentLevel: prev, secondsRemaining: structure[prev].durationMinutes * 60 });
  },

  reset: () => {
    const { structure } = get();
    set({ currentLevel: 0, secondsRemaining: structure[0].durationMinutes * 60, isRunning: false, totalElapsed: 0 });
  },

  setLevel: (level) => {
    const { structure } = get();
    if (level >= 0 && level < structure.length) {
      set({ currentLevel: level, secondsRemaining: structure[level].durationMinutes * 60 });
    }
  },
}));

export const BLIND_PRESETS: Record<string, BlindLevel[]> = {
  deep: DEFAULT_STRUCTURE.map(l => ({ ...l, durationMinutes: 30 })),
  regular: DEFAULT_STRUCTURE,
  turbo: DEFAULT_STRUCTURE.map(l => ({ ...l, durationMinutes: 10 })),
  hyper: DEFAULT_STRUCTURE.map(l => ({ ...l, durationMinutes: 5 })),
};
