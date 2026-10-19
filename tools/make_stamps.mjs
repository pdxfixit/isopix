// Builds the starter stamps (web/stamps.js) from 3D shapes on the lattice.
// A shape is boxes and faces in cube units; a unit is U vertex steps. A 3D
// point (x, y, z) lands on lattice vertex (p, q) = ((y - z)·U, (x - y)·U):
// up is (-1, 0), down-right (+x) is (0, 1), down-left (+y) is (1, -1), each
// one edge, so every box face is a lattice polygon. Faces fill the cells whose
// centers they hold, back to front, shaded as auto-shade does (top light,
// left the color, right dark). Cells are at the active level (dl 0), so a
// stamp works at every grid size and scales with it.
//
//   node tools/make_stamps.mjs              writes web/stamps.js
//   node tools/make_stamps.mjs --check      fails if web/stamps.js is not what this makes
//   node tools/make_stamps.mjs --svg FILE   also writes every stamp side by side as SVG
import fs from 'node:fs';
import path from 'node:path';
import * as L from '../web/engine/lattice.js';
import { shade } from '../web/engine/color.js';
import { Drawing } from '../web/engine/model.js';
import { placeStamp } from '../web/engine/density.js';
import { toSVG } from '../web/engine/svg.js';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const U = 2;
const LV = 3; // the level stamps are built at; only differences from the anchor are kept
const at = ([x, y, z]) => [(y - z) * U, (x - y) * U];

const inside = (poly, pp, qq) => {
  let hit = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [pi, qi] = poly[i], [pj, qj] = poly[j];
    if ((qi > qq) !== (qj > qq) && pp < ((pj - pi) * (qq - qi)) / (qj - qi) + pi) hit = !hit;
  }
  return hit;
};

// A face: 3D corners, a color, and its cube-face tag (T, L or R; null for flat paint).
const face = (pts, color, f) => ({ poly: pts.map(at), color, f });
function box([x0, y0, z0], [sx, sy, sz], color) {
  const x1 = x0 + sx, y1 = y0 + sy, z1 = z0 + sz;
  return [
    face([[x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1]], color, 'T'),
    face([[x0, y1, z0], [x1, y1, z0], [x1, y1, z1], [x0, y1, z1]], color, 'L'),
    face([[x1, y0, z0], [x1, y1, z0], [x1, y1, z1], [x1, y0, z1]], color, 'R'),
  ];
}

// Paint faces in order into cells: [p, q, u] → {c, f}.
function paint(faces) {
  const cells = new Map();
  for (const { poly, color, f } of faces) {
    const ps = poly.map((v) => v[0]), qs = poly.map((v) => v[1]);
    for (const cell of L.cellsInBox(LV, Math.min(...ps) - 1, Math.max(...ps), Math.min(...qs) - 1, Math.max(...qs))) {
      const { pp, qq } = L.centroidLattice(cell);
      if (inside(poly, pp, qq)) cells.set(L.cellKey(cell), { cell, c: f ? shade(color, f) : color, f: f || null });
    }
  }
  return cells;
}

// A flat shape in the screen plane, by cells around the anchor vertex.
function flat(pick) {
  const cells = new Map();
  for (const cell of L.cellsInBox(LV, -6, 6, -6, 6)) {
    const color = pick(cell);
    if (color) cells.set(L.cellKey(cell), { cell, c: color, f: null });
  }
  return cells;
}
const hexDistOf = (cell) => Math.max(...L.cellVerts(cell).map(([p, q]) => L.hexDist(p, q)));

// Boxes and side patches in half units, for small features (ears, eyes, a beak).
const hbox = (o, sz, color) => box(o.map((v) => v / 2), sz.map((v) => v / 2), color);
// A patch on a box's side: on the L side (the plane y = at) from x0 to x1, or
// the R side (x = at) from y0 to y1; z0 to z1 up. Half units.
const patch = (side, at, [a0, a1], [z0, z1], color) => face(
  (side === 'L' ? [[a0, at, z0], [a1, at, z0], [a1, at, z1], [a0, at, z1]] : [[at, a0, z0], [at, a1, z0], [at, a1, z1], [at, a0, z1]]).map((v) => v.map((n) => n / 2)),
  color, side);

