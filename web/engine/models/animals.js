// The animals, side on and facing right (+x): box stamps as 3D models (web/engine/stampmodels.js has the rest and
// explains the model). Redrawn 2026-10-19 richer in 3D, something on every side, and
// with detail by size: parts in fromSize(2, …) show from twice the size up (quarter
// units allowed), fromSize(1, …) hides specks below the stamp's own size and
// belowSize(1, …) is a plainer stand-in when small (owner: "less detail on the smaller
// version and more detail on the large versions"). Back to front, no boxes overlapping,
// so every size paints the same as it draws by depth (test/stampmodels.test.mjs).
// The animals, redrawn 3D rich and fat (owner, on the Frog: "have these guys be
// fatter"): round bodies five half units wide, features on every side, nothing
// painted on top that depth would hide. Half units; back to front (far x, y first;
// low z first). Three tiers (owner: "less detail on the smaller version and more
// detail on the large versions"): fromSize(1, …) is what goes below 1× (stripes,
// spots, specks), fromSize(2, …) the detail found zoomed in, in quarter units (.5):
// a glint in each eye, whiskers, inner ears, freckles, toes, a tag.
import { COLORS, hbox, patch, top, fromSize, belowSize } from '../stampart.js';

const { YELLOW, PINK, ORANGE, INK, WHITE, TAN, FOX, LIME, HOG, DOG, MUZZLE, BLUE, GREEN, BROWN, RED, ROSE, PINE, NAVY, SKY } = COLORS;

// A band over a round body: a box y 0 to 5 from z to z + 3, capped by one y 1 to 4
// half a unit taller. Its part on the body (sides down to z0, and the ledges either
// side of the cap) goes after the body; its part on the cap after the cap.
const bodyBand = (xs, z, z0, c) => [top(z + 3, xs, [0, 1], c), top(z + 3, xs, [4, 5], c), patch('L', 5, xs, [z0, z + 3], c), patch('l', 0, xs, [z0, z + 3], c)];
const capBand = (xs, z, c) => [patch('L', 4, xs, [z + 3, z + 4], c), patch('l', 1, xs, [z + 3, z + 4], c), top(z + 4, xs, [1, 4], c)];
// An eye on each side of a head (the planes y = yL and y = yl), with a white glint
// in its upper front corner from 2× up.
const glint = (side, at, [a0, a1], [z0, z1]) => patch(side, at, [a1 - 0.5, a1], [z1 - 0.5, z1], WHITE);
const eyes = (yL, yl, xs, zs, c = INK) => [
  patch('L', yL, xs, zs, c), patch('l', yl, xs, zs, c),
  ...fromSize(2, [glint('L', yL, xs, zs), glint('l', yl, xs, zs)]),
];
// A ring round an upright box (x0 to x1, y0 to y1) from z to z + 0.5.
const ring = ([x0, x1], [y0, y1], z, c) => [patch('L', y1, [x0, x1], [z, z + 0.5], c), patch('l', y0, [x0, x1], [z, z + 0.5], c), patch('R', x1, [y0, y1], [z, z + 0.5], c), patch('r', x0, [y0, y1], [z, z + 0.5], c)];

// Two thin grey whiskers sticking out from a cheek (y0 to y0 + 1), from 2× up.
const whiskers = (x, y0, z0, z1) => fromSize(2, [...hbox([x, y0, z0], [0.5, 1, 0.5], COLORS.STONE), ...hbox([x, y0, z1], [0.5, 1, 0.5], COLORS.STONE)]);

const WING = '#e0a800', BLUEWING = '#1f5fbf', SMILE = '#a83232';

