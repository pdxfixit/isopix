# Isopix: draw on an isometric grid. `just` lists the recipes.
# The site is web/ (static files, no build step). Everything else here is tooling.

set shell := ["bash", "-uc"]

[private]
default:
    @just --list --unsorted

# 🧊 Serve web/ on this Mac and the LAN (the owner's port is 8790; agents preview on 8791)
serve port="8790":
    python3 tools/serve.py {{port}}

# 🧰 Once per clone: the pre-commit hook (runs just test) and the PDXfixIT author
setup:
    git config core.hooksPath .githooks
    git config user.name PDXfixIT
    git config user.email 1262042+pdxfixit@users.noreply.github.com
    @echo "✅ commits run just test first, and are authored as PDXfixIT"

# (node --check takes one file at a time: given several, it checks only the first)
# 🧪 Syntax-check every module, then run the engine tests (Node's built-in runner; nothing to install)
test:
    @for f in web/*.js web/engine/*.js tools/*.mjs test/*.mjs; do node --check "$f" || exit 1; done
    @python3 -m py_compile tools/serve.py tools/bump_version.py tools/live_check.py
    @for f in tools/*.sh .githooks/*; do bash -n "$f" || exit 1; done
    node --test test/*.test.mjs
    python3 -m unittest discover -s tools -p 'test_*.py'

#   just look                     the drawing screen at 320, 375, 700, 900 and 1100 px
#   just look drawn select selmore rail settings drawing-sheet brushes   several views (just look --help lists them all)
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

# 🔎 The live site against this checkout: 200s (3 retries) and main's web/version.js, with an hour's grace for a deploy in flight (CI runs it daily)
live-check *args:
    @python3 tools/live_check.py {{args}}

# 🎨 Redraw the app icons in web/icons/ (192, 512 and SVG)
icons:
    node tools/make_icons.mjs

import? 'deploy.just'
