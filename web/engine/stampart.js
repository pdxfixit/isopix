// The starter stamps' art that the app draws itself (docs/spec-stamp-size-turn.md,
// step 2; owner, 2026-10-19): the flat pictures, each a formula of a point, drawn
// at any size so curves come out rounder as they grow, upright or laid on the floor
// or a wall; and the letters and numbers, a 5×7 font of little blocks, stood on
// either wall or laid on the floor. tools/make_stamps.mjs builds every starter
// stamp's 1× art with this module (and the box painter here), so web/stamps.js is
// what the app would draw. Pure, no DOM.
//
// Points are in edges of the level the art is built at (LV), from the picture's
// origin, the vertex (0, 0): x right, y down. Lattice coords (pp, qq) at LV.
import * as L from './lattice.js';
import { shade } from './color.js';
import { scaleStamp } from './density.js';

export const LV = 3; // the level the art is built at; a stamp keeps only offsets from its anchor
export const U = 2;  // a cube unit, in edges

export const COLORS = {
  BLUE: '#3a86ff', TEAL: '#2a9d8f', YELLOW: '#f4c430', RED: '#e63946', GREEN: '#5a9a3c',
  BROWN: '#8b5a2b', STONE: '#9aa0a6', SAND: '#e9b949', PINK: '#ff5d8f', SKY: '#8ecae6', ORANGE: '#f4a020', INK: '#2b2d42', WHITE: '#f1ece4', TAN: '#c9a27e',
  FOX: '#e8641b', LIME: '#8bc34a', HOG: '#ff9eb5', DOG: '#b07040', MUZZLE: '#e3c29b',
  GOLD: '#d4a017', PALEGOLD: '#f6d77a', INDIGO: '#3f37c9', VIOLET: '#7b2cbf', ROSE: '#e85d75',
  SKIN: '#f1c27d', RAIN: '#b8c4d0', MOON: '#f4e3a1', PLANET: '#c77dff',
  PINE: '#2e7d32', CLOUD: '#e3eaf2', PURPLE: '#8e5bd6', NAVY: '#1d3557', CREAM: '#fff3d6', FROSTING: '#f8c8dc',
};
const { BLUE, TEAL, YELLOW, RED, GREEN, BROWN, PINK, SKY, ORANGE, INK, GOLD, PALEGOLD, INDIGO, VIOLET, ROSE, SKIN, PURPLE } = COLORS;

// ---------- the box painter ----------
// A 3D point (x, y, z) in cube units lands on lattice vertex (p, q) = ((y - z)·U,
// (x - y)·U): up is (-1, 0), down-right (+x) is (0, 1), down-left (+y) is (1, -1).
export const at = ([x, y, z]) => [(y - z) * U, (x - y) * U];
export function inside(poly, pp, qq) {
  let hit = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [pi, qi] = poly[i], [pj, qj] = poly[j];
    if ((qi > qq) !== (qj > qq) && pp < ((pj - pi) * (qq - qi)) / (qj - qi) + pi) hit = !hit;
  }
  return hit;
}
// A face: 3D corners, a color, and which way it faces as a cube-face tag: T (up,
// +z), L (+y) and R (+x) face the viewer; l (-y) and r (-x) face away, and show
// only when the stamp is spun (render). null for flat paint.
export const face = (pts, color, f) => ({ poly: pts.map(at), pts, color, f });
export function box([x0, y0, z0], [sx, sy, sz], color) {
  const x1 = x0 + sx, y1 = y0 + sy, z1 = z0 + sz;
  return [
    face([[x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1]], color, 'T'),
    face([[x0, y1, z0], [x1, y1, z0], [x1, y1, z1], [x0, y1, z1]], color, 'L'),
    face([[x1, y0, z0], [x1, y1, z0], [x1, y1, z1], [x1, y0, z1]], color, 'R'),
    face([[x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1]], color, 'l'),
    face([[x0, y0, z0], [x0, y1, z0], [x0, y1, z1], [x0, y0, z1]], color, 'r'),
  ];
}
// Boxes in half units, for small features (ears, eyes, a beak, a letter's pixel).
export const hbox = (o, sz, color) => box(o.map((v) => v / 2), sz.map((v) => v / 2), color);
// A patch on a box's side: on the L side (the plane y = at) from x0 to x1, or
// the R side (x = at) from y0 to y1; z0 to z1 up. Half units. l and r are the
// same planes seen from behind (the back of a box), shown only when spun.
export const patch = (side, at, [a0, a1], [z0, z1], color) => face(
  (side === 'L' || side === 'l' ? [[a0, at, z0], [a1, at, z0], [a1, at, z1], [a0, at, z1]] : [[at, a0, z0], [at, a1, z0], [at, a1, z1], [at, a0, z1]]).map((v) => v.map((n) => n / 2)),
  color, side);
