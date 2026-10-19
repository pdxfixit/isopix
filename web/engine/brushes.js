// Brush shapes, drag-sized shapes, marquee shapes, line strips and edge
// lines, all snapped to the lattice. Each returns cells (with an optional
// cube-face tag) and never touches the drawing. Pure logic, no DOM.
import * as L from './lattice.js';

// The six lattice directions in order of screen angle: -30, 30, 90, 150, 210, 270 deg.
export const SECTOR_DIRS = [[-1, 1], [0, 1], [1, 0], [1, -1], [0, -1], [-1, 0]];
const AXIS_OF = (v) => (v[1] === 0 ? 'p' : v[0] === 0 ? 'q' : 'r');
// A parallelogram spanned by two axes is the cube face whose shared edge is the
// third axis: missing p (vertical) = top, missing r ("/") = left, missing q ("\") = right.
const FACE_MISSING = { p: 'T', r: 'L', q: 'R' };

// Screen angle (degrees, y down) of a lattice delta.
export function latticeAngle(dp, dq) {
  const x = dq * L.H, y = dp + dq / 2;
  return Math.atan2(y, x) * 180 / Math.PI;
}
// Which 60 deg sector a lattice delta falls in, and its coordinates (a, b)
// along the sector's two bounding directions.
export function sectorOf(dp, dq) {
  let ang = latticeAngle(dp, dq);
  if (ang < -30) ang += 360;
  const i = Math.floor((ang + 30) / 60) % 6;
  const A = SECTOR_DIRS[i], B = SECTOR_DIRS[(i + 1) % 6];
  const det = A[0] * B[1] - A[1] * B[0];
  const a = (dp * B[1] - dq * B[0]) / det;
  const b = (A[0] * dq - A[1] * dp) / det;
  return { i, A, B, a, b };
}
// Nearest of the six lattice directions to a delta (for lines).
export function nearestDir(dp, dq) {
  let ang = latticeAngle(dp, dq);
  if (ang < -30) ang += 360;
  const i = Math.round((ang + 30) / 60) % 6;
  return { i, V: SECTOR_DIRS[i] };
}

// Turning a placed stamp by dragging its handle round its foot, the way Drag a face
// picks its face (owner, 2026-10-19: "mimic draw face behavior as close as
// possible"). Angles are on screen, in degrees, y down. A flat stamp lies in the
// plane Drag a face would draw for a drag that way, from the same six slices:
// sideways the floor, down-right or up-left the left wall, down-left or up-right
// the right wall; within UPRIGHT° of straight up or down, where the slices meet, a
// picture that can stand upright does. A 3D stamp faces the quarter it is dragged
// into: 0 down-right (as drawn), 1 down-left, 2 up-left, 3 up-right. A pose changes
// only once the drag is STICKY° past the edge of the one it has, so a wobble while
// sizing does not turn it.
export const PLANE_OF_FACE = { T: 'floor', L: 'left', R: 'right' };
const UPRIGHT = 15, STICKY = 8;
const deg = (a) => ((a % 360) + 360) % 360;
function rawPose(kind, a, planes) {
  a = deg(a);
  if (kind === 'spin') return Math.floor(a / 90);
  if (planes.includes('upright') && (Math.abs(a - 90) < UPRIGHT || Math.abs(a - 270) < UPRIGHT)) return 'upright';
  return ['floor', 'left', 'right'][Math.floor(deg(a + 30) / 60) % 3];
}
// The pose for a drag at angle a: 'spin' gives 0 to 3, 'plane' one of planes.
export function poseAt(kind, a, current = null, planes = []) {
  const p = rawPose(kind, a, planes);
  if (current === null || p === current) return p;
  return rawPose(kind, a - STICKY, planes) === current || rawPose(kind, a + STICKY, planes) === current ? current : p;
}
// Where the handle sits for a pose: the way a 3D stamp faces; the middle of a
// plane's slice, on the side (0 or 1) it was last dragged to; upright, straight up.
export function poseAngle(kind, pose, side = 0) {
  if (kind === 'spin') return [30, 150, 210, 330][pose];
  if (pose === 'upright') return 270;
  return { floor: 0, left: 60, right: 120 }[pose] + 180 * side;
}

