import { create } from 'zustand';
import { Tournament, TournamentPlayer, BlindLevel } from '@/types';
import { BLIND_PRESETS } from './blindsStore';

interface TournamentStore {
  tournaments: Tournament[];
  activeTournamentId: string | null;

  createTournament: (t: Omit<Tournament, 'id' | 'createdAt' | 'status' | 'currentLevel' | 'players'>) => Tournament;
  updateTournament: (id: string, updates: Partial<Tournament>) => void;
  deleteTournament: (id: string) => void;
  setActive: (id: string | null) => void;
  addPlayer: (tournamentId: string, player: Omit<TournamentPlayer, 'id'>) => void;
  updatePlayer: (tournamentId: string, playerId: string, updates: Partial<TournamentPlayer>) => void;
  getActiveTournament: () => Tournament | undefined;
}

export const useTournamentStore = create<TournamentStore>((set, get) => ({
  tournaments: [],
  activeTournamentId: null,

  createTournament: (data) => {
    const tournament: Tournament = {
      ...data,
      id: `t_${Date.now()}`,
      status: 'upcoming',
      currentLevel: 0,
      players: [],
      createdAt: new Date().toISOString(),
    };
    set(s => ({ tournaments: [...s.tournaments, tournament] }));
    return tournament;
  },

  updateTournament: (id, updates) =>
    set(s => ({
      tournaments: s.tournaments.map(t => (t.id === id ? { ...t, ...updates } : t)),
    })),

  deleteTournament: (id) =>
    set(s => ({ tournaments: s.tournaments.filter(t => t.id !== id) })),

  setActive: (id) => set({ activeTournamentId: id }),

  addPlayer: (tournamentId, player) => {
    const id = `p_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    set(s => ({
      tournaments: s.tournaments.map(t =>
        t.id === tournamentId
          ? { ...t, players: [...t.players, { ...player, id }] }
          : t
      ),
    }));
  },

  updatePlayer: (tournamentId, playerId, updates) =>
    set((s) => ({
      tournaments: s.tournaments.map((t) =>
        t.id === tournamentId
          ? { ...t, players: t.players.map((p) => (p.id === playerId ? { ...p, ...updates } : p)) }
          : t
      ),
    })),

  getActiveTournament: () => {
    const { tournaments, activeTournamentId } = get();
    return tournaments.find(t => t.id === activeTournamentId);
  },
}));
