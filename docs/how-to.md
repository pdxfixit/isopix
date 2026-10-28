# How to

Step by step for the common jobs, so a fresh session never has to guess. [AGENTS.md](../AGENTS.md) has the rules; this file has the order to apply them in. Start every session with `just doctor`: it says whether you are in the main checkout or a worktree, checks just, node, python, Chrome and gh, and tells you whether `main` is live. It only reads.

## Where you run things

| You are in | You may | You may not |
|---|---|---|
| A worktree (`.claude/worktrees/agent-…`, or a branch of your own) | Edit, `just test`, `just prove`, `just look`, commit on your branch, `just land` from it (no sha: this branch's commits) | Deploy. GitHub deploys every push to `main` that changes `web/`, `worker/` or `site/`. |
| The main checkout (on `main`) | All of the above, plus `just land <sha>…` for other agents' commits | `just --yes deploy`: the owner's fallback from his Mac; agents hold no Cloudflare token. |
| A cloud session | Edit, test, `just look` (Chrome is in `/opt/pw-browsers`), commit, `just land` when `gh` is signed in | Deploy. Without `gh`, `just land` and `just ci-wait` cannot run: push the commits to a `land/<topic>` branch and say so; a session with `gh` lands it. |

A cloud clone can be shallow. `just version` and the stamp checks count commits, so run `git fetch --unshallow` first (`tools/cloud_setup.sh` does it at session start).

## A fix in `web/`

1. **Find the module.** [README.md](../README.md) has the file map; each module opens with a comment saying what it owns.
2. **Write the failing test first** in the matching `test/<module>.test.mjs`. Pure logic goes in `web/engine/` and is tested directly.
3. **Fix it.** Run one file with `node --test --test-force-exit test/<file>`.
4. **Prove it:** `just prove test/<file> web/<changed files…>` must say ✅ (fails without your change, passes with it).
5. **`just test`**, judged by its exit code.
6. **Look at it** if a person would see it: `just look <view>` (`just look --help` lists them; add a view for a new screen), then read the screenshots. A style attribute or a read of `.innerHTML` in `web/` is blocked by the CSP and caught by `test/headers.test.mjs`.
7. **`just version`**, and commit `web/version.js` with the change. It counts the commit about to be made, so run it before `git commit`, never with your commit already in `HEAD`.
8. **Docs in the same commit:** `docs/state.md` if what is live or in flight changed; `web/help.js` for a control; `docs/decisions.md` for a rule the owner decided; the privacy policy (`docs/privacy-policy.md`, bump `updated:`) for anything collected or shown.
9. **Commit by explicit path** (`git add <files>`, never `-A`): other agents work in this repo. `<type>: <summary>`, a bullet body, the `Co-Authored-By` trailer.
10. **Land it:** `just land` from your worktree, then `just ci-wait` for green CI. A red run after the upload means the new version is already live: fix forward.

## Landing other agents' work

From the main checkout:

1. Check the agent has finished: its report arrived, and `git -C <worktree> status --porcelain` is empty.
2. `git log --oneline main..<branch>` lists its commits. `just land <sha>…` pulls `main` from GitHub, cherry-picks them in order, restamps `web/version.js`, tests and pushes. A conflict it cannot resolve stops it with the worktree kept: resolve there, then `just land-continue <worktree>`.
3. `just ci-wait`, then clean up with `just archive-agent <branch or agent id>`: it checks the worktree is clean and every commit is on `main` (by patch, then by subject), tags `archive/<branch>`, and removes the worktree and branch.

## Deploy and rollback

GitHub deploys; read the run (`just ci-wait`, then `just live`). Detail, rollback and the DNS-conflict steps: [deploy-cloudflare.md](deploy-cloudflare.md). The owner runs `just rollback` (it prints the steps; `--yes` runs them).
