#!/usr/bin/env python3
"""Serve web/ on every interface so a phone on the same Wi-Fi can open it.

Stdlib only (Python 3.8+). Sends no-store so an edited file shows on the next
reload. Also sends the headers web/_headers gives each path (the CSP, and
CORS for move.js), so a page that would break on the live site breaks here first. A dev copy has no
web/version.json (the deploy writes it), so /version.json answers "dev"
instead of a 404 that the console would print in red.

    python3 tools/serve.py [port]      (default 8790)
"""
import functools
import os
import http.server
import socket
import sys
from pathlib import Path

WEB = Path(__file__).resolve().parent.parent / "web"


def site_headers(path="/"):
    """The web/_headers rules that match this path, as Cloudflare applies them:
    `/*` for every path, an exact path, or a prefix ending in `*`. Cache-Control
    is left to the dev server (no-store)."""
    found, applies = {}, False
    try:
        lines = (WEB / "_headers").read_text().splitlines()
    except OSError:
        return found
    for line in lines:
        if not line.strip() or line.lstrip().startswith("#"):
            continue
        if not line[0].isspace():
            rule = line.strip()
            applies = rule == path or (rule.endswith("*") and path.startswith(rule[:-1]))
        elif applies and ":" in line:
            name, value = line.split(":", 1)
            if name.strip().lower() != "cache-control":
                found[name.strip()] = value.strip()
    return found


class Handler(http.server.SimpleHTTPRequestHandler):
    extensions_map = {**http.server.SimpleHTTPRequestHandler.extensions_map,
                      ".js": "text/javascript", ".mjs": "text/javascript",
                      ".webmanifest": "application/manifest+json", ".svg": "image/svg+xml"}

    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        for name, value in site_headers(self.path.split("?")[0]).items():
            self.send_header(name, value)
        super().end_headers()

    def do_GET(self):
        # `just look update` plays the deploy: it points ISOPIX_LIVE_VERSION at a
        # file and changes it between page load and check.
        live = os.environ.get("ISOPIX_LIVE_VERSION")
        if self.path.split("?")[0] == "/version.json" and live:
            body = Path(live).read_bytes()
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)
            return
        if self.path.split("?")[0] == "/version.json" and not (WEB / "version.json").exists():
            body = b'{"version":"dev"}'
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)
            return
        super().do_GET()

    def log_message(self, fmt, *args):
        if "--quiet" not in sys.argv:
            super().log_message(fmt, *args)


def lan_ip():
    try:
        with socket.socket(socket.AF_INET, socket.SOCK_DGRAM) as s:
            s.connect(("10.255.255.255", 1))
            return s.getsockname()[0]
    except OSError:
        return None


def main():
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    port = int(args[0]) if args else 8790
    handler = functools.partial(Handler, directory=str(WEB))
    server = http.server.ThreadingHTTPServer(("0.0.0.0", port), handler)
    print(f"🧊 Isopix on http://localhost:{port}/")
    ip = lan_ip()
    if ip:
        print(f"📱 Same Wi-Fi: http://{ip}:{port}/  (installing and offline need https or localhost)")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass


if __name__ == "__main__":
    main()
