#!/usr/bin/env bash
# `just archive-agent <branch or agent id>`: tidy up after a finished agent.
# Tags the branch tip archive/<branch>, removes its worktree, deletes the branch.
# Refuses a worktree with uncommitted work, and a commit that is not on main
# (matched by patch, then by subject, since `just land` cherry-picks and a
# resolved conflict changes the patch). Run it only once the agent's report has
# arrived: a live agent's worktree looks almost empty and cannot be told apart.
set -euo pipefail
id=${1:?usage: archive_agent.sh <branch or agent id>}
cd "$(git rev-parse --show-toplevel)"

b=$id
git rev-parse -q --verify "refs/heads/$b" > /dev/null || b="worktree-agent-$id"
git rev-parse -q --verify "refs/heads/$b" > /dev/null || { echo "🛑 no branch $id (or worktree-agent-$id)" >&2; exit 1; }
[ "$b" != main ] || { echo "🛑 not main" >&2; exit 1; }

main=main
git rev-parse -q --verify refs/heads/main > /dev/null || main=origin/main
git rev-parse -q --verify "$main" > /dev/null || { echo "🛑 no main to compare with (git fetch origin main)" >&2; exit 1; }

# The branch's worktree, if it has one.
w=$(git worktree list --porcelain | awk -v ref="refs/heads/$b" '/^worktree /{p=substr($0,10)} $1=="branch" && $2==ref {print p}')
if [ -n "$w" ] && [ -n "$(git -C "$w" status --porcelain)" ]; then
  echo "🛑 $w has uncommitted work; nothing removed" >&2; exit 1
fi

missing=$(git cherry "$main" "$b" | grep '^+' || true)
for c in $(echo "$missing" | cut -c3-); do
  subj=$(git log -1 --format=%s "$c")
  # Not grep -q: it exits early, git log dies of SIGPIPE, and pipefail calls the match a failure.
  git log "$main" --format=%s | grep -cxF "$subj" > /dev/null || { echo "🛑 $c ($subj) is not on $main; land it first" >&2; exit 1; }
done

# Tagged already (a cleanup that stopped halfway): fine if it is this tip.
if git rev-parse -q --verify "refs/tags/archive/$b" > /dev/null; then
  [ "$(git rev-parse "archive/$b^{commit}")" = "$(git rev-parse "$b")" ] || { echo "🛑 archive/$b exists at another commit; nothing removed" >&2; exit 1; }
else
  git tag -m "Archived branch $b (work landed on main)" "archive/$b" "$(git rev-parse "$b")"
fi
if [ -n "$w" ] && [ "$w" != "$(git rev-parse --show-toplevel)" ]; then
  git worktree unlock "$w" 2> /dev/null || true   # the agent tool locks its worktree
  git worktree remove "$w"
fi
git branch -D "$b" > /dev/null
echo "✅ archived $b as archive/$b"
