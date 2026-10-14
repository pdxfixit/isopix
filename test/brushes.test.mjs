// Brush shapes, drag shapes, strips, edge lines and cube-face shading.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as L from '../web/engine/lattice.js';
import * as B from '../web/engine/brushes.js';

const keys = (items) => items.map((i) => L.cellKey(i.cell || i)).sort();

test('triangle brush is the hit cell', () => {
  const r = B.brushCells('triangle', 3, 0.11, 0.07);
  assert.deepEqual(keys(r), [L.cellKey(L.hitTest(3, 0.11, 0.07))]);
});

test('rhombus pairs the hit cell with its neighbor across the nearest edge and tags the face', () => {
  const l = 0;
  const up = L.mk(l, 0, 0, 1);
  // Near the vertical edge (b small) -> neighbor down(0,-1), top face.
  let w = L.latticeToWorld(l, 0.45, 0.05);
  let r = B.brushCells('rhombus', l, w.x, w.y);
  assert.deepEqual(keys(r), keys([up, L.mk(l, 0, -1, 0)]));
  assert.ok(r.every((x) => x.f === 'T'));
  // Near "/" edge (a+b ~ 1) -> down(0,0), left face.
  w = L.latticeToWorld(l, 0.45, 0.5);
  r = B.brushCells('rhombus', l, w.x, w.y);
  assert.deepEqual(keys(r), keys([up, L.mk(l, 0, 0, 0)]));
  assert.ok(r.every((x) => x.f === 'L'));
  // Near "\" edge (a small) -> down(-1,0), right face.
  w = L.latticeToWorld(l, 0.05, 0.45);
  r = B.brushCells('rhombus', l, w.x, w.y);
  assert.deepEqual(keys(r), keys([up, L.mk(l, -1, 0, 0)]));
  assert.ok(r.every((x) => x.f === 'R'));
});

test('hexagon brush: six cells around the nearest vertex, two of each face', () => {
  const w = L.vertexWorld(2, 1, 1);
  const r = B.brushCells('hexagon', 2, w.x + 0.01, w.y - 0.01);
  assert.deepEqual(keys(r), keys(L.cellsAroundVertex(2, 1, 1)));
  const count = { T: 0, L: 0, R: 0 };
  for (const x of r) count[x.f]++;
  assert.deepEqual(count, { T: 2, L: 2, R: 2 });
  // Faces match the brief's rule: dy < -0.25 s top; else dx > 0 right; else left.
  const s = L.edgeLen(2);
  for (const x of r) {
    const c = L.centroid(x.cell), dx = c.x - w.x, dy = c.y - w.y;
    assert.equal(x.f, dy < -0.25 * s ? 'T' : dx > 0 ? 'R' : 'L');
  }
});

test('trapezoid: three adjacent cells around the nearest vertex, including the hit cell', () => {
  const v = L.vertexWorld(1, 0, 0);
  const x = v.x + 0.05, y = v.y + 0.01;
  const r = B.brushCells('trapezoid', 1, x, y);
  assert.equal(r.length, 3);
  assert.ok(keys(r).includes(L.cellKey(L.hitTest(1, x, y))));
  const ring = new Set(L.cellsAroundVertex(1, 0, 0).map(L.cellKey));
  assert.ok(keys(r).every((k) => ring.has(k)));
});

test('big triangle: the four children of the parent cell', () => {
  const r = B.brushCells('bigtri', 3, 0.2, 0.3);
  const hit = L.hitTest(3, 0.2, 0.3);
  assert.deepEqual(keys(r), keys(L.children(L.parent(hit))));
  assert.equal(B.brushCells('bigtri', 0, 0.2, 0.3).length, 1);
});

test('drag parallelogram: n x m rhombi (2nm cells), face from the drag sector', () => {
  const A = { l: 2, p: 0, q: 0 };
  // Drag along +q (30 deg) and +p (90 deg): left face.
  let r = B.parallelogram(A, 2.1, 3.2);
  assert.equal(r.face, 'L');
  assert.equal(r.cells.length, 2 * r.n * r.m);
  // Drag between -30 and 30 deg: top face.
  r = B.parallelogram(A, -1, 3);
  assert.equal(r.face, 'T');
  assert.equal(r.cells.length, 2 * r.n * r.m);
  // Between 90 and 150: right face.
  r = B.parallelogram(A, 3, -1);
  assert.equal(r.face, 'R');
  // A tap still gives one rhombus.
  assert.equal(B.parallelogram(A, 0.01, 0.01).cells.length, 2);
});

test('drag hexagon: radius k holds 6k^2 cells, a third per face', () => {
  for (const k of [1, 2, 3, 5]) {
    const r = B.hexagon({ l: 3, p: 4, q: -2 }, k);
    assert.equal(r.cells.length, 6 * k * k);
    const n = { T: 0, L: 0, R: 0 };
    for (const c of r.cells) n[c.f]++;
    assert.deepEqual(n, { T: 2 * k * k, L: 2 * k * k, R: 2 * k * k });
  }
});

test('marquee triangle of side n holds n^2 cells', () => {
  for (const [dp, dq] of [[3, 0.2], [0.1, 3], [-3, 3], [-2, -1], [2, -4]]) {
    const r = B.triangleRegion({ l: 1, p: 0, q: 0 }, dp, dq);
    assert.equal(r.cells.length, r.n * r.n);
  }
});

test('strip: a run of cells along each axis, all in one band', () => {
  const l = 2;
  const s0 = L.latticeToWorld(l, 0.3, 0.3);
  for (const [dp, dq, fam] of [[4, 0, 'q'], [0, 4, 'p'], [-4, 4, 'r']]) {
    const e = L.latticeToWorld(l, 0.3 + dp, 0.3 + dq);
    const r = B.strip(l, s0.x, s0.y, e.x, e.y);
    assert.ok(r.cells.length >= 8 && r.cells.length <= 9, `${fam}: ${r.cells.length}`);
    const bands = new Set(r.cells.map(({ cell }) => {
      const { pp, qq } = L.centroidLattice(cell);
      return fam === 'q' ? Math.floor(qq) : fam === 'p' ? Math.floor(pp) : Math.floor(pp + qq);
    }));
    assert.equal(bands.size, 1);
  }
});

test('edge line: n edges along the nearest axis', () => {
  const r = B.edgeLine({ l: 1, p: 0, q: 0 }, 3.2, 0.3);
  assert.equal(r.n, 3);
  assert.deepEqual(r.edges.map((e) => [e.p, e.q, e.d]), [[0, 0, 0], [1, 0, 0], [2, 0, 0]]);
  const back = B.edgeLine({ l: 1, p: 0, q: 0 }, 0, -2);
  assert.deepEqual(back.edges.map((e) => [e.p, e.q, e.d]), [[0, -1, 1], [0, -2, 1]]);
});

test('samplePath steps are no longer than asked', () => {
  const pts = B.samplePath(0, 0, 1, 0, 0.1);
  assert.equal(pts.length, 10);
  assert.deepEqual(pts.at(-1), [1, 0]);
});
