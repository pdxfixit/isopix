// Selection regions and density change: refine (lossless) and coarsen
// (Crisp majority or Blend in Oklab), with hidden children kept so refining
// again restores them exactly. Also stamps (a selection saved as a brush).
// Pure logic, no DOM. All changes go through the Drawing primitives, so the
// caller wraps them in a transaction and undo reverses them.
//
// A region is {l, keys: Set<cellKey>}: lattice cells at the marquee level.
import * as L from './lattice.js';
import { mixOklab, nearest, shade, baseOf } from './color.js';
import * as S from './symmetry.js';

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

// ---------- rotate and flip ----------
// Turn what is inside the selection by a lattice symmetry g ({k: sixths of a
// turn, m: mirror first}; engine/symmetry.js) about a vertex `center` at the
// region's level: erased, then painted turned, exactly; face tags and bold
// edges follow. A mirror swaps the side a shaded face was lit from, so Relight
// can light it back. Cells landing outside paint over what is there, as any
// paint does. Returns the turned region.
export function transformRegion(drawing, r, center, g) {
  splitBorder(drawing, r);
  const cells = paintedIn(drawing, r).map((c) => ({ c, v: drawing.cells.get(L.cellKey(c)) }));
  const edges = edgesIn(drawing, r).map((e) => ({ e, v: drawing.edges.get(L.edgeKey(e)) }));
  eraseRegion(drawing, r);
  for (const { c, v } of cells) {
    const f = S.transformFace(v.f, g);
    const lit = (v.s === 'r') !== (g.m && f !== 'T') ? 'r' : undefined;
    const spec = f ? { c: v.c, f, s: lit, b: v.b } : { c: v.c };
    for (const t of S.transformCell(c, center, g)) drawing.paint(t, spec, 'replace');
  }
  for (const { e, v } of edges) for (const t of S.transformEdge(e, center, g)) drawing.setEdge(L.edgeKey(t), v);
  return makeRegion(r.l, regionCells(r).flatMap((c) => S.transformCell(c, center, g)));
}

// ---------- bigger and smaller ----------
// Scale what is inside the selection by 2 (dir +1, Bigger) or 1/2 (dir -1,
// Smaller) about the vertex at the middle of the bottom of what is painted in
// it, so a stamp stays standing where it was: every cell moves one level
// coarser or finer, keeping its place relative to that vertex, which is exact
// because scaling by 2 about a vertex maps one level's lattice onto the next. Face tags, lit sides and
// bold edges follow. Smaller first coarsens detail at the finest level (opts
// as changeDensity), since nothing is finer. Cells landing outside paint over
// what is there, as Turn does. Returns the scaled region, or null when it
// cannot go further (Bigger from level 0, Smaller from the finest level).
export function scaleRegion(drawing, r, dir, opts = {}) {
  if (dir > 0 ? r.l <= 0 : r.l >= L.MAX_LEVEL) return null;
  if (dir < 0 && densityOf(drawing, r) >= L.MAX_LEVEL) changeDensity(drawing, r, L.MAX_LEVEL - 1, opts);
  splitBorder(drawing, r);
  // Painted cells coarser than the marquee split down to it, so every level moved is on the pivot's lattice.
  for (const key of r.keys) {
    const c = L.parseKey(key), anc = drawing.paintedAncestor(c);
    if (anc && anc.cell.l < r.l) drawing.splitDownTo(c);
  }
  const painted = paintedIn(drawing, r);
  const home = r.home || bottomMiddle(painted.length ? painted : regionCells(r));
  const V = pivotAt(home, dir > 0 ? r.l - 1 : r.l);
  const at = (k) => 2 ** (k - V.l);
  // A cell or edge, moved a level with its place relative to V kept.
  const move = (o) => ({ ...o, l: o.l - dir, p: V.p * at(o.l - dir) + o.p - V.p * at(o.l), q: V.q * at(o.l - dir) + o.q - V.q * at(o.l) });
  const cells = painted.map((c) => ({ c, v: drawing.cells.get(L.cellKey(c)) }));
  const edges = edgesIn(drawing, r).map((e) => ({ e, v: drawing.edges.get(L.edgeKey(e)) }));
  eraseRegion(drawing, r);
  for (const { c, v } of cells) drawing.paint(move(c), v.f ? { c: v.c, f: v.f, s: v.s, b: v.b } : { c: v.c }, 'replace');
  for (const { e, v } of edges) drawing.setEdge(L.edgeKey(move(e)), v);
  // The region keeps its home point: each level's pivot comes from it the same
  // way, so every Bigger is undone exactly by a Smaller, however many in a row.
  return { ...makeRegion(r.l - dir, regionCells(r).map(move)), home };
}
// The middle of the bottom of `cells`, a point in world units.
function bottomMiddle(cells) {
  const vs = cells.flatMap(L.cellWorldVerts), xs = vs.map((w) => w.x);
  return { x: (Math.min(...xs) + Math.max(...xs)) / 2, y: Math.max(...vs.map((w) => w.y)) };
}
// The level-lv vertex for the home point: on its row (rows are half an edge
// apart, so a bottom on the grid stays exactly where it was), nearest it
// across, which may be off by up to one level-lv edge.
function pivotAt(home, lv) {
  const s = L.edgeLen(lv), mid = home.x / (L.H * s);
  const K = Math.round((2 * home.y) / s); // 2p + q, from y = (p + q/2)·s
  let q = Math.round(mid);
  if ((K - q) % 2) q += mid > q ? 1 : -1;
  return { l: lv, p: (K - q) / 2, q };
}

