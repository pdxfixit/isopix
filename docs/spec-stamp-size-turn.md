# Spec: stamps you size by dragging, and turn

**Status:** the build plan. The owner chose B, both turns with planes first,
and H1 (2026-10-19; [decisions.md](decisions.md), "A placed stamp stays
live"). Step 1, size, is built (release with `web/ui/livestamp.js`); steps 2 and 3
are in [TODO.md](../TODO.md).

**The ask.** Owner, 2026-10-19: "it really does seem like shapes need to be
rotateable, kind of like drawing a face/plane... it'd be fun if we had really
high-def versions of each stamp/shape, so that the user could choose how large
they wanted by dragging it to size".

That is three wishes: **size by dragging**, **turning**, and **more detail when
bigger** ("high-def"). They cost very different amounts, so this spec takes them
apart.

## What is true today

Read in the code, not from memory:

- **The Stamp brush is a drag brush.** Press, and the stamp appears under the
  finger; slide, and it follows; lift, and it lands (`dragApply` in
  `web/ui/input.js`). On a touch screen this slide is the only preview before a
  stamp lands: the hover ghost is mouse only.
- **Drag a face** is the brush the ask points at. Press a grid point and drag:
  the drag's direction picks the plane (top, left wall, right wall) and its
  length the size (`parallelogram` in `web/engine/brushes.js`).
- **After placing**, a selection already has **Turn** (a sixth of a turn, in
  the flat picture), **Flip**, and **Bigger / Smaller** (exactly double or
  half).
- **The starter stamps are built ahead of time** by `tools/make_stamps.mjs`
  from 3D boxes measured in half units, and ship as plain cells
  (`web/stamps.js`, 7 KB gzipped for 93). The app never sees the boxes.
  **Mine** (stamps saved from a selection) are cells too.
- **A stamp's size is the grid's:** it is drawn at the current grid level. The
  grid is the brush.

## What the prototype showed

I rebuilt the starter stamps at other sizes in a scratch copy of the builder
(2026-10-19) and looked at the pictures.

1. **Bigger box art is not more detailed.** The animals built at twice the
   unit are the same picture, twice as big, block for block. For the 75 or so
   stamps made of boxes, "high-def" means drawing new art, not drawing the old
   art bigger.
2. **Only whole multiples of today's size come out clean.** At 1½ times
   (unit 3), every half-unit feature (eyes, ears, beaks, every pixel of the
   letters) lands between grid points and comes out saw-toothed. The snake's
   body, which is whole units, stayed clean. So in-between sizes use finer
   cells: 1½× is 3× one level finer (the owner's pick of resampled or finer
   cells, 2026-10-19), giving quarter steps while a stamp is small.
3. **Whole multiples need no art at all.** Scaling cells by a whole number k
   about a grid point is exact on this lattice: a triangle of side 1 becomes a
   triangle of side k, tiled by exactly k² triangles. That works for **every**
   stamp, Mine included, and gives the same result as rebuilding the box art at
   that size. Today's Bigger only reaches 2×, 4×, 8×.
4. **About a dozen stamps really do gain detail when bigger:** the ones drawn
   from a formula rather than boxes (Flower, Sun, Rainbow, Smiley, Kid, and the
   sacred geometry). Drawn from the formula at 4×, a circle is rounder, not
   blockier. That is the cheap kind of "high-def".
5. **Turning in 3D needs a new art model** (read in the code, not
   prototyped). The builder paints only the three faces seen from the front,
   in the order they are written. Spun a quarter turn, a model shows faces it
   never had, and the order is wrong. Spinning means rebuilding the starter art
   as small block models (half-unit cubes) with a back-to-front renderer in the
   engine.
6. **Today's Turn is the wrong turn for 3D things.** A sixth of a turn in the
   flat picture lays a house on its side with the light coming from the wrong
   place. It is right for flat patterns (sacred geometry, snowflakes).

## Three kinds of "turn"

The ask says "rotateable, kind of like drawing a face/plane". That could mean
any of these, and they are different builds:

| | What you see | Which stamps | Cost |
|---|---|---|---|
| **Spin** | The 3D thing turns on the spot: the cat faces right, toward you, left, away. Shading is redone, so the light stays put. | Box stamps (most) | Large: block models and a renderer |
| **Lay on a plane** | A flat picture goes on the floor, the left wall or the right wall, like Drag a face. A letter painted on a wall. | Letters, numbers, Smiley, sacred geometry | Medium: draw the 2D picture onto the plane |
| **Tip over** | A rocket lying down, a house on its roof | Box stamps | Large, for little gain: skip |

**Mine** has no 3D inside it (it is cells someone drew), so it can only get
today's flat Turn and Flip.

## The interaction: three ways

### A. Drag to size, like Drag a face

Press where the stamp's foot goes; drag out, and it grows in steps (1×, 2×,
3×…); the drag's direction picks which way it faces or which plane. A tap
places it at 1×.

