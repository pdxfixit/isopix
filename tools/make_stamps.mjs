// Builds the starter stamps (web/stamps.js): the box models of web/engine/stampmodels.js,
// painted as drawn, and the flat pictures and letters of web/engine/stampart.js.
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
import * as ART from '../web/engine/stampart.js';
import { MODELS as M } from '../web/engine/stampmodels.js';
import { Drawing } from '../web/engine/model.js';
import { placeStamp } from '../web/engine/density.js';
import { toSVG } from '../web/engine/svg.js';
import { pack, unpack } from '../web/stamppack.js';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const { paint } = ART;

const SHAPES = [
  { id: 'cube', name: 'Cube', group: 'shapes', faces: M.cube },
  { id: 'stairs', name: 'Stairs', group: 'shapes', faces: M.stairs },
  { id: 'house', name: 'House', group: 'buildings', faces: M.house },
  { id: 'tree', name: 'Tree', group: 'nature', faces: M.tree },
  { id: 'wall', name: 'Wall', group: 'buildings', faces: M.wall },
  { id: 'pyramid', name: 'Pyramid', group: 'shapes', faces: M.pyramid },
  { id: 'flower', name: 'Flower', group: 'nature', cells: () => ART.flatCells('flower') },
  // Two lattice-aligned triangles (side 6 edges) pointing left and right: a six-point star.
  { id: 'star', name: 'Star', group: 'shapes', cells: () => ART.flatCells('star') },
  { id: 'cat', name: 'Cat', group: 'animals', faces: M.cat },
  { id: 'bunny', name: 'Bunny', group: 'animals', faces: M.bunny },
  { id: 'duck', name: 'Duck', group: 'animals', faces: M.duck },
  { id: 'fox', name: 'Fox', group: 'animals', faces: M.fox },
  { id: 'snake', name: 'Snake', group: 'animals', faces: M.snake },
  { id: 'frog', name: 'Frog', group: 'animals', faces: M.frog },
  { id: 'pig', name: 'Pig', group: 'animals', faces: M.pig },
  { id: 'dog', name: 'Dog', group: 'animals', faces: M.dog },
  { id: 'fish', name: 'Fish', group: 'animals', faces: M.fish },
  { id: 'bird', name: 'Bird', group: 'animals', faces: M.bird },
  // Nature.
  { id: 'sun', name: 'Sun', group: 'weather', cells: () => ART.flatCells('sun') },
  { id: 'cloud', name: 'Cloud', group: 'weather', faces: M.cloud },
  { id: 'rock', name: 'Rock', group: 'nature', faces: M.rock },
  { id: 'mushroom', name: 'Mushroom', group: 'nature', faces: M.mushroom },
  { id: 'pine', name: 'Pine tree', group: 'nature', faces: M.pine },
  { id: 'bush', name: 'Bush', group: 'nature', faces: M.bush },
  // Flat bands of the hexagon around the anchor, upper half only.
  { id: 'rainbow', name: 'Rainbow', group: 'weather', cells: () => ART.flatCells('rainbow') },
  { id: 'car', name: 'Car', group: 'vehicles', faces: M.car },
  { id: 'truck', name: 'Truck', group: 'vehicles', faces: M.truck },
  { id: 'train', name: 'Train', group: 'vehicles', faces: M.train },
  { id: 'boat', name: 'Boat', group: 'vehicles', faces: M.boat },
  { id: 'rocket', name: 'Rocket', group: 'vehicles', faces: M.rocket },
  { id: 'plane', name: 'Plane', group: 'vehicles', faces: M.plane },
  { id: 'apple', name: 'Apple', group: 'food', faces: M.apple },
  { id: 'cake', name: 'Cake', group: 'food', faces: M.cake },
  { id: 'icecream', name: 'Ice cream', group: 'food', faces: M.icecream },
  { id: 'cupcake', name: 'Cupcake', group: 'food', faces: M.cupcake },
  // A slice, flat, pointing right: the lattice has no level lines, so its
  // crust is the straight up-and-down side. Side 9 edges, so the corners are vertices.
  { id: 'pizza', name: 'Pizza', group: 'food', cells: () => ART.flatCells('pizza') },
  { id: 'carrot', name: 'Carrot', group: 'food', faces: M.carrot },
  { id: 'castle', name: 'Castle', group: 'buildings', faces: M.castle },
  { id: 'tower', name: 'Tower', group: 'buildings', faces: M.tower },
  { id: 'bridge', name: 'Bridge', group: 'buildings', faces: M.bridge },
  // People.
  { id: 'smiley', name: 'Smiley', group: 'people', cells: () => ART.flatCells('smiley') },
  { id: 'kid', name: 'Kid', group: 'people', cells: () => ART.flatCells('kid') },
  { id: 'person', name: 'Person', group: 'people', faces: M.person },
  { id: 'planet', name: 'Planet', group: 'space', faces: M.planet },
  { id: 'moon', name: 'Moon', group: 'space', cells: () => ART.flatCells('moon') },
  // Little six-point stars (two triangles of side 3 edges, so their points are vertices), scattered.
  { id: 'stars', name: 'Stars', group: 'space', cells: () => ART.flatCells('stars') },
  { id: 'ufo', name: 'UFO', group: 'space', faces: M.ufo },
  { id: 'raincloud', name: 'Rain cloud', group: 'weather', faces: M.raincloud },
  // Six arms along the lattice's three line families through the anchor, each with a pair of branches.
  { id: 'snowflake', name: 'Snowflake', group: 'weather', cells: () => ART.flatCells('snowflake') },
  // A flat bolt, in edges from the anchor (x right, y down); its slants come out stair-stepped.
  { id: 'lightning', name: 'Lightning', group: 'weather', cells: () => ART.flatCells('lightning') },
  // Sacred geometry.
  { id: 'seed', name: 'Seed of Life', group: 'sacred', cells: () => ART.flatCells('seed') },
  { id: 'flower-of-life', name: 'Flower of Life', group: 'sacred', cells: () => ART.flatCells('flower-of-life') },
  { id: 'fruit-of-life', name: 'Fruit of Life', group: 'sacred', cells: () => ART.flatCells('fruit-of-life') },
  // A star tetrahedron: two triangles, faceted light and dark like a solid.
  { id: 'merkaba', name: 'Merkaba', group: 'sacred', cells: () => ART.flatCells('merkaba') },
  { id: 'mandala', name: 'Mandala', group: 'sacred', cells: () => ART.flatCells('mandala') },
  // Pascal's triangle mod 2 on the lattice's own triangles: a cell is in when its row and column share no bit.
  { id: 'sierpinski', name: 'Sierpinski', group: 'sacred', cells: () => ART.flatCells('sierpinski') },
  // A cube inside a six-point star inside a hexagon: every line on the lattice.
  { id: 'star-cube', name: 'Star cube', group: 'sacred', cells: () => ART.flatCells('star-cube') },
];

