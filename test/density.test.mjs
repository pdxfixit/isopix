// Selection density change: refine is lossless, coarsen is Crisp or Blend,
// hidden children come back on refine, undo reverses, and the marquee snaps.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as L from '../web/engine/lattice.js';
import { Drawing } from '../web/engine/model.js';
import * as D from '../web/engine/density.js';
import * as B from '../web/engine/brushes.js';
import { hexToOklab } from '../web/engine/color.js';

const near = (a, b) => Math.abs(a - b) < 1e-12;
const snapshot = (d) => JSON.stringify([...d.cells].map(([k, v]) => [k, v.c, v.f || null]).sort());
const regionHex = (l, k) => D.makeRegion(l, B.hexagon({ l, p: 0, q: 0 }, k).cells);

test('refine is lossless: every cell becomes four children of the same color', () => {
  const d = new Drawing();
  const r = regionHex(2, 2);
  for (const c of D.regionCells(r)) d.paint(c, { c: c.u ? '#ff0000' : '#0000ff' });
  const before = d.area();
  d.begin();
  const out = D.changeDensity(d, r, 3);
  d.commit();
  assert.equal(out, r);
  assert.equal(d.cells.size, 4 * 24);
  assert.ok(near(d.area(), before));
  assert.ok([...d.cells.keys()].every((k) => L.parseKey(k).l === 3));
  assert.equal(d.checkInvariant(), null);
});

test('coarsen then refine restores the hidden children exactly; undo reverses', () => {
  const d = new Drawing();
  const r = regionHex(1, 1);
  let i = 0;
  for (const c of D.regionCells(r)) for (const ch of L.children(c)) d.paint(ch, { c: ['#ff0000', '#00ff00', '#0000ff'][i++ % 3] });
  const fine = snapshot(d);
  d.begin(); D.changeDensity(d, r, 1, { mode: 'crisp' }); d.commit();
  assert.ok([...d.cells.keys()].every((k) => L.parseKey(k).l === 1));
  d.begin(); D.changeDensity(d, r, 2); d.commit();
  assert.equal(snapshot(d), fine);
  d.undo(); d.undo();
  assert.equal(snapshot(d), fine);
  assert.equal(d.checkInvariant(), null);
});

test('hidden children are dropped once the cell is painted on', () => {
  const d = new Drawing();
  const cell = L.mk(1, 0, 0, 1);
  const r = D.makeRegion(1, [cell]);
  const kids = L.children(cell);
  kids.forEach((k, i) => d.paint(k, { c: i < 3 ? '#ff0000' : '#00ff00' }));
  D.changeDensity(d, r, 1);
  assert.equal(d.get(cell).c, '#ff0000');
  d.paint(cell, { c: '#123456' });
  D.changeDensity(d, r, 2);
  assert.ok(kids.every((k) => d.get(k).c === '#123456'));
});

test('crisp: majority wins; a tie goes to the most recently painted child', () => {
  const d = new Drawing();
  const cell = L.mk(0, 0, 0, 1);
  const kids = L.children(cell);
  d.paint(kids[0], { c: '#ff0000' }); d.paint(kids[1], { c: '#0000ff' });
  d.paint(kids[2], { c: '#0000ff' }); d.paint(kids[3], { c: '#ff0000' });
  D.changeDensity(d, D.makeRegion(0, [cell]), 0, { mode: 'crisp' });
  assert.equal(d.get(cell).c, '#ff0000'); // kids[3] (red) was painted last
  const d2 = new Drawing();
  d2.paint(kids[0], { c: '#00ff00' }); d2.paint(kids[1], { c: '#00ff00' }); d2.paint(kids[2], { c: '#00ff00' }); d2.paint(kids[3], { c: '#ff0000' });
  D.changeDensity(d2, D.makeRegion(0, [cell]), 0, { mode: 'crisp' });
  assert.equal(d2.get(cell).c, '#00ff00');
});

