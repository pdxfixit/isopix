// The vehicles and space things, facing right (+x): box stamps as 3D models (web/engine/stampmodels.js has the rest and
// explains the model). Redrawn 2026-10-19 to be richer in 3D, something on every side
// (owner: "make a pass across all the stamps to make them more 3d rich"), back to
// front with no boxes overlapping, so they draw the same painted or by depth.
import { COLORS, box, face, hbox, patch, top } from '../stampart.js';
const { BLUE, YELLOW, RED, BROWN, STONE, SAND, SKY, ORANGE, INK, WHITE, GOLD, PLANET, VIOLET, NAVY } = COLORS;

// A wheel s half units round, sticking a half unit out from the body's side at y,
// its hub on the outer face (out: 'L' the near side, 'l' the far side).
const wheel = (x, y, out, s = 3, hub = STONE) => [...hbox([x, y, 0], [s, 1, s], INK), patch(out, out === 'L' ? y + 1 : y, [x + 1, x + s - 1], [1, s - 1], hub)];

// A box (half units) with a band of color round all four sides, from z0 to z1.
const banded = ([x, y, z], [sx, sy, sz], color, [z0, z1], band) => [...hbox([x, y, z], [sx, sy, sz], color),
  patch('L', y + sy, [x, x + sx], [z0, z1], band), patch('R', x + sx, [y, y + sy], [z0, z1], band),
  patch('l', y, [x, x + sx], [z0, z1], band), patch('r', x, [y, y + sy], [z0, z1], band)];

