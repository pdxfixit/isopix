// Lattice math: the verified coordinate scheme from the brief, proven.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as L from '../web/engine/lattice.js';

const near = (a, b, eps = 1e-9) => Math.abs(a - b) < eps;
const sample = () => {
  const out = [];
  for (let l = 0; l <= 7; l++) for (let p = -3; p <= 3; p++) for (let q = -3; q <= 3; q++) for (const u of [0, 1]) out.push(L.mk(l, p, q, u));
  return out;
};

test('vertex positions follow x = q*sqrt3/2*s, y = (p + q/2)*s', () => {
  const s = L.edgeLen(2);
  const w = L.vertexWorld(2, 3, -4);
  assert.ok(near(w.x, -4 * Math.sqrt(3) / 2 * s));
  assert.ok(near(w.y, (3 - 2) * s));
});

test('every cell is equilateral with edge length s', () => {
  for (const c of sample()) {
    const [a, b, d] = L.cellWorldVerts(c);
    const s = L.edgeLen(c.l);
    for (const [m, n] of [[a, b], [b, d], [d, a]]) assert.ok(near(Math.hypot(m.x - n.x, m.y - n.y), s, 1e-12));
  }
});

test('up cells point right and down cells point left; lines are vertical, 30 and 150 deg', () => {
  const up = L.cellWorldVerts(L.mk(0, 0, 0, 1));
  assert.ok(near(up[0].x, up[1].x)); // vertical edge on the left
  assert.ok(up[2].x > up[0].x);
  const dn = L.cellWorldVerts(L.mk(0, 0, 0, 0));
  assert.ok(near(dn[1].x, dn[2].x)); // vertical edge on the right
  assert.ok(dn[0].x < dn[1].x);
  const a = L.vertexWorld(0, 0, 0), b = L.vertexWorld(0, 0, 1), c = L.vertexWorld(0, -1, 1);
  assert.ok(near(Math.atan2(b.y - a.y, b.x - a.x) * 180 / Math.PI, 30));
  assert.ok(near(Math.atan2(c.y - a.y, c.x - a.x) * 180 / Math.PI, -30));
});

test('a cell centroid hit-tests back to the cell', () => {
  for (const c of sample()) {
    const w = L.centroid(c);
    assert.deepEqual(L.hitTest(c.l, w.x, w.y), c);
  }
});

test('hit test formula from the brief, at random points', () => {
  for (let i = 0; i < 2000; i++) {
    const l = i % 8, x = (Math.random() - 0.5) * 6, y = (Math.random() - 0.5) * 6;
    const s = L.edgeLen(l), h = Math.sqrt(3) / 2 * s;
    const qq = x / h, pp = y / s - qq / 2, fp = Math.floor(pp), fq = Math.floor(qq);
    const u = (pp - fp) + (qq - fq) < 1 ? 1 : 0;
    assert.deepEqual(L.hitTest(l, x, y), { l, p: fp, q: fq, u });
    // The point is inside the triangle it hit (barycentric check in world space).
    const [a, b, c] = L.cellWorldVerts(L.hitTest(l, x, y));
    const d = (b.y - c.y) * (a.x - c.x) + (c.x - b.x) * (a.y - c.y);
    const w1 = ((b.y - c.y) * (x - c.x) + (c.x - b.x) * (y - c.y)) / d;
    const w2 = ((c.y - a.y) * (x - c.x) + (a.x - c.x) * (y - c.y)) / d;
    assert.ok(w1 >= -1e-9 && w2 >= -1e-9 && 1 - w1 - w2 >= -1e-9);
  }
});

test('children: exact lists from the brief', () => {
  assert.deepEqual(L.children(L.mk(0, 2, 3, 1)), [L.mk(1, 4, 6, 1), L.mk(1, 5, 6, 1), L.mk(1, 4, 7, 1), L.mk(1, 4, 6, 0)]);
  assert.deepEqual(L.children(L.mk(0, 2, 3, 0)), [L.mk(1, 5, 6, 0), L.mk(1, 4, 7, 0), L.mk(1, 5, 7, 0), L.mk(1, 5, 7, 1)]);
});

test('child centroids hit-test to the parent at its level and to themselves at theirs; parent() agrees', () => {
  for (const c of sample().filter((c) => c.l < 7)) {
    const kids = L.children(c);
    let area = 0;
    for (const k of kids) {
      const w = L.centroid(k);
      assert.deepEqual(L.hitTest(c.l, w.x, w.y), c);
      assert.deepEqual(L.hitTest(k.l, w.x, w.y), k);
      assert.deepEqual(L.parent(k), c);
      area += 4 ** -k.l;
    }
    assert.ok(near(area, 4 ** -c.l));
  }
});

test('the six cells around a vertex all touch it and sit at 60 deg steps', () => {
  const cells = L.cellsAroundVertex(3, 2, -1);
  const o = L.vertexWorld(3, 2, -1);
  const angles = cells.map((c) => {
    assert.ok(L.cellVerts(c).some(([p, q]) => p === 2 && q === -1));
    const w = L.centroid(c);
    return Math.round(Math.atan2(w.y - o.y, w.x - o.x) * 180 / Math.PI) + 0;
  }).sort((a, b) => a - b);
  assert.deepEqual(angles, [-120, -60, 0, 60, 120, 180]);
});