// A patch on a box's top (the plane z = at), half units: stripes, a saddle, spots.
export const top = (at, [x0, x1], [y0, y1], color) => face([[x0, y0, at], [x1, y0, at], [x1, y1, at], [x0, y1, at]].map((v) => v.map((n) => n / 2)), color, 'T');

// Paint faces in order into cells at LV: Map key → {cell, c, f}. Each face fills
// the cells whose centers it holds; a later face covers an earlier one.
export function paint(faces) {
  const cells = new Map();
  for (const { poly, color, f } of faces) {
    if (f === 'l' || f === 'r') continue; // facing away
    // A corner between grid points (a half unit at an odd U, a quarter unit
    // at U 2) fills saw-toothed cells and makes cells off the lattice.
    if (!poly.flat().every(Number.isInteger)) throw new Error(`a face corner is off the grid: ${JSON.stringify(poly)}; use whole lattice steps`);
    const ps = poly.map((v) => v[0]), qs = poly.map((v) => v[1]);
    for (const cell of L.cellsInBox(LV, Math.min(...ps) - 1, Math.max(...ps), Math.min(...qs) - 1, Math.max(...qs))) {
      const { pp, qq } = L.centroidLattice(cell);
      if (inside(poly, pp, qq)) cells.set(L.cellKey(cell), { cell, c: f ? shade(color, f) : color, f: f || null });
    }
  }
  return cells;
}

// ---------- spinning ----------
// A model (faces) turned a quarter turn spin times about the up axis, (x, y) to
// (-y, x) each time (what faced down-right faces down-left, then up-left, then
// up-right), and drawn as it looks: each cell shows the nearest face
// over its center, and a face is shaded as the side it now faces, so the light
// stays where it is. Map key → {cell, c, f} at LV. Spin 0 is the stamp as drawn.
const DIR = { T: [0, 0, 1], L: [0, 1, 0], R: [1, 0, 0], l: [0, -1, 0], r: [-1, 0, 0] };
const SIDE = ([x, y, z]) => (z > 0 ? 'T' : y > 0 ? 'L' : x > 0 ? 'R' : null);
const turn = ([x, y, z], n) => { for (let i = 0; i < n; i++) [x, y] = [-y, x]; return [x, y, z]; };
export function render(faces, spin = 0) {
  const best = new Map();
  faces.forEach(({ pts, color, f }, order) => {
    const side = f && SIDE(turn(DIR[f], spin));
    if (!side) return; // facing away (or flat paint, which only stamps drawn upright use)
    const P = pts.map((v) => turn(v, spin)), poly = P.map(at);
    if (!poly.flat().every(Number.isInteger)) throw new Error(`a face corner is off the grid: ${JSON.stringify(poly)}; use whole lattice steps`);
    // The face's plane, n · X = d: depth (x + y + z, bigger is nearer) at the point over (pp, qq).
    const [a, b, c] = P, u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], w = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
    const n = [u[1] * w[2] - u[2] * w[1], u[2] * w[0] - u[0] * w[2], u[0] * w[1] - u[1] * w[0]], s = n[0] + n[1] + n[2];
    if (Math.abs(s) < 1e-12) return; // seen edge on
    const d = n[0] * a[0] + n[1] * a[1] + n[2] * a[2];
    const ps = poly.map((v) => v[0]), qs = poly.map((v) => v[1]);
    for (const cell of L.cellsInBox(LV, Math.min(...ps) - 1, Math.max(...ps), Math.min(...qs) - 1, Math.max(...qs))) {
      const { pp, qq } = L.centroidLattice(cell);
      if (!inside(poly, pp, qq)) continue;
      const t = (d - (n[0] * qq) / U + (n[2] * pp) / U) / s, depth = 3 * t + qq / U - pp / U;
      const key = L.cellKey(cell), was = best.get(key);
      // Nearer wins; on a tie (a patch on a box's side) the later face, as when painting.
      if (!was || depth > was.depth - 1e-9) best.set(key, { cell, c: shade(color, side), f: side, depth, order });
    }
  });
  return new Map([...best].map(([k, { cell, c, f }]) => [k, { cell, c, f }]));
}

