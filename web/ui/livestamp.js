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
import * as M from '../engine/stampmodels.js';
import { poseAt, poseAngle } from '../engine/brushes.js';
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
// The quarter turns the chosen stamp is spun (Spin; 3D stamps only), and it spun, made once each.
const spinNow = () => (starterId() && M.spins(starterId()).length ? app.stampSpin % 4 : 0);
const spunOf = new Map();
const spunAt = (id, n) => { const key = `${id} ${n}`; if (!spunOf.has(key)) spunOf.set(key, M.spun(id, n)); return spunOf.get(key); };
// The chosen stamp at 1× on its plane or spun, and at k times.
function base() {
  const plane = planeNow(), spin = spinNow();
  return plane ? artOf(starterId(), plane, 1) : spin ? spunAt(starterId(), spin) : chosen();
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
  // A stamp with detail by size goes in half steps from ART.DETAIL up, the sizes its
  // fine detail lands on the grid at (quarter steps between would drop it).
  if (!m.has(l)) m.set(l, D.sizeSteps(st, l, MAX_CELLS).filter((x) => !detailed() || x.s < ART.DETAIL || Number.isInteger(x.s * 2)));
  return m.get(l);
}
// Whether the chosen stamp is a box stamp with detail by size (engine/stampmodels.js tiered).
const detailed = () => !!starterId() && !planeNow() && M.tiered(starterId());
// A box stamp with detail at a size step, drawn for that size: {stamp, j}, made once each.
const tieredOf = new Map();
function tieredAt(step, l) {
  const key = `${starterId()} ${spinNow()} ${step.s} ${l}`;
  if (!tieredOf.has(key)) {
    let got = M.spunAtSize(starterId(), spinNow(), step, Math.max(step.j, Math.min(2, L.MAX_LEVEL - l)));
    // Detail on finer cells multiplies them by 4 a level: past twice the cap, the plainer tier.
    if (got.stamp.cells.length > 2 * MAX_CELLS) got = M.spunAtSize(starterId(), spinNow(), step, step.j);
    tieredOf.set(key, got);
  }
  return tieredOf.get(key);
}
const stepAt = (l) => D.nearestStep(steps(l), app.stampSize);
// What the Stamp brush paints with its anchor at vertex A, at the size and on the plane in use.
export function stampAt(A) {
  const step = stepAt(A.l);
  if (detailed()) { const { stamp, j } = tieredAt(step, A.l); return D.placeSized(stamp, A, { k: 1, j }); }
  return D.placeSized(sizedAt(step.k), A, { k: 1, j: step.j });
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
  if (!app.session.stampTold) { app.session.stampTold = true; toast(poseKind() ? 'Drag the stamp to move it, its corner knob to size and turn it, then tap ✓' : 'Drag the stamp to move it, its corner knob to size it, then tap ✓'); }
  updateStampbar();
}
// The live stamp's 1× outline around its anchor on the plane in use, and its reach,
// the farthest any of it is from the anchor (one reach of the handle is 1×); false
// when it has no cells.
function outline(v) {
  const { cells } = D.placeStamp(base(), v.A), A = v.A;
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const { cell } of cells) for (const w of L.cellWorldVerts(cell)) { x0 = Math.min(x0, w.x); y0 = Math.min(y0, w.y); x1 = Math.max(x1, w.x); y1 = Math.max(y1, w.y); }
  if (!cells.length) return false;
  const a = L.vertexWorld(A.l, A.p, A.q), box = { x0: x0 - a.x, y0: y0 - a.y, x1: x1 - a.x, y1: y1 - a.y };
  v.box = box;
  v.reach = Math.max(...[[box.x1, box.y0], [box.x0, box.y0], [box.x1, box.y1], [box.x0, box.y1]].map(([x, y]) => Math.hypot(x, y)));
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
function repaint({ quiet = false } = {}) {
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
  if (!quiet && navigator.vibrate) navigator.vibrate(10);
  updateStampbar();
}

