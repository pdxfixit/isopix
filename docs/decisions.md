# Decisions

Every rule that is true today. A replaced rule is deleted and the new rule takes
its row. The owner's decisions outrank defaults an agent chose; rows marked
*(default)* were chosen by the building agent where the brief left it open, and
are open to the owner's change (see [questions.md](questions.md)).

## Platform

| Rule | Why | Since |
|---|---|---|
| Web only: static files in `web/`, plain ES modules, Canvas 2D, Pointer Events, no framework, no build step, no dependencies. | The owner's brief: simplicity; it runs on the Pixel and a tablet. | 2026-10-12 |
| Nothing but the site goes in `web/`; tests, tools and docs live outside it. | `web/` is deployed as-is through a flarepress symlink. | 2026-10-12 |
| Every path in `web/` is relative. | The site must work at the root of a subdomain. | 2026-10-12 |
| The engine (`web/engine/`) has no DOM or rendering, and its tests run in plain `node`. | Brief; the math is the risky part and must be provable. | 2026-10-12 |
| `web/version.js` holds the release stamp, semver `MAJOR.MINOR.PATCH`, and names the service-worker cache. PATCH is always the commit count once the release is committed (`just version`; `just version minor` / `major` for the others); CI checks it (`bump_version.py --check`). | Owner: "semver, and the patch version should be the number of commits in the tree, so it's always autoincrementing". Installed copies update after a deploy and never serve stale files forever. | 2026-10-13 |
| The service worker is network first, cache as fallback. | A deploy shows on the next load with a connection; offline still opens. | 2026-10-12 *(default)* |
| When a newer version is live, a bar floats over the bottom: "🆕 An update for Isopix is ready." with Reload and ✕. It checks `version.json` on focus and every 10 minutes (at most once a minute), and waits while a stroke, drag, density preview, replay, open rail, sheet or picker is in progress. ✕ hides it until the next check. A dev copy (no `version.json`, or "dev") stays silent. | Ported from Noodle Pads at the owner's request: an open or installed copy otherwise keeps old code without anyone knowing. | 2026-10-12 |
| Reload first writes the drawing to IndexedDB (not waiting for the 800 ms autosave), asks the service worker to update, and lets a waiting worker take over before reloading. | Reload must lose nothing, and the installed copy must really switch. | 2026-10-12 |
| A tiny build stamp sits in the bottom-right corner, under the tool bar: the release and the deployed commit (`1.0.2 · 55a1363`), 8 px monospace in the muted ink, never taking a tap, hidden from screen readers. Settings → About says it in words: `Version 1.0.4 (a95077f)`. The commit comes from `version.json`'s `commit`, written by flarepress's stamp; a dev copy says `dev`. | Owner: "the app should display the version sha in a lower corner, very diminutive". Bottom-right is the agent's pick: the strip under the tool bar is free at every width. On About's old `Version v1.0.1 (app 1.0.1)`: "this should be the git sha in parens, not a repeat". | 2026-10-13 |
| Two stamps, two jobs: `version.json` (written by `just deploy`, never cached) drives the notice; `version.js` (bumped by `just version`) names the service-worker cache. A deploy that bumps only `version.json` still shows the notice, and the reload gets fresh files because the worker is network first; the old cache stays until the next `version.js` bump. A bump of only `version.js` (no deploy stamp) shows no notice, but the next load installs the new worker and drops the old cache. Releases bump both. | The notice needs a label that changes on every deploy; the cache name must change when files do. | 2026-10-12 |
| No accounts, server, ads or analytics. Drawings stay in the browser. | Brief, in the spirit of Arrow-Rama. | 2026-10-12 |

## Public release (1.0)

