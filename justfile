# Isopix: draw on an isometric grid. `just` lists the recipes.
# The site is web/ (static files, no build step). Everything else here is tooling.

set shell := ["bash", "-uc"]

[private]
default:
    @just --list --unsorted

# 🧊 Serve web/ on this Mac and the LAN (the owner's port is 8790; agents preview on 8791)
serve port="8790":
    python3 tools/serve.py {{port}}

# 🧰 Once per clone: the git hooks (pre-commit runs just test; pre-push checks the version stamp) and the PDXfixIT author
setup:
    git config core.hooksPath .githooks
    git config user.name PDXfixIT
    git config user.email 1262042+pdxfixit@users.noreply.github.com
    @echo "✅ commits run just test first, and are authored as PDXfixIT"

# (node --check takes one file at a time: given several, it checks only the first)
# 🧪 Syntax-check every module, then run the engine tests (Node's built-in runner; nothing to install)
test:
    @for f in web/*.js web/engine/*.js web/ui/*.js worker/*.js tools/*.mjs test/*.mjs; do node --check "$f" || exit 1; done
    @python3 -m py_compile tools/serve.py tools/bump_version.py tools/live_check.py
    @for f in tools/*.sh .githooks/*; do bash -n "$f" || exit 1; done
    node --test test/*.test.mjs
    python3 -m unittest discover -s tools -p 'test_*.py'

#   just ci-wait              main on GitHub
#   just ci-wait 9f639a4      one commit (a short SHA is fine)
# 🔎 Wait for GitHub Actions on a commit and say how each run ended (test, and deploy when it deployed); fails if one failed
[positional-arguments]
ci-wait *args:
    @bash tools/ci_wait.sh "$@"

# Lands through flarepress's shared tool (tools/land.sh in the flarepress checkout beside this one,
# else $FLAREPRESS, else a clone in ~/.cache); land.conf here says what it runs.
# 🛬 Land commits on main: pull main from GitHub, cherry-pick, restamp web/version.js, test, push (GitHub deploys): just land [--wait] [<sha>…]; no sha: this branch's
[positional-arguments]
land *args:
    #!/usr/bin/env bash
    set -euo pipefail
    fp=${FLAREPRESS:-$(cd "$(git rev-parse --git-common-dir)/../.." && pwd)/flarepress}
    [ -e "$fp/tools/land.sh" ] || fp=${XDG_CACHE_HOME:-$HOME/.cache}/flarepress
    [ -e "$fp/tools/land.sh" ] || git clone -q https://github.com/pdxfixit/flarepress "$fp"
    exec bash "$fp/tools/land.sh" "$@"

# 🛬 Finish a landing that stopped on a conflict, once it is resolved in its worktree: just land-continue <worktree>
land-continue worktree:
    @just land --continue {{worktree}}

#   just look                     the drawing screen at 320, 375, 700, 900 and 1100 px
#   just look drawn select selmore rail settings drawing-sheet brushes   several views (just look --help lists them all)
#   just look --all --light       every view, as CI runs it
#   just look --widths 375 --js 'document.querySelector("#lock").click()'    runs JS first
#   just look --height 400        a short landscape phone
#   just look --light             light mode (--dark for dark; default follows this Mac)
# 📱 Width check in a private headless Chrome: sideways scroll, console errors, CSP blocks, controls under 44 px, overlaps; saves screenshots
[positional-arguments]
look *args:
    @node tools/look.mjs "$@"

#   just version          1.0.41 -> 1.0.43: PATCH is always the commit count after this release's commit
#   just version minor    1.1.43 (major: 2.0.43)
# 🏷️ Bump the semver release stamp in web/version.js, so installed copies update after the next deploy
[positional-arguments]
version *args:
    @python3 tools/bump_version.py "$@"

#   just install-check --url https://isopix.app    the live site
# 🔎 Installable as an app: Chrome's own check (Android, Windows, Mac), and the iPhone and iPad home-screen tags
[positional-arguments]
install-check *args:
    @node tools/install_check.mjs "$@"

# 🔎 Autosave copies, end to end in headless Chrome: a copy is taken, and a damaged autosave opens it (web/autosave.js)
autosave-check:
    @node tools/autosave_check.mjs

# 🚚 Moving house to isopix.app, end to end in headless Chrome: the old addresses carry a drawing over (web/move.js)
move-check:
    @node tools/move_check.mjs

# 🖼️ Output round trip in headless Chrome: PNG pixels, SVG merge, project save/load/undo (--out DIR keeps the files)
[positional-arguments]
export-check *args:
    @node tools/export_check.mjs "$@"

#   just prove test/density.test.mjs web/engine/density.js
#   PROVE_BASE=main proves a change already committed on a branch (default HEAD)
# 🔎 Prove a test needs your change: runs it against the committed copy of each file (a new file: without it), then puts yours back
prove test +files:
    #!/usr/bin/env bash
    set -euo pipefail
    keep=$(mktemp -d)
    files=({{files}})
    for f in "${files[@]}"; do mkdir -p "$keep/$(dirname "$f")"; cp "$f" "$keep/$f"; done
    trap 'for f in "${files[@]}"; do cp "$keep/$f" "$f"; done; rm -rf "$keep"' EXIT
    base="${PROVE_BASE:-HEAD}"
    for f in "${files[@]}"; do
      if git cat-file -e "$base:$f" 2>/dev/null; then git show "$base:$f" > "$f"; else rm "$f"; fi
    done
    if node --test {{test}} > "$keep/out" 2>&1; then
      echo "❌ {{test}} passes without your change to {{files}}" >&2
      exit 1
    fi
    grep -E '^not ok|^✖' "$keep/out" | head -5 || true
    echo "✅ {{test}} fails without your change to {{files}}"

# 🐢 Frame times (median / p95 ms) on 38,400 cells in headless Chrome: pan, zoom, draw (--dpr 1, --cells N)
[positional-arguments]
perf *args:
    @node tools/perf.mjs "$@"

# 🔎 Is the live site up: /, the manifest and sw.js answer 200 (3 retries, 20 s apart; CI runs it daily)
live-check *args:
    @python3 tools/live_check.py {{args}}

# 🎨 Redraw the app icons in web/icons/ (192, 512 and SVG)
icons:
    node tools/make_icons.mjs

# 🎨 Rebuild the starter stamps (web/stamps.js) from their art, then their sheets from every side
stamps:
    node tools/make_stamps.mjs
    node tools/stamp_sheets.mjs

# 🔎 Check a stamp handed in under docs/stamp-art-contract.md: ACCEPT, or REJECT lines to send back; draws it from every side: just stamp-check <file.json> [--replace]
[positional-arguments]
stamp-check *args:
    @node tools/stamp_check.mjs "$@"

# 🎨 Redraw every starter stamp from every side into docs/stamps/ (one SVG each and an index): just stamp-sheets [--only ID]
[positional-arguments]
stamp-sheets *args:
    @node tools/stamp_sheets.mjs "$@"

import? 'deploy.just'
