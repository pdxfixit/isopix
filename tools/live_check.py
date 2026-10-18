#!/usr/bin/env python3
"""Is the live site up and working: CI's daily live.yml, or `just live-check`.

One rule (owner, 2026-10-12: fewer failure emails, but never miss a real outage):
down or broken is never excused. `/`, the manifest and `sw.js` must answer 200;
a miss is retried 3 times, 20 s apart, to ride out a blip or the edge's
propagation lag, then fails. Which version is live is not checked: deploy.yml
deploys every push to main, and a failed deploy is its own red run (owner,
2026-10-18).

Stdlib only (Python 3.8+). The decision is pure (`decide`); the network and the
sleep come in as arguments, so tools/test_live_check.py drives every case.

    python3 tools/live_check.py [URL]        (default https://isopix.app)
"""
import os
import random
import sys
import time
import urllib.error
import urllib.request

PAGES = ["/", "/manifest.webmanifest", "/sw.js"]
TRIES = 3
WAIT_S = 20


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


def decide(statuses):
    """-> (ok, lines). Pure: every input is given."""
    lines, ok = [], True
    for page, code in statuses.items():
        if code == 200:
            lines.append(f"✅ {page} 200")
        else:
            lines.append(f"❌ {page} answered {code} after {TRIES} retries: the site is down or broken")
            ok = False
    return ok, lines


def main():
    url = (sys.argv[1] if len(sys.argv) > 1 else "https://isopix.app").rstrip("/")

    def fetch(path):
        req = urllib.request.Request(f"{url}{path}?ci={random.randrange(1 << 30)}", headers={"User-Agent": "isopix-live-check"})
        try:
            with urllib.request.urlopen(req, timeout=20) as r:
                return r.status, r.read().decode("utf-8", "replace")
        except urllib.error.HTTPError as e:
            return e.code, ""
        except Exception:
            return 0, ""

    ok, lines = decide(check_pages(fetch, time.sleep))
    print("\n".join(lines))
    if os.environ.get("GITHUB_ACTIONS") and not ok:
        print(f"::error::{[l for l in lines if l.startswith('❌')][0]}")
    sys.exit(0 if ok else 1)


if __name__ == "__main__":
    main()
