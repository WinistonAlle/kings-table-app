import assert from 'node:assert/strict';
import { novaIdentidade } from '../lib/identidade';
import { prepareCreationOperation, tournamentCreatePayloadSchema, type TournamentCreatePayload } from '../lib/sync-tournament-create';
const owner = novaIdentidade();
const input: TournamentCreatePayload = {
  name: '  Noite QA  ', format: 'regular', buyIn: 73.29,
  reEntryAllowed: true, maxReEntries: 5, startTime: '2026-10-02T20:00:00Z',
  suit: 'copas', color: '#78a885', location: '  Sala  ', capacity: undefined,
  levels: [
    { level: 9, smallBlind: 25, bigBlind: 50, ante: 0, durationMinutes: 20 },
    { level: 9, smallBlind: 50, bigBlind: 100, ante: 10, durationMinutes: 10, isBreak: true },
    { level: 9, smallBlind: 50, bigBlind: 100, ante: 25, durationMinutes: 15 },
  ],
};
const before = JSON.stringify(input);
const first = prepareCreationOperation(owner, input);
const second = prepareCreationOperation(owner, input);
assert.equal(first.ownerId, owner); assert.equal(first.entity, 'tournament');
assert.equal(first.kind, 'tournament.create'); assert.equal(first.expectedRevision, 0);
assert.notEqual(first.id, first.entityId); assert.notEqual(first.entityId, second.entityId);
assert.equal(first.payload.name, 'Noite QA'); assert.equal(first.payload.location, 'Sala');
assert.equal(first.payload.buyIn, 73.29); assert.equal(first.payload.maxReEntries, 5);
assert.equal(Object.hasOwn(first.payload, 'capacity'), false, 'No-limit creation must omit capacity, not send null/undefined');
assert.equal(JSON.stringify(input), before);
const parsed = tournamentCreatePayloadSchema.parse(first.payload);
assert.deepEqual(parsed.levels.map(level => level.level), [1, 1, 2]);
assert.deepEqual(parsed.levels[1], { level: 1, smallBlind: 0, bigBlind: 0, ante: 0, durationMinutes: 10, isBreak: true });
for (const buyIn of [0, -1, NaN, Infinity, 0.001, 73.291, 100000000]) {
  assert.throws(() => prepareCreationOperation(owner, { ...input, buyIn }));
}
for (const buyIn of [0.01, 0.29, 1.1, 99999999.99]) assert.equal(prepareCreationOperation(owner, { ...input, buyIn }).payload.buyIn, buyIn);
for (const maxReEntries of [-1, 1.5, 101]) assert.throws(() => prepareCreationOperation(owner, { ...input, maxReEntries }));
assert.throws(() => prepareCreationOperation(owner, { ...input, reEntryAllowed: false }));
assert.equal(prepareCreationOperation(owner, { ...input, reEntryAllowed: false, maxReEntries: 0 }).payload.maxReEntries, 0);
for (const capacity of [0, 1, 1001, 2.5, null]) assert.throws(() => prepareCreationOperation(owner, { ...input, capacity } as TournamentCreatePayload));
assert.equal(prepareCreationOperation(owner, { ...input, capacity: 1000 }).payload.capacity, 1000);
assert.throws(() => prepareCreationOperation('not-an-owner', input));
assert.throws(() => prepareCreationOperation(owner, { ...input, name: ' ' }));
assert.throws(() => prepareCreationOperation(owner, { ...input, color: 'gold' }));
assert.throws(() => prepareCreationOperation(owner, { ...input, location: 'x'.repeat(201) }));
assert.throws(() => prepareCreationOperation(owner, { ...input, startTime: '2026-10-02T20:00:00+00:00' }));
assert.throws(() => prepareCreationOperation(owner, { ...input, levels: [] }));
assert.throws(() => prepareCreationOperation(owner, { ...input, unrecognized: true } as TournamentCreatePayload));
console.log('Online creation: normalized structures/breaks, cents, reentry limits, strict payload, capacity omission, identity and immutable inputs passed.');
