# The Isopix file format (DRAFT, version 2)

> **Draft for the owner's review (2026-10-16).** Nothing below is built yet.
> Today's files are version 1 (§ Version 1). Once approved, this text moves to
> `spec/README.md` under CC0, with a JSON Schema, example files and two small
> reference renderers.

An Isopix drawing is a JSON document. Everything needed to **draw** it is in
the top-level `picture`; everything Isopix needs to **edit** it (undo history,
cube faces, the view) is under `app`, which other programs may ignore. A file
with only `picture` is a complete drawing, and Isopix opens it.

## Containers

The same JSON travels three ways. A reader should accept all three.

| File | What it is |
|---|---|
| `name.isopix.png` | A normal PNG of the drawing. The JSON is in an `iTXt` chunk with the keyword `isopix` (zlib-compressed when the chunk's flag says so), just before `IEND`. Image viewers ignore it. |
| `name.isopix` | The JSON, gzip-compressed. |
| `name.isopix.json` | The JSON as plain text. Easiest to write by hand or by script. |

## The document

```json
{
  "format": "isopix",
  "version": 2,
  "picture": {
    "name": "Bouncy Badger",
    "paper": "light",
    "cells": { "2,0,0,1": "#3a86ff", "2,1,0,1": "#0053c8" },
    "edges": { "2,0,1,0": "#1d1e22" }
  },
  "app": { }
}
```

- `format` is always `"isopix"`. `version` is `2`. A reader refuses a version
  it does not know; Isopix opens 1 and 2.
- `picture.name`: the drawing's name. Optional.
- `picture.paper`: `"light"` (background `#f7f5f0`) or `"dark"` (`#1f2228`).
  Optional; light when missing.
- `picture.cells`: every painted triangle, cell key → color (`#rrggbb`).
- `picture.edges`: bold lines on the grid, edge key → color. Optional.

## The grid

The canvas is a grid of equilateral triangles, with lines that are vertical,
at 30° and at 150° (the usual isometric cube view). A triangle has eight sizes,
**levels** 0 (biggest) to 7 (smallest); each level halves the edge length, so
one cell splits exactly into four of the next level.

**Grid points.** At level `l` the edge length is `s = 2^-l` world units, and
grid point `(p, q)` (any integers) is at

```
x = q · (√3 / 2) · s
y = (p + q / 2) · s          (y grows downward, as on screen)
```

**Cells.** A cell key is `"l,p,q,u"`. Its three corners are grid points at
level `l`:

```
u = 1:  (p, q), (p+1, q), (p, q+1)        a triangle pointing right
u = 0:  (p+1, q), (p, q+1), (p+1, q+1)    a triangle pointing left
```

**Edges.** An edge key is `"l,p,q,d"`: the segment at level `l` from grid point
`(p, q)` to `(p + dp, q + dq)`, with `(dp, dq)` = `(1, 0)` for `d = 0`
(vertical), `(0, 1)` for `d = 1`, `(-1, 1)` for `d = 2`. Isopix draws it with
round caps, `0.14 · s` wide.

**No overlaps.** A place on the canvas is covered by one painted cell or by
smaller cells inside it, never both. So cells can be drawn in any order.

That is all a renderer needs: a few lines of code turn every cell into a
polygon (§ Reference renderers).

## `app`: Isopix's own state

Optional for anyone else; Isopix reads it to restore everything as it was. A
writer that is not Isopix may leave it out or keep it unchanged.

| Key | What |
|---|---|
| `light` | `"left"` or `"right"`: the side auto-shade lights cube faces from. |
| `faces` | cell key → `{f, b?, s?}`: the cube face a cell belongs to (`T`, `L`, `R`), the base color it was shaded from, `s: "r"` when lit from the right. Used by Relight and recolor. |
| `ids` | cell key → `[t, id]`: paint time and identity. Undo and "Finer brings the detail back" rely on them. Missing: Isopix gives fresh ones. |
| `edgeTimes` | edge key → `t`. |
| `seq` | the last id given out. |
| `hidden`, `hiddenEdges` | detail kept under coarse cells, for Finer. |
| `log`, `redo` | the undo history (it also drives Watch it being drawn). Usually most of the file. |
| `view` | `{zoom, cx, cy}`: where the view was. |
| `stamps` | the stamps saved with it (Isopix also keeps them in the browser). |
| `symmetry` | the symmetry setting: `{mode, l, p, q}`. |
| `trace` | the trace picture under the grid: `{src (a data: URL), rect: {x, y, w, h}}`. |
| `savedAt` | when it was saved (ms since 1970). |

`app` is Isopix's working state, documented so nothing is hidden, but it may
grow new keys in any version. `picture` changes only with a new `version`.

## Rules for writers

- Colors are `#rrggbb`, lowercase or uppercase.
- Keys use plain integers: no spaces, no leading `+`.
- Keep the no-overlaps rule. Isopix refuses a file that breaks it, and says why.
- Write `version: 2`, `format: "isopix"`.

## Version 1 (files saved by Isopix 1.0 to 1.2.x)

The same grid and keys, laid out flat: `cells` and `edges` are lists of
`[key, value]` pairs whose values are objects (`{c, f?, b?, s?, t, id}` for a
cell, `{c, t}` for an edge), and the app state sits at the top level beside
them (`log`, `redo`, `hidden`, `hiddenEdges`, `seq`, `view`, `stamps`,
`symmetry`, `trace`, `name`, `paper`, `light`, `savedAt`). A reader that wants
only the picture reads `cells[i][0]` (the key) and `cells[i][1].c` (the color).
Isopix opens version 1 files for good, and from release 2 writes version 2.

## Reference renderers

`spec/render-svg.py` (Python 3, standard library only) and
`spec/render-svg.mjs` (JavaScript, no packages) read any of the three
containers and print an SVG. A test checks they draw what Isopix draws.

## License

This specification, the schema, the examples and the reference renderers are
dedicated to the public domain under CC0 1.0: anyone may read, write, copy or
build on Isopix files without asking. (Owner, 2026-10-16: "CC0".)