// Relight: every shaded cell in the region shaded again for `light`, from
// the base color its tone says it was painted with (color.js baseOf).
export function relightRegion(drawing, r, light) {
  splitBorder(drawing, r);
  let n = 0;
  for (const c of paintedIn(drawing, r)) {
    const v = drawing.cells.get(L.cellKey(c));
    if (!v.f || v.f === 'T') continue; // a top face looks the same from either side
    const was = v.s === 'r' ? 'right' : 'left';
    if (was === light) continue;
    // The base color the cell keeps; a cell painted before it kept one: worked back from its tone.
    const base = v.b || baseOf(v.c, v.f, was);
    drawing.paint(c, { c: shade(base, v.f, light), f: v.f, s: light === 'right' ? 'r' : undefined, b: base }, 'replace');
    n++;
  }
  return n;
}

// The pivot: the region-level vertex nearest the region's middle (a hexagon
// selection's own center, so it turns in place).
export function pivotOf(r) {
  const ws = regionCells(r).map((c) => L.centroid(c));
  const x = ws.reduce((a, w) => a + w.x, 0) / ws.length, y = ws.reduce((a, w) => a + w.y, 0) / ws.length;
  return L.nearestVertex(r.l, x, y);
}
// One turn clockwise on screen, and a left-right flip.
export const TURN = { k: 1, m: false }; // symmetry.rot sends up (-1, 0) to up-right (-1, 1): clockwise
export const FLIP = { k: 0, m: true };

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

// A stamp k times as big (k a whole number), about its anchor, at the same
// levels: exact on the lattice. An up cell (corners (p, q), (p+1, q), (p, q+1))
// becomes the side-k triangle from (kp, kq), tiled by the up cells (kp+i, kq+j)
// with i+j < k and the down cells with i+j < k-1; a down cell becomes the
// side-k triangle across from it, tiled the other way round. k² cells each;
// an edge becomes k edges along its line.
export function scaleStamp(stamp, k) {
  if (!(Number.isInteger(k) && k >= 1)) throw new Error(`a stamp scales by a whole number, not ${k}`);
  if (k === 1) return stamp;
  const cells = [];
  for (const [dl, dp, dq, u, c, f] of stamp.cells) {
    for (let i = 0; i < k; i++) {
      for (let j = 0; j < k; j++) {
        // In the scaled triangle: an up cell's (i, j) under its hypotenuse, a down cell's over it.
        if (u ? i + j <= k - 1 : i + j >= k - 1) cells.push([dl, k * dp + i, k * dq + j, u, c, f]);
        if (u ? i + j <= k - 2 : i + j >= k) cells.push([dl, k * dp + i, k * dq + j, 1 - u, c, f]);
      }
    }
  }
  const edges = [];
  for (const [dl, dp, dq, d, c] of stamp.edges || []) {
    const [ep, eq] = L.DIRS[d];
    for (let t = 0; t < k; t++) edges.push([dl, k * dp + t * ep, k * dq + t * eq, d, c]);
  }
  return { ...stamp, cells, edges };
}
// How many cells a stamp has, so the app can cap how big it grows.
export const stampSize = (stamp) => stamp.cells.length;

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
