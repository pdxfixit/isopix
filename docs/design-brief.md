# Isopix: the original design brief

> **What this is.** The owner's original design brief for Isopix, written 2026-10-12, before
> the first version was built. It is background, not a task list: everything in its
> "Suggested first deliverable" was built and is live, except a report on how it feels
> on a real touchscreen (see [state.md](state.md), "Not verified").
> [decisions.md](decisions.md) outranks this file wherever they differ (for example,
> cells point left and right on screen, not up and down, and "Protect fine detail" is
> now called **Keep fine detail**). Open work lives in [../TODO.md](../TODO.md) and
> open questions in [questions.md](questions.md).
>
> Copied into the repo on 2026-10-12 so a fresh session can read it. The owner's notes held
> the first copy; this one is now the reference. Notes in [square brackets] were added
> when it was copied.

Isopix is a touch drawing app on an isometric grid. Your finger fills grid cells instead of drawing a thin line. **The grid size is the brush size**: a big grid gives bold, chunky strokes; a small grid gives fine detail.

Audience: The owner first (a dad goofing around in an artistic setting), the kids second. Kid-friendly and artist-leaning. The goal is the basics, plus tools that grow creative ideas and confidence, and quietly teach artistic skills (value, shape, blocking in, light and shadow).

Platform: web. [Version 1 was built and published on 2026-10-12 as Isogrid; it was renamed Isopix and released as 1.0 at https://isopix.pdxfixit.com on 2026-10-13.]

## Words used here

- **Lattice**: the isometric grid, made of equilateral triangles in horizontal rows.
- **Cell**: one triangle of the lattice. Every cell points up or down. [Built rotated: cells point left and right on screen, so the lattice lines are vertical, 30° and 150°. The code still calls the two kinds `u` = up and down. See decisions.md, Lattice and model.]
- **Level**: how fine the grid is. Level 0 is the coarsest. Each level up halves the edge length of a cell. A level is a brush size.
- **Gutter**: the hairline between two cells.

## Core model

1. **The atom is the triangle.** Two triangles make a rhombus (one cube face). Six make a hexagon. Everything else is built from triangles.
2. **Cells subdivide.** One triangle splits into four: three corner triangles that point the same way as the parent, and one inverted triangle in the middle. This is exact, so a drawing can mix levels with no resampling.
3. **One canvas, mixed levels.** The canvas is a sparse map from cell to color. Rule: any region is covered by one coarse cell *or* by its descendants, never both. Painting a coarse cell over fine cells replaces them. Undo brings them back.
4. **Zoom never changes data.** Zoom is only the view. Grid level is a separate setting from zoom.

Cell key: `(level, row, col, up/down)`. The agent picks the exact coordinate scheme and must test the subdivision and parent/child math before building on it.

## Drawing

- **Pencil**: drag to fill the cells under the finger at the active level. Sample along the finger path so fast strokes leave no gaps.
- **Brush shape**, snapped to the lattice:
  - **Triangle**: one cell.
  - **Rhombus**: the touched cell plus its neighbor across the nearest edge.
  - **Hexagon**: the six cells around the nearest vertex.
  - **Trapezoid**: half a hexagon, 3 cells.
  - **Big triangle**: 4 cells, one triangle of the next coarser level painted with finer cells.
  - **Drag-sized parallelogram face**: drag out a cube face of any size.
  - **Drag-sized hexagon or cube**: drag out a hexagon of any size.
  - **Stamp from selection**: save any selection as a reusable brush.
  - The first build includes all of these, so the owner can try each.
- **Line tool**, drag a straight line locked to the three isometric axes (vertical, 30°, 150°). It has styles, picked from a style control:
  - **Strip**: fills the strip of cells under the line. Shown in the mockup.
  - **Edge**: a bold line that sits on lattice edges, with weight tied to the active level.
  - More styles (dashed, double) can follow.
- **Grid level control**: a *chunked slider* (it snaps to notches). Use as many notches as the data model allows: 8 in the mockup. Levels are powers of two only, because that keeps every cell a whole triangle. The slider's layout adapts to screen size (a vertical edge slider on a phone, a horizontal bar on a tablet). Shrinking triangle glyphs show how fine each notch is.
- **Level follows zoom, with a lock.** By default the brush keeps roughly the same size on screen: the slider sets that on-screen size, and the app picks the matching level as the user zooms (with hysteresis, so it does not flicker at a boundary). A lock toggle on the slider freezes the level instead. Locked, the slider means an absolute level, and zooming only changes the view. Zoom is continuous and levels step by 2×, so the on-screen cell size varies between about 0.7× and 1.4× of the target between steps.
- **Pan and deep zoom** are required, because the finest levels are too small to see at normal zoom.
- **Protect fine detail** [now named **Keep fine detail**, with Paint behind and Replace as the other modes] (toggle, on by default): a coarse stroke skips cells that already have finer detail inside them, instead of replacing it. This matters more because the level follows zoom, so a user who zooms out and paints can otherwise wipe out fine work.
- **Fill bucket** (respects the active level), **eraser**, **undo/redo**, **palette**.
- **Symmetry**: 6-fold rotation plus mirror around a lattice vertex. Apply each stroke through the lattice symmetry group so it is exact.

## Rendering

- **Gutters are a render effect, not data.** Their opacity and thickness follow on-screen cell size. Zoomed in they show clearly; zoomed out they fade to nothing. A toggle hides them.
- Rule: draw gutters for the active level and coarser levels, faded by on-screen edge length. Also draw the next finer levels fainter, as a hint of what a finer stroke would do.
- Settings for the hints: strength (off, faint, clear) and how many finer levels show (1 to 3).
- Watch for hairline seams between adjacent same-color cells caused by antialiasing. Overlap cells slightly or merge them into one path.

## Auto-shaded cube faces

Pick one color and the app shades it by cube face: top light, left mid, right dark. This makes drawings read as 3D and teaches value.

Geometry note: a face is a *rhombus*, not a single triangle. A rhombus has three orientations (top, left, right), set by which edge its two triangles share. So shading is keyed to the rhombus brush's orientation. A cell may need an optional face tag so a later recolor keeps its shading. The agent should confirm this in a prototype.

## Selection and density change

- **Selection tool**: a crosshair placed on the lattice, and a marquee made of triangles instead of a rectangle. The agent proposes the marquee shapes (triangle, rhombus and hexagon are the natural ones) and how to drag them out.
- **Gesture for density change** is to be decided by trying it. The prototype makes the gesture a swappable setting, with these candidates:
  1. **Buttons**: visible finer and coarser buttons beside the marquee. Always provided, so the feature works without a gesture (screen readers, accidental-touch safety).
  2. **Handle**: drag a handle on the marquee corner through the level notches, like a slider.
  3. **Pinch inside the selection**: pinch out is finer, pinch in is coarser. A pinch that starts outside the selection zooms the view.
  4. **Long-press, then pinch**: an explicit density mode.
  
  Pinch is crowded, because zoom also changes the level unless it is locked. Default to buttons plus handle, and keep pinch as an experimental setting. Any gesture previews live, with a tick at each level notch, and commits when the fingers lift. Undo reverses it.
- **Change density** of the selected region:
  - **Finer** is lossless. Each cell splits into four children with the same color.
  - **Coarser** is lossy. Four children collapse into one parent. Only this operation, and only when the user asks, may lose detail.
- Coarsening needs the selection boundary to lie on the target level's edges. The marquee snaps to the target level, with a live preview. Coarse cells that straddle the selection border split first, so the border can mix levels.
- **Coarsen color rule.** Two modes, chosen per operation. There is no automatic mode: from the four children alone, the app cannot tell a shape edge (where Crisp is right) from a dither or gradient (where Blend is right), because both look like an even split.
  - **Crisp**: majority color of the four children. Default. Keeps palettes clean and edges hard. Tie-break: the most recently painted child.
  - **Blend**: average color, computed in a perceptual color space (Oklab). It suits gradients, dithering and soft backgrounds. It softens edges, and it blurs the three tones of auto-shaded faces. Option: *snap to palette*, which maps the result to the nearest palette color. In limited-palette mode this option is always on.
  - The mode toggle sits in the live preview, so one tap flips Crisp and Blend with no reselecting. The last choice is remembered.
  - Possible later: an automatic mode that looks at neighboring cells to tell edges from texture.
- **Keep fidelity as long as possible.** A coarsened cell keeps its children hidden underneath. Refining it again restores them exactly, until the user paints on that cell. Cost: extra memory. The agent may offer this as a setting.

## Bold lines as edge data

Bold lines are stored per lattice edge, keyed `(level, edge)`. Refining splits an edge into two. Coarsening drops edges that do not lie on the target level's lattice, or keeps them hidden like the cell children.

## Learning features (candidates)

- **Limited palettes**: start with 3 tones, unlock more. Constraint is how artists learn.
- **Trace mode**: a faded reference photo under the grid.
- **Fearless undo**: unlimited undo, plus a time-lapse replay from the stroke log.
- **Block in, then refine**: draw rough shapes at a coarse level, then refine. Density change supports this directly.
- **Grayscale view toggle**: a quick value check.

## Output

PNG export, SVG export (merge same-color cells into polygons), a project file (a stroke log is enough), and time-lapse replay.

## UI principles

Big touch targets, minimal chrome, nothing gated. Pressure sensitivity and layers are later. No ads, no accounts, no server, in the spirit of Arrow-Rama [another of the owner's apps].

## Open decisions

1. **Marquee shapes and drag gesture**: left to the agent's proposal.
2. **Density-change gesture**: decided by trying the candidates in the app.
3. **Coarse stroke over fine detail**: protect (skip those cells) is the default. A variant, *paint behind*, would fill only the empty parts of those cells and keep the detail. Worth trying, since it suits painting a sky behind a drawing.

## Platform

Web, chosen for simplicity. Suggested constraints, which the agent may revise with a reason:

- Static files only: no server, no accounts, no analytics. Projects save to the browser (IndexedDB) and export to a file.
- No framework and no build step: plain ES modules, Canvas 2D, Pointer Events for touch, mouse and pen.
- Installable and offline-capable (a web app manifest and a service worker), so it works on the Pixel and on a tablet.
- The engine (lattice math, hierarchy, brush, fill, selection, resample, symmetry, undo log) is pure logic with no rendering in it, with tests that run in Node.
- Working folder: this repo (`github.com/pdxfixit/isopix`). All served files live in `web/`; tests, tools and docs live outside it.
- Hosting: https://isopix.pdxfixit.com, deployed with flarepress (the owner's Cloudflare deploy repo; its folder `isopix.pdxfixit.com/` has a `public` link to this repo's `web/`), the same way as Noodle Pads [another of the owner's sites]. Every workflow has a `just` recipe, in the owner's Justfile house style. [See [deploy-cloudflare.md](deploy-cloudflare.md) and [justfile-style.md](justfile-style.md).] `AGENTS.md` is the agent contract and `CLAUDE.md` imports it.

## Suggested first deliverable

A first working version of the web app, usable on a phone, to test how it feels. It needs: the lattice and subdivision math with tests, a pencil with the chunked grid-level slider (with the zoom lock), every brush shape listed above, the line tool in both styles, gutters that fade with zoom plus the finer-level hints, protect fine detail, and a selection with density change in both directions using the swappable gestures. Report what felt right and wrong on a touchscreen.