test('blend averages in Oklab, and snap maps to the nearest palette color', () => {
  const d = new Drawing();
  const cell = L.mk(0, 0, 0, 1);
  const kids = L.children(cell);
  kids.forEach((k, i) => d.paint(k, { c: i % 2 ? '#000000' : '#ffffff' }));
  D.changeDensity(d, D.makeRegion(0, [cell]), 0, { mode: 'blend' });
  const lab = hexToOklab(d.get(cell).c);
  assert.ok(Math.abs(lab[0] - 0.5) < 0.01, `L = ${lab[0]}`);
  const d2 = new Drawing();
  kids.forEach((k, i) => d2.paint(k, { c: i % 2 ? '#000000' : '#ffffff' }));
  D.changeDensity(d2, D.makeRegion(0, [cell]), 0, { mode: 'blend', snap: true, palette: ['#ff0000', '#777777'] });
  assert.equal(d2.get(cell).c, '#777777');
});

test('coarse cells that straddle the selection border split first', () => {
  const d = new Drawing();
  const big = L.mk(0, 0, 0, 1);
  d.paint(big, { c: '#ff0000' });
  const kids = L.children(big);
  const r = D.makeRegion(1, [kids[0]]); // one quarter of the big cell
  D.changeDensity(d, r, 2);
  assert.equal(d.get(big), undefined);
  assert.equal(d.get(kids[1]).c, '#ff0000');
  assert.ok(near(d.area(), 1));
  assert.equal(d.checkInvariant(), null);
});

test('coarsening below the marquee level snaps the marquee to that level', () => {
  const r = regionHex(2, 2); // radius 2 at level 2 = radius 1 at level 1
  const s = D.snapRegion(r, 1);
  assert.equal(s.keys.size, 6);
  assert.equal(D.coarsestReachable(r), 1);
  const odd = regionHex(2, 1); // radius 1 at level 2 has no whole level-1 cell
  assert.equal(D.snapRegion(odd, 1).keys.size, 0);
  const d = new Drawing();
  assert.equal(D.changeDensity(d, odd, 1), null);
});

test('coarsen to below the marquee level merges level-by-level', () => {
  const d = new Drawing();
  const r = regionHex(2, 2);
  for (const c of D.regionCells(r)) d.paint(c, { c: '#ff0000' });
  d.begin();
  const out = D.changeDensity(d, r, 1, { mode: 'crisp' });
  d.commit();
  assert.equal(out.l, 1);
  assert.equal(d.cells.size, 6);
  d.undo();
  assert.equal(d.cells.size, 24);
});

test('density of a region is the finest level painted in it', () => {
  const d = new Drawing();
  const r = regionHex(1, 1);
  d.paint(L.hitTest(5, 0.05, 0.1), { c: '#ff0000' });
  assert.equal(D.densityOf(d, r), 5);
});

test('edges refine into halves and coarsen back', () => {
  const d = new Drawing();
  const r = regionHex(1, 2);
  d.setEdge(L.edgeKey({ l: 1, p: 0, q: 0, d: 0 }), { c: '#000000', t: 1 });
  D.changeDensity(d, r, 2);
  assert.deepEqual([...d.edges.keys()].sort(), ['2,0,0,0', '2,1,0,0']);
  D.changeDensity(d, r, 1);
  assert.deepEqual([...d.edges.keys()], ['1,0,0,0']);
});

test('stamps: extract and place at the same level reproduce the cells; at a coarser level they scale up exactly', () => {
  const d = new Drawing();
  const A = { l: 3, p: 0, q: 0 };
  const r = D.makeRegion(3, B.hexagon(A, 1).cells);
  B.hexagon(A, 1).cells.forEach(({ cell, f }) => d.paint(cell, { c: '#ff0000', f }));
  const st = D.extractStamp(d, r, A);
  assert.equal(st.cells.length, 6);
  const same = D.placeStamp(st, { l: 3, p: 5, q: -2 });
  assert.deepEqual(same.cells.map((x) => L.cellKey(x.cell)).sort(), B.hexagon({ l: 3, p: 5, q: -2 }, 1).cells.map((x) => L.cellKey(x.cell)).sort());
  // At level 2 the same six cells are twice the size: a radius-1 hexagon at level 2.
  const big = D.placeStamp(st, { l: 2, p: 0, q: 0 });
  assert.deepEqual(big.cells.map((x) => L.cellKey(x.cell)).sort(), B.hexagon({ l: 2, p: 0, q: 0 }, 1).cells.map((x) => L.cellKey(x.cell)).sort());
  assert.ok(big.cells.every((x) => x.f));
});

