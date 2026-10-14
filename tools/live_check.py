#!/usr/bin/env python3
"""The live site against this checkout: CI's daily live.yml, or `just live-check`.

Two rules (owner, 2026-10-12: fewer failure emails, but never miss a real outage):

- Down or broken is never excused. `/`, the manifest and `sw.js` must answer
  200; a miss is retried 3 times, 20 s apart, to ride out a blip or the edge's
  propagation lag, then fails.
- Behind main gets one hour. When the live web/version.js differs from main's,
  a deploy may be in flight: if main's web/version.js last changed under 60
  minutes ago this passes with a notice; older than that it fails, naming both
  versions and the age.

Stdlib only (Python 3.8+). The decision is pure (`decide`); the network and the
clock come in as arguments, so tools/test_live_check.py drives every case.

    python3 tools/live_check.py [URL]        (default https://isopix.pdxfixit.com)
"""
import os
import random
import re
import subprocess
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
PAGES = ["/", "/manifest.webmanifest", "/sw.js"]
GRACE_S = 60 * 60
TRIES = 3
WAIT_S = 20
VERSION_RE = re.compile(r"ISOPIX_VERSION = '([^']+)'")


def stamp(text):
    """The release stamp in a version.js text, or None."""
    m = VERSION_RE.search(text or "")
    return m.group(1) if m else None


def check_pages(fetch, sleep, pages=PAGES, tries=TRIES, wait=WAIT_S):
    """{page: final status}. fetch(path) -> (status, text); retries non-200s."""
    out = {}
    for attempt in range(tries + 1):
        todo = [p for p in pages if out.get(p) != 200]
        if not todo:
            break
        if attempt:
            sleep(wait)
        for p in todo:
            out[p] = fetch(p)[0]
    return out


def decide(statuses, live_stamp, main_stamp, main_age_s, grace_s=GRACE_S):
    """-> (ok, lines, notice). Pure: every input is given."""
    lines, ok, notice = [], True, None
    for page, code in statuses.items():
        if code == 200:
            lines.append(f"✅ {page} 200")
        else:
            lines.append(f"❌ {page} answered {code} after {TRIES} retries: the site is down or broken")
            ok = False
    if live_stamp == main_stamp:
        lines.append(f"✅ live version.js matches main ({main_stamp})")
    else:
        mins = int(main_age_s // 60)
        if main_age_s < grace_s:
            notice = f"deploy in flight, live is behind main by {mins} min (live {live_stamp}, main {main_stamp})"
            lines.append(f"⏳ {notice}")
        else:
            lines.append(f"❌ live version.js is {live_stamp} but main is {main_stamp}, bumped {mins} min ago: "
                         "main moved on without a deploy, or the deploy did not land")
            ok = False
    return ok, lines, notice


def main():
    url = (sys.argv[1] if len(sys.argv) > 1 else "https://isopix.pdxfixit.com").rstrip("/")

    def fetch(path):
        req = urllib.request.Request(f"{url}{path}?ci={random.randrange(1 << 30)}", headers={"User-Agent": "isopix-live-check"})
        try:
            with urllib.request.urlopen(req, timeout=20) as r:
                return r.status, r.read().decode("utf-8", "replace")
        except urllib.error.HTTPError as e:
            return e.code, ""
        except Exception:
            return 0, ""

    statuses = check_pages(fetch, time.sleep)
    live_stamp = stamp(fetch("/version.js")[1])
    main_stamp = stamp((ROOT / "web" / "version.js").read_text())
    ct = subprocess.run(["git", "log", "-1", "--format=%ct", "--", "web/version.js"], cwd=ROOT, capture_output=True, text=True).stdout.strip()
    age = time.time() - int(ct) if ct else float("inf")
    ok, lines, notice = decide(statuses, live_stamp, main_stamp, age)
    print("\n".join(lines))
    if os.environ.get("GITHUB_ACTIONS") and notice:
        print(f"::notice::{notice}")
    if os.environ.get("GITHUB_ACTIONS") and not ok:
        print(f"::error::{[l for l in lines if l.startswith('❌')][0]}")
    sys.exit(0 if ok else 1)


if __name__ == "__main__":
    main()
