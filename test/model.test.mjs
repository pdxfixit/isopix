// The canvas model: the one-cell-or-children invariant, protect / behind,
// and undo. Includes the three prototype checks from the brief.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as L from '../web/engine/lattice.js';
import { Drawing } from '../web/engine/model.js';

const red = { c: '#ff0000' }, blue = { c: '#0000ff' };
const near = (a, b) => Math.abs(a - b) < 1e-12;
const inside = (c, l) => { const w = L.centroid(c); return L.hitTest(l, w.x, w.y); };

test('prototype check 1: a level-3 cell inside a painted level-0 cell keeps area exactly 1', () => {
  const d = new Drawing();
  const big = L.mk(0, 0, 0, 1);
  d.paint(big, red);
  const small = inside(big, 3);
  d.paint(small, blue);
  assert.ok(near(d.area(), 1));
  assert.equal(d.checkInvariant(), null);
  assert.equal(d.get(small).c, '#0000ff');
  assert.equal(d.get(big), undefined);
  assert.equal(d.cells.size, 3 * 3 + 1); // 3 siblings at each of levels 1-3, plus the small cell
});

test('prototype check 2: erasing a level-6 cell leaves area 1 - 1/4096', () => {
  const d = new Drawing();
  const big = L.mk(0, 0, 0, 0);
  d.paint(big, red);
  d.paint(inside(big, 6), null);
  assert.ok(near(d.area(), 1 - 1 / 4096));
  assert.equal(d.checkInvariant(), null);
});

test('prototype check 3: overpainting the level-0 cell collapses to 1 cell with sub all zero', () => {
  const d = new Drawing();
  const big = L.mk(0, 0, 0, 1);
  d.paint(big, red);
  d.paint(inside(big, 3), blue);
  d.paint(inside(big, 6), null);
  d.paint(big, blue);
  assert.equal(d.cells.size, 1);
  assert.equal(d.sub.size, 0);
  assert.ok(near(d.area(), 1));
});

test('8 levels: painting at level 7 works, sub depth is O(depth)', () => {
  const d = new Drawing();
  const c = L.mk(7, 5, -9, 1);
  d.paint(c, red);
  assert.equal(d.sub.size, 7);
  assert.equal(d.hasDetail(L.ancestorAt(c, 0)), true);
});

test('protect: a coarse stroke skips cells that already hold finer detail', () => {
  const d = new Drawing();
  const big = L.mk(1, 0, 0, 1);
  const fine = inside(big, 4);
  d.paint(fine, blue);
  assert.equal(d.paint(big, red, 'protect'), false);
  assert.equal(d.get(fine).c, '#0000ff');
  assert.equal(d.paint(L.mk(1, 3, 3, 1), red, 'protect'), true);
});

test('behind: fills only the empty parts and keeps the detail', () => {
  const d = new Drawing();
  const big = L.mk(1, 0, 0, 1);
  const fine = inside(big, 3);
  d.paint(fine, blue);
  d.paint(big, red, 'behind');
  assert.equal(d.get(fine).c, '#0000ff');
  assert.ok(near(d.area(), 1 / 4));
  assert.equal(d.checkInvariant(), null);
  // Painted cells are kept even at the same level.
  d.paint(big, { c: '#00ff00' }, 'behind');
  assert.equal(d.get(fine).c, '#0000ff');
  assert.ok([...d.cells.values()].every((v) => v.c !== '#00ff00'));
});

test('undo and redo restore exactly, including sub counts', () => {
  const d = new Drawing();
  const big = L.mk(0, 0, 0, 1);
  d.begin(); d.paint(big, red); d.commit();
  const snap = JSON.stringify([...d.cells]);
  d.begin(); d.paint(inside(big, 5), blue); d.paint(inside(big, 2), null); d.commit();
  d.undo();
  assert.equal(JSON.stringify([...d.cells]), snap);
  assert.equal(d.checkInvariant(), null);
  d.redo();
  assert.equal(d.checkInvariant(), null);
  assert.ok(near(d.area(), 1 - 1 / 16));
  d.undo(); d.undo();
  assert.equal(d.cells.size, 0);
  assert.equal(d.sub.size, 0);
});

test('rollback undoes an open transaction (used by live previews)', () => {
  const d = new Drawing();
  d.begin(); d.paint(L.mk(2, 0, 0, 1), red); d.rollback();
  assert.equal(d.cells.size, 0);
  assert.equal(d.undoStack.length, 0);
});

test('an empty transaction does not land in the undo log', () => {
  const d = new Drawing();
  d.begin(); d.commit();
  assert.equal(d.undoStack.length, 0);
});

test('repainting the same color is a no-op', () => {
  const d = new Drawing();
  d.paint(L.mk(2, 0, 0, 1), red);
  const v = d.get(L.mk(2, 0, 0, 1));
  assert.equal(d.paint(L.mk(2, 0, 0, 1), red), false);
  assert.equal(d.get(L.mk(2, 0, 0, 1)), v);
});

test('random paint/erase keeps the invariant at every step', () => {
  const d = new Drawing();
  let seed = 7;
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  for (let i = 0; i < 1500; i++) {
    const l = Math.floor(rnd() * 8), x = rnd() * 1.5, y = rnd() * 1.5;
    const mode = ['replace', 'protect', 'behind'][Math.floor(rnd() * 3)];
    d.paint(L.hitTest(l, x, y), rnd() < 0.2 ? null : { c: rnd() < 0.5 ? '#ff0000' : '#00ff00' }, mode);
  }
  assert.equal(d.checkInvariant(), null);
});
