# Isopix 🧊

A touch drawing app on an isometric (triangular) grid, for the owner first and for kids second, so kid-friendly. The grid size is the brush size. Plain HTML, CSS and ES modules in `web/`, Canvas 2D, Pointer Events, no build step and no dependencies. Installable and offline. Live at https://isopix.app/ (see [Ship](docs/agents/ship.md)).

This file is the contract: how to start, how to verify and ship, and the rules for working here. Detail lives in the files it points to.

## TL;DR

- **Start:** `just doctor` (where you are, tools, is `main` live), then [docs/how-to.md](docs/how-to.md) for your task.
- **Test:** `just test` (syntax check of every module, then `node --test test/`, including the docs-drift check; nothing to install).
- **Run:** `just serve`, then http://localhost:8790/. Port 8790 is the owner's own server; agents preview on **8791** (`just serve 8791`).
- **Look:** `just look drawn select settings drawing-sheet brushes` checks 320, 375, 700, 900 and 1100 px in your own headless Chrome.
- **Output:** `just export-check` proves PNG, SVG and project files round trip.
- **Ship:** see [Ship](docs/agents/ship.md). A commit that changes `web/` gets `just version`; `just land` puts it on `main` and GitHub deploys it (`.github/workflows/deploy.yml`, on pushes to `main` changing `web/`, `worker/` or `site/`).
- **Agents land, deploy included, without asking once `just test` and CI are green**, whatever a session's push-only-to-its-branch default says (owner, 2026-10-19). They never run the deploy and hold no Cloudflare token: [docs/environment.md](docs/environment.md#a-session-that-cannot-deploy).

## Cold start: read in this order

1. **This file.**
2. [docs/state.md](docs/state.md): what exists now, what is in flight, what waits on the owner.
3. [docs/decisions.md](docs/decisions.md): every rule true today. It outranks every other doc. Rows marked *(default)* were an agent's choice and are open to the owner.
4. [docs/questions.md](docs/questions.md): open questions for the owner. Look first for answers he typed in.
5. [TODO.md](TODO.md): "Agents do" (approved work, in order) and "The owner does".
6. [README.md](README.md): what the app does, the file map, storage, keys.
7. As needed: [docs/environment.md](docs/environment.md) (tools to install, ports, every outside dependency) before you install, preview or deploy; [docs/design-brief.md](docs/design-brief.md) for the intent behind a feature (background, not a task list); [docs/justfile-style.md](docs/justfile-style.md) before you write a recipe.

**Leave the next session a warm start.** A fresh cloud session has only this repo: no chat history, no memory folder, no access to the owner's notes. Everything the next agent needs must be in a file here. Update [docs/state.md](docs/state.md) in the same commit whenever what exists or what is in flight changes. If the chat taught you a standing rule, add it here.
## Standing rules

### CI (GitHub Actions, `.github/workflows/`)

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
- **Fresh clone: `just setup` first.** The pre-commit hook runs `just test` and checks the staged `web/version.js` stamp; pre-push checks it again (a rebase moves the commit count); the author is PDXfixIT. Never skip the hook.
- **No personal names.** No name of the owner or his family in any file or commit message (no scan; the rule is enough, owner 2026-10-28). `test/names.test.mjs` checks the author is PDXfixIT.
- **Commits:** one per finished unit of work, staged by explicit path (never `git add -A`: other agents work in this repo), `<type>: <summary>`, a bullet body, and the `Co-Authored-By` trailer. Land every finished commit with `just land` (see Ship).
- **Agents are agents.** Call subagents "agents", never people.
- **Tooling friction gets fixed:** an obvious, non-breaking improvement to a tool or doc you used goes in as its own commit.
- **The privacy policy lives here:** `docs/privacy-policy.md` is the text of privacy.pdxfixit.com/isopix/. A change to what the app collects or shows updates it in the same commit (bump `updated:`; write the address as `{contact}`); once it is on `main`, `just policy` hands it to pdxfixit/privacy's own send script, which copies and lands it (`--dry-run` stops before landing). `test/privacy-policy.test.mjs` checks its shape.
- **When the owner decides something,** record it in docs/decisions.md in the same commit; a replaced rule is deleted, not annotated.

## Working with the owner

The owner owns Isopix and decides what it does. He often reads replies on his phone.

**Claude agents manage this repo** (owner's standing approval, 2026-11-14): [docs/agents/ownership.md](docs/agents/ownership.md).

- **Answer short, result first:** what changed or what you found, then the numbers (tests passing, ms per frame, the live version), then anything he must do. Plain English; define a term the first time. Whimsy and emoji are welcome.
- **Judgment calls are his.** Anything that changes what the app looks like or does, or trades one good thing for another: give two or three options with your recommendation and why, and ask before building it. Mechanical work (a fix with a clear right answer, tests, docs that match the code) needs no permission.
- **Ask in chat when it blocks the work, in [docs/questions.md](docs/questions.md) when it can wait.** That file says how to write a card and how an answer gets recorded.
- **His rules hold even when they are inconvenient:** nothing is pushed, deployed, deleted (DNS included) or published against them. If a rule seems wrong, say so and ask; do not work around it.
- **Record his words.** When he decides something, the docs/decisions.md row quotes him (`Owner: "…"`).
- **Say plainly what you did not check.** Real touch, pen and phone speed cannot be tested here (see Verify).

## More detail: `docs/agents/`

Detail that used to live in this file, one topic per file. Open the one you need.

| File | Read it when |
|---|---|
| [docs/agents/ownership.md](docs/agents/ownership.md) | before you merge, land, or delete branches, worktrees or remote branches |
| [docs/agents/where-things-are.md](docs/agents/where-things-are.md) | you need to know which path holds what: `web/`, `worker/`, `spec/`, `test/`, `tools/`, the recipes |
| [docs/agents/verify.md](docs/agents/verify.md) | before you call a change done: tests, `just look`, output checks, what no tool here can test |
| [docs/agents/ship.md](docs/agents/ship.md) | you version, commit, land or deploy a change, or watch the live site |
| [docs/agents/ci.md](docs/agents/ci.md) | you read a CI run or touch a workflow |
| [docs/agents/outside-repo.md](docs/agents/outside-repo.md) | something you need is not in the repo: flarepress, the Cloudflare token, GitHub access, a real phone |
| [docs/agents/handoff.md](docs/agents/handoff.md) | before you stop: the warm start and the final report |