// Cube face of a cell relative to a center vertex, by centroid angle:
// top from -150 to -30 deg, right from -30 to 90, left from 90 to 210.
export function cubeFace(cell, v) {
  const c = L.centroid(cell);
  const o = L.vertexWorld(v.l, v.p, v.q);
  const ang = Math.atan2(c.y - o.y, c.x - o.x) * 180 / Math.PI;
  if (ang > -150 && ang < -30) return 'T';
  if (ang >= -30 && ang < 90) return 'R';
  return 'L';
}

function ringAround(v) {
  const o = L.vertexWorld(v.l, v.p, v.q);
  return L.cellsAroundVertex(v.l, v.p, v.q)
    .map((cell) => { const c = L.centroid(cell); return { cell, ang: Math.atan2(c.y - o.y, c.x - o.x) }; })
    .sort((a, b) => a.ang - b.ang)
    .map((r) => r.cell);
}

export const BRUSHES = ['triangle', 'rhombus', 'hexagon', 'trapezoid', 'bigtri'];

// A stamp-sized brush at world point (x, y), level l. Returns [{cell, f?}].
export function brushCells(shape, l, x, y) {
  const hit = L.hitTest(l, x, y);
  switch (shape) {
    case 'rhombus': {
      const { pp, qq } = L.worldToLattice(l, x, y);
      const a = pp - hit.p, b = qq - hit.q;
      // Distance to each edge, as barycentric weights, in edgeNeighbors order: v, \, /.
      const d = hit.u ? [b, a, 1 - a - b] : [1 - b, 1 - a, a + b - 1];
      const i = d.indexOf(Math.min(...d));
      const nb = L.edgeNeighbors(hit)[i];
      const f = L.FACE_OF_EDGE[nb.edge];
      return [{ cell: hit, f }, { cell: nb.cell, f }];
    }
    case 'hexagon': {
      const v = L.nearestVertex(l, x, y);
      return L.cellsAroundVertex(l, v.p, v.q).map((cell) => ({ cell, f: cubeFace(cell, v) }));
    }
    case 'trapezoid': {
      const v = L.nearestVertex(l, x, y);
      const ring = ringAround(v);
      const i = ring.findIndex((c) => L.sameCell(c, hit));
      return [-1, 0, 1].map((o) => ring[(i + o + 6) % 6]).map((cell) => ({ cell, f: cubeFace(cell, v) }));
    }
    case 'bigtri':
      if (l === 0) return [{ cell: hit }];
      return L.children(L.parent(hit)).map((cell) => ({ cell }));
    default:
      return [{ cell: hit }];
  }
}

function cellsWhere(l, corners, inside) {
  const ps = corners.map((c) => c[0]), qs = corners.map((c) => c[1]);
  const out = [];
  for (const cell of L.cellsInBox(l, Math.min(...ps) - 1, Math.max(...ps), Math.min(...qs) - 1, Math.max(...qs))) {
    const { pp, qq } = L.centroidLattice(cell);
    if (inside(pp, qq)) out.push(cell);
  }
  return out;
}

// Drag-sized parallelogram (a cube face of any size) from vertex A by a
// lattice delta. Returns {cells: [{cell, f}], face, n, m, corners}.
export function parallelogram(A, dp, dq) {
  const s = sectorOf(dp, dq);
  const n = Math.max(1, Math.round(s.a)), m = Math.max(1, Math.round(s.b));
  const missing = ['p', 'q', 'r'].find((x) => x !== AXIS_OF(s.A) && x !== AXIS_OF(s.B));
  const face = FACE_MISSING[missing];
  const det = s.A[0] * s.B[1] - s.A[1] * s.B[0];
  const corners = [[0, 0], [n, 0], [n, m], [0, m]].map(([x, y]) => [A.p + x * s.A[0] + y * s.B[0], A.q + x * s.A[1] + y * s.B[1]]);
  const cells = cellsWhere(A.l, corners, (pp, qq) => {
    const dpp = pp - A.p, dqq = qq - A.q;
    const a = (dpp * s.B[1] - dqq * s.B[0]) / det, b = (s.A[0] * dqq - s.A[1] * dpp) / det;
    return a > 0 && a < n && b > 0 && b < m;
  }).map((cell) => ({ cell, f: face }));
  return { cells, face, n, m, corners };
}

