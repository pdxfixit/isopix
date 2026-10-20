// The buildings, the castle, the person and the weather: box stamps as 3D models (web/engine/stampmodels.js has the rest and
// explains the model). Redrawn 2026-10-19 richer in 3D, something on every side, and
// with detail by size: parts in fromSize(2, …) show from twice the size up (quarter
// units allowed), fromSize(1, …) hides specks below the stamp's own size and
// belowSize(1, …) is a plainer stand-in when small (owner: "less detail on the smaller
// version and more detail on the large versions"). Back to front, no boxes overlapping,
// so every size paints the same as it draws by depth (test/stampmodels.test.mjs).
import { COLORS, box, hbox, face, patch, top, fromSize, belowSize } from '../stampart.js';
const { BLUE, TEAL, YELLOW, RED, GREEN, BROWN, STONE, SKY, INK, SKIN, NAVY, RAIN, CLOUD, PINE, SAND, WHITE, PINK, ORANGE, LIME } = COLORS;
// The House's own: warm salmon walls, a dark roof, a brick chimney (owner, "emulate simpsons").
const WALLS = '#f4a582', ROOF = '#5b4a4f', BRICK = '#b5523b', SHINGLE = '#463840', JOINT = '#868c92', MOUTH = '#a83232', FRAME = '#c3c8cc', ROOFRED = '#c1272d', PLANK = '#6b4423';

// Darker stones over a wall face (half units; side and plane as for patch), one
// course every half unit, staggered, about one in three, clear of the features in
// avoid ([a0, a1, z0, z1] each). Shown from 2×.
function stones(side, at, [a0, a1], [z0, z1], avoid = [], seed = 1) {
  const out = [];
  for (let z = z0 + 0.5, row = 0; z + 0.5 <= z1; z += 1, row++) {
    for (let a = a0 + (row % 2 ? 0.5 : 0); a + 1 <= a1; a += 1) {
      const n = ((Math.round(a * 2) * 73856093) ^ (Math.round(z * 2) * 19349663) ^ (seed * 83492791)) >>> 0;
      if (n % 3) continue;
      if (avoid.some(([b0, b1, c0, c1]) => a < b1 + 0.5 && a + 1 > b0 - 0.5 && z < c1 + 0.5 && z + 0.5 > c0 - 0.5)) continue;
      out.push(patch(side, at, [a, a + 1], [z, z + 0.5], JOINT));
    }
  }
  return out;
}
// A row of darker tiles round the foot of a tower's red cap (2 by 2, z 7 to 8).
const tiles = (x, y) => [patch('L', y + 2, [x, x + 2], [7, 7.5], ROOFRED), patch('R', x + 2, [y, y + 2], [7, 7.5], ROOFRED),
  patch('l', y, [x, x + 2], [7, 7.5], ROOFRED), patch('r', x, [y, y + 2], [7, 7.5], ROOFRED)];
// A light stone frame round a window or door, a quarter unit wide.
const frame = (side, at, [a0, a1], [z0, z1]) => patch(side, at, [a0 - 0.5, a1 + 0.5], [Math.max(0, z0 - 0.5), z1 + 0.5], FRAME);

// Detail by size: D shows from 2× up (it may use quarter units, .5 in half units),
// S from 1× up (specks that would be noise smaller), B only below 1× (a plainer stand-in).
const D = (...faces) => fromSize(2, faces.flat(Infinity));
const S = (...faces) => fromSize(1, faces.flat(Infinity));
const B = (...faces) => belowSize(1, faces.flat(Infinity));

// A band of the House's hipped roof, t0 to t1 up from the eaves (half units): its
// eaves run x 1 to 8, y 3 to 7 at z 5, the ridge x 3 to 6 at y 5, z 7.
function roofBand(side, t0, t1, color = SHINGLE) {
  const at = (t) => ({
    L: [[1 + t, 7 - t], [8 - t, 7 - t]], l: [[1 + t, 3 + t], [8 - t, 3 + t]],
    R: [[8 - t, 3 + t], [8 - t, 7 - t]], r: [[1 + t, 3 + t], [1 + t, 7 - t]],
  })[side].map(([x, y]) => [x, y, 5 + t]);
  const pts = [...at(t0), ...at(t1).reverse()].filter((v, i, all) => !all.slice(0, i).some((w) => w.every((n, k) => n === v[k])));
  return face(pts.map((v) => v.map((n) => n / 2)), color, side);
}

