// Lattice symmetry: 6-fold rotation and mirror around a lattice vertex,
// applied exactly with integer matrices. Pure logic, no DOM.
import * as L from './lattice.js';

// Rotation by 60 deg: q -> p, p -> (1,-1), as (p, q) -> (p + q, -p).
export const rot = ([p, q]) => [p + q, 0 - p];
// Mirror across the vertical line through the center: (p, q) -> (p + q, -q).
export const mir = ([p, q]) => [p + q, 0 - q];

export const MODES = ['off', 'mirror', 'rot6', 'rot6mirror'];

// Group elements as {k: rotations, m: mirror first}.
export function groupOf(mode) {
  const rots = mode === 'rot6' || mode === 'rot6mirror' ? 6 : 1;
  const mirrors = mode === 'mirror' || mode === 'rot6mirror' ? [false, true] : [false];
  const out = [];
  for (const m of mirrors) for (let k = 0; k < rots; k++) out.push({ k, m });
  return out;
}

export function applyVec(g, v) {
  let r = g.m ? mir(v) : v;
  for (let i = 0; i < g.k; i++) r = rot(r);
  return r;
}

// Transform a cell around center vertex c = {l, p, q}. A cell coarser than
// the center's level is split down to it first, so the result stays exact.
export function transformCell(cell, center, g) {
  if (cell.l < center.l) return L.descendantsAt(cell, center.l).flatMap((ch) => transformCell(ch, center, g));
  const f = 2 ** (cell.l - center.l);
  const cp = center.p * f * 3, cq = center.q * f * 3;
  // Three times the centroid is an integer point; transform that exactly.
  const P3 = 3 * cell.p + (cell.u ? 1 : 2), Q3 = 3 * cell.q + (cell.u ? 1 : 2);
  const [tp, tq] = applyVec(g, [P3 - cp, Q3 - cq]);
  const X = tp + cp, Y = tq + cq;
  const fp = Math.floor(X / 3), fq = Math.floor(Y / 3);
  const u = (X - 3 * fp) + (Y - 3 * fq) < 3 ? 1 : 0;
  return [L.mk(cell.l, fp, fq, u)];
}

// A face tag follows its rhombus: the shared edge's direction transforms.
const FACE_DIR = { T: [1, 0], R: [0, 1], L: [-1, 1] };
export function transformFace(face, g) {
  if (!face) return face;
  const [p, q] = applyVec(g, FACE_DIR[face]);
  for (const [f, [a, b]] of Object.entries(FACE_DIR)) if ((a === p && b === q) || (a === -p && b === -q)) return f;
  return face;
}

export function transformEdge(e, center, g) {
  if (e.l < center.l) return L.edgeChildren(e).flatMap((ch) => transformEdge(ch, center, g));
  const f = 2 ** (e.l - center.l);
  const cp = center.p * f, cq = center.q * f;
  const ends = L.edgeEnds(e).map(([p, q]) => { const [a, b] = applyVec(g, [p - cp, q - cq]); return [a + cp, b + cq]; });
  return [L.edgeBetween(e.l, ends[0], ends[1])];
}

// Expand a list of {cell, f} through the group, deduplicated by key.
export function expandCells(items, center, mode) {
  const G = groupOf(mode);
  if (G.length === 1) return items;
  const out = new Map();
  for (const g of G) for (const it of items) {
    const f = transformFace(it.f, g);
    for (const cell of transformCell(it.cell, center, g)) out.set(L.cellKey(cell), { ...it, cell, f });
  }
  return [...out.values()];
}
export function expandEdges(edges, center, mode) {
  const G = groupOf(mode);
  if (G.length === 1) return edges;
  const out = new Map();
  for (const g of G) for (const e of edges) for (const t of transformEdge(e, center, g)) out.set(L.edgeKey(t), t);
  return [...out.values()];
}
