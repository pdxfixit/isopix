# State

Present tense: what exists, what is in flight, what waits on the owner.

## What exists

Isopix 1.0: a public repo (`github.com/pdxfixit/isopix`, MIT) whose history starts at release 1.0.1 on 2026-10-13. It was built from 2026-10-12 as Isogrid, from the owner's [design brief](design-brief.md), and lived at its old address; that history is in a private, archived repo. The site is https://isopix.pdxfixit.com. Hosting: [deploy-cloudflare.md](deploy-cloudflare.md).

**Engine** (`web/engine/`; `test/` holds the `node --test` suites):

- Lattice math: coordinates, hit test, children/parent, the six cells around a vertex, edge neighbors, hexagon distance, the three line families, edges and their refine/coarsen. The brief's verified math is proven by tests, including its three prototype checks.
- The cell model with the one-cell-or-children invariant, `sub` counts, Keep fine detail / Paint behind / Replace, and a diff-based undo log that also drives previews (rollback) and time-lapse replay.
- Brushes: triangle, rhombus, hexagon, trapezoid, big triangle, drag-sized face, drag-sized cube, stamp. Line Strip and Edge. Cube-face tags.
- Fill over stored cells (never 4ᵏ tiny cells), bounded on empty paper; past 40,000 cells it fills bigger cells.
- Papers: each drawing keeps its own (light or dark), saved with it; the inks follow it (`engine/paper.js`).
- Symmetry: the exact 12-element group around a vertex (mirror, 6-fold, both), faces follow.
- Selection regions, density change both ways (Crisp, Blend in Oklab, snap to palette), hidden children (and bold edges) restored on refine until painted on, marquee snapping, stamps that scale with the level.
- SVG export (merged polygons with holes), project files (shape-checked on load).

**App** (`web/`): the canvas with fading gutters and finer-level hints; tools, brush picker, palette with auto-shade and a custom color, the chunked level slider of hexagons (a rail hanging under the top buttons on phones, a top bar from 768 px) with follow-zoom and lock; pan and zoom (pinch, Ctrl+wheel, trackpad pinch, wheel pans, and the zoom rail on the left edge: zoom in, a log-scale slider, zoom out, ⌖ Fit drawing; `test/view.test.mjs`, `just look zoom fit`); a palette whose add-color and auto-shade buttons stay pinned while the inks scroll; on short landscape screens one bottom row; the selection bar (Finer, Coarser, Crisp/Blend, Snap, Save as stamp, Erase, Done), the density handle with a notch track, and the experimental pinch-inside and long-press-then-pinch gestures; the top bar's Drawing button and sheet (name, New, Open, Save file, Save picture, SVG, time-lapse; New, Open and Save also in the bar from 700 px) and ⚙️ Settings in folding sections (Drawing, Grid, Selection, Learning, About) with value chips; picking a color while the Eraser is on switches to the Pencil; autosave to IndexedDB; manifest and a network-first service worker.

**Saving** (2026-10-14, branch only, see In flight): Save picks the way per device (`saveMethod` in `web/storage.js`): the browser's Save dialog once, then the same file each Save (Chrome, Edge on a computer; the handle is kept in IndexedDB); the share sheet on iPhone and iPad; else a download. Ctrl+S, Ctrl+Shift+S (save as new file) and Ctrl+O. A dot on Save marks changes not in a file; the Drawing sheet's file line says which file and whether it changed; New and Open ask first only then. The autosave also runs at once when the page is hidden; `navigator.storage.persist` is asked for (not in Firefox); a private window gets a one-time notice with Save file (`just look save-file`, `test/sheets.test.mjs`, `test/storage.test.mjs`).

**Moving house** (2026-10-15, branch only): https://isopix.app is the home; isopix.pdxfixit.com and the old Isogrid address carry a browser's drawing, settings and file record over in the `#move=` fragment and go (`web/move.js`, `test/move.test.mjs`, `just move-check`, in CI).

