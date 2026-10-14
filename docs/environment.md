# Environment: tools, and things outside this repo

What a session needs installed, and every outside thing the workflows touch:
what it is for, what to do when it is missing, and who can supply it.

## Tools

Versions are what this repo was last run with (the owner's Mac, 2026-10-12) and what
CI pins. Newer usually works; older Node does not.

| Tool | Needed for | Known good | Install (macOS / Ubuntu) |
|---|---|---|---|
| Node 22 or newer | `just test`, `just look`, `just export-check`, `just perf` (they use Node's built-in `fetch`, `WebSocket` and test runner; no packages) | 26.11 (Mac), 22.11.0 (CI) | `brew install node` / nodesource or `actions/setup-node` |
| Python 3.8 or newer | `just serve`, `just version`, `just live-check`, the tools' unit tests (stdlib only) | 3.14 | preinstalled / `apt install python3` |
| just 1.36 or newer | every recipe (`[positional-arguments]` and `import?` need a recent one; Ubuntu's package is too old) | 1.58 (Mac), 1.36.0 (CI) | `brew install just` / the release tarball, as in `.github/workflows/test.yml` |
| Google Chrome | `just look`, `just export-check`, `just perf`, `deploy-verify`'s live look (headless, a private profile each run) | current stable | `brew install --cask google-chrome` / Google's `.deb` (GitHub's Ubuntu runners have it at `/usr/bin/google-chrome`). Found by itself at the macOS path, `/usr/bin/google-chrome` or `chromium`, or a cloud session's Playwright Chromium in `/opt/pw-browsers`; anywhere else, set `CHROME=/path/to/chrome`. As root (a cloud session) it runs without Chrome's sandbox. |
| git | everything | any recent | preinstalled |
| gh (GitHub CLI), signed in | deploys (`deploy-check` waits for CI to be green), reading CI: `gh run list`, `gh run view <id> --log-failed`, `gh run download <id>` | 2.102 | `brew install gh`, then `gh auth login` (The owner's GitHub account owns the repo) |
| curl | `just live`, `deploy-verify` | any | preinstalled |
| `npx wrangler` (comes with Node) | deploys only, run by flarepress | whatever `npx` fetches | nothing to install |

Check them all: `node --version; python3 --version; just --version; gh auth status`.

## Ports and where output goes

- `just serve` is port **8790**, the owner's own server. Agents use **8791**
  (`just serve 8791`) so they never take his port.
  `.claude/launch.json` names that server `isopix-agent`, so the Browser
  pane's `preview_start` can start it by name.
- `just look` and `just export-check` save screenshots and files in a new
  temporary folder and print its path on the last line (`📸 screenshots: …`).
  `--out DIR` puts them somewhere you choose. Open the PNGs and look at them.
- CI uploads the same screenshots as the `screenshots` artifact of each `test`
  run: `gh run download <run-id> -n screenshots`.

## Things outside this repo

| Thing | What it is for | If it is missing | Who can supply it |
|---|---|---|---|
| **flarepress** (`~/src/flarepress`, private repo `github.com/pdxfixit/flarepress`) | Deploys: its folder `isopix.pdxfixit.com/` holds `wrangler.toml` and a `public` link to this repo's `web/`; `deploy.just` calls its `plan` and `push` recipes, and `tools/deploy.sh` calls `flarepress/tools/site.sh` (configured by that folder's `site.conf`) for the steps every app site shares. | Clone it to `~/src/flarepress` (or set `FLAREPRESS=/path`). If `tools/deploy.sh` says flarepress has no `flarepress/tools/site.sh`, pull it (`git -C ~/src/flarepress pull`). If the clone lacks the Isopix folder, recreate it from [deploy-cloudflare.md](deploy-cloudflare.md#recreate-the-flarepress-folder). Without any access, you cannot deploy: see [A session that cannot deploy](#a-session-that-cannot-deploy). | The owner (repo access) |
| **Cloudflare login** | `wrangler deploy` needs credentials for the owner's Cloudflare account: a macOS Keychain token, else wrangler's cached `wrangler login` (OAuth). | `just deploy` fails at the `push` step with an auth error. An agent cannot log in (it needs a browser and the owner's account). Stop and ask the owner to run `npx wrangler login` in a terminal; nothing was published. | The owner only |
| **GitHub access** (`github.com/pdxfixit/isopix`, public) | `git push` (deploys refuse an unpushed commit), and reading CI with `gh`. | Without push access you can commit locally but not ship. Without `gh`, read runs at https://github.com/pdxfixit/isopix/actions if you can, or ask the owner. | The owner |
| **The owner's Justfile house style** | How recipes are written. | Summarized here: [justfile-style.md](justfile-style.md). | — (in repo) |
| **The design brief** | Background on intent. | In repo: [design-brief.md](design-brief.md). | — (in repo) |
| **A real phone or tablet** | Real multi-touch, pen, install to home screen, speed on a phone. | No tool here can test these. Say so in your report and add the check to "Try first" in [state.md](state.md). | The owner |

## A session that cannot deploy

A cloud session, or any session without flarepress, the Cloudflare login or
the Keychain (`security` is macOS only), can still do everything except
publish:

1. Work and verify as usual: `just test`, `just export-check`, and `just look`
   if Chrome is installed (if not, CI's look step runs it; download the
   screenshots).
2. Bump `web/version.js` with `just version` when `web/` changed, commit by
   explicit path, `git push`, and read the CI run until it is green.
3. Do not try to deploy another way, and do not ask for a Cloudflare token.
   In [state.md](state.md) "In flight", write: committed and pushed, **not
   deployed**, the commit, and that it needs `just --yes deploy` from the owner's
   Mac. Say the same in your final report.
4. Expect the daily live check (`live.yml`) to fail once main's
   `web/version.js` has been ahead of the live site for over an hour. That
   failure is the reminder, not a new problem.
