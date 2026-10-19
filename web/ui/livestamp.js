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
import * as ART from '../engine/stampart.js';
import * as SB from '../stampbook.js';
import { $, app, canvas, requestRender, toast } from '../app.js';
import { applyCells, applyEdges, commit, reportSkips } from './tools.js';

// The biggest a stamp grows: about this many cells (the Cat stops at 13×).
export const MAX_CELLS = 20000;

const chosen = () => SB.chosen(app.stampChoice, app.stamps).stamp;
// A starter stamp's id (the art engine/stampart.js draws is by id), or null.
const starterId = () => (app.stampChoice.from === 'starter' ? app.stampChoice.id : null);
// The planes the chosen stamp goes on (none for most), and the one in use: the
// last one picked if this stamp has it, else its own.
export const planes = () => (starterId() ? ART.planesOf(starterId()) : []);
export const planeNow = () => { const ps = planes(); return ps.includes(app.stampPlane) ? app.stampPlane : ps[0] || null; };
// Made once each: a starter stamp on a plane at a size, by "id plane k".
const art = new Map();
const artOf = (id, plane, k) => { const key = `${id} ${plane} ${k}`; if (!art.has(key)) art.set(key, ART.variant(id, plane, k)); return art.get(key); };
const scaledOf = new WeakMap();
// The chosen stamp at 1× on its plane, and at k times.
function base() {
  const plane = planeNow();
  return plane ? artOf(starterId(), plane, 1) : chosen();
}
function sizedAt(k) {
  const plane = planeNow();
  if (plane && ART.drawnAtSize(starterId())) return artOf(starterId(), plane, k);
  const b = base();
  if (!scaledOf.has(b)) scaledOf.set(b, new Map());
  const m = scaledOf.get(b);
  if (!m.has(k)) m.set(k, D.scaleStamp(b, k));
  return m.get(k);
}
// The sizes the stamp has with its anchor at level l, made once per stamp and
// level, and the one nearest the size in use.
const memo = new WeakMap();
function steps(l) {
  const st = base();
  if (!memo.has(st)) memo.set(st, new Map());
  const m = memo.get(st);
  if (!m.has(l)) m.set(l, D.sizeSteps(st, l, MAX_CELLS));
  return m.get(l);
}
const stepAt = (l) => D.nearestStep(steps(l), app.stampSize);
// What the Stamp brush paints with its anchor at vertex A, at the size and on the plane in use.
export function stampAt(A) {
  const { k, j } = stepAt(A.l);
  return D.placeSized(sizedAt(k), A, { k: 1, j });
}
// A size as the bar says it: 1×, 1½×, 2¼×, ¾×.
export function sizeLabel(s) {
  const whole = Math.floor(s), part = { 0.25: '¼', 0.5: '½', 0.75: '¾' }[s - whole] || '';
  return `${whole || !part ? whole : ''}${part}×`;
}

// After a stamp is placed (ui/input.js onUp).
export function startLive(A, erase, diff) {
  app.live = { drawing: app.drawing, A, erase, diff, depth: app.drawing.undoStack.length, choice: JSON.stringify(app.stampChoice) };
  if (!outline(app.live)) { app.live = null; return; }
  if (!app.session.stampTold) { app.session.stampTold = true; toast('Drag the round handle to make the stamp bigger or smaller'); }
  updateStampbar();
}
// The live stamp's 1× outline around its anchor on the plane in use, and the
// handle's corner of it; false when it has no cells.
function outline(v) {
  const { cells } = D.placeStamp(base(), v.A), A = v.A;
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const { cell } of cells) for (const w of L.cellWorldVerts(cell)) { x0 = Math.min(x0, w.x); y0 = Math.min(y0, w.y); x1 = Math.max(x1, w.x); y1 = Math.max(y1, w.y); }
  if (!cells.length) return false;
  const a = L.vertexWorld(A.l, A.p, A.q), box = { x0: x0 - a.x, y0: y0 - a.y, x1: x1 - a.x, y1: y1 - a.y };
  // The handle's corner: the outline's top right, unless another corner is clearly
  // farther from the anchor (a stamp of one's own may be anchored at its top right).
  const corners = [[box.x1, box.y0], [box.x0, box.y0], [box.x1, box.y1], [box.x0, box.y1]], len = ([x, y]) => Math.hypot(x, y);
  v.box = box;
  v.u = corners.reduce((b, c) => (len(c) > len(b) * 1.05 ? c : b));
  return true;
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
  repaint();
}
// The live stamp painted again in place of its undo step, at the size and on the plane in use.
function repaint() {
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

// The next plane the stamp goes on (floor, a wall, upright), for it and the next ones.
const PLANE_SAYS = { upright: 'standing up, facing you', floor: 'the floor', left: 'the left wall', right: 'the right wall' };
export function nextPlane() {
  const ps = planes();
  if (!ps.length) return;
  app.stampPlane = ps[(ps.indexOf(planeNow()) + 1) % ps.length];
  if (stillLive()) { outline(app.live); repaint(); } else updateStampbar();
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
  const plane = planeNow(), pb = $('#stamp-plane');
  pb.hidden = !plane;
  if (plane && pb.dataset.plane !== plane) {
    const ps = planes(), next = ps[(ps.indexOf(plane) + 1) % ps.length];
    pb.dataset.plane = plane;
    pb.innerHTML = PLANE_ICONS[plane];
    pb.setAttribute('aria-label', `On ${PLANE_SAYS[plane]}. Tap for ${PLANE_SAYS[next]}.`);
  }
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
// The plane button's picture: a cube with the face in use filled, or a square facing you.
const CUBE = '<path d="M12 3 20 7.5v9L12 21l-8-4.5v-9ZM12 12v9M12 12 4 7.5M12 12l8-4.5"/>';
const FILL = (d) => `<svg viewBox="0 0 24 24" aria-hidden="true">${CUBE}<path d="${d}" fill="currentColor"/></svg>`;
const PLANE_ICONS = {
  upright: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 4h12v16H6Z" fill="currentColor"/></svg>',
  floor: FILL('M12 3 20 7.5 12 12 4 7.5Z'),
  left: FILL('M4 7.5 12 12v9l-8-4.5Z'),
  right: FILL('M12 12l8-4.5v9L12 21Z'),
};
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
  $('#stamp-plane').addEventListener('click', nextPlane);
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
