import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { Tournament, TournamentPlayer } from '@/types';
import { armazenamento } from '@/lib/armazenamento';
import { desfazerEliminacao, eliminar } from '@/lib/torneio';
import { adicionarConvidado, statusPresenca, vagaParaJogador } from '@/lib/noite';
import type { Attendance } from '@/types';
import { auditar } from '@/lib/auditoria';
import { sortearAssentos, moverAssento, desfazerAssentos } from '@/lib/assentos';

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
  invite: (id: string, name: string, status: Attendance) => void;
  setAttendance: (id: string, guestId: string, status: Attendance) => void;
  removeInvite: (id: string, guestId: string) => void;
  checkIn: (id: string, guestId: string) => void;
  drawSeats: (id: string, size: number) => void;
  moveSeat: (id: string, playerId: string, table: number, seat: number) => void;
  undoSeats: (id: string) => void;

  /** Marca o torneio como em andamento. */
  startTournament: (id: string) => void;
  /** Elimina um jogador, atribuindo a posição que sobra. */
  eliminatePlayer: (tournamentId: string, playerId: string) => void;
  /** Desfaz a última eliminação de um jogador (erro de dedo na mesa). */
  undoElimination: (tournamentId: string, playerId: string) => void;
}

export const useTournamentStore = create<TournamentStore>()(
  persist(
    (rawSet, get) => {
      const set = (update: (state: TournamentStore) => Partial<TournamentStore>) => rawSet(state => {
        const next = update(state);
        return { ...next, ...(next.tournaments ? { tournaments: next.tournaments.map(t => auditar(state.tournaments.find(old => old.id === t.id), t)) } : {}) };
      });
      return ({
      tournaments: [],
      activeTournamentId: null,
      drawSeats: (id, size) => set(s => ({ tournaments: s.tournaments.map(t => t.id === id ? sortearAssentos(t, size) : t) })),
      moveSeat: (id, playerId, table, seat) => set(s => ({ tournaments: s.tournaments.map(t => t.id === id ? moverAssento(t, playerId, table, seat) : t) })),
      undoSeats: (id) => set(s => ({ tournaments: s.tournaments.map(t => t.id === id ? desfazerAssentos(t) : t) })),

      invite: (id, name, status) => set(s => ({ tournaments: s.tournaments.map(t => t.id === id && t.status === 'upcoming' ? adicionarConvidado(t, { id: `i_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`, name, status, createdAt: new Date().toISOString() }) : t) })),
      setAttendance: (id, guestId, status) => set(s => ({ tournaments: s.tournaments.map(t => t.id === id && t.status === 'upcoming' ? { ...t, invitees: (t.invitees ?? []).map(c => c.id === guestId && !c.playerId ? { ...c, status: statusPresenca(t, status, guestId) } : c) } : t) })),
      removeInvite: (id, guestId) => set(s => ({ tournaments: s.tournaments.map(t => t.id === id && t.status === 'upcoming' ? { ...t, invitees: (t.invitees ?? []).filter(c => c.id !== guestId || c.playerId) } : t) })),
      checkIn: (id, guestId) => set(s => ({ tournaments: s.tournaments.map(t => {
        const c = t.invitees?.find(c => c.id === guestId);
        if (t.id !== id || t.status !== 'upcoming' || !c || c.status !== 'confirmed' || c.playerId) return t;
        const existente = t.players.find(p => p.name.trim().toLocaleLowerCase('pt-BR') === c.name.trim().toLocaleLowerCase('pt-BR'));
        if (!existente && t.capacity && t.players.length >= t.capacity) return t;
        const playerId = existente?.id ?? `p_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
        return { ...t, players: existente ? t.players : [...t.players, { id: playerId, userId: playerId, name: c.name, buyIns: 1, reEntries: 0, addOns: 0, paymentStatus: 'pending' as const }], invitees: t.invitees!.map(i => i.id === guestId ? { ...i, playerId } : i) };
      }) })),

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

      setActive: (id) => rawSet({ activeTournamentId: id }),

      addPlayer: (tournamentId, player) => {
        const id = `p_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
        set(s => ({
          tournaments: s.tournaments.map(t =>
            t.id === tournamentId && (t.status === 'upcoming' || t.status === 'running') && vagaParaJogador(t, player.name)
              ? { ...t, players: [...t.players, { ...player, id }] }
              : t
          ),
        }));
      },

      removePlayer: (tournamentId, playerId) =>
        set(s => ({
          tournaments: s.tournaments.map(t =>
            t.id === tournamentId
              ? { ...t, players: t.players.filter(p => p.id !== playerId), invitees: t.invitees?.map(c => c.playerId === playerId ? { ...c, playerId: undefined } : c) }
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
          tournaments: s.tournaments.map((t) => (t.id === tournamentId && t.status === 'running' ? eliminar(t, playerId) : t)),
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
    });
    },
    { name: 'kt-tournaments', storage: armazenamento },
  ),
);