// Equilateral triangle region from vertex A in the drag's sector, side n.
export function triangleRegion(A, dp, dq) {
  const s = sectorOf(dp, dq);
  const n = Math.max(1, Math.round(s.a + s.b));
  const det = s.A[0] * s.B[1] - s.A[1] * s.B[0];
  const corners = [[0, 0], [n, 0], [0, n]].map(([x, y]) => [A.p + x * s.A[0] + y * s.B[0], A.q + x * s.A[1] + y * s.B[1]]);
  const cells = cellsWhere(A.l, corners, (pp, qq) => {
    const dpp = pp - A.p, dqq = qq - A.q;
    const a = (dpp * s.B[1] - dqq * s.B[0]) / det, b = (s.A[0] * dqq - s.A[1] * dpp) / det;
    return a > 0 && b > 0 && a + b < n;
  }).map((cell) => ({ cell }));
  return { cells, n, corners };
}

// Hexagon of radius k around vertex A; faces split it into a cube.
export function hexagon(A, k) {
  k = Math.max(1, k);
  const out = [];
  for (const cell of L.cellsInBox(A.l, A.p - k - 1, A.p + k, A.q - k - 1, A.q + k)) {
    if (L.cellVerts(cell).every(([p, q]) => L.hexDist(p - A.p, q - A.q) <= k)) out.push({ cell, f: cubeFace(cell, A) });
  }
  return { cells: out, k };
}
export const hexRadius = (dp, dq) => Math.max(1, Math.round(L.hexDist(dp, dq)));

// Line "Strip": the cells under a line locked to the nearest axis, inside the
// band of the start cell, sampled along the band's center line.
export function strip(l, x0, y0, x1, y1) {
  const a = L.worldToLattice(l, x0, y0), b = L.worldToLattice(l, x1, y1);
  const { V } = nearestDir(b.pp - a.pp, b.qq - a.qq);
  // Center line of the band holding the start point, for this axis family.
  let pp = a.pp, qq = a.qq;
  if (V[1] === 0) qq = Math.floor(qq) + 0.5;           // vertical: q in [k, k+1]
  else if (V[0] === 0) pp = Math.floor(pp) + 0.5;      // "\": p in [k, k+1]
  else { const r = Math.floor(pp + qq) + 0.5; const d = r - (pp + qq); pp += d / 2; qq += d / 2; } // "/": p+q in [k, k+1]
  // Length along V: project the drag onto V in world space.
  const wv = L.latticeToWorld(l, V[0], V[1]), w0 = L.latticeToWorld(l, a.pp, a.qq), w1 = L.latticeToWorld(l, b.pp, b.qq);
  const len = ((w1.x - w0.x) * wv.x + (w1.y - w0.y) * wv.y) / (wv.x ** 2 + wv.y ** 2);
  const t1 = Math.max(0, len);
  const seen = new Map();
  for (let t = 0; t <= t1 + 1e-9; t += 0.25) {
    const c = L.cellAtLattice(l, pp + V[0] * t, qq + V[1] * t);
    seen.set(L.cellKey(c), c);
  }
  const end = L.cellAtLattice(l, pp + V[0] * t1, qq + V[1] * t1);
  seen.set(L.cellKey(end), end);
  return { cells: [...seen.values()].map((cell) => ({ cell })), dir: V };
}

// Line "Edge": lattice edges from vertex A along the nearest axis, n steps.
export function edgeLine(A, dp, dq) {
  const { V } = nearestDir(dp, dq);
  const w = L.latticeToWorld(0, V[0], V[1]), d = L.latticeToWorld(0, dp, dq);
  const n = Math.max(0, Math.round((d.x * w.x + d.y * w.y) / (w.x ** 2 + w.y ** 2)));
  const edges = [];
  for (let i = 0; i < n; i++) {
    const a = [A.p + V[0] * i, A.q + V[1] * i], b = [A.p + V[0] * (i + 1), A.q + V[1] * (i + 1)];
    edges.push(L.edgeBetween(A.l, a, b));
  }
  return { edges, dir: V, n };
}

// Points along a segment, at most `step` apart (for gap-free strokes).
export function samplePath(x0, y0, x1, y1, step) {
  const d = Math.hypot(x1 - x0, y1 - y0);
  const n = Math.max(1, Math.ceil(d / step));
  const out = [];
  for (let i = 1; i <= n; i++) out.push([x0 + (x1 - x0) * i / n, y0 + (y1 - y0) * i / n]);
  return out;
}