// ---------- points ----------
const toLattice = (x, y) => { const qq = x / L.H; return [y - qq / 2, qq]; };
// Which hexagonal ring around a vertex (in lattice coords) a point is in: 1 for the
// six cells round it, and so on. For a cell's center it is the most any of the
// cell's corners is from that vertex, since every ring's edge is a lattice line.
const ring = (pp, qq) => Math.ceil(L.hexDist(pp, qq) - 1e-9);
const hexOf = (x, y) => ring(...toLattice(x, y));
// Within a third of an edge of a lattice line through vertex (ap, aq), of family
// k (0: q constant, 1: p constant, 2: p + q constant): a cell with an edge on it.
function onLine(x, y, [ap, aq], k) {
  const [pp, qq] = toLattice(x, y);
  return Math.abs(k === 0 ? qq - aq : k === 1 ? pp - ap : pp + qq - ap - aq) < 0.5;
}
const DIRS = [0, 1, 2, 3, 4, 5].map((k) => [Math.cos(Math.PI / 6 + (k * Math.PI) / 3), Math.sin(Math.PI / 6 + (k * Math.PI) / 3)]);
const ringOf = (d) => DIRS.map(([x, y]) => [x * d, y * d]);
// How many of the circles (centers, radius r) hold the point.
const cover = (x, y, centers, r) => centers.filter(([cx, cy]) => Math.hypot(x - cx, y - cy) < r).length;
// The Flower of Life's 19 centers: the middle, six around it at d, and twelve
// more: six at 2d along the same lines and six between them.
const flowerCenters = (d) => [[0, 0], ...ringOf(d), ...ringOf(2 * d),
  ...DIRS.map(([x, y], k) => [d * (x + DIRS[(k + 1) % 6][0]), d * (y + DIRS[(k + 1) % 6][1])])];
const triangle = (R, a0, cx = 0, cy = 0) => [0, 1, 2].map((k) => [cx + R * Math.cos(a0 + (k * 2 * Math.PI) / 3), cy + R * Math.sin(a0 + (k * 2 * Math.PI) / 3)]);
const inTri = (t, x, y) => inside(t, x, y); // the same test, with (x, y) for (p, q)
const angleOf = (x, y) => ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
const vertexAt = (p, q) => [q * L.H, p + q / 2]; // a vertex's point, from the origin

// A flat round face: eyes, a smile, and hair along the top if given.
const face2 = (skin, hair) => (x, y) => {
  const r = Math.hypot(x, y);
  if (r > 4.1) return null;
  if (hair && y < -2.4) return hair;
  if (Math.abs(Math.abs(x) - 1.3) < 0.5 && Math.abs(y + 0.9) < 0.6) return INK; // eyes
  if (r > 1.9 && r < 2.9 && y > 1 && Math.abs(x) < 2.3) return INK; // the smile
  return skin;
};
const STAR = triangle(2 * Math.sqrt(3), 0), STAR2 = triangle(2 * Math.sqrt(3), Math.PI); // side 6 edges
const SKY_STARS = [[0, 0, YELLOW], [-6, 4, ORANGE], [-3, -4, YELLOW], [-10, 2, YELLOW]].map(([p, q, c]) => {
  const [x, y] = vertexAt(p, q);
  return { a: triangle(Math.sqrt(3), 0, x, y), b: triangle(Math.sqrt(3), Math.PI, x, y), c };
});
const BOLT = [[0.5, -6.5], [3.2, -6.5], [1.6, -3.2], [3.6, -3.2], [-0.8, 1.6], [0.6, -1.4], [-1.3, -1.4]].map(([x, y]) => [1.7 * x, 1.7 * (y - 1.6)]);
const ARMS = [[3, 0], [-3, 0], [0, 3], [0, -3], [3, -3], [-3, 3]];
const SLICE_R = 9 / Math.sqrt(3), SLICE = triangle(SLICE_R, 0);
const PEPPERONI = [[-0.6 * SLICE_R, -0.35 * SLICE_R], [-0.6 * SLICE_R, 0.35 * SLICE_R], [0.25 * SLICE_R, 0]].map(([x, y]) => [x + 1, y]);
const MERKABA = [triangle(9 / Math.sqrt(3), 0), triangle(9 / Math.sqrt(3), Math.PI)];

