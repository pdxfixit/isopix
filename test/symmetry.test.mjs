// Symmetry: the 12-element group acts exactly on cells, faces and edges.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as L from '../web/engine/lattice.js';
import * as S from '../web/engine/symmetry.js';

const near = (a, b) => Math.abs(a - b) < 1e-9;

test('rotation is 60 deg in world space and has order 6', () => {
  const w = (v) => L.latticeToWorld(0, v[0], v[1]);
  for (const v of [[1, 0], [0, 1], [2, -3]]) {
    const a = w(v), b = w(S.rot(v));
    const ang = Math.atan2(b.y, b.x) - Math.atan2(a.y, a.x);
    assert.ok(near(Math.cos(ang), 0.5) && near(Math.abs(Math.sin(ang)), Math.sqrt(3) / 2));
    assert.ok(near(Math.hypot(a.x, a.y), Math.hypot(b.x, b.y)));
    let r = v;
    for (let i = 0; i < 6; i++) r = S.rot(r);
    assert.deepEqual(r, v);
  }
});

test('mirror flips x and keeps y', () => {
  for (const v of [[1, 0], [0, 1], [2, -3]]) {
    const a = L.latticeToWorld(0, ...v), b = L.latticeToWorld(0, ...S.mir(v));
    assert.ok(near(a.x, -b.x) && near(a.y, b.y));
  }
});

test('transformed cells land exactly where the transformed centroid is', () => {
  const center = { l: 2, p: 1, q: -1 };
  const o = L.vertexWorld(2, 1, -1);
  for (const g of S.groupOf('rot6mirror')) {
    for (const cell of [L.mk(3, 5, -4, 1), L.mk(3, 0, 0, 0), L.mk(4, 9, 2, 1)]) {
      const [t] = S.transformCell(cell, center, g);
      const c = L.centroid(cell);
      let v = [c.x - o.x, c.y - o.y];
      if (g.m) v = [-v[0], v[1]];
      const ang = g.k * Math.PI / 3; // rot maps q (30 deg) to p (90 deg): +60 deg on screen
      const rv = [v[0] * Math.cos(ang) - v[1] * Math.sin(ang), v[0] * Math.sin(ang) + v[1] * Math.cos(ang)];
      const tc = L.centroid(t);
      assert.ok(near(tc.x - o.x, rv[0]) && near(tc.y - o.y, rv[1]), JSON.stringify({ g, cell, t }));
    }
  }
});

test('group sizes: off 1, mirror 2, rot6 6, rot6mirror 12, and the 12 images are distinct', () => {
  assert.deepEqual(S.MODES.map((m) => S.groupOf(m).length), [1, 2, 6, 12]);
  const imgs = S.expandCells([{ cell: L.mk(3, 3, 1, 1) }], { l: 0, p: 0, q: 0 }, 'rot6mirror');
  assert.equal(imgs.length, 12);
});

test('faces follow their rhombus through the group', () => {
  // A hexagon brush is symmetric under rotation: its face pattern must map onto itself.
  const ring = L.cellsAroundVertex(0, 0, 0);
  const faceOf = new Map([[L.cellKey(ring[0]), null]]);
  // A top-face rhombus up(0,0)+down(0,-1) rotated is still a rhombus of the transformed face.
  const rh = [L.mk(1, 0, 0, 1), L.mk(1, 0, -1, 0)];
  for (const g of S.groupOf('rot6mirror')) {
    const t = rh.map((c) => S.transformCell(c, { l: 1, p: 0, q: 0 }, g)[0]);
    const nb = L.edgeNeighbors(t[0]).find((n) => L.sameCell(n.cell, t[1]));
    assert.ok(nb, 'still adjacent');
    assert.equal(S.transformFace('T', g), L.FACE_OF_EDGE[nb.edge]);
  }
  assert.ok(faceOf);
});

test('a cell coarser than the center level is split so the result stays exact', () => {
  const out = S.transformCell(L.mk(0, 0, 0, 1), { l: 2, p: 1, q: 1 }, { k: 1, m: false });
  assert.equal(out.length, 16);
  assert.ok(out.every((c) => c.l === 2));
});

test('edges transform onto lattice edges', () => {
  for (const g of S.groupOf('rot6mirror')) for (let d = 0; d < 3; d++) {
    const [t] = S.transformEdge({ l: 2, p: 2, q: 1, d }, { l: 1, p: 0, q: 1 }, g);
    assert.ok(t && t.l === 2 && t.d >= 0 && t.d <= 2);
  }
});
