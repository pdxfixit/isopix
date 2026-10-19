// Canvas 2D renderer: cells (merged per color, overlapped slightly so
// same-color neighbors show no hairline seams), bold edges, gutters that fade
// with on-screen cell size, finer-level hints, and overlays (selection
// outline, symmetry center, hover ghost, trace image). Owns no state.
import * as L from './engine/lattice.js';
import { edgeWidth } from './engine/svg.js';
import { regionBoundary } from './engine/density.js';
import { layerPlan } from './layer.js';

// World-space triangle corners per cell key, cached: keys never change their
// geometry, and parsing keys every frame was most of the frame time.
const GEO = new Map();
function geo(k) {
  let g = GEO.get(k);
  if (!g) {
    if (GEO.size > 400000) GEO.clear();
    const c = L.parseKey(k);
    const s = L.edgeLen(c.l), h = L.H * s;
    const vs = L.cellVerts(c);
    g = new Float64Array(6);
    for (let i = 0; i < 3; i++) { g[2 * i] = vs[i][1] * h; g[2 * i + 1] = (vs[i][0] + vs[i][1] / 2) * s; }
    GEO.set(k, g);
  }
  return g;
}

// t = {zoom, ox, oy}: screen = (world - o) * zoom, in CSS px.
export function cellPaths(drawing, t, box) {
  const paths = new Map();
  const { zoom, ox, oy } = t;
  const { x0, y0, x1, y1 } = box;
  for (const [k, v] of drawing.cells) {
    const g = geo(k);
    const minx = Math.min(g[0], g[2], g[4]), maxx = Math.max(g[0], g[2], g[4]);
    if (maxx < x0 || minx > x1) continue;
    const miny = Math.min(g[1], g[3], g[5]), maxy = Math.max(g[1], g[3], g[5]);
    if (maxy < y0 || miny > y1) continue;
    // Path2D building slows down with the square of its subpaths (measured:
    // 38,400 triangles in one path took 2.3 s, in paths of 64 took 6 ms), so
    // each color gets a list of small paths. The seam stroke hides their joins.
    let list = paths.get(v.c);
    if (!list) { list = { all: [], cur: null, n: 0 }; paths.set(v.c, list); }
    if (!list.cur || list.n >= 96) { list.cur = new Path2D(); list.all.push(list.cur); list.n = 0; }
    list.n++;
    const path = list.cur;
    path.moveTo((g[0] - ox) * zoom, (g[1] - oy) * zoom);
    path.lineTo((g[2] - ox) * zoom, (g[3] - oy) * zoom);
    path.lineTo((g[4] - ox) * zoom, (g[5] - oy) * zoom);
    path.closePath();
  }
  return paths;
}

export function drawCells(ctx, drawing, t, box, seamPx) {
  ctx.lineJoin = 'round';
  // A fixed color order: where two colors meet, the seam strokes overlap, so
  // a patch must stack them the way a full redraw does.
  for (const [color, list] of [...cellPaths(drawing, t, box)].sort((a, b) => (a[0] < b[0] ? -1 : 1))) {
    ctx.fillStyle = color;
    ctx.strokeStyle = color;
    ctx.lineWidth = seamPx;
    for (const path of list.all) {
      ctx.fill(path);
      if (seamPx > 0) ctx.stroke(path);
    }
  }
}

export function drawEdges(ctx, drawing, t) {
  ctx.lineCap = 'round';
  for (const [k, v] of drawing.edges) {
    const e = L.parseEdgeKey(k);
    const [[p0, q0], [p1, q1]] = L.edgeEnds(e);
    const a = L.vertexWorld(e.l, p0, q0), b = L.vertexWorld(e.l, p1, q1);
    ctx.strokeStyle = v.c;
    ctx.lineWidth = Math.max(1, edgeWidth(e.l) * t.zoom);
    ctx.beginPath();
    ctx.moveTo((a.x - t.ox) * t.zoom, (a.y - t.oy) * t.zoom);
    ctx.lineTo((b.x - t.ox) * t.zoom, (b.y - t.oy) * t.zoom);
    ctx.stroke();
  }
}

// Build small Path2Ds (see cellPaths for why): add(path, item) for each item.
function chunked(items, add, size = 96) {
  const out = [];
  for (let i = 0; i < items.length; i += size) {
    const path = new Path2D();
    for (let j = i; j < Math.min(items.length, i + size); j++) add(path, items[j]);
    out.push(path);
  }
  return out;
}

const HINT = { off: 0, faint: 0.35, clear: 0.75 };

