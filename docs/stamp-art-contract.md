# Isopix stamp art contract

Version 1, 2026-10-19.

This document is the whole handoff for drawing a stamp for Isopix. It is written for an artist, an agent or an image or language model that knows nothing about the app or its code. A stamp that follows it, and passes the check, comes into the app with no code written by you.

The handoff package:

| File | What it is |
|---|---|
| `docs/stamp-art-contract.md` | This document: every rule, every field, every check. |
| `docs/stamp-art/doghouse.json` | A complete small stamp that passes the check. Copy it to start. |
| `docs/stamps/` | Every stamp that ships, drawn from every side (`README.md` is the index). Look here for the house style. |
| `tools/stamp_check.mjs` | The check (`just stamp-check <file.json>`): ACCEPT, or REJECT lines that say what to fix, and a picture of your stamp from every side. |

Words used here:

| Word | Meaning |
|---|---|
| Isopix | A drawing app for children (and grown-ups) on an isometric grid: the paper is a grid of small triangles, and three of them make each face of a cube. |
| Stamp | A small picture a child places with one tap: a cat, a car, a castle. |
| Block | A box, the only solid shape: every stamp is built of blocks. |
| Half unit | The measure of everything here: a block 2 half units on each side is one cube on the grid. All numbers are whole numbers of half units. |
| Decal | A flat patch of color on one side of a block: an eye, a window, a door. |
| Slope | A slanted face: a roof. |
| Spin | The app's button that turns a placed stamp a quarter turn, so a child sees every side of it. |

## Contents

1. What a stamp is
2. The space
3. The parts
4. Drawing rules (rules 1 to 9)
5. The palette
6. The file
7. The check: every REJECT and WARN
8. Deliver and bring in
9. A prompt for another model
10. Lessons from drawing the starter stamps
11. Changelog

## 1. What a stamp is

A stamp is a little 3D object made of blocks, shown the way Isopix shows everything: from above and to one side, the classic isometric view of a cube. A child picks it from the Stamps drawer, taps the paper, and it lands there. Then they can make it bigger or smaller, and spin it a quarter turn at a time to see it from each side. So **every side of a stamp is seen**, not just the front.

The app does the shading. You give each block one color; the app draws its top lighter and its right side darker, so the light always comes from the same place, whichever way the stamp is turned. Do not shade by hand.

A stamp is one JSON file of parts (section 6). It is data, never code.

## 2. The space

Three directions, all in half units, in whole numbers:

```
              z (up)
              |
              |
             / \
            /   \
   y (down-left)   x (down-right)
```

- **x** runs down and to the right on the screen.
- **y** runs down and to the left.
- **z** runs up.

From the front (as the stamp is first placed) you see three sides of every block: its **top** (+z), its **+x** side (lower right) and its **+y** side (lower left). The **-x** and **-y** sides are its back; they show when the stamp is spun.

Things that face one way (animals, vehicles, people) face **+x**, down to the right, as every starter stamp does.

Where the origin is does not matter: the app finds the stamp's foot (the middle of its bottom) and places it there. Keep numbers between -60 and 60.

## 3. The parts

**Block.** `{"box": [x, y, z], "size": [sx, sy, sz], "color": "#rrggbb"}`. `box` is its corner with the smallest x, y and z (back, left, bottom); `size` its width along x, depth along y and height, each at least 1. One half unit is the smallest feature: an eye, a button, a wheel's hub.

**Decal.** `{"decal": side, "at": n, "from": [a, b], "to": [a, b], "color": "#rrggbb"}`. A flat color lying on a block's side, which it must sit exactly on.

| `decal` | Lies on | `at` is | `from` and `to` are |
|---|---|---|---|
| `"+x"` | the block's +x side, facing down-right | its x | `[y, z]` corners |
| `"-x"` | the -x side, facing up-left (a back) | its x | `[y, z]` |
| `"+y"` | the +y side, facing down-left | its y | `[x, z]` |
| `"-y"` | the -y side, facing up-right (a back) | its y | `[x, z]` |
| `"top"` | the top | its z | `[x, y]` |

`from` is the low corner, `to` the high one: an eye one half unit square on the +y side of a block at y = 4, from x = 6 to 7 and z = 3 to 4, is `{"decal": "+y", "at": 4, "from": [6, 3], "to": [7, 4], "color": "#2b2d42"}`.

**Slope.** `{"slope": [[x, y, z], [x, y, z], [x, y, z]], "faces": side, "color": "#rrggbb"}`. A flat slanted face of 3 or 4 corners, shaded as the side it faces (`"+x"`, `"-x"`, `"+y"`, `"-y"` or `"up"`). Its edges must follow the grid (rule 7): a roof rises one half unit for every half unit it runs in from its edge, so a pyramid roof on a base 4 wide has its peak 2 up. The doghouse example has a full four-sided roof.

