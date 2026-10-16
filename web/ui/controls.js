// The grid-size rail (levels, notches, the lock), the palette, and the zoom
// rail. Split out of app.js; app.js holds the state and the wiring.

import * as L from '../engine/lattice.js';
import { bounds } from '../engine/svg.js';
import { followLevel, targetPx, notchFor, MIN_ZOOM, MAX_ZOOM, zoomToSlider, sliderToZoom, zoomLabel } from '../engine/view.js';
import { shade } from '../engine/color.js';
import { GLYPHS, notchGlyph } from '../glyphs.js';
import { toolAfterColorPick } from '../palette.js';
import { paperOf, paperName, inkName, matchInk } from '../engine/paper.js';
import { $, app, emit, palette, requestRender, set, toast } from '../app.js';
import { setTool } from './tools.js';
import { zoomBy } from './input.js';
import { syncMenu } from './screens.js';

// ---------- level ----------
export function computeLevel(reset = false) {
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

export function buildNotches() {
  const box = $('#notches');
  box.innerHTML = '';
  for (let i = 0; i < 8; i++) {
    const b = document.createElement('button');
    b.className = 'notch';
    b.id = `notch-${i}`; // so a notch counts as a control (events.js)
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
let railAt = 0; // when the rail opened, while it is open as a rail (dialog.open, events.js)
export function openRail(ms = 0) {
  clearTimeout(railTimer);
  nudgeRail();
  const levels = $('#levels');
  if (!levels.classList.contains('open') && getComputedStyle($('#notches')).flexDirection === 'column') {
    railAt = Date.now();
    app.events?.track('dialog.open', { dialog: 'levels' });
  }
  levels.classList.add('open');
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
  railTimer = setTimeout(() => {
    if (keyboardIn()) return;
    $('#levels').classList.remove('open');
    if (railAt) { app.events?.track('dialog.close', { dialog: 'levels', answer: 'closed', ms: Date.now() - railAt }); railAt = 0; }
  }, ms);
}
export function chooseNotch(n) {
  if (app.settings.locked) set('lockedLevel', n); else set('notch', n);
  computeLevel(true);
  showReadout();
  requestRender();
  emit('level', { level: app.level });
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
export function toggleLock() {
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
export function buildPalette() {
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
    if (s.shading) b.innerHTML = `<span class="tones" aria-hidden="true"><i style="background:${shade(c, 'T', app.drawing.light)}"></i><i style="background:${shade(c, 'L', app.drawing.light)}"></i><i style="background:${shade(c, 'R', app.drawing.light)}"></i></span>`;
    b.addEventListener('click', () => { set('color', c); buildPalette(); pickedColor(); emit('color', { custom: false }); });
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
    custom.id = 'pick-any';
    custom.setAttribute('aria-label', 'Pick any color');
    custom.innerHTML = `${GLYPHS.eyedropper}<input type="color" aria-label="Pick any color">`;
    const input = custom.querySelector('input');
    input.value = s.custom || s.color;
    input.addEventListener('change', () => { set('custom', input.value); set('color', input.value); buildPalette(); pickedColor(); emit('color', { custom: true }); });
    pinned.append(custom);
  }
  const sh = document.createElement('button');
  sh.className = 'swatch tool';
  sh.id = 'shade-toggle';
  sh.setAttribute('aria-pressed', String(s.shading));
  sh.setAttribute('aria-label', 'Auto-shade cube faces');
  sh.title = 'Auto-shade cube faces';
  sh.innerHTML = GLYPHS.cube;
  sh.addEventListener('click', () => { set('shading', !s.shading); buildPalette(); syncMenu(); toast(s.shading ? 'Auto-shade on: top light, left mid, right dark' : 'Auto-shade off'); emit('shading', { on: s.shading }); });
  pinned.append(sh);
  if (s.limited && !palette().includes(s.color)) set('color', palette()[0]);
}

// A color pick on the Eraser means "paint now": switch to the Pencil (palette.js).
function pickedColor() {
  const next = toolAfterColorPick(app.settings.tool);
  if (next !== app.settings.tool) setTool(next);
}

// ---------- zoom slider ----------
// The left rail: + and − double and halve the zoom (one level each), the
// track sets it directly, even in log scale. All of it zooms about the center.
const ZOOM_THUMB = 28;
function zoomTo(z) {
  zoomBy(z / app.view.zoom);
  showReadout(true);
}
export function buildZoom() {
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
export function updateZoomUI() {
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
export function fitView() {
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
  emit('fit');
}
