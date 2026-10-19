# Lessons

The tutorial, as short lessons on the real canvas. **Status: approved by the owner (2026-10-15), built (release 1.2.64).** The steps live in `web/lessons.js`; this file is the plan they follow.
The owner edits this file (or answers in chat); a changed step is built to match. Decisions behind it: [decisions.md](decisions.md) (Lessons).

## How a lesson runs

- **Where:** on the real canvas, in a **practice drawing**. The tour sets the
  person's drawing aside and starts a blank one; nothing they had is touched.
- **The end:** two buttons, **Keep it** (the practice drawing becomes their
  drawing) and **Back to my drawing** (it is thrown away). When their own
  drawing has something not in a file, Keep it asks the way New does: *Save
  yours to a file first / Replace it / Cancel* (with the gallery, TODO 1, it
  will simply add a drawing).
- **A step** is one bubble pointing at one thing, with one ask. It moves on
  when they do it (no Next button, except on steps that only show something).
  **Skip lesson** and Esc are always there. "Step 2 of 5" shows progress.
- **Per device** (owner: "each device presents unique ways that present in
  the tour"): a step has wording for **touch** (fingers), **mouse** (mouse or
  trackpad, with the key shown when there is one) and **pen**. The tour picks
  by the last pointer used (`pointerType`); before any input, by
  `(pointer: coarse)`. Below, `touch / mouse / pen` marks the variants; one
  wording means it is the same everywhere.
- **Where they start:** the welcome card's **Show me around** opens Basics.
  Help lists every lesson with a ✓ once done (kept per device); each lesson
  there folds, like Settings' sections, so the list is short until opened
  (owner: "keep sections collapsible to make the length less daunting"). Settings →
  About → Show the welcome again still opens the card.
- **Accessible:** each bubble is announced (`aria-live`), the target gets
  focus where it can, motion respects `prefers-reduced-motion`.
- **Drift test:** every tool, brush, line style, selection shape, selection-bar
  button, color control, grid and zoom control, top button and Drawing-sheet
  button in `web/help.js` must be named by a lesson step, or be on a short
  skip list with its reason (for example the experimental pinch gestures).

## The lessons

Each lesson folds; open the one you are editing.

<details>
<summary><b>Basics (from the welcome card)</b> (6 steps)</summary>

1. **Draw.** The tour picks the Pencil and the Triangle brush.
   *Drag a finger across the paper / Click and drag / Draw with the pen.*
   Done: a stroke of 3 or more cells.
2. **A cube.** The tour picks the Hexagon brush; the bubble points at the
   shapes button so they see where it came from.
   *Tap the paper: a whole cube, shaded for you / Click the paper / Tap with the pen.*
   Done: a Hexagon stroke.