export const MODELS = {
  car: () => [
    ...wheel(1, -1, 'l'), ...wheel(7, -1, 'l'), // the far wheels
    ...hbox([0, 0, 1], [11, 4, 3], RED),
    patch('r', 0, [0, 1], [2, 3], ORANGE), patch('r', 0, [3, 4], [2, 3], ORANGE), // tail lights
    patch('R', 11, [0, 1], [2, 3], YELLOW), patch('R', 11, [3, 4], [2, 3], YELLOW), patch('R', 11, [1, 3], [1, 2], STONE), // headlights, grille
    ...hbox([2, 0, 4], [6, 4, 3], RED), // the cabin
    patch('L', 4, [3, 5], [5, 6], SKY), patch('L', 4, [6, 8], [5, 6], SKY), patch('l', 0, [3, 5], [5, 6], SKY), patch('l', 0, [6, 8], [5, 6], SKY),
    patch('R', 8, [0, 4], [5, 6], SKY), patch('r', 2, [0, 4], [5, 6], SKY), // windscreen, back window
    ...wheel(1, 4, 'L'), ...wheel(7, 4, 'L'),
  ],
  truck: () => [
    ...wheel(1, -1, 'l'), ...wheel(8, -1, 'l'), // the far wheels
    ...hbox([0, 0, 1], [8, 4, 7], ORANGE), // the load
    patch('L', 4, [0, 8], [4, 5], WHITE), patch('l', 0, [0, 8], [4, 5], WHITE), patch('r', 0, [0, 4], [4, 5], WHITE), // a stripe round its middle
    patch('r', 0, [0, 1], [1, 2], RED), patch('r', 0, [3, 4], [1, 2], RED), patch('r', 0, [1, 3], [1, 2], STONE), // tail lights, a bumper
    ...hbox([8, 0, 1], [4, 4, 5], BLUE), // the cab
    patch('L', 4, [9, 11], [4, 5], SKY), patch('l', 0, [9, 11], [4, 5], SKY), patch('R', 12, [0, 4], [4, 5], SKY),
    patch('R', 12, [0, 1], [2, 3], YELLOW), patch('R', 12, [3, 4], [2, 3], YELLOW), patch('R', 12, [1, 3], [1, 3], STONE), // headlights, grille
    ...hbox([8, 0, 6], [1, 1, 3], STONE), // the exhaust stack
    ...wheel(1, 4, 'L'), ...wheel(8, 4, 'L'),
  ],
  train: () => [
    ...wheel(0, -1, 'l', 3, RED), ...wheel(4, -1, 'l', 3, RED), ...hbox([8, -1, 0], [2, 1, 2], INK), // the far wheels
    ...hbox([0, 0, 1], [3, 4, 7], RED), // the cab
    patch('L', 4, [1, 2], [4, 6], YELLOW), patch('l', 0, [1, 2], [4, 6], YELLOW), patch('r', 0, [1, 3], [4, 6], YELLOW),
    ...hbox([-1, 0, 8], [5, 4, 1], INK), // its roof
    ...hbox([3, 0, 1], [7, 4, 1], RED), // the footplate
    ...hbox([3, 0, 2], [6, 4, 3], NAVY), ...hbox([3, 1, 5], [6, 2, 1], NAVY), // the boiler
    patch('L', 4, [5, 6], [2, 5], GOLD), patch('l', 0, [5, 6], [2, 5], GOLD), // a brass band round it
    ...hbox([5, 1, 6], [1, 2, 1], GOLD), // the dome
    ...hbox([7, 1, 6], [1, 2, 2], INK), // the chimney
    ...hbox([9, 0, 2], [1, 4, 3], INK), patch('R', 10, [1, 3], [3, 4], YELLOW), // the smokebox and its lamp
    ...hbox([10, 0, 0], [1, 4, 1], RED), // the cowcatcher
    ...wheel(0, 4, 'L', 3, RED), ...wheel(4, 4, 'L', 3, RED), ...hbox([8, 4, 0], [2, 1, 2], INK),
  ],
  boat: () => [
    ...[2, 5, 8].flatMap((x) => hbox([x, -1, 1], [1, 1, 1], INK)), // tyres hung along the far side
    ...hbox([2, 0, 0], [6, 4, 1], BROWN), ...hbox([1, 0, 1], [8, 4, 1], BROWN), // the hull, wider as it rises
    ...hbox([0, 0, 2], [10, 4, 1], BROWN),
    patch('L', 4, [0, 10], [2, 3], RED), patch('l', 0, [0, 10], [2, 3], RED), patch('r', 0, [0, 4], [2, 3], RED), patch('R', 10, [0, 4], [2, 3], RED),
    ...hbox([0, 1, 3], [1, 2, 1], INK), // a towing post at the stern
    ...banded([2, 1, 3], [2, 2, 6], RED, [6, 7], WHITE), ...hbox([2, 1, 9], [2, 2, 1], INK), // the stout smokestack
    ...hbox([5, 0, 3], [3, 4, 4], WHITE), // the wheelhouse, windows all round
    patch('L', 4, [6, 7], [5, 6], SKY), patch('l', 0, [6, 7], [5, 6], SKY), patch('r', 5, [1, 3], [5, 6], SKY), patch('R', 8, [1, 3], [5, 6], SKY),
    ...hbox([5, 0, 7], [3, 4, 1], RED),
    ...hbox([10, 1, 2], [1, 2, 1], INK), // the bow's fender
    ...[2, 5, 8].flatMap((x) => hbox([x, 4, 1], [1, 1, 1], INK)),
  ],
  rocket: () => [
    // A Falcon: a tall slim first stage on four landing legs, grid fins under a black interstage, the second stage, a red fairing.
    ...hbox([1, -2, 0], [1, 1, 1], INK), ...hbox([1, -1, 0], [1, 1, 3], INK), ...hbox([-2, 1, 0], [1, 1, 1], INK), ...hbox([-1, 1, 0], [1, 1, 3], INK), // legs behind
    ...hbox([1, 1, 0], [1, 1, 1], ORANGE), ...hbox([0, 0, 1], [3, 3, 1], STONE), // the flame, the engines
    ...hbox([1, -1, 12], [1, 1, 1], INK), ...hbox([-1, 1, 12], [1, 1, 1], INK), // grid fins behind
    ...hbox([0, 0, 2], [3, 3, 11], WHITE), patch('L', 3, [1, 2], [4, 10], RED), patch('R', 3, [1, 2], [4, 10], RED), patch('l', 0, [1, 2], [4, 10], RED), patch('r', 0, [1, 2], [4, 10], RED), // the first stage, striped
    ...hbox([0, 0, 13], [3, 3, 1], INK), // the interstage
    ...hbox([0, 0, 14], [3, 3, 4], WHITE),
    ...hbox([0, 0, 18], [3, 3, 2], RED), ...hbox([1, 1, 20], [1, 1, 1], RED), // the fairing
    ...hbox([3, 1, 12], [1, 1, 1], INK), ...hbox([1, 3, 12], [1, 1, 1], INK),
    ...hbox([3, 1, 0], [1, 1, 3], INK), ...hbox([4, 1, 0], [1, 1, 1], INK), ...hbox([1, 3, 0], [1, 1, 3], INK), ...hbox([1, 4, 0], [1, 1, 1], INK), // legs in front
  ],
  plane: () => [
    ...hbox([4, -6, 2], [3, 1, 1], RED), ...hbox([5, -3, 0], [1, 1, 2], INK), ...hbox([4, -5, 2], [3, 5, 1], BLUE), // the far wing, a red tip, a wheel under it
    ...hbox([0, -2, 4], [2, 2, 1], BLUE),
    ...hbox([0, 0, 2], [10, 3, 3], WHITE), // the body
    patch('L', 3, [2, 3], [3, 4], SKY), patch('L', 3, [4, 5], [3, 4], SKY), patch('l', 0, [2, 3], [3, 4], SKY), patch('l', 0, [4, 5], [3, 4], SKY),
    patch('r', 0, [0, 3], [2, 4], RED),
    ...hbox([0, 1, 5], [2, 1, 3], RED), // the tail fin
    ...hbox([6, 0, 5], [3, 3, 1], SKY), // the cockpit
    ...hbox([10, 0, 2], [1, 3, 3], RED), // the nose
    ...hbox([11, 0, 3], [1, 1, 1], INK), ...hbox([11, 1, 1], [1, 1, 5], INK), ...hbox([11, 2, 3], [1, 1, 1], INK), // the propeller
    ...hbox([0, 3, 4], [2, 2, 1], BLUE),
    ...hbox([5, 5, 0], [1, 1, 2], INK), ...hbox([4, 3, 2], [3, 5, 1], BLUE), ...hbox([4, 8, 2], [3, 1, 1], RED),
  ],
  planet: () => [
    ...hbox([-1, -1, 4], [9, 1, 1], SAND), ...hbox([-1, 0, 4], [1, 7, 1], SAND), // the ring behind
    ...hbox([2, 2, 0], [3, 3, 1], PLANET), ...hbox([1, 1, 1], [5, 5, 1], PLANET),
    ...[[[1, 0, 2], [5, 1, 5]], [[0, 1, 2], [7, 5, 5]], [[1, 6, 2], [5, 1, 5]]].flatMap(([o, sz]) => banded(o, sz, PLANET, [6, 7], VIOLET)), // a band round it
    ...hbox([1, 1, 7], [5, 5, 1], PLANET), ...hbox([2, 2, 8], [3, 3, 1], PLANET),
    ...hbox([7, 0, 4], [1, 7, 1], SAND), ...hbox([-1, 7, 4], [9, 1, 1], SAND), // and in front
  ],
  ufo: () => [
    // The same above and below the rim, every layer a half unit tall.
    ...hbox([3, 3, 0], [3, 3, 1], YELLOW), // the light underneath
    ...hbox([2, 2, 1], [5, 5, 1], STONE), ...hbox([1, 1, 2], [7, 7, 1], STONE),
    ...hbox([0, 0, 3], [9, 9, 1], STONE), // the rim, lit all round
    ...[1, 4, 7].flatMap((a) => [patch('L', 9, [a, a + 1], [3, 4], YELLOW), patch('R', 9, [a, a + 1], [3, 4], YELLOW), patch('l', 0, [a, a + 1], [3, 4], YELLOW), patch('r', 0, [a, a + 1], [3, 4], YELLOW)]),
    ...hbox([1, 1, 4], [7, 7, 1], STONE),
    ...hbox([2, 2, 5], [5, 5, 1], SKY), ...hbox([3, 3, 6], [3, 3, 1], SKY), // the dome
    ...hbox([4, 4, 7], [1, 1, 1], INK), ...hbox([4, 4, 8], [1, 1, 1], RED), // an aerial
  ],
};
