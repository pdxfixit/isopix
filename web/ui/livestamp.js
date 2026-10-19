// A placed stamp stays live, to be sized where it stands (docs/spec-stamp-size-turn.md;
// the owner's pick, 2026-10-19: "place, then adjust"). It is painted and committed
// like any stamp; live only means the stamp bar and the corner handle can redraw it
// at another whole-number size (engine/density.js scaleStamp), replacing its one
// undo step. It stays live while that step is still the last one: the next paint,
// Undo, another tool or another stamp ends it by themselves, and panning or
// zooming does not. The size is kept for the next stamp.
//
// app.live: {drawing, A, erase, diff, depth, choice, box, u}: its drawing, the anchor
// vertex, eraser or not, its undo step (null when it changed nothing) and the stack's length after it,
// the stamp it is (app.stampChoice), its 1× outline around A and the handle's
// corner of it, in world units.

import * as L from '../engine/lattice.js';
import * as D from '../engine/density.js';
import * as SB from '../stampbook.js';
import { $, app, canvas, requestRender, toast } from '../app.js';
import { applyCells, applyEdges, commit, reportSkips } from './tools.js';

// The biggest a stamp grows: about this many cells (the Cat stops at 13×).
export const MAX_CELLS = 20000;

const chosen = () => SB.chosen(app.stampChoice, app.stamps).stamp;
export const maxSize = (stamp) => Math.max(1, Math.floor(Math.sqrt(MAX_CELLS / Math.max(1, stamp.cells.length + (stamp.edges || []).length))));

// The chosen stamp at size k, made once per stamp and size.
const scaled = new WeakMap();
function sized(stamp, k) {
  if (!scaled.has(stamp)) scaled.set(stamp, new Map());
  const m = scaled.get(stamp);
  if (!m.has(k)) m.set(k, D.scaleStamp(stamp, k));
  return m.get(k);
}
// What the Stamp brush paints with its anchor at vertex A, at the size in use.
export function stampAt(A) {
  const st = chosen();
  return D.placeStamp(sized(st, Math.min(app.stampSize, maxSize(st))), A);
}

// After a stamp is placed (ui/input.js onUp).
export function startLive(A, erase, diff) {
  const { cells } = D.placeStamp(chosen(), A);
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const { cell } of cells) for (const w of L.cellWorldVerts(cell)) { x0 = Math.min(x0, w.x); y0 = Math.min(y0, w.y); x1 = Math.max(x1, w.x); y1 = Math.max(y1, w.y); }
  if (!cells.length) return;
  const a = L.vertexWorld(A.l, A.p, A.q), box = { x0: x0 - a.x, y0: y0 - a.y, x1: x1 - a.x, y1: y1 - a.y };
  // The handle's corner: the outline's top right, unless another corner is clearly
  // farther from the anchor (a stamp of one's own may be anchored at its top right).
  const corners = [[box.x1, box.y0], [box.x0, box.y0], [box.x1, box.y1], [box.x0, box.y1]], len = ([x, y]) => Math.hypot(x, y);
  const far = corners.reduce((b, c) => (len(c) > len(b) * 1.05 ? c : b));
  app.live = { drawing: app.drawing, A, erase, diff, depth: app.drawing.undoStack.length, choice: JSON.stringify(app.stampChoice), box, u: far };
  if (!app.session.stampTold) { app.session.stampTold = true; toast('Drag the round handle to make the stamp bigger or smaller'); }
  updateStampbar();
}

// Whether the live stamp is still the last thing done, with its brush in hand.
function stillLive() {
  const v = app.live, s = app.settings, d = app.drawing;
  if (!v) return false;
  return v.drawing === d && s.brush === 'stamp' && s.tool === (v.erase ? 'eraser' : 'pencil') && !d.inTx && !app.replaying
    && d.undoStack.length === v.depth && (!v.diff || d.undoStack[d.undoStack.length - 1] === v.diff)
    && JSON.stringify(app.stampChoice) === v.choice;
}
export function endLive() {
  if (!app.live) return;
  app.live = null;
  updateStampbar();
  requestRender();
}

// Size k for the next stamp, and for the live one: its undo step is taken back
// and it is painted again from the stamp itself, so no size loses detail.
export function setStampSize(k) {
  if (!Number.isFinite(k)) return;
  const max = maxSize(chosen());
  k = Math.max(1, Math.min(max, k));
  const live = stillLive();
  if (k === app.stampSize && live) return;
  app.stampSize = k;
  if (!live) { app.live = null; updateStampbar(); toast(`Stamp size ${k}×`); return; }
  const v = app.live, d = app.drawing;
  if (v.diff) { d.undo(); d.redoStack.pop(); }
  app.strokeSkips.clear();
  d.begin('stamp');
  const { cells, edges } = stampAt(v.A);
  applyCells(cells, v.erase);
  if (!v.erase) for (const { edge, c } of edges) applyEdges([edge], c);
  v.diff = commit(); // afterChange: autosave, Undo's state, a render
  v.depth = d.undoStack.length;
  reportSkips();
  if (navigator.vibrate) navigator.vibrate(10);
  updateStampbar();
}

