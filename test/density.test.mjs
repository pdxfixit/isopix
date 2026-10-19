// Selection density change: refine is lossless, coarsen is Crisp or Blend,
// hidden children come back on refine, undo reverses, and the marquee snaps.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as L from '../web/engine/lattice.js';
import { Drawing } from '../web/engine/model.js';
import * as D from '../web/engine/density.js';
import * as B from '../web/engine/brushes.js';
import { hexToOklab } from '../web/engine/color.js';
import * as P from '../web/engine/project.js';

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

test('after a reload, Undo of a Finer then Finer again still brings the fine detail back', () => {
  // Card 13 (owner, 2026-10-16: "(a)"): Finer leaves the coarse cell's hidden
  // children stale, and Undo makes them live again, so a file must keep them.
  const d = new Drawing();
  const cell = L.mk(1, 0, 0, 1);
  const r = D.makeRegion(1, [cell]);
  d.begin(); L.children(cell).forEach((k, i) => d.paint(k, { c: ['#ff0000', '#00ff00', '#0000ff', '#ff0000'][i] })); d.commit();
  const fine = snapshot(d);
  d.begin(); D.changeDensity(d, r, 1); d.commit(); // Coarser: one red cell, the detail hidden under it
  d.begin(); D.changeDensity(d, r, 2); d.commit(); // Finer: the detail is back
  const reloaded = P.load(JSON.parse(JSON.stringify(P.save(d))));
  reloaded.undo(); // the Finer: one red cell again
  assert.equal(reloaded.cells.size, 1);
  reloaded.begin(); D.changeDensity(reloaded, r, 2); reloaded.commit();
  assert.equal(snapshot(reloaded), fine);
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

// Rotate and flip a selection (owner, 2026-10-16: "rotate/flip is great").
test('six turns, or two flips, give back the exact drawing; the hexagon turns in place', () => {
  const d = new Drawing();
  const A = { l: 2, p: 2, q: 2 };
  const r = D.makeRegion(2, B.hexagon(A, 2).cells);
  d.begin();
  // An asymmetric picture: a cube's faces, one finer cell and a bold edge.
  B.hexagon(A, 1).cells.forEach(({ cell, f }) => d.paint(cell, { c: '#3a86ff', f }));
  d.paint(L.children(L.mk(2, 2, 3, 1))[0], { c: '#e63946' });
  d.setEdge(L.edgeKey({ l: 2, p: 2, q: 2, d: 0 }), { c: '#000000', t: 1 });
  d.commit();
  const start = snapshot(d), edges = JSON.stringify([...d.edges.keys()].sort());
  assert.deepEqual(D.pivotOf(r), A, 'a hexagon selection pivots on its own center');
  let reg = r;
  for (let i = 0; i < 6; i++) {
    d.begin(); reg = D.transformRegion(d, reg, D.pivotOf(reg), D.TURN); d.commit();
    if (i === 0) assert.notEqual(snapshot(d), start, 'one turn changes it');
    assert.equal(d.checkInvariant(), null);
  }
  assert.equal(snapshot(d), start, 'six turns: the same cells, colors and faces');
  assert.equal(JSON.stringify([...d.edges.keys()].sort()), edges, 'and the same bold edge');
  assert.deepEqual([...reg.keys].sort(), [...r.keys].sort(), 'the hexagon turned onto itself');
  d.begin(); reg = D.transformRegion(d, reg, D.pivotOf(reg), D.FLIP); d.commit();
  assert.notEqual(snapshot(d), start, 'a flip changes it');
  d.begin(); reg = D.transformRegion(d, reg, D.pivotOf(reg), D.FLIP); d.commit();
  assert.equal(snapshot(d), start, 'two flips give it back');
  d.undo(); d.undo();
  assert.equal(d.checkInvariant(), null);
});

test('a turn moves a cell 60° clockwise on screen; a flip mirrors it left to right', () => {
  const A = { l: 2, p: 2, q: 2 }, o = L.vertexWorld(2, 2, 2);
  const r = D.makeRegion(2, B.hexagon(A, 2).cells);
  const where = (d) => { const c = L.centroid(L.parseKey([...d.cells.keys()][0])); return { x: c.x - o.x, y: c.y - o.y }; };
  const angle = ({ x, y }) => (Math.atan2(y, x) * 180) / Math.PI; // screen: y down, so a bigger angle is clockwise
  const one = () => { const d = new Drawing(); d.begin(); d.paint(B.hexagon(A, 2).cells.find(({ cell }) => L.centroid(cell).y < o.y - 0.01).cell, { c: '#e63946' }); d.commit(); return d; };
  const d = one(), before = where(d);
  d.begin(); D.transformRegion(d, r, A, D.TURN); d.commit();
  const turned = (angle(where(d)) - angle(before) + 360) % 360;
  assert.ok(Math.abs(turned - 60) < 1e-6, `turned ${turned}°`);
  const e = one(), b2 = where(e);
  e.begin(); D.transformRegion(e, r, A, D.FLIP); e.commit();
  const after = where(e);
  assert.ok(Math.abs(after.x + b2.x) < 1e-9 && Math.abs(after.y - b2.y) < 1e-9, 'mirrored across the vertical line through the pivot');
});

// Bigger and Smaller (owner, card 14: "yes, do A").
const box = (d) => {
  const ws = [...d.cells.keys()].flatMap((k) => L.cellWorldVerts(L.parseKey(k)));
  const xs = ws.map((w) => w.x), ys = ws.map((w) => w.y);
  return { x0: Math.min(...xs), x1: Math.max(...xs), y0: Math.min(...ys), y1: Math.max(...ys) };
};
const cube = (l) => {
  // A cube (hexagon of faces) at level l, one finer cell, a cell lit from the right and a bold edge.
  const d = new Drawing(), A = { l, p: 4, q: 4 };
  d.begin();
  B.hexagon(A, 1).cells.forEach(({ cell, f }) => d.paint(cell, { c: '#3a86ff', f }));
  d.paint(L.children(L.mk(l, 4, 4, 1))[0], { c: '#e63946' });
  d.paint(L.mk(l, 3, 4, 0), { c: '#123456', f: 'R', s: 'r', b: '#3a86ff' });
  d.setEdge(L.edgeKey({ l, p: 4, q: 4, d: 0 }), { c: '#000000', t: 1 });
  d.commit();
  return { d, r: D.makeRegion(l, B.hexagon(A, 2).cells) };
};
const full = (d) => JSON.stringify([[...d.cells].map(([k, v]) => [k, v.c, v.f || null, v.s || null, v.b || null]).sort(), [...d.edges.keys()].sort()]);

test('Bigger then Smaller gives back the exact drawing and selection; one undo each', () => {
  const { d, r } = cube(3);
  const start = full(d);
  d.begin(); const big = D.scaleRegion(d, r, 1); d.commit();
  assert.equal(big.l, 2, 'the selection moves a level coarser');
  assert.equal(big.keys.size, r.keys.size);
  assert.equal(d.checkInvariant(), null);
  assert.notEqual(full(d), start);
  assert.ok([...d.cells.values()].some((v) => v.s === 'r' && v.b === '#3a86ff'), 'the lit side and base color move with the cell');
  assert.ok(d.edges.has(L.edgeKey({ l: 2, p: 4, q: 4, d: 0 })) === false && d.edges.size === 1, 'the bold edge moves too');
  d.begin(); const back = D.scaleRegion(d, big, -1); d.commit();
  assert.equal(full(d), start, 'Smaller undoes Bigger exactly');
  assert.deepEqual([...back.keys].sort(), [...r.keys].sort());
  d.undo(); d.undo();
  assert.equal(full(d), start);
});

test('Bigger twice then Smaller twice, and Smaller then Bigger, land exactly where they began', () => {
  const { d, r } = cube(3);
  const start = full(d);
  let reg = r;
  for (const dir of [1, 1, -1, -1, -1, 1]) {
    d.begin(); reg = D.scaleRegion(d, reg, dir); d.commit();
    assert.equal(d.checkInvariant(), null);
  }
  assert.equal(full(d), start);
  assert.deepEqual([...reg.keys].sort(), [...r.keys].sort());
});

test('Bigger doubles the picture about the middle of its bottom, which stays put', () => {
  const { d, r } = cube(3);
  const a = box(d);
  d.begin(); D.scaleRegion(d, r, 1); d.commit();
  const b = box(d);
  const near2 = (x, y) => Math.abs(x - y) < 1e-9;
  assert.ok(near2(b.x1 - b.x0, 2 * (a.x1 - a.x0)) && near2(b.y1 - b.y0, 2 * (a.y1 - a.y0)), 'twice as wide and tall');
  assert.ok(near2(b.y1, a.y1), 'the bottom stays where it was');
  assert.ok(Math.abs((b.x0 + b.x1) / 2 - (a.x0 + a.x1) / 2) <= L.edgeLen(2), 'and the middle within one new edge');
});

test('Smaller coarsens the finest detail first; neither goes past the ends', () => {
  const l = L.MAX_LEVEL - 1;
  const { d, r } = cube(l); // its finer cell is at the finest level
  d.begin(); const small = D.scaleRegion(d, r, -1, { mode: 'crisp' }); d.commit();
  assert.equal(small.l, L.MAX_LEVEL);
  assert.equal(d.checkInvariant(), null);
  assert.ok([...d.cells.keys()].every((k) => L.parseKey(k).l <= L.MAX_LEVEL));
  assert.equal(D.scaleRegion(d, small, -1), null, 'nothing is smaller than the finest level');
  assert.equal(D.scaleRegion(new Drawing(), D.makeRegion(0, [L.mk(0, 0, 0, 1)]), 1), null, 'nothing is bigger than level 0');
});

// Light direction (owner, card 12: "c").
test('light from the right swaps the left and right tones; the top stays', async () => {
  const { shade, baseOf } = await import('../web/engine/color.js');
  const b = '#3a86ff';
  assert.equal(shade(b, 'T', 'right'), shade(b, 'T', 'left'));
  assert.equal(shade(b, 'L', 'right'), shade(b, 'R', 'left'));
  assert.equal(shade(b, 'R', 'right'), shade(b, 'L', 'left'));
  // Worked back from a tone (cells painted before they kept their base): close,
  // not exact: 8-bit colors round, and a bright tone is clipped to the screen's colors.
  // Relight only turns side faces (a top looks the same from either side).
  for (const base of ['#3a86ff', '#e63946', '#5a9a3c', '#f4c430']) for (const f of ['L', 'R']) for (const side of ['left', 'right']) {
    const [L1, a1, b1] = hexToOklab(baseOf(shade(base, f, side), f, side)), [L0, a0, b0] = hexToOklab(base);
    assert.ok(Math.hypot(L1 - L0, a1 - a0, b1 - b0) < 0.04, `${base} ${f} ${side}: the base comes back close`);
  }
});

test('Relight shades a cube for the other side, and back again exactly', async () => {
  const { shade } = await import('../web/engine/color.js');
  const d = new Drawing();
  const A = { l: 2, p: 2, q: 2 };
  const r = D.makeRegion(2, B.hexagon(A, 1).cells);
  d.begin(); B.hexagon(A, 1).cells.forEach(({ cell, f }) => d.paint(cell, { c: shade('#3a86ff', f), f, b: '#3a86ff' })); d.commit();
  const start = snapshot(d);
  d.begin(); assert.equal(D.relightRegion(d, r, 'right'), 4, 'the four side cells; the two top cells stay'); d.commit();
  for (const [, v] of d.cells) assert.equal(v.c, shade('#3a86ff', v.f, 'right'), `face ${v.f} lit from the right`);
  d.begin(); D.relightRegion(d, r, 'left'); d.commit();
  assert.equal(snapshot(d), start, 'and back');
  assert.equal(d.checkInvariant(), null);
});

test('a flipped cube is lit from the other side, and Relight lights it back', async () => {
  const { shade } = await import('../web/engine/color.js');
  const d = new Drawing();
  const A = { l: 2, p: 2, q: 2 };
  const r = D.makeRegion(2, B.hexagon(A, 1).cells);
  d.begin(); B.hexagon(A, 1).cells.forEach(({ cell, f }) => d.paint(cell, { c: shade('#3a86ff', f), f, b: '#3a86ff' })); d.commit();
  d.begin(); const reg = D.transformRegion(d, r, D.pivotOf(r), D.FLIP); d.commit();
  for (const [, v] of d.cells) assert.equal(v.c, shade('#3a86ff', v.f, 'right'), `a mirror: face ${v.f} lit from the right`);
  d.begin(); assert.equal(D.relightRegion(d, reg, 'left'), 4, 'Relight turns the four side cells'); d.commit();
  for (const [, v] of d.cells) assert.equal(v.c, shade('#3a86ff', v.f, 'left'), `face ${v.f} lit from the left again`);
  assert.equal(d.checkInvariant(), null);
});

test('a file with a bad base color or light mark on a cell is refused', async () => {
  const P = await import('../web/engine/project.js');
  const d = new Drawing(); d.begin(); d.paint(L.mk(2, 0, 0, 1), { c: '#3a86ff', f: 'L', b: '#3a86ff', s: 'r' }); d.commit();
  const good = JSON.parse(JSON.stringify(P.save(d)));
  assert.equal(P.load(good).cells.size, 1);
  for (const bad of [{ b: 'red' }, { s: 'x' }]) {
    const f = JSON.parse(JSON.stringify(good)); Object.assign(f.app.faces['2,0,0,1'], bad);
    assert.throws(() => P.load(f), /bad cell/);
  }
});

test('a drawing keeps its light side in a file; older files open lit from the left', async () => {
  const P = await import('../web/engine/project.js');
  const d = new Drawing(); d.light = 'right';
  assert.equal(P.load(JSON.parse(JSON.stringify(P.save(d)))).light, 'right');
  const old = P.save(new Drawing()); delete old.light;
  assert.equal(P.load(old).light, 'left');
});