// A lump built of columns from a height map (half units): rows run along y (back
// row first), each character a column's height from z0, '.' for none. Columns of
// the same height side by side in a row merge into one box. Back to front: rows
// by y, then x, which paints the same as it draws by depth.
const lump = (rows, color, [ox, oy, oz] = [0, 0, 0]) => rows.flatMap((row, y) => {
  const out = [];
  for (let x = 0; x < row.length;) {
    const h = row[x] === '.' ? 0 : parseInt(row[x], 36);
    let x1 = x + 1; while (x1 < row.length && row[x1] === row[x]) x1++;
    if (h) out.push(...hbox([ox + x, oy + y, oz], [x1 - x, 1, h], color));
    x = x1;
  }
  return out;
});

// Flat ground half a unit thick from a map: rows along y (back first), each
// character a color from key; runs of one character merge. Back to front.
const plot = (rows, key) => rows.flatMap((row, y) => {
  const out = [];
  for (let x = 0; x < row.length;) {
    let x1 = x + 1; while (x1 < row.length && row[x1] === row[x]) x1++;
    if (key[row[x]]) out.push(...hbox([x, y, 0], [x1 - x, 1, 1], key[row[x]]));
    x = x1;
  }
  return out;
});

// A cloud's height map: a big puff in the middle, smaller ones either side.
const PUFFS = [
  '..2222....',
  '.2446622..',
  '2446666442',
  '2446666442',
  '.24466422.',
  '..2222....',
];

// The cloud from 2× up: the same columns, the big puff's top topped with a cushion
// a quarter unit high, inset a quarter from any lower neighbour, so it is rounded. Column by column, back to front, each cushion just after its column.
const cushioned = (rows, color) => rows.flatMap((row, y) => [...row].flatMap((ch, x) => {
  const h = (i, j) => (rows[j]?.[i] && rows[j][i] !== '.' ? +rows[j][i] : 0), z = h(x, y);
  if (!z) return [];
  const x0 = x + (h(x - 1, y) < z ? 0.5 : 0), x1 = x + 1 - (h(x + 1, y) < z ? 0.5 : 0);
  const y0 = y + (h(x, y - 1) < z ? 0.5 : 0), y1 = y + 1 - (h(x, y + 1) < z ? 0.5 : 0);
  const peak = z === Math.max(...rows.flatMap((r) => [...r].map((c) => (c === '.' ? 0 : +c)))); // the big puff's top
  return [...hbox([x, y, 0], [1, 1, z], color), ...(peak && x1 > x0 && y1 > y0 ? hbox([x0, y0, z], [x1 - x0, y1 - y0, 0.5], color) : [])];
}));

