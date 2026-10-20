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
| `npx wrangler` (comes with Node) | deploys only, run by flarepress | 4.151.0 (flarepress pins it) | nothing to install |

Check them all: `node --version; python3 --version; just --version; gh auth status`.

## Ports and where output goes

- `just serve` is port **8790**, the owner's own server. Agents use **8791**
  (`just serve 8791`) so they never take his port.
  `.claude/launch.json` names that server `isopix-agent`, so the Browser
  pane's `preview_start` can start it by name.
- `just look` and `just export-check` save screenshots and files in a new
  temporary folder and print its path on the last line (`📸 screenshots: …`).
  `--out DIR` puts them somewhere you choose. Open the PNGs and look at them.
  With `--shards N` (as `just look-ci` runs it), each shard's go in `DIR/1` to `DIR/N`.
- CI uploads the same screenshots as artifacts of each `test` run:
  `screenshots-wide` and `screenshots-short` (the look passes) and
  `screenshots-export`: `gh run download <run-id> -n screenshots-wide`. A
  docs-only push skips the browser checks, so it has none.
- Fonts differ: the app's `system-ui` is Inter in a cloud session's Chromium
  and the wider DejaVu Sans in CI's Chrome on Ubuntu, so a row of buttons that
  fits locally with a few px to spare can wrap in CI (the selection bar at
  320 px did, 2026-10-19). Try a tight row with CI's font:
  `just look selmore --widths 320 --js "document.body.style.fontFamily='DejaVu Sans'"`.

## Things outside this repo

| Thing | What it is for | If it is missing | Who can supply it |
|---|---|---|---|
| **flarepress** (public, `github.com/pdxfixit/flarepress`; `~/src/flarepress` on the owner's Mac) | The deploy code: `flarepress/tools/site.sh` (the steps every app site shares, configured by this repo's `site/site.conf`), `flarepress/tools/wrangler.sh` (push and plan, on `site/wrangler.toml`) and the harvest. GitHub's deploy checks out its rolling `v1` tag, which the owner moves to release. | Only the owner's Mac needs a clone (`git clone https://github.com/pdxfixit/flarepress ~/src/flarepress`, or `FLAREPRESS=/path`). Sessions do not deploy. | — (public) |
| **Cloudflare login** | `wrangler deploy` needs credentials for the owner's Cloudflare account: on GitHub the repo secret `CLOUDFLARE_API_TOKEN`; on the owner's Mac a Keychain token, else wrangler's cached `wrangler login` (OAuth). | `just deploy` fails at the `push` step with an auth error. An agent cannot log in (it needs a browser and the owner's account). Stop and ask the owner to run `npx wrangler login` in a terminal; nothing was published. | The owner only |
| **GitHub access** (`github.com/pdxfixit/isopix`, public) | `git push` (deploys refuse an unpushed commit), and reading CI with `gh`. | Without push access you can commit locally but not ship. Without `gh`, read runs at https://github.com/pdxfixit/isopix/actions if you can, or ask the owner. | The owner |
| **The owner's Justfile house style** | How recipes are written. | Summarized here: [justfile-style.md](justfile-style.md). | — (in repo) |
| **The design brief** | Background on intent. | In repo: [design-brief.md](design-brief.md). | — (in repo) |
| **A real phone or tablet** | Real multi-touch, pen, install to home screen, speed on a phone. | No tool here can test these. Say so in your report and add the check to "Try first" in [state.md](state.md). | The owner |

## A cloud session (claude.ai/code)

Cloud sessions test, look and push; they never deploy and hold no Cloudflare
token (2026-10-15: GitHub deploys with this repo's own token). The
environment's setup script is a shim to `tools/cloud_setup.sh`:
`f=/home/user/isopix/tools/cloud_setup.sh; [ -f "$f" ] && bash "$f" || true`.
`.claude/hooks/session-start.sh` runs the same script at every session start
(git settings live in each fresh clone). It installs `just` (pinned), runs
`just setup`, and warns if a `CLOUDFLARE_API_TOKEN` is still in the
environment (remove it there). `deploy-check` reads the public repo's CI runs
from GitHub's API when `gh` is not logged in.

## A session that cannot deploy

Every agent session, cloud or Mac: deploys are GitHub's (or the owner's own
`just --yes deploy`). An agent can do everything except publish:

1. Work and verify as usual: `just test`, `just export-check`, and `just look`
   if Chrome is installed (if not, CI's look step runs it; download the
   screenshots).
2. Bump `web/version.js` with `just version` when `web/` changed, commit by
   explicit path, `git push`, and read the CI run until it is green.
3. Do not try to deploy another way, and do not ask for a Cloudflare token.
   In [state.md](state.md) "In flight", write: committed and pushed, **not
   deployed**, the commit, and that it needs the deploy workflow (Actions →
   deploy → Run workflow) or the owner's `just --yes deploy`. Say the same in
   your final report.
4. A deploy that did not happen or failed shows as a red or missing
   `deploy` run for your push; the daily live check (`live.yml`) checks only
   that the site is up, not which version it serves.
