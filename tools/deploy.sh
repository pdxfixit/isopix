#!/usr/bin/env bash
# Isopix deploy helper: the logic behind deploy.just (the Justfile is the menu,
# this is the tool). Subcommands: check, gate, stamp, verify, live, rollback.
#
# The shared steps (check, gate, stamp, verify, live, rollback) are flarepress's
# tools/site.sh, configured by flarepress/isopix.pdxfixit.com/site.conf, so
# every app site deploys the same way. Isopix's own steps are here: the tests
# and the version.js bump before a deploy, and `just look` on the live site after
# one. Only `push` and `rollback --yes` ever change the live site, and both are
# reached only through the recipes that demand --yes.
set -euo pipefail
cd "$(dirname "$0")/.."

SITE=isopix.pdxfixit.com
export FLAREPRESS="${FLAREPRESS:-$HOME/src/flarepress}"
# DEPLOY_URL points the live checks at another server (for trying this script out).
URL="${DEPLOY_URL:-https://$SITE}"
TOOL="$FLAREPRESS/tools/site.sh"
[ -x "$TOOL" ] || { echo "🛑 no $TOOL: update flarepress (git -C $FLAREPRESS pull; docs/environment.md)" >&2; exit 1; }
site() { "$TOOL" "$SITE" "$@"; }

# GitHub's test run for HEAD must be green: `just look` and export-check run only
# there. A run still going is waited for (CI's own 20-minute limit bounds it). SKIP_CI=1 skips
# this, for when GitHub or gh is down; say so in the report.
ci_green() {
  local sha st id
  [ "${SKIP_CI:-}" = 1 ] && { echo "⚠️ SKIP_CI=1: deploying without GitHub's test run"; return 0; }
  command -v gh >/dev/null || { echo "🛑 no gh, so CI cannot be read (SKIP_CI=1 deploys without it)" >&2; return 1; }
  sha=$(git rev-parse HEAD)
  for _ in 1 2 3 4 5 6; do   # a run appears a few seconds after the push
    st=$(gh run list --workflow test.yml --commit "$sha" --limit 1 --json databaseId,status,conclusion \
      -q '.[0] | "\(.databaseId) \(.status) \(.conclusion)"' 2>/dev/null || true)
    [ -n "$st" ] && break; sleep 10
  done
  [ -n "$st" ] || { echo "🛑 no CI run for ${sha:0:7} on GitHub (pushed? gh run list)" >&2; return 1; }
  id=${st%% *}
  case "$st" in
    *" completed success") ;;
    *" completed "*) echo "🛑 CI failed for ${sha:0:7}: gh run view $id --log-failed" >&2; return 1 ;;
    *) echo "⏳ CI is running for ${sha:0:7}; waiting for it (gh run watch $id)"
       gh run watch "$id" --exit-status >/dev/null 2>&1 \
         || { echo "🛑 CI did not pass for ${sha:0:7}: gh run view $id --log-failed" >&2; return 1; } ;;
  esac
  echo "✅ CI green for ${sha:0:7} (tests, export-check, just look)"
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
    # some edges for a few seconds: retry before calling it a failure.
    ok=0; for _ in 1 2 3; do just look --url "$URL/" >/dev/null 2>&1 && { ok=1; break; }; sleep 20; done
    [ "$ok" = 1 ] && echo "✅ just look: no errors on the live site" \
      || { echo "🛑 just look found problems on the live site (run: just look --url $URL/)" >&2; exit 1; } ;;
  gate|stamp|live|rollback) site "$sub" "$@" ;;
  *) echo "usage: deploy.sh check|gate|stamp|verify [--want V] [--web DIR]|live|rollback [--to COMMIT] [--yes]" >&2; exit 2 ;;
esac