3. **Size.** Points at the size rail (phone: the slim rail on the right;
   tablet and computer: the bar on top).
   *Pick a bigger hexagon, then tap again / Click a bigger hexagon (or press [), then click / same as touch.*
   Done: the level changed, then a stroke.
4. **Undo.** *Tap Undo / Click Undo, or Ctrl+Z / Tap Undo.*
   Done: an undo.
5. **Move and zoom.**
   *Two fingers: drag to move, pinch to zoom. Or use the rail on the left /
   Scroll to move, Ctrl+scroll (or pinch the trackpad) to zoom, or the rail on
   the left / Use the rail on the left, or the hand to move.*
   Done: the view moved or zoomed. Then: *Tap ⌖ to bring your drawing back.*
   Done: Fit.
6. **End.** *That's the basics. More lessons are in Help (?).* Keep it /
   Back to my drawing.

</details>

<details>
<summary><b>Colors and shading</b> (4 steps)</summary>

1. **Pick a color.** Points at the palette. Done: the color changed.
2. **Any color.** Points at the eyedropper. *Pick a color of your own.* The
   system picker differs on each device; this step has Skip. Done: a custom color.
3. **Auto-shade.** The tour picks the Hexagon brush.
   *Turn auto-shade off (the cube button), then tap the paper: one flat color.*
   Done: a flat cube. *Turn it back on.* Done: auto-shade on.
4. **Why a triangle is flat.** Shows only: *One triangle has no face of its own,
   so it paints flat. The Hexagon, three-triangle and cube brushes shade.* Next.

</details>

<details>
<summary><b>Fill and erase</b> (3 steps)</summary>

1. **Fill.** The tour draws nothing; they use their cube from before (or the
   tour places one). *Pick another color, then the Fill bucket, then tap a face
   of the cube.* Done: a fill. Shows: the shading stayed.
2. **Erase.** *Pick the Eraser and drag over something / click and drag / draw with the pen.*
   Done: an erase stroke.
3. **Color brings the Pencil back.** *Tap a color.* Done: the tool is the Pencil.

</details>

<details>
<summary><b>Brush shapes</b> (3 steps)</summary>

1. **Small shapes.** Points at the shapes button. *Try the Rhombus, the
   Trapezoid and the Big triangle.* Done: strokes with 3 different shapes.
2. **Drag a face.** *Drag to size a cube face.* Done: a face stroke.
3. **Drag a cube.** *Drag to size a cube.* Done: a cube stroke.

</details>

<details>
<summary><b>Lines</b> (2 steps)</summary>

1. **Strip.** *Pick Line and drag: it snaps to the three grid directions.*
   Done: a line.
2. **Edge.** *Open the line styles, pick Edge, drag along the grid lines.*
   Done: an edge line.

</details>

<details>
<summary><b>Big over small</b> (3 steps)</summary>

1. **Detail.** *Pick a small size and draw a little.* Done: a stroke at level 5 or finer.
2. **Keep.** *Pick a big size and draw over it: the striped cells are kept.*
   Done: a stroke that skipped cells.
3. **The chip.** Points at Keep. *Tap it: Behind fills only empty parts,
   Replace paints over everything.* Done: the mode changed.

</details>

<details>
<summary><b>Selecting</b> (5 steps)</summary>

1. **Select.** *Pick Select, press a grid point and drag out a hexagon.*
   Done: a selection.
2. **Coarser.** *Tap Coarser: four cells become one.* Done: coarser.
3. **Finer.** *Tap Finer: the detail comes back.* Done: finer.
   *(touch: or drag the round handle up and down.)*
4. **Crisp or Blend.** Shows only: what each does. Next.
5. **Done.** *Tap Done (or Esc).* Done: no selection.

</details>

<details>
<summary><b>Stamps</b> (3 steps)</summary>

1. **Save one.** *Select something, then Save as stamp (on a phone, under More).*
   Done: a stamp saved; the tour shows the Stamp brush is picked.
2. **Place it.** *Tap the paper.* Done: a stamp placed.
3. **It scales.** *Pick another size and place it again.* Done: placed at another level.

</details>

<details>
<summary><b>Symmetry</b> (3 steps)</summary>

1. **Turn it on.** Opens Settings → Drawing. *Pick 6-fold rotation.* Done: symmetry on.
2. **Draw.** *Draw a little: six copies.* Done: a stroke.
3. **Turn it off.** *Pick Off.* Done: symmetry off.

</details>

<details>
<summary><b>Saving and sharing</b> (4 steps)</summary>

1. **Name it.** Opens the Drawing sheet. *Roll a silly name, or type one.* Done: the name changed.
2. **Save drawing.** Per device: *iPhone and iPad: the share sheet opens, pick
   Save to Files / Chrome or Edge on a computer: choose a place once / elsewhere:
   it goes to your downloads.* Skip allowed. Done: saved.
3. **Save picture and Sharp picture.** Shows only: Save picture is the one to share or print; Save drawing is the one that opens again here. Next.
4. **Watch it being drawn.** *Tap ▶ to watch your drawing being made.* Done: replay started.

</details>

<details>
<summary><b>Learning tools</b> (3 steps)</summary>

1. **Grayscale view.** Settings → Learning. *Turn on Grayscale: check that
   your tops are light and your sides dark.* Done: on, then off.
2. **Limited palette.** Shows only: start with 3 tones, + adds one. Next.
3. **Trace a picture.** Shows only: put a photo under the grid. Next.

</details>

## Skip list (not in any lesson)

- Pinch inside a selection, long-press then pinch: experimental, off by default.
- The Words section of Help: definitions, not controls.
- Settings → Display (folded colors, gutters, finer-level hints): view preferences.
