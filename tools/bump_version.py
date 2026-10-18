#!/usr/bin/env python3
"""Bump the release stamp in web/version.js (`just version`).

The stamp is semver, MAJOR.MINOR.PATCH, and PATCH is the number of commits in
the tree once the release is committed: `git rev-list --count HEAD` + 1, since
the bump goes in the same commit as the change. It only ever goes up. The
service worker imports version.js, so a new stamp gives it a new cache name:
installed copies fetch fresh files and drop the old cache after the deploy.

    python3 tools/bump_version.py           bump PATCH and print old -> new
    python3 tools/bump_version.py minor     MINOR + 1 (major: MAJOR + 1, MINOR 0)
    python3 tools/bump_version.py --show    print the current stamp only
    python3 tools/bump_version.py --check   exit 1 unless the stamp's PATCH is
                                            the commit count of the commit that
                                            set it (CI; needs full history)
    python3 tools/bump_version.py --staged  the same for the commit being made, when
                                            web/version.js is staged (the
                                            pre-commit hook)
    python3 tools/bump_version.py --restamp when HEAD set web/version.js, make its
                                            PATCH HEAD's own commit count (just
                                            land runs it after each pick: a
                                            landing on a newer main moves the count)
"""
import re
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
FILE = ROOT / "web" / "version.js"
PATTERN = re.compile(r"self\.ISOPIX_VERSION = '([^']+)';")
SEMVER = re.compile(r"^(\d+)\.(\d+)\.(\d+)$")


def git(*args):
    return subprocess.run(["git", "-C", str(ROOT), *args], capture_output=True, text=True, check=True).stdout.strip()


def commits(rev="HEAD"):
    """Commits in the tree at rev; 0 before the first commit."""
    try:
        return int(git("rev-list", "--count", rev))
    except subprocess.CalledProcessError:
        return 0


def bumped(old, part, count):
    """The next stamp after old. Pure. A stamp that is not semver starts at 1.0."""
    m = SEMVER.match(old)
    major, minor = (int(m.group(1)), int(m.group(2))) if m else (1, 0)
    if part == "major":
        major, minor = major + 1, 0
    elif part == "minor":
        minor += 1
    return f"{major}.{minor}.{count + 1}"


def goes_down(old, new):
    """Why new is below old, or None. Pure. A stamp only ever goes up:
    a lower PATCH means the commit count is wrong (a shallow clone counts
    only the commits it fetched)."""
    a, b = SEMVER.match(old), SEMVER.match(new)
    if not a or not b:
        return None
    if tuple(map(int, b.groups())) >= tuple(map(int, a.groups())):  # equal: bumped twice before committing
        return None
    return (f"{new} is below {old}: the commit count looks wrong. "
            f"In a shallow clone run 'git fetch --unshallow' first.")


def shallow():
    return git("rev-parse", "--is-shallow-repository") == "true"


def stamp_of(text):
    m = PATTERN.search(text)
    if not m:
        sys.exit(f"❌ no ISOPIX_VERSION line in {FILE}")
    return m


def check():
    last = git("log", "-1", "--format=%H", "--", "web/version.js")
    if not last:
        sys.exit("🛑 web/version.js has never been committed")
    stamp = stamp_of(git("show", f"{last}:web/version.js")).group(1)
    m = SEMVER.match(stamp)
    want = commits(last)
    if not m or int(m.group(3)) != want:
        sys.exit(f"🛑 web/version.js says {stamp}, but its commit {last[:7]} is commit {want}: "
                 f"PATCH must be {want}. Run 'just version' before committing a release.")
    print(f"✅ web/version.js {stamp}: PATCH is the commit count ({want})")


def restamped(stamp, count):
    """The stamp with PATCH set to count, or None when it already is (or is not semver). Pure."""
    m = SEMVER.match(stamp)
    if not m or int(m.group(3)) == count:
        return None
    return f"{m.group(1)}.{m.group(2)}.{count}"


def restamp():
    if "web/version.js" not in git("diff-tree", "--no-commit-id", "--name-only", "-r", "HEAD").split("\n"):
        return  # this commit is not a release
    if shallow():
        sys.exit("🛑 this clone is shallow, so the commit count is wrong: run 'git fetch --unshallow'")
    text = FILE.read_text()
    m = stamp_of(text)
    new = restamped(m.group(1), commits())
    if new:
        FILE.write_text(text.replace(m.group(0), f"self.ISOPIX_VERSION = '{new}';"))
        print(f"🏷️  {m.group(1)} -> {new}  (web/version.js: this commit is commit {commits()} on main)")


def staged_problem(stamp, head_count, parents=()):
    """Why a staged stamp is wrong for the next commit, or None. Pure.
    head_count: commits behind the one being made (for a merge, both sides).
    parents: a merge's parent stamps; keeping one of them is fine, since the
    commit that set it already carries its number."""
    if stamp in parents:
        return None
    m = SEMVER.match(stamp)
    want = head_count + 1
    if m and int(m.group(3)) == want:
        return None
    return (f"web/version.js says {stamp}, but this commit will be commit {want}: PATCH must be {want}. "
            f"Another commit landed since 'just version'; run it again and stage web/version.js.")


def staged():
    if subprocess.run(["git", "-C", str(ROOT), "diff", "--cached", "--quiet", "--", "web/version.js"]).returncode == 0:
        return  # version.js is not in this commit
    stamp = stamp_of(git("show", ":web/version.js")).group(1)
    merging = subprocess.run(["git", "-C", str(ROOT), "rev-parse", "-q", "--verify", "MERGE_HEAD"], capture_output=True).returncode == 0
    if merging:
        parents = tuple(stamp_of(git("show", f"{r}:web/version.js")).group(1) for r in ("HEAD", "MERGE_HEAD"))
        problem = staged_problem(stamp, int(git("rev-list", "--count", "HEAD", "MERGE_HEAD")), parents)
    else:
        if shallow():
            sys.exit("🛑 this clone is shallow, so the commit count is wrong: run 'git fetch --unshallow', then 'just version'")
        problem = staged_problem(stamp, commits())
    if problem:
        sys.exit(f"🛑 {problem}")


def main():
    args = sys.argv[1:]
    if "--check" in args:
        return check()
    if "--staged" in args:
        return staged()
    if "--restamp" in args:
        return restamp()
    text = FILE.read_text()
    m = stamp_of(text)
    old = m.group(1)
    if "--show" in args:
        print(old)
        return
    part = args[0] if args else "patch"
    if part not in ("patch", "minor", "major"):
        sys.exit(f"❌ unknown part {part!r}: patch, minor or major")
    if shallow():
        sys.exit("🛑 this clone is shallow, so its commit count is wrong: run 'git fetch --unshallow', then 'just version'")
    new = bumped(old, part, commits())
    problem = goes_down(old, new)
    if problem:
        sys.exit(f"🛑 {problem}")
    FILE.write_text(text.replace(m.group(0), f"self.ISOPIX_VERSION = '{new}';"))
    print(f"🏷️  {old} -> {new}  (web/version.js; commit it with the release)")


if __name__ == "__main__":
    main()
