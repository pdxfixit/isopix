// Output and the rest: SVG merging, project round trip, replay, view and
// level-follow hysteresis, color shading.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as L from '../web/engine/lattice.js';
import { Drawing } from '../web/engine/model.js';
import * as P from '../web/engine/project.js';
import { mergeLoops, toSVG } from '../web/engine/svg.js';
import { View, followLevel, targetPx, notchFor } from '../web/engine/view.js';
import * as C from '../web/engine/color.js';
import * as B from '../web/engine/brushes.js';

test('SVG: a solid hexagon of one color merges into one 6-point loop', () => {
  const cells = B.hexagon({ l: 1, p: 0, q: 0 }, 2).cells.map((x) => x.cell);
  const loops = mergeLoops(cells, 1);
  assert.equal(loops.length, 1);
  assert.equal(loops[0].length, 6);
});

test('SVG: mixed levels merge without T-junction gaps', () => {
  const big = L.mk(0, 0, 0, 1);
  const kids = L.children(big);
  const cells = [kids[0], kids[1], ...L.children(kids[2]), kids[3]];
  const loops = mergeLoops(cells, 2);
  assert.equal(loops.length, 1);
  assert.equal(loops[0].length, 3); // the big triangle again
});

test('SVG: a ring gives an outer loop and a hole', () => {
  const A = { l: 0, p: 0, q: 0 };
  const inner = new Set(B.hexagon(A, 1).cells.map((x) => L.cellKey(x.cell)));
  const ring = B.hexagon(A, 2).cells.map((x) => x.cell).filter((c) => !inner.has(L.cellKey(c)));
  assert.equal(mergeLoops(ring, 0).length, 2);
});

test('SVG export has one path per color plus edge lines', () => {
  const d = new Drawing();
  d.paint(L.mk(1, 0, 0, 1), { c: '#ff0000' });
  d.paint(L.mk(1, 0, 0, 0), { c: '#ff0000' });
  d.paint(L.mk(2, 5, 5, 1), { c: '#00ff00' });
  d.paintEdge({ l: 1, p: 0, q: 0, d: 0 }, { c: '#000000' });
  const svg = toSVG(d);
  assert.equal((svg.match(/<path /g) || []).length, 2);
  assert.equal((svg.match(/<line /g) || []).length, 1);
  assert.ok(svg.startsWith('<svg xmlns="http://www.w3.org/2000/svg"'));
});

test('project round trip keeps cells, edges, hidden children, the log, and the next id', () => {
  const d = new Drawing();
  d.begin(); d.paint(L.mk(0, 0, 0, 1), { c: '#ff0000', f: 'T' }); d.commit();
  d.begin(); d.paint(L.mk(3, 1, 1, 1), { c: '#00ff00' }); d.paintEdge({ l: 2, p: 1, q: 1, d: 2 }, { c: '#000000' }); d.commit();
  const json = JSON.parse(JSON.stringify(P.save(d, { settings: { a: 1 } })));
  const e = P.load(json);
  assert.deepEqual([...e.cells], [...d.cells]);
  assert.deepEqual([...e.edges], [...d.edges]);
  assert.equal(e.undoStack.length, 2);
  assert.equal(e.checkInvariant(), null);
  assert.ok(e.seq >= d.seq);
  e.undo();
  assert.equal(e.cells.size, 1);
});

test('project load refuses bad files', () => {
  assert.throws(() => P.load({ format: 'nope' }));
  // Files saved before the 1.0 rename (format 'isogrid') still open.
  assert.equal(P.load({ format: 'isogrid', version: 1, cells: [['0,0,0,1', { c: '#ff0000' }]] }).cells.get('0,0,0,1').c, '#ff0000');
  assert.throws(() => P.load({ format: 'isopix', version: 1, cells: [['9,0,0,1', { c: '#fff000' }]] }));
  assert.throws(() => P.load({ format: 'isopix', version: 1, cells: [['0,0,0,1', { c: 'red' }]] }));
  assert.throws(() => P.load({ format: 'isopix', version: 1, cells: [['0,0,0,1', { c: '#ff0000' }], ['1,0,0,1', { c: '#ff0000' }]] }));
  assert.throws(() => P.load({ format: 'isopix', version: 99 }));
});

test('replay walks the log from empty to the current drawing', () => {
  const d = new Drawing();
  for (let i = 0; i < 5; i++) { d.begin(); d.paint(L.mk(1, i, 0, 1), { c: '#ff0000' }); d.commit(); }
  const states = [];
  for (const s of P.replay(d.undoStack)) states.push(s.cells.size);
  assert.deepEqual(states, [0, 1, 2, 3, 4, 5]);
});

test('view: zoomAt keeps the world point under the pointer fixed', () => {
  const v = new View(800, 600);
  const before = v.toWorld(123, 456);
  v.zoomAt(123, 456, 3.7);
  const after = v.toWorld(123, 456);
  assert.ok(Math.abs(before[0] - after[0]) < 1e-12 && Math.abs(before[1] - after[1]) < 1e-12);
});

