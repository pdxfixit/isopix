// A placed stamp stays live, to be sized where it stands (docs/spec-stamp-size-turn.md;
// the owner's pick, 2026-10-19: "place, then adjust"). It is painted and committed
// like any stamp; live only means the stamp bar and the corner handle can redraw it
// at another size, replacing its one undo step. Sizes go in quarter steps while the
// stamp is small, then halves, then whole steps; an in-between size is made of finer
// cells, so every edge stays clean (owner, 2026-10-19; engine/density.js sizeSteps). It stays live while that step is still the last one: the next paint,
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
// The sizes the chosen stamp has with its anchor at level l, made once per stamp
// and level, and the one nearest the size in use.
const memo = new WeakMap();
function steps(l) {
  const st = chosen();
  if (!memo.has(st)) memo.set(st, new Map());
  const m = memo.get(st);
  if (!m.has(l)) m.set(l, D.sizeSteps(st, l, MAX_CELLS));
  return m.get(l);
}
const stepAt = (l) => D.nearestStep(steps(l), app.stampSize);
// What the Stamp brush paints with its anchor at vertex A, at the size in use.
export function stampAt(A) {
  return D.placeSized(chosen(), A, stepAt(A.l));
}
// A size as the bar says it: 1×, 1½×, 2¼×, ¾×.
export function sizeLabel(s) {
  const whole = Math.floor(s), part = { 0.25: '¼', 0.5: '½', 0.75: '¾' }[s - whole] || '';
  return `${whole || !part ? whole : ''}${part}×`;
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

// The size nearest s, for the next stamp and the live one: its undo step is taken
// back and it is painted again from the stamp itself, so no size loses detail.
export function setStampSize(s) {
  if (!Number.isFinite(s)) return;
  const live = stillLive(), to = D.nearestStep(steps(live ? app.live.A.l : app.level), s).s;
  if (to === app.stampSize && live) return;
  app.stampSize = to;
  if (!live) { app.live = null; updateStampbar(); toast(`Stamp size ${sizeLabel(to)}`); return; }
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

// One size up (d = 1) or down (-1) from the one in use.
export function stepStampSize(d) {
  const list = steps(stillLive() ? app.live.A.l : app.level), i = list.indexOf(D.nearestStep(list, app.stampSize));
  setStampSize(list[Math.max(0, Math.min(list.length - 1, i + d))].s);
}

// The bar and the handle follow the live stamp; called on every render.
export function updateStampbar() {
  if (app.live && !stillLive()) app.live = null;
  const v = app.live, bar = $('#stampbar'), h = $('#stamp-handle');
  if (bar.hidden !== !v) bar.hidden = !v;
  if (!v) { h.hidden = true; return; }
  const list = steps(v.A.l), k = stepAt(v.A.l).s, label = sizeLabel(k);
  if ($('#stamp-size').textContent !== label) {
    $('#stamp-size').textContent = label;
    $('#stamp-size').setAttribute('aria-label', `Stamp size: ${k} times`);
    h.setAttribute('aria-valuenow', String(k));
    h.setAttribute('aria-valuetext', label);
  }
  h.setAttribute('aria-valuemin', String(list[0].s));
  h.setAttribute('aria-valuemax', String(list.at(-1).s));
  $('#stamp-smaller').disabled = k <= list[0].s;
  $('#stamp-bigger').disabled = k >= list.at(-1).s;
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
// A 44 px knob centered at (x, y), moved to the nearest spot on screen that covers
// none of the controls: beside or below each one it would cover, three times over (a gap
// between two clusters may be too narrow for it, so it goes below them).
function clearOf(sels, x, y) {
  const rects = sels.map((sel) => document.querySelector(sel)?.getBoundingClientRect()).filter((r) => r && r.width && r.height);
  const covers = (cx, cy) => rects.filter((r) => !(cx + 26 < r.left || cx - 26 > r.right || cy + 26 < r.top || cy - 26 > r.bottom));
  let spots = [[x, y]];
  for (let pass = 0; pass < 3; pass++) {
    spots = spots.concat(spots.flatMap(([cx, cy]) => covers(cx, cy).flatMap((r) => [[r.right + 28, cy], [r.left - 28, cy], [cx, r.bottom + 28]])));
  }
  const ok = spots.filter(([cx, cy]) => cx >= 26 && cx <= innerWidth - 26 && !covers(cx, cy).length);
  return ok.length ? ok.reduce((b, c) => (Math.hypot(c[0] - x, c[1] - y) < Math.hypot(b[0] - x, b[1] - y) ? c : b)) : [x, y];
}
// The handle's corner of the outline at size k (any number), in world units.
function corner(v, k) {
  const a = L.vertexWorld(v.A.l, v.A.p, v.A.q);
  return [a.x + k * v.u[0], a.y + k * v.u[1]];
}
// The live stamp's outline at the size in use, in world units, for render.js.
export function liveBox() {
  const v = app.live;
  if (!v) return null;
  const a = L.vertexWorld(v.A.l, v.A.p, v.A.q), k = stepAt(v.A.l).s;
  return { x0: a.x + k * v.box.x0, y0: a.y + k * v.box.y0, x1: a.x + k * v.box.x1, y1: a.y + k * v.box.y1 };
}

export function wireLiveStamp() {
  $('#stamp-smaller').addEventListener('click', () => stepStampSize(-1));
  $('#stamp-bigger').addEventListener('click', () => stepStampSize(1));
  $('#stamp-done').addEventListener('click', endLive);
  // The handle: moving the finger one corner's length along the line from the
  // anchor through the 1× corner is 1× more, counted from where it was grabbed (a
  // handle kept on screen or off a rail is not on the corner itself); the size is
  // the step nearest that.
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
    grab = { t: along(e), s: stepAt(app.live.A.l).s };
  });
  h.addEventListener('pointermove', (e) => {
    if (!app.live || !grab || !h.classList.contains('dragging')) return;
    h.style.left = `${e.clientX}px`; h.style.top = `${e.clientY}px`;
    setStampSize(grab.s + along(e) - grab.t);
  });
  const drop = () => { grab = null; h.classList.remove('dragging'); updateStampbar(); };
  h.addEventListener('pointerup', drop);
  h.addEventListener('pointercancel', drop);
  h.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowUp' || e.key === 'ArrowRight') { e.preventDefault(); stepStampSize(1); }
    if (e.key === 'ArrowDown' || e.key === 'ArrowLeft') { e.preventDefault(); stepStampSize(-1); }
  });
}