// The bar and the handle follow the live stamp; called on every render.
export function updateStampbar() {
  if (app.live && !stillLive()) app.live = null;
  const v = app.live, bar = $('#stampbar'), h = $('#stamp-handle');
  if (bar.hidden !== !v) bar.hidden = !v;
  if (!v) { h.hidden = true; return; }
  const k = app.stampSize, max = maxSize(chosen());
  const label = `${k}×`;
  if ($('#stamp-size').textContent !== label) {
    $('#stamp-size').textContent = label;
    $('#stamp-size').setAttribute('aria-label', `Stamp size: ${k} times`);
    h.setAttribute('aria-valuenow', String(k));
  }
  h.setAttribute('aria-valuemax', String(max));
  $('#stamp-smaller').disabled = k <= 1;
  $('#stamp-bigger').disabled = k >= max;
  if (!h.classList.contains('dragging')) {
    // Just outside the stamp's corner, kept on screen, above the bars and off the
    // buttons and rails (a big stamp's corner may be under them, or off the screen).
    const [cx, cy] = app.view.toScreen(...corner(v, k)), n = Math.hypot(...v.u) || 1;
    const above = [bar, $('#update-bar')].map((el) => el.getBoundingClientRect()).filter((r) => r.height);
    const floor = above.length ? Math.min(...above.map((r) => r.top)) - 30 : app.view.h - 200;
    let x = Math.max(30, Math.min(app.view.w - 30, cx + (16 * v.u[0]) / n)), y = Math.max(30, Math.min(floor, cy + (16 * v.u[1]) / n));
    [x, y] = clearOf(['.topleft', '.topright', '#levels', '#zoom'], x, y);
    h.style.left = `${x}px`; h.style.top = `${Math.min(floor, y)}px`;
  }
  h.hidden = false;
}
// A 44 px knob centered at (x, y), moved the shortest way off any of the
// controls it would cover: below a top cluster, or toward the middle off a rail.
function clearOf(sels, x, y) {
  const rects = sels.map((sel) => document.querySelector(sel)?.getBoundingClientRect()).filter((r) => r && r.width && r.height);
  for (let pass = 0; pass < 2; pass++) {
    for (const r of rects) {
      if (x + 26 < r.left || x - 26 > r.right || y + 26 < r.top || y - 26 > r.bottom) continue;
      const side = (r.left + r.right) / 2 < innerWidth / 2 ? r.right + 26 - x : r.left - 26 - x, down = r.bottom + 26 - y;
      if (Math.abs(down) < Math.abs(side)) y += down; else x += side;
    }
  }
  return [x, y];
}
// The handle's corner of the outline at size k, in world units.
function corner(v, k) {
  const a = L.vertexWorld(v.A.l, v.A.p, v.A.q);
  return [a.x + k * v.u[0], a.y + k * v.u[1]];
}
// The live stamp's outline at the size in use, in world units, for render.js.
export function liveBox() {
  const v = app.live;
  if (!v) return null;
  const a = L.vertexWorld(v.A.l, v.A.p, v.A.q), k = app.stampSize;
  return { x0: a.x + k * v.box.x0, y0: a.y + k * v.box.y0, x1: a.x + k * v.box.x1, y1: a.y + k * v.box.y1 };
}

export function wireLiveStamp() {
  $('#stamp-smaller').addEventListener('click', () => setStampSize(app.stampSize - 1));
  $('#stamp-bigger').addEventListener('click', () => setStampSize(app.stampSize + 1));
  $('#stamp-done').addEventListener('click', endLive);
  // The handle: moving the finger one corner's length along the line from the
  // anchor through the 1× corner is one size, counted from where it was grabbed
  // (a handle kept on screen or off a rail is not on the corner itself).
  const h = $('#stamp-handle');
  let grab = null;
  const along = (e) => {
    const v = app.live, r = canvas.getBoundingClientRect();
    const [wx, wy] = app.view.toWorld(e.clientX - r.left, e.clientY - r.top);
    const a = L.vertexWorld(v.A.l, v.A.p, v.A.q), [ux, uy] = v.u;
    return ((wx - a.x) * ux + (wy - a.y) * uy) / (ux * ux + uy * uy);
  };
  h.addEventListener('pointerdown', (e) => {
    e.stopPropagation();
    if (!stillLive()) return;
    try { h.setPointerCapture(e.pointerId); } catch { /* synthetic */ }
    h.classList.add('dragging');
    grab = { t: along(e), k: app.stampSize };
  });
  h.addEventListener('pointermove', (e) => {
    if (!app.live || !grab || !h.classList.contains('dragging')) return;
    h.style.left = `${e.clientX}px`; h.style.top = `${e.clientY}px`;
    const k = Math.round(grab.k + along(e) - grab.t);
    if (k !== app.stampSize) setStampSize(k);
  });
  const drop = () => { grab = null; h.classList.remove('dragging'); updateStampbar(); };
  h.addEventListener('pointerup', drop);
  h.addEventListener('pointercancel', drop);
  h.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowUp' || e.key === 'ArrowRight') { e.preventDefault(); setStampSize(app.stampSize + 1); }
    if (e.key === 'ArrowDown' || e.key === 'ArrowLeft') { e.preventDefault(); setStampSize(app.stampSize - 1); }
  });
}
