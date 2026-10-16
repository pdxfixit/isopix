# TODO

## Agents do

Approved work, in order. Delete a line in the commit that finishes it.

1. Rotate and flip a selection by 60° steps, exact, through the lattice group in `web/engine/symmetry.js` (owner: "rotate/flip is great").
2. Two-finger tap undoes, three-finger tap redoes (release-plan item 3).
3. Save the time-lapse as a video, without adding clutter: the owner floated offering the download only after the replay has played ("maybe the download is only available after watching? idk, don't want to clutter the screen"). Show him two or three placements before building it.
4. Drawing prompts ("draw a …") for kids, built on the lessons code. Never interrupt a focused person (docs/decisions.md, Lessons).
5. Light direction for auto-shade: the "Light from: Left / Right" setting, saved with each drawing, and Relight on the selection bar (docs/decisions.md, Drawing). The drawing's light is a new project field: older files open as Left (`project.js` `VERSION`, with a test). Help and a lesson step get their lines.

Offered, not yet approved (ask the owner first):

- The rest of [docs/release-plan.md](docs/release-plan.md) (items 4 to 10, polish and hygiene).
- A button to open an older autosave copy by hand ("oops, I wiped it"); today a copy opens only when the autosave cannot. S, the owner's call: it is new UI.
- Type checks (JSDoc and `// @ts-check`, run by `tsc` in CI only, never in `web/`). M; it adds a CI dependency, the owner's call.
- Pressure and layers, which the brief puts later. Pen mode (pen-only drawing, palm rejection) is deferred with no date (docs/decisions.md, Drawing).

## The owner does

- Try it on the Pixel and a tablet: the things in [docs/state.md](docs/state.md) "Try first".
- In pdxfixit/telemetry, the `[jobs.isopix.ids] visits` entry stays until 2027-10-16, then goes (it blanks the kept copies' device codes); until then its `isopix` job's `TELEMETRY_ISOPIX_D1_ID` secret is unused.