test('region boundary of a radius-k hexagon has 6k edges', () => {
  const r = regionHex(0, 2);
  assert.equal(D.regionBoundary(r).length, 12);
});

test('a cell Crisp leaves empty keeps its children too: refine restores them', () => {
  const d = new Drawing();
  const cell = L.mk(1, 0, 0, 1);
  const r = D.makeRegion(1, [cell]);
  const kid = L.children(cell)[0];
  d.paint(kid, { c: '#ff0000' }); // one painted child, three empty: majority empty
  D.changeDensity(d, r, 1, { mode: 'crisp' });
  assert.equal(d.cells.size, 0);
  D.changeDensity(d, r, 2);
  assert.equal(d.get(kid).c, '#ff0000');
  assert.equal(d.cells.size, 1);
});

test('painting over a coarsened cell drops its hidden children (protect against resurrection)', () => {
  const d = new Drawing();
  const cell = L.mk(1, 0, 0, 1);
  const r = D.makeRegion(1, [cell]);
  d.paint(L.children(cell)[0], { c: '#ff0000' });
  D.changeDensity(d, r, 1, { mode: 'crisp' });
  d.paint(cell, { c: '#00ff00' });
  d.paint(cell, null);
  D.changeDensity(d, r, 2);
  assert.equal(d.cells.size, 0);
});

test('bold edges inside a coarser cell are kept hidden on coarsen and come back exactly on refine', async () => {
  const P = await import('../web/engine/project.js');
  const d = new Drawing();
  const r = regionHex(1, 2);
  // Level-2 edges: one inside a level-1 cell (q = 1 is not on level 1), one half of a level-1 edge.
  const inner = { l: 2, p: 0, q: 1, d: 0 }, half = { l: 2, p: 0, q: 0, d: 0 };
  d.begin(); d.paintEdge(inner, { c: '#111111' }); d.paintEdge(half, { c: '#222222' }); d.commit();
  const before = JSON.stringify([...d.edges].map(([k, v]) => [k, v.c]).sort());
  d.begin(); D.changeDensity(d, r, 1); d.commit();
  assert.deepEqual([...d.edges.keys()], ['1,0,0,0'], 'the inner edge hides, the half merges');
  // Through a project file and back, then refine.
  const e = P.load(JSON.parse(JSON.stringify(P.save(d))));
  for (const dr of [d, e]) {
    dr.begin(); D.changeDensity(dr, r, 2); dr.commit();
    assert.equal(JSON.stringify([...dr.edges].map(([k, v]) => [k, v.c]).sort()), before, 'exactly the two original edges, not both halves');
  }
  d.undo(); d.undo();
  assert.equal(JSON.stringify([...d.edges].map(([k, v]) => [k, v.c]).sort()), before, 'undo reverses both');
});

test('drawing over a cell ends the promise for edges hidden in it', () => {
  const d = new Drawing();
  const r = regionHex(1, 2);
  d.paintEdge({ l: 2, p: 0, q: 1, d: 0 }, { c: '#111111' });
  D.changeDensity(d, r, 1);
  const cell = L.edgeCells({ l: 2, p: 0, q: 1, d: 0 }).map(L.parent)[0];
  d.paint(cell, { c: '#ff0000' });
  D.changeDensity(d, r, 2);
  assert.ok(!d.edges.has('2,0,1,0'), 'painted over: the hidden edge is gone');
});
