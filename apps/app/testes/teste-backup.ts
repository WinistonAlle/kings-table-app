import assert from 'node:assert/strict';
import { parseBackup } from '../lib/backup';

const level = { level: 1, smallBlind: 25, bigBlind: 50, ante: 0, durationMinutes: 15 };
const clock = { structure: [level], currentLevel: 0, secondsRemaining: 900, levelEndsAt: null, isRunning: false };
const mesa = {
  id: 'mesa-a', name: 'Amigos', format: 'regular', status: 'upcoming', buyIn: 37.5,
  reEntryAllowed: true, maxReEntries: 2, startTime: '', createdAt: new Date().toISOString(), createdBy: 'local',
  blindStructure: [level], currentLevel: 0, players: [],
};
const snapshot = {
  version: 1, tournaments: [mesa], activeTournamentId: 'mesa-a',
  presets: [{ id: 'estrutura-a', name: 'Quinta', levels: [level] }],
  blinds: { ...clock, tournamentId: 'mesa-a', clocks: { 'mesa-a': clock } },
};
const parsed = parseBackup(snapshot);
assert.equal(parseBackup({ ...snapshot, blinds: { ...snapshot.blinds, handForHand: true } }).blinds.handForHand, true);
assert.throws(() => parseBackup({ ...snapshot, blinds: { ...snapshot.blinds, handForHand: true, isRunning: true, levelEndsAt: Date.now() + 60000 } }));
assert.equal(parsed.tournaments[0].buyIn, 37.5);
parsed.tournaments[0].name = 'Alterado';
assert.equal(snapshot.tournaments[0].name, 'Amigos', 'validacao produz copia independente');
assert.throws(() => parseBackup({ ...snapshot, version: 2 }));
assert.throws(() => parseBackup({ ...snapshot, activeTournamentId: 'inexistente' }));
assert.throws(() => parseBackup({ ...snapshot, tournaments: [mesa, mesa] }));
assert.throws(() => parseBackup({ ...snapshot, tournaments: [{ ...mesa, buyIn: -1 }] }));
assert.throws(() => parseBackup({ ...snapshot, blinds: { ...snapshot.blinds, currentLevel: 99 } }));
assert.throws(() => parseBackup({ ...snapshot, blinds: { ...snapshot.blinds, isRunning: true } }));
assert.throws(() => parseBackup({ ...snapshot, blinds: { ...snapshot.blinds, clocks: { ausente: clock } } }));
assert.throws(() => parseBackup({ ...snapshot, presets: [{ id: 'ruim', name: 'Ruim', levels: [] }] }));
assert.throws(() => parseBackup({ ...snapshot, tournaments: [{ ...mesa, audit: [{ id: 'a' }] }] }));
assert.throws(() => parseBackup({ ...snapshot, tournaments: [{ ...mesa, name: 'a'.repeat(6 * 1024 * 1024) }] }));
assert.equal(parseBackup({ version: 1, tournaments: [], activeTournamentId: null, presets: [], blinds: { ...clock, tournamentId: null, clocks: {} } }).tournaments.length, 0);
console.log('Backup: formato, limites, referencias, relogios e independencia dos dados passaram.');
