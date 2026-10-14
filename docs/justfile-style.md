# Justfile house style

Every workflow in this repo is a `just` recipe, written in the owner's Justfile house
style. The full style guide is in the owner's own scripts repo, which a fresh session
cannot read; these are the rules a recipe author here needs. `justfile` and
`deploy.just` follow them, so copy their patterns.

1. **`set shell := ["bash", "-uc"]`** at the top of the root `justfile`, so
   recipes can use real bash. An imported file (`deploy.just`) inherits it and
   must not set it again.
2. **The first recipe is a private `default` that runs `just --list`**, so a
   bare `just` prints the menu.
3. **Every recipe has a `#` doc comment directly above it, with no blank line
   between.** That line is what `just --list` shows. Context lines can come
   first; the one-line summary is the last comment line.
4. **The doc line starts with one emoji that says what the recipe does,** and a
   meaning stays the same once used: 🔎 verify or check, 📋 status or listing,
   🧪 tests or a dry run, 🚀 publish, ⏪ roll back, 🐢 speed, 🏷️ a version
   stamp, ✅ good, ⚠️ needs attention.
5. **Recipe names are verbs or short nouns the owner would say out loud** (`test`,
   `look`, `deploy`, `live`, `rollback`), in kebab-case.
6. **The justfile is the menu, not the tool.** A recipe longer than a couple of
   lines calls a script in `tools/` (`tools/deploy.sh`, `tools/look.mjs`). An
   inline multi-line recipe starts with `#!/usr/bin/env bash` and
   `set -euo pipefail` so it runs as one script.
7. **At most one required positional argument (the subject); everything else
   is flags passed straight through** to the tool's own parser
   (`look *args`, `deploy-verify *flags`). The tool owns defaults and `--help`.
8. **Forward arguments with `[positional-arguments]` and `"$@"`, not
   `{{args}}`,** when a value can contain spaces: `{{…}}` is plain text
   substitution and loses quoting. `{{…}}` also expands inside comments in a
   recipe body, so describe a variable in words there.
9. **Anything that changes the outside world needs a confirm:** a
   `[confirm("…")]` attribute, so it runs only as `just --yes <recipe>` and
   stops when there is no terminal (`deploy`, `ship`).
10. **Fail early and specifically.** Check inputs in the recipe or script
    before doing anything slow or remote, and print one line naming what is
    wrong and how to fix it (🛑 for a stop).

A recipe named in `AGENTS.md` or any `docs/*.md` must exist: `test/docs.test.mjs`
fails otherwise.
