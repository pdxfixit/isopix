#!/usr/bin/env bash
# Isopix deploy helper: the logic behind deploy.just (the Justfile is the menu,
# this is the tool). Subcommands: check, gate, stamp, verify, live, rollback.
#
# The shared steps (check, gate, stamp, verify, live, rollback) are flarepress's
# tools/site.sh (github.com/pdxfixit/flarepress), configured by site/site.conf
# here, so every app site deploys the same way; push is its tools/wrangler.sh. Isopix's own steps are here: the tests
# and the version.js bump before a deploy, and `just look` on the live site after
# one. Only `push` and `rollback --yes` ever change the live site, and both are
# reached only through the recipes that demand --yes. GitHub runs the same
# recipe (.github/workflows/deploy.yml) with this repo's own token.
set -euo pipefail
cd "$(dirname "$0")/.."

SITE="$PWD/site"
export FLAREPRESS="${FLAREPRESS:-$HOME/src/flarepress}"
# No clone there (a cloud session): the copy `just land` keeps in the cache will do.
cached="${XDG_CACHE_HOME:-$HOME/.cache}/flarepress"
[ -x "$FLAREPRESS/tools/site.sh" ] || [ ! -x "$cached/tools/site.sh" ] || export FLAREPRESS="$cached"
# DEPLOY_URL points the live checks at another server (for trying this script out).
URL="${DEPLOY_URL:-https://isopix.app}"
TOOL="$FLAREPRESS/tools/site.sh"
[ -x "$TOOL" ] || { echo "🛑 no $TOOL: update flarepress (git -C $FLAREPRESS pull; docs/environment.md)" >&2; exit 1; }
site() { "$TOOL" "$SITE" "$@"; }

# GitHub's test run for HEAD must be green: `just look` and export-check run only
# there. A run still going is waited for (CI's own 20-minute limit bounds it). SKIP_CI=1 skips
# this, for when GitHub or gh is down; say so in the report. Without a logged-in
# gh (a cloud session), it reads the public repo's runs from GitHub's API instead.
ci_run() {  # "id status conclusion" of test.yml's newest run for $1, or nothing
  if gh auth status >/dev/null 2>&1; then
    gh run list --workflow test.yml --commit "$1" --limit 1 --json databaseId,status,conclusion \
      -q '.[0] | "\(.databaseId) \(.status) \(.conclusion)"' 2>/dev/null || true
  else
    curl -fsS -m 20 ${GITHUB_TOKEN:+-H "Authorization: Bearer $GITHUB_TOKEN"} "https://api.github.com/repos/pdxfixit/isopix/actions/workflows/test.yml/runs?head_sha=$1&per_page=1" 2>/dev/null \
      | python3 -c 'import json,sys; r=json.load(sys.stdin)["workflow_runs"]; print(r and "%s %s %s" % (r[0]["id"], r[0]["status"], r[0]["conclusion"]) or "")' 2>/dev/null || true
  fi
}
ci_green() {
  local sha st id
  [ "${SKIP_CI:-}" = 1 ] && { echo "⚠️ SKIP_CI=1: deploying without GitHub's test run"; return 0; }
  sha=$(git rev-parse HEAD)
  for _ in 1 2 3 4 5 6; do   # a run appears a few seconds after the push
    st=$(ci_run "$sha"); [ -n "$st" ] && break; sleep 10
  done
  [ -n "$st" ] || { echo "🛑 no CI run for ${sha:0:7} on GitHub (pushed? gh run list)" >&2; return 1; }
  id=${st%% *}
  case "$st" in *" completed "*) ;; *) echo "⏳ CI is running for ${sha:0:7} (run $id); waiting for it" ;; esac
  # A read that fails (rate limit, network) keeps the last status it had: an
  # empty answer is not "still running" (it once hid a green run for 20 minutes).
  local next misses=0
  for _ in $(seq 1 120); do   # up to 20 minutes, CI's own limit
    case "$st" in *" completed "*) break ;; esac
    sleep 10; next=$(ci_run "$sha")
    if [ -n "$next" ]; then st=$next; misses=0; else misses=$((misses + 1)); fi
    [ "$misses" = 6 ] && echo "⚠️ GitHub has not answered for a minute (rate limit?); still waiting" >&2
  done
  case "$st" in
    *" completed success") echo "✅ CI green for ${sha:0:7} (tests, export-check, move-check, just look)" ;;
    *" completed "*) echo "🛑 CI failed for ${sha:0:7}: https://github.com/pdxfixit/isopix/actions/runs/$id" >&2; return 1 ;;
    *) if [ "$misses" -gt 0 ]; then echo "🛑 could not read CI for ${sha:0:7} for $((misses / 6)) of the last 20 minutes (GitHub rate limit?); it may be green: https://github.com/pdxfixit/isopix/actions/runs/$id" >&2
       else echo "🛑 CI still not done for ${sha:0:7} after 20 minutes: https://github.com/pdxfixit/isopix/actions/runs/$id" >&2; fi
       return 1 ;;
  esac
}

sub=${1:-}; shift || true
case "$sub" in
  check)
    site check --from "$PWD" "$@"
    if ! out=$(just test 2>&1); then echo "$out" >&2; echo "🛑 tests fail; nothing to deploy" >&2; exit 1; fi
    echo "✅ tests pass"
    tools/version_bumped.sh || echo "⚠️ run 'just version' and commit it (installed apps key their cache on it; CI fails without it)"
    [ "$(git config core.hooksPath)" = .githooks ] || echo "⚠️ the pre-commit hook is off in this clone: just setup"
    ci_green ;;
  verify)
    site verify "$@"
    # Console errors on the live site. A file added in this release can 404 at
    # some edges for a few seconds: retry before calling it a failure. When this
    # Mac cannot resolve the host yet (a cached miss after a first publish), Chrome
    # goes to 1.1.1.1's answer, as site.sh's checks do.
    rc=0; curl -sS -m 10 -o /dev/null "$URL/" 2>/dev/null || rc=$?
    if [ "$rc" = 6 ]; then
      host=${URL#*://}; host=${host%%[/:]*}
      ip=$(dig +short +time=3 @1.1.1.1 "$host" 2>/dev/null | grep -E '^[0-9]+(\.[0-9]+){3}$' | head -1 || true)
      [ -n "$ip" ] && export CHROME_HOST_RULES="MAP $host $ip"
    fi
    ok=0; for _ in 1 2 3; do just look --url "$URL/" >/dev/null 2>&1 && { ok=1; break; }; sleep 20; done
    [ "$ok" = 1 ] && echo "✅ just look: no errors on the live site" \
      || { echo "🛑 just look found problems on the live site (run: just look --url $URL/)" >&2; exit 1; } ;;
  push) "$FLAREPRESS/tools/wrangler.sh" "$SITE" deploy "$@" ;;
  plan) "$FLAREPRESS/tools/wrangler.sh" "$SITE" deploy --dry-run "$@" ;;
  gate|stamp|live|rollback) site "$sub" "$@" ;;
  *) echo "usage: deploy.sh check|gate|stamp|push|plan|verify [--want V] [--web DIR]|live|rollback [--to COMMIT] [--yes]" >&2; exit 2 ;;
esac
