// Project files: the drawing (cells, edges, hidden children), its undo log
// (which also drives time-lapse replay), and the app settings worth keeping.
// Pure logic, no DOM. Incoming files are untrusted, so load() checks shapes.
import { Drawing } from './model.js';
import * as L from './lattice.js';

export const FORMAT = 'isopix';
export const VERSION = 1; // the Isopix file format, spec 1.0 (spec/README.md)

const isObj = (x) => !!x && typeof x === 'object' && !Array.isArray(x);
const KEY_RE = /^[0-7],-?\d+,-?\d+,[01]$/;
const EDGE_RE = /^[0-7],-?\d+,-?\d+,[012]$/;
const COLOR_RE = /^#[0-9a-f]{6}$/i;
const okVal = (v) => v && typeof v === 'object' && COLOR_RE.test(v.c) && (!v.f || ['T', 'L', 'R'].includes(v.f))
  && (v.b === undefined || COLOR_RE.test(v.b)) && (v.s === undefined || v.s === 'r');
export const NOT_ISOPIX = 'this is not an Isopix drawing, or it is damaged';

// A drawing as a document (spec 1.0): `picture`, all a reader needs to draw
// it (name, paper, cells and edges as key → color), and `app`, Isopix's own
// state. `extra` (name, view, stamps, symmetry, trace, savedAt) is the app's.
export function save(drawing, extra = {}) {
  const { name, ...rest } = extra;
  const cells = {}, ids = {}, faces = {}, edges = {}, edgeTimes = {};
  for (const [k, v] of drawing.cells) {
    cells[k] = v.c;
    ids[k] = [v.t, v.id];
    if (v.f) faces[k] = { f: v.f, ...(v.s ? { s: v.s } : {}), ...(v.b ? { b: v.b } : {}) };
  }
  for (const [k, v] of drawing.edges) { edges[k] = v.c; if (Number.isFinite(v.t)) edgeTimes[k] = v.t; }
  return {
    format: FORMAT,
    version: VERSION,
    picture: { ...(typeof name === 'string' ? { name } : {}), paper: drawing.paper === 'dark' ? 'dark' : 'light', cells, edges },
    app: {
      light: drawing.light === 'right' ? 'right' : 'left',
      seq: drawing.seq, ids, faces, edgeTimes,
      // Every hidden entry, stale ones too: undoing the paint that covered them
      // makes them live again, so Finer after a reload still brings the detail back.
      hidden: [...drawing.hidden],
      hiddenEdges: [...drawing.hiddenEdges],
      log: drawing.undoStack,
      redo: drawing.redoStack,
      ...rest,
    },
  };
}

// TEMPORARY, to remove on or after 2026-10-23 (TODO.md): the layout Isopix
// saved in before spec 1.0 (flat; cells and edges as [key, value] lists), as
// a spec document. Only so drawings already in browsers and arriving from the
// old addresses keep opening; it is not part of the spec.
export function fromOldLayout(obj) {
  if (!isObj(obj) || isObj(obj.picture) || !['isopix', 'isogrid'].includes(obj.format) || !Array.isArray(obj.cells)) return obj;
  const cells = {}, ids = {}, faces = {}, edges = {}, edgeTimes = {};
  for (const e of obj.cells) {
    if (!Array.isArray(e) || !okVal(e[1])) throw new Error(`${NOT_ISOPIX} (bad cell ${e?.[0]})`);
    const [k, v] = e;
    cells[k] = v.c; ids[k] = [v.t, v.id];
    if (v.f) faces[k] = { f: v.f, ...(v.b ? { b: v.b } : {}), ...(v.s ? { s: v.s } : {}) };
  }
  for (const e of Array.isArray(obj.edges) ? obj.edges : []) {
    if (!Array.isArray(e) || !e[1] || !COLOR_RE.test(e[1].c)) throw new Error(`${NOT_ISOPIX} (bad edge ${e?.[0]})`);
    edges[e[0]] = e[1].c; if (Number.isFinite(e[1].t)) edgeTimes[e[0]] = e[1].t;
  }
  const { format, version, cells: _c, edges: _e, name, paper, light, ...app } = obj;
  return {
    format: FORMAT, version: VERSION,
    picture: { ...(typeof name === 'string' ? { name } : {}), paper: paper === 'dark' ? 'dark' : 'light', cells, edges },
    app: { ...app, light: light === 'right' ? 'right' : 'left', ids, faces, edgeTimes },
  };
}

