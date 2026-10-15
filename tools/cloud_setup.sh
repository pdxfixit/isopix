#!/usr/bin/env bash
# Cloud session setup (claude.ai/code), so an agent there can test and look
# like on the owner's Mac. Cloud sessions never deploy: GitHub does, with this
# repo's own token (.github/workflows/deploy.yml; docs/environment.md). Idempotent
# and quick when already done; it never fails the session.
#
# Two callers, both one-line shims:
#   - the cloud environment's setup script (runs as root before Claude starts;
#     its result is cached for about a week):
#       f=/home/user/isopix/tools/cloud_setup.sh; [ -f "$f" ] && bash "$f" || true
#   - .claude/hooks/session-start.sh, every session: git settings live in each
#     fresh clone, and the setup script's result is cached.
#
# What it does: installs just (pinned) and runs `just setup` (the pre-commit
# hook and the PDXfixIT author). Chrome needs nothing: tools/chrome.mjs finds
# the cloud's Playwright Chromium.
set -uo pipefail
ROOT=$(cd "$(dirname "$0")/.." && pwd)
JUST_VERSION=1.58.0
say() { echo "☁️  $*"; }

# just (stdlib-only Python wheel; pip reaches PyPI on the default network level)
if ! command -v just >/dev/null || [ "$(just --version 2>/dev/null)" != "just $JUST_VERSION" ]; then
  pip install -q "rust-just==$JUST_VERSION" >/dev/null 2>&1 && say "just $JUST_VERSION installed" || say "⚠️ could not install just"
fi

# This clone: the pre-commit hook and the commit author.
if [ -d "$ROOT/.git" ] && command -v just >/dev/null; then
  (cd "$ROOT" && just setup >/dev/null 2>&1) && say "git: pre-commit hook on, commits authored as PDXfixIT"
fi

# A Cloudflare token here would let any agent in the environment change every
# site in the account: deploys need none in a session.
[ -z "${CLOUDFLARE_API_TOKEN:-}" ] || say "⚠️ CLOUDFLARE_API_TOKEN is set in this environment: remove it (cloud environment settings); GitHub deploys"
exit 0
