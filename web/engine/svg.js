// SVG export: same-color cells merge into polygons (with holes), and bold
// edges become lines. Pure logic: returns a string.
import * as L from './lattice.js';

// Boundary loops of a set of cells (any levels) as lattice points at level `lev`
// (the finest level among them). Directed edges shared by two cells cancel.
export function mergeLoops(cells, lev) {
  const dir = new Map(); // "a|b" -> [a, b]
  for (const c of cells) {
    const f = 2 ** (lev - c.l);
    let vs = L.cellVerts(c).map(([p, q]) => [p * f, q * f]);
    // Orient every triangle the same way (counter-clockwise on screen).
    const w = vs.map(([p, q]) => L.latticeToWorld(0, p, q));
    const area = (w[1].x - w[0].x) * (w[2].y - w[0].y) - (w[2].x - w[0].x) * (w[1].y - w[0].y);
    if (area < 0) vs = [vs[0], vs[2], vs[1]];
    for (let i = 0; i < 3; i++) {
      const a = vs[i], b = vs[(i + 1) % 3];
      const dp = (b[0] - a[0]) / f, dq = (b[1] - a[1]) / f;
      for (let j = 0; j < f; j++) {
        const s = [a[0] + dp * j, a[1] + dq * j], e = [a[0] + dp * (j + 1), a[1] + dq * (j + 1)];
        const kf = `${s}|${e}`, kr = `${e}|${s}`;
        if (dir.has(kr)) dir.delete(kr); else dir.set(kf, [s, e]);
      }
    }
  }
  // Chain directed segments into loops.
  const out = new Map(); // start "p,q" -> list of segments
  for (const seg of dir.values()) {
    const k = `${seg[0]}`;
    if (!out.has(k)) out.set(k, []);
    out.get(k).push(seg);
  }
  const loops = [];
  for (const list of out.values()) {
    while (list.length) {
      const first = list.pop();
      const startKey = `${first[0]}`;
      const loop = [first[0]];
      let cur = first[1];
      while (`${cur}` !== startKey) {
        loop.push(cur);
        const next = out.get(`${cur}`);
        if (!next || !next.length) break;
        cur = next.pop()[1];
      }
      loops.push(simplify(loop));
    }
  }
  return loops;
}

// Drop points that lie on a straight line between their neighbors.
function simplify(pts) {
  const out = [];
  for (let i = 0; i < pts.length; i++) {
    const a = pts[(i - 1 + pts.length) % pts.length], b = pts[i], c = pts[(i + 1) % pts.length];
    const cross = (b[0] - a[0]) * (c[1] - b[1]) - (b[1] - a[1]) * (c[0] - b[0]);
    if (cross !== 0) out.push(b);
  }
  return out;
}

export function bounds(drawing) {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  const add = (w) => { x0 = Math.min(x0, w.x); y0 = Math.min(y0, w.y); x1 = Math.max(x1, w.x); y1 = Math.max(y1, w.y); };
  for (const k of drawing.cells.keys()) for (const w of L.cellWorldVerts(L.parseKey(k))) add(w);
  for (const k of drawing.edges.keys()) {
    const e = L.parseEdgeKey(k);
    for (const [p, q] of L.edgeEnds(e)) add(L.vertexWorld(e.l, p, q));
  }
  if (x0 === Infinity) return null;
  return { x0, y0, x1, y1 };
}

const fmt = (n) => Number(n.toFixed(4)).toString();

export function toSVG(drawing, opts = {}) {
  const b = bounds(drawing);
  if (!b) return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1 1"/>';
  const pad = 0.05 * Math.max(b.x1 - b.x0, b.y1 - b.y0, 0.1);
  const scale = opts.scale || 400; // px per world unit
  const vx = b.x0 - pad, vy = b.y0 - pad, vw = b.x1 - b.x0 + 2 * pad, vh = b.y1 - b.y0 + 2 * pad;
  const groups = new Map();
  let finest = 0;
  for (const [k, v] of drawing.cells) {
    const c = L.parseKey(k);
    if (!groups.has(v.c)) groups.set(v.c, []);
    groups.get(v.c).push(c);
  }
  const parts = [];
  if (opts.background) parts.push(`<rect x="${fmt(vx)}" y="${fmt(vy)}" width="${fmt(vw)}" height="${fmt(vh)}" fill="${opts.background}"/>`);
  for (const [color, cells] of groups) {
    const lev = Math.max(...cells.map((c) => c.l));
    finest = Math.max(finest, lev);
    const loops = mergeLoops(cells, lev);
    const d = loops.map((loop) => 'M' + loop.map(([p, q]) => { const w = L.vertexWorld(lev, p, q); return `${fmt(w.x)} ${fmt(w.y)}`; }).join('L') + 'Z').join('');
    parts.push(`<path fill="${color}" d="${d}"/>`);
  }
  for (const [k, v] of drawing.edges) {
    const e = L.parseEdgeKey(k);
    const [[p0, q0], [p1, q1]] = L.edgeEnds(e);
    const a = L.vertexWorld(e.l, p0, q0), c = L.vertexWorld(e.l, p1, q1);
    parts.push(`<line x1="${fmt(a.x)}" y1="${fmt(a.y)}" x2="${fmt(c.x)}" y2="${fmt(c.y)}" stroke="${v.c}" stroke-width="${fmt(edgeWidth(e.l))}" stroke-linecap="round"/>`);
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${Math.round(vw * scale)}" height="${Math.round(vh * scale)}" viewBox="${fmt(vx)} ${fmt(vy)} ${fmt(vw)} ${fmt(vh)}">${parts.join('')}</svg>`;
}

// Bold edge weight in world units: tied to the edge's level.
export const edgeWidth = (l) => L.edgeLen(l) * 0.14;
