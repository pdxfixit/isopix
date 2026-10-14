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


def main():
    args = sys.argv[1:]
    if "--check" in args:
        return check()
    text = FILE.read_text()
    m = stamp_of(text)
    old = m.group(1)
    if "--show" in args:
        print(old)
        return
    part = args[0] if args else "patch"
    if part not in ("patch", "minor", "major"):
        sys.exit(f"❌ unknown part {part!r}: patch, minor or major")
    new = bumped(old, part, commits())
    FILE.write_text(text.replace(m.group(0), f"self.ISOPIX_VERSION = '{new}';"))
    print(f"🏷️  {old} -> {new}  (web/version.js; commit it with the release)")


if __name__ == "__main__":
    main()
