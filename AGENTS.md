# Isopix 🧊

A touch drawing app on an isometric (triangular) grid, for the owner first and for kids second, so kid-friendly. The grid size is the brush size. Plain HTML, CSS and ES modules in `web/`, Canvas 2D, Pointer Events, no build step and no dependencies. Installable and offline. Live at https://isopix.app/ (see [Ship](#ship)).

This file is the contract: how to start, how to verify and ship, and the rules for working here. Detail lives in the files it points to.

## TL;DR

- **Test:** `just test` (syntax check of every module, then `node --test test/`, including the docs-drift check; nothing to install).
- **Run:** `just serve`, then http://localhost:8790/. Port 8790 is the owner's own server; agents preview on **8791** (`just serve 8791`).
- **Look:** `just look drawn select settings drawing-sheet brushes` checks 320, 375, 700, 900 and 1100 px in your own headless Chrome.
- **Output:** `just export-check` proves PNG, SVG and project files round trip.
- **Ship:** see [Ship](#ship). A commit that changes `web/` gets `just version` and a push; GitHub deploys it (`.github/workflows/deploy.yml`, on every push to `main` that changes `web/`, `worker/` or `site/`). Agents never deploy.
- **Agents never deploy** and hold no Cloudflare token: commit, push, get CI green, and say whether it is deployed: [docs/environment.md](docs/environment.md#a-session-that-cannot-deploy).

## Cold start: read in this order

1. **This file.**
2. [docs/state.md](docs/state.md): what exists now, what is in flight, what waits on the owner.
3. [docs/decisions.md](docs/decisions.md): every rule true today. It outranks every other doc. Rows marked *(default)* were an agent's choice and are open to the owner.
4. [docs/questions.md](docs/questions.md): open questions for the owner. Look first for answers he typed in.
5. [TODO.md](TODO.md): "Agents do" (approved work, in order) and "The owner does".
6. [README.md](README.md): what the app does, the file map, storage, keys.
7. As needed: [docs/environment.md](docs/environment.md) (tools to install, ports, every outside dependency) before you install, preview or deploy; [docs/design-brief.md](docs/design-brief.md) for the intent behind a feature; [docs/justfile-style.md](docs/justfile-style.md) before you write a recipe.

**Leave the next session a warm start.** A fresh cloud session has only this repo: no chat history, no memory folder, no access to the owner's notes. Everything the next agent needs must be in a file here. Update [docs/state.md](docs/state.md) in the same commit whenever what exists or what is in flight changes. If the chat taught you a standing rule, add it here.

**Design intent:** [docs/design-brief.md](docs/design-brief.md) is the owner's original brief (2026-10-12). It is background, not a task list, and docs/decisions.md outranks it where they differ.

## Where things are

| Path | What it holds |
|---|---|
| `web/` | The site. Nothing else is served; every path in it is relative. |
| `web/engine/` | Pure logic, no DOM: lattice math, the cell model and undo log, brushes, fill, symmetry, density change and stamps, SVG, project files, view and level-follow. Each file opens with a comment saying what it owns. |
| `web/app.js`, `web/ui/` | `app.js`: the app state, rendering, lessons, autosave and the wiring; `window.isopix` is the state, for debugging and the tools. `ui/`: one job each (`controls`, `tools`, `input`, `screens`, `files`). Tests that check what the app handles read all of them (`test/appsource.mjs`). |
| `web/render.js` | Canvas 2D drawing: cells, edges, gutters, overlays. |
| `worker/` | The isopix.app Worker: `POST /api/events` (usage events, [docs/telemetry.md](docs/telemetry.md)) into R2; every other path goes to the static files. |
| `web/sw.js`, `web/version.js` | Service worker (network first) and its version stamp. |
| `web/_headers` | Response headers for Cloudflare and `tools/serve.py` (CSP, no-cache for `sw.js`). |
| `spec/` | The Isopix file format, spec 1.0, under CC0: the spec, a JSON Schema, examples, and reference renderers in Python and JavaScript (`test/spec.test.mjs` checks they draw what the app does). |
| `test/` | `node --test` suites for the engine and app tables, plus `test/docs.test.mjs`: every recipe, look view, link and repo path the docs name must exist. |
| `tools/` | `serve.py`, `look.mjs` + `chrome.mjs`, `export_check.mjs`, `perf.mjs`, `bump_version.py`, `make_icons.mjs`, `live_check.py`, `version_bumped.sh`, `deploy.sh` (the logic behind `deploy.just`). |
| `justfile`, `deploy.just` | Recipes, in [the house style](docs/justfile-style.md). The justfile imports `deploy.just` (the deploy recipes). Change either with care: a broken deploy recipe blocks every release. |
| `docs/` | State, decisions, questions, the design brief, hosting, environment, Justfile style. |
| Deploy: `deploy.just`, `tools/deploy.sh`, [docs/deploy-cloudflare.md](docs/deploy-cloudflare.md) | Hosting, the `deploy-*` / `live` / `rollback` / `ship` recipes, checks after a deploy, rollback, DNS conflicts. See [Ship](#ship). |

## Verify

1. **`just test`** must be green. Judge it by the exit code, not by grepping: a syntax error stops it at `node --check` before any test runs.
2. **Every engine change ships with a test that fails without it.** Prove it: `just prove test/<file>.test.mjs web/engine/<file>.js`.
3. **Look at it** for anything a user sees: `just look [draw|drawn|select|settings|drawing-sheet|brushes …] [--js CODE]` (`just look --help` lists every view) reports sideways scroll, console errors, CSP blocks, controls under 44 px and overlaps at 320, 375, 700, 900 and 1100 px, and saves screenshots to the folder it prints. Run it with `--light` and again with `--dark`. Read the screenshots: the script cannot judge layout. A new screen or state gets a view: add an entry to `VIEWS` in `tools/look.mjs` (JS that opens it and throws if it did not); CI runs `just look --all`, so it is covered there too. `just look --all` runs every view locally.
4. **Output changes:** `just export-check`. **Moving house** (`web/move.js`, the old addresses): `just move-check`. **Autosave** (`web/autosave.js`): `just autosave-check`. **Installing** (manifest, service worker, home-screen tags): `just install-check`.
5. **The shared Browser pane** is for real clicks and drags only. Serve on 8791 and pass your own `tabId` to every call. Its service worker fails to register (a pane limit); headless Chrome registers it and runs offline.
6. **Rendering changes:** `just perf` before and after; the bar is in docs/decisions.md (Shipping).
7. **What no tool here can test:** real multi-touch (pinch, long-press then pinch, two-finger pan), pen pressure, and performance on a real phone. Pointer events dispatched from script cover the logic, not the feel. Say so in your report.

## Ship

Hosting is https://isopix.app. **GitHub deploys** (`.github/workflows/deploy.yml`) with this repo's own Cloudflare token, running the same `just --yes deploy` as the owner's Mac, through the public flarepress (`github.com/pdxfixit/flarepress`); the site's config is `site/` here (The owner, 2026-10-15: "move towards a GHA focused deploy, so an agent / ide isn't in the mix"). **It deploys every push to `main` that changes `web/`, `worker/` or `site/`** (the owner, 2026-10-15: "autodeploy like noodlepads"); Actions → deploy → Run workflow runs it by hand. The old addresses carry drawings over by `web/move.js`; their move Workers are the owner's, outside this repo. Detail, rollback and the DNS-conflict steps: [docs/deploy-cloudflare.md](docs/deploy-cloudflare.md). A commit that changes nothing under `web/` (docs, tests, tools, workflows) is pushed, CI read, and not deployed (docs/decisions.md, Shipping).

1. **Bump the release stamp:** `just version` (semver; PATCH becomes the commit count) (edits `web/version.js`; installed copies key their cache on it). Do it in the same commit as the change.
2. **Commit to `main`** by explicit path, then **`git push`**, and read the CI run until it is green.
3. **The deploy** is GitHub's: it runs `deploy-check` (on `main`, `web/` and `site/` committed, files present, `just test` and **GitHub's CI run for that commit green**), gate, stamp, push, then `deploy-verify` (live version, 200s, service-worker cache header, `version.js` equal to the commit's, `just look` on the live site). Agents never run `just --yes deploy`; the owner may, from his Mac. **`just deploy-plan`** (wrangler's dry run, sending nothing) is fine anywhere.
4. **Look at the live site:** `just live` (status, cache headers, etag, versions, ✅/⚠️). A red deploy run after its push step means the new version is already live: fix forward, or the owner runs `just rollback` (prints the steps; `--yes` runs them).

Rules:

- **Push after every commit to `main`; every one that changes `web/` is deployed by GitHub**, then `just live`. Never deploy with failing tests (`deploy-check` refuses), and bump `web/version.js` with each release that changes `web/` (CI fails without it).
- **While the address does not answer at all, `deploy` refuses** unless `FIRST_PUBLISH=1` is set: the first publish creates the Custom Domain (a DNS record) and needs the owner's go. Isopix's first publish, at isopix.pdxfixit.com, was approved on 2026-10-13 for release 1.0.1; the move to isopix.app, on 2026-10-15 (its first deploy there may need `FIRST_PUBLISH=1`).
- **Never delete or edit a DNS record without the owner's approval.** If the domain will not attach, show him the exact record (see the doc).
- Only `web/` is uploaded, configured by `site/`, so both must be committed (`ALLOW_DIRTY=1` overrides on the Mac, and stamps the version `-dirty`).
- `web/version.json` is the deploy's label (git describe), written by `deploy-stamp` and gitignored; `web/version.js` is the app's release stamp. They are different files.
- Never force-push `main`.
- **Auth fails at push** (`push` fails on auth): nothing was published. On GitHub the repo secret `CLOUDFLARE_API_TOKEN` needs the owner; on his Mac, `npx wrangler login`. Details: [docs/deploy-cloudflare.md](docs/deploy-cloudflare.md).

## Standing rules

### CI (GitHub Actions, `.github/workflows/`)

- `test.yml` runs on every push and pull request: `just test`, `just export-check`, `just look` (screenshots uploaded as an artifact), and the version-bump rule (`tools/version_bumped.sh`). `live.yml` runs daily (`tools/live_check.py`): the live site must answer (3 retries) and serve `main`'s `version.js`, with an hour's grace for a deploy in flight. No secrets, `contents: read`, pinned actions. `deploy.yml` deploys with this repo's own Cloudflare token (the only secrets: `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`).
- After each push, read the run: `gh run list --limit 3`, then `gh run view <id> --log-failed`. Fix a red run before anything else.
- **Every bug fixed adds a test that fails without the fix** (`just prove`).
- **Every session closes one CI gap:** a check that would have caught a past mistake. Record it in `docs/state.md` under "CI gaps closed".

### Working here

- **No build step, no dependencies.** Tools are stdlib Python or Node with no packages (headless Chrome needs a WebSocket client; stdlib Python has none).
- **The engine stays pure.** No DOM, canvas or `window` in `web/engine/`. The DOM code calls it.
- **The model has one write path.** Change cells, edges and hidden children only through `Drawing.setCell` / `setEdge` / `setHidden` (or `paint`, which uses them), inside `begin()` ... `commit()`. That is what makes undo, previews (`rollback`) and replay exact.
- **Stored formats are kept by users.** A change to the project file or the autosave needs `project.js` to still load older files (`VERSION`), and a test.
- **Anything that comes in is untrusted:** project files are shape-checked in `project.js`; keep it that way.
- **Touch targets at least 44 px; nothing scrolls sideways;** check light and dark mode.
- **A new key goes in `web/keys.js`; a new button, tool or brush gets its line in `web/help.js`.** `test/help.test.mjs` fails otherwise.
- **Every control has a label a screen reader reads,** and nothing is gesture-only (density change always has buttons).
- **Respect `prefers-reduced-motion`.**
- **Fresh clone: `just setup` first.** It turns on the pre-commit hook (`.githooks/pre-commit` runs `just test`, about 3 s, and checks a staged `web/version.js` carries this commit's number; `.githooks/pre-push` checks the stamp again, since a rebase moves the commit count) and sets the PDXfixIT author. Never skip the hook; fix what it reports.
- **No personal names.** Never write the owner's or his family's names in any file or commit message; `test/names.test.mjs` fails on them, and on any commit not authored by PDXfixIT.
- **Commits:** one per finished unit of work, staged by explicit path (never `git add -A`: other agents work in this repo), `<type>: <summary>`, a bullet body, and the `Co-Authored-By` trailer. Push after every commit to `main` (see Ship).
- **Agents are agents.** Call subagents "agents", never people.
- **Tooling friction gets fixed:** an obvious, non-breaking improvement to a tool or doc you used goes in the same session, as its own commit.
- **When the owner decides something,** record it in docs/decisions.md in the same commit; a replaced rule is deleted, not annotated.

## Working with the owner

The owner owns Isopix and decides what it does. He reads replies on his phone as often as at a desk.

- **Answer short, result first:** what changed or what you found, then the numbers (tests passing, ms per frame, the live version), then anything he must do. Plain English; define a term the first time. A bit of whimsy and emoji are welcome.
- **Judgment calls are his.** Anything that changes what the app looks like or does, or trades one good thing for another: give two or three options with your recommendation and why, and ask before building it. Mechanical work (a fix with a clear right answer, tests, docs that match the code) needs no permission.
- **Ask in chat when it blocks the work, in [docs/questions.md](docs/questions.md) when it can wait.** That file says how to write a card and how an answer gets recorded.
- **His rules hold even when they are inconvenient:** nothing is pushed, deployed, deleted (DNS included) or published against them. If a rule seems wrong, say so and ask; do not work around it.
- **Record his words.** When he decides something, the docs/decisions.md row quotes him (`Owner: "…"`).
- **Say plainly what you did not check.** Real touch, pen and phone speed cannot be tested here (see Verify).

## Things outside this repo

The repo holds everything except: **flarepress** (the public deploy code), the **Cloudflare token** (a GitHub secret, or the owner's login), **GitHub access**, and a **real phone**. [docs/environment.md](docs/environment.md#things-outside-this-repo) says what each is for, what to do when it is missing, and who can supply it (The owner).

## Handoff

Before you stop, leave the next session a warm start:

1. **docs/state.md**, present tense: what is live (`just live` shows the version), what is in flight (committed but not deployed, half done, waiting on CI), and what waits on the owner. Update the counts it quotes (tests, checks) if they changed.
2. **TODO.md**: delete finished lines; add approved work in order.
3. **docs/decisions.md** and **docs/questions.md**: every decision recorded, every open question carded.
4. **Final report** (to the owner or the agent that started you): the result first; what you changed, by commit; what you ran and its result (tests, look, export-check, CI run, `just live`) versus what you only read; what is not verified (touch, phone); anything waiting on the owner, as a decision with a recommendation.
