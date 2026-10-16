// Tools and the brush options popover, painting through the model's one
// write path, undo and redo, and the selection with density change.

import * as L from '../engine/lattice.js';
import * as B from '../engine/brushes.js';
import * as S from '../engine/symmetry.js';
import { fillAt } from '../engine/fill.js';
import * as D from '../engine/density.js';
import { shade } from '../engine/color.js';
import { GLYPHS } from '../glyphs.js';
import { protectSplit, nextMode, MODE_LABEL, MODE_SAYS, skipNotice } from '../engine/protect.js';
import { $, BRUSH_LABEL, app, canvas, emit, palette, requestRender, scheduleSave, set, symCenter, toast } from '../app.js';
import { cancelGesture, gesture, spaceHeld } from './input.js';
import { syncMenu } from './screens.js';
import * as SB from '../stampbook.js';
import { openStamps } from './stamps.js';

// ---------- tools and the options popover ----------
export function setTool(tool) {
  set('tool', tool);
  setMoveMode(false); // picking a tool means "draw now"
  for (const b of document.querySelectorAll('[data-tool]')) b.setAttribute('aria-pressed', String(b.dataset.tool === tool));
  closePopover();
  updateOptionsButton();
  app.ghost = null;
  requestRender();
}
// Move mode: every one-finger drag moves the view (engine/gesture.js). A tool
// button, H or Esc turns it off; it is never remembered, so the app always
// opens ready to draw.
export function setMoveMode(on, say = false) {
  app.moveMode = on;
  $('#move-mode').setAttribute('aria-pressed', String(on));
  document.body.classList.toggle('moving', on);
  updateCursor();
  if (on) { app.ghost = null; app.ghostSkip = null; requestRender(); }
  if (say) toast(on ? 'Move: drag to move the view. Tap a tool to draw.' : 'Drawing again');
}
// The hand cursor while a drag would pan; the closed hand during one.
export function updateCursor() {
  canvas.classList.toggle('pan-ready', app.moveMode || spaceHeld);
  canvas.classList.toggle('panning', gesture?.kind === 'pan');
}
export function updateOptionsButton() {
  const s = app.settings, btn = $('#options');
  let glyph, label;
  if (s.tool === 'line') { glyph = GLYPHS[s.lineStyle]; label = `Line style: ${s.lineStyle === 'strip' ? 'Strip' : 'Edge'}`; }
  else if (s.tool === 'select') { glyph = GLYPHS['m-' + s.marquee]; label = `Selection shape: ${s.marquee}`; }
  else { glyph = GLYPHS[s.brush]; label = `Brush shape: ${BRUSH_LABEL[s.brush]}`; }
  btn.disabled = s.tool === 'fill';
  $('#options-glyph').outerHTML = glyph.replace('<svg', '<svg id="options-glyph"');
  btn.setAttribute('aria-label', label);
  btn.title = label;
}
export function openPopover() {
  const s = app.settings, pop = $('#popover');
  const items = s.tool === 'line'
    ? [['strip', 'Strip'], ['edge', 'Edge']].map(([k, t]) => ({ k, t, g: GLYPHS[k], on: s.lineStyle === k, pick: () => set('lineStyle', k) }))
    : s.tool === 'select'
      ? [['triangle', 'Triangle'], ['rhombus', 'Rhombus'], ['hexagon', 'Hexagon']].map(([k, t]) => ({ k, t, g: GLYPHS['m-' + k], on: s.marquee === k, pick: () => set('marquee', k) }))
      : Object.entries(BRUSH_LABEL).map(([k, t]) => ({ k, t, g: GLYPHS[k], on: s.brush === k, pick: () => { set('brush', k); if (k === 'stamp') openStamps(); } })); // Stamp opens the Stamps drawer (web/ui/stamps.js)
  const title = s.tool === 'line' ? 'Line style' : s.tool === 'select' ? 'Selection shape (press a grid point, drag)' : 'Brush shape';
  pop.innerHTML = `<h4>${title}</h4>`;
  pop.setAttribute('aria-label', title);
  for (const it of items) {
    const b = document.createElement('button');
    b.className = 'btn';
    b.setAttribute('aria-pressed', String(it.on));
    b.dataset.pick = it.k; // its name as a control (events.js)
    b.innerHTML = `${it.g}<span>${it.t}</span>`;
    b.addEventListener('click', () => { it.pick(); closePopover('picked'); updateOptionsButton(); });
    pop.append(b);
  }
  if (pop.hidden) { popoverOpen = { dialog: s.tool === 'line' ? 'line' : s.tool === 'select' ? 'marquee' : 'brush', at: Date.now() }; app.events?.track('dialog.open', { dialog: popoverOpen.dialog }); }
  pop.hidden = false;
  $('#options').setAttribute('aria-expanded', 'true');
  pop.querySelector('button')?.focus();
}
let popoverOpen = null; // {dialog, at} while the popover shows
export function closePopover(answer = 'dismissed') {
  if (popoverOpen) { app.events?.track('dialog.close', { dialog: popoverOpen.dialog, answer, ms: Date.now() - popoverOpen.at }); popoverOpen = null; }
  $('#popover').hidden = true;
  $('#options').setAttribute('aria-expanded', 'false');
}

