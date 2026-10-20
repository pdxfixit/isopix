// Nature and food: box stamps as 3D models (web/engine/stampmodels.js has the rest and
// explains the model). Redrawn 2026-10-19 to be richer in 3D, something on every side
// (owner: "make a pass across all the stamps to make them more 3d rich"), back to
// front with no boxes overlapping, so they draw the same painted or by depth.
// Nature and food stamps, redrawn rounder, with something on every side (they spin).
// Half units throughout; back to front (far x, y first, low z first), no box overlapping another.
import { COLORS, box, face, hbox, patch, top } from '../stampart.js';
const { YELLOW, RED, GREEN, BROWN, STONE, SAND, PINK, SKY, ORANGE, WHITE, LIME, PINE, CREAM, FROSTING, TEAL, FOX, GOLD } = COLORS;


// Icing round a square box from a to b (half units), its top at z: a band along the top
// half unit of every side, and drips [from, to, length] hanging below it, the same on each side.
const drips = (a, b, z, ds, color) => [['L', b], ['R', b], ['l', a], ['r', a]].flatMap(([s, at]) => [
  patch(s, at, [a, b], [z - 1, z], color), ...ds.map(([d0, d1, h]) => patch(s, at, [d0, d1], [z - 1 - h, z - 1], color))]);

