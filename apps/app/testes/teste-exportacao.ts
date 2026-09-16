import assert from 'node:assert/strict';
import type { Tournament } from '../types';
import { csvCell, exportFilename, nightSummary, nightTotals, tournamentCsv } from '../lib/exportacao';

const t: Tournament = {
  id: 'mesa-1', name: '=Mesa; "Amigos"', format: 'regular', status: 'running', buyIn: 10.25,
  reEntryAllowed: true, maxReEntries: 2, startTime: '2026-09-16T20:00:00Z', createdAt: '2026-09-16T20:00:00Z', createdBy: 'local', currentLevel: 0,
  blindStructure: [{ level: 1, smallBlind: 25, bigBlind: 50, ante: 0, durationMinutes: 20 }, { level: 1, isBreak: true, smallBlind: 0, bigBlind: 0, ante: 0, durationMinutes: 10 }],
  players: [
    { id: 'a', userId: 'a', name: 'Ana', buyIns: 1, reEntries: 1, addOns: 0, paymentStatus: 'confirmed', tableNumber: 1, seatNumber: 2 },
    { id: 'b', userId: 'b', name: '@Pedro; "B"', buyIns: 1, reEntries: 0, addOns: 1, paymentStatus: 'pending', position: 2, prize: 99 },
    { id: 'c', userId: 'c', name: 'Bia\nTeste', buyIns: 1, reEntries: 0, addOns: 0, paymentStatus: 'disputed', position: 3 },
  ],
  audit: [{ id: 'evento', at: '2026-09-16T20:00:00Z', actor: 'Organizador', summary: 'Alteração', changes: [{ label: 'Nome', before: '-antigo', after: 'novo' }] }],
};
const before = JSON.stringify(t);
assert.deepEqual(nightTotals(t), { paid: 20.5, pending: 20.5, disputed: 10.25 });
const partial = nightSummary(t);
assert.ok(partial.includes('CLASSIFICAÇÃO PARCIAL'));
assert.ok(partial.includes('Ainda em jogo: Ana'));
assert.ok(!partial.includes('Prêmio:'));
assert.ok(partial.indexOf('2º') < partial.indexOf('3º'));
assert.ok(partial.includes('Bia Teste'));
assert.ok(partial.includes('Não é confirmação bancária'));
assert.ok(nightSummary({ ...t, status: 'finished' }).includes('RESULTADO FINAL'));
assert.ok(nightSummary({ ...t, status: 'finished' }).includes('Prêmio:'));
assert.equal(csvCell(' =1+1'), '"\' =1+1"');
assert.equal(csvCell('\t@SUM(A1)'), '"\'\t@SUM(A1)"');
assert.equal(csvCell('Ana; "B"'), '"Ana; ""B"""');
assert.equal(csvCell(undefined), '""');
assert.equal(csvCell(2), '"2"');
assert.equal(csvCell(10.25), '"10,25"');
const players = tournamentCsv(t, 'players');
assert.ok(players.startsWith('\uFEFF'));
assert.ok(players.includes('"\'=Mesa; ""Amigos"""'));
assert.ok(players.includes('"\'@Pedro; ""B"""'));
assert.ok(!players.includes('"99"'));
assert.ok(tournamentCsv({ ...t, status: 'finished' }, 'players').includes('"99"'));
assert.ok(tournamentCsv(t, 'blinds').includes('"Intervalo"'));
assert.ok(tournamentCsv(t, 'audit').includes('"\'-antigo"'));
assert.equal(tournamentCsv({ ...t, players: [] }, 'players').split('\r\n').length, 2);
assert.equal(tournamentCsv({ ...t, audit: [] }, 'audit').split('\r\n').length, 2);
assert.equal(exportFilename(t, 'players'), 'kings-table-Mesa-Amigos-players.csv');
assert.equal(JSON.stringify(t), before);
console.log('Resumo, totais, classificacao, CSV seguro e exportacao sem mutacao passaram.');
