// The starter stamps built of boxes, as 3D models: id → () => faces, each face
// with its 3D corners and the side it faces (web/engine/stampart.js box, face).
// tools/make_stamps.mjs paints each as drawn into web/stamps.js; the app draws
// them spun (stampart.js render) for the stamp bar's Spin (owner, 2026-10-19,
// docs/spec-stamp-size-turn.md step 3). Sizes are in cube units: x runs down to
// the right, y down to the left, z up; half units through hbox. Pure, no DOM.
import { COLORS, anchorOf, box, face, hbox, paint, render, stampFrom } from './stampart.js';

const { BLUE, TEAL, YELLOW, RED, GREEN, BROWN, STONE, SAND, PINK, SKY, ORANGE, INK, WHITE, TAN, FOX, LIME, HOG, DOG, MUZZLE, SKIN, RAIN, PLANET, PINE, CLOUD, NAVY, CREAM, FROSTING } = COLORS;

// A patch on a box's side: on the L side (the plane y = at) from x0 to x1, or
// the R side (x = at) from y0 to y1; z0 to z1 up. Half units. l and r are the
// same planes seen from behind (the back of a box), shown only when spun.
const patch = (side, at, [a0, a1], [z0, z1], color) => face(
  (side === 'L' || side === 'l' ? [[a0, at, z0], [a1, at, z0], [a1, at, z1], [a0, at, z1]] : [[at, a0, z0], [at, a1, z0], [at, a1, z1], [at, a0, z1]]).map((v) => v.map((n) => n / 2)),
  color, side);

// A stamp's parts as data, from the stamp art contract (docs/stamp-art-contract.md):
// what an artist or another model hands in, never code. All in half units, whole
// numbers; x runs down to the right on screen, y down to the left, z up.
//   {box: [x, y, z], size: [sx, sy, sz], color}            a block
//   {decal: '+x' | '-x' | '+y' | '-y' | 'top', at, from: [a, b], to: [a, b], color}
//       a flat color on one side: '+x' / '-x' on the plane x = at, from (y, z) to (y, z);
//       '+y' / '-y' on y = at, from (x, z) to (x, z); 'top' on z = at, from (x, y) to (x, y)
//   {slope: [[x, y, z], …3 or 4 corners], faces: '+x' | '-x' | '+y' | '-y' | 'up', color}
//       a slanted face (a roof), shaded as the side it faces
// tools/stamp_check.mjs checks a file of them before it comes in (shape, grid, order).
const SIDE_TAG = { '+x': 'R', '-x': 'r', '+y': 'L', '-y': 'l', top: 'T', up: 'T' };
export function fromParts(parts) {
  return parts.flatMap((p) => {
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
  });
}

// Stamps handed in under the stamp art contract (docs/stamp-art-contract.md), each its
// checked JSON parts (tools/stamp_check.mjs), pasted in as they came: id → parts.
export const PARTS = {
};