test('level follows zoom, with hysteresis so it does not flicker at a boundary', () => {
  const t = 32; // a 32 px target: level 3 is exact at zoom 256
  assert.equal(followLevel(256, t, null), 3); // level-3 edge = 32 px at zoom 256
  // Right at the halfway point the level holds; a little past the band it moves.
  const half = 256 * 2 ** 0.5;
  assert.equal(followLevel(half * 1.01, t, 3), 3);
  assert.equal(followLevel(half * 0.99, t, 3), 3);
  assert.equal(followLevel(256 * 2 ** 0.7, t, 3), 4);
  assert.equal(followLevel(256 * 2 ** 0.6, t, 4), 4);  // back inside the band: stays 4
  assert.equal(followLevel(256 * 2 ** -0.7, t, 3), 2);
  assert.equal(followLevel(1e9, t, 7), 7);
  assert.equal(followLevel(1, t, 0), 0);
});

test('shading: top lighter than left lighter than right, left is the base', () => {
  for (const hex of ['#3a86ff', '#e63946', '#f1faee', '#1d1d1f']) {
    const [t, l, r] = ['T', 'L', 'R'].map((f) => C.hexToOklab(C.shade(hex, f))[0]);
    assert.ok(t > l && l > r, hex);
  }
  assert.equal(C.shade('#3a86ff', 'L'), '#3a86ff');
});

test('oklab round trip', () => {
  for (const hex of ['#000000', '#ffffff', '#3a86ff', '#e63946', '#2a9d8f']) assert.equal(C.oklabToHex(C.hexToOklab(hex)), hex);
});

test('notches spread from 96 to 6 px, evenly in log scale, and notchFor inverts them', () => {
  assert.ok(Math.abs(targetPx(0) - 96) < 1e-9);
  assert.ok(Math.abs(targetPx(7) - 6) < 1e-9);
  const r = targetPx(1) / targetPx(0);
  for (let n = 1; n < 8; n++) assert.ok(Math.abs(targetPx(n) / targetPx(n - 1) - r) < 1e-9);
  for (let n = 0; n < 8; n++) assert.equal(notchFor(targetPx(n)), n);
  assert.equal(notchFor(1000), 0);
  assert.equal(notchFor(1), 7);
});

test('paper: saved with the drawing; an old project without it opens light', async () => {
  const d = new Drawing();
  d.paper = 'dark';
  d.begin(); d.paint(L.mk(1, 0, 0, 1), { c: '#74c0fc' }); d.commit();
  const back = P.load(JSON.parse(JSON.stringify(P.save(d))));
  assert.equal(back.paper, 'dark');
  const old = P.save(d); delete old.paper;
  assert.equal(P.load(JSON.parse(JSON.stringify(old))).paper, 'light');
  assert.equal(P.load({ ...P.save(d), paper: 'purple' }).paper, 'light');
});

test('inks follow the paper; flipping keeps the chosen ink by position, custom colors stay', async () => {
  const { PAPERS, matchInk, inkName } = await import('../web/engine/paper.js');
  assert.equal(PAPERS.light.inks.length, PAPERS.dark.inks.length);
  assert.equal(matchInk(PAPERS.light.inks[5], 'light', 'dark'), PAPERS.dark.inks[5]);
  assert.equal(matchInk('#123456', 'light', 'dark'), '#123456');
  assert.equal(inkName('dark', PAPERS.dark.inks[0]), 'Red');
  // Every dark-paper ink stands out from the dark paper (Oklab lightness gap).
  for (const c of PAPERS.dark.inks) assert.ok(C.hexToOklab(c)[0] - C.hexToOklab(PAPERS.dark.bg)[0] > 0.25, c);
  for (const c of PAPERS.light.inks.filter((x) => x !== '#f1faee')) assert.ok(C.hexToOklab(PAPERS.light.bg)[0] - C.hexToOklab(c)[0] > 0.05, c);
});

test('SVG export can paint the paper', () => {
  const d = new Drawing();
  d.paint(L.mk(1, 0, 0, 1), { c: '#74c0fc' });
  assert.ok(toSVG(d, { background: '#1f2228' }).includes('fill="#1f2228"'));
});

test('the trace picture saves with the drawing and loads back; files without one still open', () => {
  const d = new Drawing();
  d.paint(L.mk(1, 0, 0, 1), { c: '#e63946' });
  const src = 'data:image/png;base64,iVBORw0KGgo=';
  const withPic = JSON.parse(JSON.stringify(P.save(d, { trace: { src, rect: { x: -1, y: -0.5, w: 2, h: 1 } } })));
  assert.deepEqual(P.traceOf(withPic), { src, rect: { x: -1, y: -0.5, w: 2, h: 1 } });
  assert.equal(P.load(withPic).cells.size, 1);
  const without = JSON.parse(JSON.stringify(P.save(d)));
  assert.equal(P.traceOf(without), null);
  assert.equal(P.load(without).cells.size, 1);
  // Untrusted input: not an image data URL, or a broken rect, is ignored.
  assert.equal(P.traceOf({ trace: { src: 'javascript:alert(1)', rect: { x: 0, y: 0, w: 1, h: 1 } } }), null);
  assert.equal(P.traceOf({ trace: { src, rect: { x: 0, y: 0, w: -1, h: 1 } } }), null);
});

test('a big photo is made smaller to 2048 px on its long side; a small one is left alone', () => {
  assert.deepEqual(P.fitWithin(4032, 3024), { w: 2048, h: 1536, scaled: true });
  assert.deepEqual(P.fitWithin(1000, 3000), { w: 683, h: 2048, scaled: true });
  assert.deepEqual(P.fitWithin(800, 600), { w: 800, h: 600, scaled: false });
});
