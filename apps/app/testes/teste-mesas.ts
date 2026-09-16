import assert from 'node:assert/strict';
import { listarMesas } from '../lib/mesas';
import type { Tournament } from '../types';

const mesa = (id: string, status: Tournament['status'], name: string, createdAt: string): Tournament => ({
  id, status, name, createdAt, buyIn: 50, format: 'regular', reEntryAllowed: true,
  maxReEntries: 2, startTime: createdAt, blindStructure: [], currentLevel: 0,
  players: [], createdBy: 'me',
});
const mesas = [mesa('1', 'running', 'Quarta da Realeza', '2026-09-10'), mesa('2', 'finished', 'Sábado', '2026-09-12'), mesa('3', 'upcoming', 'Sexta', '2026-09-11'), mesa('4', 'cancelled', 'Cancelada', '2026-09-09')];
assert.deepEqual(listarMesas(mesas, 'abertas').map(t => t.id), ['3', '1']);
assert.deepEqual(listarMesas(mesas, 'encerradas').map(t => t.id), ['2']);
assert.deepEqual(listarMesas(mesas, 'todas', ' SABADO ').map(t => t.id), ['2']);
assert.equal(listarMesas(mesas, 'todas', 'inexistente').length, 0);
assert.deepEqual(listarMesas([], 'todas'), []);
assert.equal(mesas[0].id, '1');
console.log('Filtros, busca e ordenacao de mesas passaram.');
