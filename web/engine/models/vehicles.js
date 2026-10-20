// The vehicles and space things, facing right (+x): box stamps as 3D models (web/engine/stampmodels.js has the rest and
// explains the model). Redrawn 2026-10-19 richer in 3D, something on every side, and
// with detail by size: parts in fromSize(2, …) show from twice the size up (quarter
// units allowed), fromSize(1, …) hides specks below the stamp's own size and
// belowSize(1, …) is a plainer stand-in when small (owner: "less detail on the smaller
// version and more detail on the large versions"). Back to front, no boxes overlapping,
// so every size paints the same as it draws by depth (test/stampmodels.test.mjs).
import { COLORS, box, hbox, face, patch, top, fromSize, belowSize } from '../stampart.js';
const { BLUE, YELLOW, RED, BROWN, STONE, SAND, SKY, ORANGE, INK, WHITE, GOLD, PLANET, VIOLET, NAVY, SKIN, GREEN, CLOUD, PURPLE } = COLORS;

// Detail by size: hidden below 1× (specks that turn to noise when small) and added from
// 2× up (fine detail in quarter units, written .5 in half-unit numbers).
const big = (...faces) => fromSize(2, faces);
const notTiny = (...faces) => fromSize(1, faces);

// A wheel s half units round, sticking a half unit out from the body's side at y, its
// hub on the outer face (out: 'L' the near side, 'l' the far side). From 2×: tread on
// top, and a shiny rim round the hub.
const wheel = (x, y, out, s = 3, hub = STONE, rim = WHITE) => {
  const at = out === 'L' ? y + 1 : y;
  return [...hbox([x, y, 0], [s, 1, s], INK),
    ...big(top(s, [x + 0.5, x + 1], [y, y + 1], STONE), top(s, [x + s - 1, x + s - 0.5], [y, y + 1], STONE)), // tread
    ...notTiny(patch(out, at, [x + 1, x + s - 1], [1, s - 1], hub)),
    ...big(patch(out, at, [x + 0.5, x + s - 0.5], [0.5, s - 0.5], rim), patch(out, at, [x + 1, x + s - 1], [1, s - 1], hub))];
};
// A head behind a window on a side (half units): face below, hair or a cap above.
const head = (side, at, [a0, a1], z, hair) => big(patch(side, at, [a0, a1], [z, z + 0.5], SKIN), patch(side, at, [a0, a1], [z + 0.5, z + 1], hair));

// A box (half units) with a band of color round all four sides, from z0 to z1.
const banded = ([x, y, z], [sx, sy, sz], color, [z0, z1], band) => [...hbox([x, y, z], [sx, sy, sz], color),
  patch('L', y + sy, [x, x + sx], [z0, z1], band), patch('R', x + sx, [y, y + sy], [z0, z1], band),
  patch('l', y, [x, x + sx], [z0, z1], band), patch('r', x, [y, y + sy], [z0, z1], band)];
// The same band, only from 2× up.
const bandBig = ([x, y], [sx, sy], [z0, z1], band) => big(
  patch('L', y + sy, [x, x + sx], [z0, z1], band), patch('R', x + sx, [y, y + sy], [z0, z1], band),
  patch('l', y, [x, x + sx], [z0, z1], band), patch('r', x, [y, y + sy], [z0, z1], band));
// A grid fin: a little black box, hidden below 1×; a lattice on every side from 2× up.
const gridFin = (x, y, z) => [...notTiny(...hbox([x, y, z], [1, 1, 1], INK)), ...big(
  ...['L', 'l'].flatMap((sd) => [patch(sd, sd === 'L' ? y + 1 : y, [x, x + 0.5], [z, z + 0.5], STONE), patch(sd, sd === 'L' ? y + 1 : y, [x + 0.5, x + 1], [z + 0.5, z + 1], STONE)]),
  ...['R', 'r'].flatMap((sd) => [patch(sd, sd === 'R' ? x + 1 : x, [y, y + 0.5], [z, z + 0.5], STONE), patch(sd, sd === 'R' ? x + 1 : x, [y + 0.5, y + 1], [z + 0.5, z + 1], STONE)]),
  top(z + 1, [x, x + 0.5], [y, y + 0.5], STONE), top(z + 1, [x + 0.5, x + 1], [y + 0.5, y + 1], STONE))];
