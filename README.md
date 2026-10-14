# Isopix 🔺

**Draw it: https://isopix.pdxfixit.com** (works offline; add it to your home screen).

A touch drawing app on an isometric (triangular) grid. Your finger fills grid
cells instead of drawing a thin line. **The grid size is the brush size**: big
cells give bold, chunky strokes; small cells give fine detail. Made for grown-ups who
doodle and for kids: big touch targets, minimal chrome, nothing gated, no ads, no accounts, no
server, no analytics.

Plain HTML, CSS and ES modules with Canvas 2D and Pointer Events. No framework,
no build step, no dependencies. Installable and offline (manifest and service
worker). The original design brief is [docs/design-brief.md](docs/design-brief.md).

## Run it

```
just serve          # http://localhost:8790/ (and the LAN address it prints)
just test           # syntax check, then the engine tests in plain node
just look           # every width in a private headless Chrome
just export-check   # PNG, SVG and project round trip
```

No `just`? `python3 tools/serve.py 8790` serves the app, and `node --test test/`
runs the tests. Installing and offline need `localhost` or https; a phone on the
LAN gets the app, but not the install.

## Using it

- **Draw**: Pencil, then drag. Two fingers pan and pinch-zoom. With a mouse:
  drag draws, middle button or Space + drag pans, Ctrl + wheel (or a trackpad
  pinch) zooms, the wheel pans.
- **Zoom rail** (left edge): zoom in at the top, a slider (each step doubles
  or halves the zoom), zoom out, and ⌖ Fit drawing (frames everything drawn;
  on empty paper, back to the start). On a short screen (under 580 px
  tall, or a phone held sideways) only the two buttons show.
- **Grid size**: the column of hexagons, big to small (a bar along the top on a tablet).
  By default the level **follows zoom**: a notch picks a brush size on screen,
  and the app picks the level that gives it as you zoom. The **lock** freezes
  the level; then a notch is an absolute level (0 biggest, 7 smallest) and
  zooming only changes the view. The lock shows the level in use.
- **Brush shapes** (the button at the end of the tool row): triangle, rhombus
  (a cube face), hexagon (a little cube), trapezoid (half a hexagon), big
  triangle, drag a face, drag a cube, and stamp.
- **Line**: drag; it locks to the three grid directions. Styles: Strip (a strip
  of cells) and Edge (a bold line on the grid lines).
- **Fill**: fills at the current grid size, only what you can see.
- **Select**: choose triangle, rhombus or hexagon, press a grid point and drag.
  Then **Finer** / **Coarser** change the cell size inside it (or drag the
  round handle up and down). **Crisp** keeps the main color when merging;
  **Blend** averages. Coarsening keeps the detail hidden: going finer again
  brings it back, until you paint there. **Save as stamp** turns the selection
  into a brush.
- **Auto-shade** (the cube swatch): one color becomes three tones by cube face:
  top light, left mid, right dark.
- **Drawing** (top left, `D`): the drawing's name and big buttons for New,
  Open, Save file and Save picture, plus Save vector (SVG) and Time-lapse. From
  700 px wide, New, Open and Save also sit in the top bar.
- **Settings** (⚙️ top right, `M`): folding sections with a chip that shows
  what is set. Drawing (big strokes over fine detail, paper, auto-shade,
  symmetry), Grid (gutters, finer-level hints), Selection (density gestures),
  Learning (limited palette, grayscale, trace a picture, time-lapse) and About
  (version, Help).
- **Help** (`?`): every button, gesture and key.

Keys: P pencil, E eraser, L line, F fill, S select, B brush, [ and ] grid size,
K lock, G gutters, 0 fit the drawing, + and − zoom, Ctrl+Z undo, Shift+Ctrl+Z redo,
Esc clears the selection, M Settings, D Drawing, ? Help.

## Storage

The drawing saves itself to IndexedDB in this browser (with its undo log, so
undo and time-lapse survive a reload). Settings live in `localStorage`.
**Save project** writes a `.isopix.json` file: cells, bold edges, hidden
children, the undo log and stamps. Open checks the file's shape and refuses one
that breaks the grid's rules. Nothing leaves the device.

## Layout

| Path | What it holds |
|---|---|
| `web/` | The site, and nothing else is served. `index.html`, `styles.css`, `app.js` (state, controls, input), `render.js` (Canvas 2D), `storage.js`, `glyphs.js`, `sw.js`, `version.js`, `manifest.webmanifest`, `_headers`, `icons/`. |
| `web/engine/` | Pure logic, no DOM: `lattice.js` (coordinates, hierarchy, lines), `model.js` (cells, undo log), `brushes.js`, `symmetry.js`, `fill.js`, `density.js` (selection, density change, stamps), `svg.js`, `project.js`, `view.js`, `color.js`. |
| `test/` | `node --test` suites for the engine. |
| `tools/` | `serve.py`, `look.mjs` + `chrome.mjs` (headless width check), `export_check.mjs`, `bump_version.py` (semver: PATCH is the commit count), `make_icons.mjs`, `deploy.sh`. |
| `docs/` | `state.md`, `decisions.md`, `questions.md`, `design-brief.md`, `deploy-cloudflare.md`, `environment.md`, `justfile-style.md`. |

## Decisions made

The brief left these open; each is the simplest sensible default. They are
recorded with reasons in [docs/decisions.md](docs/decisions.md):

- Cells point left and right on screen (lattice lines vertical, 30° and 150°,
  the standard isometric cube view), not up and down.
- Marquee shapes: triangle, rhombus and hexagon, all drawn by pressing a grid
  point and dragging; the drag's direction picks the orientation. The press
  snaps to a vertex of the next coarser level so the marquee can be coarsened.
- Follow-zoom notches are on-screen sizes 96 px down to 6 px, even in log
  scale, with hysteresis of ±0.65 level.
- The eraser always erases (it ignores Keep fine detail); undo is the safety net.
- Paint behind keeps every painted cell, at any level.
- Fill is bounded by the visible area; past 40,000 cells it uses bigger cells.
- Stamps scale with the grid level (exactly: a 2× scale about a vertex maps one
  level onto the next).
- Bold edges are kept hidden on coarsen, like cells.
- Each drawing keeps its own paper (light or dark); the inks follow it.
- Limited palette starts with black, gray and white, and "+" adds a color
  (nothing is gated).
- The trace picture saves with the drawing (project file and autosave); a
  photo over 2048 px on its long side is made smaller first. It is never part
  of PNG or SVG export.

## License

[MIT](LICENSE). Isopix is made with care by PDXfixIT.