export const MODELS = {
  // A pure shape, like the Cube and Pyramid.
  stairs: () => [...box([0, 0, 0], [3, 1, 1], TEAL), ...box([0, 0, 1], [2, 1, 1], TEAL), ...box([0, 0, 2], [1, 1, 1], TEAL)],
  // A cheerful suburban house, after the Simpsons': warm walls and a dark hipped
  // roof at the old roof's slope (the ridge half the depth up, so every roof edge
  // runs along a lattice line), on a plot of lawn. A chimney rises through the left
  // end's slope, away from the doors. In front, a path to the door between two
  // hedges and flowers; behind, a patio by a glass back door, with a table and a grill.
  house: () => [
    ...plot([
      'ggpppppgg',
      'ggpppppgg',
      'ggpppppgg',
      'ggggggggg', 'ggggggggg', 'ggggggggg', 'ggggggggg', // under the house
      'ggggsgggg',
      'ggggsgggg',
      'ggggsgggg',
    ], { g: GREEN, p: STONE, s: SAND }),
    ...D( // daisies in the lawn, joints in the patio's paving
      [[0.5, 1, WHITE], [8, 2, YELLOW], [0, 5, YELLOW], [8.5, 4, WHITE], [0.5, 8, WHITE], [3, 8.5, YELLOW], [7, 8, WHITE], [1, 9.5, PINK], [7.5, 9.5, WHITE], [3.5, 9.5, PINK]]
        .map(([x, y, c]) => top(1, [x, x + 0.5], [y, y + 0.5], c)),
      [3.5, 5.5].map((x) => top(1, [x, x + 0.5], [2, 3], JOINT)), top(1, [2, 7], [1.5, 2], JOINT)),
    ...S(hbox([2, 0, 1], [2, 2, 1], BROWN)), // the patio table
    ...D(hbox([2.5, 0.5, 2], [1, 1, 0.5], WHITE), // a cake on it
      hbox([4.5, 0.5, 1], [1.5, 0.5, 1], ORANGE), hbox([4.5, 0.5, 2], [0.5, 0.5, 0.5], ORANGE), hbox([5.5, 0.5, 2], [0.5, 0.5, 0.5], ORANGE), // a cat: its head and ears
      patch('l', 0.5, [4.5, 5], [1.5, 2], INK), patch('l', 0.5, [5.5, 6], [1.5, 2], INK), patch('l', 0.5, [5, 5.5], [1, 1.5], PINK)), // eyes, a nose
    ...S(hbox([6, 0, 1], [1, 1, 2], INK)), // the grill
    ...D(top(3, [6, 7], [0, 0.5], RED), hbox([4.5, 1, 1], [1.5, 1, 0.5], ORANGE), hbox([6, 1.5, 1], [0.5, 0.5, 1], ORANGE)), // a lid; the cat's body, its tail up
    ...D(hbox([1.5, 2.5, 2.5], [2, 0.5, 0.5], WHITE), hbox([0.5, 3.5, 2.5], [0.5, 3, 0.5], WHITE)), // sills behind and at the left end
    ...hbox([1, 3, 1], [7, 4, 4], WALLS),
    // Windows, white-framed from 2×: front, right end, back (and a glass door), left end.
    ...D(patch('L', 7, [3.5, 5.5], [1, 3.5], WHITE), patch('L', 7, [1.5, 3.5], [2.5, 4.5], WHITE), patch('L', 7, [5.5, 7.5], [2.5, 4.5], WHITE)),
    patch('L', 7, [4, 5], [1, 3], BROWN),
    ...S(patch('L', 7, [2, 3], [3, 4], SKY), patch('L', 7, [6, 7], [3, 4], SKY)),
    ...D(patch('L', 7, [4, 5], [2.5, 3], SKY), patch('L', 7, [4.5, 5], [1.5, 2], YELLOW), // a little window in the door, its knob
      patch('R', 8, [3.5, 6.5], [2.5, 4.5], WHITE)),
    ...S(patch('R', 8, [4, 6], [3, 4], SKY)),
    ...D(patch('l', 3, [3.5, 6.5], [1, 3.5], WHITE), patch('l', 3, [1.5, 3.5], [2.5, 4.5], WHITE)),
    ...S(patch('l', 3, [4, 6], [1, 3], SKY), patch('l', 3, [2, 3], [3, 4], SKY)),
    ...D(patch('l', 3, [5, 5.5], [1, 3], WHITE), patch('r', 1, [3.5, 6.5], [1.5, 4.5], WHITE)),
    ...S(patch('r', 1, [4, 6], [2, 4], SKY)),
    // The chimney, from the eaves up through the left end's slope: the roof, painted
    // after, covers just the part of it under the slope (seen edge on from the front).
    ...hbox([1, 4, 5], [1, 1, 3], BRICK),
    ...D(patch('L', 5, [1, 2], [7.5, 8], INK), patch('R', 2, [4, 5], [7.5, 8], INK), patch('l', 4, [1, 2], [7.5, 8], INK), patch('r', 1, [4, 5], [7.5, 8], INK),
      patch('L', 5, [1, 1.5], [6.5, 7], WALLS), patch('R', 2, [4.5, 5], [6, 6.5], WALLS), // mortar
      hbox([0, 3, 9], [1, 1, 1], CLOUD), hbox([1, 4, 8.5], [0.5, 0.5, 0.5], CLOUD)), // a puff of smoke
    face([[0.5, 3.5, 2.5], [4, 3.5, 2.5], [3, 2.5, 3.5], [1.5, 2.5, 3.5]], ROOF, 'L'),
    face([[4, 1.5, 2.5], [4, 3.5, 2.5], [3, 2.5, 3.5]], ROOF, 'R'),
    face([[0.5, 1.5, 2.5], [4, 1.5, 2.5], [3, 2.5, 3.5], [1.5, 2.5, 3.5]], ROOF, 'l'), // the back, seen when spun
    face([[0.5, 1.5, 2.5], [0.5, 3.5, 2.5], [1.5, 2.5, 3.5]], ROOF, 'r'),
    ...D(['L', 'R', 'l', 'r'].flatMap((side) => [roofBand(side, 0.5, 1), roofBand(side, 1.5, 2)]), // rows of shingles
      hbox([5, 5, 7], [0.5, 0.5, 1.5], INK), hbox([4.5, 5, 8.5], [1.5, 0.5, 0.5], INK)), // a TV aerial
    ...hbox([1, 7, 1], [3, 1, 1], PINE), ...D(hbox([4, 7, 1], [1, 0.5, 0.5], STONE)), ...hbox([5, 7, 1], [3, 1, 1], PINE), // hedges under the front windows, a doorstep between
    ...D([1.5, 3, 5.5, 7].map((x, i) => top(2, [x, x + 0.5], [7.5, 8], i % 2 ? PINK : WHITE)), // blossom on the hedges
      hbox([1.5, 7, 2.5], [2, 0.5, 0.5], WHITE), hbox([5.5, 7, 2.5], [2, 0.5, 0.5], WHITE)), // sills
    ...S(hbox([0, 9, 1], [1, 1, 1], RED), hbox([2, 9, 1], [1, 1, 1], YELLOW)), // flowers
    ...D(top(2, [0, 0.5], [9, 9.5], YELLOW), top(2, [2.5, 3], [9.5, 10], RED), // their middles
      hbox([5.5, 9.5, 1], [0.5, 0.5, 1.5], BROWN), hbox([5, 9, 2.5], [1, 1, 0.5], BLUE), patch('R', 6, [9, 9.5], [2.5, 3], RED), patch('L', 10, [5, 6], [2.5, 3], WHITE)), // a letterbox on its post
    ...S(hbox([6, 9, 1], [1, 1, 1], RED), hbox([8, 9, 1], [1, 1, 1], YELLOW)),
    ...D(top(2, [6, 6.5], [9, 9.5], YELLOW), top(2, [8.5, 9], [9.5, 10], RED)),
  ],
  // A stretch of castle wall: battlements along the outer (front) edge, a walkway
  // behind them, arrow slits in front, a door and ivy behind.
  wall: () => [
    ...D(hbox([4.5, -0.5, 1.5], [0.5, 0.5, 0.5], BROWN), hbox([4.5, -0.5, 2], [0.5, 0.5, 0.5], ORANGE), hbox([4.5, -0.5, 2.5], [0.5, 0.5, 0.5], YELLOW)), // behind: a torch
    ...hbox([0, 0, 0], [7, 2, 3], STONE),
    ...D(stones('L', 2, [0, 7], [0, 3], [[1, 2, 1, 2], [5, 6, 1, 2]], 5), stones('l', 0, [0, 7], [0, 3], [[3, 4, 0, 2], [5, 7, 0, 3]], 6),
      stones('R', 7, [0, 2], [0, 3], [], 7), stones('r', 0, [0, 2], [0, 3], [[0, 1, 0, 2]], 8),
      frame('L', 2, [1, 2], [1, 2]), frame('L', 2, [5, 6], [1, 2]), frame('l', 0, [3, 4], [0, 2]),
      [1, 3, 5].map((x) => top(3, [x, x + 0.5], [0, 1], JOINT))), // flagstones on the walkway
    ...S(patch('L', 2, [1, 2], [1, 2], INK), patch('L', 2, [5, 6], [1, 2], INK), // arrow slits
      patch('l', 0, [3, 4], [0, 2], BROWN), // behind: a door
      patch('l', 0, [5, 6], [0, 3], GREEN), patch('l', 0, [6, 7], [0, 2], GREEN), patch('r', 0, [0, 1], [0, 2], GREEN)), // ivy
    ...D(patch('l', 0, [3, 4], [1.5, 2], INK), patch('l', 0, [3, 3.5], [0.5, 1], YELLOW), // the door's arch and ring
      [[5, 5.5, 2.5], [5.5, 6, 1], [6, 6.5, 1.5], [5, 5.5, 0], [6.5, 7, 0.5]].map(([a, b, z]) => patch('l', 0, [a, b], [z, z + 0.5], LIME)), patch('r', 0, [0.5, 1], [1, 1.5], LIME)), // ivy leaves
    ...[0, 2, 4, 6].flatMap((x) => hbox([x, 1, 3], [1, 1, 1], STONE)),
    ...D(hbox([5.5, 1.5, 5], [1, 0.5, 1], RED), patch('L', 2, [5.5, 6.5], [5, 5.5], YELLOW), patch('l', 1.5, [5.5, 6.5], [5, 5.5], YELLOW), // a pennant on the end
      hbox([6.5, 1.5, 4], [0.5, 0.5, 2.5], INK)),
  ],
  // A stone tower: an overhanging crown with battlements, a stepped red roof; a
  // door and windows on every side, ivy up the back.
  tower: () => [
    ...hbox([0, 0, 0], [3, 3, 9], STONE),
    ...D(stones('L', 3, [0, 3], [0, 9], [[1, 2, 0, 2], [1, 2, 5, 6]], 1), stones('R', 3, [0, 3], [0, 9], [[1, 2, 3, 4], [1, 2, 6, 7]], 2),
      stones('l', 0, [0, 3], [0, 9], [[1, 2, 4, 5]], 3), stones('r', 0, [0, 3], [0, 9], [[0, 2, 0, 3], [1, 2, 6, 7]], 4),
      frame('L', 3, [1, 2], [0, 2]), frame('L', 3, [1, 2], [5, 6]), frame('R', 3, [1, 2], [3, 4]), frame('R', 3, [1, 2], [6, 7]), frame('l', 0, [1, 2], [4, 5]), frame('r', 0, [1, 2], [6, 7])),
    patch('L', 3, [1, 2], [0, 2], BROWN),
    ...D(patch('L', 3, [1, 2], [1.5, 2], INK), patch('L', 3, [1.5, 2], [0.5, 1], YELLOW)), // its arch and ring
    ...S(patch('L', 3, [1, 2], [5, 6], INK), patch('R', 3, [1, 2], [3, 4], INK), patch('R', 3, [1, 2], [6, 7], INK),
      patch('l', 0, [1, 2], [4, 5], INK), patch('r', 0, [1, 2], [6, 7], INK), patch('r', 0, [0, 1], [0, 3], GREEN), patch('r', 0, [1, 2], [0, 2], GREEN)), // windows, ivy
    ...D([[0, 0.5, 2.5], [0.5, 1, 1], [1, 1.5, 0], [0, 0.5, 0.5]].map(([a, b, z]) => patch('r', 0, [a, b], [z, z + 0.5], LIME))), // ivy leaves
    ...hbox([-1, -1, 9], [5, 5, 1], STONE),
    ...hbox([-1, -1, 10], [1, 1, 1], STONE),
    ...hbox([0, 0, 10], [3, 3, 1], RED),
    ...D(patch('L', 3, [0, 3], [10, 10.5], ROOFRED), patch('R', 3, [0, 3], [10, 10.5], ROOFRED), patch('l', 0, [0, 3], [10, 10.5], ROOFRED), patch('r', 0, [0, 3], [10, 10.5], ROOFRED)), // a row of tiles
    ...hbox([3, -1, 10], [1, 1, 1], STONE), ...hbox([-1, 3, 10], [1, 1, 1], STONE),
    ...hbox([1, 1, 11], [1, 1, 2], RED),
    ...D(hbox([1, 1, 13], [0.5, 0.5, 2.5], INK), hbox([1.5, 1, 14], [1.5, 0.5, 1], YELLOW), // a flagpole and its flag, a red stripe along it
      patch('L', 1.5, [1.5, 3], [14, 14.5], RED), patch('l', 1, [1.5, 3], [14, 14.5], RED), patch('R', 3, [1, 1.5], [14, 14.5], RED)),
    ...hbox([3, 3, 10], [1, 1, 1], STONE),
  ],
  // Stone piers over a stream, a plank deck, and a railing along both sides.
  bridge: () => [
    ...hbox([0, 0, 0], [2, 4, 3], STONE),
    ...D(stones('L', 4, [0, 2], [0, 3], [], 9), stones('R', 2, [0, 4], [0, 3], [], 10), stones('l', 0, [0, 2], [0, 3], [], 11), stones('r', 0, [0, 4], [0, 3], [], 12)),
    ...hbox([2, -1, 0], [6, 6, 1], BLUE), // the stream
    ...D([[2.5, 4.5], [5, 4], [3.5, 0], [6, -0.5], [6.5, 2.5]].map(([x, y]) => top(1, [x, x + 1], [y, y + 0.5], SKY)), top(1, [2.5, 3], [-0.5, 0], GREEN), // ripples, a lily pad
      hbox([4, 4, 1], [1, 1, 0.5], YELLOW), hbox([4.5, 4.5, 1.5], [0.5, 0.5, 0.5], YELLOW), hbox([5, 4.5, 1.5], [0.5, 0.5, 0.5], ORANGE)), // a duck
    ...hbox([8, 0, 0], [2, 4, 3], STONE),
    ...D(stones('L', 4, [8, 10], [0, 3], [], 13), stones('R', 10, [0, 4], [0, 3], [], 14), stones('l', 0, [8, 10], [0, 3], [], 15), stones('r', 8, [0, 4], [0, 3], [], 16)),
    ...hbox([0, 0, 3], [10, 4, 1], BROWN),
    ...D([1, 2.5, 4, 5.5, 7, 8.5].map((x) => [top(4, [x, x + 0.5], [0, 4], PLANK), patch('L', 4, [x, x + 0.5], [3, 4], PLANK), patch('l', 0, [x, x + 0.5], [3, 4], PLANK)])), // planks
    ...S([0, 3, 6, 9].flatMap((x) => hbox([x, 0, 4], [1, 1, 1], BROWN)), hbox([0, 0, 5], [10, 1, 1], BROWN)), // the back railing
    ...B(hbox([0, 0, 4], [10, 1, 2], BROWN)), // (solid, when small)
    ...D(hbox([0, 0, 6], [0.5, 0.5, 1], INK), hbox([0, 0, 7], [0.5, 0.5, 1], YELLOW), hbox([0, 0, 8], [0.5, 0.5, 0.5], INK)), // a lamp at each end
    ...S([0, 3, 6, 9].flatMap((x) => hbox([x, 3, 4], [1, 1, 1], BROWN)), hbox([0, 3, 5], [10, 1, 1], BROWN)), // the front one
    ...B(hbox([0, 3, 4], [10, 1, 2], BROWN)),
    ...D(hbox([9.5, 3.5, 6], [0.5, 0.5, 1], INK), hbox([9.5, 3.5, 7], [0.5, 0.5, 1], YELLOW), hbox([9.5, 3.5, 8], [0.5, 0.5, 0.5], INK)),
  ],
  // Facing front left (+y): shoes, legs, a shirt with sleeves, hands; a face in
  // front, hair over the top and down the back, a backpack behind.
  person: () => [
    ...hbox([0, -1, 4], [3, 1, 3], YELLOW), // the backpack
    ...D(patch('l', -1, [0.5, 2.5], [4.5, 5.5], ORANGE), patch('l', -1, [0.5, 2.5], [6, 6.5], ORANGE)), // its pocket and flap
    ...hbox([0, 0, 0], [1, 3, 1], INK), ...D(top(1, [0, 1], [2, 2.5], WHITE), patch('L', 3, [0, 1], [0, 0.5], WHITE), patch('r', 0, [0, 3], [0, 0.5], WHITE)), // a sneaker: laces, sole
    ...hbox([2, 0, 0], [1, 3, 1], INK), ...D(top(1, [2, 3], [2, 2.5], WHITE), patch('L', 3, [2, 3], [0, 0.5], WHITE), patch('R', 3, [0, 3], [0, 0.5], WHITE)),
    ...hbox([0, 0, 1], [1, 2, 2], NAVY), ...hbox([2, 0, 1], [1, 2, 2], NAVY),
    ...hbox([-1, 0, 3], [1, 2, 3], SKIN), ...hbox([-1, 0, 6], [1, 2, 1], RED), // an arm and its sleeve
    ...hbox([0, 0, 3], [3, 2, 4], RED),
    ...D(patch('L', 2, [0, 0.5], [3.5, 7], YELLOW), patch('L', 2, [2.5, 3], [3.5, 7], YELLOW), // the backpack's straps
      patch('L', 2, [0.5, 2.5], [6.5, 7], WHITE), patch('L', 2, [1.5, 2], [5.5, 6], WHITE), patch('L', 2, [1.5, 2], [4.5, 5], WHITE), // a collar, buttons
      patch('l', 0, [0, 0.5], [4, 7], YELLOW), patch('l', 0, [2.5, 3], [4, 7], YELLOW)),
    ...hbox([3, 0, 3], [1, 2, 3], SKIN), ...hbox([3, 0, 6], [1, 2, 1], RED),
    ...hbox([0, 0, 7], [3, 2, 3], SKIN), ...hbox([0, 0, 10], [3, 2, 1], BROWN),
    ...belowSize(2, [patch('L', 2, [0, 1], [8, 9], INK), patch('L', 2, [2, 3], [8, 9], INK)]), // eyes
    ...S(belowSize(2, [patch('L', 2, [1, 2], [7, 8], MOUTH)])), // a mouth
    ...D(patch('L', 2, [0.5, 1], [8.5, 9.5], INK), patch('L', 2, [2, 2.5], [8.5, 9.5], INK), // from 2×, round eyes,
      patch('L', 2, [1, 2], [7.5, 8], MOUTH), patch('L', 2, [0.5, 1], [8, 8.5], MOUTH), patch('L', 2, [2, 2.5], [8, 8.5], MOUTH), // a smile,
      patch('L', 2, [0, 0.5], [8, 8.5], PINK), patch('L', 2, [2.5, 3], [8, 8.5], PINK), // rosy cheeks
      patch('L', 2, [0, 1.5], [9.5, 10], BROWN)), // and a fringe
    ...S(patch('l', 0, [0, 3], [8, 10], BROWN), patch('R', 3, [0, 1], [8, 10], BROWN), patch('r', 0, [0, 1], [8, 10], BROWN)), // hair behind
  ],
  // Puffy lumps, highest in the middle, round from every side.
  cloud: () => [...belowSize(2, lump(PUFFS, CLOUD)), ...D(cushioned(PUFFS, CLOUD),
    // and a happy face on the big puff's front
    patch('L', 5, [4, 4.5], [5, 5.5], INK), patch('L', 5, [5.5, 6], [5, 5.5], INK),
    patch('L', 5, [4.5, 5.5], [3.5, 4], INK), patch('L', 5, [4, 4.5], [4, 4.5], INK), patch('L', 5, [5.5, 6], [4, 4.5], INK))],
  // The Castle (web/engine/stampmodels.js), as it is at 1×: a square castle, four
  // walls with battlements, a red-capped tower at each corner, a keep flying a flag;
  // in front a gateway and its drawbridge over a moat; behind a door, a banner, a hay
  // bale and a bush; ivy up the left side. From 2× up: stones in the walls, framed
  // slits, a raised portcullis, planks on the drawbridge, ripples and a lily pad,
  // a row of tiles on each cap, a stripe on the flag and a gold knob on its pole,
  // windows in the keep, twine round the hay, berries on the bush, ivy leaves.
  // Below 1×, the battlements, slits, banners and ivy go: specks when that small.
  castle: () => [
    ...hbox([1, -2, 0], [2, 2, 1], SAND), ...D(top(1, [1.5, 2], [-2, 0], BROWN), patch('l', -2, [1.5, 2], [0, 1], BROWN), patch('r', 1, [-1, -0.5], [0, 1], BROWN)), // behind: hay, tied up
    ...hbox([6, -2, 0], [2, 2, 2], GREEN), ...D(top(2, [6.5, 7], [-1.5, -1], RED), patch('R', 8, [-1.5, -1], [1, 1.5], RED), patch('l', -2, [7, 7.5], [0.5, 1], RED), patch('l', -2, [6, 6.5], [1.5, 2], RED)), // and a bush with berries
    ...hbox([0, 0, 0], [2, 2, 7], STONE), ...D(stones('l', 0, [0, 2], [0, 7], [[1, 2, 4, 5]], 25), stones('r', 0, [0, 2], [0, 7], [], 26), stones('L', 2, [0, 2], [5, 7], [], 27), stones('R', 2, [0, 2], [5, 7], [], 28)), // the back-left tower
    ...hbox([0, 0, 7], [2, 2, 1], RED), ...D(tiles(0, 0)),
    ...hbox([2, 0, 0], [4, 1, 5], STONE), ...hbox([0, 2, 0], [1, 4, 5], STONE), // the back and left walls, between the towers
    ...D(stones('l', 0, [2, 6], [0, 5], [[3, 5, 0, 2]], 21), stones('r', 0, [2, 6], [0, 5], [[2, 4, 0, 4], [5, 6, 0, 2]], 22), stones('L', 1, [2, 6], [0, 5], [], 23), stones('R', 1, [2, 6], [0, 5], [], 24)),
    ...S([2, 4].flatMap((a) => [...hbox([a, 0, 5], [1, 1, 1], STONE), ...hbox([0, a, 5], [1, 1, 1], STONE)])), // their battlements
    ...hbox([2, 2, 0], [4, 4, 9], STONE), // the keep
    ...D(stones('L', 6, [2, 6], [5, 9], [[3, 5, 6, 7]], 29), stones('R', 6, [2, 6], [5, 9], [[2, 3, 5, 8]], 30), stones('l', 2, [2, 6], [5, 9], [[3, 4, 5, 8]], 31), stones('r', 2, [2, 6], [5, 9], [[3, 5, 6, 7]], 32),
      frame('L', 6, [3.5, 4.5], [6, 7]), patch('L', 6, [3.5, 4.5], [6, 7], INK), frame('r', 2, [3.5, 4.5], [6, 7]), patch('r', 2, [3.5, 4.5], [6, 7], INK)), // windows in the keep
    ...S([[2, 2], [5, 2], [2, 5], [5, 5]].flatMap(([x, y]) => hbox([x, y, 9], [1, 1, 1], STONE))),
    ...hbox([3, 3, 9], [1, 1, 4], BROWN), ...D(hbox([3, 3, 13], [1, 1, 0.5], YELLOW)), ...hbox([4, 3, 11], [2, 1, 2], RED), // its flag, a gold knob on the pole
    ...D(patch('L', 4, [4, 6], [11.5, 12.5], YELLOW), patch('R', 6, [3, 4], [11.5, 12.5], YELLOW), patch('l', 3, [4, 6], [11.5, 12.5], YELLOW)), // and a stripe
    ...hbox([6, 0, 0], [2, 2, 7], STONE), ...D(stones('R', 8, [0, 2], [0, 7], [], 33), stones('l', 0, [6, 8], [0, 7], [[6, 7, 4, 5]], 34), stones('L', 2, [6, 8], [5, 7], [], 35)), // the back-right tower
    ...hbox([6, 0, 7], [2, 2, 1], RED), ...D(tiles(6, 0)),
    ...hbox([0, 6, 0], [2, 2, 7], STONE), ...D(stones('L', 8, [0, 2], [0, 7], [[1, 2, 4, 5]], 36), stones('r', 0, [6, 8], [0, 7], [], 37), stones('R', 2, [6, 8], [5, 7], [], 38)), // the front-left tower
    ...hbox([0, 6, 7], [2, 2, 1], RED), ...D(tiles(0, 6)),
    ...hbox([7, 2, 0], [1, 4, 5], STONE), ...hbox([2, 7, 0], [4, 1, 5], STONE), // the right and front walls
    ...D(stones('R', 8, [2, 6], [0, 5], [[3, 4, 2, 3]], 39), stones('L', 8, [2, 6], [0, 5], [[3, 5, 1, 4]], 40), stones('r', 7, [2, 6], [0, 5], [], 41), stones('l', 7, [2, 6], [0, 5], [], 42),
      frame('L', 8, [3, 5], [1, 4]), frame('L', 8, [1, 2], [4, 5]), frame('R', 8, [3, 4], [2, 3])),
    ...S([2, 4].flatMap((a) => [...hbox([7, a, 5], [1, 1, 1], STONE), ...hbox([a, 7, 5], [1, 1, 1], STONE)])),
    patch('L', 8, [3, 5], [1, 4], INK), ...S(patch('L', 8, [1, 2], [4, 5], INK)), // the open gateway, an arrow slit
    ...D([3, 4, 4.5].map((x) => patch('L', 8, [x, x + 0.5], [3, 4], JOINT)), patch('L', 8, [3, 5], [3.5, 4], JOINT)), // the portcullis, raised
    ...hbox([6, 6, 0], [2, 2, 7], STONE), ...D(stones('L', 8, [6, 8], [0, 7], [[6, 7, 4, 5]], 43), stones('R', 8, [6, 8], [0, 7], [], 44), frame('L', 8, [6, 7], [4, 5])), // the front-right tower
    ...hbox([6, 6, 7], [2, 2, 1], RED), ...D(tiles(6, 6)),
    ...S(patch('L', 8, [6, 7], [4, 5], INK)),
    ...hbox([0, 8, 0], [8, 3, 1], BLUE), // the moat
    ...D([[0.5, 9], [5.5, 10], [6, 8.5], [1, 10.5]].map(([x, y]) => top(1, [x, x + 1], [y, y + 0.5], SKY)), top(1, [7, 7.5], [9.5, 10], GREEN)), // ripples, a lily pad
    ...hbox([3, 8, 1], [2, 3, 1], BROWN), ...D([8.5, 9.5, 10.5].map((y) => top(2, [3, 5], [y, y + 0.5], PLANK)), patch('L', 11, [3.5, 4.5], [1, 2], PLANK)), // the drawbridge down over it, its planks
    ...S(patch('R', 8, [3, 4], [2, 3], INK), patch('R', 6, [2, 3], [5, 8], RED)), ...D(patch('R', 6, [2, 3], [6, 6.5], YELLOW)), // a slit on the right, a banner on the keep
    patch('l', 0, [3, 5], [0, 2], BROWN), ...S(patch('l', 2, [3, 4], [5, 8], YELLOW)), // behind: a door, a banner
    ...D(patch('l', 0, [3, 5], [1.5, 2], INK), patch('l', 0, [3.5, 4], [0.5, 1], YELLOW), patch('l', 2, [3, 4], [6, 6.5], RED)),
    ...S(patch('l', 0, [1, 2], [4, 5], INK), patch('l', 0, [6, 7], [4, 5], INK)),
    ...D(frame('l', 0, [1, 2], [4, 5]), frame('l', 0, [6, 7], [4, 5]), patch('l', 0, [1, 2], [4, 5], INK), patch('l', 0, [6, 7], [4, 5], INK)),
    ...S(patch('r', 0, [2, 3], [0, 4], GREEN), patch('r', 0, [3, 4], [1, 3], GREEN), patch('r', 0, [5, 6], [0, 2], GREEN)), // ivy
    ...D([[2, 2.5, 3], [2.5, 3, 1], [3, 3.5, 2], [3.5, 4, 1], [5.5, 6, 0.5], [2, 2.5, 0]].map(([a, b, z]) => patch('r', 0, [a, b], [z, z + 0.5], LIME))), // its leaves
  ],
  raincloud: () => [
    // Rain, slanting, under the whole cloud: drops in pairs, back to front, each with
    // a glint from 2×; below 1×, every other pair only.
    ...[[2, 1], [6, 1], [0, 3], [4, 3], [2, 5], [7, 4]].sort(([a, b], [c, d]) => a + b - c - d).flatMap(([x, y]) => {
      const small = (x === 6 && y === 1) || (x === 0 && y === 3) || (x === 2 && y === 5); // shown from 1× up
      const drop = (x, z) => [...(small ? S : (...f) => f.flat())(hbox([x, y, z], [1, 1, 1], BLUE)),
        ...D(patch('L', y + 1, [x, x + 0.5], [z + 0.5, z + 1], SKY), top(z + 1, [x, x + 0.5], [y, y + 0.5], WHITE))];
      return [...drop(x + 1, -6), ...drop(x, -3)];
    }),
    ...belowSize(2, lump(PUFFS, RAIN)), ...D(cushioned(PUFFS, RAIN)),
  ],
};