// ---------- painting ----------
// An auto-shaded paint: the tone for this face with the drawing's light side,
// the face, the side, and the base color (so Relight is exact; engine/color.js).
export function shaded(base, f) {
  const light = app.drawing.light;
  return { c: shade(base, f, light), f, b: base, s: light === 'right' ? 'r' : undefined };
}
function specFor(it, erase) {
  if (erase) return null;
  if (it.c) return { c: it.c, f: it.f };
  const base = app.settings.color;
  if (app.settings.shading && it.f) return shaded(base, it.f);
  return { c: base };
}
export function applyCells(items, erase) {
  const all = S.expandCells(items, symCenter(), app.settings.symmetry);
  const mode = erase ? 'replace' : app.settings.protect;
  // Note what Keep fine detail skips, to show it when the stroke ends.
  for (const c of protectSplit(app.drawing, all.map((it) => it.cell), mode).skip) app.strokeSkips.set(L.cellKey(c), c);
  for (const it of all) app.drawing.paint(it.cell, specFor(it, erase), mode);
}
// After a stroke: hatch the skipped cells for a moment, and say why once a session.
export function reportSkips() {
  const skipped = [...app.strokeSkips.values()];
  app.strokeSkips.clear();
  if (!skipped.length) return;
  app.skipFlash = skipped;
  clearTimeout(app.skipTimer);
  app.skipTimer = setTimeout(() => { app.skipFlash = null; requestRender(); }, 1600);
  const msg = skipNotice(app.session, skipped.length);
  if (msg) { $('#protect-text').textContent = msg; $('#protect-note').hidden = false; }
}
export function updateModeChip() {
  const m = app.settings.protect, chip = $('#mode-chip');
  chip.dataset.mode = m;
  if (!$('#mode-icon').childElementCount) $('#mode-icon').outerHTML = GLYPHS['mode-can'].replace('<svg', '<svg id="mode-icon"');
  $('#mode-label').textContent = MODE_LABEL[m];
  const next = nextMode(m);
  chip.setAttribute('aria-label', `${MODE_SAYS[m]}. Tap for ${next === 'behind' ? 'Paint behind' : MODE_LABEL[next]}.`);
  chip.title = MODE_SAYS[m];
}
export function cycleMode() {
  set('protect', nextMode(app.settings.protect));
  updateModeChip();
  syncMenu();
  toast(MODE_SAYS[app.settings.protect]);
  emit('mode', { mode: app.settings.protect });
}
export function applyEdges(edges, color) {
  for (const e of S.expandEdges(edges, symCenter(), app.settings.symmetry)) app.drawing.paintEdge(e, color ? { c: color } : null);
}
// The eraser also lifts bold edges near the finger.
export function eraseEdgesNear(x, y) {
  const r = L.edgeLen(app.level) * 0.6;
  for (const k of [...app.drawing.edges.keys()]) {
    const e = L.parseEdgeKey(k);
    const [[p0, q0], [p1, q1]] = L.edgeEnds(e);
    const a = L.vertexWorld(e.l, p0, q0), b = L.vertexWorld(e.l, p1, q1);
    if (Math.hypot((a.x + b.x) / 2 - x, (a.y + b.y) / 2 - y) < Math.max(r, L.edgeLen(e.l) * 0.5)) app.drawing.setEdge(k, null);
  }
}
export function brushAt(x, y) {
  return B.brushCells(app.settings.brush, app.level, x, y);
}
export function stampItemsAt(x, y) {
  const st = SB.chosen(app.stampChoice, app.stamps);
  const A = L.nearestVertex(app.level, x, y);
  return D.placeStamp(st.stamp, A);
}

