// The animals, side on and facing right (+x): box stamps as 3D models (web/engine/stampmodels.js has the rest and
// explains the model). Redrawn 2026-10-19 to be richer in 3D, something on every side
// (owner: "make a pass across all the stamps to make them more 3d rich"), back to
// front with no boxes overlapping, so they draw the same painted or by depth.
// The animals, redrawn 3D rich and fat (owner, on the Frog: "have these guys be
// fatter"): round bodies five half units wide, features on every side, nothing
// painted on top that depth would hide. Half units; back to front (far x, y first;
// low z first).
import { COLORS, box, face, hbox, patch, top } from '../stampart.js';

const { YELLOW, PINK, ORANGE, INK, WHITE, TAN, FOX, LIME, HOG, DOG, MUZZLE, BLUE, GREEN, BROWN, RED, ROSE, PINE } = COLORS;

// A band over a round body: a box y 0 to 5 from z to z + 3, capped by one y 1 to 4
// half a unit taller. Its part on the body (sides down to z0, and the ledges either
// side of the cap) goes after the body; its part on the cap after the cap.
const bodyBand = (xs, z, z0, c) => [top(z + 3, xs, [0, 1], c), top(z + 3, xs, [4, 5], c), patch('L', 5, xs, [z0, z + 3], c), patch('l', 0, xs, [z0, z + 3], c)];
const capBand = (xs, z, c) => [patch('L', 4, xs, [z + 3, z + 4], c), patch('l', 1, xs, [z + 3, z + 4], c), top(z + 4, xs, [1, 4], c)];

const WING = '#e0a800', BLUEWING = '#1f5fbf', SMILE = '#a83232';

