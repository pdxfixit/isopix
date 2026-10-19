# TODO

## Agents do

Approved work, in order. Delete a line in the commit that finishes it.

1. **On or after 2026-10-23: remove the old-layout converter** so it does not go vestigial (owner, 2026-10-16). Delete `fromOldLayout` and its uses in `web/engine/project.js` (`meta`, `hasContent`, `withName`, `load`), `toSpecOnce` in `web/ui/gallery.js`, the flat-layout branches in `web/move.js` (`hasDrawing`, `shrinkings`), the last test in `test/fileformat.test.mjs`, scenario 3 of `tools/autosave_check.mjs` and the spec's "For now Isopix also opens…" line. First check the old addresses: their move pages (isopix.pdxfixit.com, the Isogrid one, the owner's Workers) carry old-layout drawings, so if they still send people over, ask the owner before removing it. A browser not opened since 2026-10-16 will then show "this is not an Isopix drawing" for its old drawing: the owner accepted that.
2. **When the starter stamps pass about 200: load their art only when Stamps opens**, not at start (owner, 2026-10-19: "agree" to "do it then, not now"). `web/stamps.js` (packed, 6 KB gzipped at 86 stamps) is imported at start by `web/stampbook.js` and preloaded by `index.html`; the Stamp brush and `chosen()` need it, so they must wait for it.
3. **Stamps: lay flat pictures on a plane, and draw the formula stamps rounder when bigger** (owner, 2026-10-19; [spec](docs/spec-stamp-size-turn.md) step 2): Letters, Numbers, Smiley and the sacred geometry go on the floor, the left wall or the right wall, from buttons on the stamp bar; the formula stamps (Flower, Sun, Rainbow, Smiley, Kid, sacred geometry) are drawn from their formulas at each size, so `tools/make_stamps.mjs`'s flat shapes move into `web/engine/`. Measure the size against `web/stamps.js`.
4. **Stamps: Spin** (spec step 3): block models for the box stamps, a back-to-front renderer in `web/engine/`, Spin on the stamp bar (four ways, shading redone); Mine keeps the flat Turn.

Offered, not yet approved (ask the owner first):

- The rest of [docs/release-plan.md](docs/release-plan.md) (items 4 to 10, polish and hygiene).
- A button to open an older autosave copy by hand ("oops, I wiped it"); today a copy opens only when the autosave cannot. S, the owner's call: it is new UI.
- Type checks (JSDoc and `// @ts-check`, run by `tsc` in CI only, never in `web/`). M; it adds a CI dependency, the owner's call.
- Pressure and layers, which the brief puts later. Pen mode (pen-only drawing, palm rejection) is deferred with no date (docs/decisions.md, Drawing).

## The owner does

- Try it on the Pixel and a tablet: the things in [docs/state.md](docs/state.md) "Try first".
- In pdxfixit/telemetry, the `[jobs.isopix.ids] visits` entry stays until 2027-10-16, then goes (it blanks the kept copies' device codes); until then its `isopix` job's `TELEMETRY_ISOPIX_D1_ID` secret is unused.