export const MODELS = {
  // A round crown, layered narrow, wide, narrow, on a trunk; an apple on every side.
  tree: () => [
    ...hbox([2, 2, 0], [1, 1, 3], BROWN),
    ...hbox([1, 1, 3], [3, 3, 1], GREEN),
    ...hbox([0, 0, 4], [5, 5, 3], GREEN),
    patch('l', 0, [1, 2], [4, 5], RED), patch('r', 0, [3, 4], [5, 6], RED),
    patch('R', 5, [1, 2], [5, 6], RED), patch('L', 5, [1, 2], [4, 5], RED), patch('L', 5, [3, 4], [5, 6], RED),
    ...hbox([1, 1, 7], [3, 3, 1], GREEN),
    ...hbox([2, 2, 8], [1, 1, 1], GREEN),
  ],
  // A rounded boulder, a lump on top, pebbles at its foot, moss round the back.
  rock: () => [
    ...hbox([1, 0, 0], [4, 1, 2], STONE), patch('l', 0, [2, 4], [0, 1], GREEN),
    ...hbox([0, 1, 0], [6, 3, 2], STONE), patch('r', 0, [1, 3], [0, 1], GREEN),
    ...hbox([-1, 4, 0], [2, 2, 1], STONE), // a pebble
    ...hbox([1, 1, 2], [4, 3, 1], STONE),
    ...hbox([1, 1, 3], [2, 2, 1], STONE),
    ...hbox([1, 4, 0], [4, 1, 2], STONE),
    ...hbox([6, 3, 0], [1, 1, 1], STONE), // and another
  ],
  // A domed cap, white spots all round it and on top, on a cream stem.
  mushroom: () => [
    ...hbox([2, 2, 0], [2, 2, 3], CREAM),
    ...hbox([0, 0, 3], [6, 6, 2], RED),
    patch('l', 0, [1, 2], [4, 5], WHITE), patch('l', 0, [4, 5], [3, 4], WHITE), patch('r', 0, [2, 3], [3, 4], WHITE), patch('r', 0, [4, 5], [4, 5], WHITE),
    patch('L', 6, [1, 2], [3, 4], WHITE), patch('L', 6, [4, 5], [4, 5], WHITE), patch('R', 6, [1, 2], [4, 5], WHITE), patch('R', 6, [4, 5], [3, 4], WHITE),
    ...hbox([1, 1, 5], [4, 4, 1], RED), top(6, [1, 2], [3, 4], WHITE), top(6, [3, 4], [1, 2], WHITE),
    ...hbox([2, 2, 6], [2, 2, 1], RED), top(7, [3, 4], [3, 4], WHITE),
  ],
  // Three tiers, each a skirt and a step in, cones hanging all round.
  pine: () => [
    ...hbox([2, 2, 0], [1, 1, 3], BROWN),
    ...hbox([0, 0, 3], [5, 5, 1], PINE), patch('l', 0, [2, 3], [3, 4], BROWN), patch('r', 0, [2, 3], [3, 4], BROWN),
    patch('R', 5, [1, 2], [3, 4], BROWN), patch('L', 5, [3, 4], [3, 4], BROWN),
    ...hbox([1, 1, 4], [3, 3, 1], PINE),
    ...hbox([0, 0, 5], [5, 5, 1], PINE), patch('l', 0, [3, 4], [5, 6], BROWN), patch('r', 0, [1, 2], [5, 6], BROWN), patch('R', 5, [3, 4], [5, 6], BROWN), patch('L', 5, [1, 2], [5, 6], BROWN),
    ...hbox([1, 1, 6], [3, 3, 1], PINE),
    ...hbox([1, 1, 7], [3, 3, 1], PINE),
    ...hbox([2, 2, 8], [1, 1, 2], PINE),
  ],
  // A rounded bush, berries and flowers all round.
  bush: () => [
    ...hbox([1, 0, 0], [5, 1, 2], GREEN), patch('l', 0, [2, 3], [1, 2], RED), patch('l', 0, [4, 5], [0, 1], PINK),
    ...hbox([0, 1, 0], [7, 3, 2], GREEN), patch('r', 0, [2, 3], [0, 1], RED), patch('R', 7, [2, 3], [1, 2], RED), patch('L', 4, [0, 1], [0, 1], PINK),
    patch('L', 4, [6, 7], [1, 2], RED),
    ...hbox([1, 1, 2], [5, 3, 1], GREEN), top(3, [3, 4], [1, 2], PINK),
    ...hbox([1, 1, 3], [2, 2, 1], GREEN), top(4, [1, 2], [2, 3], RED),
    ...hbox([1, 4, 0], [5, 1, 2], GREEN), patch('L', 5, [2, 3], [1, 2], RED), patch('L', 5, [4, 5], [0, 1], YELLOW),
    ...hbox([4, 2, 3], [2, 2, 1], GREEN), top(4, [4, 5], [2, 3], YELLOW),
  ],
  // Stepped round from every side: widest at its middle, corners rounded above and below;
  // a stem in a dimple between the shoulders, and a leaf.
  apple: () => [
    ...hbox([2, 2, 0], [3, 3, 1], RED),
    ...hbox([1, 1, 1], [5, 5, 1], RED),
    ...hbox([1, 0, 2], [5, 1, 1], RED), ...hbox([0, 1, 2], [7, 5, 1], RED), ...hbox([1, 6, 2], [5, 1, 1], RED),
    ...hbox([0, 0, 3], [7, 7, 2], RED),
    ...hbox([1, 0, 5], [5, 1, 1], RED), ...hbox([0, 1, 5], [7, 5, 1], RED), ...hbox([1, 6, 5], [5, 1, 1], RED),
    ...hbox([1, 1, 6], [5, 1, 1], RED), ...hbox([1, 2, 6], [1, 3, 1], RED), // the shoulders, round the dimple
    ...hbox([3, 3, 6], [1, 1, 3], BROWN), // the stem
    ...hbox([5, 2, 6], [1, 3, 1], RED), ...hbox([1, 5, 6], [5, 1, 1], RED),
    ...hbox([4, 3, 8], [2, 1, 1], GREEN), // a leaf
  ],
  // Three tiers and a cherry; icing dripping down every side, sprinkles on the ledges.
  cake: () => [
    ...hbox([0, 0, 0], [7, 7, 3], FROSTING), ...drips(0, 7, 3, [[1, 2, 1], [3, 4, 2], [5, 6, 1]], PINK),
    top(3, [0, 1], [2, 3], YELLOW), top(3, [3, 4], [6, 7], SKY), top(3, [6, 7], [4, 5], YELLOW), top(3, [2, 3], [0, 1], SKY),
    top(3, [6, 7], [0, 1], TEAL), top(3, [0, 1], [6, 7], TEAL),
    ...hbox([1, 1, 3], [5, 5, 2], CREAM), ...drips(1, 6, 5, [[2, 3, 1], [4, 5, 1]], FROSTING),
    top(5, [1, 2], [4, 5], TEAL), top(5, [5, 6], [2, 3], YELLOW), top(5, [3, 4], [1, 2], SKY), top(5, [2, 3], [5, 6], YELLOW),
    ...hbox([2, 2, 5], [3, 3, 2], FROSTING), ...drips(2, 5, 7, [[3, 4, 1]], PINK),
    ...hbox([3, 3, 7], [1, 1, 1], RED), // a cherry
  ],
  // A waffle cone, a scoop dripping over its edge, sprinkles all round and a cherry.
  icecream: () => [
    ...hbox([1, -1, 4], [1, 1, 2], PINK), ...hbox([-1, 1, 5], [1, 1, 1], PINK), // drips at the back, hanging from the scoop
    ...hbox([1, 1, 0], [1, 1, 2], SAND),
    ...hbox([0, 0, 2], [3, 3, 4], SAND),
    ...[['L', 3], ['R', 3], ['l', 0], ['r', 0]].flatMap(([s, at]) => [ // the waffle
      patch(s, at, [0, 1], [2, 3], GOLD), patch(s, at, [2, 3], [2, 3], GOLD), patch(s, at, [1, 2], [3, 4], GOLD),
      patch(s, at, [0, 1], [4, 5], GOLD), patch(s, at, [2, 3], [4, 5], GOLD)]),
    ...hbox([1, 3, 4], [1, 1, 2], PINK), ...hbox([3, 1, 5], [1, 1, 1], PINK), // and in front
    ...hbox([0, -1, 6], [3, 1, 1], PINK), ...hbox([-1, 0, 6], [5, 3, 1], PINK), ...hbox([0, 3, 6], [3, 1, 1], PINK), // the scoop, rounded
    ...hbox([-1, -1, 7], [5, 5, 1], PINK),
    patch('l', -1, [2, 3], [7, 8], SKY), patch('r', -1, [-1, 0], [7, 8], YELLOW), patch('L', 4, [2, 3], [7, 8], YELLOW), patch('R', 4, [0, 1], [7, 8], LIME),
    ...hbox([0, -1, 8], [3, 1, 1], PINK), patch('l', -1, [0, 1], [8, 9], YELLOW),
    ...hbox([-1, 0, 8], [5, 3, 1], PINK), patch('r', -1, [1, 2], [8, 9], LIME), patch('R', 4, [2, 3], [8, 9], SKY),
    ...hbox([0, 3, 8], [3, 1, 1], PINK), patch('L', 4, [0, 1], [8, 9], SKY),
    top(9, [-1, 0], [1, 2], YELLOW), top(9, [3, 4], [0, 1], LIME), top(9, [1, 2], [3, 4], SKY),
    ...hbox([0, 0, 9], [3, 3, 1], PINK), top(10, [0, 1], [2, 3], SKY), top(10, [2, 3], [0, 1], YELLOW),
    ...hbox([1, 1, 10], [1, 1, 1], RED),
  ],
  // A striped wrapper, a swirl of frosting, sprinkles all round and a cherry.
  cupcake: () => [
    ...hbox([1, 1, 0], [3, 3, 1], TEAL),
    ...hbox([0, 0, 1], [5, 5, 2], TEAL),
    ...[['L', 5], ['R', 5], ['l', 0], ['r', 0]].flatMap(([s, at]) => [patch(s, at, [1, 2], [1, 3], SKY), patch(s, at, [3, 4], [1, 3], SKY)]),
    ...hbox([0, 0, 3], [5, 5, 1], FROSTING),
    patch('L', 5, [1, 2], [3, 4], YELLOW), patch('R', 5, [3, 4], [3, 4], SKY), patch('l', 0, [2, 3], [3, 4], LIME), patch('r', 0, [1, 2], [3, 4], YELLOW),
    top(4, [0, 1], [3, 4], SKY), top(4, [4, 5], [1, 2], YELLOW),
    ...hbox([1, 1, 4], [3, 3, 1], FROSTING), top(5, [1, 2], [3, 4], LIME),
    ...hbox([2, 1, 5], [2, 2, 1], FROSTING),
    ...hbox([2, 2, 6], [1, 1, 1], RED),
  ],
  // Rounder at the shoulder, ridged all round, a leafy top.
  carrot: () => [
    ...hbox([1, 1, 0], [1, 1, 2], ORANGE),
    ...hbox([0, 0, 2], [3, 3, 3], ORANGE),
    ...[['L', 3], ['R', 3], ['l', 0], ['r', 0]].flatMap(([s, at]) => [patch(s, at, [0, 1], [2, 3], FOX), patch(s, at, [2, 3], [3, 4], FOX)]),
    ...hbox([0, -1, 5], [3, 1, 2], ORANGE), patch('l', -1, [1, 2], [5, 6], FOX),
    ...hbox([-1, 0, 5], [5, 3, 2], ORANGE), patch('r', -1, [0, 1], [5, 6], FOX), patch('R', 4, [1, 2], [6, 7], FOX), patch('L', 3, [-1, 0], [5, 6], FOX),
    ...hbox([0, 3, 5], [3, 1, 2], ORANGE), patch('L', 4, [1, 2], [6, 7], FOX),
    ...hbox([1, 0, 8], [1, 1, 1], LIME),
    ...hbox([0, 1, 8], [1, 1, 2], GREEN),
    ...hbox([1, 1, 7], [1, 1, 3], GREEN),
    ...hbox([2, 1, 8], [1, 1, 1], LIME),
    ...hbox([1, 2, 8], [1, 1, 2], LIME),
  ],
};