// The app's fields of a saved drawing (either layout): name, when it was
// saved, the view, stamps, symmetry, trace picture and undo history.
export function meta(obj) {
  const doc = fromOldLayoutSafe(obj);
  const a = isObj(doc?.app) ? doc.app : {};
  return {
    name: typeof doc?.picture?.name === 'string' ? doc.picture.name : undefined,
    savedAt: Number.isFinite(a.savedAt) ? a.savedAt : null,
    view: a.view, stamps: a.stamps, symmetry: a.symmetry, trace: a.trace,
    log: Array.isArray(a.log) ? a.log : [],
  };
}
function fromOldLayoutSafe(obj) { try { return fromOldLayout(obj); } catch { return null; } }

// A saved drawing (either layout) under another name, as a spec document.
export function withName(obj, name) {
  const doc = fromOldLayout(obj);
  return { ...doc, picture: { ...doc.picture, name } };
}

// True when a saved drawing (either layout) has anything in it.
export function hasContent(obj) {
  const doc = fromOldLayoutSafe(obj);
  if (!isObj(doc?.picture)) return false;
  return Object.keys(doc.picture.cells || {}).length + Object.keys(doc.picture.edges || {}).length + meta(doc).log.length > 0;
}

// A document → a Drawing. Files are untrusted: every shape is checked, and
// anything that is not an Isopix drawing gets one plain message (NOT_ISOPIX).
export function load(input) {
  const obj = fromOldLayout(input);
  if (!isObj(obj) || obj.format !== FORMAT || !isObj(obj.picture)) throw new Error(NOT_ISOPIX);
  if (typeof obj.version !== 'number' || obj.version > VERSION) throw new Error('This drawing was made by a newer Isopix: reload the app to update it');
  const pic = obj.picture, app = isObj(obj.app) ? obj.app : {};
  const d = new Drawing();
  d.paper = pic.paper === 'dark' ? 'dark' : 'light';
  d.light = app.light === 'right' ? 'right' : 'left';
  const ids = isObj(app.ids) ? app.ids : {}, faces = isObj(app.faces) ? app.faces : {}, times = isObj(app.edgeTimes) ? app.edgeTimes : {};
  let maxId = Number(app.seq) || 0;
  const fresh = [];
  for (const [k, c] of Object.entries(isObj(pic.cells) ? pic.cells : {})) {
    if (!KEY_RE.test(k) || typeof c !== 'string' || !COLOR_RE.test(c)) throw new Error(`${NOT_ISOPIX} (bad cell ${k})`);
    // The fields in the order painting makes them (model.js makeValue): c, t, id, f, s, b.
    const id = ids[k], has = Array.isArray(id) && Number.isFinite(id[0]) && Number.isFinite(id[1]);
    const v = { c, t: has ? id[0] : 0, id: has ? id[1] : 0 };
    const fc = faces[k];
    if (isObj(fc)) { if (fc.f !== undefined) v.f = fc.f; if (fc.s !== undefined) v.s = fc.s; if (fc.b !== undefined) v.b = fc.b; }
    if (!okVal(v)) throw new Error(`${NOT_ISOPIX} (bad cell ${k})`);
    if (has) maxId = Math.max(maxId, v.t, v.id); else fresh.push(v);
    d.cells.set(k, v);
  }
  // A drawing written by another program has no ids: it gets fresh ones.
  for (const v of fresh) { v.id = ++maxId; v.t = v.id; }
  for (const [k, c] of Object.entries(isObj(pic.edges) ? pic.edges : {})) {
    if (!EDGE_RE.test(k) || typeof c !== 'string' || !COLOR_RE.test(c)) throw new Error(`${NOT_ISOPIX} (bad edge ${k})`);
    d.edges.set(k, { c, t: Number.isFinite(times[k]) ? times[k] : ++maxId });
  }
  for (const [k, h] of Array.isArray(app.hidden) ? app.hidden : []) {
    if (!KEY_RE.test(k) || !h || !Array.isArray(h.cells)) continue;
    const kids = new Set(L.children(L.parseKey(k)).map(L.cellKey));
    if (h.cells.every((e) => Array.isArray(e) && kids.has(e[0]) && (e[1] === null || okVal(e[1])))) d.setHidden(k, h);
  }
  // Edges a coarsen hid.
  const EKEY = /^(c:[0-7],-?\d+,-?\d+,[01]|e:[0-7],-?\d+,-?\d+,[012])$/;
  const okEdge = (e) => Array.isArray(e) && EDGE_RE.test(e[0]) && (e[1] === null || (e[1] && COLOR_RE.test(e[1].c)));
  for (const [k, h] of Array.isArray(app.hiddenEdges) ? app.hiddenEdges : []) {
    if (!EKEY.test(k) || !h) continue;
    if (k.startsWith('c:') && Array.isArray(h.edges) && h.edges.every(okEdge)) d.hiddenEdges.set(k, h);
    if (k.startsWith('e:') && Array.isArray(h.halves) && h.halves.every(okEdge)) d.hiddenEdges.set(k, h);
  }
  d.rebuildSub();
  const bad = d.checkInvariant();
  if (bad) throw new Error(`${NOT_ISOPIX} (two cells cover the same place: ${bad})`);
  const okDiff = (x) => x && Array.isArray(x.cells) && Array.isArray(x.edges) && Array.isArray(x.hidden);
  d.undoStack = Array.isArray(app.log) ? app.log.filter(okDiff) : [];
  d.redoStack = Array.isArray(app.redo) ? app.redo.filter(okDiff) : [];
  for (const v of d.cells.values()) maxId = Math.max(maxId, v.id || 0, v.t || 0);
  d.seq = maxId;
  return d;
}

