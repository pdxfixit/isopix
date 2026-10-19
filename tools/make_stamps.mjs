// Builds the starter stamps (web/stamps.js) from 3D shapes on the lattice.
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
import * as L from '../web/engine/lattice.js';
import * as ART from '../web/engine/stampart.js';
import { Drawing } from '../web/engine/model.js';
import { placeStamp } from '../web/engine/density.js';
import { toSVG } from '../web/engine/svg.js';
import { pack, unpack } from '../web/stamppack.js';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const { LV, face, box, hbox, paint } = ART;
const { BLUE, TEAL, YELLOW, RED, GREEN, BROWN, STONE, SAND, PINK, SKY, ORANGE, INK, WHITE, TAN, FOX, LIME, HOG, DOG, MUZZLE, GOLD, PALEGOLD, INDIGO, VIOLET, ROSE, SKIN, RAIN, MOON, PLANET, PINE, CLOUD, PURPLE, NAVY, CREAM, FROSTING } = ART.COLORS;

// A patch on a box's side: on the L side (the plane y = at) from x0 to x1, or
// the R side (x = at) from y0 to y1; z0 to z1 up. Half units.
const patch = (side, at, [a0, a1], [z0, z1], color) => face(
  (side === 'L' ? [[a0, at, z0], [a1, at, z0], [a1, at, z1], [a0, at, z1]] : [[at, a0, z0], [at, a1, z0], [at, a1, z1], [at, a0, z1]]).map((v) => v.map((n) => n / 2)),
  color, side);


