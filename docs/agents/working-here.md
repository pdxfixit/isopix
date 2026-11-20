# Working here

The standing rules for changing this repo. [AGENTS.md](../../AGENTS.md) points here; landing and the stamp are in [ship.md](ship.md), tests in [verify.md](verify.md).

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