// Time-lapse: the drawing's states from empty, one per logged step.
export function* replay(log) {
  const d = new Drawing();
  yield d;
  for (const step of log) { d.applyDiff(step, 2); yield d; }
}

export const levelsUsed = (drawing) => {
  const s = new Set();
  for (const k of drawing.cells.keys()) s.add(L.parseKey(k).l);
  return [...s].sort();
};

// ---------- the trace picture ----------
// Saved with the drawing (owner, 2026-10-12) as a data URL and its place in
// world units. A very large photo is made smaller first, so files stay light.
export const TRACE_MAX_PX = 2048;
export const TRACE_MAX_CHARS = 16 * 1024 * 1024;

// Size to draw a w x h picture so its long side is at most max. Pure.
export function fitWithin(w, h, max = TRACE_MAX_PX) {
  const k = Math.min(1, max / Math.max(w, h));
  return { w: Math.max(1, Math.round(w * k)), h: Math.max(1, Math.round(h * k)), scaled: k < 1 };
}

// The trace picture in a saved drawing, checked (files are untrusted), or null.
export function traceOf(obj) {
  const t = meta(obj).trace;
  if (!t || typeof t.src !== 'string' || !/^data:image\/(png|jpeg|webp|gif);base64,/.test(t.src) || t.src.length > TRACE_MAX_CHARS) return null;
  const r = t.rect;
  if (!r || ![r.x, r.y, r.w, r.h].every(Number.isFinite) || r.w <= 0 || r.h <= 0) return null;
  return { src: t.src, rect: { x: r.x, y: r.y, w: r.w, h: r.h } };
}