const SHAPES = [
  { id: 'cube', name: 'Cube', group: 'shapes', cells: () => paint(box([0, 0, 0], [1, 1, 1], BLUE)) },
  { id: 'stairs', name: 'Stairs', group: 'shapes', cells: () => paint([...box([0, 0, 0], [3, 1, 1], TEAL), ...box([0, 0, 1], [2, 1, 1], TEAL), ...box([0, 0, 2], [1, 1, 1], TEAL)]) },
  { id: 'house', name: 'House', group: 'buildings', cells: () => paint([
    ...box([0, 0, 0], [2, 2, 1.5], YELLOW),
    // A roof sloping on all four sides at the Pyramid's slope, so its edges come out straight.
    face([[0, 2, 1.5], [2, 2, 1.5], [1, 1, 2.5]], RED, 'L'),
    face([[2, 0, 1.5], [2, 2, 1.5], [1, 1, 2.5]], RED, 'R'),
    face([[0.5, 2, 0], [1, 2, 0], [1, 2, 1], [0.5, 2, 1]], BROWN, 'L'),
    face([[2, 0.5, 0.5], [2, 1, 0.5], [2, 1, 1], [2, 0.5, 1]], SKY, 'R'),
  ]) },
  { id: 'tree', name: 'Tree', group: 'nature', cells: () => paint([...box([0.5, 0.5, 0], [0.5, 0.5, 1], BROWN), ...box([0, 0, 1], [1.5, 1.5, 1.5], GREEN), ...box([0.5, 0.5, 2.5], [0.5, 0.5, 0.5], GREEN)]) },
  { id: 'wall', name: 'Wall', group: 'buildings', cells: () => paint([...box([0, 0, 0], [3, 0.5, 1.5], STONE), ...[0, 1, 2].flatMap((x) => box([x, 0, 1.5], [0.5, 0.5, 0.5], STONE)), ...box([2.5, 0, 1.5], [0.5, 0.5, 0.5], STONE)]) },
  { id: 'pyramid', name: 'Pyramid', group: 'shapes', cells: () => paint([
    // Its peak half the base's width up, so every edge runs along a lattice line and comes out straight.
    face([[0, 2, 0], [2, 2, 0], [1, 1, 1]], SAND, 'L'),
    face([[2, 0, 0], [2, 2, 0], [1, 1, 1]], SAND, 'R'),
  ]) },
  { id: 'flower', name: 'Flower', group: 'nature', cells: () => ART.flatCells('flower') },
  // Two lattice-aligned triangles (side 6 edges) pointing left and right: a six-point star.
  { id: 'star', name: 'Star', group: 'shapes', cells: () => ART.flatCells('star') },
  // Animals, side on, facing right (+x), their profile on the lit L side.
  { id: 'cat', name: 'Cat', group: 'animals', cells: () => paint([
    ...hbox([0, 1, 2], [1, 1, 4], ORANGE), // tail, up from the rump
    ...hbox([1, 0, 0], [1, 1, 1], ORANGE), ...hbox([6, 0, 0], [1, 1, 1], ORANGE),
    ...hbox([1, 1, 0], [1, 1, 1], ORANGE), ...hbox([6, 1, 0], [1, 1, 1], ORANGE),
    ...hbox([1, 0, 1], [6, 2, 2], ORANGE),
    ...hbox([6, 0, 2], [3, 3, 3], ORANGE),
    ...hbox([6, 0, 5], [1, 1, 1], ORANGE), ...hbox([6, 2, 5], [1, 1, 1], ORANGE),
    patch('L', 3, [7, 8], [3, 4], INK),
  ]) },
  { id: 'bunny', name: 'Bunny', group: 'animals', cells: () => paint([
    ...hbox([0, 0, 0], [4, 3, 3], TAN),
    ...hbox([-1, 2, 1], [1, 1, 1], WHITE), // a puff of a tail
    ...hbox([1, 2, 0], [1, 1, 1], WHITE), ...hbox([3, 2, 0], [1, 1, 1], WHITE), // paws
    ...hbox([3, 0, 2], [3, 3, 3], TAN),
    ...hbox([3, 0, 5], [1, 1, 3], TAN), ...hbox([3, 2, 5], [1, 1, 3], TAN),
    patch('L', 3, [3, 4], [5, 8], PINK),
    patch('L', 3, [4, 5], [3, 4], INK),
    patch('R', 6, [1, 2], [3, 4], PINK),
  ]) },
  { id: 'duck', name: 'Duck', group: 'animals', cells: () => paint([
    ...hbox([0, 1, 2], [1, 1, 1], YELLOW), // tail
    ...hbox([0, 0, 0], [5, 3, 2], YELLOW),
    patch('L', 3, [1, 3], [1, 2], '#e0a800'), // wing
    ...hbox([3, 1, 2], [2, 2, 3], YELLOW),
    ...hbox([5, 1, 3], [1, 2, 1], ORANGE),
    patch('L', 3, [3, 4], [3, 4], INK),
  ]) },
  { id: 'fox', name: 'Fox', group: 'animals', cells: () => paint([
    ...hbox([-3, 0, 2], [1, 2, 2], WHITE), ...hbox([-2, 0, 2], [3, 2, 2], FOX), // a bushy tail, white at the tip
    ...hbox([1, 0, 0], [1, 1, 1], INK), ...hbox([6, 0, 0], [1, 1, 1], INK),
    ...hbox([1, 1, 0], [1, 1, 1], INK), ...hbox([6, 1, 0], [1, 1, 1], INK),
    ...hbox([1, 0, 1], [6, 2, 2], FOX),
    ...hbox([6, 0, 2], [3, 3, 3], FOX),
    ...hbox([9, 1, 2], [1, 1, 1], WHITE), patch('R', 10, [1, 2], [2, 3], INK), // the snout and its nose
    ...hbox([6, 0, 5], [1, 1, 2], FOX), ...hbox([6, 2, 5], [1, 1, 2], FOX),
    patch('L', 3, [8, 9], [2, 3], WHITE),
    patch('L', 3, [7, 8], [3, 4], INK),
  ]) },
  { id: 'snake', name: 'Snake', group: 'animals', cells: () => paint([
    ...hbox([-2, 0, 0], [2, 1, 1], LIME), // the tail, thinner
    ...hbox([0, 0, 0], [2, 2, 2], GREEN), ...hbox([2, 0, 0], [2, 2, 2], LIME), ...hbox([4, 0, 0], [2, 2, 2], GREEN),
    ...hbox([4, 2, 0], [2, 2, 2], LIME), ...hbox([4, 4, 0], [2, 2, 2], GREEN),
    ...hbox([6, 4, 0], [2, 2, 2], LIME), ...hbox([8, 4, 0], [2, 2, 2], GREEN),
    ...hbox([10, 3, 0], [3, 3, 3], GREEN),
    patch('L', 6, [11, 12], [1, 2], INK),
    patch('R', 13, [4, 5], [0, 1], RED), // the tongue
  ]) },
  { id: 'frog', name: 'Frog', group: 'animals', cells: () => paint([
    ...hbox([0, 0, 0], [5, 4, 2], GREEN),
    ...hbox([0, 4, 0], [2, 1, 1], LIME), ...hbox([4, 4, 0], [1, 1, 1], LIME), // a back leg and a front foot
    ...hbox([3, 0, 2], [1, 1, 1], WHITE), ...hbox([3, 3, 2], [1, 1, 1], WHITE),
    patch('R', 4, [0, 1], [2, 3], INK), patch('R', 4, [3, 4], [2, 3], INK),
    patch('R', 5, [0, 4], [1, 2], '#a83232'), // a wide smile
  ]) },
  { id: 'pig', name: 'Pig', group: 'animals', cells: () => paint([
    ...hbox([0, 1, 3], [1, 1, 1], HOG), // a curl of a tail
    ...hbox([1, 0, 0], [1, 1, 1], HOG), ...hbox([6, 0, 0], [1, 1, 1], HOG),
    ...hbox([1, 2, 0], [1, 1, 1], HOG), ...hbox([6, 2, 0], [1, 1, 1], HOG),
    ...hbox([1, 0, 1], [6, 3, 3], HOG),
    ...hbox([7, 0, 2], [2, 3, 3], HOG),
    ...hbox([9, 1, 2], [1, 1, 1], PINK),
    ...hbox([7, 0, 5], [1, 1, 1], PINK), ...hbox([7, 2, 5], [1, 1, 1], PINK),
    patch('L', 3, [8, 9], [3, 4], INK),
  ]) },
  { id: 'dog', name: 'Dog', group: 'animals', cells: () => paint([
    ...hbox([0, 0, 3], [1, 1, 2], DOG), // a wagging tail
    ...hbox([1, 0, 0], [1, 1, 1], DOG), ...hbox([6, 0, 0], [1, 1, 1], DOG),
    ...hbox([1, 1, 0], [1, 1, 1], DOG), ...hbox([6, 1, 0], [1, 1, 1], DOG),
    ...hbox([1, 0, 1], [6, 2, 2], DOG),
    ...hbox([6, 0, 2], [3, 3, 3], DOG),
    ...hbox([9, 1, 2], [1, 1, 2], MUZZLE), patch('R', 10, [1, 2], [3, 4], INK), // the snout and its nose
    ...hbox([6, 3, 2], [1, 1, 3], BROWN), // a floppy ear
    patch('L', 3, [7, 8], [3, 4], INK),
  ]) },
  { id: 'fish', name: 'Fish', group: 'animals', cells: () => paint([
    ...hbox([-1, 0, 0], [1, 2, 2], ORANGE), ...hbox([-1, 0, 3], [1, 2, 2], ORANGE), ...hbox([0, 0, 1], [1, 2, 3], ORANGE), // the tail
    ...hbox([2, 0, 0], [4, 2, 1], ORANGE),
    ...hbox([1, 0, 1], [6, 2, 3], ORANGE),
    ...hbox([2, 0, 4], [4, 2, 1], ORANGE),
    patch('L', 2, [2, 3], [0, 5], WHITE), patch('L', 2, [4, 5], [0, 5], WHITE), // stripes
    patch('L', 2, [5, 6], [2, 3], INK),
  ]) },
  { id: 'bird', name: 'Bird', group: 'animals', cells: () => paint([
    ...hbox([-2, 1, 3], [2, 1, 1], BLUE), // the tail
    ...hbox([1, 1, 0], [1, 1, 1], INK), ...hbox([3, 1, 0], [1, 1, 1], INK), // legs
    ...hbox([0, 0, 1], [3, 3, 3], BLUE), ...hbox([3, 0, 1], [1, 3, 2], ORANGE), // the breast
    ...hbox([3, 0, 3], [3, 3, 3], BLUE),
    ...hbox([6, 1, 4], [1, 1, 1], YELLOW),
    patch('L', 3, [0, 2], [2, 3], '#1f5fbf'), // a wing
    patch('L', 3, [4, 5], [4, 5], INK),
  ]) },
  // Nature.
  { id: 'sun', name: 'Sun', group: 'weather', cells: () => ART.flatCells('sun') },
  { id: 'cloud', name: 'Cloud', group: 'weather', cells: () => paint([
    ...hbox([0, 0, 0], [8, 4, 2], CLOUD), ...hbox([1, 0, 2], [3, 4, 2], CLOUD), ...hbox([4, 0, 2], [3, 4, 3], CLOUD),
  ]) },
  { id: 'rock', name: 'Rock', group: 'nature', cells: () => paint([
    ...hbox([0, 0, 0], [5, 4, 2], STONE), ...hbox([1, 0, 2], [3, 3, 1], STONE), ...hbox([4, 1, 0], [2, 3, 1], STONE),
  ]) },
  { id: 'mushroom', name: 'Mushroom', group: 'nature', cells: () => paint([
    ...hbox([2, 2, 0], [2, 2, 3], CREAM),
    ...hbox([0, 0, 3], [6, 6, 2], RED), ...hbox([1, 1, 5], [4, 4, 1], RED),
    patch('L', 6, [1, 2], [3, 4], WHITE), patch('L', 6, [4, 5], [4, 5], WHITE), patch('R', 6, [2, 3], [4, 5], WHITE),
  ]) },
  { id: 'pine', name: 'Pine tree', group: 'nature', cells: () => paint([
    // A trunk tall enough to show under the branches, so it is not taken for a stepped cake.
    ...hbox([2, 2, 0], [1, 1, 3], BROWN),
    ...hbox([0, 0, 3], [5, 5, 2], PINE), ...hbox([1, 1, 5], [3, 3, 2], PINE), ...hbox([2, 2, 7], [1, 1, 2], PINE),
  ]) },
  { id: 'bush', name: 'Bush', group: 'nature', cells: () => paint([
    ...hbox([0, 0, 0], [6, 4, 2], GREEN), ...hbox([1, 0, 2], [4, 4, 1], GREEN),
    patch('L', 4, [1, 2], [1, 2], RED), patch('L', 4, [4, 5], [0, 1], RED), patch('R', 6, [1, 2], [1, 2], RED), // berries
  ]) },
  // Flat bands of the hexagon around the anchor, upper half only.
  { id: 'rainbow', name: 'Rainbow', group: 'weather', cells: () => ART.flatCells('rainbow') },
  // Vehicles, side on, facing right, like the animals.
  { id: 'car', name: 'Car', group: 'vehicles', cells: () => paint([
    ...hbox([1, 0, 0], [2, 1, 1], INK), ...hbox([5, 0, 0], [2, 1, 1], INK),
    ...hbox([0, 0, 1], [8, 4, 2], RED), ...hbox([2, 0, 3], [4, 4, 2], RED),
    ...hbox([1, 3, 0], [2, 1, 1], INK), ...hbox([5, 3, 0], [2, 1, 1], INK),
    patch('L', 4, [2, 3], [3, 4], SKY), patch('L', 4, [4, 5], [3, 4], SKY), patch('R', 6, [1, 3], [3, 4], SKY),
    patch('R', 8, [0, 1], [2, 3], YELLOW), patch('R', 8, [3, 4], [2, 3], YELLOW),
  ]) },
  { id: 'truck', name: 'Truck', group: 'vehicles', cells: () => paint([
    ...hbox([1, 0, 0], [2, 1, 1], INK), ...hbox([7, 0, 0], [2, 1, 1], INK),
    ...hbox([0, 0, 1], [6, 4, 4], ORANGE), ...hbox([6, 0, 1], [3, 4, 3], BLUE),
    ...hbox([1, 3, 0], [2, 1, 1], INK), ...hbox([7, 3, 0], [2, 1, 1], INK),
    patch('L', 4, [7, 8], [3, 4], SKY), patch('R', 9, [1, 3], [3, 4], SKY),
  ]) },
  { id: 'train', name: 'Train', group: 'vehicles', cells: () => paint([
    ...hbox([1, 0, 0], [1, 1, 1], INK), ...hbox([4, 0, 0], [1, 1, 1], INK), ...hbox([6, 0, 0], [1, 1, 1], INK),
    ...hbox([0, 0, 1], [3, 3, 5], RED), ...hbox([0, 0, 6], [3, 3, 1], INK), // the cab and its roof
    ...hbox([3, 0, 1], [5, 3, 3], NAVY),
    ...hbox([6, 1, 4], [1, 1, 2], INK), // the chimney
    ...hbox([1, 2, 0], [1, 1, 1], INK), ...hbox([4, 2, 0], [1, 1, 1], INK), ...hbox([6, 2, 0], [1, 1, 1], INK),
    patch('L', 3, [1, 2], [3, 5], YELLOW), patch('R', 8, [1, 2], [2, 3], YELLOW),
  ]) },
  { id: 'boat', name: 'Boat', group: 'vehicles', cells: () => paint([
    ...hbox([0, 0, 0], [8, 3, 2], BROWN), patch('L', 3, [0, 8], [1, 2], RED),
    ...hbox([3, 1, 2], [1, 1, 6], BROWN),
    ...hbox([4, -1, 3], [1, 5, 4], WHITE), patch('R', 5, [-1, 4], [4, 5], RED), // a square sail across the boat
  ]) },
  { id: 'rocket', name: 'Rocket', group: 'vehicles', cells: () => paint([
    ...hbox([1, 1, 0], [1, 1, 2], ORANGE), // the flame
    ...hbox([1, -1, 2], [1, 1, 2], RED), ...hbox([-1, 1, 2], [1, 1, 2], RED),
    ...hbox([0, 0, 2], [3, 3, 6], WHITE),
    ...hbox([3, 1, 2], [1, 1, 2], RED), ...hbox([1, 3, 2], [1, 1, 2], RED),
    ...hbox([0, 0, 8], [3, 3, 1], RED), ...hbox([1, 1, 9], [1, 1, 1], RED),
    patch('L', 3, [1, 2], [5, 6], SKY),
  ]) },
  { id: 'plane', name: 'Plane', group: 'vehicles', cells: () => paint([
    ...hbox([3, -3, 3], [2, 4, 1], BLUE), ...hbox([0, -1, 3], [1, 2, 1], BLUE),
    ...hbox([0, 1, 2], [8, 2, 2], WHITE), ...hbox([8, 1, 2], [1, 2, 1], WHITE),
    ...hbox([0, 1, 4], [1, 1, 2], RED), // the tail fin
    ...hbox([3, 3, 3], [2, 4, 1], BLUE), ...hbox([0, 3, 3], [1, 2, 1], BLUE),
    patch('L', 3, [2, 3], [3, 4], SKY), patch('L', 3, [5, 6], [3, 4], SKY), patch('L', 3, [7, 8], [3, 4], SKY),
  ]) },
  // Food.
  { id: 'apple', name: 'Apple', group: 'food', cells: () => paint([
    ...hbox([1, 1, 0], [3, 3, 1], RED), ...hbox([0, 0, 1], [5, 5, 4], RED), ...hbox([1, 1, 5], [3, 3, 1], RED),
    ...hbox([2, 2, 6], [1, 1, 1], BROWN), ...hbox([2, 3, 6], [1, 1, 1], GREEN),
  ]) },
  // Three tiers and a cherry (the one-block Cake went, owner 2026-10-19).
  { id: 'cake', name: 'Cake', group: 'food', cells: () => paint([
    ...hbox([0, 0, 0], [7, 7, 2], FROSTING), ...hbox([1, 1, 2], [5, 5, 2], CREAM), ...hbox([2, 2, 4], [3, 3, 2], FROSTING),
    ...hbox([3, 3, 6], [1, 1, 1], RED), // a cherry
  ]) },
  { id: 'icecream', name: 'Ice cream', group: 'food', cells: () => paint([
    ...hbox([1, 1, 0], [1, 1, 2], SAND), ...hbox([0, 0, 2], [3, 3, 2], SAND),
    ...hbox([0, 0, 4], [3, 3, 1], PINK), ...hbox([-1, -1, 5], [5, 5, 3], PINK), ...hbox([0, 0, 8], [3, 3, 1], PINK),
    ...hbox([1, 1, 9], [1, 1, 1], RED),
  ]) },
  { id: 'cupcake', name: 'Cupcake', group: 'food', cells: () => paint([
    ...hbox([0, 0, 0], [5, 5, 2], TEAL), ...hbox([0, 0, 2], [5, 5, 1], FROSTING), ...hbox([1, 1, 3], [3, 3, 1], FROSTING),
    ...hbox([2, 2, 4], [1, 1, 1], RED),
    patch('L', 5, [1, 2], [2, 3], YELLOW), patch('L', 5, [3, 4], [2, 3], SKY), patch('R', 5, [2, 3], [2, 3], YELLOW), // sprinkles
  ]) },
  // A slice, flat, pointing right: the lattice has no level lines, so its
  // crust is the straight up-and-down side. Side 9 edges, so the corners are vertices.
  { id: 'pizza', name: 'Pizza', group: 'food', cells: () => ART.flatCells('pizza') },
  { id: 'carrot', name: 'Carrot', group: 'food', cells: () => paint([
    ...hbox([1, 1, 0], [1, 1, 2], ORANGE), ...hbox([0, 0, 2], [3, 3, 4], ORANGE),
    ...hbox([1, 1, 6], [1, 1, 2], GREEN), ...hbox([0, 1, 7], [1, 1, 1], GREEN), ...hbox([2, 1, 7], [1, 1, 1], GREEN),
  ]) },
  // Buildings (House and Wall above).
  { id: 'castle', name: 'Castle', group: 'buildings', cells: () => paint([
    ...hbox([0, 0, 0], [2, 3, 7], STONE),
    ...hbox([2, 0, 0], [4, 3, 5], STONE), ...hbox([2, 0, 5], [1, 3, 1], STONE), ...hbox([4, 0, 5], [1, 3, 1], STONE),
    ...hbox([6, 0, 0], [2, 3, 7], STONE),
    patch('L', 3, [3, 5], [0, 3], BROWN), // the gate
    patch('L', 3, [0, 1], [4, 5], INK), patch('L', 3, [6, 7], [4, 5], INK),
    ...hbox([7, 1, 7], [1, 1, 3], BROWN), patch('L', 2, [8, 10], [8, 10], RED), // a flag
  ]) },
  { id: 'tower', name: 'Tower', group: 'buildings', cells: () => paint([
    ...hbox([0, 0, 0], [3, 3, 9], STONE), ...hbox([0, 0, 9], [3, 3, 1], RED), ...hbox([1, 1, 10], [1, 1, 2], RED),
    patch('L', 3, [1, 2], [0, 2], BROWN), patch('L', 3, [1, 2], [6, 7], INK), patch('R', 3, [1, 2], [6, 7], INK),
  ]) },
  { id: 'bridge', name: 'Bridge', group: 'buildings', cells: () => paint([
    ...hbox([0, 0, 0], [2, 3, 3], STONE), ...hbox([8, 0, 0], [2, 3, 3], STONE),
    ...hbox([0, 0, 3], [10, 3, 1], BROWN),
    ...[0, 3, 6, 9].flatMap((x) => hbox([x, 2, 4], [1, 1, 1], BROWN)), // railing posts
  ]) },
  // People.
  { id: 'smiley', name: 'Smiley', group: 'people', cells: () => ART.flatCells('smiley') },
  { id: 'kid', name: 'Kid', group: 'people', cells: () => ART.flatCells('kid') },
  { id: 'person', name: 'Person', group: 'people', cells: () => paint([
    ...hbox([0, 0, 0], [1, 2, 3], NAVY), ...hbox([2, 0, 0], [1, 2, 3], NAVY),
    ...hbox([-1, 0, 3], [1, 2, 4], SKIN), ...hbox([0, 0, 3], [3, 2, 4], RED), ...hbox([3, 0, 3], [1, 2, 4], SKIN),
    ...hbox([0, 0, 7], [3, 2, 3], SKIN), ...hbox([0, 0, 10], [3, 2, 1], BROWN),
    patch('L', 2, [0, 1], [8, 9], INK), patch('L', 2, [2, 3], [8, 9], INK),
  ]) },
  // Space (the Rocket is in Vehicles).
  { id: 'planet', name: 'Planet', group: 'space', cells: () => paint([
    ...hbox([-1, -1, 3], [7, 1, 1], SAND), ...hbox([-1, 0, 3], [1, 5, 1], SAND), // the ring behind
    ...hbox([1, 1, 0], [3, 3, 1], PLANET), ...hbox([0, 0, 1], [5, 5, 5], PLANET), ...hbox([1, 1, 6], [3, 3, 1], PLANET),
    ...hbox([-1, 5, 3], [7, 1, 1], SAND), ...hbox([5, 0, 3], [1, 5, 1], SAND), // and in front
  ]) },
  { id: 'moon', name: 'Moon', group: 'space', cells: () => ART.flatCells('moon') },
  // Little six-point stars (two triangles of side 3 edges, so their points are vertices), scattered.
  { id: 'stars', name: 'Stars', group: 'space', cells: () => ART.flatCells('stars') },
  { id: 'ufo', name: 'UFO', group: 'space', cells: () => paint([
    ...hbox([1, 1, 0], [5, 5, 1], STONE), ...hbox([0, 0, 1], [7, 7, 1], STONE), ...hbox([2, 2, 2], [3, 3, 2], SKY),
    patch('L', 7, [1, 2], [1, 2], YELLOW), patch('L', 7, [3, 4], [1, 2], YELLOW), patch('L', 7, [5, 6], [1, 2], YELLOW),
    patch('R', 7, [1, 2], [1, 2], YELLOW), patch('R', 7, [3, 4], [1, 2], YELLOW), patch('R', 7, [5, 6], [1, 2], YELLOW),
  ]) },
  // Weather (Sun, Cloud and Rainbow above).
  { id: 'raincloud', name: 'Rain cloud', group: 'weather', cells: () => paint([
    ...[[1, 1], [4, 2], [2, 3], [5, 0]].flatMap(([x, y]) => [...hbox([x, y, -3], [1, 1, 1], BLUE), ...hbox([x + 1, y, -6], [1, 1, 1], BLUE)]),
    ...hbox([0, 0, 0], [7, 4, 2], RAIN), ...hbox([1, 0, 2], [3, 4, 2], RAIN), ...hbox([4, 1, 2], [2, 3, 1], RAIN),
  ]) },
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
  .map((s) => ({ id: s.id, name: s.name, group: s.group, stamp: stampOf(s.cells()) }));
if (out.length !== SHAPES.length) throw new Error('a shape has no group in GROUPS');
// Packed for web/stamps.js (web/stamppack.js); unpacking must give every cell back.
const sorted = (cells) => JSON.stringify(cells.map((c) => JSON.stringify(c)).sort());
const packed = out.map(({ stamp, ...s }) => {
  const p = pack(stamp);
  if (sorted(unpack(p).cells) !== sorted(stamp.cells)) throw new Error(`${s.name} does not unpack to its cells`);
  return { ...s, ...p };
});
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
