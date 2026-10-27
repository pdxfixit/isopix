#!/usr/bin/env bash
# Copies this app's privacy policy (docs/privacy-policy.md) into the privacy repo and lands it there, so
# privacy.pdxfixit.com/isopix/ says what the app says. Run by `just policy`, once the policy change is on main.
# The same script, bar the app name, runs in every app (Arrow-Rama, Isopix, Noodle Pads, Orbit): the app's
# own repo holds the text, and the agent that changes it copies it over in the same task. No CI link between repos.
#
#   tools/policy.sh             copy, build and test there, commit, then `just land` there
#   tools/policy.sh --dry-run   find and update the privacy checkout and check the policy; run neither `just take` nor `just land`
set -euo pipefail

APP=isopix
FILE=docs/privacy-policy.md
dry=0
case "${1:-}" in
  "") ;;
  --dry-run) dry=1 ;;
  -h|--help) sed -n '2,9p' "$0" | sed 's/^# \{0,1\}//'; exit 0 ;;
  *) echo "🛑 unknown argument '$1' (only --dry-run)" >&2; exit 2 ;;
esac

cd "$(git rev-parse --show-toplevel)"
root=$(pwd -P)
[ -f "$FILE" ] || { echo "🛑 $FILE is missing" >&2; exit 1; }

# The copy must match a commit: the privacy repo's commit names this one.
if [ -n "$(git status --porcelain -- "$FILE")" ]; then
  echo "🛑 $FILE has uncommitted changes: commit it first, so the copy matches a commit" >&2
  exit 1
fi
sha=$(git rev-parse --short HEAD)

# Find the privacy checkout: $PRIVACY, else the one beside this repo's main checkout, else a clone in the cache
# (the way land finds flarepress).
pv=${PRIVACY:-$(cd "$(git rev-parse --git-common-dir)/../.." && pwd)/privacy}
[ -e "$pv/justfile" ] || pv=${XDG_CACHE_HOME:-$HOME/.cache}/privacy
if [ ! -e "$pv/justfile" ]; then
  [ -z "${PRIVACY:-}" ] || { echo "🛑 PRIVACY=$PRIVACY is not a privacy checkout (no justfile)" >&2; exit 1; }
  git clone -q https://github.com/pdxfixit/privacy "$pv"
fi

# Take it to main, current with GitHub, and clean: its `just take` commits on whatever is checked out.
[ "$(git -C "$pv" rev-parse --abbrev-ref HEAD)" = main ] || { echo "🛑 $pv is not on main" >&2; exit 1; }
[ -z "$(git -C "$pv" status --porcelain)" ] || { echo "🛑 $pv has uncommitted changes: commit or stash them first" >&2; exit 1; }
git -C "$pv" pull -q --ff-only origin main

if [ "$dry" = 1 ]; then
  echo "🧪 dry run: would run, in $pv:"
  echo "   TAKE_SHA=$sha just take $APP $root/$FILE"
  echo "   just land"
  exit 0
fi

cd "$pv"
before=$(git rev-parse HEAD)
TAKE_SHA="$sha" just take "$APP" "$root/$FILE"
if [ "$(git rev-parse HEAD)" = "$before" ]; then
  echo "✅ privacy already has this policy: nothing to land"
  exit 0
fi
just land
