// The starter stamps built of boxes, as 3D models: id → () => faces, each face
// with its 3D corners and the side it faces (web/engine/stampart.js box, face).
// tools/make_stamps.mjs paints each as drawn into web/stamps.js; the app draws
// them spun (stampart.js render) for the stamp bar's Spin (owner, 2026-10-19,
// docs/spec-stamp-size-turn.md step 3). Sizes are in cube units: x runs down to
// the right, y down to the left, z up; half units through hbox. Pure, no DOM.
import { COLORS, anchorOf, atSize, box, face, hbox, onGrid, patch, paint, render, scaled, stampFrom } from './stampart.js';
import { MODELS as ANIMALS } from './models/animals.js';
import { MODELS as VEHICLES } from './models/vehicles.js';
import { MODELS as BUILDINGS } from './models/buildings.js';
import { MODELS as NATURE } from './models/nature.js';

const { BLUE, YELLOW, RED, GREEN, BROWN, STONE, SAND, INK } = COLORS;


// A stamp's parts as data, from the stamp art contract (docs/stamp-art-contract.md):
// what an artist or another model hands in, never code. All in half units, whole
// numbers; x runs down to the right on screen, y down to the left, z up.
//   {box: [x, y, z], size: [sx, sy, sz], color}            a block
//   {decal: '+x' | '-x' | '+y' | '-y' | 'top', at, from: [a, b], to: [a, b], color}
//       a flat color on one side: '+x' / '-x' on the plane x = at, from (y, z) to (y, z);
//       '+y' / '-y' on y = at, from (x, z) to (x, z); 'top' on z = at, from (x, y) to (x, y)
//   {slope: [[x, y, z], …3 or 4 corners], faces: '+x' | '-x' | '+y' | '-y' | 'up', color}
//       a slanted face (a roof), shaded as the side it faces
// Any part may add "minSize": 2 (detail, shown from twice the size up; it may use
// halves, .5, of a half unit) or 1 (hidden below the stamp's own size), or
// "maxSize": 1 (a plainer stand-in, shown only below it).
// tools/stamp_check.mjs checks a file of them before it comes in (shape, grid, order).
const SIDE_TAG = { '+x': 'R', '-x': 'r', '+y': 'L', '-y': 'l', top: 'T', up: 'T' };
export function fromParts(parts) {
  return parts.flatMap((p) => {
    const faces = partFaces(p);
    if (p.minSize === undefined && p.maxSize === undefined) return faces;
    return faces.map((f) => ({ ...f, lod: { ...(p.minSize !== undefined && { min: p.minSize }), ...(p.maxSize !== undefined && { max: p.maxSize }) } }));
  });
}
function partFaces(p) {
  return (() => {
    if (p.box) return hbox(p.box, p.size, p.color);
    if (p.decal) {
      const [a0, b0] = p.from, [a1, b1] = p.to, t = p.at, side = p.decal;
      const pts = side === 'top' ? [[a0, b0, t], [a1, b0, t], [a1, b1, t], [a0, b1, t]]
        : side === '+x' || side === '-x' ? [[t, a0, b0], [t, a1, b0], [t, a1, b1], [t, a0, b1]]
          : [[a0, t, b0], [a1, t, b0], [a1, t, b1], [a0, t, b1]];
      return [face(pts.map((v) => v.map((n) => n / 2)), p.color, SIDE_TAG[side])];
    }
    if (p.slope) return [face(p.slope.map((v) => v.map((n) => n / 2)), p.color, SIDE_TAG[p.faces])];
    return [];
  })();
}

// Stamps handed in under the stamp art contract (docs/stamp-art-contract.md), each its
// checked JSON parts (tools/stamp_check.mjs), pasted in as they came: id → parts.
export const PARTS = {
};