export const MODELS = {
  cube: () => box([0, 0, 0], [1, 1, 1], BLUE),
  stairs: () => [...box([0, 0, 0], [3, 1, 1], TEAL), ...box([0, 0, 1], [2, 1, 1], TEAL), ...box([0, 0, 2], [1, 1, 1], TEAL)],
  house: () => [
    ...box([0, 0, 0], [2, 2, 1.5], YELLOW),
    // A roof sloping on all four sides at the Pyramid's slope, so its edges come out straight.
    face([[0, 2, 1.5], [2, 2, 1.5], [1, 1, 2.5]], RED, 'L'),
    face([[2, 0, 1.5], [2, 2, 1.5], [1, 1, 2.5]], RED, 'R'),
    face([[0, 0, 1.5], [2, 0, 1.5], [1, 1, 2.5]], RED, 'l'), // the back, seen when spun
    face([[0, 0, 1.5], [0, 2, 1.5], [1, 1, 2.5]], RED, 'r'),
    face([[0.5, 2, 0], [1, 2, 0], [1, 2, 1], [0.5, 2, 1]], BROWN, 'L'),
    face([[2, 0.5, 0.5], [2, 1, 0.5], [2, 1, 1], [2, 0.5, 1]], SKY, 'R'),
  ],
  tree: () => [...box([0.5, 0.5, 0], [0.5, 0.5, 1], BROWN), ...box([0, 0, 1], [1.5, 1.5, 1.5], GREEN), ...box([0.5, 0.5, 2.5], [0.5, 0.5, 0.5], GREEN)],
  wall: () => [...box([0, 0, 0], [3, 0.5, 1.5], STONE), ...[0, 1, 2].flatMap((x) => box([x, 0, 1.5], [0.5, 0.5, 0.5], STONE)), ...box([2.5, 0, 1.5], [0.5, 0.5, 0.5], STONE)],
  pyramid: () => [
    // Its peak half the base's width up, so every edge runs along a lattice line and comes out straight.
    face([[0, 2, 0], [2, 2, 0], [1, 1, 1]], SAND, 'L'),
    face([[2, 0, 0], [2, 2, 0], [1, 1, 1]], SAND, 'R'),
    face([[0, 0, 0], [2, 0, 0], [1, 1, 1]], SAND, 'l'), // the back, seen when spun
    face([[0, 0, 0], [0, 2, 0], [1, 1, 1]], SAND, 'r'),
  ],
  // Animals, side on, facing right (+x), their profile on the lit L side.
  cat: () => [
    ...hbox([0, 1, 2], [1, 1, 4], ORANGE), // tail, up from the rump
    ...hbox([1, 0, 0], [1, 1, 1], ORANGE), ...hbox([6, 0, 0], [1, 1, 1], ORANGE),
    ...hbox([1, 1, 0], [1, 1, 1], ORANGE), ...hbox([6, 1, 0], [1, 1, 1], ORANGE),
    ...hbox([1, 0, 1], [6, 2, 2], ORANGE),
    ...hbox([6, 0, 2], [3, 3, 3], ORANGE),
    ...hbox([6, 0, 5], [1, 1, 1], ORANGE), ...hbox([6, 2, 5], [1, 1, 1], ORANGE),
    patch('L', 3, [7, 8], [3, 4], INK),
  ],
  bunny: () => [
    ...hbox([0, 0, 0], [4, 3, 3], TAN),
    ...hbox([-1, 2, 1], [1, 1, 1], WHITE), // a puff of a tail
    ...hbox([1, 2, 0], [1, 1, 1], WHITE), ...hbox([3, 2, 0], [1, 1, 1], WHITE), // paws
    ...hbox([3, 0, 2], [3, 3, 3], TAN),
    ...hbox([3, 0, 5], [1, 1, 3], TAN), ...hbox([3, 2, 5], [1, 1, 3], TAN),
    patch('L', 3, [3, 4], [5, 8], PINK),
    patch('L', 3, [4, 5], [3, 4], INK),
    patch('R', 6, [1, 2], [3, 4], PINK),
  ],
  duck: () => [
    ...hbox([0, 1, 2], [1, 1, 1], YELLOW), // tail
    ...hbox([0, 0, 0], [5, 3, 2], YELLOW),
    patch('L', 3, [1, 3], [1, 2], '#e0a800'), // wing
    ...hbox([3, 1, 2], [2, 2, 3], YELLOW),
    ...hbox([5, 1, 3], [1, 2, 1], ORANGE),
    patch('L', 3, [3, 4], [3, 4], INK),
  ],
  fox: () => [
    ...hbox([-3, 0, 2], [1, 2, 2], WHITE), ...hbox([-2, 0, 2], [3, 2, 2], FOX), // a bushy tail, white at the tip
    ...hbox([1, 0, 0], [1, 1, 1], INK), ...hbox([6, 0, 0], [1, 1, 1], INK),
    ...hbox([1, 1, 0], [1, 1, 1], INK), ...hbox([6, 1, 0], [1, 1, 1], INK),
    ...hbox([1, 0, 1], [6, 2, 2], FOX),
    ...hbox([6, 0, 2], [3, 3, 3], FOX),
    ...hbox([9, 1, 2], [1, 1, 1], WHITE), patch('R', 10, [1, 2], [2, 3], INK), // the snout and its nose
    ...hbox([6, 0, 5], [1, 1, 2], FOX), ...hbox([6, 2, 5], [1, 1, 2], FOX),
    patch('L', 3, [8, 9], [2, 3], WHITE),
    patch('L', 3, [7, 8], [3, 4], INK),
  ],
  snake: () => [
    ...hbox([-2, 0, 0], [2, 1, 1], LIME), // the tail, thinner
    ...hbox([0, 0, 0], [2, 2, 2], GREEN), ...hbox([2, 0, 0], [2, 2, 2], LIME), ...hbox([4, 0, 0], [2, 2, 2], GREEN),
    ...hbox([4, 2, 0], [2, 2, 2], LIME), ...hbox([4, 4, 0], [2, 2, 2], GREEN),
    ...hbox([6, 4, 0], [2, 2, 2], LIME), ...hbox([8, 4, 0], [2, 2, 2], GREEN),
    ...hbox([10, 3, 0], [3, 3, 3], GREEN),
    patch('L', 6, [11, 12], [1, 2], INK),
    patch('R', 13, [4, 5], [0, 1], RED), // the tongue
  ],
  frog: () => [
    ...hbox([0, 0, 0], [5, 4, 2], GREEN),
    ...hbox([0, 4, 0], [2, 1, 1], LIME), ...hbox([4, 4, 0], [1, 1, 1], LIME), // a back leg and a front foot
    ...hbox([3, 0, 2], [1, 1, 1], WHITE), ...hbox([3, 3, 2], [1, 1, 1], WHITE),
    patch('R', 4, [0, 1], [2, 3], INK), patch('R', 4, [3, 4], [2, 3], INK),
    patch('R', 5, [0, 4], [1, 2], '#a83232'), // a wide smile
  ],
  pig: () => [
    ...hbox([0, 1, 3], [1, 1, 1], HOG), // a curl of a tail
    ...hbox([1, 0, 0], [1, 1, 1], HOG), ...hbox([6, 0, 0], [1, 1, 1], HOG),
    ...hbox([1, 2, 0], [1, 1, 1], HOG), ...hbox([6, 2, 0], [1, 1, 1], HOG),
    ...hbox([1, 0, 1], [6, 3, 3], HOG),
    ...hbox([7, 0, 2], [2, 3, 3], HOG),
    ...hbox([9, 1, 2], [1, 1, 1], PINK),
    ...hbox([7, 0, 5], [1, 1, 1], PINK), ...hbox([7, 2, 5], [1, 1, 1], PINK),
    patch('L', 3, [8, 9], [3, 4], INK),
  ],
  dog: () => [
    ...hbox([0, 0, 3], [1, 1, 2], DOG), // a wagging tail
    ...hbox([1, 0, 0], [1, 1, 1], DOG), ...hbox([6, 0, 0], [1, 1, 1], DOG),
    ...hbox([1, 1, 0], [1, 1, 1], DOG), ...hbox([6, 1, 0], [1, 1, 1], DOG),
    ...hbox([1, 0, 1], [6, 2, 2], DOG),
    ...hbox([6, 0, 2], [3, 3, 3], DOG),
    ...hbox([9, 1, 2], [1, 1, 2], MUZZLE), patch('R', 10, [1, 2], [3, 4], INK), // the snout and its nose
    ...hbox([6, 3, 2], [1, 1, 3], BROWN), // a floppy ear
    patch('L', 3, [7, 8], [3, 4], INK),
  ],
  fish: () => [
    ...hbox([-1, 0, 0], [1, 2, 2], ORANGE), ...hbox([-1, 0, 3], [1, 2, 2], ORANGE), ...hbox([0, 0, 1], [1, 2, 3], ORANGE), // the tail
    ...hbox([2, 0, 0], [4, 2, 1], ORANGE),
    ...hbox([1, 0, 1], [6, 2, 3], ORANGE),
    ...hbox([2, 0, 4], [4, 2, 1], ORANGE),
    patch('L', 2, [2, 3], [0, 5], WHITE), patch('L', 2, [4, 5], [0, 5], WHITE), // stripes
    patch('L', 2, [5, 6], [2, 3], INK),
  ],
  bird: () => [
    ...hbox([-2, 1, 3], [2, 1, 1], BLUE), // the tail
    ...hbox([1, 1, 0], [1, 1, 1], INK), ...hbox([3, 1, 0], [1, 1, 1], INK), // legs
    ...hbox([0, 0, 1], [3, 3, 3], BLUE), ...hbox([3, 0, 1], [1, 3, 2], ORANGE), // the breast
    ...hbox([3, 0, 3], [3, 3, 3], BLUE),
    ...hbox([6, 1, 4], [1, 1, 1], YELLOW),
    patch('L', 3, [0, 2], [2, 3], '#1f5fbf'), // a wing
    patch('L', 3, [4, 5], [4, 5], INK),
  ],
  cloud: () => [
    ...hbox([0, 0, 0], [8, 4, 2], CLOUD), ...hbox([1, 0, 2], [3, 4, 2], CLOUD), ...hbox([4, 0, 2], [3, 4, 3], CLOUD),
  ],
  rock: () => [
    ...hbox([0, 0, 0], [5, 4, 2], STONE), ...hbox([1, 0, 2], [3, 3, 1], STONE), ...hbox([4, 1, 0], [2, 3, 1], STONE),
  ],
  mushroom: () => [
    ...hbox([2, 2, 0], [2, 2, 3], CREAM),
    ...hbox([0, 0, 3], [6, 6, 2], RED), ...hbox([1, 1, 5], [4, 4, 1], RED),
    patch('L', 6, [1, 2], [3, 4], WHITE), patch('L', 6, [4, 5], [4, 5], WHITE), patch('R', 6, [2, 3], [4, 5], WHITE),
  ],
  pine: () => [
    // A trunk tall enough to show under the branches, so it is not taken for a stepped cake.
    ...hbox([2, 2, 0], [1, 1, 3], BROWN),
    ...hbox([0, 0, 3], [5, 5, 2], PINE), ...hbox([1, 1, 5], [3, 3, 2], PINE), ...hbox([2, 2, 7], [1, 1, 2], PINE),
  ],
  bush: () => [
    ...hbox([0, 0, 0], [6, 4, 2], GREEN), ...hbox([1, 0, 2], [4, 4, 1], GREEN),
    patch('L', 4, [1, 2], [1, 2], RED), patch('L', 4, [4, 5], [0, 1], RED), patch('R', 6, [1, 2], [1, 2], RED), // berries
  ],
  // Vehicles, side on, facing right, like the animals.
  car: () => [
    ...hbox([1, 0, 0], [2, 1, 1], INK), ...hbox([5, 0, 0], [2, 1, 1], INK),
    ...hbox([0, 0, 1], [8, 4, 2], RED), ...hbox([2, 0, 3], [4, 4, 2], RED),
    ...hbox([1, 3, 0], [2, 1, 1], INK), ...hbox([5, 3, 0], [2, 1, 1], INK),
    patch('L', 4, [2, 3], [3, 4], SKY), patch('L', 4, [4, 5], [3, 4], SKY), patch('R', 6, [1, 3], [3, 4], SKY),
    patch('R', 8, [0, 1], [2, 3], YELLOW), patch('R', 8, [3, 4], [2, 3], YELLOW),
  ],
  truck: () => [
    ...hbox([1, 0, 0], [2, 1, 1], INK), ...hbox([7, 0, 0], [2, 1, 1], INK),
    ...hbox([0, 0, 1], [6, 4, 4], ORANGE), ...hbox([6, 0, 1], [3, 4, 3], BLUE),
    ...hbox([1, 3, 0], [2, 1, 1], INK), ...hbox([7, 3, 0], [2, 1, 1], INK),
    patch('L', 4, [7, 8], [3, 4], SKY), patch('R', 9, [1, 3], [3, 4], SKY),
  ],
  train: () => [
    ...hbox([1, 0, 0], [1, 1, 1], INK), ...hbox([4, 0, 0], [1, 1, 1], INK), ...hbox([6, 0, 0], [1, 1, 1], INK),
    ...hbox([0, 0, 1], [3, 3, 5], RED), ...hbox([0, 0, 6], [3, 3, 1], INK), // the cab and its roof
    ...hbox([3, 0, 1], [5, 3, 3], NAVY),
    ...hbox([6, 1, 4], [1, 1, 2], INK), // the chimney
    ...hbox([1, 2, 0], [1, 1, 1], INK), ...hbox([4, 2, 0], [1, 1, 1], INK), ...hbox([6, 2, 0], [1, 1, 1], INK),
    patch('L', 3, [1, 2], [3, 5], YELLOW), patch('R', 8, [1, 2], [2, 3], YELLOW),
  ],
  boat: () => [
    ...hbox([0, 0, 0], [8, 3, 2], BROWN), patch('L', 3, [0, 8], [1, 2], RED),
    ...hbox([3, 1, 2], [1, 1, 6], BROWN),
    ...hbox([4, -1, 3], [1, 5, 4], WHITE), patch('R', 5, [-1, 4], [4, 5], RED), // a square sail across the boat
  ],
  rocket: () => [
    ...hbox([1, 1, 0], [1, 1, 2], ORANGE), // the flame
    ...hbox([1, -1, 2], [1, 1, 2], RED), ...hbox([-1, 1, 2], [1, 1, 2], RED),
    ...hbox([0, 0, 2], [3, 3, 6], WHITE),
    ...hbox([3, 1, 2], [1, 1, 2], RED), ...hbox([1, 3, 2], [1, 1, 2], RED),
    ...hbox([0, 0, 8], [3, 3, 1], RED), ...hbox([1, 1, 9], [1, 1, 1], RED),
    patch('L', 3, [1, 2], [5, 6], SKY),
  ],
  plane: () => [
    ...hbox([3, -3, 3], [2, 4, 1], BLUE), ...hbox([0, -1, 3], [1, 2, 1], BLUE),
    ...hbox([0, 1, 2], [8, 2, 2], WHITE), ...hbox([8, 1, 2], [1, 2, 1], WHITE),
    ...hbox([0, 1, 4], [1, 1, 2], RED), // the tail fin
    ...hbox([3, 3, 3], [2, 4, 1], BLUE), ...hbox([0, 3, 3], [1, 2, 1], BLUE),
    patch('L', 3, [2, 3], [3, 4], SKY), patch('L', 3, [5, 6], [3, 4], SKY), patch('L', 3, [7, 8], [3, 4], SKY),
  ],
  // Food.
  apple: () => [
    ...hbox([1, 1, 0], [3, 3, 1], RED), ...hbox([0, 0, 1], [5, 5, 4], RED), ...hbox([1, 1, 5], [3, 3, 1], RED),
    ...hbox([2, 2, 6], [1, 1, 1], BROWN), ...hbox([2, 3, 6], [1, 1, 1], GREEN),
  ],
  // Three tiers and a cherry (the one-block Cake went, owner 2026-10-19).
  cake: () => [
    ...hbox([0, 0, 0], [7, 7, 2], FROSTING), ...hbox([1, 1, 2], [5, 5, 2], CREAM), ...hbox([2, 2, 4], [3, 3, 2], FROSTING),
    ...hbox([3, 3, 6], [1, 1, 1], RED), // a cherry
  ],
  icecream: () => [
    ...hbox([1, 1, 0], [1, 1, 2], SAND), ...hbox([0, 0, 2], [3, 3, 2], SAND),
    ...hbox([0, 0, 4], [3, 3, 1], PINK), ...hbox([-1, -1, 5], [5, 5, 3], PINK), ...hbox([0, 0, 8], [3, 3, 1], PINK),
    ...hbox([1, 1, 9], [1, 1, 1], RED),
  ],
  cupcake: () => [
    ...hbox([0, 0, 0], [5, 5, 2], TEAL), ...hbox([0, 0, 2], [5, 5, 1], FROSTING), ...hbox([1, 1, 3], [3, 3, 1], FROSTING),
    ...hbox([2, 2, 4], [1, 1, 1], RED),
    patch('L', 5, [1, 2], [2, 3], YELLOW), patch('L', 5, [3, 4], [2, 3], SKY), patch('R', 5, [2, 3], [2, 3], YELLOW), // sprinkles
  ],
  carrot: () => [
    ...hbox([1, 1, 0], [1, 1, 2], ORANGE), ...hbox([0, 0, 2], [3, 3, 4], ORANGE),
    ...hbox([1, 1, 6], [1, 1, 2], GREEN), ...hbox([0, 1, 7], [1, 1, 1], GREEN), ...hbox([2, 1, 7], [1, 1, 1], GREEN),
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
  tower: () => [
    ...hbox([0, 0, 0], [3, 3, 9], STONE), ...hbox([0, 0, 9], [3, 3, 1], RED), ...hbox([1, 1, 10], [1, 1, 2], RED),
    patch('L', 3, [1, 2], [0, 2], BROWN), patch('L', 3, [1, 2], [6, 7], INK), patch('R', 3, [1, 2], [6, 7], INK),
  ],
  bridge: () => [
    ...hbox([0, 0, 0], [2, 3, 3], STONE), ...hbox([8, 0, 0], [2, 3, 3], STONE),
    ...hbox([0, 0, 3], [10, 3, 1], BROWN),
    ...[0, 3, 6, 9].flatMap((x) => hbox([x, 2, 4], [1, 1, 1], BROWN)), // railing posts
  ],
  person: () => [
    ...hbox([0, 0, 0], [1, 2, 3], NAVY), ...hbox([2, 0, 0], [1, 2, 3], NAVY),
    ...hbox([-1, 0, 3], [1, 2, 4], SKIN), ...hbox([0, 0, 3], [3, 2, 4], RED), ...hbox([3, 0, 3], [1, 2, 4], SKIN),
    ...hbox([0, 0, 7], [3, 2, 3], SKIN), ...hbox([0, 0, 10], [3, 2, 1], BROWN),
    patch('L', 2, [0, 1], [8, 9], INK), patch('L', 2, [2, 3], [8, 9], INK),
  ],
  // Space (the Rocket is in Vehicles).
  planet: () => [
    ...hbox([-1, -1, 3], [7, 1, 1], SAND), ...hbox([-1, 0, 3], [1, 5, 1], SAND), // the ring behind
    ...hbox([1, 1, 0], [3, 3, 1], PLANET), ...hbox([0, 0, 1], [5, 5, 5], PLANET), ...hbox([1, 1, 6], [3, 3, 1], PLANET),
    ...hbox([-1, 5, 3], [7, 1, 1], SAND), ...hbox([5, 0, 3], [1, 5, 1], SAND), // and in front
  ],
  ufo: () => [
    ...hbox([1, 1, 0], [5, 5, 1], STONE), ...hbox([0, 0, 1], [7, 7, 1], STONE), ...hbox([2, 2, 2], [3, 3, 2], SKY),
    patch('L', 7, [1, 2], [1, 2], YELLOW), patch('L', 7, [3, 4], [1, 2], YELLOW), patch('L', 7, [5, 6], [1, 2], YELLOW),
    patch('R', 7, [1, 2], [1, 2], YELLOW), patch('R', 7, [3, 4], [1, 2], YELLOW), patch('R', 7, [5, 6], [1, 2], YELLOW),
  ],
  // Weather (Sun, Cloud and Rainbow above).
  raincloud: () => [
    ...[[1, 1], [4, 2], [2, 3], [5, 0]].flatMap(([x, y]) => [...hbox([x, y, -3], [1, 1, 1], BLUE), ...hbox([x + 1, y, -6], [1, 1, 1], BLUE)]),
    ...hbox([0, 0, 0], [7, 4, 2], RAIN), ...hbox([1, 0, 2], [3, 4, 2], RAIN), ...hbox([4, 1, 2], [2, 3, 1], RAIN),
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
// (stampart.js render), where a few features the art draws on top (the
// Train's wheels, the Bunny's paws) tuck under their bodies as they would.
export function spun(id, n) {
  const cells = n ? render(MODELS[id](), n) : paint(MODELS[id]());
  return stampFrom(cells, anchorOf(cells));
}