export function doFill(x, y) {
  const seeds = S.expandCells([{ cell: L.hitTest(app.level, x, y) }], symCenter(), app.settings.symmetry);
  const box = app.view.worldBox();
  const pad = L.edgeLen(app.level);
  const inBounds = (c) => { const w = L.centroid(c); return w.x > box.x0 - pad && w.x < box.x1 + pad && w.y > box.y0 - pad && w.y < box.y1 + pad; };
  app.drawing.begin('fill');
  let coarser = false;
  for (const { cell } of seeds) {
    // Too many cells at this level: fillAt uses bigger cells instead of refusing.
    const w = L.centroid(cell);
    const r = fillAt(app.drawing, w.x, w.y, app.level, { inBounds, maxCells: 40000 });
    if (r.level < app.level) coarser = true;
    for (const leaf of r.leaves) {
      const f = leaf.kind === 'paint' ? leaf.v.f : undefined;
      const spec = app.settings.shading && f ? shaded(app.settings.color, f) : { c: app.settings.color };
      app.drawing.paint(leaf.cell, spec, 'replace');
    }
  }
  commit();
  emit('fill');
  if (coarser) toast('A big area: filled with bigger cells to keep it quick.');
}

export function commit() {
  const diff = app.drawing.commit();
  afterChange();
  return diff;
}
// changed: false after loading a drawing, which is no change to save to a file.
export function afterChange({ changed = true } = {}) {
  $('#undo').disabled = !app.drawing.undoStack.length;
  $('#redo').disabled = !app.drawing.redoStack.length;
  updateSelbar();
  scheduleSave(changed);
  requestRender();
}
export function undo() {
  cancelGesture();
  const d = app.drawing.undo();
  if (!d) return;
  // Undoing a density change also puts the marquee back where it was.
  if (app.lastDensity && d === app.lastDensity.diff && app.selection) app.selection.region = app.lastDensity.before;
  toast('Undone');
  afterChange();
  emit('undo');
}
export function redo() { cancelGesture(); if (app.drawing.redo()) { toast('Redone'); afterChange(); emit('redo'); } }

// ---------- selection and density ----------
export function marqueeRegion(A, wx, wy) {
  const t = L.worldToLattice(A.l, wx, wy);
  const dp = t.pp - A.p, dq = t.qq - A.q;
  const shape = app.settings.marquee;
  const cells = shape === 'triangle' ? B.triangleRegion(A, dp, dq).cells
    : shape === 'rhombus' ? B.parallelogram(A, dp, dq).cells
      : B.hexagon(A, B.hexRadius(dp, dq)).cells;
  return D.makeRegion(A.l, cells);
}
export function selDensity() { return app.selection ? D.densityOf(app.drawing, app.selection.region) : 0; }
export function updateSelbar() {
  const bar = $('#selbar');
  const sel = app.selection;
  bar.hidden = !sel || !!app.replaying;
  if (!sel) { $('#handle').hidden = true; bar.classList.remove('more'); $('#sel-more').setAttribute('aria-expanded', 'false'); return; }
  const d = selDensity();
  $('#sel-level').textContent = `L${d}`;
  $('#sel-level').setAttribute('aria-label', `Selection density: level ${d}`);
  $('#sel-finer').disabled = d >= L.MAX_LEVEL;
  $('#sel-coarser').disabled = d <= 0 || (d <= sel.region.l && D.coarsestReachable(sel.region) >= d);
  const mode = app.settings.coarsen;
  $('#sel-mode').textContent = mode === 'crisp' ? 'Crisp' : 'Blend';
  $('#sel-mode').setAttribute('aria-label', `Coarsen color rule: ${mode === 'crisp' ? 'Crisp, majority color' : 'Blend, average color'}. Tap to switch.`);
  $('#sel-snap').hidden = mode !== 'blend';
  $('#sel-snap').setAttribute('aria-pressed', String(app.settings.snap || app.settings.limited));
  placeHandle();
}
export function setDensity(T) {
  const sel = app.selection;
  if (!sel) return false;
  const before = sel.region, d0 = selDensity();
  app.drawing.begin('density');
  const r = D.changeDensity(app.drawing, before, T, densityOpts());
  if (!r) { app.drawing.rollback(); toast('The selection edges do not line up with bigger cells. Select a bigger shape.'); return false; }
  const diff = app.drawing.commit();
  sel.region = r;
  app.lastDensity = diff ? { diff, before, T } : null;
  toast(`Density: level ${selDensity()}`);
  afterChange();
  emit('density', { dir: Math.sign(selDensity() - d0) });
  return true;
}
function densityOpts() {
  const s = app.settings;
  return { mode: s.coarsen, snap: s.snap || s.limited, palette: palette() };
}
// Flip Crisp/Blend; if the last action was a coarsen, redo it with the new rule.
export function toggleCoarsen() {
  set('coarsen', app.settings.coarsen === 'crisp' ? 'blend' : 'crisp');
  const ld = app.lastDensity;
  if (ld && app.drawing.undoStack.at(-1) === ld.diff && app.selection) {
    app.drawing.undo();
    app.drawing.redoStack.pop();
    app.selection.region = ld.before;
    setDensity(ld.T);
  }
  updateSelbar();
}
export function placeHandle() {
  const h = $('#handle');
  const sel = app.selection;
  if (!sel || !app.settings.densityHandle || app.replaying) { h.hidden = true; return; }
  // The boundary vertex furthest down-right on screen.
  let best = null, bs = -Infinity;
  for (const seg of D.regionBoundary(sel.region)) for (const [p, q] of seg) {
    const w = L.vertexWorld(sel.region.l, p, q);
    const [x, y] = app.view.toScreen(w.x, w.y);
    if (x + y > bs) { bs = x + y; best = [x, y]; }
  }
  if (!best) { h.hidden = true; return; }
  if (!h.classList.contains('dragging')) {
    // Keep the handle clear of the top buttons, the rail and the selection bar.
    const above = [$('#selbar'), $('#update-bar')].map((el) => el.getBoundingClientRect()).filter((r) => r.height);
    const floor = above.length ? Math.min(...above.map((r) => r.top)) - 30 : app.view.h - 200;
    const x = Math.max(30, Math.min(app.view.w - 90, best[0] + 18)), y = Math.max(80, Math.min(floor, best[1] + 18));
    h.style.left = `${x}px`; h.style.top = `${y}px`;
  }
  h.hidden = false;
  h.setAttribute('aria-valuenow', String(selDensity()));
}

