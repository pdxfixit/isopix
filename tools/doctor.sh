#!/bin/sh
# `just doctor`: what a fresh session needs to know about this machine and this
# checkout before it starts, in one look. Read-only: it changes nothing, and the
# only network call is the live site's public version.json.
#
# ✅ ready · ⚠️ works, with a limit named · ❌ missing (exit 1)

bad=0
ok()   { printf '✅ %s\n' "$*"; }
warn() { printf '⚠️  %s\n' "$*"; }
fail() { printf '❌ %s\n' "$*"; bad=1; }

root=$(git rev-parse --show-toplevel 2>/dev/null) || { fail "not in a git checkout of this repo"; exit 1; }
cd "$root" || exit 1

# Where am I? just land pushes main from any checkout, but an agent's branch is
# landed from its own worktree, and the main checkout stays on main.
git_dir=$(cd "$(git rev-parse --git-dir)" && pwd)
common=$(cd "$(git rev-parse --git-common-dir)" && pwd)
branch=$(git branch --show-current)
if [ "$git_dir" = "$common" ]; then
  ok "main checkout ($root), on ${branch:-a detached HEAD}"
else
  ok "a worktree on ${branch:-a detached HEAD}: commit here, then just land (docs/how-to.md)"
fi
if [ "$(git rev-parse --is-shallow-repository 2>/dev/null)" = true ]; then
  warn "a shallow clone: just version needs the whole history (git fetch --unshallow)"
fi
if [ "$(git config core.hooksPath)" = .githooks ] && [ "$(git config user.name)" = PDXfixIT ]; then
  ok "git hooks on, commits authored as PDXfixIT"
else warn "run just setup: the pre-commit hook and the PDXfixIT author are not set here"; fi
dirty=$(git status --porcelain | wc -l | tr -d ' ')
[ "$dirty" = 0 ] || warn "$dirty uncommitted file(s) here (git status)"

# Tools. Tests need node; tools need python3 3.8+; just look needs Node's own
# WebSocket (Node 22+) and Chrome; just land and just ci-wait need gh.
if command -v just > /dev/null; then ok "just $(just --version | cut -d' ' -f2)"
else fail "just is missing (brew install just, or pip install rust-just)"; fi
if command -v node > /dev/null; then
  if node -e 'process.exit(typeof WebSocket === "function" ? 0 : 1)'; then ok "node $(node --version)"
  else warn "node $(node --version) has no WebSocket: just test works, just look needs Node 22+"; fi
else fail "node is missing: just test needs it"; fi
if command -v python3 > /dev/null && python3 -c 'import sys; sys.exit(sys.version_info < (3, 8))'; then
  ok "python3 $(python3 -c 'import platform; print(platform.python_version())')"
else fail "python3 3.8 or newer is missing: the tools and just serve need it"; fi
# The same Chrome tools/chrome.mjs picks: $CHROME, else the first that exists.
chrome=${CHROME:-}
if [ -z "$chrome" ]; then
  for c in "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" /usr/bin/google-chrome /usr/bin/chromium /usr/bin/chromium-browser \
    /opt/pw-browsers/chromium-*/chrome-linux64/chrome /opt/pw-browsers/chromium-*/chrome-linux/chrome; do
    [ -x "$c" ] && { chrome=$c; break; }
  done
fi
[ -n "$chrome" ] && [ -x "$chrome" ] && ok "Chrome for just look and the other browser checks" || warn "no Chrome found (set CHROME=…): just look and the browser checks can't run"
if command -v gh > /dev/null && gh auth status > /dev/null 2>&1; then ok "gh is signed in (just land, just ci-wait)"
else warn "gh is missing or signed out: just land and just ci-wait can't run; push a land/ branch and say so"; fi
[ -z "${CLOUDFLARE_API_TOKEN:-}" ] || warn "CLOUDFLARE_API_TOKEN is set here: agents hold none (GitHub deploys)"

# The names check needs its hashes (outside the repo, it is public).
if [ -n "${ISOPIX_NAME_HASHES:-}" ] || [ -s "$HOME/.config/isopix/names.json" ]; then ok "names hashes found: just test scans for the family's names"
else warn "no ISOPIX_NAME_HASHES or ~/.config/isopix/names.json: just test skips the names scan here (CI runs it)"; fi

# What is live, against main. The deploy stamps version.json as
# {"version":"v<release>-<short sha>[-dirty]","commit":"<short sha>",…};
# its commit is compared with main (ISOPIX_LIVE_VERSION_URL: tools/test_doctor.py).
url=${ISOPIX_LIVE_VERSION_URL:-https://isopix.app/version.json}
json=$(curl -fsS --max-time 5 "$url" 2>/dev/null)
live=$(printf '%s' "$json" | sed -n 's/.*"version":"\([^"]*\)".*/\1/p')
sha=$(printf '%s' "$json" | sed -n 's/.*"commit":"\([0-9a-f]*\)".*/\1/p')
# A cloud container's clone often has only origin/main: compare with that then.
ref=main
main=$(git rev-parse -q --verify refs/heads/main 2>/dev/null) || { ref=origin/main; main=$(git rev-parse -q --verify refs/remotes/origin/main 2>/dev/null); }
at=$( [ -n "$sha" ] && git rev-parse -q --verify "$sha^{commit}" 2>/dev/null)
if [ -z "$live" ]; then warn "couldn't read $url"
elif [ -z "$main" ]; then warn "live: $live; this checkout has no main or origin/main to compare it with"
elif [ "$at" = "$main" ] && [ "${live%-dirty}" = "$live" ]; then ok "live: $live, which is $ref"
elif [ "$at" = "$main" ]; then warn "live: $live: $ref, deployed with uncommitted edits (a dev deploy from the Mac)"
elif [ -n "$at" ] && git merge-base --is-ancestor "$at" "$main"; then
  warn "live: $live; $ref is $(git rev-list --count "$at..$main") commit(s) ahead (undeployed, or a deploy in progress; a push that changes nothing under web/, worker/ or site/ is not deployed)"
else warn "live: $live; $ref ($(git rev-parse --short "$main")) does not hold that commit: git fetch, or it was deployed from another branch"; fi

echo
echo "Cold start, in order: AGENTS.md, docs/state.md, docs/decisions.md (your sections), docs/questions.md, TODO.md, then docs/how-to.md for your task."
exit $bad
