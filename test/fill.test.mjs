// Fill bucket: respects the active level, stores big cells, stays in bounds.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as L from '../web/engine/lattice.js';
import { Drawing } from '../web/engine/model.js';
import { floodFill } from '../web/engine/fill.js';
import * as B from '../web/engine/brushes.js';

test('filling inside a closed ring stops at the ring', () => {
  const d = new Drawing();
  const A = { l: 2, p: 0, q: 0 };
  const outer = B.hexagon(A, 3).cells, inner = new Set(B.hexagon(A, 2).cells.map((x) => L.cellKey(x.cell)));
  for (const { cell } of outer) if (!inner.has(L.cellKey(cell))) d.paint(cell, { c: '#000000' });
  const r = floodFill(d, L.mk(2, 0, 0, 1));
  assert.equal(r.tooBig, false);
  assert.equal(r.leaves.length, 24);
  assert.ok(r.leaves.every((x) => x.kind === 'empty'));
});

test('recoloring a painted coarse cell recolors it whole: no 4^k tiny cells', () => {
  const d = new Drawing();
  d.paint(L.mk(0, 0, 0, 1), { c: '#ff0000' });
  const r = floodFill(d, L.hitTest(5, ...Object.values(L.centroid(L.mk(0, 0, 0, 1)))));
  assert.equal(r.leaves.length, 1);
  assert.equal(r.leaves[0].cell.l, 0);
});

test('an empty fill uses cells at the active level and goes finer only beside finer detail', () => {
  const d = new Drawing();
  const fine = L.mk(4, 1, 1, 1);
  d.paint(fine, { c: '#000000' });
  const box = (c) => { const w = L.centroid(c); return Math.abs(w.x) < 1 && Math.abs(w.y) < 1; };
  const r = floodFill(d, L.mk(2, -1, -1, 1), { inBounds: box });
  assert.equal(r.tooBig, false);
  const levels = new Set(r.leaves.map((x) => x.cell.l));
  assert.ok(levels.has(2));
  assert.ok(Math.max(...levels) <= 4);
  assert.ok(!r.leaves.some((x) => L.sameCell(x.cell, fine)));
  // Paint them: the black cell survives and the invariant holds.
  for (const leaf of r.leaves) d.paint(leaf.cell, { c: '#00ff00' });
  assert.equal(d.get(fine).c, '#000000');
  assert.equal(d.checkInvariant(), null);
  const fineCount = r.leaves.filter((x) => x.cell.l > 2).length;
  assert.ok(fineCount <= 12, `fine leaves ${fineCount}`);
});

test('an unbounded empty fill gives up past the cap', () => {
  const d = new Drawing();
  const r = floodFill(d, L.mk(3, 0, 0, 1), { maxCells: 500 });
  assert.equal(r.tooBig, true);
});

test('fill matches color only: a different color is a wall', () => {
  const d = new Drawing();
  d.paint(L.mk(1, 0, 0, 1), { c: '#ff0000' });
  d.paint(L.mk(1, 0, 0, 0), { c: '#ff0000' });
  d.paint(L.mk(1, 0, 1, 1), { c: '#0000ff' });
  const r = floodFill(d, L.mk(1, 0, 0, 1));
  assert.equal(r.leaves.length, 2);
});

test('a fill too big for the cap fills bigger cells instead of refusing', async () => {
  const { fillAt } = await import('../web/engine/fill.js');
  const d = new Drawing();
  const box = (c) => { const w = L.centroid(c); return Math.abs(w.x) < 2 && Math.abs(w.y) < 2; };
  const r = fillAt(d, 0.01, 0.01, 6, { inBounds: box, maxCells: 2000 });
  assert.equal(r.tooBig, false);
  assert.ok(r.level < 6, `filled at level ${r.level}`);
  assert.ok(r.leaves.length <= 2000 && r.leaves.length > 0);
  // Small enough at the asked level: it stays there.
  assert.equal(fillAt(d, 0.01, 0.01, 2, { inBounds: box, maxCells: 2000 }).level, 2);
});