// The flat pictures: id → [r, pick]. pick(x, y) is a color, [color, face] for a
// shaded facet, or null; r bounds the picture: lattice coords -r to r + 1 each way.
export const FLAT = {
  flower: [6, (x, y) => {
    const d = hexOf(x, y);
    if (d <= 1) return YELLOW;
    if (d > 3) return null;
    return Math.floor((Math.atan2(y, x) + Math.PI) / (Math.PI / 3)) % 2 ? PINK : '#ff8fb1';
  }],
  // Two lattice-aligned triangles (side 6 edges) pointing left and right: a six-point star.
  star: [6, (x, y) => {
    const a = inTri(STAR, x, y), b = inTri(STAR2, x, y);
    return a && b ? YELLOW : a || b ? ORANGE : null;
  }],
  sun: [6, (x, y) => {
    const d = hexOf(x, y);
    if (d <= 2) return YELLOW;
    if (d > 4) return null;
    // Rays: six spokes of the hexagon's corners, two cells wide.
    const a = angleOf(x, y) % 60;
    return a < 12 || a > 48 ? ORANGE : null;
  }],
  // Flat bands of the hexagon around the anchor, upper half only.
  rainbow: [9, (x, y) => (y > 0 ? null : [null, null, null, PURPLE, BLUE, GREEN, YELLOW, ORANGE, RED][hexOf(x, y)] || null)],
  smiley: [6, face2(YELLOW)],
  kid: [6, face2(SKIN, BROWN)],
  moon: [8, (x, y) => (Math.hypot(x, y) < 4.2 && Math.hypot(x - 2, y + 1) > 3.4 ? '#f2d16b' : null)],
  // Little six-point stars (two triangles of side 3 edges, so their points are vertices), scattered.
  stars: [12, (x, y) => SKY_STARS.find((st) => inTri(st.a, x, y) || inTri(st.b, x, y))?.c || null],
  // Six arms along the lattice's three line families through the anchor, each with a pair of branches.
  snowflake: [7, (x, y) => {
    if (hexOf(x, y) <= 4 && [0, 1, 2].some((k) => onLine(x, y, [0, 0], k))) return SKY;
    const [pp, qq] = toLattice(x, y);
    for (const A of ARMS) {
      const k0 = A[1] === 0 ? 0 : A[0] === 0 ? 1 : 2; // the arm's own family
      if (ring(pp - A[0], qq - A[1]) <= 1 && [0, 1, 2].some((k) => k !== k0 && onLine(x, y, A, k))) return SKY;
    }
    return null;
  }],
  // A slice, flat, pointing right: the lattice has no level lines, so its crust is
  // the straight up-and-down side. Side 9 edges, so the corners are vertices.
  pizza: [9, (x, y) => {
    if (!inTri(SLICE, x, y)) return null;
    if (x < -SLICE_R / 2 + Math.sqrt(3) / 2) return BROWN;
    return PEPPERONI.some(([dx, dy]) => Math.hypot(x - dx, y - dy) < 1.1) ? RED : YELLOW;
  }],
  // A flat bolt; its slants come out stair-stepped at 1×, smoother bigger.
  lightning: [16, (x, y) => (inside(BOLT, x, y) ? YELLOW : null)],
  // Seven circles; points covered an odd number of times light, even dark, so the petals show.
  seed: [12, (x, y) => { const n = cover(x, y, [[0, 0], ...ringOf(3.6)], 3.6); return n ? (n % 2 ? PALEGOLD : GOLD) : null; }],
  'flower-of-life': [14, (x, y) => {
    const r = Math.hypot(x, y);
    if (r > 9.8) return null;
    if (r > 9) return GOLD; // the ring around it
    const n = cover(x, y, flowerCenters(3), 3);
    return n ? (n % 2 ? PALEGOLD : INDIGO) : null;
  }],
  'fruit-of-life': [12, (x, y) => (cover(x, y, [[0, 0], ...ringOf(3.6), ...ringOf(7.2)], 1.5) ? (Math.hypot(x, y) < 1.5 ? VIOLET : GOLD) : null)],
  // A star tetrahedron: two triangles, faceted light and dark like a solid.
  merkaba: [9, (x, y) => {
    if (!inTri(MERKABA[0], x, y) && !inTri(MERKABA[1], x, y)) return null;
    return [GOLD, ['T', 'R', 'L'][Math.floor(((angleOf(x, y) + 30) % 360) / 60) % 3]]; // six wedges, each round a point
  }],
  mandala: [8, (x, y) => {
    const d = hexOf(x, y), a = angleOf(x, y) % 60;
    if (d <= 1) return GOLD;
    if (d === 2) return VIOLET;
    if (d === 3) return Math.abs(a - 30) < 16 ? ROSE : null;
    if (d === 4) return GOLD;
    if (d === 5) return a < 10 || a > 50 ? TEAL : null;
    if (d === 6) return Math.abs(a - 30) < 8 ? VIOLET : null;
    return null;
  }],
  // Pascal's triangle mod 2 on the lattice's own triangles: a cell is in when its row and column share no bit.
  sierpinski: [16, (x, y) => {
    const [pp, qq] = toLattice(x, y), p = Math.floor(pp), q = Math.floor(qq);
    return pp - p + qq - q < 1 && p >= 0 && q >= 0 && p + q < 16 && !(p & q) ? GOLD : null;
  }],
  // A cube inside a six-point star inside a hexagon: every line on the lattice.
  'star-cube': [8, (x, y) => {
    const d = hexOf(x, y);
    if (d > 6) return null;
    if (d === 6) return GOLD;
    if (d <= 3) { const t = angleOf(x, y); return t >= 210 && t < 330 ? [VIOLET, 'T'] : t >= 90 && t < 210 ? [VIOLET, 'L'] : [VIOLET, 'R']; }
    return inTri(MERKABA[0], x, y) || inTri(MERKABA[1], x, y) ? INDIGO : null;
  }],
};