// Moving the live stamp (owner, 2026-10-20: place it, "rotate it and resize it and do
// all the things you need to do before confirming its location"): a press on the stamp
// drags it by where it was grabbed; a press anywhere else brings its foot there. Each
// vertex it crosses paints it again in its one undo step. moveFrom returns the offset
// from the finger to the foot, or null when no stamp is live (ui/input.js places a new one).
export function moveFrom(wx, wy) {
  if (!stillLive()) return null;
  const v = app.live, a = L.vertexWorld(v.A.l, v.A.p, v.A.q), b = liveBox(), pad = 6 / app.view.zoom;
  if (wx >= b.x0 - pad && wx <= b.x1 + pad && wy >= b.y0 - pad && wy <= b.y1 + pad) return { dx: a.x - wx, dy: a.y - wy };
  moveTo({ dx: 0, dy: 0 }, wx, wy);
  return { dx: 0, dy: 0 };
}
export function moveTo(off, wx, wy) {
  const v = app.live;
  if (!v || !stillLive()) return;
  const A = L.nearestVertex(v.A.l, wx + off.dx, wy + off.dy);
  if (A.p === v.A.p && A.q === v.A.q) return;
  v.A = A;
  repaint({ quiet: true });
}
// Whether a stamp is live (input.js: no ghost of a new one while it is).
export const isLive = () => stillLive();

// The next plane the stamp goes on (floor, a wall, upright), for it and the next ones.
const PLANE_SAYS = { upright: 'standing up, facing you', floor: 'the floor', left: 'the left wall', right: 'the right wall' };
export function nextPlane() {
  const ps = planes();
  if (!ps.length) return;
  app.stampPlane = ps[(ps.indexOf(planeNow()) + 1) % ps.length];
  if (stillLive()) { outline(app.live); repaint(); } else updateStampbar();
}

// A quarter turn more for the 3D stamps, for the one just placed and the next ones.
// What each view faces, for the button and the notice: a quarter turn takes down-right to down-left.
const SPIN_SAYS = ['facing right', 'facing left', 'facing away to the left', 'facing away to the right'];
export function spinStamp() {
  if (!(starterId() && M.spins(starterId()).length)) return;
  app.stampSpin = (app.stampSpin + 1) % 4;
  if (stillLive()) { outline(app.live); repaint(); } else { updateStampbar(); toast(`Stamps ${SPIN_SAYS[app.stampSpin]}`); }
}

