#!/usr/bin/env python3
"""Render an Isopix drawing as SVG (Isopix file format 1.0, spec/README.md).

  python3 render-svg.py drawing.isopix.json > drawing.svg
  python3 render-svg.py drawing.isopix.png  > drawing.svg     (also .isopix)

Python 3, standard library only. Public domain (CC0): copy it anywhere.
"""
import gzip
import json
import math
import struct
import sys
import zlib

PAPER = {"light": "#f7f5f0", "dark": "#1f2228"}
DIRS = [(1, 0), (0, 1), (-1, 1)]  # edge directions d = 0, 1, 2


def read(path):
    """The drawing's JSON from any container: .isopix.png, .isopix (gzip) or .isopix.json."""
    with open(path, "rb") as f:
        data = f.read()
    if data[:2] == b"\x1f\x8b":
        data = gzip.decompress(data)
    if data[:8] == b"\x89PNG\r\n\x1a\n":
        data = png_text(data)
    doc = json.loads(data)
    if not isinstance(doc, dict) or doc.get("format") != "isopix" or doc.get("version") != 1:
        sys.exit("not an Isopix 1.0 drawing")
    return doc


def png_text(png):
    """The text of the PNG's iTXt chunk with the keyword "isopix"."""
    i = 8
    while i + 8 <= len(png):
        n, kind = struct.unpack(">I4s", png[i:i + 8])
        body = png[i + 8:i + 8 + n]
        i += 12 + n
        if kind != b"iTXt":
            continue
        key, rest = body.split(b"\0", 1)
        if key != b"isopix":
            continue
        packed, rest = rest[0], rest[2:]  # compression flag, then method
        _language, rest = rest.split(b"\0", 1)
        _translated, text = rest.split(b"\0", 1)
        return zlib.decompress(text) if packed else text
    sys.exit("this PNG has no Isopix drawing inside")


def point(l, p, q):
    """Grid point (p, q) at level l, in world units (y down)."""
    s = 2.0 ** -l
    return (q * math.sqrt(3) / 2 * s, (p + q / 2) * s)


def corners(key):
    l, p, q, u = (int(n) for n in key.split(","))
    pts = [(p, q), (p + 1, q), (p, q + 1)] if u else [(p + 1, q), (p, q + 1), (p + 1, q + 1)]
    return l, [point(l, a, b) for a, b in pts]


def ends(key):
    l, p, q, d = (int(n) for n in key.split(","))
    dp, dq = DIRS[d]
    return l, point(l, p, q), point(l, p + dp, q + dq)


def svg(doc):
    pic = doc["picture"]
    cells, edges = pic.get("cells", {}), pic.get("edges", {})
    tris = [(color, *corners(key)) for key, color in cells.items()]
    lines = [(color, *ends(key)) for key, color in edges.items()]
    pts = [xy for _, _, c in tris for xy in c] + [xy for _, _, a, b in lines for xy in (a, b)] or [(0, 0)]
    x0, x1 = min(x for x, _ in pts), max(x for x, _ in pts)
    y0, y1 = min(y for _, y in pts), max(y for _, y in pts)
    pad = 0.05 * max(x1 - x0, y1 - y0, 0.1)
    vb = (x0 - pad, y0 - pad, x1 - x0 + 2 * pad, y1 - y0 + 2 * pad)
    f = lambda v: f"{v:.6g}"
    out = [f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="{" ".join(f(v) for v in vb)}" width="{f(vb[2] * 512)}" height="{f(vb[3] * 512)}">',
           f'<rect x="{f(vb[0])}" y="{f(vb[1])}" width="{f(vb[2])}" height="{f(vb[3])}" fill="{PAPER.get(pic.get("paper"), PAPER["light"])}"/>']
    for color, l, c in tris:
        # A hairline in the cell's own color hides the seams between neighbors.
        out.append(f'<polygon points="{" ".join(f"{f(x)},{f(y)}" for x, y in c)}" fill="{color}" stroke="{color}" stroke-width="{f(0.02 * 2.0 ** -l)}" stroke-linejoin="round"/>')
    for color, l, a, b in lines:
        out.append(f'<line x1="{f(a[0])}" y1="{f(a[1])}" x2="{f(b[0])}" y2="{f(b[1])}" stroke="{color}" stroke-width="{f(0.14 * 2.0 ** -l)}" stroke-linecap="round"/>')
    out.append("</svg>")
    return "\n".join(out) + "\n"


if __name__ == "__main__":
    if len(sys.argv) != 2:
        sys.exit(__doc__)
    sys.stdout.write(svg(read(sys.argv[1])))
