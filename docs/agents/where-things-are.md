# Where things are

| Path | What it holds |
|---|---|
| `web/` | The site. Nothing else is served; every path in it is relative. |
| `web/engine/` | Pure logic, no DOM: lattice math, the cell model and undo log, brushes, fill, symmetry, density change and stamps, SVG, project files, view and level-follow. Each file opens with a comment saying what it owns. |
| `web/app.js`, `web/ui/` | `app.js`: the app state, rendering, lessons, autosave and the wiring; `window.isopix` is the state, for debugging and the tools. `ui/`: one job each (`controls`, `tools`, `input`, `screens`, `files`). Tests that check what the app handles read all of them (`test/appsource.mjs`). |
| `web/render.js` | Canvas 2D drawing: cells, edges, gutters, overlays. |
| `worker/` | The isopix.app Worker: `POST /api/events` and `/api/feedback` ([docs/telemetry.md](../telemetry.md)) into R2; everything else to the static files. |
| `web/sw.js`, `web/version.js` | Service worker (network first) and its version stamp. |
| `web/_headers` | Response headers for Cloudflare and `tools/serve.py` (CSP, no-cache for `sw.js`). |
| `spec/` | The Isopix file format, spec 1.0, under CC0: the spec, a JSON Schema, examples, and reference renderers in Python and JavaScript (`test/spec.test.mjs` checks they draw what the app does). |
| `test/` | `node --test` suites for the engine and app tables, plus `test/docs.test.mjs`: every recipe, look view, link and repo path the docs name must exist. |
| `tools/` | `serve.py`, `look.mjs` + `chrome.mjs`, `export_check.mjs`, `perf.mjs`, `bump_version.py`, `make_icons.mjs`, `live_check.py`, `version_bumped.sh`, `deploy.sh` (behind `deploy.just`). |
| `justfile`, `deploy.just` | Recipes, in [the house style](../justfile-style.md). The justfile imports `deploy.just` (the deploy recipes). Change either with care: a broken deploy recipe blocks every release. |
| `docs/` | State, decisions, questions, the design brief, hosting, environment, Justfile style, `privacy-policy.md` (the public policy's text). |
| Deploy: `deploy.just`, `tools/deploy.sh`, [docs/deploy-cloudflare.md](../deploy-cloudflare.md) | Hosting, the `deploy-*` / `live` / `rollback` / `ship` recipes, checks after a deploy, rollback, DNS conflicts. See [Ship](ship.md). |