- ✅ One gesture, quick, and it matches Drag a face. Fun.
- ❌ **It takes away slide-to-aim.** The stamp lands where the finger first
  touched, hidden under that finger. On a phone that is the only way to aim
  today. Of all the costs here, this is the biggest regression.
- ❌ **Size and facing fight.** A child growing a cat by dragging up-left
  would also spin it to face away. Drag a face gets away with this because
  there the plane *is* the shape; a cat's facing is not.
- ❌ It still needs buttons: nothing in Isopix may be gesture-only.

### B. Place, then adjust (recommended)

Place it as today: tap, or press and slide to aim. The stamp then stays
**live** (a dashed outline) until you do something else:

- a **size handle** on the outline's top corner: drag it, and the stamp grows
  or shrinks in steps, with a readout ("1½×") and a light buzz on each
  step;
- a small **stamp bar** where the selection bar sits: a size stepper
  (− 3× +), **Spin** (3D stamps) or **Turn** (flat ones and Mine), **Flip**,
  the three planes for flat pictures, and **Done**.

The next tap places another stamp, at the same size and facing, and commits
the last one. So does picking a tool, Undo, or opening a sheet. One Undo takes
the whole stamp away, however much it was adjusted.

- ✅ Slide-to-aim stays. You size it where it stands, so you see it against
  your drawing.
- ✅ Every control is a button, so it meets the screen-reader and
  no-gesture-only rules.
- ✅ Each change redraws from the stamp itself, so 1× → 5× → 2× loses
  nothing (the selection's Smaller merges detail).
- ✅ A row of flowers is still tap, tap, tap.
- ❌ It is a new kind of state: a live object in a cell app. Every rule below
  ("Rules a live stamp needs") has to be built and tested.
- ❌ Two size controls that look alike: the selection's Bigger doubles, the
  stamp's + steps by one. The stepper with its "3×" readout has to look
  different from Bigger / Smaller.

### C. Choose before placing, in the Stamps drawer

A size row (1× to 6×) and Spin under the tiles; place as today.

- ✅ The smallest build; no new state, no gesture clash.
- ❌ Indirect: pick a size, close the drawer, place it, see it is wrong,
  reopen. It loses the "drag it to size" the owner asked for.

**Recommendation: B.** It keeps the one thing children already rely on
(slide to aim), turns sizing into something you do to the stamp in place,
and puts every action on a button. A's drag can come later as a shortcut on
top of B if the owner wants it, once B's rules exist.

## Rules a live stamp needs (B)

- **Painting:** while live, the stamp is a preview in the open undo step,
  the way a drag is now (`rollback`, then repaint). It becomes real when
  committed. Autosave saves the drawing without it, or commits it first; to
  decide when building, with a test either way.
- **Pan and zoom** keep it live. A zoom that changes the grid level keeps its
  size in cells of the level it was placed at.
- **Symmetry** shows every mirrored copy live; the handle is on the original
  only.
- **Keep fine detail** is applied on every redraw, so the hatching shows
  what it would skip.
- **Eraser with the Stamp brush** sizes the same way.
- **Clean view** commits the live stamp before hiding the controls.
- **Lessons:** any step that places a stamp still passes; a lesson can teach
  the handle later.
- **Limits:** the largest size is where the stamp would pass about 20,000
  cells (the 111-cell Cat stops at 13×, the 618-cell Flower of Life at 5×); the stepper's + then greys out.
- **Help and keys:** `,` and `.` step the size (`[` and `]` already change the
  grid size), `R` will spin (in `web/keys.js`), and each new button gets its
  line in `web/help.js`.
- **Phones:** the stamp bar fits 320 px in the selection bar's place; the
  handle is a 44 px target placed outside the outline, so at a small size it
  does not hide the stamp.

## High-def: two levels

- **H1, now:** the formula stamps (about a dozen) are drawn from their
  formulas at each size, so they get rounder as they grow. This ships the
  formulas to the app (`tools/make_stamps.mjs`'s flat shapes move into
  `web/engine/`), which adds a few KB; measure it against the 7 KB the
  cells cost now.
- **H2, later and per stamp:** box art with quarter-unit detail (whiskers,
  windows, toes) shown from 3× up, and today's art below that. This is art
  work, stamp by stamp; try it on three or four favorites before deciding on
  all 93.

## Build order, if the owner picks B

Hours are an agent's working time, and a guess.

1. **Size:** the live stamp, the handle and the stepper, scaling cells by
   whole numbers. Every stamp, Mine included. No art changes. About 3 to 4
   hours.
2. **Lay on a plane and rounder curves (H1):** flat pictures onto the floor
   and walls; the formula stamps drawn at each size. About 3 hours.
3. **Spin:** block models for the box stamps (the builder emits them
   mechanically from its boxes), a back-to-front renderer in `web/engine/`,
   and a size check against `web/stamps.js` (7 KB gzipped today). About 4 to 6 hours.
4. **H2:** per stamp, after the owner has seen a few.

Each step ships on its own and is useful alone.

## What no tool here can test

How dragging the handle feels under a real finger, whether the finger hides
the stamp while aiming, and the buzz on each size step. These need the
owner's phone.