## 4. Drawing rules

1. **Back to front.** The app paints the parts in the order you list them, later over earlier. List far things first: smaller x and y first, and lower z first where things stack. Put each decal right after the block it sits on, before anything in front of it. The check proves the order is right (R11) and names the two parts when it is not.
2. **Blocks touch; they never overlap.** Two blocks may meet face to face but may not share space (R10). Overlapping blocks have no order that draws right from every side. Split one into smaller blocks instead.
3. **No cheats.** A feature shows from every side only if it really sticks out. A wheel is a block that sticks a half unit out past the body's side, below it. Paws stand in front of the body. A feature painted "on top" of something that hides it in 3D will vanish when the stamp spins.
4. **Something on every side.** Spin shows the back. Give each of the four sides something: an eye on each side of a head (not on its front: front eyes plus side eyes read as three eyes), windows on both sides and the back, a tail, a door at the back. The check warns about a bare side.
5. **It reads at its smallest size.** A placed stamp is small at first: make the parts that say what it is big and bold (a beak, ears, wheels, a chimney). Two specks read as a face; detail one half unit wide is the finest there is.
6. **Its own size.** Aim for 80 to 300 cells (the check counts them). Up to 450 is fine; past 600 is rejected (R12). The bigger a stamp's own size, the fewer sizes it can grow to.
7. **Straight edges.** Slopes only at the grid's own slope (section 3). Blocks and decals are always straight. Round things are made by stepping: wide in the middle, narrower above and below (see the Apple and the Cloud in `docs/stamps/`).
8. **The palette.** Use the palette (section 5). A color outside it is allowed when none will do; the check warns.
9. **Same character.** A new drawing of a stamp that ships keeps what children know it by: its main colors, its shape, the way it faces.

## 5. The palette

| Name | Color | Name | Color | Name | Color |
|---|---|---|---|---|---|
| BLUE | `#3a86ff` | TEAL | `#2a9d8f` | YELLOW | `#f4c430` |
| RED | `#e63946` | GREEN | `#5a9a3c` | BROWN | `#8b5a2b` |
| STONE | `#9aa0a6` | SAND | `#e9b949` | PINK | `#ff5d8f` |
| SKY | `#8ecae6` | ORANGE | `#f4a020` | INK | `#2b2d42` |
| WHITE | `#f1ece4` | TAN | `#c9a27e` | FOX | `#e8641b` |
| LIME | `#8bc34a` | HOG | `#ff9eb5` | DOG | `#b07040` |
| MUZZLE | `#e3c29b` | GOLD | `#d4a017` | PALEGOLD | `#f6d77a` |
| INDIGO | `#3f37c9` | VIOLET | `#7b2cbf` | ROSE | `#e85d75` |
| SKIN | `#f1c27d` | RAIN | `#b8c4d0` | MOON | `#f4e3a1` |
| PLANET | `#c77dff` | PINE | `#2e7d32` | CLOUD | `#e3eaf2` |
| PURPLE | `#8e5bd6` | NAVY | `#1d3557` | CREAM | `#fff3d6` |
| FROSTING | `#f8c8dc` | | | | |

INK is for eyes, tires and dark openings. Give a color as it should look on the block's lit left side (+y); the app makes the top lighter and the +x side darker.

## 6. The file

One JSON object, nothing before or after it:

```json
{
  "contract": 1,
  "id": "doghouse",
  "name": "Doghouse",
  "group": "buildings",
  "author": "who drew it",
  "tool": "what drew it (a model's name, or by hand)",
  "parts": [ … ]
}
```

| Field | Rule |
|---|---|
| `contract` | `1`, the version of this contract. |
| `id` | Lowercase letters and digits, single dashes between words, at most 24 long: `fire-truck`. Permanent once it ships. A new drawing of a stamp that ships uses its id (the ids are in `docs/stamps/README.md`). |
| `name` | What a child would call it, 1 to 20 characters: `Fire truck`. |
| `group` | The Stamps drawer section: `shapes`, `buildings`, `nature`, `weather`, `animals`, `people`, `vehicles`, `space` or `food`. |
| `author`, `tool` | Optional, a short line each. |
| `parts` | 1 to 400 parts (section 3), back to front (rule 1). |

## 7. The check

