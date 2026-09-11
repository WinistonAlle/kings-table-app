import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { BlindLevel } from '@/types';
import { armazenamento } from '@/lib/armazenamento';
import { iniciar, irParaNivel, pausar, sincronizar, type EstadoRelogio } from '@/lib/timer';

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

interface BlindsStore extends EstadoRelogio {
  structure: BlindLevel[];

  setStructure: (s: BlindLevel[]) => void;
  start: () => void;
  pause: () => void;
  /** Recalcula a partir do relógio. Substituiu o antigo `tick` de -1s. */
  sync: () => void;
  /** Mantido pelo nome antigo: a tela chama isto uma vez por segundo. */
  tick: () => void;
  nextLevel: () => void;
  prevLevel: () => void;
  reset: () => void;
  setLevel: (level: number) => void;
}

/* O tempo restante é sempre derivado da âncora (`levelEndsAt`). O campo
   `secondsRemaining` existe pra tela ter o que desenhar e pra guardar a
   verdade enquanto está pausado — nunca é decrementado na mão. */
export const useBlindsStore = create<BlindsStore>()(
  persist(
    (set, get) => ({
      structure: DEFAULT_STRUCTURE,
      currentLevel: 0,
      secondsRemaining: DEFAULT_STRUCTURE[0].durationMinutes * 60,
      levelEndsAt: null,
      isRunning: false,

      setStructure: (structure) =>
        set({
          structure,
          currentLevel: 0,
          secondsRemaining: (structure[0]?.durationMinutes ?? 0) * 60,
          levelEndsAt: null,
          isRunning: false,
        }),

      start: () => set(iniciar(get())),
      pause: () => set(pausar(get().structure, get())),
      sync: () => set(sincronizar(get().structure, get())),
      tick: () => set(sincronizar(get().structure, get())),

      nextLevel: () => set(irParaNivel(get().structure, get(), get().currentLevel + 1)),
      prevLevel: () => set(irParaNivel(get().structure, get(), get().currentLevel - 1)),
      setLevel: (level) => set(irParaNivel(get().structure, get(), level)),

      reset: () =>
        set({
          currentLevel: 0,
          secondsRemaining: (get().structure[0]?.durationMinutes ?? 0) * 60,
          levelEndsAt: null,
          isRunning: false,
        }),
    }),
    {
      name: 'kt-blinds',
      storage: armazenamento,
      /* Ao voltar do disco, o que estava guardado é de antes de o app fechar.
         Sincronizar aqui é o que faz reabrir o app no meio do torneio cair no
         nível certo, em vez de retomar de onde o último quadro parou. */
      onRehydrateStorage: () => (estado) => estado?.sync(),
    },
  ),
);

export const BLIND_PRESETS: Record<string, BlindLevel[]> = {
  deep: DEFAULT_STRUCTURE.map(l => ({ ...l, durationMinutes: 30 })),
  regular: DEFAULT_STRUCTURE,
  turbo: DEFAULT_STRUCTURE.map(l => ({ ...l, durationMinutes: 10 })),
  hyper: DEFAULT_STRUCTURE.map(l => ({ ...l, durationMinutes: 5 })),
};