const BLUE = '#3a86ff', TEAL = '#2a9d8f', YELLOW = '#f4c430', RED = '#e63946', GREEN = '#5a9a3c',
  BROWN = '#8b5a2b', STONE = '#9aa0a6', SAND = '#e9b949', PINK = '#ff5d8f', SKY = '#8ecae6', ORANGE = '#f4a020', INK = '#2b2d42', WHITE = '#f1ece4', TAN = '#c9a27e',
  FOX = '#e8641b', LIME = '#8bc34a', HOG = '#ff9eb5';

const SHAPES = [
  { id: 'cube', name: 'Cube', cells: () => paint(box([0, 0, 0], [1, 1, 1], BLUE)) },
  { id: 'stairs', name: 'Stairs', cells: () => paint([...box([0, 0, 0], [3, 1, 1], TEAL), ...box([0, 0, 1], [2, 1, 1], TEAL), ...box([0, 0, 2], [1, 1, 1], TEAL)]) },
  { id: 'house', name: 'House', cells: () => paint([
    ...box([0, 0, 0], [2, 2, 1.5], YELLOW),
    face([[2, 0, 1.5], [2, 2, 1.5], [2, 1, 2.5]], RED, 'R'),
    face([[0, 1, 2.5], [2, 1, 2.5], [2, 2, 1.5], [0, 2, 1.5]], RED, 'L'),
    face([[0.5, 2, 0], [1, 2, 0], [1, 2, 1], [0.5, 2, 1]], BROWN, 'L'),
    face([[2, 0.5, 0.5], [2, 1, 0.5], [2, 1, 1], [2, 0.5, 1]], SKY, 'R'),
  ]) },
  { id: 'tree', name: 'Tree', cells: () => paint([...box([0.5, 0.5, 0], [0.5, 0.5, 1], BROWN), ...box([0, 0, 1], [1.5, 1.5, 1.5], GREEN), ...box([0.5, 0.5, 2.5], [0.5, 0.5, 0.5], GREEN)]) },
  { id: 'wall', name: 'Wall', cells: () => paint([...box([0, 0, 0], [3, 0.5, 1.5], STONE), ...[0, 1, 2].flatMap((x) => box([x, 0, 1.5], [0.5, 0.5, 0.5], STONE)), ...box([2.5, 0, 1.5], [0.5, 0.5, 0.5], STONE)]) },
  { id: 'pyramid', name: 'Pyramid', cells: () => paint([
    face([[0, 2, 0], [2, 2, 0], [1, 1, 1.5]], SAND, 'L'),
    face([[2, 0, 0], [2, 2, 0], [1, 1, 1.5]], SAND, 'R'),
  ]) },
  { id: 'flower', name: 'Flower', cells: () => flat((cell) => {
    const d = hexDistOf(cell);
    if (d <= 1) return YELLOW;
    if (d > 3) return null;
    const { x, y } = L.centroid(cell), o = L.vertexWorld(LV, 0, 0);
    return Math.floor(((Math.atan2(y - o.y, x - o.x) + Math.PI) / (Math.PI / 3))) % 2 ? PINK : '#ff8fb1';
  }) },
  // Two lattice-aligned triangles (side 6 edges) pointing left and right: a six-point star.
  { id: 'star', name: 'Star', cells: () => {
    const o = L.vertexWorld(LV, 0, 0), step = Math.hypot(L.vertexWorld(LV, 0, 1).x - o.x, L.vertexWorld(LV, 0, 1).y - o.y);
    const R = 2 * Math.sqrt(3) * step; // circumradius of a triangle of side 6 steps
    const tri = (a0) => [0, 1, 2].map((k) => [o.x + R * Math.cos(a0 + (k * 2 * Math.PI) / 3), o.y + R * Math.sin(a0 + (k * 2 * Math.PI) / 3)]);
    const inTri = (t, x, y) => inside(t.map(([px, py]) => [px, py]), x, y);
    const right = tri(0), left = tri(Math.PI);
    return flat((cell) => {
      const { x, y } = L.centroid(cell);
      const a = inTri(right, x, y), b = inTri(left, x, y);
      return a && b ? YELLOW : a || b ? ORANGE : null;
    });
  } },
  // Animals, side on, facing right (+x), their profile on the lit L side.
  { id: 'cat', name: 'Cat', cells: () => paint([
    ...hbox([0, 1, 2], [1, 1, 4], ORANGE), // tail, up from the rump
    ...hbox([1, 0, 0], [1, 1, 1], ORANGE), ...hbox([6, 0, 0], [1, 1, 1], ORANGE),
    ...hbox([1, 1, 0], [1, 1, 1], ORANGE), ...hbox([6, 1, 0], [1, 1, 1], ORANGE),
    ...hbox([1, 0, 1], [6, 2, 2], ORANGE),
    ...hbox([6, 0, 2], [3, 3, 3], ORANGE),
    ...hbox([6, 0, 5], [1, 1, 1], ORANGE), ...hbox([6, 2, 5], [1, 1, 1], ORANGE),
    patch('L', 3, [7, 8], [3, 4], INK),
  ]) },
  { id: 'bunny', name: 'Bunny', cells: () => paint([
    ...hbox([0, 0, 0], [4, 3, 3], TAN),
    ...hbox([-1, 2, 1], [1, 1, 1], WHITE), // a puff of a tail
    ...hbox([1, 2, 0], [1, 1, 1], WHITE), ...hbox([3, 2, 0], [1, 1, 1], WHITE), // paws
    ...hbox([3, 0, 2], [3, 3, 3], TAN),
    ...hbox([3, 0, 5], [1, 1, 3], TAN), ...hbox([3, 2, 5], [1, 1, 3], TAN),
    patch('L', 3, [3, 4], [5, 8], PINK),
    patch('L', 3, [4, 5], [3, 4], INK),
    patch('R', 6, [1, 2], [3, 4], PINK),
  ]) },
  { id: 'duck', name: 'Duck', cells: () => paint([
    ...hbox([0, 1, 2], [1, 1, 1], YELLOW), // tail
    ...hbox([0, 0, 0], [5, 3, 2], YELLOW),
    patch('L', 3, [1, 3], [1, 2], '#e0a800'), // wing
    ...hbox([3, 1, 2], [2, 2, 3], YELLOW),
    ...hbox([5, 1, 3], [1, 2, 1], ORANGE),
    patch('L', 3, [3, 4], [3, 4], INK),
  ]) },
  { id: 'fox', name: 'Fox', cells: () => paint([
    ...hbox([-3, 0, 2], [1, 2, 2], WHITE), ...hbox([-2, 0, 2], [3, 2, 2], FOX), // a bushy tail, white at the tip
    ...hbox([1, 0, 0], [1, 1, 1], INK), ...hbox([6, 0, 0], [1, 1, 1], INK),
    ...hbox([1, 1, 0], [1, 1, 1], INK), ...hbox([6, 1, 0], [1, 1, 1], INK),
    ...hbox([1, 0, 1], [6, 2, 2], FOX),
    ...hbox([6, 0, 2], [3, 3, 3], FOX),
    ...hbox([9, 1, 2], [1, 1, 1], WHITE), patch('R', 10, [1, 2], [2, 3], INK), // the snout and its nose
    ...hbox([6, 0, 5], [1, 1, 2], FOX), ...hbox([6, 2, 5], [1, 1, 2], FOX),
    patch('L', 3, [8, 9], [2, 3], WHITE),
    patch('L', 3, [7, 8], [3, 4], INK),
  ]) },
  { id: 'snake', name: 'Snake', cells: () => paint([
    ...hbox([-2, 0, 0], [2, 1, 1], LIME), // the tail, thinner
    ...hbox([0, 0, 0], [2, 2, 2], GREEN), ...hbox([2, 0, 0], [2, 2, 2], LIME), ...hbox([4, 0, 0], [2, 2, 2], GREEN),
    ...hbox([4, 2, 0], [2, 2, 2], LIME), ...hbox([4, 4, 0], [2, 2, 2], GREEN),
    ...hbox([6, 4, 0], [2, 2, 2], LIME), ...hbox([8, 4, 0], [2, 2, 2], GREEN),
    ...hbox([10, 3, 0], [3, 3, 3], GREEN),
    patch('L', 6, [11, 12], [1, 2], INK),
    patch('R', 13, [4, 5], [0, 1], RED), // the tongue
  ]) },
  { id: 'frog', name: 'Frog', cells: () => paint([
    ...hbox([0, 0, 0], [5, 4, 2], GREEN),
    ...hbox([0, 4, 0], [2, 1, 1], LIME), ...hbox([4, 4, 0], [1, 1, 1], LIME), // a back leg and a front foot
    ...hbox([3, 0, 2], [1, 1, 1], WHITE), ...hbox([3, 3, 2], [1, 1, 1], WHITE),
    patch('R', 4, [0, 1], [2, 3], INK), patch('R', 4, [3, 4], [2, 3], INK),
    patch('R', 5, [0, 4], [1, 2], '#a83232'), // a wide smile
  ]) },
  { id: 'pig', name: 'Pig', cells: () => paint([
    ...hbox([0, 1, 3], [1, 1, 1], HOG), // a curl of a tail
    ...hbox([1, 0, 0], [1, 1, 1], HOG), ...hbox([6, 0, 0], [1, 1, 1], HOG),
    ...hbox([1, 2, 0], [1, 1, 1], HOG), ...hbox([6, 2, 0], [1, 1, 1], HOG),
    ...hbox([1, 0, 1], [6, 3, 3], HOG),
    ...hbox([7, 0, 2], [2, 3, 3], HOG),
    ...hbox([9, 1, 2], [1, 1, 1], PINK),
    ...hbox([7, 0, 5], [1, 1, 1], PINK), ...hbox([7, 2, 5], [1, 1, 1], PINK),
    patch('L', 3, [8, 9], [3, 4], INK),
  ]) },
];

