// ─── Tournament ──────────────────────────────────────────────
export type TournamentFormat = 'deep' | 'regular' | 'turbo' | 'hyper' | 'rebuy' | 'bounty';
export type TournamentStatus = 'upcoming' | 'running' | 'finished' | 'cancelled';

export interface BlindLevel {
  isBreak?: boolean;
  level: number;
  smallBlind: number;
  bigBlind: number;
  ante: number;
  durationMinutes: number;
}

export interface Tournament {
  settlementPayments?: SettlementPayment[];
  seatsPerTable?: number;
  seatUndo?: { seatsPerTable: number; players: Pick<TournamentPlayer, 'id' | 'tableNumber' | 'seatNumber'>[] };
  audit?: AuditEvent[];
  location?: string;
  capacity?: number;
  invitees?: NightInvitee[];
  suit?: 'espada' | 'copas' | 'ouros' | 'paus';
  color?: string;
  id: string;
  name: string;
  leagueId?: string;
  format: TournamentFormat;
  status: TournamentStatus;
  buyIn: number;
  reEntryAllowed: boolean;
  maxReEntries: number;
  startTime: string;
  blindStructure: BlindLevel[];
  currentLevel: number;
  players: TournamentPlayer[];
  createdBy: string;
  createdAt: string;
}

export interface SettlementPayment {
  id: string;
  from: string;
  to: string;
  cents: number;
  at: string;
  baseline: string;
  voidedAt?: string;
}

export type Attendance = 'confirmed' | 'maybe' | 'absent' | 'waiting';
export interface NightInvitee {
  id: string;
  name: string;
  status: Attendance;
  createdAt: string;
  playerId?: string;
}

export interface TournamentPlayer {
  tableNumber?: number;
  seatNumber?: number;
  id: string;
  userId: string;
  name: string;
  avatar?: string;
  buyIns: number;
  reEntries: number;
  addOns: number;
  position?: number;
  prize?: number;
  paymentStatus: 'pending' | 'confirmed' | 'disputed';
  eliminatedAt?: string;
}

export interface AuditEvent {
  id: string;
  at: string;
  actor: string;
  summary: string;
  changes: { label: string; before: string; after: string }[];
}

// ─── League ──────────────────────────────────────────────────
export interface League {
  id: string;
  name: string;
  description?: string;
  ownerId: string;
  members: string[];
  tournamentIds: string[];
  scoringConfig: ScoringConfig;
  createdAt: string;
}

export interface ScoringConfig {
  pointsForWin: number;
  pointsForITM: number;
  bonusForBounty: number;
  formula: 'linear' | 'exponential' | 'custom';
}

// ─── Ranking ─────────────────────────────────────────────────
export interface LeagueStanding {
  userId: string;
  name: string;
  avatar?: string;
  points: number;
  tournamentsPlayed: number;
  wins: number;
  itmCount: number;
  rank: number;
}

// ─── User ────────────────────────────────────────────────────
export interface User {
  id: string;
  email: string;
  name: string;
  avatar?: string;
  xp: number;
  streak: number;
  level: number;
  createdAt: string;
}

// ─── Blinds Timer ────────────────────────────────────────────
export interface BlindsTimerState {
  tournamentId: string;
  currentLevel: number;
  secondsRemaining: number;
  isRunning: boolean;
  isPaused: boolean;
  structure: BlindLevel[];
}