// Letters and numbers: the 5×7 block font of web/engine/stampart.js, on the left wall.
SHAPES.push(
  ...[...ART.LETTERS].map((ch, i) => ({ id: `letter-${ch.toLowerCase()}`, name: ch, group: 'letters', cells: () => ART.glyphCells(ch, ART.RAINBOW[i % ART.RAINBOW.length]) })),
  ...[...ART.DIGITS].map((ch, i) => ({ id: `number-${ch}`, name: ch, group: 'numbers', cells: () => ART.glyphCells(ch, ART.RAINBOW[i % ART.RAINBOW.length]) })),
);

// The stamp: cells relative to the anchor, the vertex at the middle of its bottom.
function stampOf(cells) {
  return ART.stampFrom(cells, ART.anchorOf(cells));
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
  .map((s) => ({ id: s.id, name: s.name, group: s.group, stamp: stampOf(s.faces ? paint(ART.atSize(s.faces(), 1)) : s.cells()) }));
if (out.length !== SHAPES.length) throw new Error('a shape has no group in GROUPS');
// Packed for web/stamps.js (web/stamppack.js); unpacking must give every cell back.
const sorted = (cells) => JSON.stringify(cells.map((c) => JSON.stringify(c)).sort());
const packOf = (stamp, name) => {
  const p = pack(stamp);
  if (sorted(unpack(p).cells) !== sorted(stamp.cells)) throw new Error(`${name} does not unpack to its cells`);
  return p;
};
const packed = out.map(({ stamp, ...s }) => ({ ...s, ...packOf(stamp, s.name) }));
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