// A crater: a dark spot, deeper in one corner, from 2× up.
const crater = (side, at, [a, z]) => big(patch(side, at, [a, a + 1], [z, z + 1], PURPLE), patch(side, at, [a, a + 0.5], [z + 0.5, z + 1], VIOLET));

export const MODELS = {
  car: () => [
    ...wheel(1, -1, 'l'), ...wheel(7, -1, 'l'), // the far wheels
    ...big(...hbox([7.5, -0.5, 5], [0.5, 0.5, 0.5], RED)), // the far wing mirror
    ...hbox([0, 0, 1], [11, 4, 3], RED),
    ...notTiny(patch('r', 0, [0, 1], [2, 3], ORANGE), patch('r', 0, [3, 4], [2, 3], ORANGE)), // tail lights
    ...big(patch('r', 0, [1.5, 2.5], [1.5, 2], WHITE)), // the number plate
    patch('R', 11, [0, 1], [2, 3], YELLOW), patch('R', 11, [3, 4], [2, 3], YELLOW), ...notTiny(patch('R', 11, [1, 3], [1, 2], STONE)), // headlights, grille
    ...big(patch('R', 11, [0, 0.5], [2.5, 3], WHITE), patch('R', 11, [3, 3.5], [2.5, 3], WHITE), patch('R', 11, [1.5, 2.5], [1, 1.5], WHITE)), // their shine, a plate
    ...big(...['L', 'l'].flatMap((sd) => { const at = sd === 'L' ? 4 : 0; return [ // doors: seams and handles
      patch(sd, at, [2.5, 3], [1.5, 4], '#c0303d'), patch(sd, at, [5.5, 6], [1.5, 4], '#c0303d'), patch(sd, at, [8, 8.5], [1.5, 4], '#c0303d'),
      patch(sd, at, [4.5, 5], [3, 3.5], STONE), patch(sd, at, [7, 7.5], [3, 3.5], STONE)]; })),
    ...hbox([2, 0, 4], [6, 4, 3], RED), // the cabin
    patch('L', 4, [3, 5], [5, 6], SKY), patch('L', 4, [6, 8], [5, 6], SKY), patch('l', 0, [3, 5], [5, 6], SKY), patch('l', 0, [6, 8], [5, 6], SKY),
    patch('R', 8, [0, 4], [5, 6], SKY), patch('r', 2, [0, 4], [5, 6], SKY), // windscreen, back window
    ...head('L', 4, [6.5, 7.5], 5, BROWN), ...head('l', 0, [6.5, 7.5], 5, BROWN), ...head('R', 8, [2.5, 3.5], 5, BROWN), // a driver
    ...big(patch('r', 2, [2.5, 3.5], [5, 6], BROWN)),
    ...wheel(1, 4, 'L'), ...wheel(7, 4, 'L'),
    ...big(...hbox([7.5, 4, 5], [0.5, 0.5, 0.5], RED)), // the near wing mirror
  ],
  truck: () => [
    ...wheel(1, -1, 'l'), ...wheel(8, -1, 'l'), // the far wheels
    ...big(...hbox([11.5, -0.5, 3.5], [0.5, 0.5, 1.5], INK)), // the far mirror
    ...hbox([0, 0, 1], [8, 4, 7], ORANGE), // the load
    patch('L', 4, [0, 8], [4, 5], WHITE), patch('l', 0, [0, 8], [4, 5], WHITE), patch('r', 0, [0, 4], [4, 5], WHITE), // a stripe round its middle
    ...notTiny(patch('r', 0, [0, 1], [1, 2], RED), patch('r', 0, [3, 4], [1, 2], RED), patch('r', 0, [1, 3], [1, 2], STONE)), // tail lights, a bumper
    ...big(patch('r', 0, [0.5, 1], [2, 7.5], STONE), patch('r', 0, [3, 3.5], [2, 7.5], STONE), patch('r', 0, [1.5, 2.5], [1, 1.5], WHITE)), // the doors' bars, a plate
    ...hbox([8, 0, 1], [4, 4, 5], BLUE), // the cab
    patch('L', 4, [9, 11], [4, 5], SKY), patch('l', 0, [9, 11], [4, 5], SKY), patch('R', 12, [0, 4], [4, 5], SKY),
    ...head('L', 4, [9.5, 10.5], 4, BROWN), ...head('l', 0, [9.5, 10.5], 4, BROWN), ...head('R', 12, [2.5, 3.5], 4, BROWN), // a driver
    patch('R', 12, [0, 1], [2, 3], YELLOW), patch('R', 12, [3, 4], [2, 3], YELLOW), ...notTiny(patch('R', 12, [1, 3], [1, 3], STONE)), // headlights, grille
    ...big(patch('R', 12, [0, 0.5], [2.5, 3], WHITE), patch('R', 12, [3, 3.5], [2.5, 3], WHITE), patch('R', 12, [1, 3], [1.5, 2], INK), patch('R', 12, [1, 3], [2.5, 3], INK)),
    ...big(patch('L', 4, [8.5, 9], [1.5, 3.5], INK), patch('l', 0, [8.5, 9], [1.5, 3.5], INK)), // the cab door's seam
    ...hbox([8, 0, 6], [1, 1, 3], STONE), // the exhaust stack
    ...big(top(9, [8, 9], [0, 1], INK)),
    ...wheel(1, 4, 'L'), ...wheel(8, 4, 'L'),
    ...big(...hbox([11.5, 4, 3.5], [0.5, 0.5, 1.5], INK)), // the near mirror
  ],
  train: () => [
    ...big(...hbox([1.5, -1.5, 1.5], [4, 0.5, 0.5], STONE)), // the far coupling rod
    ...wheel(0, -1, 'l', 3, RED, GOLD), ...wheel(4, -1, 'l', 3, RED, GOLD), ...hbox([8, -1, 0], [2, 1, 2], INK), // the far wheels
    ...hbox([0, 0, 1], [3, 4, 7], RED), // the cab
    patch('L', 4, [1, 2], [4, 6], YELLOW), patch('l', 0, [1, 2], [4, 6], YELLOW), patch('r', 0, [1, 3], [4, 6], YELLOW),
    ...big(patch('L', 4, [1, 2], [4, 5], SKIN), patch('L', 4, [1, 2], [5, 5.5], INK), patch('l', 0, [1, 2], [4, 5], SKIN), patch('l', 0, [1, 2], [5, 5.5], INK)), // the driver
    ...hbox([-1, 0, 8], [5, 4, 1], INK), // its roof
    ...hbox([3, 0, 1], [7, 4, 1], RED), // the footplate
    ...hbox([3, 0, 2], [6, 4, 3], NAVY), ...hbox([3, 1, 5], [6, 2, 1], NAVY), // the boiler
    patch('L', 4, [5, 6], [2, 5], GOLD), patch('l', 0, [5, 6], [2, 5], GOLD), // a brass band round it
    ...big(...[3.5, 4.5, 6.5, 7.5, 8.5].flatMap((x) => [patch('L', 4, [x, x + 0.5], [4, 4.5], STONE), patch('l', 0, [x, x + 0.5], [4, 4.5], STONE)])), // rivets
    ...hbox([5, 1, 6], [1, 2, 1], GOLD), // the dome
    ...hbox([7, 1, 6], [1, 2, 2], INK), // the chimney
    ...hbox([9, 0, 2], [1, 4, 3], INK), patch('R', 10, [1, 3], [3, 4], YELLOW), // the smokebox and its lamp
    ...big(patch('R', 10, [1, 1.5], [3.5, 4], WHITE), patch('R', 10, [1.5, 2.5], [2, 2.5], STONE)), // the lamp's shine, the door's handle
    ...hbox([10, 0, 0], [1, 4, 1], RED), // the cowcatcher
    ...big(patch('R', 11, [1, 1.5], [0, 1], INK), patch('R', 11, [2.5, 3], [0, 1], INK)),
    ...big(...hbox([5.5, 1.5, 9.5], [1, 1, 1], CLOUD), ...hbox([7, 1.5, 8.5], [1, 1, 1], CLOUD), ...hbox([4.5, 1.5, 10.5], [0.5, 0.5, 0.5], CLOUD)), // puffs of steam
    ...wheel(0, 4, 'L', 3, RED, GOLD), ...wheel(4, 4, 'L', 3, RED, GOLD), ...hbox([8, 4, 0], [2, 1, 2], INK),
    ...big(...hbox([1.5, 5, 1.5], [4, 0.5, 0.5], STONE)), // the coupling rod
  ],
  boat: () => [
    ...notTiny(...[2, 5, 8].flatMap((x) => hbox([x, -1, 1], [1, 1, 1], INK))), // tyres hung along the far side
    ...hbox([2, 0, 0], [6, 4, 1], BROWN), ...hbox([1, 0, 1], [8, 4, 1], BROWN), // the hull, wider as it rises
    ...hbox([0, 0, 2], [10, 4, 1], BROWN),
    patch('L', 4, [0, 10], [2, 3], RED), patch('l', 0, [0, 10], [2, 3], RED), patch('r', 0, [0, 4], [2, 3], RED), patch('R', 10, [0, 4], [2, 3], RED),
    ...big(...[2, 4, 6].flatMap((x) => [patch('L', 4, [x, x + 0.5], [1, 1.5], SKY), patch('l', 0, [x, x + 0.5], [1, 1.5], SKY)])), // little portholes
    ...notTiny(...hbox([0, 1, 3], [1, 2, 1], INK)), // a towing post at the stern
    ...big(patch('L', 3, [0, 1], [3, 3.5], SAND), patch('l', 1, [0, 1], [3, 3.5], SAND), patch('R', 1, [1, 3], [3, 3.5], SAND), patch('r', 0, [1, 3], [3, 3.5], SAND)), // a rope round it
    ...banded([2, 1, 3], [2, 2, 6], RED, [6, 7], WHITE), ...hbox([2, 1, 9], [2, 2, 1], INK), // the stout smokestack
    ...big(...hbox([2.5, 1.5, 10.5], [1, 1, 1], CLOUD), ...hbox([1, 1.5, 11.5], [1, 1, 1], CLOUD), ...hbox([0, 1.5, 12.5], [0.5, 0.5, 0.5], CLOUD)), // puffs of smoke
    ...hbox([5, 0, 3], [3, 4, 4], WHITE), // the wheelhouse, windows all round
    patch('L', 4, [6, 7], [5, 6], SKY), patch('l', 0, [6, 7], [5, 6], SKY), patch('r', 5, [1, 3], [5, 6], SKY), patch('R', 8, [1, 3], [5, 6], SKY),
    ...big(...[['L', 4], ['l', 0]].flatMap(([sd, at]) => [patch(sd, at, [5.5, 7.5], [3, 5], RED), patch(sd, at, [6, 7], [3.5, 4.5], WHITE), // lifebuoys, round at the corners
      ...[[5.5, 3], [7, 3], [5.5, 4.5], [7, 4.5]].map(([a, z]) => patch(sd, at, [a, a + 0.5], [z, z + 0.5], WHITE))])),
    ...head('R', 8, [1.5, 2.5], 5, NAVY), // the skipper
    ...hbox([5, 0, 7], [3, 4, 1], RED),
    ...big(...hbox([5, 1.5, 9], [1, 0.5, 0.5], WHITE), ...hbox([5, 1.5, 9.5], [1, 0.5, 0.5], RED), ...hbox([6, 1.5, 8], [0.5, 0.5, 2], INK)), // a flag on a little mast
    ...hbox([10, 1, 2], [1, 2, 1], INK), // the bow's fender
    ...notTiny(...[2, 5, 8].flatMap((x) => hbox([x, 4, 1], [1, 1, 1], INK))),
  ],
  rocket: () => [
    // A Falcon: a tall slim first stage on four landing legs, grid fins under a black interstage, the second stage, a red fairing.
    // Landing legs bowed out: the knee a half unit further out than the hip and the foot.
    ...hbox([1, -2, 1], [1, 1, 3], INK), ...hbox([1, -1, 0], [1, 1, 1], INK), ...hbox([1, -1, 4], [1, 1, 1], INK), // legs behind
    ...hbox([-2, 1, 1], [1, 1, 3], INK), ...hbox([-1, 1, 0], [1, 1, 1], INK), ...hbox([-1, 1, 4], [1, 1, 1], INK),
    ...hbox([1, 1, 0], [1, 1, 1], ORANGE), // the flame, yellow at its heart from 2×
    ...big(patch('L', 2, [1, 2], [0, 0.5], YELLOW), patch('R', 2, [1, 2], [0, 0.5], YELLOW), patch('l', 1, [1, 2], [0, 0.5], YELLOW), patch('r', 1, [1, 2], [0, 0.5], YELLOW)),
    ...hbox([0, 0, 1], [3, 3, 1], STONE), // the engines
    ...gridFin(1, -1, 12), ...gridFin(-1, 1, 12), // grid fins behind
    ...hbox([0, 0, 2], [3, 3, 11], WHITE), patch('L', 3, [1, 2], [4, 10], RED), patch('R', 3, [1, 2], [4, 10], RED), patch('l', 0, [1, 2], [4, 10], RED), patch('r', 0, [1, 2], [4, 10], RED), // the first stage, striped
    ...big(...[['L', 3], ['l', 0]].flatMap(([sd, at]) => [patch(sd, at, [0.5, 2.5], [10.5, 11], RED), patch(sd, at, [0.5, 1], [11.5, 12], BLUE), patch(sd, at, [1, 2.5], [11.5, 12], RED)])), // a little flag
    ...hbox([0, 0, 13], [3, 3, 1], INK), // the interstage
    ...hbox([0, 0, 14], [3, 3, 4], WHITE),
    ...bandBig([0, 0], [3, 3], [15.5, 16], INK), // the name, a dark line round it
    ...hbox([0, 0, 18], [3, 3, 2], RED), ...hbox([1, 1, 20], [1, 1, 1], RED), // the fairing
    ...gridFin(3, 1, 12), ...gridFin(1, 3, 12),
    ...hbox([3, 1, 0], [1, 1, 1], INK), ...hbox([3, 1, 4], [1, 1, 1], INK), ...hbox([4, 1, 1], [1, 1, 3], INK), // legs in front
    ...hbox([1, 3, 0], [1, 1, 1], INK), ...hbox([1, 3, 4], [1, 1, 1], INK), ...hbox([1, 4, 1], [1, 1, 3], INK),
  ],
  plane: () => [
    ...hbox([4, -6, 2], [3, 1, 1], RED), ...hbox([5, -3, 0], [1, 1, 2], INK), ...hbox([4, -5, 2], [3, 5, 1], BLUE), // the far wing, a red tip, a wheel under it
    ...big(top(3, [4.5, 6.5], [-3.5, -1.5], WHITE), top(3, [5, 6], [-3, -2], RED)), // a roundel
    ...hbox([0, -2, 4], [2, 2, 1], BLUE),
    ...hbox([0, 0, 2], [10, 3, 3], WHITE), // the body
    ...notTiny(patch('L', 3, [2, 3], [3, 4], SKY), patch('L', 3, [4, 5], [3, 4], SKY), patch('l', 0, [2, 3], [3, 4], SKY), patch('l', 0, [4, 5], [3, 4], SKY)),
    ...big(patch('L', 3, [6.5, 7.5], [2.5, 4.5], STONE), patch('l', 0, [6.5, 7.5], [2.5, 4.5], STONE)), // a door
    patch('r', 0, [0, 3], [2, 4], RED),
    ...hbox([0, 1, 5], [2, 1, 3], RED), // the tail fin
    ...bandBig([0, 1], [2, 1], [6.5, 7], WHITE),
    ...hbox([6, 0, 5], [3, 3, 1], SKY), // the cockpit
    ...big(patch('R', 9, [1, 2], [5, 5.5], SKIN), patch('L', 3, [7.5, 8.5], [5, 5.5], SKIN), patch('l', 0, [7.5, 8.5], [5, 5.5], SKIN), patch('r', 6, [1, 2], [5, 5.5], BROWN)), // the pilot
    ...hbox([10, 0, 2], [1, 3, 3], RED), // the nose
    ...hbox([11, 0, 3], [1, 1, 1], INK), ...hbox([11, 1, 1], [1, 1, 5], INK), ...hbox([11, 2, 3], [1, 1, 1], INK), // the propeller
    ...big(...['R', 'r'].flatMap((sd) => { const at = sd === 'R' ? 12 : 11; return [patch(sd, at, [1, 2], [1, 1.5], YELLOW), patch(sd, at, [1, 2], [5.5, 6], YELLOW), patch(sd, at, [0, 0.5], [3, 4], YELLOW), patch(sd, at, [2.5, 3], [3, 4], YELLOW)]; })), // its tips
    ...hbox([0, 3, 4], [2, 2, 1], BLUE),
    ...hbox([5, 5, 0], [1, 1, 2], INK), ...hbox([4, 3, 2], [3, 5, 1], BLUE),
    ...big(top(3, [4.5, 6.5], [4.5, 6.5], WHITE), top(3, [5, 6], [5, 6], RED)),
    ...hbox([4, 8, 2], [3, 1, 1], RED),
  ],
  planet: () => [
    ...hbox([-1, -1, 4], [9, 1, 1], SAND), ...big(top(5, [-1, 8], [-1, -0.5], GOLD)), // the ring behind, two-tone from 2×
    ...hbox([-1, 0, 4], [1, 7, 1], SAND), ...big(top(5, [-1, -0.5], [0, 7], GOLD)),
    ...hbox([2, 2, 0], [3, 3, 1], PLANET), ...hbox([1, 1, 1], [5, 5, 1], PLANET),
    ...banded([1, 0, 2], [5, 1, 5], PLANET, [6, 7], VIOLET), ...bandBig([1, 0], [5, 1], [5, 5.5], PURPLE),
    ...banded([0, 1, 2], [7, 5, 5], PLANET, [6, 7], VIOLET), ...bandBig([0, 1], [7, 5], [5, 5.5], PURPLE),
    ...banded([1, 6, 2], [5, 1, 5], PLANET, [6, 7], VIOLET), ...bandBig([1, 6], [5, 1], [5, 5.5], PURPLE), // a band round it, a thin cloud band from 2×
    ...hbox([1, 1, 7], [5, 5, 1], PLANET), ...crater('L', 6, [2, 7]), ...crater('R', 6, [3.5, 7]), ...crater('l', 1, [3.5, 7]), ...crater('r', 1, [2, 7]), // craters from 2×
    ...hbox([2, 2, 8], [3, 3, 1], PLANET), ...big(top(9, [3, 4], [2.5, 3.5], PURPLE), top(9, [3, 3.5], [2.5, 3], VIOLET)),
    ...hbox([7, 0, 4], [1, 7, 1], SAND), ...big(top(5, [7.5, 8], [0, 7], GOLD)),
    ...hbox([-1, 7, 4], [9, 1, 1], SAND), ...big(top(5, [-1, 8], [7.5, 8], GOLD)), // and in front
  ],
  ufo: () => [
    // The same above and below the rim, every layer a half unit tall.
    ...hbox([3, 3, 0], [3, 3, 1], YELLOW), // the light underneath
    ...hbox([2, 2, 1], [5, 5, 1], STONE), ...hbox([1, 1, 2], [7, 7, 1], STONE),
    ...hbox([0, 0, 3], [9, 9, 1], STONE), // the rim, lit all round
    ...notTiny(...[1, 4, 7].flatMap((a) => [patch('L', 9, [a, a + 1], [3, 4], YELLOW), patch('R', 9, [a, a + 1], [3, 4], YELLOW), patch('l', 0, [a, a + 1], [3, 4], YELLOW), patch('r', 0, [a, a + 1], [3, 4], YELLOW)])),
    ...big(...[1, 4, 7].flatMap((a) => [patch('L', 9, [a, a + 0.5], [3.5, 4], WHITE), patch('R', 9, [a, a + 0.5], [3.5, 4], WHITE), patch('l', 0, [a, a + 0.5], [3.5, 4], WHITE), patch('r', 0, [a, a + 0.5], [3.5, 4], WHITE)])),
    ...hbox([1, 1, 4], [7, 7, 1], STONE),
    ...hbox([2, 2, 5], [5, 5, 1], SKY), // the dome, an alien inside from 2×
    ...big(patch('L', 7, [3, 6], [5, 6], GREEN), patch('L', 7, [3.5, 4], [5.5, 6], INK), patch('L', 7, [5, 5.5], [5.5, 6], INK),
      patch('R', 7, [3, 6], [5, 6], GREEN), patch('R', 7, [5, 5.5], [5.5, 6], INK), patch('l', 2, [3, 6], [5, 6], GREEN), patch('r', 2, [3, 6], [5, 6], GREEN), patch('r', 2, [5, 5.5], [5.5, 6], INK)),
    ...hbox([3, 3, 6], [3, 3, 1], SKY),
    ...big(...[['L', 6], ['R', 6], ['l', 3], ['r', 3]].flatMap(([sd, at]) => [patch(sd, at, [3.5, 5.5], [6, 6.5], GREEN), patch(sd, at, [3.5, 4], [6.5, 7], GREEN), patch(sd, at, [5, 5.5], [6.5, 7], GREEN)])), // the top of its head, two feelers
    ...hbox([4, 4, 7], [1, 1, 1], INK), ...hbox([4, 4, 8], [1, 1, 1], RED), // an aerial
  ],
};
