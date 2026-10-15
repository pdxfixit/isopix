// Isopix app: wires the engine, the renderer and the controls together.
// Owns the app state (tool, color, level, selection, view) and all input
// handling: pointer events for touch, mouse and pen; wheel; keyboard.
import * as L from './engine/lattice.js';
import { Drawing } from './engine/model.js';
import * as B from './engine/brushes.js';
import * as S from './engine/symmetry.js';
import { fillAt } from './engine/fill.js';
import * as D from './engine/density.js';
import * as P from './engine/project.js';
import { toSVG, bounds } from './engine/svg.js';
import { View, followLevel, targetPx, notchFor, MIN_ZOOM, MAX_ZOOM, zoomToSlider, sliderToZoom, zoomLabel } from './engine/view.js';
import { shade } from './engine/color.js';
import { Renderer, drawCells, drawEdges } from './render.js';
import * as store from './storage.js';
import { GLYPHS, notchGlyph } from './glyphs.js';
import { initUpdate, buildStamp, aboutVersion } from './update.js';
import { keyFor } from './keys.js';
import { toolAfterColorPick } from './palette.js';
import { helpHTML } from './help.js';
import { cleanName, fileBase, savedAgo, fileLine, unsavedToFile, saveDot, newChoices, chipText, SECTION_IDS, rememberedOpen, startsOpen, rememberOpen } from './sheets.js';
import { paperOf, paperName, inkName, matchInk } from './engine/paper.js';
import { protectSplit, nextMode, MODE_LABEL, MODE_SAYS, skipNotice } from './engine/protect.js';
import { dropOnSecondFinger, oneFinger } from './engine/gesture.js';
import { readMoveHash, keysToCopy, landing, hasDrawing } from './move.js';
import * as PNGP from './engine/pngproject.js';

