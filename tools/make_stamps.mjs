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
//     [--group ID] [--wide]                 only one group's (vehicles, letters, …); twice as far apart
import fs from 'node:fs';
import path from 'node:path';
import * as L from '../web/engine/lattice.js';
import { shade } from '../web/engine/color.js';
import { Drawing } from '../web/engine/model.js';
import { placeStamp } from '../web/engine/density.js';
import { toSVG } from '../web/engine/svg.js';
import { pack, unpack } from '../web/stamppack.js';

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
function flat(pick, r = 6) {
  const cells = new Map();
  for (const cell of L.cellsInBox(LV, -r, r, -r, r)) {
    const color = pick(cell);
    // A color, or [base color, face tag] for a shaded face.
    if (Array.isArray(color)) cells.set(L.cellKey(cell), { cell, c: shade(color[0], color[1]), f: color[1] });
    else if (color) cells.set(L.cellKey(cell), { cell, c: color, f: null });
  }
  return cells;
}
// Sacred geometry: points around the anchor in edges (x right, y down), and
// the six lattice directions, for circles laid out on the hexagonal grid.
const O = () => L.vertexWorld(LV, 0, 0), E = () => L.edgeLen(LV);
const rel = (cell) => { const { x, y } = L.centroid(cell), o = O(); return { x: (x - o.x) / E(), y: (y - o.y) / E() }; };
const DIRS = [0, 1, 2, 3, 4, 5].map((k) => [Math.cos(Math.PI / 6 + (k * Math.PI) / 3), Math.sin(Math.PI / 6 + (k * Math.PI) / 3)]);
const ringOf = (n, d) => (n === 0 ? [[0, 0]] : DIRS.map(([x, y]) => [x * d, y * d]));
// How many of the circles (centers, radius r) hold the cell's center.
const cover = (cell, centers, r) => { const { x, y } = rel(cell); return centers.filter(([cx, cy]) => Math.hypot(x - cx, y - cy) < r).length; };
// The Flower of Life's 19 centers: the middle, six around it at d, and twelve
// more: six at 2d along the same lines and six between them.
const flowerCenters = (d) => [[0, 0], ...ringOf(1, d), ...ringOf(1, 2 * d),
  ...DIRS.map(([x, y], k) => [d * (x + DIRS[(k + 1) % 6][0]), d * (y + DIRS[(k + 1) % 6][1])])];