export const MODELS = {
  // A fat tabby: stripes over its round back and down both sides, a tail curling up,
  // a white muzzle and pink nose, an eye each side, pointed ears. Zoomed in: rings
  // round its tail, whiskers, pink inside its ears, glints.
  cat: () => [
    ...hbox([-1, 2, 2], [1, 1, 5], ORANGE), // the tail, up from the rump
    ...fromSize(2, [...ring([-1, 0], [2, 3], 4.5, FOX), ...ring([-1, 0], [2, 3], 5.5, FOX)]),
    ...hbox([1, 0, 0], [1, 1, 1], ORANGE), ...hbox([5, 0, 0], [1, 1, 1], ORANGE),
    ...hbox([1, 4, 0], [1, 1, 1], ORANGE), ...hbox([5, 4, 0], [1, 1, 1], ORANGE),
    ...hbox([0, 1, 1], [1, 3, 3], ORANGE), // the rump
    ...hbox([1, 0, 1], [6, 5, 3], ORANGE),
    ...fromSize(1, [...bodyBand([2, 3], 1, 2, FOX), ...bodyBand([4, 5], 1, 2, FOX)]),
    ...hbox([1, 1, 4], [6, 3, 1], ORANGE),
    ...fromSize(1, [...capBand([2, 3], 1, FOX), ...capBand([4, 5], 1, FOX)]),
    ...hbox([0, 2, 7], [1, 1, 1], ORANGE), // the tail's tip, curled forward
    ...whiskers(9.5, -1, 2, 3), // whiskers, from 2× up
    ...hbox([7, 0, 2], [3, 5, 3], ORANGE),
    ...eyes(5, 0, [8, 9], [3, 4]),
    ...fromSize(1, [patch('R', 10, [1, 4], [2, 3], WHITE)]), patch('R', 10, [2, 3], [3, 4], PINK), // a white muzzle, a pink nose
    ...hbox([8, 0, 5], [1, 1, 2], ORANGE), ...fromSize(2, [patch('R', 9, [0, 1], [5.5, 6.5], PINK)]), // an ear, pink inside
    ...hbox([7, 1, 5], [3, 3, 1], ORANGE), // the top of its head
    ...hbox([8, 4, 5], [1, 1, 2], ORANGE), ...fromSize(2, [patch('R', 9, [4, 5], [5.5, 6.5], PINK)]),
    ...whiskers(9.5, 5, 2, 3),
  ],
  // Sitting up, plump: a round haunch on long feet with white toes, a big puff of a
  // tail, white paws in front, an eye each side, tall ears pink inside. Zoomed in:
  // buck teeth, whiskers, tan tips to its ears, glints.
  bunny: () => [
    ...hbox([-1, 1, 2], [1, 3, 2], WHITE), // a puff of a tail
    ...hbox([0, 0, 0], [3, 1, 1], TAN), ...fromSize(1, hbox([3, 0, 0], [1, 1, 1], WHITE)), ...belowSize(1, hbox([3, 0, 0], [1, 1, 1], TAN)), // long back feet, white toes
    ...hbox([0, 4, 0], [3, 1, 1], TAN), ...fromSize(1, hbox([3, 4, 0], [1, 1, 1], WHITE)), ...belowSize(1, hbox([3, 4, 0], [1, 1, 1], TAN)),
    ...hbox([0, 0, 1], [4, 5, 2], TAN), ...hbox([1, 0, 3], [3, 5, 1], TAN), ...hbox([1, 1, 4], [3, 3, 1], TAN), // the haunch, rounded
    ...hbox([5, 1, 0], [1, 1, 1], WHITE), ...hbox([5, 3, 0], [1, 1, 1], WHITE), // front paws
    ...hbox([4, 0, 1], [2, 5, 2], TAN), // the chest
    ...whiskers(6.5, -1, 3, 4), // whiskers, from 2× up
    ...hbox([4, 0, 3], [3, 5, 3], TAN),
    ...eyes(5, 0, [5, 6], [4, 5]),
    ...fromSize(1, [patch('R', 7, [2, 3], [4, 5], PINK)]), // its nose
    ...fromSize(2, [patch('R', 7, [2, 3], [3, 3.5], WHITE)]), // buck teeth
    ...hbox([4, 1, 6], [1, 1, 3], TAN), patch('R', 5, [1, 2], [6, 9], PINK), ...fromSize(2, [patch('R', 5, [1, 2], [8.5, 9], TAN)]),
    ...hbox([4, 3, 6], [1, 1, 3], TAN), patch('R', 5, [3, 4], [6, 9], PINK), ...fromSize(2, [patch('R', 5, [3, 4], [8.5, 9], TAN)]),
    ...whiskers(6.5, 5, 3, 4),
  ],
  // A plump duck: orange feet under it, a tail turned up behind, a round back, a
  // wing out on each side, an eye each side of its head, and a long beak. Zoomed
  // in: feathers on its wings, a tuft on its head, rosy cheeks, nostrils, glints.
  duck: () => [
    ...hbox([-1, 1, 2], [1, 3, 3], YELLOW), // the tail, turned up
    ...hbox([2, 1, 0], [2, 1, 1], ORANGE), // a foot
    ...hbox([1, -1, 2], [3, 1, 1], WING), // a wing
    ...fromSize(2, [patch('l', -1, [1.5, 2], [2, 3], ORANGE), patch('l', -1, [2.5, 3], [2, 3], ORANGE)]),
    ...hbox([2, 3, 0], [2, 1, 1], ORANGE), // the other foot
    ...hbox([0, 0, 1], [6, 5, 2], YELLOW),
    ...hbox([0, 1, 3], [4, 3, 1], YELLOW), // its round back
    ...hbox([4, 1, 3], [2, 3, 3], YELLOW),
    ...eyes(4, 1, [5, 6], [4, 5]),
    ...fromSize(2, [patch('L', 4, [4.5, 5], [3.5, 4], PINK), patch('l', 1, [4.5, 5], [3.5, 4], PINK)]), // rosy cheeks
    ...fromSize(2, [...hbox([4.5, 2, 6], [0.5, 1, 1], YELLOW), ...hbox([5, 2, 6.5], [0.5, 1, 0.5], YELLOW)]), // a tuft, curling forward
    ...hbox([1, 5, 2], [3, 1, 1], WING), // the other wing
    ...fromSize(2, [patch('L', 6, [1.5, 2], [2, 3], ORANGE), patch('L', 6, [2.5, 3], [2, 3], ORANGE)]),
    ...hbox([6, 2, 4], [2, 1, 1], ORANGE), // the beak
    ...fromSize(2, [top(5, [6.5, 7], [2, 2.5], BROWN), top(5, [6.5, 7], [2.5, 3], ORANGE)]), // a nostril
  ],
  // A bushy tail with a white tip, black socks, a round body with a white chest,
  // white cheeks and muzzle, an eye each side, black-tipped ears. Zoomed in: a flick
  // of fur at its tail's tip, white inside its ears, a shine on its nose, glints.
  fox: () => [
    ...fromSize(2, hbox([-4.5, 2, 4], [0.5, 1, 1], WHITE)), // a flick of fur at its tip
    ...hbox([-4, 1, 3], [1, 3, 2], WHITE), ...hbox([-3, 1, 3], [2, 3, 2], FOX), ...hbox([-1, 1, 2], [1, 3, 2], FOX), // the tail, swept up
    ...hbox([1, 0, 0], [1, 1, 1], INK), ...hbox([5, 0, 0], [1, 1, 1], INK),
    ...hbox([1, 4, 0], [1, 1, 1], INK), ...hbox([5, 4, 0], [1, 1, 1], INK),
    ...hbox([0, 1, 1], [1, 3, 3], FOX), // the rump
    ...hbox([1, 0, 1], [6, 5, 3], FOX),
    patch('R', 7, [0, 5], [1, 2], WHITE), ...fromSize(1, [patch('L', 5, [5, 7], [1, 2], WHITE), patch('l', 0, [5, 7], [1, 2], WHITE)]), // a white chest
    ...hbox([1, 1, 4], [6, 3, 1], FOX),
    ...hbox([7, 0, 2], [3, 5, 3], FOX),
    patch('R', 10, [0, 5], [2, 3], WHITE), ...fromSize(1, [patch('L', 5, [8, 10], [2, 3], WHITE), patch('l', 0, [8, 10], [2, 3], WHITE)]),
    ...eyes(5, 0, [8, 9], [3, 4]),
    ...hbox([7, 0, 5], [1, 1, 1], FOX), ...fromSize(2, [patch('R', 8, [0.5, 1], [5, 6], WHITE)]), ...hbox([7, 0, 6], [1, 1, 1], INK),
    ...hbox([7, 4, 5], [1, 1, 1], FOX), ...fromSize(2, [patch('R', 8, [4, 4.5], [5, 6], WHITE)]), ...hbox([7, 4, 6], [1, 1, 1], INK),
    ...hbox([10, 1, 2], [1, 3, 1], WHITE), ...hbox([11, 2, 2], [1, 1, 1], WHITE), patch('R', 12, [2, 3], [2, 3], INK), // the snout and its nose
    ...fromSize(2, [patch('R', 12, [2.5, 3], [2.5, 3], WHITE)]),
  ],
  // A fat snake: bands all the way round, two humps, a tapering tail, a wide head
  // with an eye each side and a forked tongue. Zoomed in: scales along its back,
  // nostrils, glints, and a thin forked tongue.
  snake: () => {
    const seg = (o, s, c, d) => [...hbox(o, s, c), ...fromSize(2, [top(o[2] + s[2], [o[0] + 0.5, o[0] + 1], [o[1] + 0.5, o[1] + 1], d), top(o[2] + s[2], [o[0] + 1, o[0] + 1.5], [o[1] + 1.5, o[1] + 2], d)])];
    return [
      ...hbox([-4, 1, 0], [2, 1, 1], LIME), ...seg([-2, 0, 0], [2, 3, 2], GREEN, LIME), // the tail, thinning
      ...seg([0, 0, 0], [2, 3, 3], LIME, GREEN), ...seg([2, 0, 1], [2, 3, 3], GREEN, LIME), ...seg([4, 0, 0], [3, 3, 3], LIME, GREEN),
      ...seg([4, 3, 0], [3, 2, 3], GREEN, LIME), ...seg([4, 5, 0], [3, 3, 3], LIME, GREEN),
      ...seg([7, 5, 1], [2, 3, 3], GREEN, LIME), ...seg([9, 5, 0], [2, 3, 3], LIME, GREEN),
      ...hbox([11, 4, 0], [4, 5, 3], GREEN),
      ...eyes(9, 4, [12, 13], [1, 2]),
      ...fromSize(2, [patch('R', 15, [5, 5.5], [2, 2.5], INK), patch('R', 15, [7.5, 8], [2, 2.5], INK)]), // nostrils
      ...belowSize(2, [...hbox([15, 6, 0], [1, 1, 1], RED), ...fromSize(1, [...hbox([16, 5, 0], [1, 1, 1], RED), ...hbox([16, 7, 0], [1, 1, 1], RED)])]), // a forked tongue
      ...fromSize(2, [...hbox([15, 6, 0], [1, 1, 0.5], RED), ...hbox([16, 5.5, 0], [1, 0.5, 0.5], RED), ...hbox([16, 7, 0], [1, 0.5, 0.5], RED)]), // finer, zoomed in
    ];
  },
  // Fat, wide and a little tall (owner: "make these frogs slightly taller"), with a
  // round back, big eyes on top, a smile and a pale throat, spots, and folded legs
  // on both sides. Zoomed in: a curved smile, rosy cheeks,
  // nostrils, small freckles, glints in its eyes.
  frog: () => [
    ...hbox([0, -1, 0], [3, 1, 2], LIME), ...hbox([3, -1, 0], [1, 1, 1], LIME), ...hbox([5, -1, 0], [1, 1, 1], LIME),
    ...hbox([0, 0, 0], [7, 7, 3], GREEN),
    ...fromSize(1, [top(3, [5, 6], [3, 4], PINE),
      patch('L', 7, [4, 5], [2, 3], PINE), patch('l', 0, [4, 5], [2, 3], PINE), patch('r', 0, [2, 3], [1, 2], PINE)]),
    patch('R', 7, [2, 5], [2, 3], SMILE), ...fromSize(1, [patch('R', 7, [1, 6], [0, 1], LIME)]),
    ...fromSize(2, [patch('R', 7, [2, 2.5], [2, 2.5], GREEN), patch('R', 7, [4.5, 5], [2, 2.5], GREEN), patch('R', 7, [2.5, 4.5], [2.5, 3], GREEN), // the smile curves up
      patch('R', 7, [0.5, 1.5], [2, 2.5], PINK), patch('R', 7, [5.5, 6.5], [2, 2.5], PINK), // rosy cheeks
      top(3, [6.5, 7], [2.5, 3], INK), top(3, [6.5, 7], [4, 4.5], INK)]), // nostrils
    ...hbox([0, 1, 3], [4, 5, 1], GREEN), // its round back
    ...fromSize(1, [top(4, [1, 2], [2, 3], PINE), top(4, [2, 3], [4, 5], PINE), patch('r', 0, [3, 4], [3, 4], PINE)]),
    ...fromSize(2, [top(4, [0.5, 1], [4, 4.5], PINE), top(4, [3, 3.5], [1.5, 2], PINE), top(4, [2.5, 3], [3, 3.5], PINE)]), // freckles
    ...hbox([4, 0, 3], [2, 2, 2], WHITE), patch('R', 6, [0, 1], [4, 5], INK), patch('l', 0, [5, 6], [4, 5], INK),
    ...fromSize(2, [patch('R', 6, [0, 0.5], [4.5, 5], WHITE)]), // a glint at the corner
    ...hbox([4, 5, 3], [2, 2, 2], WHITE), patch('R', 6, [6, 7], [4, 5], INK), patch('L', 7, [5, 6], [4, 5], INK),
    ...fromSize(2, [patch('R', 6, [6.5, 7], [4.5, 5], WHITE)]),
    ...hbox([0, 7, 0], [3, 1, 2], LIME), ...hbox([3, 7, 0], [1, 1, 1], LIME), ...hbox([5, 7, 0], [1, 1, 1], LIME),
  ],
  // A fat pig: a belly bulging out both sides, a round back, a curly tail, a
  // wide snout with nostrils, pink ears, an eye each side. Zoomed in: hooves, ears
  // flopping forward, rosy cheeks, glints.
  pig: () => {
    const hooves = (x, y) => fromSize(2, ring([x, x + 1], [y, y + 1], 0, ROSE));
    return [
      ...hbox([-2, 2, 4], [1, 1, 1], HOG), ...hbox([-1, 2, 3], [1, 1, 2], HOG), // a curl of a tail
      ...hbox([1, 0, 0], [1, 1, 1], HOG), ...hooves(1, 0), ...hbox([6, 0, 0], [1, 1, 1], HOG), ...hooves(6, 0),
      ...hbox([2, -1, 1], [4, 1, 2], HOG), // its belly, bulging out each side
      ...hbox([1, 4, 0], [1, 1, 1], HOG), ...hooves(1, 4), ...hbox([6, 4, 0], [1, 1, 1], HOG), ...hooves(6, 4),
      ...hbox([0, 1, 1], [1, 3, 3], HOG), // the rump
      ...hbox([1, 0, 1], [6, 5, 3], HOG),
      ...hbox([1, 1, 4], [6, 3, 1], HOG), // its round back
      ...hbox([2, 5, 1], [4, 1, 2], HOG),
      ...hbox([7, 0, 2], [2, 5, 3], HOG),
      ...eyes(5, 0, [7, 8], [3, 4]),
      ...fromSize(2, [patch('L', 5, [8, 9], [2.5, 3], PINK), patch('l', 0, [8, 9], [2.5, 3], PINK)]), // rosy cheeks
      ...hbox([7, 0, 5], [1, 1, 1], PINK), ...fromSize(2, hbox([8, 0, 5.5], [0.5, 1, 0.5], PINK)), // an ear, flopping forward
      ...hbox([7, 4, 5], [1, 1, 1], PINK), ...fromSize(2, hbox([8, 4, 5.5], [0.5, 1, 0.5], PINK)),
      ...hbox([9, 1, 2], [1, 3, 2], PINK), ...fromSize(1, [patch('R', 10, [1, 2], [2, 3], ROSE), patch('R', 10, [3, 4], [2, 3], ROSE)]),
      ...fromSize(2, [patch('R', 10, [1.5, 2], [2, 2.5], INK), patch('R', 10, [3, 3.5], [2, 2.5], INK)]), // deep in its nostrils
    ];
  },
  // A round dog: a brown saddle over its back, a red collar, floppy ears on both
  // sides, a wide muzzle and nose. Zoomed in: a tag on its collar, freckles on its
  // muzzle, a pink tongue, a shine on its nose, eyebrows, glints.
  dog: () => [
    ...hbox([-1, 2, 3], [1, 1, 3], DOG), // a wagging tail
    ...hbox([1, 0, 0], [1, 1, 1], DOG), ...hbox([4, 0, 0], [1, 1, 1], DOG),
    ...hbox([1, 4, 0], [1, 1, 1], DOG), ...hbox([4, 4, 0], [1, 1, 1], DOG),
    ...hbox([0, 1, 1], [1, 3, 3], DOG), // the rump
    ...hbox([1, 0, 1], [5, 5, 3], DOG),
    ...fromSize(1, bodyBand([2, 5], 1, 3, BROWN)),
    ...hbox([1, 1, 4], [5, 3, 1], DOG),
    ...fromSize(1, capBand([2, 5], 1, BROWN)),
    ...hbox([6, 0, 1], [1, 5, 3], RED), // the collar
    ...fromSize(2, [patch('L', 5, [6, 7], [1.5, 2.5], YELLOW), patch('l', 0, [6, 7], [1.5, 2.5], YELLOW)]), // its tag
    ...hbox([8, -1, 2], [1, 1, 3], BROWN), // an ear
    ...hbox([7, 0, 2], [3, 5, 3], DOG),
    ...eyes(5, 0, [9, 10], [3, 4]),
    ...fromSize(2, [patch('L', 5, [9, 10], [4.5, 5], MUZZLE), patch('l', 0, [9, 10], [4.5, 5], MUZZLE)]), // eyebrows
    ...hbox([7, 1, 5], [3, 3, 1], DOG), // the top of its head
    ...hbox([8, 5, 2], [1, 1, 3], BROWN), // the other ear
    ...hbox([10, 1, 2], [2, 3, 2], MUZZLE), patch('R', 12, [2, 3], [3, 4], INK), // the snout and its nose
    ...fromSize(2, [patch('R', 12, [2.5, 3], [3.5, 4], WHITE), top(4, [10.5, 11], [1.5, 2], BROWN), top(4, [11, 11.5], [3, 3.5], BROWN), top(4, [10.5, 11], [3.5, 4], BROWN)]), // a shine, freckles
    ...fromSize(2, hbox([12, 2, 2], [0.5, 1, 0.5], PINK)), // its tongue, peeping out
  ],
  // A round clownfish: white stripes all the way round, fins on top and both sides,
  // a forked tail, an eye each side, a head tapering to its nose. Zoomed in: thin
  // black edges to its stripes, a mouth, glints, and two bubbles.
  fish: () => {
    const edge = (x, z0, z1) => fromSize(2, [patch('L', 4, [x, x + 0.5], [z0, z1], INK), patch('l', 0, [x, x + 0.5], [z0, z1], INK), top(z1, [x, x + 0.5], [0, 4], INK)]);
    return [
      ...hbox([-1, 1, 0], [1, 2, 2], ORANGE), ...hbox([-1, 1, 4], [1, 2, 2], ORANGE), // the tail
      ...hbox([0, 1, 1], [1, 2, 4], ORANGE),
      ...fromSize(1, hbox([3, -1, 1], [2, 1, 1], FOX)), // a fin
      ...hbox([1, 0, 1], [1, 4, 4], ORANGE), ...edge(1.5, 1, 5),
      ...hbox([2, 0, 0], [1, 4, 6], WHITE),
      ...hbox([3, 0, 0], [2, 4, 6], ORANGE), ...edge(3, 0, 6), ...edge(4.5, 0, 6),
      ...hbox([3, 1, 6], [2, 2, 1], FOX), // the fin on top
      ...hbox([5, 0, 0], [1, 4, 6], WHITE),
      ...hbox([6, 0, 1], [2, 4, 4], ORANGE), ...edge(6, 1, 5),
      ...eyes(4, 0, [6, 7], [3, 4]),
      ...hbox([8, 1, 2], [1, 2, 2], ORANGE), // its nose
      ...fromSize(2, [patch('R', 9, [1.5, 2.5], [2.5, 3], INK)]), // its mouth
      ...fromSize(1, hbox([3, 4, 1], [2, 1, 1], FOX)), // the other fin
      ...fromSize(2, [...hbox([9.5, 2, 5], [0.5, 0.5, 0.5], SKY), ...hbox([10, 1.5, 6.5], [0.5, 0.5, 0.5], SKY)]), // bubbles
    ];
  },
  // A plump bird: wings folded on both sides, a round back, an orange breast, a
  // crest, an eye each side, a beak. Zoomed in: feathers on its wings, toes, rosy
  // cheeks, a second plume in its crest, glints.
  bird: () => [
    ...hbox([-2, 1, 3], [2, 3, 1], BLUE), // the tail
    ...hbox([4, 1, 0], [1, 1, 1], INK), ...hbox([4, 3, 0], [1, 1, 1], INK), // legs
    ...fromSize(2, [...hbox([5, 1, 0], [0.5, 1, 0.5], INK), ...hbox([5, 3, 0], [0.5, 1, 0.5], INK)]), // toes
    ...hbox([0, -1, 2], [3, 1, 2], BLUEWING), // a wing
    ...fromSize(2, [patch('l', -1, [0.5, 1], [2, 3], NAVY), patch('l', -1, [1.5, 2], [2, 3], NAVY)]),
    ...hbox([0, 0, 1], [3, 5, 3], BLUE), ...hbox([3, 0, 1], [2, 5, 2], ORANGE), // the breast
    ...hbox([0, 1, 4], [3, 3, 1], BLUE), // its round back
    ...hbox([0, 5, 2], [3, 1, 2], BLUEWING), // the other wing
    ...fromSize(2, [patch('L', 6, [0.5, 1], [2, 3], NAVY), patch('L', 6, [1.5, 2], [2, 3], NAVY)]),
    ...hbox([3, 0, 3], [3, 5, 3], BLUE),
    ...eyes(5, 0, [4, 5], [4, 5]),
    ...fromSize(2, [patch('L', 5, [5, 6], [3.5, 4], PINK), patch('l', 0, [5, 6], [3.5, 4], PINK)]), // rosy cheeks
    ...hbox([3, 1, 6], [3, 3, 1], BLUE), // the top of its head
    ...fromSize(2, hbox([3.5, 2, 7.5], [0.5, 1, 0.5], BLUE)), // a plume, swept back
    ...fromSize(1, hbox([4, 2, 7], [1, 1, 1], BLUE)), // a crest
    ...hbox([6, 2, 4], [1, 1, 1], YELLOW),
  ],
};