// Turning by the handle, the way Drag a face picks its face (owner, 2026-10-19:
// "mimic draw face behavior as close as possible"; engine/brushes.js poseAt): a 3D
// stamp spins to face the quarter the handle is dragged into, a flat one lies on
// the plane Drag a face would draw that way. Null for a stamp that does not turn.
const poseKind = () => (starterId() && M.spins(starterId()).length ? 'spin' : planes().length ? 'plane' : null);
const poseNow = () => (poseKind() === 'spin' ? spinNow() : planeNow());
// The pose and size from the handle at once, painted once.
function setPoseAndSize(pose, s) {
  const kind = poseKind(), turned = pose !== poseNow();
  if (turned) { if (kind === 'spin') app.stampSpin = pose; else app.stampPlane = pose; }
  const to = D.nearestStep(steps(app.live.A.l), s).s;
  if (!turned && to === app.stampSize) return;
  app.stampSize = to;
  if (turned) outline(app.live);
  repaint();
}
// The next pose round, from the keyboard on the handle.
function turnBy(d) {
  if (poseKind() === 'spin') { app.stampSpin = (spinNow() + 4 + d) % 4; outline(app.live); repaint(); return; }
  const ps = planes();
  if (!ps.length) return;
  app.stampPlane = ps[(ps.indexOf(planeNow()) + ps.length + d) % ps.length];
  outline(app.live); repaint();
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
  if (!v) { h.hidden = true; $('#stamp-check').hidden = true; return; }
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
  const sb = $('#stamp-spin'), spinning = !!(starterId() && M.spins(starterId()).length);
  sb.hidden = !spinning;
  if (spinning) sb.setAttribute('aria-label', `Spin: ${SPIN_SAYS[spinNow()]}. Tap for a quarter turn.`);
  const plane = planeNow(), pb = $('#stamp-plane');
  pb.hidden = !plane;
  if (plane && pb.dataset.plane !== plane) {
    const ps = planes(), next = ps[(ps.indexOf(plane) + 1) % ps.length];
    pb.dataset.plane = plane;
    pb.innerHTML = PLANE_ICONS[plane];
    pb.setAttribute('aria-label', `On ${PLANE_SAYS[plane]}. Tap for ${PLANE_SAYS[next]}.`);
  }
  placeStampHandle();
  h.setAttribute('aria-label', poseKind() ? 'Stamp size and turn: drag away from its foot or toward it to size it, round it to turn it; arrow keys up and down size it, left and right turn it' : 'Stamp size: drag away from the stamp for bigger, toward it for smaller');
  h.hidden = false;
  $('#stamp-check').hidden = false;
}
// The handle and the ✓ sit on the live stamp's dashed outline (owner, 2026-10-20: "let
// the control be fixed to the edge of the shape"): the handle on its top-right corner,
// the ✓ on its bottom-right, kept on screen, above the bars and off the buttons, rails
// and notices (a big stamp's corners may be under them, or off the screen), and never
// on each other. Called again after the notices move (app.js placeUpdateBar), as the
// selection's handle is, since they stack above the stamp bar.
export function placeStampHandle() {
  const v = app.live, h = $('#stamp-handle'), ok = $('#stamp-check');
  if (!v || h.classList.contains('dragging')) return;
  const b = liveBox(), [x0, y0] = app.view.toScreen(b.x1, b.y0), [, y1] = app.view.toScreen(b.x1, b.y1);
  // Above the stamp bar. The notices stacked over it are kept clear too, and when nothing else is
  // free (a short landscape phone with a notice up) a knob may sit on a notice's words, never on
  // its buttons (2026-10-20: CI's 480 × 320 view had both knobs on ⚙️ and ?).
  const bar = $('#stampbar').getBoundingClientRect(), floor = Math.min(bar.height ? bar.top : app.view.h, app.view.h) - 30;
  const keep = (x, y) => [Math.max(30, Math.min(app.view.w - 30, x)), Math.max(30, Math.min(floor, y))];
  const controls = ['.topleft', '.topright', '#levels', '#zoom'], notes = ['#update-bar', '#protect-note', '#save-note', '#move-note'];
  // A knob on a notice's words is drawn above it (.over-note).
  const place = (el, x, y, also) => {
    let at = clearOf([...controls, ...notes], x, y, floor, also);
    el.classList.toggle('over-note', !at);
    at = at || clearOf([...controls, ...notes.map((n) => `${n} button`)], x, y, floor, also) || [x, y];
    el.style.left = `${at[0]}px`; el.style.top = `${at[1]}px`;
    return at;
  };
  const [hx, hy] = place(h, ...keep(x0 + 6, y0 - 6));
  // The ✓ keeps off the handle too (a small stamp's corners are closer than two knobs).
  place(ok, ...keep(x0 + 6, y1 + 6), [{ left: hx - 22, right: hx + 22, top: hy - 22, bottom: hy + 22 }]);
}
// A 44 px knob centered at (x, y), moved to the nearest spot on screen, above floor, that covers
// none of the controls (nor the rects in also): beside or below each one it would cover, three
// times over (a gap between two clusters may be too narrow for it, so it goes below them); when
// that finds nothing, as in a short landscape phone's corner, the nearest free spot on a 12 px
// grid; null when no spot at all is free.
function clearOf(sels, x, y, floor = Infinity, also = []) {
  const rects = sels.flatMap((sel) => [...document.querySelectorAll(sel)].map((el) => el.getBoundingClientRect())).filter((r) => r.width && r.height).concat(also);
  const covers = (cx, cy) => rects.filter((r) => !(cx + 26 < r.left || cx - 26 > r.right || cy + 26 < r.top || cy - 26 > r.bottom));
  const fits = ([cx, cy]) => cx >= 26 && cx <= innerWidth - 26 && cy >= 26 && cy <= floor && !covers(cx, cy).length;
  const nearest = (spots) => spots.reduce((b, c) => (Math.hypot(c[0] - x, c[1] - y) < Math.hypot(b[0] - x, b[1] - y) ? c : b));
  if (fits([x, y])) return [x, y];
  let spots = [[x, y]];
  for (let pass = 0; pass < 3; pass++) {
    spots = spots.concat(spots.flatMap(([cx, cy]) => covers(cx, cy).flatMap((r) => [[r.right + 28, cy], [r.left - 28, cy], [cx, r.bottom + 28]])));
  }
  let ok = spots.filter(fits);
  if (!ok.length) {
    for (let gy = 26; gy <= Math.min(floor, innerHeight - 26); gy += 12) for (let gx = 26; gx <= innerWidth - 26; gx += 12) if (fits([gx, gy])) ok.push([gx, gy]);
  }
  return ok.length ? nearest(ok) : null;
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
// The line from the live stamp's foot to its handle while it is dragged, in world
// units, for render.js: the pointer, which the stamp turns round.
export function livePointer() {
  const v = app.live, h = $('#stamp-handle');
  if (!v || !poseKind() || h.hidden || !h.classList.contains('dragging')) return null;
  const a = L.vertexWorld(v.A.l, v.A.p, v.A.q), r = canvas.getBoundingClientRect(), hr = h.getBoundingClientRect();
  const [x1, y1] = app.view.toWorld(hr.left + hr.width / 2 - r.left, hr.top + hr.height / 2 - r.top);
  return { x0: a.x, y0: a.y, x1, y1 };
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
  $('#stamp-check').addEventListener('click', endLive);
  $('#stamp-plane').addEventListener('click', nextPlane);
  $('#stamp-spin').addEventListener('click', spinStamp);
  // The handle. Size: moving the finger one reach farther from the foot is 1× more,
  // counted from where it was grabbed (a handle kept on screen or off a rail is not
  // where its size would put it); the size is the step nearest that. Turn: the way
  // the finger is from the foot picks the pose (poseAt), as a drag picks Drag a face's face.
  const h = $('#stamp-handle');
  let grab = null;
  const at = (e) => {
    const v = app.live, r = canvas.getBoundingClientRect(), a = L.vertexWorld(v.A.l, v.A.p, v.A.q);
    const [wx, wy] = app.view.toWorld(e.clientX - r.left, e.clientY - r.top), dx = wx - a.x, dy = wy - a.y;
    const along = Math.hypot(dx, dy) / v.reach;
    return { along, angle: (Math.atan2(dy, dx) * 180) / Math.PI, px: Math.hypot(dx, dy) * app.view.zoom };
  };
  h.addEventListener('pointerdown', (e) => {
    e.stopPropagation();
    if (!stillLive()) return;
    try { h.setPointerCapture(e.pointerId); } catch { /* synthetic */ }
    h.classList.add('dragging');
    const kind = poseKind(), g = at(e);
    // Turning counts from where the handle was grabbed: the finger turned round the foot,
    // added to the pose's own direction, so a handle kept on screen or off a rail (not on
    // its pose's line) does not turn the stamp until the finger really goes round.
    grab = { t: g.along, s: stepAt(app.live.A.l).s, a0: g.angle, p0: kind ? poseAngle(kind, poseNow(), app.live.side || 0) : 0 };
  });
  h.addEventListener('pointermove', (e) => {
    if (!app.live || !grab || !h.classList.contains('dragging')) return;
    h.style.left = `${e.clientX}px`; h.style.top = `${e.clientY}px`;
    const { along, angle: raw, px } = at(e), kind = poseKind(), s = grab.s + along - grab.t;
    const angle = grab.p0 + ((((raw - grab.a0) % 360) + 540) % 360) - 180;
    // Within a finger's width of the foot the direction means nothing: the pose holds.
    if (!kind || px < 44) { setStampSize(s); return; }
    const pose = poseAt(kind, angle, poseNow(), planes());
    // Which of a plane's two slices the finger is in, so the handle stays on that side.
    if (kind === 'plane' && pose !== 'upright') app.live.side = Math.cos(((angle - poseAngle(kind, pose, 0)) * Math.PI) / 180) < 0 ? 1 : 0;
    setPoseAndSize(pose, s);
    requestRender(); // the pointer line follows the finger
  });
  const drop = () => { grab = null; h.classList.remove('dragging'); updateStampbar(); requestRender(); };
  h.addEventListener('pointerup', drop);
  h.addEventListener('pointercancel', drop);
  h.addEventListener('keydown', (e) => {
    const turns = !!poseKind();
    if (e.key === 'ArrowUp' || (!turns && e.key === 'ArrowRight')) { e.preventDefault(); stepStampSize(1); }
    if (e.key === 'ArrowDown' || (!turns && e.key === 'ArrowLeft')) { e.preventDefault(); stepStampSize(-1); }
    if (turns && (e.key === 'ArrowRight' || e.key === 'ArrowLeft')) { e.preventDefault(); turnBy(e.key === 'ArrowRight' ? 1 : -1); }
  });
}
