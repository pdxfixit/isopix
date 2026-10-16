// Project files: the drawing (cells, edges, hidden children), its undo log
// (which also drives time-lapse replay), and the app settings worth keeping.
// Pure logic, no DOM. Incoming files are untrusted, so load() checks shapes.
import { Drawing } from './model.js';
import * as L from './lattice.js';

export const FORMAT = 'isopix';
// Files saved before the 1.0 rename say 'isogrid'; they still open.
const FORMATS = [FORMAT, 'isogrid'];
export const VERSION = 1;

export function save(drawing, extra = {}) {
  return {
    format: FORMAT,
    version: VERSION,
    seq: drawing.seq,
    paper: drawing.paper === 'dark' ? 'dark' : 'light',
    cells: [...drawing.cells],
    edges: [...drawing.edges],
    hiddenEdges: [...drawing.hiddenEdges],
    // Every hidden entry, stale ones too: undoing the paint that covered them
    // makes them live again, so Finer after a reload still brings the detail back.
    hidden: [...drawing.hidden],
    log: drawing.undoStack,
    redo: drawing.redoStack,
    ...extra,
  };
}

const KEY_RE = /^[0-7],-?\d+,-?\d+,[01]$/;
const EDGE_RE = /^[0-7],-?\d+,-?\d+,[012]$/;
const COLOR_RE = /^#[0-9a-f]{6}$/i;
const okVal = (v) => v && typeof v === 'object' && COLOR_RE.test(v.c) && (!v.f || ['T', 'L', 'R'].includes(v.f));

export function load(obj) {
  if (!obj || !FORMATS.includes(obj.format)) throw new Error('Not an Isopix project file');
  if (typeof obj.version !== 'number' || obj.version > VERSION) throw new Error('This project was made by a newer Isopix');
  const d = new Drawing();
  // Projects saved before papers existed had the light paper: they keep it.
  d.paper = obj.paper === 'dark' ? 'dark' : 'light';
  for (const [k, v] of obj.cells || []) {
    if (!KEY_RE.test(k) || !okVal(v)) throw new Error(`Bad cell ${k}`);
    d.cells.set(k, v);
  }
  for (const [k, v] of obj.edges || []) {
    if (!EDGE_RE.test(k) || !v || !COLOR_RE.test(v.c)) throw new Error(`Bad edge ${k}`);
    d.edges.set(k, v);
  }
  for (const [k, h] of obj.hidden || []) {
    if (!KEY_RE.test(k) || !h || !Array.isArray(h.cells)) continue;
    const kids = new Set(L.children(L.parseKey(k)).map(L.cellKey));
    if (h.cells.every((e) => Array.isArray(e) && kids.has(e[0]) && (e[1] === null || okVal(e[1])))) d.setHidden(k, h);
  }
  // Edges a coarsen hid (files from before 2026-10-12 have none).
  const EKEY = /^(c:[0-7],-?\d+,-?\d+,[01]|e:[0-7],-?\d+,-?\d+,[012])$/;
  const okEdge = (e) => Array.isArray(e) && EDGE_RE.test(e[0]) && (e[1] === null || (e[1] && COLOR_RE.test(e[1].c)));
  for (const [k, h] of Array.isArray(obj.hiddenEdges) ? obj.hiddenEdges : []) {
    if (!EKEY.test(k) || !h) continue;
    if (k.startsWith('c:') && Array.isArray(h.edges) && h.edges.every(okEdge)) d.hiddenEdges.set(k, h);
    if (k.startsWith('e:') && Array.isArray(h.halves) && h.halves.every(okEdge)) d.hiddenEdges.set(k, h);
  }
  d.rebuildSub();
  const bad = d.checkInvariant();
  if (bad) throw new Error(`Project breaks the one-cell-or-children rule: ${bad}`);
  const okDiff = (x) => x && Array.isArray(x.cells) && Array.isArray(x.edges) && Array.isArray(x.hidden);
  d.undoStack = Array.isArray(obj.log) ? obj.log.filter(okDiff) : [];
  d.redoStack = Array.isArray(obj.redo) ? obj.redo.filter(okDiff) : [];
  let maxId = Number(obj.seq) || 0;
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

// The trace picture in a project object, checked (files are untrusted), or null.
export function traceOf(obj) {
  const t = obj && obj.trace;
  if (!t || typeof t.src !== 'string' || !/^data:image\/(png|jpeg|webp|gif);base64,/.test(t.src) || t.src.length > TRACE_MAX_CHARS) return null;
  const r = t.rect;
  if (!r || ![r.x, r.y, r.w, r.h].every(Number.isFinite) || r.w <= 0 || r.h <= 0) return null;
  return { src: t.src, rect: { x: r.x, y: r.y, w: r.w, h: r.h } };
}
