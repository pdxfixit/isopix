// The buildings, the person and the weather: box stamps as 3D models (web/engine/stampmodels.js has the rest and
// explains the model). Redrawn 2026-10-19 to be richer in 3D, something on every side
// (owner: "make a pass across all the stamps to make them more 3d rich"), back to
// front with no boxes overlapping, so they draw the same painted or by depth.
import { COLORS, box, face, hbox, patch, top } from '../stampart.js';
const { BLUE, TEAL, YELLOW, RED, GREEN, BROWN, STONE, SKY, INK, SKIN, NAVY, RAIN, CLOUD, PINE, SAND } = COLORS;
// The House's own: warm salmon walls, a dark roof, a brick chimney (owner, "emulate simpsons").
const WALLS = '#f4a582', ROOF = '#5b4a4f', BRICK = '#b5523b';

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
    ...hbox([2, 0, 1], [2, 2, 1], BROWN), ...hbox([6, 0, 1], [1, 1, 2], INK), // a patio table, a grill
    ...hbox([1, 3, 1], [7, 4, 4], WALLS),
    patch('L', 7, [4, 5], [1, 3], BROWN), patch('L', 7, [2, 3], [3, 4], SKY), patch('L', 7, [6, 7], [3, 4], SKY), // front: door, windows
    patch('R', 8, [4, 6], [3, 4], SKY), // the right end
    patch('l', 3, [4, 6], [1, 3], SKY), patch('l', 3, [2, 3], [3, 4], SKY), // behind: a glass door to the patio, a window
    patch('r', 1, [4, 6], [2, 4], SKY), // the left end
    // The chimney, from the eaves up through the left end's slope: the roof, painted
    // after, covers just the part of it under the slope (seen edge on from the front).
    ...hbox([1, 4, 5], [1, 1, 3], BRICK),
    face([[0.5, 3.5, 2.5], [4, 3.5, 2.5], [3, 2.5, 3.5], [1.5, 2.5, 3.5]], ROOF, 'L'),
    face([[4, 1.5, 2.5], [4, 3.5, 2.5], [3, 2.5, 3.5]], ROOF, 'R'),
    face([[0.5, 1.5, 2.5], [4, 1.5, 2.5], [3, 2.5, 3.5], [1.5, 2.5, 3.5]], ROOF, 'l'), // the back, seen when spun
    face([[0.5, 1.5, 2.5], [0.5, 3.5, 2.5], [1.5, 2.5, 3.5]], ROOF, 'r'),
    ...hbox([1, 7, 1], [3, 1, 1], PINE), ...hbox([5, 7, 1], [3, 1, 1], PINE), // hedges under the front windows
    ...hbox([0, 9, 1], [1, 1, 1], RED), ...hbox([2, 9, 1], [1, 1, 1], YELLOW), ...hbox([6, 9, 1], [1, 1, 1], RED), ...hbox([8, 9, 1], [1, 1, 1], YELLOW), // flowers
  ],
  // A stretch of castle wall: battlements along the outer (front) edge, a walkway
  // behind them, arrow slits in front, a door and ivy behind.
  wall: () => [
    ...hbox([0, 0, 0], [7, 2, 3], STONE),
    patch('L', 2, [1, 2], [1, 2], INK), patch('L', 2, [5, 6], [1, 2], INK), // arrow slits
    patch('l', 0, [3, 4], [0, 2], BROWN), // behind: a door
    patch('l', 0, [5, 6], [0, 3], GREEN), patch('l', 0, [6, 7], [0, 2], GREEN), patch('r', 0, [0, 1], [0, 2], GREEN), // ivy
    ...[0, 2, 4, 6].flatMap((x) => hbox([x, 1, 3], [1, 1, 1], STONE)),
  ],
  // A stone tower: an overhanging crown with battlements, a stepped red roof; a
  // door and windows on every side, ivy up the back.
  tower: () => [
    ...hbox([0, 0, 0], [3, 3, 9], STONE),
    patch('L', 3, [1, 2], [0, 2], BROWN), patch('L', 3, [1, 2], [5, 6], INK),
    patch('R', 3, [1, 2], [3, 4], INK), patch('R', 3, [1, 2], [6, 7], INK),
    patch('l', 0, [1, 2], [4, 5], INK), patch('r', 0, [1, 2], [6, 7], INK), patch('r', 0, [0, 1], [0, 3], GREEN), patch('r', 0, [1, 2], [0, 2], GREEN),
    ...hbox([-1, -1, 9], [5, 5, 1], STONE),
    ...hbox([-1, -1, 10], [1, 1, 1], STONE),
    ...hbox([0, 0, 10], [3, 3, 1], RED),
    ...hbox([3, -1, 10], [1, 1, 1], STONE), ...hbox([-1, 3, 10], [1, 1, 1], STONE),
    ...hbox([1, 1, 11], [1, 1, 2], RED),
    ...hbox([3, 3, 10], [1, 1, 1], STONE),
  ],
  // Stone piers over a stream, a plank deck, and a railing along both sides.
  bridge: () => [
    ...hbox([0, 0, 0], [2, 4, 3], STONE),
    ...hbox([2, -1, 0], [6, 6, 1], BLUE), // the stream
    ...hbox([8, 0, 0], [2, 4, 3], STONE),
    ...hbox([0, 0, 3], [10, 4, 1], BROWN),
    ...[0, 3, 6, 9].flatMap((x) => hbox([x, 0, 4], [1, 1, 1], BROWN)), ...hbox([0, 0, 5], [10, 1, 1], BROWN), // the back railing
    ...[0, 3, 6, 9].flatMap((x) => hbox([x, 3, 4], [1, 1, 1], BROWN)), ...hbox([0, 3, 5], [10, 1, 1], BROWN), // the front one
  ],
  // Facing front left (+y): shoes, legs, a shirt with sleeves, hands; a face in
  // front, hair over the top and down the back, a backpack behind.
  person: () => [
    ...hbox([0, -1, 4], [3, 1, 3], YELLOW), // the backpack
    ...hbox([0, 0, 0], [1, 3, 1], INK), ...hbox([2, 0, 0], [1, 3, 1], INK), // shoes
    ...hbox([0, 0, 1], [1, 2, 2], NAVY), ...hbox([2, 0, 1], [1, 2, 2], NAVY),
    ...hbox([-1, 0, 3], [1, 2, 3], SKIN), ...hbox([-1, 0, 6], [1, 2, 1], RED), // an arm and its sleeve
    ...hbox([0, 0, 3], [3, 2, 4], RED),
    ...hbox([3, 0, 3], [1, 2, 3], SKIN), ...hbox([3, 0, 6], [1, 2, 1], RED),
    ...hbox([0, 0, 7], [3, 2, 3], SKIN), ...hbox([0, 0, 10], [3, 2, 1], BROWN),
    patch('L', 2, [0, 1], [8, 9], INK), patch('L', 2, [2, 3], [8, 9], INK), patch('L', 2, [1, 2], [7, 8], '#a83232'), // eyes, mouth
    patch('l', 0, [0, 3], [8, 10], BROWN), patch('R', 3, [0, 1], [8, 10], BROWN), patch('r', 0, [0, 1], [8, 10], BROWN), // hair behind
  ],
  // Puffy lumps, highest in the middle, round from every side.
  cloud: () => lump(PUFFS, CLOUD),
  raincloud: () => [
    // Rain, slanting, under the whole cloud: drops in pairs, back to front.
    ...[[2, 1], [6, 1], [0, 3], [4, 3], [2, 5], [7, 4]].sort(([a, b], [c, d]) => a + b - c - d)
      .flatMap(([x, y]) => [...hbox([x + 1, y, -6], [1, 1, 1], BLUE), ...hbox([x, y, -3], [1, 1, 1], BLUE)]),
    ...lump(PUFFS, RAIN),
  ],
};
