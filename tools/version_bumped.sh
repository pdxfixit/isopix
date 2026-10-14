#!/usr/bin/env bash
# Exit 1 when web/ changed after the last commit that bumped web/version.js.
# The service worker's cache name comes from that stamp, so a release that
# changes web/ without a bump leaves installed copies on old cached files.
# Used by deploy-check (a warning) and CI (a failure). Run `just version` to fix.
set -euo pipefail
cd "$(dirname "$0")/.."
last=$(git log -1 --format=%H -- web/version.js)
[ -n "$last" ] || { echo "🛑 web/version.js has never been committed" >&2; exit 1; }
changed=$(git diff --name-only "$last" HEAD -- web ':!web/version.js')
if [ -n "$changed" ]; then
  echo "🛑 web/ changed since web/version.js was bumped in $(git rev-parse --short "$last"):" >&2
  echo "$changed" | sed 's/^/   /' >&2
  exit 1
fi
echo "✅ web/version.js was bumped after the last change to web/"
