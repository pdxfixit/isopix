# Isopix 🔺

**Draw it: https://isopix.app** (works offline; add it to your home screen).

A touch drawing app on an isometric (triangular) grid. Your finger fills grid
cells instead of drawing a thin line. **The grid size is the brush size**: big
cells give bold, chunky strokes; small cells give fine detail. Made for grown-ups who
doodle and for kids: big touch targets, minimal chrome, nothing gated, no ads, no accounts, no
server for your drawings.

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

- **Draw**: Pencil, then drag. Two fingers pan and pinch-zoom; a first finger
  that had not really drawn yet is taken back, and the finger left after a
  pinch keeps panning. **Move** (the hand at the top of the zoom rail, `H`):
  one finger moves the view and draws nothing, until you tap it or a tool. With
  a mouse: drag draws, middle button or Space + drag pans, Ctrl + wheel (or a
  trackpad pinch) zooms, the wheel pans.
- **Zoom rail** (left edge): the Move hand at the top, zoom in, a slider (each step doubles
  or halves the zoom), zoom out, ⌖ Fit drawing (frames everything drawn;
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
- **Stamp**: pick one in the Stamps drawer, then tap (or press and slide to
  aim). The stamp just placed stays outlined with a round handle out from its
  foot: drag it round the foot to turn it, as Drag a face picks its face (3D
  stamps face that way; flat ones and letters lie on the floor or a wall); drag
  it out for bigger, in for smaller (quarter steps while small, made of finer cells so
  the edges stay clean; then halves, then whole steps), or use − and + on the
  stamp bar (`,` and `.` on a keyboard). The cube button lays a flat stamp or
  a letter on the floor or a wall; Spin (`R`) turns a 3D stamp a quarter turn. The next stamps keep that size and place; the
  next tap, another tool or Undo finishes it.
  Every stamp from every side: [docs/stamps/](docs/stamps/README.md). New ones come in by
  [the stamp art contract](docs/stamp-art-contract.md).
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
  Open, then Save drawing (reopens in Isopix) and Save picture (to share or
  print), Sharp picture (SVG) and Watch it being drawn. From
  700 px wide, New, Open and Save also sit in the top bar.
- **Settings** (⚙️ top right, `M`): folding sections with a chip that shows
  what is set. Drawing (big strokes over fine detail, paper, auto-shade,
  symmetry), Grid (gutters, finer-level hints), Selection (density gestures),
  Learning (limited palette, grayscale, trace a picture, time-lapse) and About
  (version, Help).
- **Help** (`?`): every button, gesture and key.
- The tiny text in the bottom-right corner is the release and the commit it was built from.

Keys: P pencil, E eraser, L line, F fill, S select, B brush, [ and ] grid size,
K lock, G gutters, H move, 0 fit the drawing, + and − zoom, Ctrl+Z undo, Shift+Ctrl+Z redo,
Ctrl+S save, Ctrl+Shift+S save as a new file, Ctrl+O open,
Esc clears the selection (and leaves Move, folds the colors, ends clean view), T hides or shows the controls (clean view), M Settings, D Drawing, ? Help.

## File format

A drawing is a JSON document anyone can read, write or draw without Isopix:
[spec/README.md](spec/README.md) (the Isopix file format 1.0, public domain
under CC0), with a JSON Schema, examples, and two small reference renderers
that turn a file into SVG (`python3 spec/render-svg.py drawing.isopix.png`).

## Storage

A browser keeps several drawings (Drawings, on the Drawing sheet; `web/gallery.js`).
The drawing in use saves itself to IndexedDB 800 ms after each change,
and at once when the app is put away (with its undo log, so undo and time-lapse
survive a reload). Isopix asks the browser to keep that storage (not Firefox,
which would prompt). If the browser will not store it (a private window), a
notice says so once, with a Save drawing button. Besides the autosave it keeps
up to three older copies, at most one per 5 minutes (`web/autosave.js`): if the
autosave cannot open, the newest copy that does opens instead, and the app says
so. A person's own stamps and palettes are kept in IndexedDB too, for every
drawing in this browser. Settings live in `localStorage`.
**Save drawing** writes a PNG picture with the whole project inside
(`name.isopix.png`; `web/engine/pngproject.js`): it opens in any photo app,
and Open reads the drawing back out. Settings → Drawing → "Save as a
picture" off (not offered on iPhone and iPad) makes it write an `.isopix` file
(the project JSON, gzip-compressed). Either holds the cells, bold edges,
hidden children, the undo log and stamps; older `.isopix.json` files still open. How it saves depends on the device
(`saveMethod` in `web/storage.js`): Chrome and Edge on a computer show their
Save dialog once and then write the same file on each Save (the file handle
is kept in IndexedDB); iPhone and iPad open the share sheet (Save to Files),
since a download there is unreliable; everything else downloads. Once the
drawing is in a file, a dot on Save marks changes since; New and Open ask
first when something drawn is not in a file. Open
checks the file's shape and refuses one that breaks the grid's rules. The
drawing never leaves the device.

**Usage events** (on by default; Settings → Share play data, at the bottom): which
buttons, tools, keys and settings were used, how long a sitting lasted and the
kind of device, sent to the site's own Worker with one random device code that
never changes. Never the drawing, names, anything typed or the IP address.
What is sent is told in one place, the shared
[privacy policy](https://privacy.pdxfixit.com/isopix/), which the switch links. Its text is [docs/privacy-policy.md](docs/privacy-policy.md); `just policy` sends it to pdxfixit/privacy.
Detail: [docs/telemetry.md](docs/telemetry.md).

**Feedback** (Settings → About, beside the version): after a grown-up answers
a sum, a box sends what you type into it, and only that, when you press Send.
It goes to the owner only, as plain text, with no name and no IP address
stored, and is kept 90 days. It is never part of the usage events. Please
don't put names or contact details in it: nobody can write back.

## Layout

| Path | What it holds |
|---|---|
| `web/` | The site, and nothing else is served. `index.html`, `styles.css`, `app.js` (state, rendering, wiring) and `ui/` (controls, tools, input, sheets, files, the live stamp), `render.js` (Canvas 2D), `storage.js`, `gallery.js` (the list of drawings, pure), `stampbook.js` (starter and own stamps, pure), `palettes.js` (preset and own palettes, pure) and `stamps.js` (the starter art, packed by `stamppack.js`, made by `tools/make_stamps.mjs`), `autosave.js` (autosave copies, pure), `events.js` (usage events, the shared standard) on `events-client.js` (vendored from flarepress), `feedback.js` (Feedback's grown-up check and request, pure; its dialogs are `ui/feedback.js`), `glyphs.js`, `welcome.js` (the first-visit card), `lessons.js` (the lessons' steps, pure) and `tour.js` (the lesson bubble), `loading.js` (the loading screen), `sillynames.js`, `sw.js`, `version.js`, `manifest.webmanifest`, `_headers`, `icons/`. |
| `web/engine/` | Pure logic, no DOM: `lattice.js` (coordinates, hierarchy, lines), `model.js` (cells, undo log), `brushes.js`, `symmetry.js`, `fill.js`, `stampart.js` (the starter stamps the app draws itself: flat pictures, planes, the block font, turning by depth), `stampmodels.js` (the box stamps as 3D models, for Spin), `density.js` (selection, density change, stamps), `svg.js`, `project.js`, `pngproject.js` (the project inside a PNG), `view.js`, `color.js`, `gesture.js` (drawing or moving the view). |
| `worker/` | The isopix.app Worker: `index.js` (`POST /api/events` into R2, and `POST /api/feedback` into the shared feedback bucket, both through `events-worker.js`, vendored from flarepress; everything else to the static files) and `schema.sql` (no tables: the retired visit table's drop). |
| `test/` | `node --test` suites for the engine. |
| `tools/` | `serve.py`, `look.mjs` + `chrome.mjs` (headless width check), `export_check.mjs`, `bump_version.py` (semver: PATCH is the commit count), `make_icons.mjs`, `deploy.sh`, `doctor.sh` (`just doctor`), `ci_wait.sh` (`just ci-wait`), `install_check.mjs` and `move_check.mjs` (`just install-check`, `just move-check`), `stampsheet.mjs` (the stamp art sheets), `archive_agent.sh` (`just archive-agent`). |
| `docs/` | `state.md`, `decisions.md`, `questions.md`, `design-brief.md`, `deploy-cloudflare.md`, `environment.md`, `justfile-style.md`, `privacy-policy.md` (the public policy's text). |

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
  level onto the next), and by any whole number at one level (a cell becomes k²
  cells), so every size is exact.
- Bold edges are kept hidden on coarsen, like cells.
- Each drawing keeps its own paper (light or dark); the inks follow it.
- Limited palette starts with black, gray and white, and "+" adds a color
  (nothing is gated).
- Palettes: the square tile at the start of the colors opens your own
  palettes, then the presets. Presets never change: a color you pick with the
  eyedropper on one makes your own copy with it, so no picked color is lost.
- The trace picture saves with the drawing (project file and autosave); a
  photo over 2048 px on its long side is made smaller first. It is never part
  of PNG or SVG export.

## License

[MIT](LICENSE). Isopix is made with care by PDXfixIT.
