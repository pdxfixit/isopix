// Selection regions and density change: refine (lossless) and coarsen
// (Crisp majority or Blend in Oklab), with hidden children kept so refining
// again restores them exactly. Also stamps (a selection saved as a brush).
// Pure logic, no DOM. All changes go through the Drawing primitives, so the
// caller wraps them in a transaction and undo reverses them.
//
// A region is {l, keys: Set<cellKey>}: lattice cells at the marquee level.
import * as L from './lattice.js';
import { mixOklab, nearest } from './color.js';

export function makeRegion(l, cells) {
  return { l, keys: new Set(cells.map((c) => L.cellKey(c.cell || c))) };
}
export const regionCells = (r) => [...r.keys].map(L.parseKey);

// Count of region cells under each ancestor at level k < r.l.
function countsAt(r, k) {
  const m = new Map();
  for (const key of r.keys) {
    const a = L.cellKey(L.ancestorAt(L.parseKey(key), k));
    m.set(a, (m.get(a) || 0) + 1);
  }
  return m;
}
// True when the ancestor-at-k cell `ak` is wholly inside the region.
function fullAt(r, k, counts) {
  const need = 4 ** (r.l - k);
  return (ak) => counts.get(ak) === need;
}

// The region snapped to level T: for T >= r.l the same area; for T < r.l the
// level-T cells wholly inside it (the marquee shrinks onto T's edges).
export function snapRegion(r, T) {
  if (T >= r.l) return r;
  const counts = countsAt(r, T);
  const full = fullAt(r, T, counts);
  return { l: T, keys: new Set([...counts.keys()].filter(full)) };
}

// Is cell c (any level) inside region r?
export function inRegion(r, c) {
  if (c.l >= r.l) return r.keys.has(L.cellKey(L.ancestorAt(c, r.l)));
  return r.keys.has(L.cellKey(L.descendantsAt(c, r.l)[0])) && L.descendantsAt(c, r.l).every((d) => r.keys.has(L.cellKey(d)));
}

// Split painted cells coarser than the region that straddle its border, so
// every painted cell is wholly inside or wholly outside.
export function splitBorder(drawing, r) {
  const fullBy = new Map();
  for (let k = 0; k < r.l; k++) fullBy.set(k, fullAt(r, k, countsAt(r, k)));
  for (const key of r.keys) {
    const c = L.parseKey(key);
    const anc = drawing.paintedAncestor(c);
    if (!anc) continue;
    if (fullBy.get(anc.cell.l)(L.cellKey(anc.cell))) continue;
    // Split only down to the coarsest level at which pieces are wholly inside or outside.
    let target = r.l;
    for (let k = anc.cell.l + 1; k < r.l; k++) {
      if (fullBy.get(k)(L.cellKey(L.ancestorAt(c, k)))) { target = k; break; }
    }
    drawing.splitDownTo(L.ancestorAt(c, target));
  }
}

// Painted cells inside the region (call after splitBorder).
export function paintedIn(drawing, r) {
  const out = new Map();
  const walk = (c, k) => {
    if (drawing.cells.has(k)) { out.set(k, c); return; }
    if (!(drawing.sub.get(k) > 0)) return;
    for (const ch of L.children(c)) walk(ch, L.cellKey(ch));
  };
  for (const key of r.keys) {
    const c = L.parseKey(key);
    const anc = drawing.paintedAncestor(c);
    if (anc) { out.set(L.cellKey(anc.cell), anc.cell); continue; }
    walk(c, key);
  }
  return [...out.values()];
}

export function edgesIn(drawing, r) {
  const out = [];
  for (const k of drawing.edges.keys()) {
    const e = L.parseEdgeKey(k);
    if (e.l < r.l) continue;
    if (L.edgeCells(e).some((c) => r.keys.has(L.cellKey(L.ancestorAt(c, r.l))))) out.push(e);
  }
  return out;
}

// The density of a region: the finest level painted in it (or its own level).
export function densityOf(drawing, r) {
  let d = -1;
  for (const c of paintedIn(drawing, r)) d = Math.max(d, c.l);
  for (const e of edgesIn(drawing, r)) d = Math.max(d, e.l);
  return d < 0 ? r.l : d;
}