// A live density preview (handle or pinch): moves through notches, commits on release.
export let preview = null;
export function previewStart() {
  if (!app.selection) return null;
  const r = app.selection.region;
  const d0 = D.densityOf(app.drawing, r);
  preview = { before: r, d0, T: d0, min: Math.min(d0, D.coarsestReachable(r)) };
  app.drawing.begin('density');
  renderTrack();
  return preview;
}
export function previewTo(T) {
  if (!preview) return;
  T = Math.max(preview.min, Math.min(L.MAX_LEVEL, T));
  if (T === preview.T) return;
  app.drawing.rollback();
  app.drawing.begin('density');
  const r = D.changeDensity(app.drawing, preview.before, T, densityOpts());
  if (!r) return;
  preview.T = T;
  app.selection.region = r;
  if (navigator.vibrate && !matchMedia('(prefers-reduced-motion: reduce)').matches) navigator.vibrate(8);
  renderTrack();
  requestRender();
}
export function previewEnd(keep = true) {
  if (!preview) return;
  if (keep && preview.T !== preview.d0) {
    const diff = app.drawing.commit();
    app.lastDensity = diff ? { diff, before: preview.before, T: preview.T } : null;
    toast(`Density: level ${preview.T}`);
    emit('density', { dir: Math.sign(preview.T - preview.d0) });
  } else {
    app.drawing.rollback();
    app.selection.region = preview.before;
  }
  preview = null;
  $('#handle').classList.remove('dragging');
  afterChange();
}
function renderTrack() {
  const tr = $('#handle-track');
  if (!preview) return;
  tr.innerHTML = '';
  for (let l = 0; l <= 7; l++) {
    const d = document.createElement('div');
    d.className = 'tick' + (l === preview.T ? ' on' : '') + (l < preview.min ? ' off' : '') + (l === preview.d0 ? ' now' : '');
    d.textContent = `L${l} ${l < preview.d0 ? 'coarser' : l > preview.d0 ? 'finer' : ''}`;
    tr.append(d);
  }
  const mode = document.createElement('div');
  mode.textContent = app.settings.coarsen === 'crisp' ? 'Crisp' : 'Blend';
  tr.append(mode);
}
