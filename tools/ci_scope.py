#!/usr/bin/env python3
"""Does this CI run need the browser checks: test.yml's first step.

A push or pull request that changes only docs (every file under docs/ or ending
in .md) skips export-check, move-check, install-check, autosave-check and the
look passes; `just test` (which holds the docs-drift check) and the version
checks always run (owner, 2026-10-20: "agreed"). Anything unsure runs
everything: a new branch (BASE all zeros), a BASE this clone does not have, a
diff that fails or is empty, and any file under web/, worker/ or site/, which
deploy.yml ships whatever its name.

Stdlib only (Python 3.8+). The decision is pure (`decide`); git comes in as an
argument, so tools/test_ci_scope.py drives every case.

    python3 tools/ci_scope.py BASE [HEAD]     (HEAD defaults to HEAD)

Prints `browser=true` or `browser=false` and why, and appends the first to
$GITHUB_OUTPUT when it is set.
"""
import os
import subprocess
import sys

ZERO = "0" * 40
SHIPPED = ("web/", "worker/", "site/")


def is_doc(path):
    if path.startswith(SHIPPED):
        return False
    return path.startswith("docs/") or path.lower().endswith(".md")


def decide(base, head, git):
    """(browser checks needed?, why). git(args) -> stdout, or None on failure."""
    base = (base or "").strip()
    if not base or base == ZERO:
        return True, "no earlier commit to compare with (a new branch): running every check"
    if git(["cat-file", "-e", base + "^{commit}"]) is None:
        return True, "commit %s is not in this clone: running every check" % base[:7]
    out = git(["diff", "--name-only", "--no-renames", "-z", base, head])
    if out is None:
        return True, "git diff %s %s failed: running every check" % (base[:7], head)
    paths = [p for p in out.split("\0") if p]
    if not paths:
        return True, "no files changed since %s: running every check" % base[:7]
    code = [p for p in paths if not is_doc(p)]
    if code:
        more = " and %d more" % (len(code) - 1) if len(code) > 1 else ""
        return True, "%s%s changed: running every check" % (code[0], more)
    return False, "only docs changed (%d file%s): skipping the browser checks" % (len(paths), "" if len(paths) == 1 else "s")


def run_git(args):
    r = subprocess.run(["git"] + args, stdout=subprocess.PIPE, stderr=subprocess.DEVNULL, universal_newlines=True)
    return r.stdout if r.returncode == 0 else None


def main(argv):
    if not 1 <= len(argv) <= 2:
        print("usage: python3 tools/ci_scope.py BASE [HEAD]", file=sys.stderr)
        return 2
    browser, why = decide(argv[0], argv[1] if len(argv) > 1 else "HEAD", run_git)
    line = "browser=%s" % ("true" if browser else "false")
    print("%s  (%s)" % (line, why))
    if os.environ.get("GITHUB_OUTPUT"):
        with open(os.environ["GITHUB_OUTPUT"], "a") as f:
            f.write(line + "\n")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