export const MODELS = {
  ...ANIMALS, ...VEHICLES, ...BUILDINGS, ...NATURE, // web/engine/models/: the redrawn box stamps
  cube: () => box([0, 0, 0], [1, 1, 1], BLUE),
  pyramid: () => [
    // Its peak half the base's width up, so every edge runs along a lattice line and comes out straight.
    face([[0, 2, 0], [2, 2, 0], [1, 1, 1]], SAND, 'L'),
    face([[2, 0, 0], [2, 2, 0], [1, 1, 1]], SAND, 'R'),
    face([[0, 0, 0], [2, 0, 0], [1, 1, 1]], SAND, 'l'), // the back, seen when spun
    face([[0, 0, 0], [0, 2, 0], [1, 1, 1]], SAND, 'r'),
  ],
  // Buildings (House and Wall above).
  // A square castle (owner, 2026-10-19: "boxier and have more features on the back.
  // maybe even a drawbridge"): four walls with battlements, a red-capped tower at each
  // corner, a keep flying a flag; at the front a gateway and its drawbridge, down over
  // a moat; at the back a door, a banner, a hay bale and a bush; ivy up the left side.
  // Back to front, so it paints the same as it draws by depth (test/stampmodels.test.mjs).
  castle: () => [
    ...hbox([1, -2, 0], [2, 2, 1], SAND), ...hbox([6, -2, 0], [2, 2, 2], GREEN), // behind: hay and a bush, clear of the door
    ...hbox([2, 0, 0], [4, 1, 5], STONE), ...hbox([0, 2, 0], [1, 4, 5], STONE), // the back and left walls, between the towers
    ...[2, 4].flatMap((a) => [...hbox([a, 0, 5], [1, 1, 1], STONE), ...hbox([0, a, 5], [1, 1, 1], STONE)]), // their battlements
    ...hbox([0, 0, 0], [2, 2, 7], STONE), ...hbox([0, 0, 7], [2, 2, 1], RED), // the back-left tower
    ...hbox([2, 2, 0], [4, 4, 9], STONE), // the keep
    ...[[2, 2], [5, 2], [2, 5], [5, 5]].flatMap(([x, y]) => hbox([x, y, 9], [1, 1, 1], STONE)),
    ...hbox([3, 3, 9], [1, 1, 4], BROWN), ...hbox([4, 3, 11], [2, 1, 2], RED), // its flag
    ...hbox([6, 0, 0], [2, 2, 7], STONE), ...hbox([6, 0, 7], [2, 2, 1], RED), // the back-right tower
    ...hbox([0, 6, 0], [2, 2, 7], STONE), ...hbox([0, 6, 7], [2, 2, 1], RED), // the front-left tower
    ...hbox([7, 2, 0], [1, 4, 5], STONE), ...hbox([2, 7, 0], [4, 1, 5], STONE), // the right and front walls
    ...[2, 4].flatMap((a) => [...hbox([7, a, 5], [1, 1, 1], STONE), ...hbox([a, 7, 5], [1, 1, 1], STONE)]),
    patch('L', 8, [3, 5], [1, 4], INK), patch('L', 8, [1, 2], [4, 5], INK), // the open gateway, an arrow slit
    ...hbox([6, 6, 0], [2, 2, 7], STONE), ...hbox([6, 6, 7], [2, 2, 1], RED), // the front-right tower
    patch('L', 8, [6, 7], [4, 5], INK),
    ...hbox([0, 8, 0], [8, 3, 1], BLUE), ...hbox([3, 8, 1], [2, 3, 1], BROWN), // the moat, and the drawbridge down over it
    patch('R', 8, [3, 4], [2, 3], INK), patch('R', 6, [2, 3], [5, 8], RED), // a slit on the right, a banner on the keep
    patch('l', 0, [3, 5], [0, 2], BROWN), patch('l', 2, [3, 4], [5, 8], YELLOW), // behind: a door, a banner
    patch('l', 0, [1, 2], [4, 5], INK), patch('l', 0, [6, 7], [4, 5], INK),
    patch('r', 0, [2, 3], [0, 4], GREEN), patch('r', 0, [3, 4], [1, 3], GREEN), patch('r', 0, [5, 6], [0, 2], GREEN), // ivy
  ],
  // Stamps handed in under the art contract, as data (PARTS below); one of the same
  // id as a model above is new art for it.
  ...Object.fromEntries(Object.entries(PARTS).map(([id, parts]) => [id, () => fromParts(parts)])),
};

// The views a box stamp has for Spin: as drawn (0), then a quarter turn at a
// time (1 to 3); none for the rest.
export const spins = (id) => (MODELS[id] ? [0, 1, 2, 3] : []);
// A box stamp spun n quarter turns, around its foot. View 0 is painted as
// drawn, so it is web/stamps.js's art exactly; the others are drawn by depth
// (stampart.js render). Box art paints the same as it draws by depth
// (test/stampmodels.test.mjs), so all four views match.
export function spun(id, n) {
  const cells = draw(atSize(MODELS[id](), 1), n);
  return stampFrom(cells, anchorOf(cells));
}
const draw = (faces, n) => (n ? render(faces, n) : paint(faces));
// Whether a model has parts for some sizes only (stampart.js fromSize, belowSize).
export const tiered = (id) => !!MODELS[id] && MODELS[id]().some((f) => f.lod);
// A box stamp spun n quarter turns at a size step {s, k, j} (engine/density.js
// sizeSteps): the parts for size s, drawn k times as big at j levels finer, or
// finer still (up to jmax levels) when its detail needs it, so every corner lands
// on the grid; failing that, the stamp as drawn, scaled. Around its foot: k times
// its foot as drawn, so it grows in place. {stamp, j}: the levels finer it is.
export const spunAtSize = (id, n, step, jmax = 2) => drawAtSize(MODELS[id], n, step, jmax);
// The same for any model (a function giving its faces).
export function drawAtSize(model, n, { s, k, j }, jmax = 2) {
  const faces = atSize(model(), s), a = anchorOf(draw(atSize(model(), 1), n));
  for (let jj = j; jj <= jmax; jj++) {
    const kk = k * 2 ** (jj - j), big = scaled(faces, kk);
    if (onGrid(big)) return { stamp: stampFrom(draw(big, n), { p: kk * a.p, q: kk * a.q }), j: jj };
  }
  const plain = scaled(atSize(model(), Math.min(s, 1.5)), k); // no fine detail: whole half units
  return { stamp: stampFrom(draw(plain, n), { p: k * a.p, q: k * a.q }), j };
}