**Drawing or moving** (2026-10-14, branch only): the Move hand at the foot of the zoom rail (and `H`) makes one finger pan; a tool tap, the hand or Esc ends it. A second finger takes back a stroke under 500 ms old or under 24 px long; the finger left after a pinch pans (`web/engine/gesture.js`, `test/gesture.test.mjs`, `just look move pinchpan`).

**Keep fine detail made visible** (named Protect until 2026-10-12): the Keep / Behind / Replace chip by ⌖ (the same tipped fill can as the Fill tool, the word tells the mode), hatched skipped cells in the hover preview and after a stroke, and a once-a-session "skipped N cells" notice (`web/engine/protect.js`, `test/protect.test.mjs`, `just look protect hoverskip`). The owner's "larger tile isn't overpainting" report was this mode: reproduced in headless Chrome (a level-2 tile over level-5 detail: Keep and Paint behind keep the detail, Replace overpaints, with or without follow-zoom, symmetry or drag brushes).

**Update notice**: when a newer deploy is live, "🆕 An update for Isopix is ready." floats above the bottom bars with Reload (saves, lets the new service worker take over, reloads) and ✕; it waits while you draw or have a menu open (`web/update.js`, tests in `test/update.test.mjs`, `just look update updatesel`).

**Build stamp**: the release and deployed commit, tiny, in the bottom-right corner (`buildStamp` in `web/update.js`; the commit is `version.json`'s `commit`, which flarepress's stamp writes).

**Cell layer cache**: the cells are drawn to an offscreen bitmap a little larger than the screen (`web/layer.js` decides blit, patch or full redraw; tests in `test/layer.test.mjs`). Panning moves the bitmap, painting redraws only the changed area (the model records changed keys), and zoom redraws at the new scale.

**Help**: Settings → About → Help or `?` opens a sheet of every control (with its icon), gesture and key, generated from the same key table the app binds (`web/help.js`, `web/keys.js`, `test/help.test.mjs`, `just look help`).

**Tools**: `just serve | test | look | version | export-check | perf | prove | live-check | icons`, plus the deploy recipes from `deploy.just` (`deploy-check | deploy-plan | deploy | deploy-verify | live | rollback | ship`). `test/docs.test.mjs` keeps the docs honest: every recipe and look view they name exists, every link and repo path resolves, and AGENTS.md stays under 16,000 bytes.

**Hosting**: flarepress has the site folder `isopix.pdxfixit.com` (its `public` links to `web/`; its `site.conf` configures the shared `flarepress/tools/site.sh`, which `tools/deploy.sh` calls for check, stamp, verify, live and rollback); its first publish is release 1.0.1. First install on a real device (install to the home screen, offline start) is not yet tried. Recipes and rollback: [deploy-cloudflare.md](deploy-cloudflare.md).

## Verified, and how