export class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.dpr = 1;
  }
  resize(w, h, dpr) {
    this.dpr = dpr;
    this.canvas.width = Math.round(w * dpr);
    this.canvas.height = Math.round(h * dpr);
    this.layer = null; // a new screen size: redraw the cell layer
  }

  // s: {drawing, view, level, opts: {gutters, hint, hintLevels}, theme: {bg, line, accent},
  //     overlay: {region, ghost: [cells], live: {x0, y0, x1, y1}, pointer: {x0, y0, x1, y1}, symmetry: {mode, center}, trace: {img, rect, opacity}}}
  draw(s) {
    const { ctx, dpr } = this;
    const v = s.view;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = s.theme.bg;
    ctx.fillRect(0, 0, v.w, v.h);
    const box = v.worldBox();
    const t = { zoom: v.zoom, ox: box.x0, oy: box.y0 };
    const tr = s.overlay.trace;
    if (tr && tr.img) {
      ctx.globalAlpha = tr.opacity;
      const [x, y] = v.toScreen(tr.rect.x, tr.rect.y);
      ctx.drawImage(tr.img, x, y, tr.rect.w * v.zoom, tr.rect.h * v.zoom);
      ctx.globalAlpha = 1;
    }
    this.drawCellLayer(s.drawing, v, box);
    if (s.opts.gutters) this.drawGutters(s, box, t);
    drawEdges(ctx, s.drawing, t);
    this.drawOverlay(s, t);
  }

  // The cells come from an offscreen bitmap (web/layer.js says when it is
  // reused, patched or redrawn), then the live parts draw on top.
  drawCellLayer(drawing, v, box) {
    const { ctx, dpr } = this;
    const zoom = v.zoom;
    const c = this.layer;
    const plan = layerPlan(c && c.zoom !== undefined ? c : null, { drawing, version: drawing.version, zoom, dpr, box, dirtyOverflow: drawing.dirtyOverflow });
    if (plan.action === 'full') this.renderLayer(drawing, v, box, plan.margin);
    else if (plan.action === 'patch') this.patchLayer(drawing);
    drawing.dirty.clear();
    drawing.dirtyOverflow = false;
    const l = this.layer;
    const dx = Math.round((l.x0 - box.x0) * zoom * dpr), dy = Math.round((l.y0 - box.y0) * zoom * dpr);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.drawImage(l.canvas, dx, dy);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  renderLayer(drawing, v, box, margin) {
    const { dpr } = this;
    const m = Math.round(margin * dpr); // device px, whole, so the first blit lands on whole pixels
    const W = Math.ceil(v.w * dpr) + 2 * m, H = Math.ceil(v.h * dpr) + 2 * m;
    let l = this.layer;
    if (!l || l.canvas.width !== W || l.canvas.height !== H) {
      const canvas = typeof OffscreenCanvas !== 'undefined' ? new OffscreenCanvas(W, H) : Object.assign(document.createElement('canvas'), { width: W, height: H });
      l = this.layer = { canvas, ctx: canvas.getContext('2d') };
    }
    const k = v.zoom * dpr; // device px per world unit
    Object.assign(l, { drawing, version: drawing.version, zoom: v.zoom, dpr, x0: box.x0 - m / k, y0: box.y0 - m / k });
    l.x1 = l.x0 + W / k; l.y1 = l.y0 + H / k;
    const g = l.ctx;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, W, H);
    drawCells(g, drawing, { zoom: v.zoom, ox: l.x0, oy: l.y0 }, { x0: l.x0, y0: l.y0, x1: l.x1, y1: l.y1 }, 0.7 / dpr);
  }

  // Redraw only the box around the changed cells: clear it, then draw every
  // cell that reaches into it (a little wider, for antialiasing and the seam stroke).
  patchLayer(drawing) {
    const l = this.layer;
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const key of drawing.dirty) {
      const gk = geo(key);
      for (let i = 0; i < 6; i += 2) { x0 = Math.min(x0, gk[i]); x1 = Math.max(x1, gk[i]); y0 = Math.min(y0, gk[i + 1]); y1 = Math.max(y1, gk[i + 1]); }
    }
    l.version = drawing.version;
    if (x0 === Infinity || x1 < l.x0 || x0 > l.x1 || y1 < l.y0 || y0 > l.y1) return;
    const px = 1 / (l.zoom * l.dpr); // one device pixel in world units
    const clip = { x0: x0 - 2 * px, y0: y0 - 2 * px, x1: x1 + 2 * px, y1: y1 + 2 * px };
    const g = l.ctx;
    const X = (x) => (x - l.x0) * l.zoom, Y = (y) => (y - l.y0) * l.zoom;
    g.save();
    g.beginPath();
    g.rect(X(clip.x0), Y(clip.y0), X(clip.x1) - X(clip.x0), Y(clip.y1) - Y(clip.y0));
    g.clip();
    g.clearRect(X(clip.x0), Y(clip.y0), X(clip.x1) - X(clip.x0), Y(clip.y1) - Y(clip.y0));
    const wide = { x0: clip.x0 - 2 * px, y0: clip.y0 - 2 * px, x1: clip.x1 + 2 * px, y1: clip.y1 + 2 * px };
    drawCells(g, drawing, { zoom: l.zoom, ox: l.x0, oy: l.y0 }, wide, 0.7 / l.dpr);
    g.restore();
  }

  drawGutters(s, box, t) {
    const { ctx } = this;
    const hint = HINT[s.opts.hint] ?? 0;
    const last = Math.min(L.MAX_LEVEL, s.level + (hint ? s.opts.hintLevels : 0));
    let prevDrawn = false;
    for (let l = 0; l <= last; l++) {
      const sz = L.edgeLen(l);
      let a = L.gutterAlpha(sz * t.zoom);
      if (l > s.level) a *= hint;
      if (a < 0.01) { prevDrawn = false; continue; }
      const r = L.lineRanges(sz, box.x0, box.y0, box.x1, box.y1);
      const X = (x) => (x - t.ox) * t.zoom, Y = (y) => (y - t.oy) * t.zoom;
      // A line already drawn at the coarser level is not drawn again (stacked
      // alpha made coarse lines glare); coarser levels draw a little thicker instead.
      const skip = (k) => prevDrawn && k % 2 === 0;
      const path = new Path2D();
      for (let k = r.Q[0]; k <= r.Q[1]; k++) { if (skip(k)) continue; const x = X(L.lineQx(k, sz)); path.moveTo(x, 0); path.lineTo(x, s.view.h); }
      for (let k = r.P[0]; k <= r.P[1]; k++) { if (skip(k)) continue; path.moveTo(X(box.x0), Y(L.linePy(k, sz, box.x0))); path.lineTo(X(box.x1), Y(L.linePy(k, sz, box.x1))); }
      for (let k = r.R[0]; k <= r.R[1]; k++) { if (skip(k)) continue; path.moveTo(X(box.x0), Y(L.lineRy(k, sz, box.x0))); path.lineTo(X(box.x1), Y(L.lineRy(k, sz, box.x1))); }
      ctx.lineWidth = Math.min(2.5, 1 + 0.5 * Math.max(0, s.level - l)) / this.dpr;
      ctx.strokeStyle = s.theme.line;
      ctx.globalAlpha = a;
      ctx.stroke(path);
      prevDrawn = true;
    }
    ctx.globalAlpha = 1;
  }

  drawOverlay(s, t) {
    const { ctx } = this;
    const o = s.overlay;
    const P = (l, p, q) => { const w = L.vertexWorld(l, p, q); return [(w.x - t.ox) * t.zoom, (w.y - t.oy) * t.zoom]; };
    if (o.ghost && o.ghost.length) {
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = s.theme.accent;
      ctx.globalAlpha = 0.8;
      for (const path of chunked(o.ghost, (path, c) => {
        const vs = L.cellVerts(c).map(([p, q]) => P(c.l, p, q));
        path.moveTo(...vs[0]); path.lineTo(...vs[1]); path.lineTo(...vs[2]); path.closePath();
      })) ctx.stroke(path);
      ctx.globalAlpha = 1;
    }
    // Cells Keep fine detail would skip (or just skipped): hatched with a dashed outline,
    // so they read differently from painted cells without relying on color.
    if (o.skip && o.skip.length) {
      const path = new Path2D();
      let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
      for (const c of o.skip.slice(0, 2000)) {
        const vs = L.cellVerts(c).map(([p, q]) => P(c.l, p, q));
        path.moveTo(...vs[0]); path.lineTo(...vs[1]); path.lineTo(...vs[2]); path.closePath();
        for (const [x, y] of vs) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
      }
      ctx.save();
      ctx.clip(path);
      ctx.beginPath();
      for (let k = x0 - (y1 - y0); k < x1; k += 6) { ctx.moveTo(k, y1); ctx.lineTo(k + (y1 - y0), y0); }
      ctx.lineWidth = 2;
      ctx.strokeStyle = s.theme.line;
      ctx.globalAlpha = 0.85;
      ctx.stroke();
      ctx.restore();
      ctx.setLineDash([4, 3]);
      ctx.lineWidth = 2;
      ctx.strokeStyle = s.theme.accent;
      ctx.stroke(path);
      ctx.setLineDash([]);
      ctx.globalAlpha = 1;
    }
    if (o.regionCells && o.regionCells.length) {
      ctx.lineWidth = 1;
      ctx.strokeStyle = s.theme.bg;
      ctx.globalAlpha = 0.75;
      for (const path of chunked(o.regionCells, (path, c) => {
        const vs = L.cellVerts(c).map(([p, q]) => P(c.l, p, q));
        path.moveTo(...vs[0]); path.lineTo(...vs[1]); path.lineTo(...vs[2]); path.closePath();
      })) ctx.stroke(path);
      ctx.globalAlpha = 1;
    }
    // The stamp just placed, while it can be sized: a dashed box around it, a little out.
    if (o.live) {
      const [x0, y0] = [(o.live.x0 - t.ox) * t.zoom - 6, (o.live.y0 - t.oy) * t.zoom - 6];
      const [x1, y1] = [(o.live.x1 - t.ox) * t.zoom + 6, (o.live.y1 - t.oy) * t.zoom + 6];
      ctx.lineWidth = 3;
      ctx.strokeStyle = s.theme.bg;
      ctx.strokeRect(x0, y0, x1 - x0, y1 - y0);
      ctx.lineWidth = 2;
      ctx.strokeStyle = s.theme.accent;
      ctx.setLineDash([6, 4]);
      ctx.strokeRect(x0, y0, x1 - x0, y1 - y0);
      ctx.setLineDash([]);
    }
    // The live stamp's pointer: from its foot to the handle that turns and sizes it.
    if (o.pointer) {
      const [x0, y0] = [(o.pointer.x0 - t.ox) * t.zoom, (o.pointer.y0 - t.oy) * t.zoom];
      const [x1, y1] = [(o.pointer.x1 - t.ox) * t.zoom, (o.pointer.y1 - t.oy) * t.zoom];
      ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1);
      ctx.lineWidth = 4; ctx.strokeStyle = s.theme.bg; ctx.stroke();
      ctx.lineWidth = 2; ctx.strokeStyle = s.theme.accent; ctx.stroke();
      ctx.beginPath(); ctx.arc(x0, y0, 5, 0, Math.PI * 2); ctx.fillStyle = s.theme.accent; ctx.fill();
    }
    if (o.region) {
      const paths = chunked(regionBoundary(o.region), (path, [a, b]) => { path.moveTo(...P(o.region.l, ...a)); path.lineTo(...P(o.region.l, ...b)); });
      ctx.lineWidth = 3;
      ctx.strokeStyle = s.theme.bg;
      ctx.setLineDash([]);
      for (const path of paths) ctx.stroke(path);
      ctx.lineWidth = 2;
      ctx.strokeStyle = s.theme.accent;
      ctx.setLineDash([6, 4]);
      for (const path of paths) ctx.stroke(path);
      ctx.setLineDash([]);
    }
    if (o.crosshair) {
      const [x, y] = P(o.crosshair.l, o.crosshair.p, o.crosshair.q);
      ctx.strokeStyle = s.theme.accent;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(x - 12, y); ctx.lineTo(x + 12, y); ctx.moveTo(x, y - 12); ctx.lineTo(x, y + 12);
      ctx.stroke();
      ctx.beginPath(); ctx.arc(x, y, 5, 0, Math.PI * 2); ctx.stroke();
    }
    const sym = o.symmetry;
    if (sym && sym.mode !== 'off') {
      const [x, y] = P(sym.center.l, sym.center.p, sym.center.q);
      ctx.strokeStyle = s.theme.accent;
      ctx.globalAlpha = 0.35;
      ctx.lineWidth = 1;
      ctx.beginPath();
      const n = sym.mode === 'mirror' ? 1 : 3;
      const R = Math.hypot(s.view.w, s.view.h);
      for (let i = 0; i < n; i++) {
        const a = Math.PI / 2 + (i * Math.PI) / (n === 1 ? 1 : 3);
        ctx.moveTo(x - Math.cos(a) * R, y - Math.sin(a) * R); ctx.lineTo(x + Math.cos(a) * R, y + Math.sin(a) * R);
      }
      ctx.stroke();
      ctx.globalAlpha = 1;
      ctx.fillStyle = s.theme.accent;
      ctx.beginPath(); ctx.arc(x, y, 6, 0, Math.PI * 2); ctx.fill();
    }
  }
}
