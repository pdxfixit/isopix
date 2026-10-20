// Nature and food: box stamps as 3D models (web/engine/stampmodels.js has the rest and
// explains the model). Redrawn 2026-10-19 richer in 3D, something on every side, and
// with detail by size: parts in fromSize(2, …) show from twice the size up (quarter
// units allowed), fromSize(1, …) hides specks below the stamp's own size and
// belowSize(1, …) is a plainer stand-in when small (owner: "less detail on the smaller
// version and more detail on the large versions"). Back to front, no boxes overlapping,
// so every size paints the same as it draws by depth (test/stampmodels.test.mjs).
// Nature and food stamps, redrawn rounder, with something on every side (they spin).
// Half units throughout; back to front (far x, y first, low z first), no box overlapping another.
// Detail by size: fromSize(2, …) parts show from twice the size up and may use quarter
// units (.5); fromSize(1, …) parts are specks that would be noise below 1×; belowSize(…)
// parts are the plainer versions the finer ones replace.
import { COLORS, hbox, patch, top, fromSize, belowSize } from '../stampart.js';
const { YELLOW, RED, GREEN, BROWN, STONE, SAND, PINK, SKY, ORANGE, WHITE, LIME, PINE, CREAM, FROSTING, TEAL, FOX, GOLD, INK, TAN, SKIN, HOG, BLUE } = COLORS;
const BARK = '#6b4220', CRACK = '#7c8288', NEEDLE = '#1b5e20', GILL = '#eadbb4', GILLINE = '#c9b080', BLUSH = '#ff9aa2', WING = '#1f5fbf';

// Only at 1× (a 1× feature that a finer one replaces from 2×, and too small below 1×).
const at1 = (faces) => fromSize(1, belowSize(2, faces));
// The four sides of a box from (x0, y0) to (x1, y1), as patch arguments.
const sides = (x0, y0, x1, y1) => [['L', y1], ['R', x1], ['l', y0], ['r', x0]];
// Icing round a square box from a to b (half units), its top at z: a band along the top
// half unit of every side, and drips [from, to, length] hanging below it, the same on each side.
const drips = (a, b, z, ds, color) => sides(a, a, b, b).flatMap(([s, at]) => [
  patch(s, at, [a, b], [z - 1, z], color), ...ds.map(([d0, d1, h]) => patch(s, at, [d0, d1], [z - 1 - h, z - 1], color))]);
// A cherry's stem and shine, on a cherry at (x, y, z), from 2×.
const cherryDetail = (x, y, z) => fromSize(2, [top(z + 1, [x, x + 0.5], [y + 0.5, y + 1], WHITE), ...hbox([x + 0.5, y, z + 1], [0.5, 0.5, 1], BROWN)]);
// A flower on a box side, from 2×: four petals round a middle, 1.5 half units across from (a, z).
const flower = (s, at, a, z, petal, mid) => fromSize(2, [
  patch(s, at, [a + 0.5, a + 1], [z + 1, z + 1.5], petal), patch(s, at, [a, a + 0.5], [z + 0.5, z + 1], petal),
  patch(s, at, [a + 1, a + 1.5], [z + 0.5, z + 1], petal), patch(s, at, [a + 0.5, a + 1], [z, z + 0.5], petal),
  patch(s, at, [a + 0.5, a + 1], [z + 0.5, z + 1], mid)]);
// The same, lying on a box's top at height z, from (x, y).
const topFlower = (z, x, y, petal, mid) => fromSize(2, [
  top(z, [x + 0.5, x + 1], [y, y + 0.5], petal), top(z, [x, x + 0.5], [y + 0.5, y + 1], petal),
  top(z, [x + 1, x + 1.5], [y + 0.5, y + 1], petal), top(z, [x + 0.5, x + 1], [y + 1, y + 1.5], petal),
  top(z, [x + 0.5, x + 1], [y + 0.5, y + 1], mid)]);

