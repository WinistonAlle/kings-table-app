import assert from 'node:assert/strict';
import { novaIdentidade } from '../lib/identidade';
import { preparePresetCopyDraft } from '../lib/sync-preset-copy';
import { presetPayloadSchema } from '../lib/sync-preset-model';
import type { PresetLibrary } from '../lib/sync-preset-session';

const row: PresetLibrary[number] = {
  id: novaIdentidade(), reconciliationNeeded: false, pending: [], archived: [], projected: null,
  confirmed: { ownerId: novaIdentidade(), id: novaIdentidade(), revision: 4, deleted: false,
    payload: { name: 'Noite longa', levels: [
      { level: 1, smallBlind: 25, bigBlind: 50, ante: 0, durationMinutes: 20 },
      { level: 1, smallBlind: 0, bigBlind: 0, ante: 0, durationMinutes: 7, isBreak: true },
      { level: 2, smallBlind: 50, bigBlind: 100, ante: 25, durationMinutes: 15 },
    ] } },
};
row.id = row.confirmed!.id;
const before = structuredClone(row), copy = preparePresetCopyDraft(row);
assert.equal(copy.name, 'Noite longa (cópia)');
assert.equal(copy.sourceRevision, 4);
assert.equal(copy.sourceId, row.id);
assert.equal(copy.ownerId, row.confirmed!.ownerId);
assert.deepEqual(copy.levels, row.confirmed!.payload!.levels);
copy.levels[0].durationMinutes = 8;
assert.deepEqual(row, before, 'Copy must not alias or change source levels');
assert.throws(() => preparePresetCopyDraft({ ...row, confirmed: null }));
assert.throws(() => preparePresetCopyDraft({ ...row, id: novaIdentidade() }));
assert.throws(() => preparePresetCopyDraft({ ...row, reconciliationNeeded: true }));
assert.throws(() => preparePresetCopyDraft({ ...row, confirmed: { ...row.confirmed!, deleted: true } }));
assert.throws(() => preparePresetCopyDraft({ ...row, pending: [{} as PresetLibrary[number]['pending'][number]] }));
assert.throws(() => preparePresetCopyDraft({ ...row, confirmed: { ...row.confirmed!, payload: null } }));
const long = preparePresetCopyDraft({ ...row, confirmed: { ...row.confirmed!,
  payload: { ...row.confirmed!.payload!, name: '♠'.repeat(120) } } });
assert.equal(Array.from(long.name).length, 120);
assert.equal(presetPayloadSchema.safeParse({ name: long.name, levels: long.levels }).success, true);
const surrogate = preparePresetCopyDraft({ ...row, confirmed: { ...row.confirmed!,
  payload: { ...row.confirmed!.payload!, name: '🂡'.repeat(120) } } });
assert.equal(Array.from(surrogate.name).length, 120);
assert.equal(surrogate.name.includes('\uFFFD'), false);
assert.deepEqual(row, before);
console.log('Preset copy: confirmed-only guards, independent levels/breaks, source metadata and Unicode name limits passed.');