function refineOnce(drawing, r, D) {
  // Cells a coarsen emptied (Crisp majority "empty") keep their children too.
  const emptied = [];
  for (const [k, h] of drawing.hidden) {
    if (!h.empty) continue;
    const c = L.parseKey(k);
    if (c.l < r.l || c.l >= L.MAX_LEVEL || !r.keys.has(L.cellKey(L.ancestorAt(c, r.l)))) continue;
    if (drawing.cells.has(k) || drawing.sub.get(k) > 0 || drawing.paintedAncestor(c)) continue;
    emptied.push(h);
  }
  for (const c of paintedIn(drawing, r)) {
    if (c.l >= L.MAX_LEVEL) continue;
    const k = L.cellKey(c);
    const v = drawing.cells.get(k);
    const h = drawing.hidden.get(k);
    drawing.setCell(k, null);
    if (h && h.id === v.id) {
      for (const [ck, cv] of h.cells) if (cv) drawing.setCell(ck, cv);
    } else {
      for (const ch of L.children(c)) drawing.setCell(L.cellKey(ch), drawing.inherit(v));
    }
  }
  for (const h of emptied) for (const [ck, cv] of h.cells) if (cv) drawing.setCell(ck, cv);
  // Edges inside cells at this density that a coarsen hid come back.
  const inside = [];
  for (const [hk, h] of drawing.hiddenEdges) {
    if (!hk.startsWith('c:')) continue;
    const c = L.parseKey(hk.slice(2));
    if (c.l === D && inRegion(r, c)) inside.push([hk, h]);
  }
  for (const e of edgesIn(drawing, r)) {
    if (e.l >= L.MAX_LEVEL) continue;
    const k = L.edgeKey(e), v = drawing.edges.get(k);
    const h = drawing.hiddenEdges.get('e:' + k);
    drawing.setEdge(k, null);
    if (h && h.t === v.t) {
      // A merged edge splits back into exactly the halves it was made of.
      for (const [hk2, hv] of h.halves) if (hv) drawing.setEdge(hk2, hv);
      drawing.setHiddenEdge('e:' + k, null);
    } else {
      for (const ch of L.edgeChildren(e)) drawing.setEdge(L.edgeKey(ch), v);
    }
  }
  for (const [hk, h] of inside) {
    for (const [ek, ev] of h.edges) drawing.setEdge(ek, ev);
    drawing.setHiddenEdge(hk, null);
  }
}

// Combine four child values (null = empty) into one parent value.
export function combine(drawing, vals, opts = {}) {
  if (opts.mode === 'blend') {
    const painted = vals.filter(Boolean);
    if (!painted.length || painted.length * 2 < vals.length) return null; // mostly empty stays empty
    let c = mixOklab(painted.map((v) => v.c));
    if (opts.snap && opts.palette && opts.palette.length) c = nearest(c, opts.palette);
    return drawing.makeValue({ c }, Math.max(...painted.map((v) => v.t)));
  }
  // Crisp: majority color; tie-break by the most recently painted child.
  const groups = new Map();
  for (const v of vals) {
    const g = v ? v.c : '';
    const e = groups.get(g) || { n: 0, t: -Infinity, v: null };
    e.n++;
    if (v && v.t > e.t) { e.t = v.t; e.v = v; }
    groups.set(g, e);
  }
  let best = null;
  for (const [g, e] of groups) if (!best || e.n > best.e.n || (e.n === best.e.n && e.t > best.e.t)) best = { g, e };
  if (best.g === '') return null;
  return drawing.makeValue({ c: best.e.v.c, f: best.e.v.f }, best.e.v.t);
}

// One collapse step: every painted cell at level lev+1 inside `r` merges with
// its siblings into its parent at lev (when that parent is wholly inside).
function collapseStep(drawing, r, lev, opts) {
  const R = snapRegion(r, lev);
  const parents = new Map();
  for (const c of paintedIn(drawing, r)) {
    if (c.l !== lev + 1) continue;
    const p = L.parent(c), pk = L.cellKey(p);
    if (lev < r.l && !R.keys.has(pk)) continue;
    parents.set(pk, p);
  }
  for (const [pk, p] of parents) {
    const kids = L.children(p).map((ch) => L.cellKey(ch));
    const vals = kids.map((k) => drawing.cells.get(k) || null);
    const nv = combine(drawing, vals, opts);
    for (const k of kids) drawing.setCell(k, null);
    const kept = kids.map((k, i) => [k, vals[i]]);
    if (nv) {
      drawing.setCell(pk, nv);
      drawing.setHidden(pk, { id: nv.id, cells: kept });
    } else {
      drawing.setHidden(pk, { empty: true, cells: kept });
    }
  }
  // Edges: halves on the coarser lattice merge into one coarse edge (which
  // remembers its halves); edges inside a coarser cell are hidden in it.
  // Refining brings both back exactly, until the user draws there.
  const merged = new Map(), inner = new Map();
  for (const e of edgesIn(drawing, r)) {
    if (e.l !== lev + 1) continue;
    const k = L.edgeKey(e), v = drawing.edges.get(k);
    const pe = L.edgeParent(e);
    if (pe) {
      if (lev < r.l && !L.edgeCells(pe).some((c) => R.keys.has(L.cellKey(c)))) continue;
      const pk = L.edgeKey(pe);
      if (!merged.has(pk)) merged.set(pk, { v, halves: L.edgeChildren(pe).map((ch) => [L.edgeKey(ch), drawing.edges.get(L.edgeKey(ch)) || null]) });
    } else {
      const cell = L.parent(L.edgeCells(e)[0]);
      if (lev < r.l && !R.keys.has(L.cellKey(cell))) continue;
      const ck = 'c:' + L.cellKey(cell);
      if (!inner.has(ck)) inner.set(ck, []);
      inner.get(ck).push([k, v]);
    }
  }
  for (const [pk, m] of merged) {
    for (const [hk] of m.halves) drawing.setEdge(hk, null);
    const nv = { c: m.v.c, t: drawing.nextId() };
    drawing.setEdge(pk, nv);
    drawing.setHiddenEdge('e:' + pk, { t: nv.t, halves: m.halves });
  }
  for (const [ck, list] of inner) {
    for (const [ek] of list) drawing.setEdge(ek, null);
    const before = drawing.hiddenEdges.get(ck);
    drawing.setHiddenEdge(ck, { edges: [...(before ? before.edges : []), ...list] });
  }
}