// ---------- planes ----------
// Where a flat picture goes: its x (right) and y (down) as points on the screen,
// in edges, and the cube face it is shaded as. Upright faces you, as drawn; the
// floor runs its right down to the right and its top up to the right; the left
// wall stands along the down-right line, the right wall along the up-right one.
export const PLANES = {
  upright: { x: [1, 0], y: [0, 1], f: null },
  floor: { x: [L.H, 0.5], y: [-L.H, 0.5], f: 'T' },
  left: { x: [L.H, 0.5], y: [0, 1], f: 'L' },
  right: { x: [L.H, -0.5], y: [0, 1], f: 'R' },
};

// A flat picture laid on a plane at k times its size: Map key → {cell, c, f}, at LV,
// around the picture's origin. Each cell takes the picture's color at the point its
// center comes from, so curves are drawn anew at every size.
export function flatCells(id, plane = 'upright', k = 1) {
  const [r, pick] = FLAT[id], P = PLANES[plane];
  const det = P.x[0] * P.y[1] - P.x[1] * P.y[0], s = L.edgeLen(LV);
  // The picture's lattice box, -r to r + 1 each way, k times as big, on the plane: the cells to look at.
  const corners = [[-r, -r], [-r, r + 1], [r + 1, -r], [r + 1, r + 1]].map(([pp, qq]) => vertexAt(pp, qq))
    .map(([x, y]) => [k * (x * P.x[0] + y * P.y[0]), k * (x * P.x[1] + y * P.y[1])]).map(([x, y]) => toLattice(x, y));
  const ps = corners.map((c) => c[0]), qs = corners.map((c) => c[1]);
  const cells = new Map();
  for (const cell of L.cellsInBox(LV, Math.floor(Math.min(...ps)) - 1, Math.ceil(Math.max(...ps)), Math.floor(Math.min(...qs)) - 1, Math.ceil(Math.max(...qs)))) {
    const w = L.centroid(cell), wx = w.x / s / k, wy = w.y / s / k;
    // Back from the plane to the picture.
    const x = (wx * P.y[1] - wy * P.y[0]) / det, y = (P.x[0] * wy - P.x[1] * wx) / det;
    const [pp, qq] = toLattice(x, y);
    if (pp < -r || pp >= r + 1 || qq < -r || qq >= r + 1) continue;
    const got = pick(x, y);
    if (!got) continue;
    const [color, facet] = Array.isArray(got) ? got : [got, null];
    const f = P.f || facet; // on a plane the picture is shaded as the plane; upright, as drawn
    cells.set(L.cellKey(cell), { cell, c: f ? shade(color, f) : color, f });
  }
  return cells;
}

