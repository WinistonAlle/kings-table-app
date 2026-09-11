import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { Tournament, TournamentPlayer } from '@/types';
import { armazenamento } from '@/lib/armazenamento';
import { desfazerEliminacao, eliminar } from '@/lib/torneio';

export { emJogo } from '@/lib/torneio';

interface TournamentStore {
  tournaments: Tournament[];
  activeTournamentId: string | null;

  createTournament: (t: Omit<Tournament, 'id' | 'createdAt' | 'status' | 'currentLevel' | 'players'>) => Tournament;
  updateTournament: (id: string, updates: Partial<Tournament>) => void;
  deleteTournament: (id: string) => void;
  setActive: (id: string | null) => void;
  addPlayer: (tournamentId: string, player: Omit<TournamentPlayer, 'id'>) => void;
  removePlayer: (tournamentId: string, playerId: string) => void;
  updatePlayer: (tournamentId: string, playerId: string, updates: Partial<TournamentPlayer>) => void;
  getActiveTournament: () => Tournament | undefined;

  /** Marca o torneio como em andamento. */
  startTournament: (id: string) => void;
  /** Elimina um jogador, atribuindo a posição que sobra. */
  eliminatePlayer: (tournamentId: string, playerId: string) => void;
  /** Desfaz a última eliminação de um jogador (erro de dedo na mesa). */
  undoElimination: (tournamentId: string, playerId: string) => void;
}

export const useTournamentStore = create<TournamentStore>()(
  persist(
    (set, get) => ({
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
        set(s => ({
          tournaments: s.tournaments.filter(t => t.id !== id),
          activeTournamentId: s.activeTournamentId === id ? null : s.activeTournamentId,
        })),

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

      removePlayer: (tournamentId, playerId) =>
        set(s => ({
          tournaments: s.tournaments.map(t =>
            t.id === tournamentId
              ? { ...t, players: t.players.filter(p => p.id !== playerId) }
              : t
          ),
        })),

      updatePlayer: (tournamentId, playerId, updates) =>
        set((s) => ({
          tournaments: s.tournaments.map((t) =>
            t.id === tournamentId
              ? { ...t, players: t.players.map((p) => (p.id === playerId ? { ...p, ...updates } : p)) }
              : t
          ),
        })),

      startTournament: (id) =>
        set(s => ({
          tournaments: s.tournaments.map(t =>
            t.id === id && t.status === 'upcoming' ? { ...t, status: 'running' } : t
          ),
        })),

      eliminatePlayer: (tournamentId, playerId) =>
        set((s) => ({
          tournaments: s.tournaments.map((t) => (t.id === tournamentId ? eliminar(t, playerId) : t)),
        })),

      undoElimination: (tournamentId, playerId) =>
        set((s) => ({
          tournaments: s.tournaments.map((t) =>
            t.id === tournamentId ? desfazerEliminacao(t, playerId) : t,
          ),
        })),

      getActiveTournament: () => {
        const { tournaments, activeTournamentId } = get();
        return tournaments.find(t => t.id === activeTournamentId);
      },
    }),
    { name: 'kt-tournaments', storage: armazenamento },
  ),
);
