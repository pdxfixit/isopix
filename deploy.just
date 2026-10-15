# Isopix deploys: https://isopix.app, through flarepress.
# Imported by the justfile (`import? 'deploy.just'`). The logic is in
# tools/deploy.sh, which calls flarepress's tools/site.sh for the steps every app
# site shares; these recipes are the menu. See docs/deploy-cloudflare.md.
# Only `deploy` and `rollback --yes` change the live site, and `deploy` needs `just --yes`.

# (The shell setting, bash -uc, comes from the justfile that imports this file: a setting cannot be set twice.)

# Deploys go through ~/src/flarepress, the owner's Cloudflare deploy repo; its isopix.app/public links to this repo's web/.
# FLAREPRESS=/path points at a clone somewhere else.
flarepress := env("FLAREPRESS", env("HOME") / "src/flarepress")

# tools/deploy.sh reads the same location.
export FLAREPRESS := flarepress

# 🔎 Read-only pre-flight: on main, web/ committed, index + manifest + service worker present, tests pass; shows the version that would ship
deploy-check:
    @tools/deploy.sh check

# 🧪 Dry run of the deploy (wrangler validates and lists the files, sends nothing); runs deploy-check first
deploy-plan: deploy-check
    just --justfile {{flarepress}}/Justfile --working-directory {{flarepress}} plan isopix.app

# 📥 Copy Isopix's usage counts (D1) and Cloudflare's stats into the archive on this Mac; read-only. Every deploy runs it first
harvest *args:
    @tools/deploy.sh harvest {{args}}

# 🏷️ Write web/version.json (gitignored): git describe, plus -dirty for uncommitted edits in web/
deploy-stamp:
    @tools/deploy.sh stamp

# 🚀 Publish web/ to https://isopix.app (public): check, stamp, push, then verify. Needs: just --yes deploy (the first publish also FIRST_PUBLISH=1)
[confirm("Deploy Isopix to isopix.app (public)? (y/N)")]
deploy:
    @tools/deploy.sh harvest
    @tools/deploy.sh check
    @tools/deploy.sh gate
    @tools/deploy.sh stamp
    just --justfile {{flarepress}}/Justfile --working-directory {{flarepress}} push isopix.app
    @tools/deploy.sh verify

# 🔎 After a deploy: waits for the live version, then checks 200s, manifest, service-worker cache header and (if the app has it) `just look` on the live site; exit 1 names what failed
deploy-verify *flags:
    @tools/deploy.sh verify {{flags}}

# 📋 What is live right now: status codes, cache header, etag, last-modified, version, with ✅/⚠️ marks (read-only)
live:
    @tools/deploy.sh live

#   just rollback                      show the steps for the previous release
#   just rollback --to abc123 --yes    redeploy that commit through a throwaway worktree, then verify
# ⏪ Roll the live site back to the previous release (the commit before the last one that changed web/): prints the steps; add --yes to run them (--to <commit> picks another)
[positional-arguments]
rollback *flags:
    @tools/deploy.sh rollback "$@"

# The message comes from a file. Stops at the first failure: tests red, main moved under you, or a file that changed while committing.
# 🚢 Commit the named files to main through a throwaway worktree, test, push, then deploy: just --yes ship msg.txt web/app.js
[confirm("Commit these files to main, push, and deploy Isopix to isopix.app (public)? (y/N)")]
ship msgfile +files:
    #!/usr/bin/env bash
    set -euo pipefail
    files=({{files}})
    just test > /dev/null || { echo "🛑 tests fail; nothing committed" >&2; exit 1; }
    old=$(git rev-parse main)
    wt=.worktrees/ship-$(date +%s)-$$
    git worktree add -q --detach "$wt" main
    trap 'git worktree remove --force "$wt" 2>/dev/null || true' EXIT
    for f in "${files[@]}"; do mkdir -p "$wt/$(dirname "$f")"; cp "$f" "$wt/$f"; done
    git -C "$wt" add -A -- "${files[@]}"
    git -C "$wt" commit -q -F "$(cd "$(dirname '{{msgfile}}')" && pwd)/$(basename '{{msgfile}}')"
    for f in "${files[@]}"; do cmp -s "$f" "$wt/$f" || { echo "🛑 $f changed while committing" >&2; exit 1; }; done
    (cd "$wt" && just test > /dev/null) || { echo "🛑 tests fail on the commit; main unchanged" >&2; exit 1; }
    git update-ref refs/heads/main "$(git -C "$wt" rev-parse HEAD)" "$old"
    git reset -q
    if git remote get-url origin > /dev/null 2>&1; then git push -q origin main; else echo "⚠️ no origin remote; not pushed"; fi
    git log --oneline -1 | cat
    out=$(just --yes deploy 2>&1) || { echo "$out" >&2; exit 1; }
    echo "$out" | tail -1
