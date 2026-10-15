#!/usr/bin/env bash
# Cloud session setup (claude.ai/code), so an agent there can test, look and
# deploy like on the owner's Mac. Idempotent and quick when already done; it
# never fails the session (every step reports and moves on).
#
# Two callers, both one-line shims:
#   - the cloud environment's setup script (runs as root before Claude starts;
#     its result is cached for about a week):
#       f=/home/user/isopix/tools/cloud_setup.sh; [ -f "$f" ] && bash "$f" || true
#   - .claude/hooks/session-start.sh, every session: git settings live in each
#     fresh clone, and flarepress may only be attached once the session runs.
#
# What it does: installs just and wrangler (pinned), runs `just setup` (the
# pre-commit hook and the PDXfixIT author), finds or clones flarepress and
# points its isopix.app/public at this checkout's web/, and says whether the
# Cloudflare token and the hosts a deploy needs are reachable. Chrome needs
# nothing: tools/chrome.mjs finds the cloud's Playwright Chromium.
set -uo pipefail
ROOT=$(cd "$(dirname "$0")/.." && pwd)
JUST_VERSION=1.58.0
WRANGLER_VERSION=4.151.0
say() { echo "☁️  $*"; }

# just (stdlib-only Python wheel; pip reaches PyPI on the default network level)
if ! command -v just >/dev/null || [ "$(just --version 2>/dev/null)" != "just $JUST_VERSION" ]; then
  pip install -q "rust-just==$JUST_VERSION" >/dev/null 2>&1 && say "just $JUST_VERSION installed" || say "⚠️ could not install just"
fi

# wrangler (flarepress runs `npx wrangler`, which uses this one when installed)
if [ "$(wrangler --version 2>/dev/null | grep -o '[0-9.]*' | head -1)" != "$WRANGLER_VERSION" ]; then
  npm install -g -s "wrangler@$WRANGLER_VERSION" >/dev/null 2>&1 && say "wrangler $WRANGLER_VERSION installed" || say "⚠️ could not install wrangler"
fi

# This clone: the pre-commit hook and the commit author.
if [ -d "$ROOT/.git" ] && command -v just >/dev/null; then
  (cd "$ROOT" && just setup >/dev/null 2>&1) && say "git: pre-commit hook on, commits authored as PDXfixIT"
fi

# flarepress: next to this checkout (a session that attached it), else ~/src/flarepress.
FP="${FLAREPRESS:-}"
for d in "$FP" "$(dirname "$ROOT")/flarepress" "$HOME/src/flarepress"; do
  [ -n "$d" ] && [ -f "$d/Justfile" ] && { FP=$d; break; }
done
if [ -z "$FP" ] || [ ! -f "$FP/Justfile" ]; then
  FP="$(dirname "$ROOT")/flarepress"
  git clone -q https://github.com/pdxfixit/flarepress "$FP" 2>/dev/null \
    && say "flarepress cloned to $FP" \
    || say "⚠️ no flarepress: attach pdxfixit/flarepress to the session (add_repo), then run tools/cloud_setup.sh again"
fi
if [ -f "$FP/Justfile" ]; then
  # Its public link points at the owner's Mac; here it must point at this checkout.
  if [ -L "$FP/isopix.app/public" ] && [ "$(readlink "$FP/isopix.app/public")" != "$ROOT/web" ]; then
    ln -sfn "$ROOT/web" "$FP/isopix.app/public"
    git -C "$FP" update-index --skip-worktree isopix.app/public 2>/dev/null
    say "flarepress isopix.app/public -> $ROOT/web (kept out of flarepress's git status)"
  fi
  # deploy.just reads FLAREPRESS; a SessionStart hook can hand it to the session.
  [ -n "${CLAUDE_ENV_FILE:-}" ] && echo "export FLAREPRESS=$FP" >> "$CLAUDE_ENV_FILE"
  [ "$FP" = "$HOME/src/flarepress" ] || { mkdir -p "$HOME/src" && ln -sfn "$FP" "$HOME/src/flarepress" 2>/dev/null; }
fi

# What a deploy needs from outside: the token, and the hosts.
[ -n "${CLOUDFLARE_API_TOKEN:-}" ] && say "CLOUDFLARE_API_TOKEN is set" || say "⚠️ CLOUDFLARE_API_TOKEN is not set: deploys need it (cloud environment settings)"
for h in api.cloudflare.com isopix.app isopix.pdxfixit.com; do
  code=$(curl -s -o /dev/null -w '%{http_code}' -m 8 "https://$h/" 2>/dev/null || true)
  [ "$code" != "000" ] && say "reaches $h" || say "⚠️ cannot reach $h: add it to the environment's Allowed domains"
done
exit 0
