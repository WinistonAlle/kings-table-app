import assert from 'node:assert/strict';
import { adicionarConvidado, compararEspera, dataAgendada, statusPresenca, textoConvite, vagaParaJogador } from '../lib/noite';
import type { Tournament } from '../types';

async function main() {
const memory = new Map<string, string>();
Object.defineProperty(globalThis, 'window', { value: { localStorage: { getItem: (key: string) => memory.get(key) ?? null, setItem: (key: string, value: string) => memory.set(key, value), removeItem: (key: string) => memory.delete(key) } }, configurable: true });
const { useTournamentStore } = await import('../stores/tournamentStore');
await useTournamentStore.persist.rehydrate();
const agora = new Date(2026, 8, 15, 12);
assert.equal(dataAgendada('31/02/2027', '20:00', agora), null);
assert.equal(dataAgendada('16/09/2026', '24:00', agora), null);
assert.equal(dataAgendada('14/09/2026', '20:00', agora), null);
assert.equal(dataAgendada('16/09/2026', '20:00', agora), new Date(2026, 8, 16, 20).toISOString());
let t: Tournament = { id: 'night', name: 'Quarta', format: 'regular', status: 'upcoming', buyIn: 19.9, reEntryAllowed: false, maxReEntries: 0, startTime: new Date(2026, 8, 16, 20).toISOString(), blindStructure: [], currentLevel: 0, players: [], createdBy: 'me', createdAt: '', capacity: 2 };
const guest = (id: string, name: string) => ({ id, name, status: 'confirmed' as const,
  createdAt: new Date(Date.UTC(2026, 8, 15, 12, 0, 0, id.charCodeAt(0))).toISOString() });
t = adicionarConvidado(t, guest('a', 'Ana'));
t = adicionarConvidado(t, guest('b', 'Bruno'));
assert.equal(t.players.length, 0, 'RSVP não cobra buy-in');
assert.equal(adicionarConvidado(t, guest('c', ' ana ')), t, 'nome duplicado');
t = adicionarConvidado(t, guest('c', 'Caio'));
assert.equal(t.invitees![2].status, 'waiting');
assert.equal(vagaParaJogador(t, 'Extra'), false, 'confirmados reservam as vagas');
assert.equal(vagaParaJogador(t, 'Ana'), true, 'confirmado pode ocupar sua reserva');
assert.equal(statusPresenca(t, 'confirmed', 'a'), 'confirmed', 'reconfirmar não perde vaga');
assert.equal(statusPresenca(t, 'maybe', 'c'), 'maybe');
assert.match(textoConvite(t), /Quarta/);
assert.match(textoConvite(t), /19,90/);
useTournamentStore.setState({ tournaments: [t], activeTournamentId: null });
const store = useTournamentStore.getState();
store.checkIn(t.id, 'a');
store.checkIn(t.id, 'a');
store.checkIn(t.id, 'c');
assert.equal(useTournamentStore.getState().tournaments[0].players.length, 1, 'check-in idempotente e espera não entra');
assert.equal(useTournamentStore.getState().tournaments[0].players[0].paymentStatus, 'pending');
store.eliminatePlayer(t.id, useTournamentStore.getState().tournaments[0].players[0].id);
assert.equal(useTournamentStore.getState().tournaments[0].status, 'upcoming', 'não elimina antes do início');
store.setAttendance(t.id, 'b', 'absent');
assert.equal(useTournamentStore.getState().tournaments[0].invitees?.find(c => c.id === 'c')?.status,
  'confirmed', 'primeiro da espera assume a vaga automaticamente');
store.setAttendance(t.id, 'c', 'confirmed');
store.checkIn(t.id, 'c');
assert.equal(useTournamentStore.getState().tournaments[0].players.length, 2);
store.addPlayer(t.id, { userId: 'x', name: 'Extra', buyIns: 1, reEntries: 0, addOns: 0, paymentStatus: 'pending' });
assert.equal(useTournamentStore.getState().tournaments[0].players.length, 2, 'respeita lotação');
const p = useTournamentStore.getState().tournaments[0].players[0];
store.removePlayer(t.id, p.id);
assert.equal(useTournamentStore.getState().tournaments[0].invitees![0].playerId, undefined, 'remover entrada libera novo check-in');
store.checkIn(t.id, 'a');
await useTournamentStore.persist.rehydrate();
assert.equal(useTournamentStore.getState().tournaments[0].players.length, 2, 'entradas sobrevivem ao armazenamento');
assert.equal(useTournamentStore.getState().tournaments[0].invitees!.length, 3, 'convites sobrevivem ao armazenamento');
store.startTournament(t.id);
store.invite(t.id, 'Novo', 'confirmed');
assert.equal(useTournamentStore.getState().tournaments[0].invitees!.length, 3, 'RSVP encerrado após início');
const queue: Tournament = { ...t, id: 'waitlist', players: [], invitees: [
  guest('a', 'Ana'), guest('b', 'Bruno'),
  { ...guest('c', 'Caio'), status: 'waiting' },
  { ...guest('d', 'Dora'), status: 'waiting' },
  { ...guest('e', 'Eva'), status: 'waiting' },
] };
useTournamentStore.setState({ tournaments: [queue], activeTournamentId: null });
store.setAttendance(queue.id, 'b', 'absent');
assert.deepEqual(useTournamentStore.getState().tournaments[0].invitees?.map(c => c.status),
  ['confirmed', 'absent', 'confirmed', 'waiting', 'waiting'], 'desistencia promove a primeira pessoa');
store.setAttendance(queue.id, 'c', 'waiting');
assert.deepEqual(useTournamentStore.getState().tournaments[0].invitees?.map(c => c.status),
  ['confirmed', 'absent', 'waiting', 'confirmed', 'waiting'], 'voltar a espera promove outra pessoa, nao a si mesma');
assert.ok(useTournamentStore.getState().tournaments[0].invitees?.find(c => c.id === 'c')?.waitingSince,
  'reentrada guarda a nova posicao na fila');
assert.deepEqual(useTournamentStore.getState().tournaments[0].invitees?.filter(c => c.status === 'waiting').sort(compararEspera).map(c => c.id),
  ['e', 'c'], 'convite antigo que retorna fica atras de quem ja esperava');
await useTournamentStore.persist.rehydrate();
assert.deepEqual(useTournamentStore.getState().tournaments[0].invitees?.filter(c => c.status === 'waiting').sort(compararEspera).map(c => c.id),
  ['e', 'c'], 'ordem de reentrada sobrevive a recarga');
store.removeInvite(queue.id, 'a');
assert.deepEqual(useTournamentStore.getState().tournaments[0].invitees?.map(c => c.status),
  ['absent', 'waiting', 'confirmed', 'confirmed'], 'remocao promove quem esperava antes da reentrada');
store.updateTournament(queue.id, { capacity: 3 });
assert.equal(useTournamentStore.getState().tournaments[0].invitees?.find(c => c.id === 'c')?.status,
  'confirmed', 'aumento de capacidade libera a proxima vaga');
const playerQueue: Tournament = { ...queue, id: 'player-waitlist', players: [{
  id: 'manual', userId: 'guest', name: 'Manual', buyIns: 1, reEntries: 0, addOns: 0,
  paymentStatus: 'pending', financialActivityRecorded: false,
}], invitees: [guest('a', 'Ana'), { ...guest('c', 'Caio'), status: 'waiting' }] };
useTournamentStore.setState({ tournaments: [playerQueue], activeTournamentId: null });
store.removePlayer(playerQueue.id, 'manual');
assert.equal(useTournamentStore.getState().tournaments[0].invitees?.find(c => c.id === 'c')?.status,
  'confirmed', 'retirar entrada libera uma vaga para a espera');
const late: Tournament = { ...t, id: 'late-night', status: 'running', capacity: undefined,
  invitees: undefined, players: ['Ana', 'Bia', 'Caio'].map((name, i) => ({
    id: `late-${i}`, userId: `guest-${i}`, name, buyIns: 1, reEntries: 0, addOns: 0,
    paymentStatus: 'pending' as const,
  })) };
useTournamentStore.setState({ tournaments: [late], activeTournamentId: late.id });
store.eliminatePlayer(late.id, 'late-2');
store.addPlayer(late.id, { userId: 'guest-new', name: 'Duda', buyIns: 1,
  reEntries: 0, addOns: 0, paymentStatus: 'pending' });
await useTournamentStore.persist.rehydrate();
const afterLate = useTournamentStore.getState().tournaments[0];
assert.equal(afterLate.players.find(player => player.id === 'late-2')?.position, 4,
  'entrada tardia desloca colocacao anterior e persiste');
assert.equal(afterLate.players.find(player => player.name === 'Duda')?.position, undefined);
assert.equal(afterLate.players.length, 4);
console.log('Agendamento, presença, vagas e check-in: tudo passou.');
}
main().catch(error => { console.error(error); process.exitCode = 1; });
