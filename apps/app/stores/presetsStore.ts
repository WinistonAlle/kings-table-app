import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { armazenamento } from '@/lib/armazenamento';
import { normalizarEstrutura, validarEstrutura } from '@/lib/estrutura';
import type { BlindLevel } from '@/types';

type Preset = { id: string; name: string; levels: BlindLevel[] };
export const usePresetsStore = create<{ presets: Preset[]; save: (name: string, levels: BlindLevel[]) => boolean; remove: (id: string) => void }>()(persist((set) => ({
  presets: [],
  save: (name, levels) => {
    if (!name.trim() || validarEstrutura(levels)) return false;
    const preset = { id: `estrutura_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`, name: name.trim(), levels: normalizarEstrutura(levels) };
    set(s => ({ presets: [...s.presets, preset] }));
    return true;
  },
  remove: id => set(s => ({ presets: s.presets.filter(p => p.id !== id) })),
}), { name: 'kt-structures', storage: armazenamento }));
