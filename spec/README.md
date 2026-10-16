# The Isopix file format, 1.0

An Isopix drawing is a JSON document. Everything needed to **draw** it is in
`picture`; everything the Isopix app needs to **edit** it (undo history, cube
faces, the view) is under `app`, which other programs may ignore. A file with
only `picture` is a complete drawing, and Isopix opens it.

Made for anyone to read, write and build on: this folder is in the public
domain ([LICENSE](LICENSE), CC0). The app that writes these files lives at
https://isopix.app.

- [isopix.schema.json](isopix.schema.json): a JSON Schema for the document.
- [examples/](examples/): small drawings, one written by hand.
- [render-svg.py](render-svg.py) and [render-svg.mjs](render-svg.mjs): read any
  Isopix file and print an SVG. Python 3 with only its standard library, or
  Node.js with no packages. About 60 lines each; copy them anywhere.

## Containers

The same JSON travels three ways. A reader should accept all three.

| File | What it is |
|---|---|
| `name.isopix.png` | A normal PNG of the drawing. The JSON is in an `iTXt` chunk with the keyword `isopix` (its text zlib-compressed when the chunk's compression flag is 1), just before `IEND`. Image viewers ignore it. |
| `name.isopix` | The JSON, gzip-compressed. |
| `name.isopix.json` | The JSON as plain UTF-8 text. Easiest to write by hand or by script. |

## The document

```json
{
  "format": "isopix",
  "version": 1,
  "picture": {
    "name": "Two triangles",
    "paper": "light",
    "cells": { "2,0,0,1": "#3a86ff", "2,0,0,0": "#e63946" },
    "edges": { "2,0,1,0": "#1d1e22" }
  },
  "app": { }
}
```

- `format` is always `"isopix"` and `version` is `1`. A reader should refuse a
  version it does not know.
- `picture.name`: the drawing's name. Optional.
- `picture.paper`: `"light"` (background `#f7f5f0`) or `"dark"` (`#1f2228`).
  Optional; light when missing.
- `picture.cells`: every painted triangle, cell key → color.
- `picture.edges`: bold lines on the grid, edge key → color. Optional.
- Colors are `#rrggbb`, either case.

## The grid

The canvas is a grid of equilateral triangles whose lines are vertical, at 30°
and at 150° (the usual isometric cube view). A triangle comes in eight sizes,
**levels** 0 (biggest) to 7 (smallest); each level halves the edge, so one
cell splits exactly into four of the next level.

**Grid points.** At level `l` the edge length is `s = 2^-l` (world units) and
grid point `(p, q)`, any integers, is at

```
x = q · (√3 / 2) · s
y = (p + q / 2) · s          (y grows downward, as on a screen)
```

**Cells.** A cell key is `"l,p,q,u"`, with `l` in 0..7 and `u` 0 or 1. Its
three corners are these grid points at level `l`:

```
u = 1:  (p, q)    (p+1, q)    (p, q+1)       points right
u = 0:  (p+1, q)  (p, q+1)    (p+1, q+1)     points left
```

**Edges.** An edge key is `"l,p,q,d"`, `d` in 0..2: the segment at level `l`
from grid point `(p, q)` to `(p + dp, q + dq)`, where `(dp, dq)` is `(1, 0)`
for `d = 0` (vertical), `(0, 1)` for `d = 1`, and `(-1, 1)` for `d = 2`. Isopix
draws it with round caps, `0.14 · s` wide, over the cells.

**No overlaps.** Each place on the canvas is covered by one painted cell or by
smaller painted cells inside it, never both. So cells may be drawn in any
order. Isopix refuses a file that breaks this rule.

That is all a renderer needs.

## `app`: Isopix's own state

Optional for anyone else: a program that is not Isopix may leave it out. One
that changes `picture` should drop `app.log`, `app.redo` and `app.hidden`,
which describe the drawing as it was, and may keep the rest. `app` may gain
keys without a new version; `picture` changes only with a new `version`.

| Key | What |
|---|---|
| `light` | `"left"` or `"right"`: the side auto-shade lights cube faces from. |
| `faces` | cell key → `{f, s?, b?}`: the cube face of a cell (`"T"`, `"L"` or `"R"`), `s: "r"` when it was shaded lit from the right, and `b` the color it was shaded from. Used by Relight and recolor. |
| `ids` | cell key → `[t, id]`: paint time and identity. Undo and "Finer brings the detail back" rely on them. Missing: Isopix gives fresh ones. |
| `edgeTimes` | edge key → paint time. |
| `seq` | the last id given out. |
| `hidden`, `hiddenEdges` | detail kept under coarsened cells, for Finer. |
| `log`, `redo` | the undo history, which also plays Watch it being drawn. Usually most of the file. |
| `view` | `{zoom, cx, cy}`: where the view was. |
| `stamps` | stamps saved with the drawing. |
| `symmetry` | `{mode, l, p, q}`: the symmetry setting. |
| `trace` | the picture under the grid: `{src: a data: URL, rect: {x, y, w, h}}`. |
| `savedAt` | when it was saved, in milliseconds since 1970. |

The undo history's inner shape is Isopix's working detail and may change.

## Writing a file

1. `format: "isopix"`, `version: 1`, and a `picture` with `cells`.
2. Keys use plain integers, with no spaces.
3. Keep the no-overlaps rule.
4. Save it as `name.isopix.json`, or gzip it as `name.isopix`.

For now Isopix also opens the layout its own first releases saved in, before
this spec; that layout is not part of the format.
