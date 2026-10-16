# TODO

## Agents do

Approved work, in order. Delete a line in the commit that finishes it.

1. Save the time-lapse as a video, without adding clutter: the owner floated offering the download only after the replay has played ("maybe the download is only available after watching? idk, don't want to clutter the screen"). Show him two or three placements before building it.
2. File format version 2 and its open spec (docs/file-format.md, a draft): once the owner has read the draft, build save and load of v2 (v1 still opens), `spec/` with the spec under CC0, a JSON Schema, example files, and reference renderers in Python and JavaScript with a test that they draw what the app draws.

Offered, not yet approved (ask the owner first):

- The rest of [docs/release-plan.md](docs/release-plan.md) (items 4 to 10, polish and hygiene).
- A button to open an older autosave copy by hand ("oops, I wiped it"); today a copy opens only when the autosave cannot. S, the owner's call: it is new UI.
- Type checks (JSDoc and `// @ts-check`, run by `tsc` in CI only, never in `web/`). M; it adds a CI dependency, the owner's call.
- Pressure and layers, which the brief puts later. Pen mode (pen-only drawing, palm rejection) is deferred with no date (docs/decisions.md, Drawing).

## The owner does

- Try it on the Pixel and a tablet: the things in [docs/state.md](docs/state.md) "Try first".
- In pdxfixit/telemetry, the `[jobs.isopix.ids] visits` entry stays until 2027-10-16, then goes (it blanks the kept copies' device codes); until then its `isopix` job's `TELEMETRY_ISOPIX_D1_ID` secret is unused.
