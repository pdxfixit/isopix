# TODO

## Agents do

Approved work, in order. Delete a line in the commit that finishes it.

1. A fuzz test: random strokes, then undo all and redo all, give the same drawing, and save then open gives the same drawing (owner: "and the fuzz test").
2. Several drawings in the browser: a gallery of thumbnails on the Drawing sheet; New adds, never replaces; delete asks ([docs/release-plan.md](docs/release-plan.md) item 1). Show the owner the design before building it.
3. A starter stamp library: a small built-in set (stairs, a tree, a cube house and so on) beside the person's own stamps, scaling with the level like any stamp. Show the owner the set and where it lives before building it (owner: "yes yes yes", his favorite of the list).
4. Rotate and flip a selection by 60° steps, exact, through the lattice group in `web/engine/symmetry.js` (owner: "rotate/flip is great").
5. Two-finger tap undoes, three-finger tap redoes (release-plan item 3).
6. Save the time-lapse as a video, without adding clutter: the owner floated offering the download only after the replay has played ("maybe the download is only available after watching? idk, don't want to clutter the screen"). Show him two or three placements before building it.
7. Drawing prompts ("draw a …") for kids, built on the lessons code. Never interrupt a focused person (docs/decisions.md, Lessons).
8. Light direction for auto-shade: the "Light from: Left / Right" setting, saved with each drawing, and Relight on the selection bar (docs/decisions.md, Drawing). The drawing's light is a new project field: older files open as Left (`project.js` `VERSION`, with a test). Help and a lesson step get their lines.

Offered, not yet approved (ask the owner first):

- The rest of [docs/release-plan.md](docs/release-plan.md) (items 4 to 10, polish and hygiene).
- A button to open an older autosave copy by hand ("oops, I wiped it"); today a copy opens only when the autosave cannot. S, the owner's call: it is new UI.
- Type checks (JSDoc and `// @ts-check`, run by `tsc` in CI only, never in `web/`). M; it adds a CI dependency, the owner's call.
- Pressure and layers, which the brief puts later. Pen mode (pen-only drawing, palm rejection) is deferred with no date (docs/decisions.md, Drawing).

## The owner does

- Try it on the Pixel and a tablet: the things in [docs/state.md](docs/state.md) "Try first".
- After the visit-beacon retirement ships (deployed by GitHub): optionally `DROP TABLE visits` in D1 `isopix` (the empty `region` column goes with it). Then, once the telemetry runner has dropped its `[jobs.isopix.ids] visits` entry, ask an agent to remove `table=visits` from [site/harvest.conf](site/harvest.conf) and the `[[d1_databases]]` binding from [site/wrangler.toml](site/wrangler.toml) (and the `D1_DATABASE_ID` secret and workflow lines).