- Engine and tools: `just test`, 143 Node tests (including `test/docs.test.mjs`, `test/names.test.mjs` and `test/sw.test.mjs`) and 11 Python tests pass (2026-10-14). On the branch, `just look` on all 22 views passes in light and dark at every width, and at 360 px tall; `just export-check` passes.
- Output: `just export-check`, 26 checks pass (PNG face colors, SVG merge, project round trip with undo, the cached layer against a fresh redraw, the trace picture).
- Layout: CI runs `just look` on every view in light mode at 320, 375, 700, 900 and 1100 px on each push (see `.github/workflows/test.yml`); green on `d6305fb`.
- Offline: in headless Chrome the service worker registers, controls the page, and the app boots with the network off.
- In the Browser pane with a mouse: strokes, the selection marquee, Finer, and the handle drag. By pointer events dispatched from script: every brush, line styles, fill, symmetry (12 images), Keep/behind/replace, two-finger pinch zoom (a young stroke is dropped), pinch-inside and long-press-then-pinch density, stamps, follow-zoom hysteresis and the lock, replay, trace, grayscale.
- Drawing speed (`just perf`: 38,400 cells, 1024×768 at 2×, headless Chrome on the owner's Mac, each frame timed through a 1-pixel read so the GPU work counts; median / p95 ms): before the cell-layer cache pan 28.9 / 32.2, zoom 26.2 / 28.5, draw 30.1 / 34.1; with it pan 4.5 / 23.4 (the p95 is the redraw when a pan leaves the cached margin), zoom 14.9 / 25.1, draw 12.8 / 15.0. Latest run (2026-10-12, `d6305fb`): pan 5.3 / 24.6, zoom 16.3 / 27.1, draw 13.7 / 15.5. The bar for changes is in [decisions.md](decisions.md) (Shipping). `just export-check` proves the cached layer matches a fresh redraw pixel for pixel after strokes, symmetry, erase, density changes, undo, redo, pan and zoom.

## Not verified

- Real multi-touch on a phone or tablet (pinch feel, two-finger pan, long-press timing, palm and accidental touches), pen input, and speed on the Pixel. Only simulated.
- Installing to a home screen (needs https or localhost on the device).
- Screen-reader use end to end (labels and roles are in place; no screen reader was run).

## Try first (for the owner, on the phone)

Once the branch is live:

1. Tap the hand at the foot of the zoom rail and drag with one finger: the view moves, nothing is drawn. Tap the Pencil to draw again.
2. Rest one finger, then pinch: no dot is left. Lift one finger mid-pinch and keep moving the other: it keeps panning.
3. On an iPhone or iPad: Drawing → Save file opens the share sheet; Save to Files. On a computer in Chrome: Save asks where once, then Save (or Ctrl+S) writes the same file.

Before that:

1. Draw at a big notch, pinch-zoom in, and draw again: does the level following zoom feel natural, and is the lock easy to find?
2. Drag a cube, select around it, and drag the round handle up and down: does the density change read clearly, and does Coarser then Finer bring the detail back?
3. Slide the zoom rail on the left (under the Drawing button): about 16 px of slide doubles the zoom. Is that too fast? + and − double and halve it; ⌖ at its foot fits the drawing on screen.
4. Turn the phone sideways: the palette and tools share one row, and the rails hang under the top buttons. Is anything hard to reach?
5. Settings → Drawing → Paper: flip a drawing to dark paper and draw with the light inks; then start a New drawing and check it opens on the paper matching the phone's mode.

## CI gaps closed

- 2026-10-15: `just move-check` (in CI) moves a drawing end to end in headless Chrome from both old addresses (mapped to localhost) and checks it lands silently, is never taken twice, and is offered, not put in place of a drawing already there; `test/move.test.mjs` covers packing, the size fallbacks and the shape check of an arrival. The dev server now sends each path's `_headers` rules (CORS on `move.js`), as Cloudflare does. The `save-file` look view, run at several widths, caught the Save dot not coming back when the file record was already "changed" and the page empty; fixed.

- 2026-10-14: `test/sw.test.mjs` fails when a file in `web/` is missing from the service worker's `SHELL` (six were: keys, help, palette, sheets, engine/paper and engine/protect, so a copy opened once online could fail to start offline; proven by restoring the old list). New CI look views: `move` (a one-finger drag in Move draws nothing and pans), `pinchpan` (a finger rested 650 ms then a pinch leaves no cell, and the finger left pans; the old code left a cell) and `save-file` (Save writes the same file again, the dot follows changes). `tools/chrome.mjs` now finds Linux and Playwright Chromium and drops the sandbox as root, so a cloud session runs `just look` with no setup.

- 2026-10-13: a pre-commit hook runs `just test` (`just setup` turns it on; it would have stopped the red `639ac16`, a docs edit made after the last test run). `deploy-check` waits for GitHub's CI on `HEAD` and refuses a red one (proven against `639ac16`), since `just look` and export-check run only there. `test/names.test.mjs` also checks every commit's author (PDXfixIT) and message (it finds 104 problems in the old Isogrid history). After a first publish, this Mac can cache the new name as missing for 30 minutes; `verify`, `live` and the live `just look` now check through 1.1.1.1's answer when that happens and say so (flarepress `1d589ea`; proven live on isopix.pdxfixit.com, where it had reported 8 false ❌).

- 2026-10-13: `test/names.test.mjs` (in `just test`) fails when any file names the owner or his family; the names are stored as hashes, and it reports locations only (proven by planting a name in `web/`). CI also checks that `web/version.js`'s PATCH is the commit count of its commit (`bump_version.py --check`).

- 2026-10-13: `just test` runs `bash -n` on every `tools/*.sh`, so a syntax error in the deploy script fails CI instead of a deploy (proven with a stray `fi`). The deploy steps moved to `flarepress/tools/site.sh`, which has its own tests and CI in flarepress.

- 2026-10-12: GitHub Actions now run `just test`, `just export-check` and `just look` on every push (`test.yml`), fail when `web/` changed without a `web/version.js` bump (that would have caught the eight commits after `9cd39ce` that changed `web/` without one), and check daily that the live site serves `main`'s `version.js` (`live.yml`). `deploy-check` refuses an unpushed `HEAD`. `export-check` compares the cached cell layer with a fresh redraw (it caught a seam-order bug on erase).

- 2026-10-12: the daily live check no longer fails while a deploy is in flight (one hour's grace after main's `version.js` changes) and retries a blip 3 times before calling the site down; its rules are unit-tested in `just test` (`tools/test_live_check.py`). Chrome gets 60 s to start on CI after a cold runner timed out at 15 s. Actions moved to Node 24 releases.

- 2026-10-12: `test/docs.test.mjs` (in `just test`, so in CI) fails when a doc names a `just` recipe or `just look` view that does not exist, a relative link or a repo path in backticks does not resolve, or AGENTS.md grows past 16,000 bytes. On its first run it caught `just look … menu` in this file, a view renamed long ago. `just look --help` now lists views from the table it runs, so it cannot fall behind.

- 2026-10-13: the `fit` look view (in CI) zooms far in, presses ⌖ and fails unless the drawing lands clear of every control; it caught a fit that ignored the fixed rails and top bar (an `offsetParent` test, null for fixed boxes), proven by restoring the bug. `just look` no longer counts inks scrolled under the palette's pinned buttons as overlaps, and the `zoom` view presses + when the track is hidden instead of passing on a hidden track.

- 2026-10-12: `test/help.test.mjs` now counts sliders (`role="slider"`: the zoom track, the density handle) as controls that need a Help line, not only buttons. The `zoom` look view (in CI) fails if sliding the zoom track does not zoom in.

- 2026-10-12: `test/help.test.mjs` fails when a bound key, a tool, a brush shape or any button on the page or in the Drawing sheet has no Help line, or when Help borrows an icon that no longer exists; keys are bound from the same table Help lists.

## In flight

**Moving house to isopix.app** (2026-10-15, the owner bought it and set up its DNS): committed and pushed on branch `claude/ui-cleanup-usability-p711b2` here and in flarepress, **not merged and not deployed** (a cloud session cannot). Release 1.2.12. What it does: [deploy-cloudflare.md](deploy-cloudflare.md#old-addresses). To ship, from the owner's Mac, in this order:

1. Merge the branch to `main` in both repos (flarepress: the folder is now `isopix.app/`, with both hostnames; the Isogrid folder's `index.js` is the move page; `sites_check.py` knows move pages).
2. `git -C ~/src/flarepress pull`, then here `just deploy-plan`, then `just --yes deploy` (with `FIRST_PUBLISH=1` if isopix.app does not answer yet). If wrangler refuses the isopix.app Custom Domain over an existing DNS record (one made when the DNS was set up), show the record and delete it only with the owner's go, then deploy again ([deploy-cloudflare.md](deploy-cloudflare.md#if-the-custom-domain-will-not-attach)).
3. Only after isopix.app serves `move.js`: in flarepress, run its `push` recipe on the old Isogrid site's folder (its page loads `move.js` from isopix.app), then its `sites` recipe for that folder and `isopix.app`; then `just live` here.

Earlier on the same branch: saving on every device, the Move hand, the pinch fixes and the offline fix (release 1.1.9). Its ideas list is [release-plan.md](release-plan.md); cards 8 to 10 in [questions.md](questions.md) wait on the owner.

On `main`: nothing half done. Release 1.0.4 is live at https://isopix.pdxfixit.com (deployed 2026-10-13 from `a131cfb`).