test('edge neighbors share exactly the named edge', () => {
  for (const c of sample().slice(0, 200)) {
    for (const { cell, edge } of L.edgeNeighbors(c)) {
      const shared = L.cellVerts(c).filter(([p, q]) => L.cellVerts(cell).some(([a, b]) => a === p && b === q));
      assert.equal(shared.length, 2);
      const [a, b] = shared.map(([p, q]) => L.vertexWorld(c.l, p, q));
      const ang = ((Math.atan2(b.y - a.y, b.x - a.x) * 180 / Math.PI) + 180) % 180;
      const want = { v: 90, '\\': 30, '/': 150 }[edge];
      assert.ok(near(ang, want, 1e-6), `${edge} got ${ang}`);
    }
  }
});

test('hexagon distance: radius k holds 6k^2 cells', () => {
  for (const k of [1, 2, 3]) {
    let n = 0;
    for (const c of L.cellsInBox(0, -k - 1, k, -k - 1, k)) if (L.cellVerts(c).every(([p, q]) => L.hexDist(p, q) <= k)) n++;
    assert.equal(n, 6 * k * k);
  }
});

test('a radius-2k hexagon at level l+1 is exactly a radius-k hexagon at level l', () => {
  const at = (l, k) => {
    const out = new Set();
    for (const c of L.cellsInBox(l, -k - 1, k, -k - 1, k)) if (L.cellVerts(c).every(([p, q]) => L.hexDist(p, q) <= k)) out.add(L.cellKey(c));
    return out;
  };
  const coarse = at(2, 2), fine = at(3, 4);
  const fromCoarse = new Set([...coarse].flatMap((k) => L.children(L.parseKey(k)).map(L.cellKey)));
  assert.deepEqual([...fromCoarse].sort(), [...fine].sort());
});

test('line families: every vertex lies on its three lines', () => {
  for (let l = 0; l < 8; l += 3) {
    const s = L.edgeLen(l);
    for (let p = -4; p <= 4; p++) for (let q = -4; q <= 4; q++) {
      const w = L.vertexWorld(l, p, q);
      assert.ok(near(L.lineQx(q, s), w.x));
      assert.ok(near(L.linePy(p, s, w.x), w.y));
      assert.ok(near(L.lineRy(p + q, s, w.x), w.y));
    }
  }
});

test('line ranges cover every vertex in a box', () => {
  const s = L.edgeLen(1);
  const r = L.lineRanges(s, -1, -1, 1.3, 0.7);
  for (let p = -10; p <= 10; p++) for (let q = -10; q <= 10; q++) {
    const w = L.vertexWorld(1, p, q);
    if (w.x < -1 || w.x > 1.3 || w.y < -1 || w.y > 0.7) continue;
    assert.ok(q >= r.Q[0] && q <= r.Q[1]);
    assert.ok(p >= r.P[0] && p <= r.P[1]);
    assert.ok(p + q >= r.R[0] && p + q <= r.R[1]);
  }
});

test('gutter alpha ramps from 5 px to 30 px, capped at 0.5', () => {
  assert.equal(L.gutterAlpha(4), 0);
  assert.equal(L.gutterAlpha(5), 0);
  assert.ok(near(L.gutterAlpha(17.5), 0.25));
  assert.equal(L.gutterAlpha(30), 0.5);
  assert.equal(L.gutterAlpha(300), 0.5);
});

test('edges: refine splits in two, parent recovers on-lattice halves only', () => {
  for (let d = 0; d < 3; d++) {
    const e = { l: 2, p: 3, q: -2, d };
    const kids = L.edgeChildren(e);
    const [a0, a1] = L.edgeEnds(e);
    assert.deepEqual(L.edgeEnds(kids[0])[0], [a0[0] * 2, a0[1] * 2]);
    assert.deepEqual(L.edgeEnds(kids[1])[1], [a1[0] * 2, a1[1] * 2]);
    for (const k of kids) assert.deepEqual(L.edgeParent(k), e);
  }
  assert.equal(L.edgeParent({ l: 3, p: 0, q: 1, d: 0 }), null); // vertical line q=1 is not on level 2
  assert.equal(L.edgeParent({ l: 3, p: 1, q: 0, d: 1 }), null);
  assert.equal(L.edgeParent({ l: 3, p: 1, q: 0, d: 2 }), null);
});

test('edgeCells gives the two cells that share the edge', () => {
  for (let d = 0; d < 3; d++) {
    const e = { l: 1, p: 2, q: 1, d };
    const [a, b] = L.edgeCells(e);
    const ends = L.edgeEnds(e).map((v) => v.join(','));
    for (const c of [a, b]) {
      const vs = L.cellVerts(c).map((v) => v.join(','));
      assert.ok(ends.every((x) => vs.includes(x)));
    }
    assert.notDeepEqual(a, b);
  }
});