export const MODELS = {
  // A fat tabby: stripes over its round back and down both sides, a tail curling up,
  // a white muzzle and pink nose, an eye each side, pointed ears.
  cat: () => [
    ...hbox([-1, 2, 2], [1, 1, 5], ORANGE), // the tail, up from the rump
    ...hbox([1, 0, 0], [1, 1, 1], ORANGE), ...hbox([5, 0, 0], [1, 1, 1], ORANGE),
    ...hbox([1, 4, 0], [1, 1, 1], ORANGE), ...hbox([5, 4, 0], [1, 1, 1], ORANGE),
    ...hbox([0, 1, 1], [1, 3, 3], ORANGE), // the rump
    ...hbox([1, 0, 1], [6, 5, 3], ORANGE),
    ...bodyBand([2, 3], 1, 2, FOX), ...bodyBand([4, 5], 1, 2, FOX),
    ...hbox([1, 1, 4], [6, 3, 1], ORANGE),
    ...capBand([2, 3], 1, FOX), ...capBand([4, 5], 1, FOX),
    ...hbox([0, 2, 7], [1, 1, 1], ORANGE), // the tail's tip, curled forward
    ...hbox([7, 0, 2], [3, 5, 3], ORANGE),
    patch('L', 5, [8, 9], [3, 4], INK), patch('l', 0, [8, 9], [3, 4], INK), // an eye each side
    patch('R', 10, [1, 4], [2, 3], WHITE), patch('R', 10, [2, 3], [3, 4], PINK), // a white muzzle, a pink nose
    ...hbox([8, 0, 5], [1, 1, 2], ORANGE), ...hbox([7, 1, 5], [3, 3, 1], ORANGE), ...hbox([8, 4, 5], [1, 1, 2], ORANGE), // ears and the top of its head
  ],
  // Sitting up, plump: a round haunch on long feet with white toes, a big puff of a
  // tail, white paws in front, an eye each side, tall ears pink inside.
  bunny: () => [
    ...hbox([-1, 1, 2], [1, 3, 2], WHITE), // a puff of a tail
    ...hbox([0, 0, 0], [3, 1, 1], TAN), ...hbox([3, 0, 0], [1, 1, 1], WHITE), // long back feet, white toes
    ...hbox([0, 4, 0], [3, 1, 1], TAN), ...hbox([3, 4, 0], [1, 1, 1], WHITE),
    ...hbox([0, 0, 1], [4, 5, 2], TAN), ...hbox([1, 0, 3], [3, 5, 1], TAN), ...hbox([1, 1, 4], [3, 3, 1], TAN), // the haunch, rounded
    ...hbox([5, 1, 0], [1, 1, 1], WHITE), ...hbox([5, 3, 0], [1, 1, 1], WHITE), // front paws
    ...hbox([4, 0, 1], [2, 5, 2], TAN), // the chest
    ...hbox([4, 0, 3], [3, 5, 3], TAN),
    patch('L', 5, [5, 6], [4, 5], INK), patch('l', 0, [5, 6], [4, 5], INK),
    patch('R', 7, [2, 3], [4, 5], PINK), // its nose
    ...hbox([4, 1, 6], [1, 1, 3], TAN), patch('R', 5, [1, 2], [6, 9], PINK),
    ...hbox([4, 3, 6], [1, 1, 3], TAN), patch('R', 5, [3, 4], [6, 9], PINK),
  ],
  // A plump duck: orange feet under it, a tail turned up behind, a round back, a
  // wing out on each side, an eye each side of its head, and a long beak.
  duck: () => [
    ...hbox([-1, 1, 2], [1, 3, 3], YELLOW), // the tail, turned up
    ...hbox([2, 1, 0], [2, 1, 1], ORANGE), // a foot
    ...hbox([1, -1, 2], [3, 1, 1], WING), // a wing
    ...hbox([2, 3, 0], [2, 1, 1], ORANGE), // the other foot
    ...hbox([0, 0, 1], [6, 5, 2], YELLOW),
    ...hbox([0, 1, 3], [4, 3, 1], YELLOW), // its round back
    ...hbox([4, 1, 3], [2, 3, 3], YELLOW),
    patch('L', 4, [5, 6], [4, 5], INK), patch('l', 1, [5, 6], [4, 5], INK),
    ...hbox([1, 5, 2], [3, 1, 1], WING), // the other wing
    ...hbox([6, 2, 4], [2, 1, 1], ORANGE), // the beak
  ],
  // A bushy tail with a white tip, black socks, a round body with a white chest,
  // white cheeks and muzzle, an eye each side, black-tipped ears.
  fox: () => [
    ...hbox([-4, 1, 3], [1, 3, 2], WHITE), ...hbox([-3, 1, 3], [2, 3, 2], FOX), ...hbox([-1, 1, 2], [1, 3, 2], FOX), // the tail, swept up
    ...hbox([1, 0, 0], [1, 1, 1], INK), ...hbox([5, 0, 0], [1, 1, 1], INK),
    ...hbox([1, 4, 0], [1, 1, 1], INK), ...hbox([5, 4, 0], [1, 1, 1], INK),
    ...hbox([0, 1, 1], [1, 3, 3], FOX), // the rump
    ...hbox([1, 0, 1], [6, 5, 3], FOX),
    patch('R', 7, [0, 5], [1, 2], WHITE), patch('L', 5, [5, 7], [1, 2], WHITE), patch('l', 0, [5, 7], [1, 2], WHITE), // a white chest
    ...hbox([1, 1, 4], [6, 3, 1], FOX),
    ...hbox([7, 0, 2], [3, 5, 3], FOX),
    patch('R', 10, [0, 5], [2, 3], WHITE), patch('L', 5, [8, 10], [2, 3], WHITE), patch('l', 0, [8, 10], [2, 3], WHITE),
    patch('L', 5, [8, 9], [3, 4], INK), patch('l', 0, [8, 9], [3, 4], INK),
    ...hbox([7, 0, 5], [1, 1, 1], FOX), ...hbox([7, 0, 6], [1, 1, 1], INK),
    ...hbox([7, 4, 5], [1, 1, 1], FOX), ...hbox([7, 4, 6], [1, 1, 1], INK),
    ...hbox([10, 1, 2], [1, 3, 1], WHITE), ...hbox([11, 2, 2], [1, 1, 1], WHITE), patch('R', 12, [2, 3], [2, 3], INK), // the snout and its nose
  ],
  // A fat snake: bands all the way round, two humps, a tapering tail, a wide head
  // with an eye each side and a forked tongue.
  snake: () => [
    ...hbox([-4, 1, 0], [2, 1, 1], LIME), ...hbox([-2, 0, 0], [2, 3, 2], GREEN), // the tail, thinning
    ...hbox([0, 0, 0], [2, 3, 3], LIME), ...hbox([2, 0, 1], [2, 3, 3], GREEN), ...hbox([4, 0, 0], [3, 3, 3], LIME),
    ...hbox([4, 3, 0], [3, 2, 3], GREEN), ...hbox([4, 5, 0], [3, 3, 3], LIME),
    ...hbox([7, 5, 1], [2, 3, 3], GREEN), ...hbox([9, 5, 0], [2, 3, 3], LIME),
    ...hbox([11, 4, 0], [4, 5, 3], GREEN),
    patch('L', 9, [12, 13], [1, 2], INK), patch('l', 4, [12, 13], [1, 2], INK),
    ...hbox([15, 6, 0], [1, 1, 1], RED), ...hbox([16, 5, 0], [1, 1, 1], RED), ...hbox([16, 7, 0], [1, 1, 1], RED), // a forked tongue
  ],
  // Fat and wide, with a round back, big eyes on top, a smile and a pale throat,
  // spots, and folded legs on both sides.
  frog: () => [
    ...hbox([0, -1, 0], [3, 1, 2], LIME), ...hbox([3, -1, 0], [1, 1, 1], LIME), ...hbox([5, -1, 0], [1, 1, 1], LIME),
    ...hbox([0, 0, 0], [7, 7, 2], GREEN),
    top(2, [5, 6], [3, 4], PINE),
    patch('L', 7, [4, 5], [1, 2], PINE), patch('l', 0, [4, 5], [1, 2], PINE), patch('r', 0, [2, 3], [0, 1], PINE),
    patch('R', 7, [2, 5], [1, 2], SMILE), patch('R', 7, [1, 6], [0, 1], LIME),
    ...hbox([0, 1, 2], [4, 5, 1], GREEN), // its round back
    top(3, [1, 2], [2, 3], PINE), top(3, [2, 3], [4, 5], PINE), patch('r', 0, [3, 4], [2, 3], PINE),
    ...hbox([4, 0, 2], [2, 2, 2], WHITE), patch('R', 6, [0, 1], [3, 4], INK), patch('l', 0, [5, 6], [3, 4], INK),
    ...hbox([4, 5, 2], [2, 2, 2], WHITE), patch('R', 6, [6, 7], [3, 4], INK), patch('L', 7, [5, 6], [3, 4], INK),
    ...hbox([0, 7, 0], [3, 1, 2], LIME), ...hbox([3, 7, 0], [1, 1, 1], LIME), ...hbox([5, 7, 0], [1, 1, 1], LIME),
  ],
  // A fat pig: a belly bulging out both sides, a round back, a curly tail, a
  // wide snout with nostrils, pink ears, an eye each side.
  pig: () => [
    ...hbox([-2, 2, 4], [1, 1, 1], HOG), ...hbox([-1, 2, 3], [1, 1, 2], HOG), // a curl of a tail
    ...hbox([1, 0, 0], [1, 1, 1], HOG), ...hbox([6, 0, 0], [1, 1, 1], HOG),
    ...hbox([2, -1, 1], [4, 1, 2], HOG), // its belly, bulging out each side
    ...hbox([1, 4, 0], [1, 1, 1], HOG), ...hbox([6, 4, 0], [1, 1, 1], HOG),
    ...hbox([0, 1, 1], [1, 3, 3], HOG), // the rump
    ...hbox([1, 0, 1], [6, 5, 3], HOG),
    ...hbox([1, 1, 4], [6, 3, 1], HOG), // its round back
    ...hbox([2, 5, 1], [4, 1, 2], HOG),
    ...hbox([7, 0, 2], [2, 5, 3], HOG),
    patch('L', 5, [7, 8], [3, 4], INK), patch('l', 0, [7, 8], [3, 4], INK),
    ...hbox([7, 0, 5], [1, 1, 1], PINK), ...hbox([7, 4, 5], [1, 1, 1], PINK),
    ...hbox([9, 1, 2], [1, 3, 2], PINK), patch('R', 10, [1, 2], [2, 3], ROSE), patch('R', 10, [3, 4], [2, 3], ROSE),
  ],
  // A round dog: a brown saddle over its back, a red collar, floppy ears on both
  // sides, a wide muzzle and nose.
  dog: () => [
    ...hbox([-1, 2, 3], [1, 1, 3], DOG), // a wagging tail
    ...hbox([1, 0, 0], [1, 1, 1], DOG), ...hbox([4, 0, 0], [1, 1, 1], DOG),
    ...hbox([1, 4, 0], [1, 1, 1], DOG), ...hbox([4, 4, 0], [1, 1, 1], DOG),
    ...hbox([0, 1, 1], [1, 3, 3], DOG), // the rump
    ...hbox([1, 0, 1], [5, 5, 3], DOG),
    ...bodyBand([2, 5], 1, 3, BROWN),
    ...hbox([1, 1, 4], [5, 3, 1], DOG),
    ...capBand([2, 5], 1, BROWN),
    ...hbox([6, 0, 1], [1, 5, 3], RED), // the collar
    ...hbox([8, -1, 2], [1, 1, 3], BROWN), // an ear
    ...hbox([7, 0, 2], [3, 5, 3], DOG),
    patch('L', 5, [9, 10], [3, 4], INK), patch('l', 0, [9, 10], [3, 4], INK),
    ...hbox([7, 1, 5], [3, 3, 1], DOG), // the top of its head
    ...hbox([8, 5, 2], [1, 1, 3], BROWN), // the other ear
    ...hbox([10, 1, 2], [2, 3, 2], MUZZLE), patch('R', 12, [2, 3], [3, 4], INK), // the snout and its nose
  ],
  // A round clownfish: white stripes all the way round, fins on top and both sides,
  // a forked tail, an eye each side, a head tapering to its nose.
  fish: () => [
    ...hbox([-1, 1, 0], [1, 2, 2], ORANGE), ...hbox([-1, 1, 4], [1, 2, 2], ORANGE), // the tail
    ...hbox([0, 1, 1], [1, 2, 4], ORANGE),
    ...hbox([3, -1, 1], [2, 1, 1], FOX), // a fin
    ...hbox([1, 0, 1], [1, 4, 4], ORANGE),
    ...hbox([2, 0, 0], [1, 4, 6], WHITE),
    ...hbox([3, 0, 0], [2, 4, 6], ORANGE),
    ...hbox([3, 1, 6], [2, 2, 1], FOX), // the fin on top
    ...hbox([5, 0, 0], [1, 4, 6], WHITE),
    ...hbox([6, 0, 1], [2, 4, 4], ORANGE),
    patch('L', 4, [6, 7], [3, 4], INK), patch('l', 0, [6, 7], [3, 4], INK),
    ...hbox([8, 1, 2], [1, 2, 2], ORANGE), // its nose
    ...hbox([3, 4, 1], [2, 1, 1], FOX), // the other fin
  ],
  // A plump bird: wings folded on both sides, a round back, an orange breast, a
  // crest, an eye each side, a beak.
  bird: () => [
    ...hbox([-2, 1, 3], [2, 3, 1], BLUE), // the tail
    ...hbox([4, 1, 0], [1, 1, 1], INK), ...hbox([4, 3, 0], [1, 1, 1], INK), // legs
    ...hbox([0, -1, 2], [3, 1, 2], BLUEWING), // a wing
    ...hbox([0, 0, 1], [3, 5, 3], BLUE), ...hbox([3, 0, 1], [2, 5, 2], ORANGE), // the breast
    ...hbox([0, 1, 4], [3, 3, 1], BLUE), // its round back
    ...hbox([0, 5, 2], [3, 1, 2], BLUEWING), // the other wing
    ...hbox([3, 0, 3], [3, 5, 3], BLUE),
    patch('L', 5, [4, 5], [4, 5], INK), patch('l', 0, [4, 5], [4, 5], INK),
    ...hbox([3, 1, 6], [3, 3, 1], BLUE), ...hbox([4, 2, 7], [1, 1, 1], BLUE), // the top of its head, a crest
    ...hbox([6, 2, 4], [1, 1, 1], YELLOW),
  ],
};
