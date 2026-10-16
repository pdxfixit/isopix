// The Isopix file format, spec 1.0 (spec/README.md): what a writer that is not
// Isopix may write opens; anything else gets one plain message; drawings saved
// before spec 1.0 still open (P.fromOldLayout, temporary: TODO.md).
import test from 'node:test';
import assert from 'node:assert/strict';
import * as P from '../web/engine/project.js';
import * as L from '../web/engine/lattice.js';
import { Drawing } from '../web/engine/model.js';

const sample = () => {
  const d = new Drawing();
  d.begin();
  d.paint(L.mk(2, 0, 0, 1), { c: '#3a86ff', f: 'L', b: '#3a86ff' });
  d.paint(L.mk(2, 0, 0, 0), { c: '#e63946' });
  d.setEdge('2,0,1,0', { c: '#1d1e22', t: 9 });
  d.commit();
  return d;
};
const cells = (d) => JSON.stringify([...d.cells].sort());

test('a saved drawing is spec 1.0: picture holds the colors, app the rest', () => {
  const doc = JSON.parse(JSON.stringify(P.save(sample(), { name: 'Two', savedAt: 5 })));
  assert.equal(doc.format, 'isopix'); assert.equal(doc.version, 1);
  assert.deepEqual(doc.picture, { name: 'Two', paper: 'light', cells: { '2,0,0,1': '#3a86ff', '2,0,0,0': '#e63946' }, edges: { '2,0,1,0': '#1d1e22' } });
  assert.deepEqual(doc.app.faces, { '2,0,0,1': { f: 'L', b: '#3a86ff' } });
  assert.equal(P.meta(doc).savedAt, 5);
  assert.equal(cells(P.load(doc)), cells(sample()), 'save then open: the same cells');
});

test('a drawing another program wrote (picture only) opens, with fresh ids', () => {
  const d = P.load({ format: 'isopix', version: 1, picture: { cells: { '0,0,0,1': '#ff0000', '1,1,0,0': '#00ff00' } } });
  assert.equal(d.cells.size, 2);
  assert.equal(d.paper, 'light');
  const ids = [...d.cells.values()].map((v) => v.id);
  assert.equal(new Set(ids).size, 2); assert.ok(ids.every((i) => i > 0) && d.seq >= Math.max(...ids));
  assert.equal(d.checkInvariant(), null);
});

test('anything that is not an Isopix drawing gets one plain message', () => {
  for (const bad of [null, 5, 'x', {}, { format: 'other', version: 1, picture: {} }, { format: 'isopix', version: 1 },
    { format: 'isopix', version: 1, picture: { cells: { 'x': '#ffffff' } } },
    { format: 'isopix', version: 1, picture: { cells: { '0,0,0,1': 'red' } } },
    { format: 'isopix', version: 1, picture: { cells: { '0,0,0,1': '#ffffff', '1,0,0,1': '#000000' } } }]) {
    assert.throws(() => P.load(bad), (e) => e.message.startsWith(P.NOT_ISOPIX), JSON.stringify(bad));
  }
  assert.throws(() => P.load({ format: 'isopix', version: 2, picture: { cells: {} } }), /newer Isopix/);
});

test('a drawing saved before spec 1.0 opens the same (temporary converter)', () => {
  const d = sample();
  const old = { format: 'isopix', version: 1, seq: d.seq, paper: 'dark', cells: [...d.cells], edges: [...d.edges], hidden: [], hiddenEdges: [], log: d.undoStack, redo: [], name: 'Old', savedAt: 7 };
  const back = P.load(JSON.parse(JSON.stringify(old)));
  assert.equal(cells(back), cells(d));
  assert.equal(back.paper, 'dark');
  assert.equal(back.undoStack.length, 1);
  assert.deepEqual(P.meta(old), { name: 'Old', savedAt: 7, view: undefined, stamps: undefined, symmetry: undefined, trace: undefined, log: old.log });
  assert.equal(P.fromOldLayout(old).picture.name, 'Old');
  assert.ok(P.hasContent(old) && !P.hasContent({ format: 'isopix', version: 1, picture: { cells: {} } }));
});
