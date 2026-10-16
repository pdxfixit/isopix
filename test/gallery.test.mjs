// Several drawings (web/gallery.js): the list, which opens, the one-time move
// of the single drawing kept before, and copy names (owner, 2026-10-16: "A").
import test from 'node:test';
import assert from 'node:assert/strict';
import * as G from '../web/gallery.js';

const e = (id, savedAt, name = id) => ({ id: `id-${id}`, name, savedAt, thumb: null });

test('the stored list keeps only real entries, newest first, each id once', () => {
  assert.deepEqual(G.entriesOf(null), []);
  assert.deepEqual(G.entriesOf({ id: 'id-a' }), []);
  const list = G.entriesOf([null, 7, { id: '../x' }, { id: 'id-a', name: 'A', savedAt: 1 }, { id: 'id-b', name: '', savedAt: 5, thumb: 'javascript:alert(1)' }, { id: 'id-a', name: 'again', savedAt: 9 }]);
  assert.deepEqual(list.map((x) => x.id), ['id-b', 'id-a']);
  assert.equal(list[0].name, 'Untitled drawing', 'a blank name');
  assert.equal(list[0].thumb, null, 'only a data: picture is a thumbnail');
  assert.equal(list[1].name, 'A', 'the first entry for an id wins');
});

test('adding and updating an entry keeps the list newest first', () => {
  let list = [e('a', 1), e('b', 2)];
  list = G.withEntry(list, { id: 'id-a', savedAt: 3 });
  assert.deepEqual(list.map((x) => x.id), ['id-a', 'id-b']);
  assert.equal(list[0].name, 'a', 'fields not given are kept');
  list = G.withEntry(list, { id: 'id-c', name: 'C', savedAt: 0 });
  assert.equal(list.length, 3);
  assert.deepEqual(G.without(list, 'id-a').map((x) => x.id), ['id-b', 'id-c']);
});

test('the drawing marked open opens; else the newest; else none', () => {
  const list = [e('b', 5), e('a', 1)];
  assert.equal(G.whichOpen(list, 'id-a'), 'id-a');
  assert.equal(G.whichOpen(list, 'id-gone'), 'id-b');
  assert.equal(G.whichOpen([], 'id-a'), null);
  assert.equal(G.afterDelete(list, 'id-b'), 'id-a');
  assert.equal(G.afterDelete([e('a', 1)], 'id-a'), null, 'deleting the last: a new one is made');
});

test('the single drawing kept before moves in once, with its copies and file record', () => {
  const autosave = { format: 'isopix', name: 'Nifty Nugget', savedAt: 42, cells: [] };
  const m = G.migrate({ list: undefined, autosave, copies: [{ savedAt: 1, project: {} }], file: { name: 'n.png' } }, 'id-x', 99);
  assert.deepEqual(m.list, [{ id: 'id-x', name: 'Nifty Nugget', savedAt: 42, thumb: null }]);
  assert.deepEqual(m.writes.map(([k]) => k), ['drawing:id-x', 'copies:id-x', 'file:id-x']);
  assert.equal(m.writes[0][1], autosave, 'the project as it was');
  assert.equal(G.migrate({ list: [], autosave }, 'id-y'), null, 'a list already exists: done before');
  assert.equal(G.migrate({ list: undefined, autosave: null }, 'id-y'), null, 'a first visit: nothing to move');
});

test('a copy never takes a name in use', () => {
  assert.equal(G.copyName('Badger', ['Badger']), 'Badger copy');
  assert.equal(G.copyName('Badger', ['Badger', 'Badger copy']), 'Badger copy 2');
  assert.equal(G.copyName('Badger', ['Badger copy', 'Badger copy 2']), 'Badger copy 3');
});

test('ids are safe as IndexedDB key parts, and unique', () => {
  const ids = new Set(Array.from({ length: 50 }, () => G.newId()));
  assert.equal(ids.size, 50);
  for (const id of ids) assert.match(id, /^[a-z0-9-]{4,40}$/);
  const g = globalThis.crypto;
  try {
    Object.defineProperty(globalThis, 'crypto', { value: undefined, configurable: true });
    assert.match(G.newId(() => 0.5, 1000), /^[a-z0-9-]{4,40}$/, 'plain http has no randomUUID');
  } finally { Object.defineProperty(globalThis, 'crypto', { value: g, configurable: true }); }
});

test('an empty drawing is not kept when another opens', () => {
  assert.equal(G.keepOnLeave(false), false);
  assert.equal(G.keepOnLeave(true), true);
});