`just stamp-check <file.json>` (or `node tools/stamp_check.mjs <file.json>`; add `--replace` for new art for a stamp that ships). It prints `ACCEPT` and draws the stamp from every side, in a grid of two by two, as `<id>.svg` beside the file: as placed (top left), then turned a quarter at a time. **Look at it**: the check cannot judge the art. Or it prints one `REJECT` line per problem. Send REJECT lines back to whoever drew the stamp as they are; do not fix delivered art by hand.

| Code | Means | Fix |
|---|---|---|
| R1 | Not one readable JSON object. | Send exactly the object. |
| R2 | `contract` is not 1. | Set it to 1. |
| R3 | `id` badly formed, or already a shipped stamp's. | Rename it, or check with `--replace` for new art for that stamp. |
| R4 | `name`, `author` or `tool` missing or too long. | Section 6. |
| R5 | `group` not a drawer section. | Section 6. |
| R6 | No parts, or more than 400. | Section 6. |
| R7 | A part is malformed: not exactly one of block, decal, slope; a number not whole or out of range; a size under 1; a color not `#rrggbb`. | Section 3. |
| R8 | A decal with no area (`from` not below `to` in both). | Section 3. |
| R9 | A slope with corners or edges off the grid, or four corners not flat. | Rule 7. |
| R10 | Two blocks overlap. | Rule 2. |
| R11 | Painted out of order: a part is listed after a part in front of it. | Rule 1: move the named part before the other. |
| R12 | More than 600 cells. | Rule 6. |

Warnings do not stop a stamp; read them: a color outside the palette, more than 450 cells, a side with no decal.

## 8. Deliver and bring in

**To deliver:** the one JSON file that passes the check, and its `<id>.svg`.

**To bring it in** (for the agent working in the Isopix repo; the steps change the app):

1. Run the check on it again in the repo. Never edit delivered art: send REJECT lines back.
2. Add its parts, as delivered, to `PARTS` in `web/engine/stampmodels.js` as `'<id>': [ … ]`. That makes it a model; one with the id of a stamp that ships is new art for that stamp.
3. A new stamp: add `{ id, name, group, faces: M['<id>'] }` to `SHAPES` in `tools/make_stamps.mjs`, in its group, and its name to its group's list in `test/stampbook.test.mjs`.
4. `just stamps` (rebuilds `web/stamps.js` and `docs/stamps/`), then `just test`, and look at its sheet in `docs/stamps/`.
5. Record it in `docs/decisions.md` (the starter stamps row: who asked for it), bump `web/version.js` (`just version`) and land it.

## 9. A prompt for another model

Paste this, then the whole of sections 2 to 6, into a model with no access to the repo. Send its answer to the check; paste REJECT lines back into the same conversation.

```
You are drawing one stamp for Isopix, a children's drawing app on an isometric
grid. A stamp is a small 3D object built only of blocks, flat colored decals on
blocks, and roof slopes, written as one JSON object (no prose, no code). The
rules and the format follow. Draw: <WHAT, e.g. "a fire truck">.
Make it read clearly at a small size, give every one of its four sides
something to see (it can be spun), list parts strictly back to front, never let
blocks overlap, and use the palette. Reply with the JSON object only.
```

## 10. Lessons from drawing the starter stamps

Add a line when an art round teaches something; say which stamp and when.

- Eyes go on the sides of a head, one each side, not on its front: front eyes plus side eyes read as three eyes, and eyes wrapped round a corner read as sunglasses (Cat and Fox, 2026-10-19).
- A top decal (`"top"`) carries stripes, saddles and spots across a back (Cat, Dog, Frog, 2026-10-19).
- Cutting a block's corners to round it leaves a vertical seam at the front corner that looks boxy; round by stepping layers instead, and cut corners only above and below the widest layer (Apple, Rock, 2026-10-19).
- Pale on pale vanishes: cream icing on pale pink barely showed; the drips went hot pink (Cake, 2026-10-19).
- Spots on a pig's side read as doors; leave a plain side plain (Pig, 2026-10-19).
- Wheels are chunky blocks a half unit out from the body, with a hub decal on the outer face; a thin wheel vanishes at the smallest size (Car, Truck, Train, 2026-10-19).
- A flat slab looks like a sign from the side: give a cloud or a bush a height map, taller in the middle (Cloud, 2026-10-19).
- A roof's back slopes must be drawn too (faces `-x` and `-y`), or a spun house shows a hole (House, 2026-10-19).

## 11. Changelog

- **Version 1, 2026-10-19.** First version: blocks, decals and slopes as JSON; rules 1 to 9; the check R1 to R12. Owner: "produce an art contract as well so that just like [Arrow-Rama] does, so that we can talk to other agents and other models to create art that we can bring back to you for integration as new stamps."