// The stamp: cells relative to the anchor, the vertex at the middle of its bottom.
function stampOf(cells) {
  const list = [...cells.values()];
  const ws = list.map(({ cell }) => L.centroid(cell));
  const midX = (Math.min(...ws.map((w) => w.x)) + Math.max(...ws.map((w) => w.x))) / 2, low = Math.max(...ws.map((w) => w.y));
  const a = L.nearestVertex(LV, midX, low);
  return { base: 0, cells: list.map(({ cell, c, f }) => [0, cell.p - a.p, cell.q - a.q, cell.u, c, f]), edges: [] };
}

const out = SHAPES.map((s) => ({ id: s.id, name: s.name, stamp: stampOf(s.cells()) }));
const js = `// The starter stamps (the owner's pick: Cube, Stairs, House, Tree, Wall,
// Pyramid, Flower, Star; then little animals: Cat, Bunny, Duck, Fox, Snake,
// Frog, Pig).
// Made by tools/make_stamps.mjs from 3D shapes on the lattice; edit that, not
// this. Each is a stamp like one saved from a selection: cells
// [dl, dp, dq, u, color, face] around its anchor vertex.
export const STARTER = ${JSON.stringify(out)};
`;
const file = path.join(ROOT, 'web/stamps.js');
if (process.argv.includes('--check')) {
  if (fs.readFileSync(file, 'utf8') !== js) { console.error('❌ web/stamps.js is not what tools/make_stamps.mjs makes: run node tools/make_stamps.mjs'); process.exit(1); }
  console.log('✅ web/stamps.js matches tools/make_stamps.mjs');
  process.exit(0);
}
fs.writeFileSync(file, js);
console.log(`✅ web/stamps.js: ${out.map((s) => `${s.name} ${s.stamp.cells.length}`).join(', ')} cells`);

const i = process.argv.indexOf('--svg');
if (i > 0) {
  const d = new Drawing();
  out.forEach((s, k) => {
    const c = k % 4, r = Math.floor(k / 4); // four to a row: right is (-1, 2), down (1, 0)
    const { cells } = placeStamp(s.stamp, { l: 2, p: 8 - 7 * c + 12 * r, q: 4 + 14 * c });
    d.begin(); for (const { cell, c, f } of cells) d.paint(cell, { c, f }); d.commit();
  });
  fs.writeFileSync(process.argv[i + 1], toSVG(d, { background: '#f7f5f0' }));
  console.log(`🖼️  ${process.argv[i + 1]}`);
}