// Change the region's density to level T. Returns the new marquee region
// (snapped when T is coarser than it), or null when T is not reachable
// (no level-T cell lies wholly inside the marquee).
// opts: {mode: 'crisp'|'blend', snap, palette}
export function changeDensity(drawing, r, T, opts = {}) {
  T = Math.max(0, Math.min(L.MAX_LEVEL, T));
  if (T < r.l && snapRegion(r, T).keys.size === 0) return null;
  splitBorder(drawing, r);
  const D = densityOf(drawing, r);
  if (T > D) { for (let i = D; i < T; i++) refineOnce(drawing, r, i); return r; }
  for (let lev = D - 1; lev >= T; lev--) collapseStep(drawing, r, lev, opts);
  return T < r.l ? snapRegion(r, T) : r;
}

// The coarsest level the marquee can reach (its boundary must lie on that level's edges).
export function coarsestReachable(r) {
  let T = r.l;
  while (T > 0 && snapRegion(r, T - 1).keys.size > 0) T--;
  return T;
}

// Region boundary as lattice segments [[p,q],[p,q]] at the region's level.
export function regionBoundary(r) {
  const segs = [];
  for (const key of r.keys) {
    const c = L.parseKey(key);
    for (const { cell } of L.edgeNeighbors(c)) {
      if (r.keys.has(L.cellKey(cell))) continue;
      const sv = new Set(L.cellVerts(cell).map((v) => v.join(',')));
      segs.push(L.cellVerts(c).filter((v) => sv.has(v.join(','))));
    }
  }
  return segs;
}

export function eraseRegion(drawing, r) {
  for (const c of regionCells(r)) drawing.paint(c, null, 'replace');
  for (const e of edgesIn(drawing, r)) drawing.setEdge(L.edgeKey(e), null);
}

// ---------- stamps ----------
// A stamp keeps cells relative to an anchor vertex at its base level, so it can
// be placed at any level: scaling by 2 about a lattice vertex maps the level-l
// lattice exactly onto level l-1, keeping each cell's relative coordinates.
export function extractStamp(drawing, r, anchor) {
  const cells = [];
  const push = (c, v) => {
    const f = 2 ** (c.l - r.l);
    cells.push([c.l - r.l, c.p - anchor.p * f, c.q - anchor.q * f, c.u, v.c, v.f || null]);
  };
  const walk = (c, k) => {
    const v = drawing.cells.get(k);
    if (v) { push(c, v); return; }
    if (!(drawing.sub.get(k) > 0)) return;
    for (const ch of L.children(c)) walk(ch, L.cellKey(ch));
  };
  for (const key of r.keys) {
    const c = L.parseKey(key);
    const anc = drawing.paintedAncestor(c);
    if (anc) push(c, anc.v); else walk(c, key);
  }
  const edges = edgesIn(drawing, r).map((e) => {
    const f = 2 ** (e.l - r.l), v = drawing.edges.get(L.edgeKey(e));
    return [e.l - r.l, e.p - anchor.p * f, e.q - anchor.q * f, e.d, v.c];
  });
  return { base: r.l, cells, edges };
}

// Place a stamp with its anchor at vertex A (level A.l). Cells that would be
// finer than the finest level are skipped.
export function placeStamp(stamp, A) {
  const cells = [], edges = [];
  for (const [dl, dp, dq, u, c, f] of stamp.cells) {
    const l = A.l + dl;
    if (l > L.MAX_LEVEL) continue;
    const s = 2 ** dl;
    cells.push({ cell: L.mk(l, A.p * s + dp, A.q * s + dq, u), c, f: f || undefined });
  }
  for (const [dl, dp, dq, d, c] of stamp.edges || []) {
    const l = A.l + dl;
    if (l > L.MAX_LEVEL) continue;
    const s = 2 ** dl;
    edges.push({ edge: { l, p: A.p * s + dp, q: A.q * s + dq, d }, c });
  }
  return { cells, edges };
}