// ---------- palette and settings ----------
// The inks come from the drawing's paper (engine/paper.js).
const systemPaper = () => (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');

const DEFAULTS = {
  tool: 'pencil', brush: 'triangle', lineStyle: 'strip', marquee: 'hexagon',
  color: '#3a86ff', shading: true, notch: 2, locked: false, lockedLevel: 3,
  protect: 'protect', gutters: true, hint: 'faint', hintLevels: 1,
  symmetry: 'off', symP: 0, symQ: 0, symL: 0,
  densityHandle: true, densityPinch: false, densityLongpress: false,
  coarsen: 'crisp', snap: false, limited: false, limitedCount: 3, gray: false, traceOpacity: 0.3,
  custom: '',
  savePng: true, // Save writes a PNG with the drawing inside; off: a .isopix.json file
};
const BRUSH_LABEL = { triangle: 'Triangle', rhombus: 'Rhombus', hexagon: 'Hexagon', trapezoid: 'Trapezoid', bigtri: 'Big triangle', face: 'Drag a face', cube: 'Drag a cube', stamp: 'Stamp' };
const DRAG_BRUSHES = new Set(['face', 'cube', 'stamp']);

const $ = (s) => document.querySelector(s);
const canvas = $('#stage');
const renderer = new Renderer(canvas);

// A new drawing starts on the paper that matches the screen's mode.
function newDrawing() {
  const d = new Drawing();
  d.paper = systemPaper();
  return d;
}
// Flip this drawing's paper. Strokes keep their colors; the inks switch.
function flipPaper() {
  const from = app.drawing.paper, to = from === 'dark' ? 'light' : 'dark';
  app.drawing.paper = to;
  set('color', matchInk(app.settings.color, from, to));
  buildPalette();
  syncMenu();
  scheduleSave();
  requestRender();
  toast(to === 'dark' ? 'Dark paper, light inks' : 'Light paper, dark inks');
}

export const app = {
  drawing: newDrawing(),
  view: new View(),
  settings: store.loadSettings(DEFAULTS),
  level: 3,
  selection: null, // {region, anchor}
  stamps: [],
  stampIndex: 0,
  ghost: null,
  crosshair: null,
  trace: null,
  replaying: null,
  pickCenter: false,
  moveMode: false,       // the hand on the zoom rail: one finger moves the view
  lastDensity: null,
  loadedVersion: null,
  drawingName: 'Untitled drawing', // saved with the drawing (project file and autosave)
  lastSaved: null,       // when the autosave last landed in IndexedDB
  file: { name: null, at: null, via: null, dirty: false, handle: null }, // the file this drawing was last saved to or opened from
  strokeSkips: new Map(), // cells Keep fine detail skipped in the stroke under way
  skipFlash: null,        // skipped cells hatched for a moment after a stroke
  session: { told: false, storageTold: false }, // the skip and storage notices show once a session
};
window.isopix = app; // for debugging and the look tool

// ---------- small helpers ----------
const set = (k, v) => { app.settings[k] = v; store.saveSettings(app.settings); };
let toastTimer;
function toast(msg) {
  const t = $('#toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 2200);
}
const symCenter = () => ({ l: app.settings.symL, p: app.settings.symP, q: app.settings.symQ });
function palette() {
  const s = app.settings, pp = paperOf(app.drawing.paper);
  return s.limited ? pp.limited.slice(0, s.limitedCount) : pp.inks.concat(s.custom ? [s.custom] : []);
}

// ---------- rendering ----------
let theme = {};
function readTheme() {
  const cs = getComputedStyle(document.documentElement);
  const v = (n) => cs.getPropertyValue(n).trim();
  theme = { accent: v('--accent') };
}
// The paper and its grid lines come from the drawing, not the screen's mode.
const paperTheme = () => { const pp = paperOf(app.drawing.paper); return { ...theme, bg: pp.bg, line: pp.grid }; };
let frame = 0;
export function requestRender() {
  if (frame) return;
  frame = requestAnimationFrame(() => { frame = 0; render(); });
}
function render() {
  const s = app.settings;
  renderer.draw({
    drawing: app.replaying ? app.replaying.drawing : app.drawing,
    view: app.view,
    level: app.level,
    opts: { gutters: s.gutters, hint: s.hint, hintLevels: s.hintLevels },
    theme: paperTheme(),
    overlay: {
      region: app.selection && app.selection.region,
      // The cells as stored inside the selection, outlined, so a density
      // change (which looks the same when lossless) shows its new cell size.
      regionCells: app.selection ? D.paintedIn(app.drawing, app.selection.region).slice(0, 6000) : null,
      ghost: app.ghost,
      skip: app.ghostSkip || app.skipFlash,
      crosshair: app.crosshair,
      symmetry: { mode: s.symmetry, center: symCenter() },
      trace: app.trace && { ...app.trace, opacity: s.traceOpacity },
    },
  });
  placeHandle();
  placeUpdateBar();
  updateZoomUI();
}
// The update bar sits just above the selection bar or the bottom bars.
// The protect notice stacks above it when both show.
function placeUpdateBar() {
  const tops = [$('.bottom > .palette'), $('.bottom > .tools'), $('#selbar')]
    .map((el) => el.getBoundingClientRect()).filter((r) => r.height).map((r) => r.top);
  let top = Math.min(...tops);
  for (const bar of [$('#update-bar'), $('#protect-note'), $('#save-note'), $('#move-note')]) {
    if (bar.hidden) continue;
    bar.style.bottom = `${Math.round(window.innerHeight - top + 8)}px`;
    top = bar.getBoundingClientRect().top;
  }
}
// One synchronous frame, for tools/perf.mjs (requestAnimationFrame is throttled in hidden tabs).
app.renderNow = () => render();
app.placeTrace = (f) => placeTrace(f);
app.renderer = renderer;
function resize() {
  const w = canvas.clientWidth, h = canvas.clientHeight;
  app.view.w = w; app.view.h = h;
  renderer.resize(w, h, window.devicePixelRatio || 1);
  render();
}

// ---------- level ----------
function computeLevel(reset = false) {
  const s = app.settings, prev = app.level;
  app.level = s.locked ? s.lockedLevel : followLevel(app.view.zoom, targetPx(s.notch), reset ? null : app.level);
  if (app.level !== prev) showReadout();
  updateLevelUI();
}
let readoutTimer;
function showReadout(withZoom = false) {
  const r = $('#level-readout');
  const px = Math.round(L.edgeLen(app.level) * app.view.zoom);
  r.textContent = `${withZoom ? `Zoom ${zoomLabel(app.view.zoom)} · ` : ''}Level ${app.level} · cells ${px} px`;
  r.classList.add('show');
  clearTimeout(readoutTimer);
  readoutTimer = setTimeout(() => r.classList.remove('show'), 1200);
}

function buildNotches() {
  const box = $('#notches');
  box.innerHTML = '';
  for (let i = 0; i < 8; i++) {
    const b = document.createElement('button');
    b.className = 'notch';
    b.setAttribute('role', 'radio');
    b.dataset.n = i;
    b.innerHTML = notchGlyph(i);
    // Keyboard and screen-reader activation arrive as a click with no pointer.
    b.addEventListener('click', (e) => { if (e.detail === 0) chooseNotch(i); });
    box.append(b);
  }
  // Tap a notch, or slide a finger along them: the slider is chunked.
  let sliding = false;
  const pick = (e) => {
    const el = document.elementFromPoint(e.clientX, e.clientY)?.closest('.notch');
    if (el) chooseNotch(+el.dataset.n);
  };
  box.addEventListener('pointerdown', (e) => { sliding = true; openRail(); try { box.setPointerCapture(e.pointerId); } catch { /* synthetic */ } pick(e); });
  box.addEventListener('pointermove', (e) => { if (sliding) pick(e); });
  box.addEventListener('pointerup', () => { sliding = false; closeRail(800); });
  box.addEventListener('pointercancel', () => { sliding = false; closeRail(800); });
  // Keyboard and screen readers: the rail is open while focus is in it.
  box.addEventListener('focusin', (e) => { if (e.target.matches(':focus-visible')) openRail(); });
  box.addEventListener('focusout', (e) => { if (!box.contains(e.relatedTarget)) closeRail(300); });
  box.addEventListener('keydown', (e) => {
    const cur = app.settings.locked ? app.settings.lockedLevel : app.settings.notch;
    const vertical = getComputedStyle(box).flexDirection === 'column';
    const next = { ArrowDown: vertical ? 1 : null, ArrowUp: vertical ? -1 : null, ArrowRight: 1, ArrowLeft: -1, Home: -8, End: 8 }[e.key];
    if (next == null) return;
    e.preventDefault();
    chooseNotch(Math.max(0, Math.min(7, cur + next)));
    box.querySelector(`[data-n="${app.settings.locked ? app.settings.lockedLevel : app.settings.notch}"]`).focus();
  });
}
// On phones the slider is a slim rail that opens while touched (styles.css).
let railTimer;
export function openRail(ms = 0) {
  clearTimeout(railTimer);
  nudgeRail();
  $('#levels').classList.add('open');
  if (ms) closeRail(ms);
}
// The open column of notches keeps the chosen one under the finger, shifted
// only as far as it takes to stay between the top buttons and the bottom bars.
function nudgeRail() {
  const levels = $('#levels'), box = $('#notches'), cs = getComputedStyle(box);
  let nudge = 0;
  if (cs.position === 'absolute' && cs.flexDirection === 'column') {
    const s = app.settings, k = s.locked ? s.lockedLevel : s.notch;
    const fanTop = $('.notch-window').getBoundingClientRect().top - k * 46;
    const floor = Math.min(...['.bottom > .palette', '.bottom > .tools'].map((q) => $(q).getBoundingClientRect().top)) - 8;
    const ceiling = $('.topright').getBoundingClientRect().bottom + 8;
    nudge = Math.min(Math.max(fanTop, ceiling), floor - box.offsetHeight) - fanTop;
  }
  levels.style.setProperty('--nudge', `${Math.round(nudge)}px`);
}
function closeRail(ms) {
  clearTimeout(railTimer);
  const keyboardIn = () => { const a = document.activeElement; return !!a && $('#notches').contains(a) && a.matches(':focus-visible'); };
  railTimer = setTimeout(() => { if (!keyboardIn()) $('#levels').classList.remove('open'); }, ms);
}
function chooseNotch(n) {
  if (app.settings.locked) set('lockedLevel', n); else set('notch', n);
  computeLevel(true);
  showReadout();
  requestRender();
}
function updateLevelUI() {
  const s = app.settings;
  const checked = s.locked ? s.lockedLevel : s.notch;
  $('#levels').style.setProperty('--k', checked);
  nudgeRail();
  for (const b of document.querySelectorAll('.notch')) {
    const n = +b.dataset.n;
    b.setAttribute('aria-checked', String(n === checked));
    b.tabIndex = n === checked ? 0 : -1;
    // Following zoom, a notch names the size it gives right now (two notches can share a level).
    const lv = followLevel(app.view.zoom, targetPx(n), null);
    const px = Math.round(L.edgeLen(lv) * app.view.zoom);
    b.setAttribute('aria-label', s.locked ? `Level ${n}${n === 0 ? ', biggest cells' : n === 7 ? ', smallest cells' : ''}` : `Brush size ${8 - n} of 8: cells ${px} px now (level ${lv})`);
    b.title = s.locked ? `Level ${n}` : `Cells ${px} px (level ${lv})`;
  }
  const lock = $('#lock');
  lock.setAttribute('aria-pressed', String(s.locked));
  lock.setAttribute('aria-label', s.locked ? `Unlock grid level (now level ${app.level}); the level will follow zoom` : `Lock grid level at ${app.level}; zooming then keeps the level`);
  let num = lock.querySelector('.lvl');
  if (!num) { num = document.createElement('span'); num.className = 'lvl'; lock.append(num); }
  num.textContent = app.level;
}
function toggleLock() {
  const s = app.settings;
  if (!s.locked) set('lockedLevel', app.level);
  else {
    // Pick the notch whose target size matches the locked level at this zoom.
    const px = L.edgeLen(s.lockedLevel) * app.view.zoom;
    set('notch', notchFor(px));
  }
  set('locked', !s.locked);
  computeLevel(true);
  openRail(1500); // show what the notches now mean
  toast(s.locked ? `Level locked at ${app.level}` : 'Level follows zoom');
}

// ---------- palette ----------
function buildPalette() {
  // A color picked on the other paper becomes the same ink on this one.
  const paper = paperName(app.drawing.paper), other = paper === 'dark' ? 'light' : 'dark';
  if (!palette().includes(app.settings.color)) {
    const m = matchInk(app.settings.color, other, paper);
    if (m !== app.settings.color) set('color', m);
  }
  const box = $('#palette');
  box.innerHTML = '';
  const s = app.settings;
  for (const c of palette()) {
    const b = document.createElement('button');
    b.className = 'swatch';
    b.setAttribute('role', 'radio');
    b.setAttribute('aria-checked', String(c === s.color));
    b.setAttribute('aria-label', inkName(app.drawing.paper, c) || `Custom color ${c}`);
    b.style.setProperty('--c', c);
    if (s.shading) b.innerHTML = `<span class="tones" aria-hidden="true"><i style="background:${shade(c, 'T')}"></i><i style="background:${shade(c, 'L')}"></i><i style="background:${shade(c, 'R')}"></i></span>`;
    b.addEventListener('click', () => { set('color', c); buildPalette(); pickedColor(); });
    box.append(b);
  }
  // The add-color and auto-shade buttons stay pinned at the end, so a narrow
  // screen scrolls the inks under them instead of hiding them (styles.css).
  const pinned = document.createElement('span');
  pinned.className = 'pal-pinned';
  box.append(pinned);
  if (s.limited && s.limitedCount < paperOf(app.drawing.paper).limited.length) {
    const more = document.createElement('button');
    more.className = 'swatch tool';
    more.textContent = '+';
    more.setAttribute('aria-label', 'Add one more color');
    more.addEventListener('click', () => { set('limitedCount', s.limitedCount + 1); buildPalette(); toast('New color added'); });
    pinned.append(more);
  }
  if (!s.limited) {
    const custom = document.createElement('label');
    custom.className = 'swatch tool';
    custom.setAttribute('aria-label', 'Pick any color');
    custom.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8"/><path d="M12 4v16M4 12h16"/></svg><input type="color" aria-label="Pick any color">';
    const input = custom.querySelector('input');
    input.value = s.custom || s.color;
    input.addEventListener('change', () => { set('custom', input.value); set('color', input.value); buildPalette(); pickedColor(); });
    pinned.append(custom);
  }
  const sh = document.createElement('button');
  sh.className = 'swatch tool';
  sh.setAttribute('aria-pressed', String(s.shading));
  sh.setAttribute('aria-label', 'Auto-shade cube faces');
  sh.title = 'Auto-shade cube faces';
  sh.innerHTML = GLYPHS.cube;
  sh.addEventListener('click', () => { set('shading', !s.shading); buildPalette(); syncMenu(); toast(s.shading ? 'Auto-shade on: top light, left mid, right dark' : 'Auto-shade off'); });
  pinned.append(sh);
  if (s.limited && !palette().includes(s.color)) set('color', palette()[0]);
}

// A color pick on the Eraser means "paint now": switch to the Pencil (palette.js).
function pickedColor() {
  const next = toolAfterColorPick(app.settings.tool);
  if (next !== app.settings.tool) setTool(next);
}

// ---------- tools and the options popover ----------
function setTool(tool) {
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
function setMoveMode(on, say = false) {
  app.moveMode = on;
  $('#move-mode').setAttribute('aria-pressed', String(on));
  document.body.classList.toggle('moving', on);
  updateCursor();
  if (on) { app.ghost = null; app.ghostSkip = null; requestRender(); }
  if (say) toast(on ? 'Move: drag to move the view. Tap a tool to draw.' : 'Drawing again');
}
// The hand cursor while a drag would pan; the closed hand during one.
function updateCursor() {
  canvas.classList.toggle('pan-ready', app.moveMode || spaceHeld);
  canvas.classList.toggle('panning', gesture?.kind === 'pan');
}
function updateOptionsButton() {
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
function openPopover() {
  const s = app.settings, pop = $('#popover');
  const items = s.tool === 'line'
    ? [['strip', 'Strip'], ['edge', 'Edge']].map(([k, t]) => ({ k, t, g: GLYPHS[k], on: s.lineStyle === k, pick: () => set('lineStyle', k) }))
    : s.tool === 'select'
      ? [['triangle', 'Triangle'], ['rhombus', 'Rhombus'], ['hexagon', 'Hexagon']].map(([k, t]) => ({ k, t, g: GLYPHS['m-' + k], on: s.marquee === k, pick: () => set('marquee', k) }))
      : Object.entries(BRUSH_LABEL).map(([k, t]) => ({ k, t, g: GLYPHS[k], on: s.brush === k, pick: () => set('brush', k), off: k === 'stamp' && !app.stamps.length }));
  const title = s.tool === 'line' ? 'Line style' : s.tool === 'select' ? 'Selection shape (press a grid point, drag)' : 'Brush shape';
  pop.innerHTML = `<h4>${title}</h4>`;
  pop.setAttribute('aria-label', title);
  for (const it of items) {
    const b = document.createElement('button');
    b.className = 'btn';
    b.setAttribute('aria-pressed', String(it.on));
    b.innerHTML = `${it.g}<span>${it.t}</span>`;
    if (it.off) { b.disabled = true; b.title = 'Select something, then Save as stamp'; }
    b.addEventListener('click', () => { it.pick(); closePopover(); updateOptionsButton(); });
    pop.append(b);
  }
  if (s.tool !== 'line' && s.tool !== 'select' && app.stamps.length > 1 && s.brush === 'stamp') {
    const h = document.createElement('h4'); h.textContent = 'Stamps'; pop.append(h);
    app.stamps.forEach((st, i) => {
      const b = document.createElement('button');
      b.className = 'btn';
      b.setAttribute('aria-pressed', String(i === app.stampIndex));
      b.innerHTML = `${GLYPHS.stamp}<span>${st.name}</span>`;
      b.addEventListener('click', () => { app.stampIndex = i; closePopover(); });
      pop.append(b);
    });
  }
  pop.hidden = false;
  $('#options').setAttribute('aria-expanded', 'true');
  pop.querySelector('button')?.focus();
}
function closePopover() {
  $('#popover').hidden = true;
  $('#options').setAttribute('aria-expanded', 'false');
}

// ---------- painting ----------
function specFor(it, erase) {
  if (erase) return null;
  if (it.c) return { c: it.c, f: it.f };
  const base = app.settings.color;
  if (app.settings.shading && it.f) return { c: shade(base, it.f), f: it.f };
  return { c: base };
}
function applyCells(items, erase) {
  const all = S.expandCells(items, symCenter(), app.settings.symmetry);
  const mode = erase ? 'replace' : app.settings.protect;
  // Note what Keep fine detail skips, to show it when the stroke ends.
  for (const c of protectSplit(app.drawing, all.map((it) => it.cell), mode).skip) app.strokeSkips.set(L.cellKey(c), c);
  for (const it of all) app.drawing.paint(it.cell, specFor(it, erase), mode);
}
// After a stroke: hatch the skipped cells for a moment, and say why once a session.
function reportSkips() {
  const skipped = [...app.strokeSkips.values()];
  app.strokeSkips.clear();
  if (!skipped.length) return;
  app.skipFlash = skipped;
  clearTimeout(app.skipTimer);
  app.skipTimer = setTimeout(() => { app.skipFlash = null; requestRender(); }, 1600);
  const msg = skipNotice(app.session, skipped.length);
  if (msg) { $('#protect-text').textContent = msg; $('#protect-note').hidden = false; }
}
function updateModeChip() {
  const m = app.settings.protect, chip = $('#mode-chip');
  chip.dataset.mode = m;
  if (!$('#mode-icon').childElementCount) $('#mode-icon').outerHTML = GLYPHS['mode-can'].replace('<svg', '<svg id="mode-icon"');
  $('#mode-label').textContent = MODE_LABEL[m];
  const next = nextMode(m);
  chip.setAttribute('aria-label', `${MODE_SAYS[m]}. Tap for ${next === 'behind' ? 'Paint behind' : MODE_LABEL[next]}.`);
  chip.title = MODE_SAYS[m];
}
function cycleMode() {
  set('protect', nextMode(app.settings.protect));
  updateModeChip();
  syncMenu();
  toast(MODE_SAYS[app.settings.protect]);
}
function applyEdges(edges, color) {
  for (const e of S.expandEdges(edges, symCenter(), app.settings.symmetry)) app.drawing.paintEdge(e, color ? { c: color } : null);
}
// The eraser also lifts bold edges near the finger.
function eraseEdgesNear(x, y) {
  const r = L.edgeLen(app.level) * 0.6;
  for (const k of [...app.drawing.edges.keys()]) {
    const e = L.parseEdgeKey(k);
    const [[p0, q0], [p1, q1]] = L.edgeEnds(e);
    const a = L.vertexWorld(e.l, p0, q0), b = L.vertexWorld(e.l, p1, q1);
    if (Math.hypot((a.x + b.x) / 2 - x, (a.y + b.y) / 2 - y) < Math.max(r, L.edgeLen(e.l) * 0.5)) app.drawing.setEdge(k, null);
  }
}
function brushAt(x, y) {
  return B.brushCells(app.settings.brush, app.level, x, y);
}
function stampItemsAt(x, y) {
  const st = app.stamps[app.stampIndex];
  if (!st) return { cells: [], edges: [] };
  const A = L.nearestVertex(app.level, x, y);
  return D.placeStamp(st.stamp, A);
}

function doFill(x, y) {
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
      const spec = app.settings.shading && f ? { c: shade(app.settings.color, f), f } : { c: app.settings.color };
      app.drawing.paint(leaf.cell, spec, 'replace');
    }
  }
  commit();
  if (coarser) toast('A big area: filled with bigger cells to keep it quick.');
}

function commit() {
  app.drawing.commit();
  afterChange();
}
// changed: false after loading a drawing, which is no change to save to a file.
function afterChange({ changed = true } = {}) {
  $('#undo').disabled = !app.drawing.undoStack.length;
  $('#redo').disabled = !app.drawing.redoStack.length;
  updateSelbar();
  scheduleSave(changed);
  requestRender();
}
function undo() {
  cancelGesture();
  const d = app.drawing.undo();
  if (!d) return;
  // Undoing a density change also puts the marquee back where it was.
  if (app.lastDensity && d === app.lastDensity.diff && app.selection) app.selection.region = app.lastDensity.before;
  toast('Undone');
  afterChange();
}
function redo() { cancelGesture(); if (app.drawing.redo()) { toast('Redone'); afterChange(); } }

// ---------- selection and density ----------
function marqueeRegion(A, wx, wy) {
  const t = L.worldToLattice(A.l, wx, wy);
  const dp = t.pp - A.p, dq = t.qq - A.q;
  const shape = app.settings.marquee;
  const cells = shape === 'triangle' ? B.triangleRegion(A, dp, dq).cells
    : shape === 'rhombus' ? B.parallelogram(A, dp, dq).cells
      : B.hexagon(A, B.hexRadius(dp, dq)).cells;
  return D.makeRegion(A.l, cells);
}
function selDensity() { return app.selection ? D.densityOf(app.drawing, app.selection.region) : 0; }
function updateSelbar() {
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
function setDensity(T) {
  const sel = app.selection;
  if (!sel) return false;
  const before = sel.region;
  app.drawing.begin('density');
  const r = D.changeDensity(app.drawing, before, T, densityOpts());
  if (!r) { app.drawing.rollback(); toast('The selection edges do not line up with bigger cells. Select a bigger shape.'); return false; }
  const diff = app.drawing.commit();
  sel.region = r;
  app.lastDensity = diff ? { diff, before, T } : null;
  toast(`Density: level ${selDensity()}`);
  afterChange();
  return true;
}
function densityOpts() {
  const s = app.settings;
  return { mode: s.coarsen, snap: s.snap || s.limited, palette: palette() };
}
// Flip Crisp/Blend; if the last action was a coarsen, redo it with the new rule.
function toggleCoarsen() {
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
function placeHandle() {
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
let preview = null;
function previewStart() {
  if (!app.selection) return null;
  const r = app.selection.region;
  const d0 = D.densityOf(app.drawing, r);
  preview = { before: r, d0, T: d0, min: Math.min(d0, D.coarsestReachable(r)) };
  app.drawing.begin('density');
  renderTrack();
  return preview;
}
function previewTo(T) {
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
function previewEnd(keep = true) {
  if (!preview) return;
  if (keep && preview.T !== preview.d0) {
    const diff = app.drawing.commit();
    app.lastDensity = diff ? { diff, before: preview.before, T: preview.T } : null;
    toast(`Density: level ${preview.T}`);
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

// ---------- pointer input ----------
const pointers = new Map();
let gesture = null;
let spaceHeld = false;

function local(e) {
  const r = canvas.getBoundingClientRect();
  return [e.clientX - r.left, e.clientY - r.top];
}
function worldOf(e) { const [x, y] = local(e); return app.view.toWorld(x, y); }

function cancelGesture() {
  if (!gesture) return;
  if (gesture.tx && app.drawing.inTx) app.drawing.rollback();
  if (gesture.kind === 'density') previewEnd(false);
  clearTimeout(gesture.timer);
  gesture = null;
  app.crosshair = null;
  updateCursor();
  requestRender();
}

function startTwoFinger() {
  const pts = [...pointers.values()];
  const dist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
  const mid = [(pts[0].x + pts[1].x) / 2, (pts[0].y + pts[1].y) / 2];
  const s = app.settings;
  const prior = gesture;
  // A young or short stroke was the first finger of a pinch: drop it. A real one is kept.
  if (prior && prior.tx && app.drawing.inTx) {
    if (dropOnSecondFinger({ ageMs: performance.now() - prior.t0, travelPx: prior.travel || 0 })) { app.drawing.rollback(); app.strokeSkips.clear(); } else { commit(); reportSkips(); }
  }
  clearTimeout(prior?.timer);
  app.crosshair = null;
  const insideSel = prior && prior.startInSel;
  if (app.selection && s.tool === 'select' && ((s.densityPinch && insideSel) || (prior && prior.armed))) {
    previewStart();
    gesture = { kind: 'density', dist };
    toast('Density: pinch out finer, in coarser');
    return;
  }
  gesture = { kind: 'pinch', dist, mid, zoom: app.view.zoom, world: app.view.toWorld(...mid) };
  updateCursor();
}

function inSelection(wx, wy) {
  const sel = app.selection;
  return !!sel && sel.region.keys.has(L.cellKey(L.hitTest(sel.region.l, wx, wy)));
}

function onDown(e) {
  if (app.replaying) { stopReplay(); return; }
  closePopover();
  try { canvas.setPointerCapture(e.pointerId); } catch { /* synthetic or already gone */ }
  const [x, y] = local(e);
  pointers.set(e.pointerId, { x, y, type: e.pointerType });
  if (pointers.size === 2) { startTwoFinger(); return; }
  if (pointers.size > 2) return;
  const does = oneFinger({ moveMode: app.moveMode && !app.pickCenter, button: e.button, pointerType: e.pointerType, spaceHeld });
  if (does === 'pan') { gesture = { kind: 'pan', x, y }; app.ghost = null; updateCursor(); requestRender(); return; }
  if (does === 'ignore') return;
  const [wx, wy] = app.view.toWorld(x, y);
  const s = app.settings;
  const t0 = performance.now();
  app.ghost = null;

  if (app.pickCenter) {
    const v = L.nearestVertex(app.level, wx, wy);
    set('symL', v.l); set('symP', v.p); set('symQ', v.q);
    if (s.symmetry === 'off') set('symmetry', 'rot6mirror');
    app.pickCenter = false;
    syncMenu();
    toast('Symmetry center set');
    gesture = { kind: 'none' };
    requestRender();
    return;
  }

  const erase = s.tool === 'eraser';
  if (s.tool === 'pencil' || erase) {
    if (DRAG_BRUSHES.has(s.brush)) {
      const A = L.nearestVertex(app.level, wx, wy);
      gesture = { kind: 'drag', tx: true, t0, A, erase, x, y, sx: x, sy: y, travel: 0 };
      app.drawing.begin(s.brush);
      dragApply(gesture, wx, wy);
    } else {
      gesture = { kind: 'stroke', tx: true, t0, last: [wx, wy], erase, sx: x, sy: y, travel: 0 };
      app.drawing.begin(erase ? 'erase' : 'paint');
      applyCells(brushAt(wx, wy), erase);
      if (erase) eraseEdgesNear(wx, wy);
    }
  } else if (s.tool === 'line') {
    const A = L.nearestVertex(app.level, wx, wy);
    gesture = { kind: 'line', tx: true, t0, A, start: [wx, wy], sx: x, sy: y, travel: 0 };
    app.drawing.begin('line');
    lineApply(gesture, wx, wy);
  } else if (s.tool === 'fill') {
    doFill(wx, wy);
    gesture = { kind: 'none' };
  } else if (s.tool === 'select') {
    const startInSel = inSelection(wx, wy);
    // Anchor on a vertex of the next coarser level, so an even-sized marquee
    // lines up with bigger cells and can be coarsened without shrinking.
    const A = L.vertexAt(L.nearestVertex(Math.max(0, app.level - 1), wx, wy), app.level);
    gesture = { kind: 'marquee', A, x, y, moved: false, startInSel, t0 };
    app.crosshair = A;
    if (startInSel && s.densityLongpress) {
      gesture.timer = setTimeout(() => {
        if (gesture && gesture.kind === 'marquee' && !gesture.moved) {
          gesture.armed = true;
          app.crosshair = null;
          toast('Density mode: now pinch with a second finger');
          if (navigator.vibrate) navigator.vibrate(20);
        }
      }, 500);
    }
  }
  requestRender();
}

function dragApply(g, wx, wy) {
  app.strokeSkips.clear(); // each preview redoes the whole shape
  const s = app.settings;
  if (app.drawing.inTx) app.drawing.rollback();
  app.drawing.begin(s.brush);
  if (s.brush === 'stamp') {
    const { cells, edges } = stampItemsAt(wx, wy);
    applyCells(cells, g.erase);
    if (!g.erase) for (const { edge, c } of edges) applyEdges([edge], c);
    return;
  }
  const t = L.worldToLattice(g.A.l, wx, wy);
  const dp = t.pp - g.A.p, dq = t.qq - g.A.q;
  const cells = s.brush === 'face' ? B.parallelogram(g.A, dp, dq).cells : B.hexagon(g.A, B.hexRadius(dp, dq)).cells;
  applyCells(cells, g.erase);
}

function lineApply(g, wx, wy) {
  if (app.drawing.inTx) app.drawing.rollback();
  app.drawing.begin('line');
  if (app.settings.lineStyle === 'edge') {
    const t = L.worldToLattice(g.A.l, wx, wy);
    applyEdges(B.edgeLine(g.A, t.pp - g.A.p, t.qq - g.A.q).edges, app.settings.color);
  } else {
    applyCells(B.strip(app.level, g.start[0], g.start[1], wx, wy).cells, false);
  }
}

function onMove(e) {
  const [x, y] = local(e);
  if (pointers.has(e.pointerId)) pointers.set(e.pointerId, { x, y, type: e.pointerType });
  if (!gesture) { hover(e); return; }
  const [wx, wy] = app.view.toWorld(x, y);
  const g = gesture;
  // How far a stroke has gone from where it started, for dropOnSecondFinger.
  if (g.tx) g.travel = Math.max(g.travel || 0, Math.hypot(x - g.sx, y - g.sy));
  if (g.kind === 'pinch' && pointers.size >= 2) {
    const pts = [...pointers.values()];
    const dist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
    const mid = [(pts[0].x + pts[1].x) / 2, (pts[0].y + pts[1].y) / 2];
    const v = app.view;
    v.zoom = g.zoom;
    v.cx = g.world[0] - (g.mid[0] - v.w / 2) / v.zoom;
    v.cy = g.world[1] - (g.mid[1] - v.h / 2) / v.zoom;
    v.zoomAt(g.mid[0], g.mid[1], dist / g.dist);
    v.pan(mid[0] - g.mid[0], mid[1] - g.mid[1]);
    computeLevel();
    requestRender();
  } else if (g.kind === 'density' && pointers.size >= 2) {
    const pts = [...pointers.values()];
    const dist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
    previewTo(preview.d0 + Math.round(Math.log(dist / g.dist) / Math.log(1.6)));
  } else if (g.kind === 'pan') {
    app.view.pan(x - g.x, y - g.y);
    g.x = x; g.y = y;
    requestRender();
  } else if (g.kind === 'stroke') {
    // Single cells need fine sampling, or a line grazing a vertex skips the
    // cell it barely crosses and the stroke breaks into corner-to-corner pieces.
    const step = L.edgeLen(app.level) / (app.settings.brush === 'triangle' ? 16 : 4);
    for (const [px, py] of B.samplePath(g.last[0], g.last[1], wx, wy, step)) {
      applyCells(brushAt(px, py), g.erase);
      if (g.erase) eraseEdgesNear(px, py);
    }
    g.last = [wx, wy];
    requestRender();
  } else if (g.kind === 'drag') {
    dragApply(g, wx, wy);
    requestRender();
  } else if (g.kind === 'line') {
    lineApply(g, wx, wy);
    requestRender();
  } else if (g.kind === 'marquee') {
    if (Math.hypot(x - g.x, y - g.y) > 6) g.moved = true;
    if (g.moved && !g.armed) {
      clearTimeout(g.timer);
      g.region = marqueeRegion(g.A, wx, wy);
      app.selection = { region: g.region, anchor: g.A, live: true };
      $('#selbar').hidden = true;
      $('#handle').hidden = true;
      requestRender();
    }
  }
}

function onUp(e) {
  pointers.delete(e.pointerId);
  const g = gesture;
  if (!g) return;
  if (g.kind === 'pinch' || g.kind === 'density') {
    if (pointers.size < 2) {
      if (g.kind === 'density') previewEnd(true);
      // The finger left after a pinch moves the view; it never draws.
      const [rest] = [...pointers.values()];
      gesture = !rest ? null : g.kind === 'pinch' && oneFinger({ afterPinch: true }) === 'pan' ? { kind: 'pan', x: rest.x, y: rest.y } : { kind: 'none' };
      updateCursor();
    }
    return;
  }
  if (pointers.size) return;
  gesture = null;
  updateCursor();
  if (g.tx) {
    if (e.type === 'pointercancel') { app.drawing.rollback(); app.strokeSkips.clear(); } else { commit(); reportSkips(); }
  }
  if (g.kind === 'marquee') {
    clearTimeout(g.timer);
    app.crosshair = null;
    if (!g.moved) {
      if (app.selection && !g.armed) { app.selection = null; app.lastDensity = null; }
      else if (!app.selection) app.selection = { region: marqueeRegion(g.A, ...app.view.toWorld(g.x + 1, g.y + 1)), anchor: g.A };
    } else if (g.region) {
      app.selection = { region: g.region, anchor: g.A };
      app.lastDensity = null;
    }
    updateSelbar();
  }
  requestRender();
}

function hover(e) {
  if (e.pointerType === 'touch') return;
  if (app.moveMode) { if (app.ghost) { app.ghost = null; app.ghostSkip = null; requestRender(); } return; }
  const s = app.settings;
  app.ghostSkip = null;
  let items = null;
  if ((s.tool === 'pencil' || s.tool === 'eraser') && !DRAG_BRUSHES.has(s.brush)) items = brushAt(...worldOf(e));
  else if (s.tool === 'pencil' && s.brush === 'stamp') items = stampItemsAt(...worldOf(e)).cells;
  if (items) {
    // The preview outlines what would be painted and hatches what Keep fine detail would skip.
    const cells = S.expandCells(items, symCenter(), s.symmetry).map((i) => i.cell);
    const split = protectSplit(app.drawing, cells, s.tool === 'eraser' ? 'replace' : s.protect);
    app.ghost = split.paint;
    app.ghostSkip = split.skip.length ? split.skip : null;
  } else app.ghost = null;
  requestRender();
}

function onWheel(e) {
  e.preventDefault();
  const [x, y] = local(e);
  if (e.ctrlKey || e.metaKey || e.deltaMode === 1) {
    const dy = e.deltaMode === 1 ? e.deltaY * 16 : e.deltaY;
    app.view.zoomAt(x, y, Math.exp(-dy * 0.01));
    computeLevel();
  } else {
    app.view.pan(-e.deltaX, -e.deltaY);
  }
  requestRender();
}

function zoomBy(f) {
  app.view.zoomAt(app.view.w / 2, app.view.h / 2, f);
  computeLevel();
  requestRender();
}
// ---------- zoom slider ----------
// The left rail: + and − double and halve the zoom (one level each), the
// track sets it directly, even in log scale. All of it zooms about the center.
const ZOOM_THUMB = 28;
function zoomTo(z) {
  zoomBy(z / app.view.zoom);
  showReadout(true);
}
function buildZoom() {
  const track = $('#zoom-track');
  let sliding = false;
  const setFrom = (e) => {
    const r = track.getBoundingClientRect();
    zoomTo(sliderToZoom(1 - (e.clientY - r.top - ZOOM_THUMB / 2) / (r.height - ZOOM_THUMB)));
  };
  track.addEventListener('pointerdown', (e) => { sliding = true; try { track.setPointerCapture(e.pointerId); } catch { /* synthetic */ } setFrom(e); });
  track.addEventListener('pointermove', (e) => { if (sliding) setFrom(e); });
  track.addEventListener('pointerup', () => { sliding = false; });
  track.addEventListener('pointercancel', () => { sliding = false; });
  track.addEventListener('keydown', (e) => {
    const f = { ArrowUp: Math.SQRT2, ArrowRight: Math.SQRT2, ArrowDown: Math.SQRT1_2, ArrowLeft: Math.SQRT1_2, PageUp: 2, PageDown: 0.5 }[e.key];
    const to = { Home: MIN_ZOOM, End: MAX_ZOOM }[e.key];
    if (f == null && to == null) return;
    e.preventDefault();
    zoomTo(to ?? app.view.zoom * f);
  });
  $('#zoom-in').addEventListener('click', () => zoomTo(app.view.zoom * 2));
  $('#zoom-out').addEventListener('click', () => zoomTo(app.view.zoom / 2));
}
let zoomShown = null;
function updateZoomUI() {
  const z = app.view.zoom;
  if (z === zoomShown) return;
  zoomShown = z;
  const t = zoomToSlider(z), track = $('#zoom-track');
  track.style.setProperty('--t', t);
  track.setAttribute('aria-valuenow', String(Math.round(t * 100)));
  track.setAttribute('aria-valuetext', `${zoomLabel(z)} zoom`);
  track.title = `Zoom ${zoomLabel(z)}`;
  $('#zoom-in').disabled = z >= MAX_ZOOM * 0.999;
  $('#zoom-out').disabled = z <= MIN_ZOOM * 1.001;
}
// ⌖ and the 0 key: frame everything drawn in the part of the screen the
// controls leave clear; on empty paper, back to the start.
function fitView() {
  const b = bounds(app.drawing);
  if (!b) {
    app.view.reset();
    toast('View reset');
  } else {
    const r = (sel) => { const el = $(sel); return el && el.getClientRects().length ? el.getBoundingClientRect() : null; }; // offsetParent is null for fixed boxes
    const { w, h } = app.view, pad = 16;
    const rect = { x0: pad, y0: pad, x1: w - pad, y1: h - pad };
    const zoom = r('#zoom'), levels = r('#levels'), tops = ['.topleft', '.topright'].map(r).filter(Boolean);
    const lows = ['.bottom > .palette', '.bottom > .tools'].map(r).filter(Boolean);
    if (zoom) rect.x0 = zoom.right + pad;
    // The level control is a side rail on phones and a bar under the top row on wider screens.
    if (levels && levels.height > levels.width) rect.x1 = levels.left - pad;
    else if (levels) tops.push(levels);
    for (const t of tops) rect.y0 = Math.max(rect.y0, t.bottom + pad);
    for (const l of lows) rect.y1 = Math.min(rect.y1, l.top - pad);
    app.view.fitTo(b, rect);
    toast('Fit to the drawing');
  }
  computeLevel(true);
  requestRender();
}

// ---------- keyboard ----------
// Keys come from the table in keys.js; the Help sheet lists the same table.
const ANYWHERE = new Set(['save', 'saveas', 'open']); // Ctrl+S, Ctrl+Shift+S, Ctrl+O work in the sheets too
function onKey(e) {
  if (e.target.closest && e.target.closest('dialog, input, select, textarea') && !ANYWHERE.has(keyFor(e)?.action)) return;
  if (e.key === ' ') {
    if (e.type === 'keydown') { spaceHeld = true; e.preventDefault(); } else spaceHeld = false;
    updateCursor();
    return;
  }
  if (e.type === 'keyup') return;
  const row = keyFor(e);
  if (!row) return;
  if (row.match[0].mod) e.preventDefault();
  const [what, arg] = row.action.split(':');
  const cur = app.settings.locked ? app.settings.lockedLevel : app.settings.notch;
  const run = {
    tool: () => setTool(arg),
    options: () => { if (!$('#options').disabled) openPopover(); },
    size: () => chooseNotch(Math.max(0, Math.min(7, cur + Number(arg)))),
    lock: toggleLock,
    gutters: () => { set('gutters', !app.settings.gutters); syncMenu(); requestRender(); },
    reset: fitView,
    zoom: () => zoomBy(arg === 'in' ? 1.25 : 0.8),
    settings: openSettings,
    drawing: openDrawing,
    help: openHelp,
    move: () => setMoveMode(!app.moveMode, true),
    save: () => saveFile(),
    saveas: () => saveFile({ asNew: true }),
    open: () => askFirst('open'),
    escape: () => { closePopover(); if (app.moveMode) setMoveMode(false); if (app.selection) { app.selection = null; updateSelbar(); requestRender(); } },
    undo, redo,
  }[what];
  if (run) run();
}

// ---------- help ----------
function openHelp() {
  $('#help-body').innerHTML = helpHTML((sel) => {
    const svg = document.querySelector(`${sel} svg`);
    return svg ? svg.outerHTML.replace(/ id="[^"]*"/g, '') : '';
  });
  openSheet('#help');
}

// ---------- sheets ----------
// Each sheet is a modal <dialog> (it keeps focus inside, and Esc closes it).
// One sheet at a time; closing gives focus back to the button that opened it.
let opener = null;
function openSheet(sel) {
  for (const d of document.querySelectorAll('dialog[open]')) d.close();
  opener = document.activeElement instanceof HTMLElement && document.activeElement !== document.body ? document.activeElement : opener;
  $(sel).showModal();
}
for (const d of document.querySelectorAll('dialog')) {
  d.addEventListener('close', () => { if (opener && document.contains(opener) && !document.querySelector('dialog[open]')) opener.focus({ preventScroll: true }); });
}

// Settings: folding sections with a chip naming the current value; which are
// open is this device's (localStorage, like the other settings).
const OPEN_KEY = 'isopix-settings-open';
function readOpen() { try { return rememberedOpen(localStorage.getItem(OPEN_KEY)); } catch { return new Set(); } }
function showFold(id, open) {
  const sec = $('#' + id), head = sec.querySelector('.set-head');
  head.setAttribute('aria-expanded', String(open));
  head.querySelector('.set-head-caret').textContent = open ? '▾' : '▸';
  sec.querySelector('.set-body').hidden = !open;
}
function saveOpen() {
  const open = new Set(SECTION_IDS.filter((id) => $('#' + id + ' .set-head').getAttribute('aria-expanded') === 'true'));
  try { localStorage.setItem(OPEN_KEY, rememberOpen(open)); } catch { /* storage blocked */ }
}
function updateChips() {
  const s = { ...app.settings, trace: !!app.trace };
  for (const id of SECTION_IDS) $('#' + id + '-chip').textContent = chipText(id, s, app.drawing.paper);
}
function openSettings() { syncMenu(); openSheet('#settings'); }
function syncMenu() {
  const s = app.settings;
  const radio = (name, v) => { const el = document.querySelector(`input[name="${name}"][value="${v}"]`); if (el) el.checked = true; };
  radio('protect', s.protect); radio('symmetry', s.symmetry); radio('hint', s.hint);
  $('#opt-shading').checked = s.shading;
  $('#opt-gutters').checked = s.gutters;
  $('#opt-hint-levels').value = String(s.hintLevels);
  $('#opt-handle').checked = s.densityHandle;
  $('#opt-pinch').checked = s.densityPinch;
  $('#opt-longpress').checked = s.densityLongpress;
  $('#opt-limited').checked = s.limited;
  $('#opt-gray').checked = s.gray;
  $('#opt-save-png').checked = s.savePng;
  $('#opt-save-png-row').hidden = !store.offersIsopixFile({ ios: store.isIOS() });
  $('#file-save-label').textContent = savesPng() ? 'Save file' : 'Save Isopix drawing';
  $('#opt-trace').value = String(s.traceOpacity);
  document.body.classList.toggle('gray', s.gray);
  const dark = paperName(app.drawing.paper) === 'dark';
  $('#paper-flip').textContent = dark ? 'Paper: dark · switch to light' : 'Paper: light · switch to dark';
  updateChips();
}

// The Drawing sheet: the name, New, Open, Save file, Save picture, SVG, time-lapse.
function openDrawing() {
  $('#drawing-name').value = app.drawingName;
  $('#new-confirm').hidden = true;
  updateSavedLine();
  openSheet('#drawing');
}
function updateSavedLine() {
  $('#autosave-status').textContent = savedAgo(app.lastSaved ? Date.now() - app.lastSaved : null);
  $('#file-status').textContent = fileLine({ ...app.file, linked: !!app.file.handle }, hasContent());
}
function setName(name) {
  app.drawingName = cleanName(name);
  $('#drawing-name-small').textContent = app.drawingName === 'Untitled drawing' ? '' : app.drawingName;
  $('#drawing-open').setAttribute('aria-label', `Drawing: ${app.drawingName}. Name, new, open, save`);
}
const hasContent = () => app.drawing.cells.size > 0 || app.drawing.edges.size > 0 || app.drawing.undoStack.length > 0;

// ---------- saving to files ----------
// storage.js picks the way: the Save dialog (then Save writes that same file
// again), the share sheet on iPhone and iPad, or a download. app.file says
// whether the drawing is in a file; the Save buttons wear a dot when not.
// An .isopix file is the project's JSON, gzip-compressed (plain JSON too:
// the iPhone share sheet needs the file at once, before gzip could finish).
const ISOPIX_TYPE = { type: 'application/x-isopix', accept: { description: 'Isopix drawing', ext: ['.isopix'] } };
const PNG_TYPE = { type: 'image/png', accept: { description: 'Isopix drawing (a picture with the drawing inside)', ext: ['.png'] } };
// Save's file: a PNG with the whole project inside (engine/pngproject.js), or
// with that setting off, an .isopix file (Owner: "call it save isopix drawing,
// and use the idea of an .isopix extension here"; "this was instead of the json file").
// The PNG unless the setting is off on a device that offers .isopix files.
const savesPng = () => app.settings.savePng || !store.offersIsopixFile({ ios: store.isIOS() });
const saveExt = () => (savesPng() ? '.isopix.png' : '.isopix');
function isopixFile({ now = false } = {}) {
  const json = new TextEncoder().encode(JSON.stringify(projectData()));
  if (now) return new Blob([json], { type: ISOPIX_TYPE.type });
  return store.gzip(json).then((z) => new Blob([z], { type: ISOPIX_TYPE.type }));
}
app.isopixFile = isopixFile; // for tools/export_check.mjs
function updateFileUI() {
  const dot = saveDot(app.file, hasContent());
  for (const b of ['#top-save', '#file-save']) {
    $(b).classList.toggle('unsaved', dot);
    $(b).setAttribute('aria-label', `Save the project file${dot ? ' (changes since the last save)' : ''}`);
  }
  $('#file-saveas').hidden = !app.file.handle;
  if ($('#drawing').open) updateSavedLine();
}
// The file record outlives a reload (IndexedDB can keep a file handle in
// Chrome; where it cannot, it is kept without one).
async function rememberFile() {
  if (!(await store.idbSet('file', app.file))) await store.idbSet('file', { ...app.file, handle: null });
}
// Every change: the dot follows whether something drawn is not in a file
// (already "changed" on an empty page, a first stroke still needs the dot).
function markChanged() {
  if (!app.file.dirty) {
    app.file.dirty = true;
    if (app.file.at) rememberFile();
  }
  updateFileUI();
}
function fileSaved(r, via) {
  app.file = { name: r.name, at: Date.now(), via, dirty: false, handle: r.handle || null };
  rememberFile();
  updateFileUI();
}
// What a save says: where it went, or that nothing was saved.
function sayResult(r, what) {
  if (r.cancelled) toast('Not saved');
  else if (r.failed) toast(`Could not save the ${what}: ${r.failed}`);
  else if (r.handle) toast(`Saved to ${r.name}`);
  else if (r.how === 'share') toast(`${what[0].toUpperCase()}${what.slice(1)} saved`);
  else toast(`Saved ${r.name} to your downloads`);
}
// Returns true once the drawing is in a file. A file kept from an earlier
// Save is written again only when it is the same kind (PNG or project file).
async function saveFile({ asNew = false } = {}) {
  const png = savesPng();
  if (png && !pngCanvas()) { toast('Nothing to save yet'); return false; }
  const ext = saveExt(), h = app.file.handle;
  const handle = !asNew && h && String(h.name || '').endsWith(ext) ? h : null;
  const r = await store.saveBlob({ name: `${fileBase(app.drawingName)}${ext}`, ...(png ? PNG_TYPE : ISOPIX_TYPE), make: png ? projectPng : isopixFile, handle });
  sayResult(r, 'project file');
  if (r.cancelled || r.failed) return false;
  fileSaved(r, 'save');
  return true;
}
// The share sheet needs the picture at once, so it is encoded here, in the tap.
function canvasBytesNow(c) {
  const bin = atob(c.toDataURL('image/png').split(',')[1]);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}
const canvasBlobNow = (c) => new Blob([canvasBytesNow(c)], { type: 'image/png' });
// The picture with the whole project inside it. now: at once, uncompressed
// (the share sheet); else compressed.
function projectPng({ now = false } = {}) {
  const c = pngCanvas();
  if (!c) throw new Error('nothing drawn');
  const text = JSON.stringify(projectData());
  if (now) return new Blob([PNGP.embedNow(canvasBytesNow(c), text)], { type: 'image/png' });
  return new Promise((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error('the picture is too big for this browser'))), 'image/png'))
    .then(async (b) => new Blob([await PNGP.embed(new Uint8Array(await b.arrayBuffer()), text, store.deflate)], { type: 'image/png' }));
}
app.projectPng = projectPng; // for tools/export_check.mjs
async function savePicture() {
  const c = pngCanvas();
  if (!c) return toast('Nothing to save yet');
  const make = ({ now }) => (now ? canvasBlobNow(c) : new Promise((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error('the picture is too big for this browser'))), 'image/png')));
  sayResult(await store.saveBlob({ name: `${fileBase(app.drawingName)}.png`, type: 'image/png', accept: { description: 'PNG picture', ext: ['.png'] }, make }), 'picture');
}
async function saveVector() {
  if (!app.drawing.cells.size && !app.drawing.edges.size) return toast('Nothing to save yet');
  sayResult(await store.saveBlob({ name: `${fileBase(app.drawingName)}.svg`, type: 'image/svg+xml', accept: { description: 'SVG vector picture', ext: ['.svg'] }, make: () => svgBlob() }), 'vector picture');
}
function startNew() {
  app.drawing = newDrawing(); app.selection = null; app.lastDensity = null; app.trace = null;
  setName('');
  app.file = { name: null, at: null, via: null, dirty: false, handle: null };
  rememberFile();
  buildPalette(); syncMenu(); afterChange({ changed: false }); updateFileUI();
  if ($('#drawing').open) $('#drawing').close();
  toast('New drawing');
}
// New and Open replace this drawing, so they ask first when there is
// something not yet in a file (sheets.js newChoices). `pending` is which.
let pending = 'new';
const CONFIRM = {
  new: { ask: 'Start a new drawing? This browser keeps one drawing, so New replaces this one. Save a file first to keep it.', go: 'New anyway', run: () => startNew() },
  open: { ask: 'Open a file? It replaces this drawing in this browser. Save a file first to keep this one.', go: 'Open anyway', run: () => openProject() },
  moved: { ask: 'Open the drawing from Isopix\'s old address? It replaces this one in this browser. Save a file first to keep this one.', go: 'Open it', run: () => openMoved() },
};
function askFirst(what) {
  if (newChoices(hasContent(), unsavedToFile(app.file, true))[0] === 'new-now') return CONFIRM[what].run();
  pending = what;
  if (!$('#drawing').open) openDrawing();
  $('#new-confirm-text').textContent = CONFIRM[what].ask;
  $('#new-anyway').textContent = CONFIRM[what].go;
  $('#new-save-first').hidden = false;
  $('#new-confirm').hidden = false;
  $('#new-save-first').focus();
}
// Save first, then go on. Opening needs a fresh tap (browsers only show the
// file chooser right after one), so after the save the Open button waits.
async function saveThenGo() {
  if (!(await saveFile())) return;
  if (pending === 'new') return startNew();
  $('#new-confirm-text').textContent = 'Saved. Now open a file?';
  $('#new-save-first').hidden = true;
  $('#new-anyway').textContent = 'Open';
  $('#new-anyway').focus();
}

function wireMenu() {
  $('#settings-open').addEventListener('click', openSettings);
  $('#drawing-open').addEventListener('click', openDrawing);
  const remembered = readOpen();
  for (const id of SECTION_IDS) {
    showFold(id, startsOpen(id, remembered));
    $('#' + id + ' .set-head').addEventListener('click', (e) => {
      showFold(id, e.currentTarget.getAttribute('aria-expanded') !== 'true');
      saveOpen();
    });
  }
  for (const name of ['protect', 'symmetry', 'hint']) {
    for (const el of document.querySelectorAll(`input[name="${name}"]`)) el.addEventListener('change', () => { set(name, el.value); updateModeChip(); updateChips(); requestRender(); });
  }
  const check = (id, key, after) => $(id).addEventListener('change', (e) => { set(key, e.target.checked); after?.(); updateChips(); requestRender(); });
  check('#opt-shading', 'shading', buildPalette);
  check('#opt-gutters', 'gutters');
  check('#opt-handle', 'densityHandle', updateSelbar);
  check('#opt-pinch', 'densityPinch');
  check('#opt-longpress', 'densityLongpress');
  check('#opt-limited', 'limited', buildPalette);
  check('#opt-gray', 'gray', syncMenu);
  check('#opt-save-png', 'savePng', () => { updateFileUI(); syncMenu(); });
  $('#opt-hint-levels').addEventListener('change', (e) => { set('hintLevels', +e.target.value); requestRender(); });
  $('#opt-trace').addEventListener('input', (e) => { set('traceOpacity', +e.target.value); requestRender(); });
  $('#paper-flip').addEventListener('click', flipPaper);
  $('#help-open').addEventListener('click', openHelp);
  $('#sym-center').addEventListener('click', () => { app.pickCenter = true; $('#settings').close(); toast('Tap a grid point for the symmetry center'); });
  $('#trace-open').addEventListener('click', openTrace);
  $('#trace-clear').addEventListener('click', () => { app.trace = null; scheduleSave(); updateChips(); requestRender(); });
  $('#replay').addEventListener('click', () => { $('#settings').close(); startReplay(); });
  // The Drawing sheet and the top bar's New, Open and Save.
  $('#drawing-name').addEventListener('input', (e) => { setName(e.target.value); scheduleSave(); });
  $('#drawing-name').addEventListener('change', (e) => { e.target.value = app.drawingName; });
  $('#file-new').addEventListener('click', () => askFirst('new'));
  $('#top-new').addEventListener('click', () => askFirst('new'));
  $('#file-open').addEventListener('click', () => askFirst('open'));
  $('#top-open').addEventListener('click', () => askFirst('open'));
  $('#file-save').addEventListener('click', () => saveFile());
  $('#top-save').addEventListener('click', () => saveFile());
  $('#file-saveas').addEventListener('click', () => saveFile({ asNew: true }));
  $('#file-png').addEventListener('click', savePicture);
  $('#file-svg').addEventListener('click', saveVector);
  $('#file-replay').addEventListener('click', () => { $('#drawing').close(); startReplay(); });
  $('#new-save-first').addEventListener('click', saveThenGo);
  $('#new-anyway').addEventListener('click', () => { $('#new-confirm').hidden = true; CONFIRM[pending].run(); });
  $('#new-cancel').addEventListener('click', () => { $('#new-confirm').hidden = true; $(pending === 'open' ? '#file-open' : '#file-new').focus(); });
  $('#save-note-save').addEventListener('click', async () => { if (await saveFile()) $('#save-note').hidden = true; });
  $('#save-note-close').addEventListener('click', () => { $('#save-note').hidden = true; });
  $('#move-open').addEventListener('click', () => askFirst('moved'));
  $('#move-close').addEventListener('click', () => { $('#move-note').hidden = true; app.pendingMove = null; });
}

// ---------- files ----------
export function projectData() {
  const s = app.settings;
  const extra = { view: { zoom: app.view.zoom, cx: app.view.cx, cy: app.view.cy }, stamps: app.stamps, symmetry: { mode: s.symmetry, l: s.symL, p: s.symP, q: s.symQ } };
  extra.name = app.drawingName;
  extra.savedAt = Date.now();
  // The trace picture travels with the drawing (made smaller when it was placed).
  if (app.trace && app.trace.src) extra.trace = { src: app.trace.src, rect: app.trace.rect };
  return P.save(app.drawing, extra);
}
export const svgBlob = () => new Blob([toSVG(app.drawing, { background: paperOf(app.drawing.paper).bg })], { type: 'image/svg+xml' });
export function pngCanvas() {
  const d = app.drawing;
  const b = bounds(d);
  if (!b) return null;
  let finest = 0;
  for (const k of d.cells.keys()) finest = Math.max(finest, L.parseKey(k).l);
  for (const k of d.edges.keys()) finest = Math.max(finest, L.parseEdgeKey(k).l);
  const w = b.x1 - b.x0, h = b.y1 - b.y0, pad = 0.05 * Math.max(w, h, 0.1);
  const big = Math.max(w, h) + 2 * pad;
  const scale = Math.min(4096 / big, Math.max(1024 / big, 6 * 2 ** finest));
  const c = document.createElement('canvas');
  c.width = Math.ceil((w + 2 * pad) * scale);
  c.height = Math.ceil((h + 2 * pad) * scale);
  const ctx = c.getContext('2d');
  ctx.fillStyle = paperOf(d.paper).bg;
  ctx.fillRect(0, 0, c.width, c.height);
  const t = { zoom: scale, ox: b.x0 - pad, oy: b.y0 - pad };
  drawCells(ctx, d, t, { x0: b.x0 - pad, y0: b.y0 - pad, x1: b.x1 + pad, y1: b.y1 + pad }, 0.7);
  drawEdges(ctx, d, t);
  return c;
}
export function pngBlob() {
  const c = pngCanvas();
  return c ? new Promise((r) => c.toBlob(r, 'image/png')) : Promise.resolve(null);
}
function loadProjectObject(obj) {
  const d = P.load(obj);
  app.drawing = d;
  if (Array.isArray(obj.stamps)) app.stamps = obj.stamps.filter((s) => s && s.stamp && Array.isArray(s.stamp.cells));
  if (obj.view && Number.isFinite(obj.view.zoom)) { app.view.zoom = obj.view.zoom; app.view.cx = obj.view.cx || 0; app.view.cy = obj.view.cy || 0; }
  app.selection = null;
  app.trace = null;
  setName(obj.name); // old projects have none: "Untitled drawing"
  const tr = P.traceOf(obj);
  if (tr) {
    const img = new Image();
    img.onload = () => { app.trace = { img, rect: tr.rect, src: tr.src }; updateChips(); requestRender(); };
    img.src = tr.src;
  }
  computeLevel(true);
  buildPalette();
  syncMenu();
  afterChange({ changed: false });
}
// A PNG Isopix saved (the drawing is inside it), an .isopix file (gzip or
// plain JSON), or an older .isopix.json.
async function projectFromFile(f) {
  let bytes = new Uint8Array(await f.arrayBuffer());
  if (bytes[0] === 0x1f && bytes[1] === 0x8b) bytes = await store.gunzip(bytes);
  if (!PNGP.isPNG(bytes)) return JSON.parse(new TextDecoder().decode(bytes));
  const text = await PNGP.extract(bytes, store.inflate);
  if (text == null) throw new Error('this picture has no Isopix drawing inside. To draw over a picture, use Settings → Learning → Trace a picture');
  return JSON.parse(text);
}
app.projectFromFile = projectFromFile; // for tools/export_check.mjs
async function openProject() {
  const r = await store.openFile({ accept: { 'image/png': ['.png'], 'application/x-isopix': ['.isopix'], 'application/json': ['.json'] }, description: 'Isopix drawing' });
  if (!r) return;
  const f = r.file;
  if (f.size > 50 * 1024 * 1024) return toast('That file is too big for a project');
  try {
    loadProjectObject(await projectFromFile(f));
    fileSaved({ name: f.name, handle: r.handle }, 'open');
    if ($('#settings').open) $('#settings').close(); if ($('#drawing').open) $('#drawing').close();
    toast(`Opened ${f.name}`);
  } catch (err) { toast(`Could not open it: ${err.message}`); }
}
async function openTrace() {
  const f = await store.pickFile('image/*');
  if (f) placeTrace(f);
}
// Place a picture file under the grid (also used by tools/export_check.mjs).
function placeTrace(f) {
  const img = new Image();
  img.onload = () => {
    // Keep it as a data URL so it saves with the drawing; a big photo is made smaller first.
    const fit = P.fitWithin(img.naturalWidth, img.naturalHeight);
    const c = document.createElement('canvas');
    c.width = fit.w; c.height = fit.h;
    c.getContext('2d').drawImage(img, 0, 0, fit.w, fit.h);
    const src = c.toDataURL(f.type === 'image/png' || f.type === 'image/gif' ? 'image/png' : 'image/jpeg', 0.88);
    const box = app.view.worldBox();
    const bw = (box.x1 - box.x0) * 0.8, bh = (box.y1 - box.y0) * 0.8;
    const k = Math.min(bw / fit.w, bh / fit.h);
    const w = fit.w * k, h = fit.h * k;
    const shown = new Image();
    shown.onload = () => {
      app.trace = { img: shown, src, rect: { x: app.view.cx - w / 2, y: app.view.cy - h / 2, w, h } };
      URL.revokeObjectURL(img.src);
      if ($('#settings').open) $('#settings').close(); if ($('#drawing').open) $('#drawing').close();
      toast(fit.scaled ? `Picture placed under the grid, made smaller to ${fit.w}×${fit.h} px so the drawing stays light` : 'Picture placed under the grid; it saves with the drawing');
      scheduleSave();
      requestRender();
    };
    shown.src = src;
  };
  img.onerror = () => toast('That picture would not open');
  img.src = URL.createObjectURL(f);
}

// ---------- moving house (move.js) ----------
// A drawing that came from an old address while this one had its own waits
// here, offered by a note, until opened or dismissed.
function openMoved() {
  const m = app.pendingMove;
  if (!m) return;
  try {
    loadProjectObject(m);
    app.file = { name: null, at: null, via: null, dirty: false, handle: null };
    rememberFile(); updateFileUI();
    toast('Opened the drawing from the old address');
  } catch (err) { toast(`It would not open: ${err.message}`); }
  app.pendingMove = null;
  $('#move-note').hidden = true;
}
function showMoveNote(text, offer) {
  $('#move-text').textContent = text;
  $('#move-open').hidden = !offer;
  $('#move-note').hidden = false;
}
// Settings carried from the old address, before the app reads its own.
function takeMovedSettings(arriving) {
  const has = (k) => { try { return localStorage.getItem(k) !== null; } catch { return true; } };
  const copy = keysToCopy(arriving.local, has);
  for (const [k, v] of copy) { try { localStorage.setItem(k, v); } catch { /* storage blocked */ } }
  if (copy.length) app.settings = store.loadSettings(DEFAULTS);
}
// The drawing carried from the old address: taken when this browser has none
// here, else offered; one already taken is never taken twice (move.js landing).
async function takeMovedDrawing(arriving) {
  if (arriving.dropped.includes('drawing')) {
    showMoveNote(arriving.savedFile
      ? 'Isopix moved to isopix.app. Your drawing was too big to bring along by itself, so it was saved to your downloads as a file: open it with Drawing → Open.'
      : 'Isopix moved to isopix.app. Your drawing at the old address was too big to bring along.', false);
    return;
  }
  const m = arriving.autosave;
  if (!m) return;
  const seen = (await store.idbGet('moved-in')) || [];
  const savedAt = Number(m.savedAt) || null;
  const what = landing({ incoming: { from: arriving.from, savedAt, hasContent: hasDrawing(m) }, current: { hasContent: hasContent(), savedAt: app.lastSaved }, seen: Array.isArray(seen) ? seen : [] });
  if (what === 'ignore') return;
  store.idbSet('moved-in', [...(Array.isArray(seen) ? seen : []), { from: arriving.from, savedAt }].slice(-20));
  if (what === 'offer') {
    app.pendingMove = m;
    showMoveNote('Isopix moved to isopix.app, and your drawing from the old address came along. This browser already has a drawing here, so that one stays open.', true);
    return;
  }
  try {
    loadProjectObject(m);
    if (savedAt) app.lastSaved = savedAt;
    if (arriving.file) { app.file = arriving.file; rememberFile(); }
    const lost = arriving.dropped.filter((d) => d !== 'drawing').map((d) => (d === 'trace' ? 'its trace picture' : 'its undo history'));
    if (lost.length) toast(`Your drawing moved here from the old address, without ${lost.join(' or ')} (too big to carry).`);
  } catch { /* a drawing that will not load stays at the old address */ }
}

// ---------- autosave ----------
// Every change lands in IndexedDB 800 ms later, and at once when the app is
// put away (switching apps, closing the tab), so a quick close loses nothing.
let saveTimer, savePending = false;
function scheduleSave(changed = true) {
  if (changed) markChanged();
  savePending = true;
  clearTimeout(saveTimer);
  saveTimer = setTimeout(saveNow, 800);
}
async function saveNow() {
  clearTimeout(saveTimer);
  if (!savePending) return;
  savePending = false;
  if (await store.idbSet('autosave', projectData())) {
    app.lastSaved = Date.now();
    if ($('#drawing').open) updateSavedLine();
    if (hasContent()) store.keepStorage();
  } else if (!app.session.storageTold && hasContent()) {
    // A private window, full storage or blocked site data: say so once, with a way out.
    app.session.storageTold = true;
    $('#save-note').hidden = false;
  }
}

// ---------- update notice ----------
// Not now: mid-stroke or drag, a density preview, a replay, picking the
// symmetry center, the open rail, or the menu or a picker open.
export function isBusy() {
  return !!gesture || !!preview || !!app.replaying || app.pickCenter
    || !!document.querySelector('dialog[open]') || !$('#popover').hidden || $('#levels').classList.contains('open')
    || $('#handle').classList.contains('dragging');
}
// Before Reload: save the drawing now (not in 800 ms), and let a new service
// worker take over so the reloaded page and the cache are the new version.
async function prepareReload() {
  savePending = true;
  await saveNow();
  const reg = await navigator.serviceWorker?.getRegistration?.();
  if (!reg) return;
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  await Promise.race([reg.update().catch(() => {}), wait(3000)]);
  const next = reg.waiting || reg.installing;
  if (next) {
    const took = new Promise((r) => navigator.serviceWorker.addEventListener('controllerchange', r, { once: true }));
    next.postMessage({ type: 'skip-waiting' });
    await Promise.race([took, wait(3000)]);
  }
}

// ---------- time-lapse replay ----------
function startReplay() {
  const log = app.drawing.undoStack;
  if (!log.length) return toast('Draw something first');
  cancelGesture();
  const it = P.replay(log);
  const first = it.next().value;
  app.replaying = { drawing: first, it };
  $('#replay-bar').hidden = false;
  updateSelbar();
  const step = Math.max(16, Math.min(250, 8000 / log.length));
  const tick = () => {
    if (!app.replaying) return;
    const n = app.replaying.it.next();
    requestRender();
    if (n.done) { setTimeout(stopReplay, 800); return; }
    app.replaying.timer = setTimeout(tick, step);
  };
  app.replaying.timer = setTimeout(tick, 300);
  requestRender();
}
function stopReplay() {
  if (!app.replaying) return;
  clearTimeout(app.replaying.timer);
  app.replaying = null;
  $('#replay-bar').hidden = true;
  updateSelbar();
  requestRender();
}

// ---------- wiring ----------
function wire() {
  canvas.addEventListener('pointerdown', onDown);
  canvas.addEventListener('pointermove', onMove);
  canvas.addEventListener('pointerup', onUp);
  canvas.addEventListener('pointercancel', onUp);
  canvas.addEventListener('pointerleave', () => { if (!gesture) { app.ghost = null; requestRender(); } });
  canvas.addEventListener('wheel', onWheel, { passive: false });
  canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  // Safari's own pinch gesture on trackpads.
  canvas.addEventListener('gesturestart', (e) => e.preventDefault());
  document.addEventListener('keydown', onKey);
  document.addEventListener('keyup', onKey);
  window.addEventListener('resize', resize);
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => { readTheme(); requestRender(); });

  for (const b of document.querySelectorAll('[data-tool]')) b.addEventListener('click', () => setTool(b.dataset.tool));
  $('#options').addEventListener('click', () => ($('#popover').hidden ? openPopover() : closePopover()));
  $('#undo').addEventListener('click', undo);
  $('#redo').addEventListener('click', redo);
  $('#fit-view').addEventListener('click', fitView);
  $('#move-mode').addEventListener('click', () => setMoveMode(!app.moveMode, true));
  $('#mode-chip').addEventListener('click', cycleMode);
  $('#protect-close').addEventListener('click', () => { $('#protect-note').hidden = true; });
  $('#lock').addEventListener('click', toggleLock);
  $('#replay-stop').addEventListener('click', stopReplay);

  $('#sel-finer').addEventListener('click', () => setDensity(selDensity() + 1));
  $('#sel-coarser').addEventListener('click', () => setDensity(selDensity() - 1));
  $('#sel-mode').addEventListener('click', toggleCoarsen);
  $('#sel-more').addEventListener('click', () => {
    const open = !$('#selbar').classList.contains('more');
    $('#selbar').classList.toggle('more', open);
    $('#sel-more').setAttribute('aria-expanded', String(open));
    placeHandle();
  });
  $('#sel-snap').addEventListener('click', () => { set('snap', !app.settings.snap); updateSelbar(); });
  $('#sel-done').addEventListener('click', () => { app.selection = null; app.lastDensity = null; updateSelbar(); requestRender(); });
  $('#sel-erase').addEventListener('click', () => {
    if (!app.selection) return;
    app.drawing.begin('erase selection');
    D.splitBorder(app.drawing, app.selection.region);
    D.eraseRegion(app.drawing, app.selection.region);
    commit();
  });
  $('#sel-stamp').addEventListener('click', () => {
    const sel = app.selection;
    if (!sel) return;
    const stamp = D.extractStamp(app.drawing, sel.region, sel.anchor);
    if (!stamp.cells.length && !stamp.edges.length) return toast('The selection is empty');
    app.stamps.push({ name: `Stamp ${app.stamps.length + 1}`, stamp });
    app.stampIndex = app.stamps.length - 1;
    set('brush', 'stamp');
    scheduleSave();
    toast('Saved as a stamp. Pick the pencil to place it.');
  });

  // The density handle: drag up for finer, down for coarser, a notch every 36 px.
  const h = $('#handle');
  h.addEventListener('pointerdown', (e) => {
    e.stopPropagation();
    if (!previewStart()) return;
    try { h.setPointerCapture(e.pointerId); } catch { /* synthetic */ }
    h.classList.add('dragging');
    h.dataset.y = e.clientY;
  });
  h.addEventListener('pointermove', (e) => {
    if (!preview || !h.classList.contains('dragging')) return;
    previewTo(preview.d0 + Math.round((+h.dataset.y - e.clientY) / 36));
  });
  h.addEventListener('pointerup', () => previewEnd(true));
  h.addEventListener('pointercancel', () => previewEnd(false));
  h.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowUp' || e.key === 'ArrowRight') { e.preventDefault(); setDensity(selDensity() + 1); }
    if (e.key === 'ArrowDown' || e.key === 'ArrowLeft') { e.preventDefault(); setDensity(selDensity() - 1); }
  });
  wireMenu();
}

async function boot() {
  // A drawing carried here from an old address (move.js).
  const arriving = await readMoveHash();
  if (arriving) takeMovedSettings(arriving);
  readTheme();
  buildNotches();
  buildZoom();
  buildPalette();
  wire();
  setTool(app.settings.tool);
  updateModeChip();
  syncMenu();
  resize();
  computeLevel(true);
  const saved = await store.idbGet('autosave');
  if (saved) {
    try { loadProjectObject(saved); if (Number.isFinite(saved.savedAt)) app.lastSaved = saved.savedAt; } catch (err) { toast(`The saved drawing could not load: ${err.message}`); }
  }
  const file = await store.idbGet('file');
  if (file && typeof file === 'object') app.file = { name: String(file.name || ''), at: Number(file.at) || null, via: file.via === 'open' ? 'open' : 'save', dirty: !!file.dirty, handle: file.handle || null };
  if (arriving) await takeMovedDrawing(arriving);
  afterChange({ changed: false });
  updateFileUI();
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') saveNow(); });
  window.addEventListener('pagehide', saveNow);
  const label = $('#version-label');
  const stamp = $('#build-stamp');
  label.textContent = aboutVersion(self.ISOPIX_VERSION, null);
  stamp.textContent = buildStamp(self.ISOPIX_VERSION, null);
  // The deploy label this copy was loaded with: the update bar compares against it.
  fetch('version.json', { cache: 'no-store' }).then((r) => (r.ok ? r.json() : null)).then((v) => {
    stamp.textContent = buildStamp(self.ISOPIX_VERSION, v);
    if (v && typeof v.version === 'string') { app.loadedVersion = v.version; label.textContent = aboutVersion(self.ISOPIX_VERSION, v); }
  }).catch(() => {});
  app.update = initUpdate({
    bar: $('#update-bar'),
    reloadBtn: $('#update-reload'),
    closeBtn: $('#update-close'),
    loaded: () => app.loadedVersion,
    busy: isBusy,
    beforeReload: prepareReload,
  });
  // Keep the bar in place whenever it appears.
  for (const id of ['#update-bar', '#protect-note', '#save-note', '#move-note']) new MutationObserver(placeUpdateBar).observe($(id), { attributes: true, attributeFilter: ['hidden'] });
  if ('serviceWorker' in navigator && location.protocol !== 'file:') navigator.serviceWorker.register('sw.js').catch(() => {});
}
boot();