const triangle = (R, a0) => [0, 1, 2].map((k) => [R * Math.cos(a0 + (k * 2 * Math.PI) / 3), R * Math.sin(a0 + (k * 2 * Math.PI) / 3)]);
const angleOf = ({ x, y }) => ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
// A flat round face: eyes, a smile, and hair along the top if given.
function face2(skin, hair) {
  const o = L.vertexWorld(LV, 0, 0), s1 = L.edgeLen(LV);
  return flat((cell) => {
    const { x, y } = L.centroid(cell), dx = (x - o.x) / s1, dy = (y - o.y) / s1, r = Math.hypot(dx, dy);
    if (r > 4.1) return null;
    if (hair && dy < -2.4) return hair;
    if (Math.abs(Math.abs(dx) - 1.3) < 0.5 && Math.abs(dy + 0.9) < 0.6) return INK; // eyes
    if (r > 1.9 && r < 2.9 && dy > 1 && Math.abs(dx) < 2.3) return INK; // the smile
    return skin;
  });
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
  FOX = '#e8641b', LIME = '#8bc34a', HOG = '#ff9eb5', DOG = '#b07040', MUZZLE = '#e3c29b',
  GOLD = '#d4a017', PALEGOLD = '#f6d77a', INDIGO = '#3f37c9', VIOLET = '#7b2cbf', ROSE = '#e85d75',
  SKIN = '#f1c27d', RAIN = '#b8c4d0', MOON = '#f4e3a1', PLANET = '#c77dff',
  PINE = '#2e7d32', CLOUD = '#e3eaf2', PURPLE = '#8e5bd6', NAVY = '#1d3557', CREAM = '#fff3d6', FROSTING = '#f8c8dc';

const SHAPES = [
  { id: 'cube', name: 'Cube', group: 'shapes', cells: () => paint(box([0, 0, 0], [1, 1, 1], BLUE)) },
  { id: 'stairs', name: 'Stairs', group: 'shapes', cells: () => paint([...box([0, 0, 0], [3, 1, 1], TEAL), ...box([0, 0, 1], [2, 1, 1], TEAL), ...box([0, 0, 2], [1, 1, 1], TEAL)]) },
  { id: 'house', name: 'House', group: 'buildings', cells: () => paint([
    ...box([0, 0, 0], [2, 2, 1.5], YELLOW),
    // A roof sloping on all four sides at the Pyramid's slope, so its edges come out straight.
    face([[0, 2, 1.5], [2, 2, 1.5], [1, 1, 2.5]], RED, 'L'),
    face([[2, 0, 1.5], [2, 2, 1.5], [1, 1, 2.5]], RED, 'R'),
    face([[0.5, 2, 0], [1, 2, 0], [1, 2, 1], [0.5, 2, 1]], BROWN, 'L'),
    face([[2, 0.5, 0.5], [2, 1, 0.5], [2, 1, 1], [2, 0.5, 1]], SKY, 'R'),
  ]) },
  { id: 'tree', name: 'Tree', group: 'nature', cells: () => paint([...box([0.5, 0.5, 0], [0.5, 0.5, 1], BROWN), ...box([0, 0, 1], [1.5, 1.5, 1.5], GREEN), ...box([0.5, 0.5, 2.5], [0.5, 0.5, 0.5], GREEN)]) },
  { id: 'wall', name: 'Wall', group: 'buildings', cells: () => paint([...box([0, 0, 0], [3, 0.5, 1.5], STONE), ...[0, 1, 2].flatMap((x) => box([x, 0, 1.5], [0.5, 0.5, 0.5], STONE)), ...box([2.5, 0, 1.5], [0.5, 0.5, 0.5], STONE)]) },
  { id: 'pyramid', name: 'Pyramid', group: 'shapes', cells: () => paint([
    // Its peak half the base's width up, so every edge runs along a lattice line and comes out straight.
    face([[0, 2, 0], [2, 2, 0], [1, 1, 1]], SAND, 'L'),
    face([[2, 0, 0], [2, 2, 0], [1, 1, 1]], SAND, 'R'),
  ]) },
  { id: 'flower', name: 'Flower', group: 'nature', cells: () => flat((cell) => {
    const d = hexDistOf(cell);
    if (d <= 1) return YELLOW;
    if (d > 3) return null;
    const { x, y } = L.centroid(cell), o = L.vertexWorld(LV, 0, 0);
    return Math.floor(((Math.atan2(y - o.y, x - o.x) + Math.PI) / (Math.PI / 3))) % 2 ? PINK : '#ff8fb1';
  }) },
  // Two lattice-aligned triangles (side 6 edges) pointing left and right: a six-point star.
  { id: 'star', name: 'Star', group: 'shapes', cells: () => {
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
  { id: 'cat', name: 'Cat', group: 'animals', cells: () => paint([
    ...hbox([0, 1, 2], [1, 1, 4], ORANGE), // tail, up from the rump
    ...hbox([1, 0, 0], [1, 1, 1], ORANGE), ...hbox([6, 0, 0], [1, 1, 1], ORANGE),
    ...hbox([1, 1, 0], [1, 1, 1], ORANGE), ...hbox([6, 1, 0], [1, 1, 1], ORANGE),
    ...hbox([1, 0, 1], [6, 2, 2], ORANGE),
    ...hbox([6, 0, 2], [3, 3, 3], ORANGE),
    ...hbox([6, 0, 5], [1, 1, 1], ORANGE), ...hbox([6, 2, 5], [1, 1, 1], ORANGE),
    patch('L', 3, [7, 8], [3, 4], INK),
  ]) },
  { id: 'bunny', name: 'Bunny', group: 'animals', cells: () => paint([
    ...hbox([0, 0, 0], [4, 3, 3], TAN),
    ...hbox([-1, 2, 1], [1, 1, 1], WHITE), // a puff of a tail
    ...hbox([1, 2, 0], [1, 1, 1], WHITE), ...hbox([3, 2, 0], [1, 1, 1], WHITE), // paws
    ...hbox([3, 0, 2], [3, 3, 3], TAN),
    ...hbox([3, 0, 5], [1, 1, 3], TAN), ...hbox([3, 2, 5], [1, 1, 3], TAN),
    patch('L', 3, [3, 4], [5, 8], PINK),
    patch('L', 3, [4, 5], [3, 4], INK),
    patch('R', 6, [1, 2], [3, 4], PINK),
  ]) },
  { id: 'duck', name: 'Duck', group: 'animals', cells: () => paint([
    ...hbox([0, 1, 2], [1, 1, 1], YELLOW), // tail
    ...hbox([0, 0, 0], [5, 3, 2], YELLOW),
    patch('L', 3, [1, 3], [1, 2], '#e0a800'), // wing
    ...hbox([3, 1, 2], [2, 2, 3], YELLOW),
    ...hbox([5, 1, 3], [1, 2, 1], ORANGE),
    patch('L', 3, [3, 4], [3, 4], INK),
  ]) },
  { id: 'fox', name: 'Fox', group: 'animals', cells: () => paint([
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
  { id: 'snake', name: 'Snake', group: 'animals', cells: () => paint([
    ...hbox([-2, 0, 0], [2, 1, 1], LIME), // the tail, thinner
    ...hbox([0, 0, 0], [2, 2, 2], GREEN), ...hbox([2, 0, 0], [2, 2, 2], LIME), ...hbox([4, 0, 0], [2, 2, 2], GREEN),
    ...hbox([4, 2, 0], [2, 2, 2], LIME), ...hbox([4, 4, 0], [2, 2, 2], GREEN),
    ...hbox([6, 4, 0], [2, 2, 2], LIME), ...hbox([8, 4, 0], [2, 2, 2], GREEN),
    ...hbox([10, 3, 0], [3, 3, 3], GREEN),
    patch('L', 6, [11, 12], [1, 2], INK),
    patch('R', 13, [4, 5], [0, 1], RED), // the tongue
  ]) },
  { id: 'frog', name: 'Frog', group: 'animals', cells: () => paint([
    ...hbox([0, 0, 0], [5, 4, 2], GREEN),
    ...hbox([0, 4, 0], [2, 1, 1], LIME), ...hbox([4, 4, 0], [1, 1, 1], LIME), // a back leg and a front foot
    ...hbox([3, 0, 2], [1, 1, 1], WHITE), ...hbox([3, 3, 2], [1, 1, 1], WHITE),
    patch('R', 4, [0, 1], [2, 3], INK), patch('R', 4, [3, 4], [2, 3], INK),
    patch('R', 5, [0, 4], [1, 2], '#a83232'), // a wide smile
  ]) },
  { id: 'pig', name: 'Pig', group: 'animals', cells: () => paint([
    ...hbox([0, 1, 3], [1, 1, 1], HOG), // a curl of a tail
    ...hbox([1, 0, 0], [1, 1, 1], HOG), ...hbox([6, 0, 0], [1, 1, 1], HOG),
    ...hbox([1, 2, 0], [1, 1, 1], HOG), ...hbox([6, 2, 0], [1, 1, 1], HOG),
    ...hbox([1, 0, 1], [6, 3, 3], HOG),
    ...hbox([7, 0, 2], [2, 3, 3], HOG),
    ...hbox([9, 1, 2], [1, 1, 1], PINK),
    ...hbox([7, 0, 5], [1, 1, 1], PINK), ...hbox([7, 2, 5], [1, 1, 1], PINK),
    patch('L', 3, [8, 9], [3, 4], INK),
  ]) },
  { id: 'dog', name: 'Dog', group: 'animals', cells: () => paint([
    ...hbox([0, 0, 3], [1, 1, 2], DOG), // a wagging tail
    ...hbox([1, 0, 0], [1, 1, 1], DOG), ...hbox([6, 0, 0], [1, 1, 1], DOG),
    ...hbox([1, 1, 0], [1, 1, 1], DOG), ...hbox([6, 1, 0], [1, 1, 1], DOG),
    ...hbox([1, 0, 1], [6, 2, 2], DOG),
    ...hbox([6, 0, 2], [3, 3, 3], DOG),
    ...hbox([9, 1, 2], [1, 1, 2], MUZZLE), patch('R', 10, [1, 2], [3, 4], INK), // the snout and its nose
    ...hbox([6, 3, 2], [1, 1, 3], BROWN), // a floppy ear
    patch('L', 3, [7, 8], [3, 4], INK),
  ]) },
  { id: 'fish', name: 'Fish', group: 'animals', cells: () => paint([
    ...hbox([-1, 0, 0], [1, 2, 2], ORANGE), ...hbox([-1, 0, 3], [1, 2, 2], ORANGE), ...hbox([0, 0, 1], [1, 2, 3], ORANGE), // the tail
    ...hbox([2, 0, 0], [4, 2, 1], ORANGE),
    ...hbox([1, 0, 1], [6, 2, 3], ORANGE),
    ...hbox([2, 0, 4], [4, 2, 1], ORANGE),
    patch('L', 2, [2, 3], [0, 5], WHITE), patch('L', 2, [4, 5], [0, 5], WHITE), // stripes
    patch('L', 2, [5, 6], [2, 3], INK),
  ]) },
  { id: 'bird', name: 'Bird', group: 'animals', cells: () => paint([
    ...hbox([-2, 1, 3], [2, 1, 1], BLUE), // the tail
    ...hbox([1, 1, 0], [1, 1, 1], INK), ...hbox([3, 1, 0], [1, 1, 1], INK), // legs
    ...hbox([0, 0, 1], [3, 3, 3], BLUE), ...hbox([3, 0, 1], [1, 3, 2], ORANGE), // the breast
    ...hbox([3, 0, 3], [3, 3, 3], BLUE),
    ...hbox([6, 1, 4], [1, 1, 1], YELLOW),
    patch('L', 3, [0, 2], [2, 3], '#1f5fbf'), // a wing
    patch('L', 3, [4, 5], [4, 5], INK),
  ]) },
  // Nature.
  { id: 'sun', name: 'Sun', group: 'weather', cells: () => flat((cell) => {
    const d = hexDistOf(cell);
    if (d <= 2) return YELLOW;
    if (d > 4) return null;
    // Rays: six spokes of the hexagon's corners, two cells wide.
    const { x, y } = L.centroid(cell), o = L.vertexWorld(LV, 0, 0);
    const a = ((Math.atan2(y - o.y, x - o.x) * 180) / Math.PI + 360) % 60;
    return a < 12 || a > 48 ? ORANGE : null;
  }) },
  { id: 'cloud', name: 'Cloud', group: 'weather', cells: () => paint([
    ...hbox([0, 0, 0], [8, 4, 2], CLOUD), ...hbox([1, 0, 2], [3, 4, 2], CLOUD), ...hbox([4, 0, 2], [3, 4, 3], CLOUD),
  ]) },
  { id: 'rock', name: 'Rock', group: 'nature', cells: () => paint([
    ...hbox([0, 0, 0], [5, 4, 2], STONE), ...hbox([1, 0, 2], [3, 3, 1], STONE), ...hbox([4, 1, 0], [2, 3, 1], STONE),
  ]) },
  { id: 'mushroom', name: 'Mushroom', group: 'nature', cells: () => paint([
    ...hbox([2, 2, 0], [2, 2, 3], CREAM),
    ...hbox([0, 0, 3], [6, 6, 2], RED), ...hbox([1, 1, 5], [4, 4, 1], RED),
    patch('L', 6, [1, 2], [3, 4], WHITE), patch('L', 6, [4, 5], [4, 5], WHITE), patch('R', 6, [2, 3], [4, 5], WHITE),
  ]) },
  { id: 'pine', name: 'Pine tree', group: 'nature', cells: () => paint([
    // A trunk tall enough to show under the branches, so it is not taken for a stepped cake.
    ...hbox([2, 2, 0], [1, 1, 3], BROWN),
    ...hbox([0, 0, 3], [5, 5, 2], PINE), ...hbox([1, 1, 5], [3, 3, 2], PINE), ...hbox([2, 2, 7], [1, 1, 2], PINE),
  ]) },
  { id: 'bush', name: 'Bush', group: 'nature', cells: () => paint([
    ...hbox([0, 0, 0], [6, 4, 2], GREEN), ...hbox([1, 0, 2], [4, 4, 1], GREEN),
    patch('L', 4, [1, 2], [1, 2], RED), patch('L', 4, [4, 5], [0, 1], RED), patch('R', 6, [1, 2], [1, 2], RED), // berries
  ]) },
  // Flat bands of the hexagon around the anchor, upper half only.
  { id: 'rainbow', name: 'Rainbow', group: 'weather', cells: () => flat((cell) => {
    const { y } = L.centroid(cell), o = L.vertexWorld(LV, 0, 0);
    if (y > o.y) return null;
    return [null, null, null, PURPLE, BLUE, GREEN, YELLOW, ORANGE, RED][hexDistOf(cell)] || null;
  }, 9) },
  // Vehicles, side on, facing right, like the animals.
  { id: 'car', name: 'Car', group: 'vehicles', cells: () => paint([
    ...hbox([1, 0, 0], [2, 1, 1], INK), ...hbox([5, 0, 0], [2, 1, 1], INK),
    ...hbox([0, 0, 1], [8, 4, 2], RED), ...hbox([2, 0, 3], [4, 4, 2], RED),
    ...hbox([1, 3, 0], [2, 1, 1], INK), ...hbox([5, 3, 0], [2, 1, 1], INK),
    patch('L', 4, [2, 3], [3, 4], SKY), patch('L', 4, [4, 5], [3, 4], SKY), patch('R', 6, [1, 3], [3, 4], SKY),
    patch('R', 8, [0, 1], [2, 3], YELLOW), patch('R', 8, [3, 4], [2, 3], YELLOW),
  ]) },
  { id: 'truck', name: 'Truck', group: 'vehicles', cells: () => paint([
    ...hbox([1, 0, 0], [2, 1, 1], INK), ...hbox([7, 0, 0], [2, 1, 1], INK),
    ...hbox([0, 0, 1], [6, 4, 4], ORANGE), ...hbox([6, 0, 1], [3, 4, 3], BLUE),
    ...hbox([1, 3, 0], [2, 1, 1], INK), ...hbox([7, 3, 0], [2, 1, 1], INK),
    patch('L', 4, [7, 8], [3, 4], SKY), patch('R', 9, [1, 3], [3, 4], SKY),
  ]) },
  { id: 'train', name: 'Train', group: 'vehicles', cells: () => paint([
    ...hbox([1, 0, 0], [1, 1, 1], INK), ...hbox([4, 0, 0], [1, 1, 1], INK), ...hbox([6, 0, 0], [1, 1, 1], INK),
    ...hbox([0, 0, 1], [3, 3, 5], RED), ...hbox([0, 0, 6], [3, 3, 1], INK), // the cab and its roof
    ...hbox([3, 0, 1], [5, 3, 3], NAVY),
    ...hbox([6, 1, 4], [1, 1, 2], INK), // the chimney
    ...hbox([1, 2, 0], [1, 1, 1], INK), ...hbox([4, 2, 0], [1, 1, 1], INK), ...hbox([6, 2, 0], [1, 1, 1], INK),
    patch('L', 3, [1, 2], [3, 5], YELLOW), patch('R', 8, [1, 2], [2, 3], YELLOW),
  ]) },
  { id: 'boat', name: 'Boat', group: 'vehicles', cells: () => paint([
    ...hbox([0, 0, 0], [8, 3, 2], BROWN), patch('L', 3, [0, 8], [1, 2], RED),
    ...hbox([3, 1, 2], [1, 1, 6], BROWN),
    ...hbox([4, -1, 3], [1, 5, 4], WHITE), patch('R', 5, [-1, 4], [4, 5], RED), // a square sail across the boat
  ]) },
  { id: 'rocket', name: 'Rocket', group: 'vehicles', cells: () => paint([
    ...hbox([1, 1, 0], [1, 1, 2], ORANGE), // the flame
    ...hbox([1, -1, 2], [1, 1, 2], RED), ...hbox([-1, 1, 2], [1, 1, 2], RED),
    ...hbox([0, 0, 2], [3, 3, 6], WHITE),
    ...hbox([3, 1, 2], [1, 1, 2], RED), ...hbox([1, 3, 2], [1, 1, 2], RED),
    ...hbox([0, 0, 8], [3, 3, 1], RED), ...hbox([1, 1, 9], [1, 1, 1], RED),
    patch('L', 3, [1, 2], [5, 6], SKY),
  ]) },
  { id: 'plane', name: 'Plane', group: 'vehicles', cells: () => paint([
    ...hbox([3, -3, 3], [2, 4, 1], BLUE), ...hbox([0, -1, 3], [1, 2, 1], BLUE),
    ...hbox([0, 1, 2], [8, 2, 2], WHITE), ...hbox([8, 1, 2], [1, 2, 1], WHITE),
    ...hbox([0, 1, 4], [1, 1, 2], RED), // the tail fin
    ...hbox([3, 3, 3], [2, 4, 1], BLUE), ...hbox([0, 3, 3], [1, 2, 1], BLUE),
    patch('L', 3, [2, 3], [3, 4], SKY), patch('L', 3, [5, 6], [3, 4], SKY), patch('L', 3, [7, 8], [3, 4], SKY),
  ]) },
  // Food.
  { id: 'apple', name: 'Apple', group: 'food', cells: () => paint([
    ...hbox([1, 1, 0], [3, 3, 1], RED), ...hbox([0, 0, 1], [5, 5, 4], RED), ...hbox([1, 1, 5], [3, 3, 1], RED),
    ...hbox([2, 2, 6], [1, 1, 1], BROWN), ...hbox([2, 3, 6], [1, 1, 1], GREEN),
  ]) },
  // Three tiers and a cherry (the one-block Cake went, owner 2026-10-19).
  { id: 'cake', name: 'Cake', group: 'food', cells: () => paint([
    ...hbox([0, 0, 0], [7, 7, 2], FROSTING), ...hbox([1, 1, 2], [5, 5, 2], CREAM), ...hbox([2, 2, 4], [3, 3, 2], FROSTING),
    ...hbox([3, 3, 6], [1, 1, 1], RED), // a cherry
  ]) },
  { id: 'icecream', name: 'Ice cream', group: 'food', cells: () => paint([
    ...hbox([1, 1, 0], [1, 1, 2], SAND), ...hbox([0, 0, 2], [3, 3, 2], SAND),
    ...hbox([0, 0, 4], [3, 3, 1], PINK), ...hbox([-1, -1, 5], [5, 5, 3], PINK), ...hbox([0, 0, 8], [3, 3, 1], PINK),
    ...hbox([1, 1, 9], [1, 1, 1], RED),
  ]) },
  { id: 'cupcake', name: 'Cupcake', group: 'food', cells: () => paint([
    ...hbox([0, 0, 0], [5, 5, 2], TEAL), ...hbox([0, 0, 2], [5, 5, 1], FROSTING), ...hbox([1, 1, 3], [3, 3, 1], FROSTING),
    ...hbox([2, 2, 4], [1, 1, 1], RED),
    patch('L', 5, [1, 2], [2, 3], YELLOW), patch('L', 5, [3, 4], [2, 3], SKY), patch('R', 5, [2, 3], [2, 3], YELLOW), // sprinkles
  ]) },
  // A slice, flat, pointing right: the lattice has no level lines, so its
  // crust is the straight up-and-down side. Side 9 edges, so the corners are vertices.
  { id: 'pizza', name: 'Pizza', group: 'food', cells: () => {
    const o = L.vertexWorld(LV, 0, 0), step = L.edgeLen(LV), R = 9 * step / Math.sqrt(3);
    const tri = [0, 1, 2].map((k) => [o.x + R * Math.cos((k * 2 * Math.PI) / 3), o.y + R * Math.sin((k * 2 * Math.PI) / 3)]);
    const crust = o.x - R / 2 + (step * Math.sqrt(3)) / 2;
    const dots = [[o.x - 0.6 * R, o.y - 0.35 * R], [o.x - 0.6 * R, o.y + 0.35 * R], [o.x + 0.25 * R, o.y]].map(([x, y]) => [x + step, y]);
    return flat((cell) => {
      const { x, y } = L.centroid(cell);
      if (!inside(tri, x, y)) return null;
      if (x < crust) return BROWN;
      return dots.some(([dx, dy]) => Math.hypot(x - dx, y - dy) < 1.1 * step) ? RED : YELLOW;
    }, 9);
  } },
  { id: 'carrot', name: 'Carrot', group: 'food', cells: () => paint([
    ...hbox([1, 1, 0], [1, 1, 2], ORANGE), ...hbox([0, 0, 2], [3, 3, 4], ORANGE),
    ...hbox([1, 1, 6], [1, 1, 2], GREEN), ...hbox([0, 1, 7], [1, 1, 1], GREEN), ...hbox([2, 1, 7], [1, 1, 1], GREEN),
  ]) },
  // Buildings (House and Wall above).
  { id: 'castle', name: 'Castle', group: 'buildings', cells: () => paint([
    ...hbox([0, 0, 0], [2, 3, 7], STONE),
    ...hbox([2, 0, 0], [4, 3, 5], STONE), ...hbox([2, 0, 5], [1, 3, 1], STONE), ...hbox([4, 0, 5], [1, 3, 1], STONE),
    ...hbox([6, 0, 0], [2, 3, 7], STONE),
    patch('L', 3, [3, 5], [0, 3], BROWN), // the gate
    patch('L', 3, [0, 1], [4, 5], INK), patch('L', 3, [6, 7], [4, 5], INK),
    ...hbox([7, 1, 7], [1, 1, 3], BROWN), patch('L', 2, [8, 10], [8, 10], RED), // a flag
  ]) },
  { id: 'tower', name: 'Tower', group: 'buildings', cells: () => paint([
    ...hbox([0, 0, 0], [3, 3, 9], STONE), ...hbox([0, 0, 9], [3, 3, 1], RED), ...hbox([1, 1, 10], [1, 1, 2], RED),
    patch('L', 3, [1, 2], [0, 2], BROWN), patch('L', 3, [1, 2], [6, 7], INK), patch('R', 3, [1, 2], [6, 7], INK),
  ]) },
  { id: 'bridge', name: 'Bridge', group: 'buildings', cells: () => paint([
    ...hbox([0, 0, 0], [2, 3, 3], STONE), ...hbox([8, 0, 0], [2, 3, 3], STONE),
    ...hbox([0, 0, 3], [10, 3, 1], BROWN),
    ...[0, 3, 6, 9].flatMap((x) => hbox([x, 2, 4], [1, 1, 1], BROWN)), // railing posts
  ]) },
  // People.
  { id: 'smiley', name: 'Smiley', group: 'people', cells: () => face2(YELLOW) },
  { id: 'kid', name: 'Kid', group: 'people', cells: () => face2(SKIN, BROWN) },
  { id: 'person', name: 'Person', group: 'people', cells: () => paint([
    ...hbox([0, 0, 0], [1, 2, 3], NAVY), ...hbox([2, 0, 0], [1, 2, 3], NAVY),
    ...hbox([-1, 0, 3], [1, 2, 4], SKIN), ...hbox([0, 0, 3], [3, 2, 4], RED), ...hbox([3, 0, 3], [1, 2, 4], SKIN),
    ...hbox([0, 0, 7], [3, 2, 3], SKIN), ...hbox([0, 0, 10], [3, 2, 1], BROWN),
    patch('L', 2, [0, 1], [8, 9], INK), patch('L', 2, [2, 3], [8, 9], INK),
  ]) },
  // Space (the Rocket is in Vehicles).
  { id: 'planet', name: 'Planet', group: 'space', cells: () => paint([
    ...hbox([-1, -1, 3], [7, 1, 1], SAND), ...hbox([-1, 0, 3], [1, 5, 1], SAND), // the ring behind
    ...hbox([1, 1, 0], [3, 3, 1], PLANET), ...hbox([0, 0, 1], [5, 5, 5], PLANET), ...hbox([1, 1, 6], [3, 3, 1], PLANET),
    ...hbox([-1, 5, 3], [7, 1, 1], SAND), ...hbox([5, 0, 3], [1, 5, 1], SAND), // and in front
  ]) },
  { id: 'moon', name: 'Moon', group: 'space', cells: () => {
    const o = L.vertexWorld(LV, 0, 0), s1 = L.edgeLen(LV);
    return flat((cell) => {
      const { x, y } = L.centroid(cell);
      return Math.hypot(x - o.x, y - o.y) < 4.2 * s1 && Math.hypot(x - o.x - 2 * s1, y - o.y + 1 * s1) > 3.4 * s1 ? '#f2d16b' : null;
    }, 8);
  } },
  // Little six-point stars (two triangles of side 3 edges, so their points are vertices), scattered.
  { id: 'stars', name: 'Stars', group: 'space', cells: () => {
    const R = Math.sqrt(3) * L.edgeLen(LV);
    const tri = (cx, cy, a0) => [0, 1, 2].map((k) => [cx + R * Math.cos(a0 + (k * 2 * Math.PI) / 3), cy + R * Math.sin(a0 + (k * 2 * Math.PI) / 3)]);
    const stars = [[0, 0, YELLOW], [-6, 4, ORANGE], [-3, -4, YELLOW], [-10, 2, YELLOW]].map(([p, q, c]) => {
      const { x, y } = L.vertexWorld(LV, p, q);
      return { a: tri(x, y, 0), b: tri(x, y, Math.PI), c };
    });
    return flat((cell) => {
      const { x, y } = L.centroid(cell);
      return stars.find((st) => inside(st.a, x, y) || inside(st.b, x, y))?.c || null;
    }, 12);
  } },
  { id: 'ufo', name: 'UFO', group: 'space', cells: () => paint([
    ...hbox([1, 1, 0], [5, 5, 1], STONE), ...hbox([0, 0, 1], [7, 7, 1], STONE), ...hbox([2, 2, 2], [3, 3, 2], SKY),
    patch('L', 7, [1, 2], [1, 2], YELLOW), patch('L', 7, [3, 4], [1, 2], YELLOW), patch('L', 7, [5, 6], [1, 2], YELLOW),
    patch('R', 7, [1, 2], [1, 2], YELLOW), patch('R', 7, [3, 4], [1, 2], YELLOW), patch('R', 7, [5, 6], [1, 2], YELLOW),
  ]) },
  // Weather (Sun, Cloud and Rainbow above).
  { id: 'raincloud', name: 'Rain cloud', group: 'weather', cells: () => paint([
    ...[[1, 1], [4, 2], [2, 3], [5, 0]].flatMap(([x, y]) => [...hbox([x, y, -3], [1, 1, 1], BLUE), ...hbox([x + 1, y, -6], [1, 1, 1], BLUE)]),
    ...hbox([0, 0, 0], [7, 4, 2], RAIN), ...hbox([1, 0, 2], [3, 4, 2], RAIN), ...hbox([4, 1, 2], [2, 3, 1], RAIN),
  ]) },
  // Six arms along the lattice's three line families through the anchor, each with a pair of branches.
  { id: 'snowflake', name: 'Snowflake', group: 'weather', cells: () => {
    const on = ([p, q], [ap, aq], k) => (k === 0 ? q === aq : k === 1 ? p === ap : p + q === ap + aq);
    const edgeOn = (cell, A, k) => L.cellVerts(cell).filter((v) => on(v, A, k)).length >= 2;
    const arms = [[3, 0], [-3, 0], [0, 3], [0, -3], [3, -3], [-3, 3]];
    return flat((cell) => {
      const d = hexDistOf(cell);
      if (d <= 4 && [0, 1, 2].some((k) => edgeOn(cell, [0, 0], k))) return SKY;
      for (const A of arms) {
        const k0 = A[1] === 0 ? 0 : A[0] === 0 ? 1 : 2; // the arm's own family
        const near = Math.max(...L.cellVerts(cell).map(([p, q]) => L.hexDist(p - A[0], q - A[1])));
        if (near <= 1 && [0, 1, 2].some((k) => k !== k0 && edgeOn(cell, A, k))) return SKY;
      }
      return null;
    }, 7);
  } },
  // A flat bolt, in edges from the anchor (x right, y down); its slants come out stair-stepped.
  { id: 'lightning', name: 'Lightning', group: 'weather', cells: () => {
    const o = L.vertexWorld(LV, 0, 0), s1 = L.edgeLen(LV);
    const poly = [[0.5, -6.5], [3.2, -6.5], [1.6, -3.2], [3.6, -3.2], [-0.8, 1.6], [0.6, -1.4], [-1.3, -1.4]].map(([x, y]) => [o.x + 1.7 * x * s1, o.y + 1.7 * (y - 1.6) * s1]);
    return flat((cell) => { const { x, y } = L.centroid(cell); return inside(poly, x, y) ? YELLOW : null; }, 16);
  } },
  // Sacred geometry.
  { id: 'seed', name: 'Seed of Life', group: 'sacred', cells: () => flat((cell) => {
    // Seven circles; cells covered an odd number of times light, even dark, so the petals show.
    const n = cover(cell, [[0, 0], ...ringOf(1, 3.6)], 3.6);
    return n ? (n % 2 ? PALEGOLD : GOLD) : null;
  }, 12) },
  { id: 'flower-of-life', name: 'Flower of Life', group: 'sacred', cells: () => flat((cell) => {
    const { x, y } = rel(cell), r = Math.hypot(x, y);
    if (r > 9.8) return null;
    if (r > 9) return GOLD; // the ring around it
    const n = cover(cell, flowerCenters(3), 3);
    return n ? (n % 2 ? PALEGOLD : INDIGO) : null;
  }, 14) },
  { id: 'fruit-of-life', name: 'Fruit of Life', group: 'sacred', cells: () => flat((cell) => {
    const centers = [[0, 0], ...ringOf(1, 3.6), ...ringOf(1, 7.2)];
    const n = cover(cell, centers, 1.5);
    if (!n) return null;
    const { x, y } = rel(cell);
    return Math.hypot(x, y) < 1.5 ? VIOLET : GOLD;
  }, 12) },
  // A star tetrahedron: two triangles, faceted light and dark like a solid.
  { id: 'merkaba', name: 'Merkaba', group: 'sacred', cells: () => flat((cell) => {
    const p = rel(cell), R = 9 / Math.sqrt(3);
    const a = inside(triangle(R, 0), p.x, p.y), b = inside(triangle(R, Math.PI), p.x, p.y);
    if (!a && !b) return null;
    const w = Math.floor(((angleOf(p) + 30) % 360) / 60); // six wedges, each round a point
    return [[GOLD, 'T'], [GOLD, 'R'], [GOLD, 'L'], [GOLD, 'T'], [GOLD, 'R'], [GOLD, 'L']][w];
  }, 9) },
  { id: 'mandala', name: 'Mandala', group: 'sacred', cells: () => flat((cell) => {
    const d = hexDistOf(cell), a = angleOf(rel(cell)) % 60;
    if (d <= 1) return GOLD;
    if (d === 2) return VIOLET;
    if (d === 3) return Math.abs(a - 30) < 16 ? ROSE : null;
    if (d === 4) return GOLD;
    if (d === 5) return a < 10 || a > 50 ? TEAL : null;
    if (d === 6) return Math.abs(a - 30) < 8 ? VIOLET : null;
    return null;
  }, 8) },
  // Pascal's triangle mod 2 on the lattice's own triangles: a cell is in when its row and column share no bit.
  { id: 'sierpinski', name: 'Sierpinski', group: 'sacred', cells: () => {
    const cells = new Map(), N = 16;
    for (let p = 0; p < N; p++) for (let q = 0; p + q < N; q++) {
      if (p & q) continue;
      const cell = L.mk(LV, p, q, 1);
      cells.set(L.cellKey(cell), { cell, c: GOLD, f: null });
    }
    return cells;
  } },
  // A cube inside a six-point star inside a hexagon: every line on the lattice.
  { id: 'star-cube', name: 'Star cube', group: 'sacred', cells: () => flat((cell) => {
    const d = hexDistOf(cell), p = rel(cell), R = 9 / Math.sqrt(3);
    if (d > 6) return null;
    if (d === 6) return GOLD;
    if (d <= 3) { const t = angleOf(p); return t >= 210 && t < 330 ? [VIOLET, 'T'] : t >= 90 && t < 210 ? [VIOLET, 'L'] : [VIOLET, 'R']; }
    return inside(triangle(R, 0), p.x, p.y) || inside(triangle(R, Math.PI), p.x, p.y) ? INDIGO : null;
  }, 8) },
];

// Letters and numbers: a 5×7 pixel font, each pixel a little block on the lit
// side (the text runs down to the right, as on an isometric sign), in colors
// that go round the rainbow.
const FONT = {
  A: '.###.|#...#|#...#|#####|#...#|#...#|#...#', B: '####.|#...#|#...#|####.|#...#|#...#|####.',
  C: '.###.|#...#|#....|#....|#....|#...#|.###.', D: '####.|#...#|#...#|#...#|#...#|#...#|####.',
  E: '#####|#....|#....|####.|#....|#....|#####', F: '#####|#....|#....|####.|#....|#....|#....',
  G: '.###.|#...#|#....|#.###|#...#|#...#|.####', H: '#...#|#...#|#...#|#####|#...#|#...#|#...#',
  I: '.###.|..#..|..#..|..#..|..#..|..#..|.###.', J: '..###|...#.|...#.|...#.|...#.|#..#.|.##..',
  K: '#...#|#..#.|#.#..|##...|#.#..|#..#.|#...#', L: '#....|#....|#....|#....|#....|#....|#####',
  M: '#...#|##.##|#.#.#|#.#.#|#...#|#...#|#...#', N: '#...#|#...#|##..#|#.#.#|#..##|#...#|#...#',
  O: '.###.|#...#|#...#|#...#|#...#|#...#|.###.', P: '####.|#...#|#...#|####.|#....|#....|#....',
  Q: '.###.|#...#|#...#|#...#|#.#.#|#..#.|.##.#', R: '####.|#...#|#...#|####.|#.#..|#..#.|#...#',
  S: '.####|#....|#....|.###.|....#|....#|####.', T: '#####|..#..|..#..|..#..|..#..|..#..|..#..',
  U: '#...#|#...#|#...#|#...#|#...#|#...#|.###.', V: '#...#|#...#|#...#|#...#|#...#|.#.#.|..#..',
  W: '#...#|#...#|#...#|#.#.#|#.#.#|#.#.#|.#.#.', X: '#...#|#...#|.#.#.|..#..|.#.#.|#...#|#...#',
  Y: '#...#|#...#|.#.#.|..#..|..#..|..#..|..#..', Z: '#####|....#|...#.|..#..|.#...|#....|#####',
  0: '.###.|#...#|#..##|#.#.#|##..#|#...#|.###.', 1: '..#..|.##..|..#..|..#..|..#..|..#..|.###.',
  2: '.###.|#...#|....#|...#.|..#..|.#...|#####', 3: '#####|...#.|..#..|...#.|....#|#...#|.###.',
  4: '...#.|..##.|.#.#.|#..#.|#####|...#.|...#.', 5: '#####|#....|####.|....#|....#|#...#|.###.',
  6: '..##.|.#...|#....|####.|#...#|#...#|.###.', 7: '#####|....#|...#.|..#..|.#...|.#...|.#...',
  8: '.###.|#...#|#...#|.###.|#...#|#...#|.###.', 9: '.###.|#...#|#...#|.####|....#|...#.|.##..',
};
const RAINBOW = [RED, ORANGE, YELLOW, GREEN, TEAL, BLUE, PURPLE, PINK];
const pixels = (bits, color) => () => {
  const rows = bits.split('|'), px = [];
  rows.forEach((row, r) => [...row].forEach((on, c) => { if (on === '#') px.push([c, rows.length - 1 - r]); }));
  px.sort((a, b) => a[0] - b[0] || a[1] - b[1]); // back to front: left to right, bottom to top
  return paint(px.flatMap(([c, z]) => hbox([c, 0, z], [1, 1, 1], color)));
};
const glyph = (ch, color) => pixels(FONT[ch], color);
const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', DIGITS = '0123456789';
SHAPES.push(
  ...[...LETTERS].map((ch, i) => ({ id: `letter-${ch.toLowerCase()}`, name: ch, group: 'letters', cells: glyph(ch, RAINBOW[i % RAINBOW.length]) })),
  ...[...DIGITS].map((ch, i) => ({ id: `number-${ch}`, name: ch, group: 'numbers', cells: glyph(ch, RAINBOW[i % RAINBOW.length]) })),
);

// The stamp: cells relative to the anchor, the vertex at the middle of its bottom.
function stampOf(cells) {
  const list = [...cells.values()];
  const ws = list.map(({ cell }) => L.centroid(cell));
  const midX = (Math.min(...ws.map((w) => w.x)) + Math.max(...ws.map((w) => w.x))) / 2, low = Math.max(...ws.map((w) => w.y));
  const a = L.nearestVertex(LV, midX, low);
  return { base: 0, cells: list.map(({ cell, c, f }) => [0, cell.p - a.p, cell.q - a.q, cell.u, c, f]), edges: [] };
}

// The drawer's sections, in order; each starter stamp names its group.
const GROUPS = [
  { id: 'shapes', name: 'Shapes' }, { id: 'buildings', name: 'Buildings' }, { id: 'nature', name: 'Nature' },
  { id: 'weather', name: 'Weather' }, { id: 'animals', name: 'Animals' }, { id: 'people', name: 'People' },
  { id: 'vehicles', name: 'Vehicles' }, { id: 'space', name: 'Space' }, { id: 'food', name: 'Food' },
  { id: 'letters', name: 'Letters', small: true }, { id: 'numbers', name: 'Numbers', small: true },
  { id: 'sacred', name: 'Sacred geometry' }, // last (owner, 2026-10-19)
];
const out = GROUPS.flatMap((g) => SHAPES.filter((s) => s.group === g.id))
  .map((s) => ({ id: s.id, name: s.name, group: s.group, stamp: stampOf(s.cells()) }));
if (out.length !== SHAPES.length) throw new Error('a shape has no group in GROUPS');
// Packed for web/stamps.js (web/stamppack.js); unpacking must give every cell back.
const sorted = (cells) => JSON.stringify(cells.map((c) => JSON.stringify(c)).sort());
const packed = out.map(({ stamp, ...s }) => {
  const p = pack(stamp);
  if (sorted(unpack(p).cells) !== sorted(stamp.cells)) throw new Error(`${s.name} does not unpack to its cells`);
  return { ...s, ...p };
});
const js = `// The starter stamps: the owner's eight (Cube, Stairs, House, Tree, Wall,
// Pyramid, Flower, Star), then animals, nature, vehicles, food, letters and
// numbers, in the drawer's groups.
// Made by tools/make_stamps.mjs from 3D shapes on the lattice; edit that, not
// this. Each is a stamp like one saved from a selection: cells
// [dl, dp, dq, u, color, face] around its anchor vertex, packed by
// web/stamppack.js (web/stampbook.js unpacks them). GROUPS are the Stamps
// drawer's sections, in order; each stamp names its group.
export const GROUPS = ${JSON.stringify(GROUPS)};
export const PACKED = [
${packed.map((s) => '  ' + JSON.stringify(s)).join(',\n')},
];
`;
const file = path.join(ROOT, 'web/stamps.js');
if (process.argv.includes('--check')) {
  if (fs.readFileSync(file, 'utf8') !== js) { console.error('❌ web/stamps.js is not what tools/make_stamps.mjs makes: run node tools/make_stamps.mjs'); process.exit(1); }
  console.log('✅ web/stamps.js matches tools/make_stamps.mjs');
  process.exit(0);
}
fs.writeFileSync(file, js);
console.log(`✅ web/stamps.js: ${out.map((s) => `${s.name} ${s.stamp.cells.length}`).join(', ')} cells`);

const i = process.argv.indexOf('--svg'), only = process.argv.indexOf('--group');
if (i > 0) {
  const d = new Drawing();
  out.filter((s) => only < 0 || s.group === process.argv[only + 1]).forEach((s, k) => {
    const c = k % 4, r = Math.floor(k / 4), w = process.argv.includes('--wide') ? 2 : 1; // four to a row: right is (-1, 2), down (1, 0)
    const { cells } = placeStamp(s.stamp, { l: 2, p: 8 * w - 7 * w * c + 12 * w * r, q: 4 * w + 14 * w * c });
    d.begin(); for (const { cell, c, f } of cells) d.paint(cell, { c, f }); d.commit();
  });
  fs.writeFileSync(process.argv[i + 1], toSVG(d, { background: '#f7f5f0' }));
  console.log(`🖼️  ${process.argv[i + 1]}`);
}