| Rule | Why | Since |
|---|---|---|
| The app is **Isopix**, released as 1.0 in a public repo, `github.com/pdxfixit/isopix`, under the MIT license. Its history starts fresh at 1.0; the Isogrid history stays in a private, archived repo. | Owner: "let's take this 1.0 and public"; on the name: "`Isopix`"; on history: "we can have a clean break; new repo, fresh history". | 2026-10-13 |
| Commits are authored as `PDXfixIT <1262042+pdxfixit@users.noreply.github.com>` (set in this repo's git config). | Owner: "PDXfixIT can be the author". | 2026-10-13 |
| No file names the owner or his family. `test/names.test.mjs` fails on any of the names, which it holds only as hashes, and reports locations, never the name. Decisions quote "Owner: …". | Owner: "ensure my name and the kids' names aren't in code". The repo and its CI logs are public. | 2026-10-13 |
| The site lives at https://isopix.pdxfixit.com. The old Isogrid address redirects there; drawings saved in a browser at the old address were not carried over. Browser storage (IndexedDB, settings, cache) uses `isopix` names. Project files saved as Isogrid (`format: 'isogrid'`) still open. | Owner: "what if we move it to pdxfixit.com"; on carrying drawings over: "a clean break is ok to save cycles"; on storage names: "force move; we're releasing 1.0". A domain of its own (isopix.com) may come later: "i want the domain, but it's not important right now". | 2026-10-13 |

## Shipping

| Rule | Why | Since |
|---|---|---|
| The deploy steps every app site shares (check, gate, stamp, verify, live, rollback) come from `flarepress/tools/site.sh`, configured by `isopix.pdxfixit.com/site.conf`; this repo's `tools/deploy.sh` adds the tests, the `version.js` bump check and `just look` on the live site. | Owner: "we should build out consistency into the flarepress tooling"; approved the plan with "yes, recommended, deploy". One copy of the deploy logic for isopix and Noodle Pads, so they cannot drift. | 2026-10-13 |
| After every commit to `main`: push; if the commit changed anything under `web/`, deploy (`just --yes deploy`), then `just live`. A commit that changes nothing under `web/` is pushed and not deployed. | Owner: "always deploy following a commit"; asked about docs-only commits, he chose "Push but don't deploy docs-only commits". A docs-only deploy would ship identical files and only change `version.json`, which shows every open copy the update notice for nothing. | 2026-10-12 |
| Isopix owns flarepress's `flarepress/tools/site.sh`, `flarepress/tools/sites_check.py`, the `site.conf` key format, the "App sites" recipes in flarepress's Justfile and the "Sites with an app repo" section of its AGENTS.md. Isopix does not edit other sites' folders, and keeps the documented keys, subcommands and flags working for Noodle Pads (message its session before changing anything it relies on). | The owner, 2026-10-13: "you can have it for now, if noodlepads is ok with it"; the Noodle Pads session agreed. | 2026-10-13 |
| `just perf` must not get worse: median pan and draw stay under 16.7 ms (one frame at 60 Hz), and no median or p95 grows by more than 20% over the latest numbers in state.md. Measure before and after any rendering change, on the same machine, and write both in the commit and in state.md. | Speed on a phone is the feel of the app; a fixed bar keeps it from sliding a little each change. | 2026-10-12 *(default)* |

## CI

| Rule | Why | Since |
|---|---|---|
| The daily live check (`live.yml`, `tools/live_check.py`) fails when `/`, the manifest or `sw.js` is not 200 after 3 retries 20 s apart. When live `version.js` differs from main's, it passes with a notice if main's `web/version.js` changed under an hour ago (a deploy in flight), and fails after that, naming both versions and the age. | The owner: fewer failure emails, but a down site is never excused. | 2026-10-12 |
| Actions are pinned to releases that run on Node 24 (checkout v7.0.1, setup-node v7.1.0, upload-artifact v7.0.2); no secrets, `contents: read`. | GitHub deprecated Node 20 actions. | 2026-10-12 |

## Drawing, Settings and the top bar

| Rule | Why | Since |
|---|---|---|
| The top bar: a labeled **Drawing** button (folder icon; its name below when set), undo, redo on the left; the Keep / Behind / Replace chip and ⚙️ **Settings** on the right. From 700 px, labeled New, Open and Save sit next to Drawing. Below 360 px, Drawing shows only its folder. From 768 px the level bar is a second row under the top bar. | Owner: "One Drawing button, opens a file sheet"; "move new/save/open etc to more prominent positions". | 2026-10-12 |
| The Drawing sheet: the drawing's name (saved with it; file names use it with unsafe characters removed; old projects get "Untitled drawing"), big New, Open, Save file and Save picture, smaller Save vector (SVG) and Time-lapse, and the real last-autosave time. New with anything to lose asks: Save file first, New anyway, Cancel, and says this browser keeps one drawing. | The owner chose the big-button file sheet. | 2026-10-12 |
| Settings (was Menu) folds into Drawing, Grid, Selection, Learning and About, as in Noodle Pads: each head a button with a caret and a chip of the current value; Drawing open first, the rest closed; the device remembers; About last, always open. | Owner: "Drawing, Grid, Selection, Learning, About". | 2026-10-12 |
| Keys: M opens Settings, D the Drawing sheet, ? Help. Sheets are modal: focus stays inside, Esc closes, focus returns to the button that opened them. | Keyboard and screen-reader use. | 2026-10-12 |

## Rendering

| Rule | Why | Since |
|---|---|---|
| Cells draw from a cached offscreen layer: moved on pan, patched where cells changed, redrawn at the new scale on any zoom (never a scaled bitmap). Colors stack in a fixed order so a patch matches a full redraw pixel for pixel; `just export-check` proves it. | The owner approved the speedup; panning a 38,400-cell drawing went from 29 ms to 4.5 ms a frame. | 2026-10-12 |
| Path2D objects hold at most 96 subpaths. | Path building slows with the square of its subpaths. | 2026-10-12 |

## Lattice and model

| Rule | Why | Since |
|---|---|---|
| Cell `(level, p, q, u)`, vertex `(p,q)` at `x = q·(√3/2)·s, y = (p + q/2)·s`, 8 levels (0 coarsest to 7). | The verified math in the build prompt; tests prove it. | 2026-10-12 |
| Lattice lines are vertical, 30° and 150°, so cells point left and right on screen. | The standard isometric cube view; the brief's "up/down" names remain as `u`. | 2026-10-12 |
| One painted cell or its descendants, never both; `sub` counts painted descendants. | Brief; keeps protect and clearing O(depth). | 2026-10-12 |
| Undo is a diff log of every primitive change; it also drives time-lapse replay and is saved with the project. | Fearless undo; one mechanism for undo, previews, replay. | 2026-10-12 |

## Drawing

| Rule | Why | Since |
|---|---|---|
| The level follows zoom by default; the lock freezes it. The level changes only past ±0.65 of a level. | Brief (hysteresis so it does not flicker). | 2026-10-12 |
| Following zoom, the 8 notches mean on-screen cell edges from 96 px down to 6 px, evenly in log scale. Two notches may pick the same level at some zooms; each notch's label and the readout name the real on-screen size. | The owner: every notch usable on a phone; sharing a level is fine if visible. | 2026-10-12 |
| "Protect fine detail" is called **Keep fine detail**; the chip says Keep / Behind / Replace. The stored setting and paint mode keep the value `protect`, so saved settings land on Keep. | Owner: "rename it to Keep". | 2026-10-12 |
| The chip and the Fill tool show one icon in every mode: a squat paint can tipped 45°, rim ellipse, a thin wire bail arcing over the opening from rim to rim, a pour from the lip ending in a drop. The chip's word and label tell the modes apart. | Owner: "have just one icon, looking a bit more like the classic paint-fill-can than a coffee cup"; then "still looks like a cup. needs a paint can handle, regardless of taper". Variant A of three (plain high bail) read clearest at 24 px. | 2026-10-12 |
| Keep fine detail is on by default, and visible: a chip left of ⌖ shows the mode and cycles Keep → Paint behind → Replace in one tap; the hover preview hatches cells Keep would skip (dashed outline, hatch, not color alone); after a stroke the skipped cells hatch for 1.6 s; the first skip in a session says "Keep fine detail skipped N cells" with how to change it (dismissible, a live region). | The owner: keep it (then called Protect), make it visible. His report "a larger tile isn't overpainting" was this mode skipping cells with finer detail, reproduced; Replace overpaints. | 2026-10-12 |
| Paint behind keeps every painted cell at any level and fills only empty space. | Suits painting a sky behind a drawing. | 2026-10-12 *(default)* |
| Picking a color (a palette swatch or the custom color picker) while the Eraser is on switches to the Pencil. Line, Fill, Select and the Pencil keep their tool; the auto-shade toggle and the limited palette's "+" never change the tool. | Owner: "clicking a color changes off of eraser to pencil mode" (a color pick means "I want to paint"). | 2026-10-12 |
| The eraser always erases, whatever the Keep fine detail setting. | Owner: "keep as is". A coarse eraser that skips detail looks broken; undo is the net. | 2026-10-12 |
| The mouse wheel pans; Ctrl + wheel and a trackpad pinch zoom. | Owner: "keep as is". | 2026-10-12 |
| A zoom rail sits on the left edge at every width: zoom-in at the top, a slider even in log scale across the whole zoom range, zoom-out, then ⌖ Fit drawing. The zoom controls zoom about the screen center; the buttons double and halve the zoom. On phones the rail hangs under the top buttons and the track stays above where the brush picker and selection bar open; under 620 px tall only the buttons show. | Owner: "there needs to be a zoom slider"; he chose the left rail of three layouts. Buttons step 2× so each tap is one level when following zoom; the short-screen rules are an agent's call, since a track that short cannot be aimed. | 2026-10-12 *(steps and short screens default)* |
| ⌖ Fit drawing (and the 0 key) frames everything drawn in the area the controls leave clear; on empty paper it resets the view. It lives on the zoom rail, so the grid-size rail is only the sizes and the lock. | The owner chose "Zoom rail, Fit" over keeping Reset view on the size rail. | 2026-10-13 |
| The grid-size notches are solid hexagons of six cells, big to small, with faint cell lines while big enough. The Triangle brush and Triangle selection icons show their one cell (filled, or dashed) inside a faint hexagon of six. | The owner chose hexagons: the filled ▶ triangles read as a media Play button; then "fix the brush-shape button too". | 2026-10-13 |
| The palette's add-color (or +) and auto-shade buttons stay pinned at its end; the inks scroll under them. On phones the grid-size rail hangs under the top buttons, mirroring the zoom rail, and its open column of notches shifts only as far as needed to stay between the top buttons and the bottom bars. On a short landscape screen the palette and tools share one row, and the brush picker and selection bar sit between the side rails; the level readout shows just above the bottom row. | UX pass (Owner: "make things more intuitive… responsive for a wide range of screen widths"): those buttons were scrolled out of sight on every phone, and the side rails overlapped the bottom bars below about 650 px tall. | 2026-10-13 *(default)* |
| Auto-shade: top lighter by 0.12 Oklab L, left is the base color, right darker by 0.16. Cells keep a face tag so a fill recolor keeps its shading. | Brief: teaches value. | 2026-10-12 *(numbers default)* |
| Fill floods the cells as stored (recoloring a big cell whole); empty space fills at the active level, finer only beside finer detail, bounded by the visible area. Past 40,000 cells it fills with bigger cells instead (one level coarser at a time), so it stays fast and never refuses. | The owner: keep the cap; fill bigger cells rather than refuse. | 2026-10-12 |
| Symmetry is applied through the exact 12-element lattice group around a vertex; face tags follow their rhombus. | Brief. | 2026-10-12 |
| Stamps keep cells relative to an anchor vertex and scale with the active level. | Scaling by 2 about a vertex maps one level exactly onto the next. | 2026-10-12 *(default)* |
| Bold edges are stored per lattice edge; refining splits each in two. Coarsening merges halves on the coarser line into one edge that remembers its halves, and hides edges inside a coarser cell; refining brings both back exactly, until the user paints that cell or draws a bold line in it. Hidden edges are saved in projects. | The owner approved "keep bold edges on coarsen, like cells". | 2026-10-12 |

| The trace picture saves with the drawing (project file and IndexedDB autosave) as a data URL with its place; a photo over 2048 px on its long side is made smaller first, and the app says so. Old files without one open as before. It is not part of PNG or SVG export. | The owner approved "save the trace picture in the project file". | 2026-10-12 |

| Help (Settings → About → Help, or `?`) lists every control with its real icon, every gesture and every key, in simple English with the app's words defined first. Keys are bound from `web/keys.js` and the sheet lists that same table; `test/help.test.mjs` fails when a key, tool, brush or button has no Help line. | The owner approved "a Help sheet listing every control". | 2026-10-12 |

## Selection and density

| Rule | Why | Since |
|---|---|---|
| Marquee shapes: triangle, rhombus, hexagon. Press a grid point and drag; the drag's direction and length pick the shape's orientation and size. | Brief left it to the agent; one gesture for all three. | 2026-10-12 *(default)* |
| The marquee's press point snaps to a vertex of the next coarser level. | An even-sized marquee then lines up with bigger cells and can be coarsened. | 2026-10-12 *(default)* |
| Finer/Coarser buttons always work; the Handle is the default gesture; pinch inside the selection and long-press-then-pinch stay experimental settings, off by default. | The owner, after trying them. | 2026-10-12 |
| Coarsening below the marquee level snaps the marquee to the whole bigger cells inside it. | Brief: the boundary must lie on the target level's edges. | 2026-10-12 |
| Crisp is the default and the last choice is remembered; a cell Crisp leaves empty also keeps its children; painting a cell drops its kept children. | Brief: keep fidelity until the user paints there. | 2026-10-12 |

## Screens

| Rule | Why | Since |
|---|---|---|
| Phone first: tools along the bottom, the level slider down the right edge; from 768 px wide and 560 px tall the slider is a bar along the top. | Brief. | 2026-10-12 |
| Touch targets are at least 44 px; nothing scrolls sideways (the palette row scrolls inside itself). | `just look` checks both. | 2026-10-12 |
| Each drawing keeps its own paper, light or dark, saved with it (project file, autosave, PNG and SVG background). A new drawing starts on the paper matching the screen's mode; Settings → Drawing → Paper flips it. A project saved before papers existed opens light. | The owner: dark paper with light inks; black strokes vanish on dark paper, so a drawing never changes paper on its own. | 2026-10-12 |
| The inks follow the drawing's paper: a lighter set on dark paper (its darkest is a slate that still reads). Flipping the paper recolors no strokes; the chosen ink moves to the same position in the other set. | The owner. | 2026-10-12 |