export const MODELS = {
  // A round crown, layered narrow, wide, narrow, on a trunk; an apple on every side.
  // From 2×: bark and a knot hole, leafy flecks, the apples' stems and shine, and a bluebird on a branch.
  tree: () => {
    const apples = [['l', 0, 1, 4], ['r', 0, 3, 5], ['R', 5, 1, 5], ['L', 5, 1, 4], ['L', 5, 3, 5]];
    return [
      ...hbox([2, 2, 0], [1, 1, 3], BROWN),
      ...fromSize(2, [
        patch('L', 3, [2, 2.5], [0, 1.5], BARK), patch('L', 3, [2.5, 3], [2, 2.5], INK), // a knot hole
        patch('R', 3, [2.5, 3], [0.5, 2.5], BARK), patch('l', 2, [2.5, 3], [0.5, 2], BARK), patch('r', 2, [2, 2.5], [1, 2.5], BARK)]),
      ...hbox([1, 1, 3], [3, 3, 1], GREEN),
      ...hbox([0, 0, 4], [5, 5, 3], GREEN),
      ...fromSize(1, apples.map(([s, at, a, z]) => patch(s, at, [a, a + 1], [z, z + 1], RED))),
      ...fromSize(2, [
        ...apples.flatMap(([s, at, a, z]) => [patch(s, at, [a, a + 0.5], [z + 0.5, z + 1], BLUSH), patch(s, at, [a + 0.5, a + 1], [z + 1, z + 1.5], BROWN)]),
        ...sides(0, 0, 5, 5).flatMap(([s, at]) => [patch(s, at, [0.5, 1], [6, 6.5], LIME), patch(s, at, [2.5, 3], [4.5, 5], LIME), patch(s, at, [4, 4.5], [6.5, 7], LIME)]),
        top(7, [0.5, 1], [2, 2.5], LIME), top(7, [2, 2.5], [4.5, 5], LIME), top(7, [3, 3.5], [0.5, 1], LIME)]),
      ...hbox([1, 1, 7], [3, 3, 1], GREEN), ...fromSize(2, [top(8, [1.5, 2], [3, 3.5], LIME)]),
      ...hbox([2, 2, 8], [1, 1, 1], GREEN),
      ...fromSize(2, [ // a bluebird on the ledge
        ...hbox([4, 2, 7], [1, 0.5, 0.5], BLUE), patch('L', 2.5, [4, 4.5], [7, 7.5], WING),
        ...hbox([4.5, 2, 7.5], [0.5, 0.5, 0.5], BLUE), ...hbox([5, 2, 7.5], [0.5, 0.5, 0.5], ORANGE)]),
    ];
  },
  // A rounded boulder, a lump on top, pebbles at its foot, moss round the back.
  // From 2×: cracks, lichen, ragged moss, and a snail on top.
  rock: () => [
    ...hbox([1, 0, 0], [4, 1, 2], STONE), ...fromSize(1, [patch('l', 0, [2, 4], [0, 1], GREEN)]),
    ...fromSize(2, [patch('l', 0, [2.5, 3], [1, 1.5], GREEN), patch('l', 0, [1.5, 2], [0, 0.5], GREEN), patch('l', 0, [3, 3.5], [0.5, 1], LIME), patch('l', 0, [4.5, 5], [1, 1.5], YELLOW)]),
    ...hbox([0, 1, 0], [6, 3, 2], STONE), ...fromSize(1, [patch('r', 0, [1, 3], [0, 1], GREEN)]),
    ...fromSize(2, [patch('r', 0, [1.5, 2], [1, 1.5], GREEN), patch('r', 0, [3, 3.5], [0, 0.5], GREEN), patch('r', 0, [2, 2.5], [0.5, 1], LIME),
      patch('R', 6, [2, 2.5], [1.5, 2], CRACK), patch('R', 6, [2, 2.5], [1, 1.5], CRACK), patch('R', 6, [2.5, 3], [0.5, 1], CRACK)]),
    ...hbox([-1, 4, 0], [2, 2, 1], STONE), // a pebble
    ...hbox([1, 1, 2], [4, 3, 1], STONE), ...fromSize(2, [top(3, [4, 4.5], [1.5, 2], YELLOW), top(3, [3.5, 4], [1, 1.5], YELLOW)]),
    ...hbox([1, 1, 3], [2, 2, 1], STONE), ...fromSize(2, [top(4, [2, 2.5], [1, 1.5], GREEN), top(4, [1.5, 2], [2, 2.5], YELLOW)]),
    ...fromSize(2, [ // a snail
      ...hbox([3, 3, 3], [1, 1, 1], SAND), patch('L', 4, [3, 3.5], [3.5, 4], BROWN), patch('l', 3, [3.5, 4], [3.5, 4], BROWN), patch('R', 4, [3, 3.5], [3.5, 4], BROWN),
      ...hbox([4, 3.5, 3], [1, 0.5, 0.5], SKIN), ...hbox([4.5, 3.5, 3.5], [0.5, 0.5, 0.5], SKIN), ...hbox([4.5, 3.5, 4], [0.5, 0.5, 0.5], INK)]),
    ...hbox([1, 4, 0], [4, 1, 2], STONE),
    ...fromSize(2, [patch('L', 5, [2, 2.5], [1.5, 2], CRACK), patch('L', 5, [2.5, 3], [1, 1.5], CRACK), patch('L', 5, [2.5, 3], [0.5, 1], CRACK), patch('L', 5, [3, 3.5], [0, 0.5], CRACK)]),
    ...hbox([6, 3, 0], [1, 1, 1], STONE), // and another
  ],
  // A domed cap, white spots all round it and on top, on a cream stem.
  // From 2×: gills under the cap, a ring on the stem, grass at its foot, and smaller spots.
  mushroom: () => [
    ...fromSize(2, [...hbox([3.5, 1.5, 0], [0.5, 0.5, 0.5], LIME), ...hbox([1.5, 3, 0], [0.5, 0.5, 1], GREEN)]), // grass behind
    ...belowSize(2, hbox([2, 2, 0], [2, 2, 3], CREAM)),
    ...fromSize(2, [
      ...hbox([2, 2, 0], [2, 2, 1.5], CREAM),
      ...hbox([1.5, 4, 0], [0.5, 0.5, 1], GREEN), ...hbox([2, 4.5, 0], [0.5, 0.5, 0.5], LIME), // and in front
      ...hbox([4, 3, 0], [0.5, 0.5, 1], GREEN), ...hbox([4.5, 2.5, 0], [0.5, 0.5, 0.5], LIME),
      ...hbox([1.5, 1.5, 1.5], [3, 3, 0.5], WHITE), // the ring
      ...hbox([2, 2, 2], [2, 2, 0.5], CREAM),
      ...hbox([0, 0, 2.5], [6, 6, 0.5], GILL), // the gills
      ...sides(0, 0, 6, 6).flatMap(([s, at]) => [0.5, 1.5, 2.5, 3.5, 4.5, 5.5].map((a) => patch(s, at, [a, a + 0.5], [2.5, 3], GILLINE)))]),
    ...hbox([0, 0, 3], [6, 6, 2], RED),
    patch('l', 0, [1, 2], [4, 5], WHITE), patch('l', 0, [4, 5], [3, 4], WHITE), patch('r', 0, [2, 3], [3, 4], WHITE), patch('r', 0, [4, 5], [4, 5], WHITE),
    patch('L', 6, [1, 2], [3, 4], WHITE), patch('L', 6, [4, 5], [4, 5], WHITE), patch('R', 6, [1, 2], [4, 5], WHITE), patch('R', 6, [4, 5], [3, 4], WHITE),
    ...fromSize(2, [
      patch('l', 0, [2.5, 3], [3.5, 4], WHITE), patch('l', 0, [5, 5.5], [4.5, 5], WHITE), patch('r', 0, [0.5, 1], [3.5, 4], WHITE), patch('r', 0, [3.5, 4], [4.5, 5], WHITE),
      patch('L', 6, [3, 3.5], [3.5, 4], WHITE), patch('L', 6, [0.5, 1], [4.5, 5], WHITE), patch('R', 6, [2.5, 3], [3.5, 4], WHITE), patch('R', 6, [5, 5.5], [4.5, 5], WHITE),
      top(5, [0.5, 1], [2, 2.5], WHITE), top(5, [5, 5.5], [3.5, 4], WHITE), top(5, [2.5, 3], [5, 5.5], WHITE)]),
    ...hbox([1, 1, 5], [4, 4, 1], RED), ...fromSize(1, [top(6, [1, 2], [3, 4], WHITE), top(6, [3, 4], [1, 2], WHITE)]),
    ...fromSize(2, [top(6, [4, 4.5], [1.5, 2], WHITE), top(6, [1.5, 2], [1, 1.5], WHITE)]),
    ...hbox([2, 2, 6], [2, 2, 1], RED), ...fromSize(1, [top(7, [3, 4], [3, 4], WHITE)]), ...fromSize(2, [top(7, [2, 2.5], [2.5, 3], WHITE)]),
  ],
  // Three tiers, each a skirt and a step in, cones hanging all round.
  // From 2×: bark, needles along each skirt, scales on the cones, fallen cones and a toadstool under the branches.
  pine: () => {
    const cones1 = [['l', 0, 2], ['r', 0, 2], ['R', 5, 1], ['L', 5, 3]], cones2 = [['l', 0, 3], ['r', 0, 1], ['R', 5, 3], ['L', 5, 1]];
    const cones = (cs, z) => [
      ...fromSize(1, cs.map(([s, at, a]) => patch(s, at, [a, a + 1], [z, z + 1], BROWN))),
      ...fromSize(2, cs.flatMap(([s, at, a]) => [patch(s, at, [a, a + 0.5], [z + 0.5, z + 1], TAN), patch(s, at, [a + 0.5, a + 1], [z, z + 0.5], TAN)])),
      // needles: a fringe along the skirt's foot, clear of the cones
      ...fromSize(2, cs.flatMap(([s, at, c]) => [0.5, 1.5, 2.5, 3.5, 4.5].filter((a) => a < c || a >= c + 1).map((a) => patch(s, at, [a, a + 0.5], [z, z + 0.5], NEEDLE))))];
    return [
      ...hbox([2, 2, 0], [1, 1, 3], BROWN),
      ...fromSize(2, [patch('L', 3, [2, 2.5], [0, 1.5], BARK), patch('R', 3, [2.5, 3], [1, 2.5], BARK), patch('l', 2, [2.5, 3], [0.5, 2], BARK), patch('r', 2, [2, 2.5], [0.5, 2], BARK)]),
      ...fromSize(2, [ // under the branches: fallen cones and a toadstool
        ...hbox([3.5, 2, 0], [0.5, 1, 0.5], BROWN), top(0.5, [3.5, 4], [2, 2.5], TAN),
        ...hbox([3, 3.5, 0], [1, 0.5, 0.5], BROWN), top(0.5, [3.5, 4], [3.5, 4], TAN),
        ...hbox([4.5, 4.5, 0], [0.5, 0.5, 1], CREAM), ...hbox([4, 4, 1], [1.5, 1.5, 0.5], RED), top(1.5, [4.5, 5], [4.5, 5], WHITE)]),
      ...hbox([0, 0, 3], [5, 5, 1], PINE), ...cones(cones1, 3),
      ...hbox([1, 1, 4], [3, 3, 1], PINE),
      ...hbox([0, 0, 5], [5, 5, 1], PINE), ...cones(cones2, 5),
      ...hbox([1, 1, 6], [3, 3, 1], PINE),
      ...hbox([1, 1, 7], [3, 3, 1], PINE),
      ...hbox([2, 2, 8], [1, 1, 2], PINE), ...fromSize(2, [top(10, [2, 2.5], [2, 2.5], LIME)]),
    ];
  },
  // A rounded bush, berries and flowers all round.
  // From 2×: flowers with petals, shine on the berries, leafy flecks, and a ladybird on top.
  bush: () => {
    const berry = (s, at, a, z) => [...fromSize(1, [patch(s, at, [a, a + 1], [z, z + 1], RED)]), ...fromSize(2, [patch(s, at, [a, a + 0.5], [z + 0.5, z + 1], WHITE)])];
    return [
      ...hbox([1, 0, 0], [5, 1, 2], GREEN), ...berry('l', 0, 2, 1), ...at1([patch('l', 0, [4, 5], [0, 1], PINK)]), ...flower('l', 0, 4, 0, PINK, YELLOW),
      ...hbox([0, 1, 0], [7, 3, 2], GREEN), ...berry('r', 0, 2, 0), ...berry('R', 7, 2, 1), ...berry('L', 4, 6, 1),
      ...fromSize(1, [patch('L', 4, [0, 1], [0, 1], PINK)]), ...fromSize(2, [patch('L', 4, [0.5, 1], [0.5, 1], YELLOW), patch('R', 7, [3, 3.5], [0, 0.5], LIME), patch('r', 0, [3, 3.5], [1.5, 2], LIME)]),
      ...hbox([1, 1, 2], [5, 3, 1], GREEN), ...at1([top(3, [3, 4], [1, 2], PINK)]), ...topFlower(3, 3, 1, PINK, YELLOW), ...fromSize(2, [top(3, [5, 5.5], [1, 1.5], LIME)]),
      ...hbox([1, 1, 3], [2, 2, 1], GREEN), ...fromSize(1, [top(4, [1, 2], [2, 3], RED)]), ...fromSize(2, [top(4, [1, 1.5], [2, 2.5], WHITE), top(4, [2, 2.5], [1, 1.5], LIME)]),
      ...hbox([1, 4, 0], [5, 1, 2], GREEN), ...berry('L', 5, 2, 1), ...at1([patch('L', 5, [4, 5], [0, 1], YELLOW)]), ...flower('L', 5, 4, 0, YELLOW, ORANGE),
      ...fromSize(2, [patch('L', 5, [3.5, 4], [1.5, 2], LIME), top(2, [2, 2.5], [4.5, 5], LIME)]),
      ...fromSize(2, [ // a ladybird
        ...hbox([1, 3, 3], [0.5, 1, 0.5], INK), ...hbox([1.5, 3, 3], [1, 1, 0.5], RED), top(3.5, [1.5, 2], [3, 3.5], INK), top(3.5, [2, 2.5], [3.5, 4], INK)]),
      ...hbox([4, 2, 3], [2, 2, 1], GREEN), ...at1([top(4, [4, 5], [2, 3], YELLOW)]), ...topFlower(4, 4, 2, YELLOW, ORANGE),
    ];
  },
  // Stepped round from every side: widest at its middle, corners rounded above and below;
  // a stem in a dimple between the shoulders, and a leaf. From 2×: a shine, a veined leaf,
  // and a worm peeping out. Below 1×: no dimple.
  apple: () => [
    ...hbox([2, 2, 0], [3, 3, 1], RED),
    ...hbox([1, 1, 1], [5, 5, 1], RED),
    ...hbox([1, 0, 2], [5, 1, 1], RED), ...hbox([0, 1, 2], [7, 5, 1], RED), ...hbox([1, 6, 2], [5, 1, 1], RED),
    ...hbox([0, 0, 3], [7, 7, 2], RED), ...fromSize(2, [patch('L', 7, [3, 4.5], [3, 4], INK)]), // the worm's hole
    ...hbox([1, 0, 5], [5, 1, 1], RED), ...hbox([0, 1, 5], [7, 5, 1], RED), ...hbox([1, 6, 5], [5, 1, 1], RED),
    ...fromSize(1, [...hbox([1, 1, 6], [5, 1, 1], RED), ...hbox([1, 2, 6], [1, 3, 1], RED)]), // the shoulders, round the dimple
    ...fromSize(2, [top(7, [1.5, 2], [2.5, 4], WHITE)]), // a shine
    ...fromSize(1, [
      ...hbox([3, 3, 6], [1, 1, 3], BROWN), // the stem
      ...hbox([5, 2, 6], [1, 3, 1], RED), ...hbox([1, 5, 6], [5, 1, 1], RED)]),
    ...fromSize(2, [top(7, [2, 2.5], [5, 5.5], WHITE)]),
    ...belowSize(1, [...hbox([1, 1, 6], [5, 5, 1], RED), ...hbox([3, 3, 7], [1, 1, 2], BROWN)]),
    ...belowSize(2, hbox([4, 3, 8], [2, 1, 1], GREEN)), // a leaf
    ...fromSize(2, [...hbox([4, 2.5, 8], [2, 1.5, 0.5], GREEN), top(8.5, [4.5, 6], [3, 3.5], LIME)]),
    ...fromSize(2, [ // a worm
      ...hbox([3, 7, 3.5], [0.5, 0.5, 0.5], HOG), ...hbox([3, 7.5, 3.5], [0.5, 0.5, 0.5], HOG),
      ...hbox([3, 7.5, 4], [0.5, 0.5, 0.5], HOG), ...hbox([3, 7.5, 4.5], [0.5, 0.5, 0.5], PINK)]),
  ],
  // Three tiers and a cherry; icing dripping down every side, sprinkles on the ledges.
  // From 2×: finer sprinkles, four striped candles, the cherry's stem and shine.
  cake: () => {
    const candle = (x, y, color) => [...hbox([x, y, 7], [0.5, 0.5, 1.5], color),
      ...sides(x, y, x + 0.5, y + 0.5).map(([s, at]) => patch(s, at, s === 'L' || s === 'l' ? [x, x + 0.5] : [y, y + 0.5], [7.5, 8], WHITE)),
      ...hbox([x, y, 8.5], [0.5, 0.5, 0.5], ORANGE), top(9, [x, x + 0.5], [y, y + 0.5], YELLOW)];
    return [
      ...hbox([0, 0, 0], [7, 7, 3], FROSTING), ...drips(0, 7, 3, [[1, 2, 1], [3, 4, 2], [5, 6, 1]], PINK),
      ...at1([top(3, [0, 1], [2, 3], YELLOW), top(3, [3, 4], [6, 7], SKY), top(3, [6, 7], [4, 5], YELLOW), top(3, [2, 3], [0, 1], SKY), top(3, [6, 7], [0, 1], TEAL), top(3, [0, 1], [6, 7], TEAL)]),
      ...fromSize(2, [
        top(3, [1, 2], [0.5, 1], YELLOW), top(3, [3.5, 4], [0, 1], SKY), top(3, [5, 6], [0, 0.5], TEAL),
        top(3, [1.5, 2], [6, 7], TEAL), top(3, [3, 4], [6.5, 7], YELLOW), top(3, [5, 5.5], [6, 7], LIME),
        top(3, [0, 0.5], [2, 3], SKY), top(3, [0.5, 1], [4, 5], YELLOW), top(3, [6.5, 7], [2, 3], LIME), top(3, [6, 6.5], [4.5, 5.5], SKY), top(3, [6, 7], [6, 6.5], WHITE)]),
      ...hbox([1, 1, 3], [5, 5, 2], CREAM), ...drips(1, 6, 5, [[2, 3, 1], [4, 5, 1]], FROSTING),
      ...at1([top(5, [1, 2], [4, 5], TEAL), top(5, [5, 6], [2, 3], YELLOW), top(5, [3, 4], [1, 2], SKY), top(5, [2, 3], [5, 6], YELLOW)]),
      ...fromSize(2, [top(5, [2, 3], [1, 1.5], LIME), top(5, [4, 4.5], [1, 2], YELLOW), top(5, [1, 1.5], [3, 4], TEAL), top(5, [5.5, 6], [2.5, 3.5], SKY), top(5, [3, 4], [5.5, 6], YELLOW), top(5, [2, 2.5], [5, 6], SKY)]),
      ...hbox([2, 2, 5], [3, 3, 2], FROSTING), ...drips(2, 5, 7, [[3, 4, 1]], PINK),
      ...fromSize(2, [top(7, [2, 2.5], [2, 3], LIME), top(7, [3.5, 4], [4.5, 5], YELLOW), top(7, [4.5, 5], [4, 4.5], SKY), ...candle(2, 3.5, SKY), ...candle(3.5, 2, YELLOW)]),
      ...hbox([3, 3, 7], [1, 1, 1], RED), ...cherryDetail(3, 3, 7), // a cherry
      ...fromSize(2, [...candle(4.5, 3, LIME), ...candle(3, 4.5, TEAL)]),
    ];
  },
  // A waffle cone, a scoop dripping over its edge, sprinkles all round and a cherry.
  // From 2×: the waffle's grid, finer sprinkles, a wafer, the cherry's stem and shine.
  // Below 1×: a plain cone, no sprinkles.
  icecream: () => {
    const SPR = [YELLOW, SKY, LIME, WHITE, TEAL];
    const spr = (s, at, k, rods) => fromSize(2, rods.map(([a, z], i) => patch(s, at, a, z, SPR[(i + k) % SPR.length])));
    const arm = { A: [[0.5, 1], [6, 7]] }, full = [[[2, 3], [7.5, 8]], [[-0.5, 0], [7, 8]], [[3, 4], [7, 7.5]]], arm8 = [[[1.5, 2], [8, 9]]];
    return [
      ...hbox([1, -1, 4], [1, 1, 2], PINK), ...hbox([-1, 1, 5], [1, 1, 1], PINK), // drips at the back, hanging from the scoop
      ...hbox([1, 1, 0], [1, 1, 2], SAND), ...fromSize(2, sides(1, 1, 2, 2).map(([s, at]) => patch(s, at, [1, 2], [1, 1.5], GOLD))),
      ...hbox([0, 0, 2], [3, 3, 4], SAND),
      ...at1(sides(0, 0, 3, 3).flatMap(([s, at]) => [ // the waffle
        patch(s, at, [0, 1], [2, 3], GOLD), patch(s, at, [2, 3], [2, 3], GOLD), patch(s, at, [1, 2], [3, 4], GOLD),
        patch(s, at, [0, 1], [4, 5], GOLD), patch(s, at, [2, 3], [4, 5], GOLD)])),
      ...fromSize(2, sides(0, 0, 3, 3).flatMap(([s, at]) => [ // its grid, clear of the drips
        patch(s, at, [0.5, 1], [2, 6], GOLD), patch(s, at, [2, 2.5], [2, 6], GOLD), patch(s, at, [0, 3], [3, 3.5], GOLD),
        ...(s === 'L' || s === 'l' ? [patch(s, at, [0, 1], [4.5, 5], GOLD), patch(s, at, [2, 3], [4.5, 5], GOLD)] : [patch(s, at, [0, 3], [4.5, 5], GOLD)])])),
      ...hbox([1, 3, 4], [1, 1, 2], PINK), ...hbox([3, 1, 5], [1, 1, 1], PINK), // and in front
      ...hbox([0, -1, 6], [3, 1, 1], PINK), ...spr('l', -1, 0, [arm.A]),
      ...hbox([-1, 0, 6], [5, 3, 1], PINK), ...spr('R', 4, 1, [arm.A]), ...spr('r', -1, 2, [arm.A]),
      ...hbox([0, 3, 6], [3, 1, 1], PINK), ...spr('L', 4, 3, [arm.A]), // the scoop, rounded
      ...hbox([-1, -1, 7], [5, 5, 1], PINK),
      ...at1([patch('l', -1, [2, 3], [7, 8], SKY), patch('r', -1, [-1, 0], [7, 8], YELLOW), patch('L', 4, [2, 3], [7, 8], YELLOW), patch('R', 4, [0, 1], [7, 8], LIME)]),
      ...sides(-1, -1, 4, 4).flatMap(([s, at], k) => spr(s, at, k + 1, full)),
      ...hbox([0, -1, 8], [3, 1, 1], PINK), ...at1([patch('l', -1, [0, 1], [8, 9], YELLOW)]), ...spr('l', -1, 2, arm8),
      ...hbox([-1, 0, 8], [5, 3, 1], PINK), ...at1([patch('r', -1, [1, 2], [8, 9], LIME), patch('R', 4, [2, 3], [8, 9], SKY)]), ...spr('r', -1, 3, arm8), ...spr('R', 4, 4, arm8),
      ...hbox([0, 3, 8], [3, 1, 1], PINK), ...at1([patch('L', 4, [0, 1], [8, 9], SKY)]), ...spr('L', 4, 0, arm8),
      ...at1([top(9, [-1, 0], [1, 2], YELLOW), top(9, [3, 4], [0, 1], LIME), top(9, [1, 2], [3, 4], SKY)]),
      ...fromSize(2, [top(9, [0.5, 1.5], [-0.5, 0], YELLOW), top(9, [3, 3.5], [1, 2], LIME), top(9, [1.5, 2.5], [3.5, 4], SKY), top(9, [-1, -0.5], [1.5, 2.5], WHITE)]),
      ...hbox([0, 0, 9], [3, 3, 1], PINK), ...at1([top(10, [0, 1], [2, 3], SKY), top(10, [2, 3], [0, 1], YELLOW)]),
      ...fromSize(2, [top(10, [0, 0.5], [0.5, 1.5], YELLOW), top(10, [2, 3], [2.5, 3], LIME), top(10, [0.5, 1], [2, 3], SKY), top(10, [2.5, 3], [1, 2], WHITE),
        ...hbox([1.5, 0, 10], [1.5, 0.5, 2], SAND), // a wafer
        patch('L', 0.5, [2, 2.5], [10, 12], GOLD), patch('L', 0.5, [1.5, 3], [11, 11.5], GOLD), patch('l', 0, [2, 2.5], [10, 12], GOLD), patch('l', 0, [1.5, 3], [11, 11.5], GOLD)]),
      ...hbox([1, 1, 10], [1, 1, 1], RED), ...cherryDetail(1, 1, 10),
    ];
  },
  // A striped wrapper, a swirl of frosting, sprinkles all round and a cherry.
  // From 2×: a pleated liner, finer sprinkles, the cherry's stem and shine.
  cupcake: () => [
    ...hbox([1, 1, 0], [3, 3, 1], TEAL), ...fromSize(2, sides(1, 1, 4, 4).flatMap(([s, at]) => [1.5, 2.5, 3.5].map((a) => patch(s, at, [a, a + 0.5], [0, 1], SKY)))),
    ...hbox([0, 0, 1], [5, 5, 2], TEAL),
    ...belowSize(2, sides(0, 0, 5, 5).flatMap(([s, at]) => [patch(s, at, [1, 2], [1, 3], SKY), patch(s, at, [3, 4], [1, 3], SKY)])),
    ...fromSize(2, sides(0, 0, 5, 5).flatMap(([s, at]) => [0.5, 1.5, 2.5, 3.5, 4.5].map((a) => patch(s, at, [a, a + 0.5], [1, 3], SKY)))),
    ...hbox([0, 0, 3], [5, 5, 1], FROSTING),
    ...at1([patch('L', 5, [1, 2], [3, 4], YELLOW), patch('R', 5, [3, 4], [3, 4], SKY), patch('l', 0, [2, 3], [3, 4], LIME), patch('r', 0, [1, 2], [3, 4], YELLOW)]),
    ...fromSize(2, sides(0, 0, 5, 5).flatMap(([s, at], k) => [
      patch(s, at, [1, 2], [3.5, 4], [YELLOW, SKY, LIME, TEAL][k]), patch(s, at, [3, 3.5], [3, 4], [SKY, LIME, TEAL, YELLOW][k]), patch(s, at, [4.5, 5], [3, 3.5], [LIME, YELLOW, SKY, WHITE][k])])),
    ...at1([top(4, [0, 1], [3, 4], SKY), top(4, [4, 5], [1, 2], YELLOW)]),
    ...fromSize(2, [top(4, [0.5, 1], [1.5, 2.5], YELLOW), top(4, [4, 4.5], [2, 3], SKY), top(4, [2, 3], [4.5, 5], LIME), top(4, [1.5, 2], [0, 1], TEAL)]),
    ...hbox([1, 1, 4], [3, 3, 1], FROSTING), ...at1([top(5, [1, 2], [3, 4], LIME)]), ...fromSize(2, [top(5, [1, 1.5], [1.5, 2.5], SKY), top(5, [2.5, 3.5], [3.5, 4], YELLOW)]),
    ...hbox([2, 1, 5], [2, 2, 1], FROSTING), ...fromSize(2, [top(6, [3.5, 4], [1, 1.5], LIME)]),
    ...hbox([2, 2, 6], [1, 1, 1], RED), ...cherryDetail(2, 2, 6),
  ],
  // Rounder at the shoulder, ridged all round, a leafy top.
  // From 2×: fine rings for ridges, root hairs, and new fronds in the leaves.
  carrot: () => {
    const rings = (bx, rs) => fromSize(2, bx.flatMap(([s, at]) => rs.map(([a, z]) => patch(s, at, a, z, FOX))));
    return [
      ...hbox([1, 1, 0], [1, 1, 2], ORANGE), ...rings(sides(1, 1, 2, 2), [[[1, 2], [1, 1.5]]]),
      ...fromSize(2, [...hbox([2, 1.5, 0.5], [0.5, 0.5, 0.5], ORANGE), ...hbox([1, -0.5, 3], [0.5, 0.5, 0.5], ORANGE), ...hbox([-0.5, 2, 4], [0.5, 0.5, 0.5], ORANGE)]), // root hairs
      ...hbox([0, 0, 2], [3, 3, 3], ORANGE),
      ...at1(sides(0, 0, 3, 3).flatMap(([s, at]) => [patch(s, at, [0, 1], [2, 3], FOX), patch(s, at, [2, 3], [3, 4], FOX)])),
      ...rings(sides(0, 0, 3, 3), [[[0, 2], [2.5, 3]], [[1, 3], [3.5, 4]], [[0, 1.5], [4.5, 5]]]),
      ...fromSize(2, [...hbox([3, 1, 3], [0.5, 0.5, 0.5], ORANGE), ...hbox([2, 3, 4], [0.5, 0.5, 0.5], ORANGE)]),
      ...hbox([0, -1, 5], [3, 1, 2], ORANGE), ...at1([patch('l', -1, [1, 2], [5, 6], FOX)]), ...rings([['l', -1]], [[[0.5, 2.5], [5.5, 6]], [[1.5, 3], [6.5, 7]]]),
      ...hbox([-1, 0, 5], [5, 3, 2], ORANGE), ...at1([patch('r', -1, [0, 1], [5, 6], FOX), patch('R', 4, [1, 2], [6, 7], FOX), patch('L', 3, [-1, 0], [5, 6], FOX)]),
      ...rings([['r', -1], ['R', 4]], [[[0.5, 2.5], [5.5, 6]], [[0, 1.5], [6.5, 7]]]),
      ...hbox([0, 3, 5], [3, 1, 2], ORANGE), ...at1([patch('L', 4, [1, 2], [6, 7], FOX)]), ...rings([['L', 4]], [[[0.5, 2.5], [5.5, 6]], [[1.5, 3], [6.5, 7]]]),
      ...hbox([1, 0, 8], [1, 1, 1], LIME), ...fromSize(2, [top(9, [1, 1.5], [0, 0.5], GREEN)]),
      ...hbox([0, 1, 8], [1, 1, 2], GREEN), ...fromSize(2, hbox([0, 1, 10], [0.5, 0.5, 0.5], LIME)),
      ...hbox([1, 1, 7], [1, 1, 3], GREEN), ...fromSize(2, hbox([1.5, 1, 10], [0.5, 0.5, 1], LIME)),
      ...hbox([2, 1, 8], [1, 1, 1], LIME), ...fromSize(2, [top(9, [2.5, 3], [1.5, 2], GREEN)]),
      ...hbox([1, 2, 8], [1, 1, 2], LIME), ...fromSize(2, hbox([1.5, 2.5, 10], [0.5, 0.5, 0.5], GREEN)),
    ];
  },
};