// ---------- letters and numbers ----------
// A 5×7 pixel font, each pixel a little block, in colors that go round the rainbow.
export const FONT = {
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
export const RAINBOW = [RED, ORANGE, YELLOW, GREEN, TEAL, BLUE, PURPLE, PINK];
export const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', DIGITS = '0123456789';
// The character a letter or number stamp's id names, and its color, or null.
export function glyphOf(id) {
  const m = /^(letter|number)-(.)$/.exec(id);
  if (!m) return null;
  const ch = m[2].toUpperCase(), i = (m[1] === 'letter' ? LETTERS : DIGITS).indexOf(ch);
  return i < 0 ? null : { ch, color: RAINBOW[i % RAINBOW.length] };
}
// A glyph's blocks on a plane: each pixel a half-unit block. On the left wall
// (as the starter art stands) the text runs down to the right; on the right wall,
// up to the right; on the floor, down to the right with its top up to the right.
export function glyphCells(ch, color, plane = 'left') {
  const rows = FONT[ch].split('|'), px = [];
  rows.forEach((row, r) => [...row].forEach((on, c) => { if (on === '#') px.push([c, rows.length - 1 - r]); }));
  const block = { left: ([c, z]) => [c, 0, z], right: ([c, z]) => [0, -c, z], floor: ([c, z]) => [c, -z, 0] }[plane];
  // Back to front: the farther a block (the smaller x + y + z), the earlier.
  const blocks = px.map(block).sort((a, b) => a[0] + a[1] + a[2] - (b[0] + b[1] + b[2]) || a[0] - b[0] || a[2] - b[2]);
  return paint(blocks.flatMap((o) => hbox(o, [1, 1, 1], color)));
}

// ---------- stamps ----------
// The anchor of cells (Map key → {cell}): the vertex nearest the middle of their
// bottom (across their centers, at the lowest center). In whole numbers, so the
// same shape moved anywhere gets the same anchor: centers are (3p + 1, 3q + 1) / 3
// for an up cell and (3p + 2, 3q + 2) / 3 for a down one; on screen x goes with q
// and y with p + q / 2. A tie goes to the vertex further left, then higher.
export function anchorOf(cells) {
  let qMin = Infinity, qMax = -Infinity, low = -Infinity;
  for (const { cell: { p, q, u } } of cells.values()) {
    const P = 3 * p + (u ? 1 : 2), Q = 3 * q + (u ? 1 : 2);
    qMin = Math.min(qMin, Q); qMax = Math.max(qMax, Q); low = Math.max(low, 2 * P + Q);
  }
  const Q2 = qMin + qMax; // twice the middle's 3q
  // 16 × the squared distance from vertex (p, q) to the point, in whole numbers.
  const d = (p, q) => 3 * (6 * q - Q2) ** 2 + (12 * p + 6 * q - 2 * low) ** 2;
  const q0 = Math.floor(Q2 / 6), p0 = Math.floor((low - Q2 / 2) / 6 - q0 / 2);
  let best = null;
  for (let p = p0 - 2; p <= p0 + 2; p++) for (let q = q0 - 1; q <= q0 + 2; q++) {
    const v = d(p, q);
    if (!best || v < best.v || (v === best.v && (q < best.q || (q === best.q && p < best.p)))) best = { v, p, q };
  }
  return { l: LV, p: best.p, q: best.q };
}
// Cells as a stamp around anchor a: [dl, dp, dq, u, color, face].
export const stampFrom = (cells, a) => ({ base: 0, cells: [...cells.values()].map(({ cell, c, f }) => [0, cell.p - a.p, cell.q - a.q, cell.u, c, f]), edges: [] });

// The planes a starter stamp can go on, its own first; none for the rest.
export function planesOf(id) {
  if (FLAT[id]) return ['upright', 'floor', 'left', 'right'];
  if (glyphOf(id)) return ['left', 'right', 'floor'];
  return [];
}
// The flat pictures drawn anew at each size: those with curves or slants, which
// come out rounder bigger. The rest are lattice lines (Star, Stars, Snowflake,
// Merkaba, Sierpinski, Star cube) and scale exactly instead, like the letters.
const DRAWN = new Set(['flower', 'sun', 'rainbow', 'smiley', 'kid', 'moon', 'pizza', 'lightning', 'seed', 'flower-of-life', 'fruit-of-life', 'mandala']);
export const drawnAtSize = (id) => DRAWN.has(id);
// A starter stamp on a plane at k times its size, around its anchor: k times its
// 1× anchor on that plane, so it grows about its foot. Null for one this module
// does not draw.
export function variant(id, plane, k = 1) {
  if (DRAWN.has(id)) {
    const a = anchorOf(flatCells(id, plane, 1));
    return stampFrom(flatCells(id, plane, k), { p: k * a.p, q: k * a.q });
  }
  const g = glyphOf(id), cells = FLAT[id] ? flatCells(id, plane, 1) : g ? glyphCells(g.ch, g.color, plane) : null;
  return cells && scaleStamp(stampFrom(cells, anchorOf(cells)), k);
}
