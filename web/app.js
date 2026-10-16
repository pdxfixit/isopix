// Isopix app: the app state (tool, color, level, selection, view), rendering,
// lessons, autosave, the update notice, replay, and the wiring at boot.
// The controls, tools, input, sheets and files are in web/ui/, one job each.

import { Drawing } from './engine/model.js';
import * as D from './engine/density.js';
import * as P from './engine/project.js';
import { View } from './engine/view.js';
import { Renderer } from './render.js';
import * as store from './storage.js';
import { initUpdate, buildStamp, aboutVersion, versionURL } from './update.js';
import { keyFor } from './keys.js';
import { paperOf, matchInk } from './engine/paper.js';
import { readMoveHash } from './move.js';
import { welcomeDue, initWelcome } from './welcome.js';
import { initTour } from './tour.js';
import { deviceOf, doneLessons } from './lessons.js';
import { sillyName } from './sillynames.js';
import { initEvents, cellsBucket } from './events.js';
import * as AS from './autosave.js';
import * as G from './gallery.js';
import * as SB from './stampbook.js';
import { buildNotches, buildPalette, buildZoom, computeLevel, fitView, toggleLock, updateZoomUI } from './ui/controls.js';
import { afterChange, closePopover, commit, cycleMode, openPopover, placeHandle, preview, previewEnd, previewStart, previewTo, redo, selDensity, setDensity, setMoveMode, setTool, toggleCoarsen, undo, updateModeChip, updateOptionsButton, updateSelbar } from './ui/tools.js';
import { addDrawing, openAtStart } from './ui/gallery.js';
import { loadMine, saveMine, wireStamps } from './ui/stamps.js';
import { setBar, isMaking, cancelVideo, videoButton } from './ui/video.js';
import { cancelGesture, gesture, onDown, onKey, onMove, onUp, onWheel } from './ui/input.js';
import { hasContent, leaveDrawing, openDrawing, openSettings, setName, showFold, startDrawing, syncMenu, updateSavedLine, watchDialogs, wireMenu } from './ui/screens.js';
import { isopixFile, loadProjectObject, markChanged, placeTrace, pngBlob, pngCanvas, projectData, projectFromFile, projectPng, svgBlob, takeMovedDrawing, takeMovedSettings, updateFileUI } from './ui/files.js';
export { projectData, svgBlob, pngCanvas, pngBlob }; // for tools/export_check.mjs

// ---------- palette and settings ----------
// The inks come from the drawing's paper (engine/paper.js).
const systemPaper = () => (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');

export const DEFAULTS = {
  tool: 'pencil', brush: 'triangle', lineStyle: 'strip', marquee: 'hexagon',
  color: '#3a86ff', shading: true, notch: 2, locked: false, lockedLevel: 3,
  protect: 'protect', gutters: true, hint: 'faint', hintLevels: 1,
  symmetry: 'off', symP: 0, symQ: 0, symL: 0,
  densityHandle: true, densityPinch: false, densityLongpress: false,
  coarsen: 'crisp', snap: false, limited: false, limitedCount: 3, gray: false, traceOpacity: 0.3,
  custom: '',
  welcomed: false, // the welcome card was closed on this device
  savePng: true, // Save writes a PNG with the drawing inside; off: a .isopix.json file
  usage: true, // Share play data (events.js; Settings)
};
export const BRUSH_LABEL = { triangle: 'Triangle', rhombus: 'Rhombus', hexagon: 'Hexagon', trapezoid: 'Trapezoid', bigtri: 'Big triangle', face: 'Drag a face', cube: 'Drag a cube', stamp: 'Stamp' };
export const DRAG_BRUSHES = new Set(['face', 'cube', 'stamp']);

export const $ = (s) => document.querySelector(s);
export const canvas = $('#stage');
const renderer = new Renderer(canvas);

// A new drawing starts on the paper that matches the screen's mode.
export function newDrawing() {
  const d = new Drawing();
  d.paper = systemPaper();
  return d;
}
// Flip this drawing's paper. Strokes keep their colors; the inks switch.
export function flipPaper() {
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
  stampChoice: { from: 'starter', i: 0 }, // the stamp the Stamp brush places (web/stampbook.js chosen)
  ghost: null,
  crosshair: null,
  trace: null,
  replaying: null,
  welcome: null,         // the welcome card (web/welcome.js)
  tour: null,            // the lessons (web/tour.js, web/lessons.js)
  practice: null,        // during a lesson: the person's own drawing, set aside
  lastPointer: '',       // the last pointer used (the lessons word their steps for it)
  pickCenter: false,
  moveMode: false,       // the hand on the zoom rail: one finger moves the view
  lastDensity: null,
  loadedVersion: null,
  drawingName: 'Untitled drawing', // saved with the drawing (project file and autosave)
  lastSaved: null,       // when the autosave last landed in IndexedDB
  file: { name: null, at: null, via: null, dirty: false, handle: null }, // the file this drawing was last saved to or opened from
  drawingId: null,       // which of this browser's drawings is open (web/gallery.js)
  gallery: [],           // this browser's drawings: [{id, name, savedAt, thumb}], newest first
  strokeSkips: new Map(), // cells Keep fine detail skipped in the stroke under way
  skipFlash: null,        // skipped cells hatched for a moment after a stroke
  session: { told: false, storageTold: false, copyAt: 0 }, // the skip and storage notices show once a session
};
window.isopix = app; // for debugging and the look tool

// ---------- small helpers ----------
// Every setting passes here, so setting.change (events.js) has the old value
// too. A lesson's own picks are not the person's: its settings come back after.
export const set = (k, v) => {
  const from = app.settings[k];
  app.settings[k] = v;
  store.saveSettings(app.settings);
  if (k === 'usage' && !v) app.events?.clear(); // off: nothing recorded, the queue emptied
  else if (!app.practice) app.events?.setting(k, from, v);
};
let toastTimer;
export function toast(msg) {
  const t = $('#toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 2200);
}
// What the person just did, for the lesson under way (web/lessons.js lists the events).
export const emit = (type, detail = {}) => app.tour?.event({ type, ...detail });
export const symCenter = () => ({ l: app.settings.symL, p: app.settings.symP, q: app.settings.symQ });
export function palette() {
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

// ---------- lessons (web/lessons.js, web/tour.js) ----------
// A lesson draws in a practice drawing: the person's own drawing, its file
// record, settings, stamps and view are set aside and come back at the end.
// Keep it adds the practice one as another drawing (web/ui/gallery.js); it
// never takes the place of theirs. Nothing of the practice drawing reaches
// IndexedDB until it is kept (saveNow and rememberFile skip it).
const DONE_KEY = 'isopix-lessons-done';
export const readDone = () => { try { return doneLessons(localStorage.getItem(DONE_KEY)); } catch { return new Set(); } };
function beginPractice() {
  const theirs = app.drawing;
  app.practice = { obj: projectData(), file: { ...app.file }, lastSaved: app.lastSaved, settings: { ...app.settings }, stamps: app.stamps, name: app.drawingName, has: hasContent() };
  cancelGesture();
  if (app.replaying) stopReplay();
  app.drawing = newDrawing();
  app.drawing.paper = theirs.paper;
  app.stamps = app.stamps.slice(); app.selection = null; app.lastDensity = null; app.trace = null;
  app.file = { name: null, at: null, via: null, dirty: false, handle: null };
  setName('Practice');
  for (const d of document.querySelectorAll('dialog[open]')) d.close();
  buildPalette(); syncMenu(); afterChange({ changed: false }); updateFileUI();
}
async function endPractice(keep) {
  const was = app.practice;
  if (!was) return;
  leaveLesson('stopped');
  if (keep && app.drawingName === 'Practice') setName(sillyName());
  const kept = keep ? projectData() : null;
  // Theirs comes back first, as it was, so nothing of the practice one is saved over it.
  loadProjectObject(was.obj);
  app.file = was.file;
  app.lastSaved = was.lastSaved;
  // A stamp saved in the lesson stays only when the practice drawing is kept.
  if (!kept) app.stamps = was.stamps;
  // The person's settings come back either way (the lesson picked tools and brushes for them).
  app.settings = { ...was.settings, welcomed: app.settings.welcomed };
  store.saveSettings(app.settings);
  app.practice = null;
  if (kept) { saveMine(); await addDrawing(kept); }
  for (const d of document.querySelectorAll('dialog[open]')) d.close();
  buildPalette(); setTool(app.settings.tool); updateModeChip(); syncMenu(); computeLevel(true); afterChange({ changed: false }); updateFileUI();
  toast(kept ? 'Kept: it is in Drawings with your other drawings' : 'Back to your drawing');
}
// A step's setup (lessons.js): the tool and brush it needs, or a sheet open at the right place.
function lessonSetup(su) {
  if (su.brush) set('brush', su.brush);
  if (su.lineStyle) set('lineStyle', su.lineStyle);
  if (su.marquee) set('marquee', su.marquee);
  if (su.shading != null && app.settings.shading !== su.shading) { set('shading', su.shading); buildPalette(); }
  if (su.protect) { set('protect', su.protect); updateModeChip(); }
  if (su.tool) setTool(su.tool); else updateOptionsButton();
  if (su.open === 'drawing' && !$('#drawing').open) openDrawing();
  if (su.open?.startsWith('settings:')) {
    if (!$('#settings').open) openSettings();
    showFold(su.open.slice(9), true);
  }
}
export function startLesson(id) {
  for (const d of document.querySelectorAll('dialog[open]')) d.close();
  leaveLesson('switched');
  app.tour.start(id);
  if (!app.tour.active()) return;
  lessonRun = { id, at: Date.now(), done: false };
  app.events?.track('content.start', { kind: 'lesson', item: id, resumed: false });
}
// A lesson finishes at its last step (markDone); Stop lesson, another lesson
// or closing the page before then abandons it.
let lessonRun = null; // {id, at, done}
function lessonDone(id) {
  if (lessonRun && lessonRun.id === id && !lessonRun.done) {
    lessonRun.done = true;
    app.events?.track('content.finish', { kind: 'lesson', item: id, ms: Date.now() - lessonRun.at });
  }
}
function leaveLesson(why) {
  if (lessonRun && !lessonRun.done) app.events?.track('content.abandon', { kind: 'lesson', item: lessonRun.id, ms: Date.now() - lessonRun.at, why });
  if (why !== 'left') lessonRun = null;
}

// ---------- autosave ----------
// Every change lands in IndexedDB 800 ms later, and at once when the app is
// put away (switching apps, closing the tab), so a quick close loses nothing.
let saveTimer, savePending = false;
export function scheduleSave(changed = true) {
  if (changed) markChanged();
  savePending = true;
  clearTimeout(saveTimer);
  saveTimer = setTimeout(saveNow, 800);
}
export async function saveNow() {
  clearTimeout(saveTimer);
  if (!savePending) return;
  savePending = false;
  if (app.practice || !app.drawingId) return; // the person's own drawing stays as it was in IndexedDB
  const data = projectData();
  if (await store.idbSet(G.recordKey(app.drawingId), data)) {
    app.lastSaved = Date.now();
    app.gallery = G.withEntry(app.gallery, { id: app.drawingId, name: app.drawingName, savedAt: app.lastSaved });
    await store.idbSet(G.LIST, app.gallery);
    if ($('#drawing').open) updateSavedLine();
    if (hasContent()) { store.keepStorage(); await takeCopy(data); }
  } else if (!app.session.storageTold && hasContent()) {
    // A private window, full storage or blocked site data: say so once, with a way out.
    app.session.storageTold = true;
    $('#save-note').hidden = false;
  }
}

// Every 5 minutes or so, a copy of a drawing with something in it (web/autosave.js):
// an empty drawing (after New) never pushes a real one out. Best effort, after
// the autosave itself, so a full disk never costs the autosave.
async function takeCopy(data) {
  const now = Date.now();
  if (!AS.copyDue(app.session.copyAt, now)) return;
  app.session.copyAt = now;
  const key = G.copiesKey(app.drawingId);
  await store.idbSet(key, AS.withCopy(await store.idbGet(key), data, now));
}
// Save now whatever the timer: before another drawing opens, or a lesson starts.
export function flushSave() { savePending = true; return saveNow(); }

// ---------- update notice ----------
// Not now: mid-stroke or drag, a density preview, a replay, picking the
// symmetry center, the open rail, or the menu or a picker open.
export function isBusy() {
  return !!gesture || !!preview || !!app.replaying || isMaking() || app.pickCenter || !!app.tour?.active()
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
export function startReplay() {
  const log = app.drawing.undoStack;
  if (!log.length) return toast('Draw something first');
  cancelGesture();
  const it = P.replay(log);
  const first = it.next().value;
  app.replaying = { drawing: first, it };
  setBar('playing');
  updateSelbar();
  const step = Math.max(16, Math.min(250, 8000 / log.length));
  const tick = () => {
    if (!app.replaying) return;
    const n = app.replaying.it.next();
    requestRender();
    // The end: the drawing as it is, and the bar offers Watch again and Save video.
    if (n.done) { setTimeout(() => { stopReplay(); setBar('ended'); }, 800); return; }
    app.replaying.timer = setTimeout(tick, step);
  };
  app.replaying.timer = setTimeout(tick, 300);
  requestRender();
  emit('replay');
}
export function stopReplay() {
  if (!app.replaying) return;
  clearTimeout(app.replaying.timer);
  app.replaying = null;
  setBar(null);
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
  $('#replay-stop').addEventListener('click', () => (isMaking() ? cancelVideo() : stopReplay()));
  $('#replay-again').addEventListener('click', startReplay);
  $('#replay-video').addEventListener('click', videoButton);
  $('#replay-close').addEventListener('click', () => setBar(null));

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
  $('#sel-done').addEventListener('click', () => { app.selection = null; app.lastDensity = null; updateSelbar(); requestRender(); emit('seldone'); });
  $('#sel-erase').addEventListener('click', () => {
    if (!app.selection) return;
    app.drawing.begin('erase selection');
    D.splitBorder(app.drawing, app.selection.region);
    D.eraseRegion(app.drawing, app.selection.region);
    commit();
  });
  // Turn and Flip: what is in the selection, exactly, about its middle vertex (engine/density.js).
  const turnSelection = (g, what) => {
    const sel = app.selection;
    if (!sel) return;
    app.drawing.begin(what);
    sel.region = D.transformRegion(app.drawing, sel.region, D.pivotOf(sel.region), g);
    commit();
    updateSelbar();
    requestRender();
    emit(g.m ? 'flip' : 'turn');
  };
  $('#sel-turn').addEventListener('click', () => turnSelection(D.TURN, 'turn selection'));
  $('#sel-relight').addEventListener('click', () => {
    const sel = app.selection;
    if (!sel) return;
    app.drawing.begin('relight');
    const n = D.relightRegion(app.drawing, sel.region, app.drawing.light);
    commit(); requestRender();
    toast(n ? `Relit from the ${app.drawing.light}` : `Already lit from the ${app.drawing.light}`);
    emit('relight');
  });
  $('#sel-flip').addEventListener('click', () => turnSelection(D.FLIP, 'flip selection'));
  $('#sel-stamp').addEventListener('click', () => {
    const sel = app.selection;
    if (!sel) return;
    const stamp = D.extractStamp(app.drawing, sel.region, sel.anchor);
    if (!stamp.cells.length && !stamp.edges.length) return toast('The selection is empty');
    app.stamps.push({ name: SB.nextName(app.stamps), stamp });
    app.stampChoice = { from: 'mine', i: app.stamps.length - 1 };
    saveMine();
    set('brush', 'stamp');
    scheduleSave();
    toast('Saved as a stamp in Stamps → Mine. Pick the pencil to place it.');
    emit('stamp');
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
  wireStamps();
}

async function boot() {
  app.events = initEvents({ enabled: () => app.settings.usage, keyAction: (e) => keyFor(e)?.action ?? null });
  app.events.cells(() => cellsBucket(app.drawing.cells.size));
  app.events.onLeave(() => { leaveDrawing('left'); leaveLesson('left'); });
  watchDialogs();
  // A drawing carried here from an old address (move.js).
  const arriving = await readMoveHash();
  if (arriving) app.events.track('isopix.move_arrived');
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
  await loadMine(); // this browser's own stamps (web/ui/stamps.js), before any drawing adds to them
  // This browser's drawings (web/gallery.js): the one in use opens.
  const had = await openAtStart();
  if (!had && !arriving) setName(sillyName()); // the very first drawing here gets a silly name too
  if (arriving) await takeMovedDrawing(arriving);
  afterChange({ changed: false });
  updateFileUI();
  startDrawing(hasContent());
  app.tour = initTour({
    device: () => deviceOf({ pointerType: app.lastPointer, coarse: matchMedia('(pointer: coarse)').matches }),
    begin: beginPractice, end: endPractice, needsAsk: () => false, setup: lessonSetup, // Keep it adds a drawing: nothing to ask
    practiceHasContent: hasContent,
    markDone: (id) => { lessonDone(id); const done = readDone(); done.add(id); try { localStorage.setItem(DONE_KEY, JSON.stringify([...done])); } catch { /* storage blocked */ } },
  });
  // The welcome card, once, on a first visit. Anyone who already has a drawing
  // here (or is bringing one) is not new, so it never opens for them later.
  app.welcome = initWelcome({
    dialog: $('#welcome'),
    onClose: (how) => { if (!app.settings.welcomed) set('welcomed', true); if (how === 'tour') startLesson('basics'); },
  });
  // The controls work now: the loading screen finishes its turn and fades, then the welcome.
  app.events.opened();
  const loaded = self.ISOPIX_LOADING ? self.ISOPIX_LOADING.done() : Promise.resolve();
  if (welcomeDue({ welcomed: app.settings.welcomed, hasContent: hasContent(), arriving: !!arriving })) loaded.then(() => app.welcome.open());
  else if (!app.settings.welcomed) set('welcomed', true);
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') saveNow(); });
  window.addEventListener('pagehide', saveNow);
  const label = $('#version-label');
  const stamp = $('#build-stamp');
  label.textContent = aboutVersion(self.ISOPIX_VERSION, null);
  label.href = versionURL(null);
  stamp.textContent = buildStamp(self.ISOPIX_VERSION, null);
  // The deploy label this copy was loaded with: the update bar compares against it.
  fetch('version.json', { cache: 'no-store' }).then((r) => (r.ok ? r.json() : null)).then((v) => {
    stamp.textContent = buildStamp(self.ISOPIX_VERSION, v);
    app.versionJson = v;
    label.href = versionURL(v);
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
Object.assign(app, { isopixFile, projectPng, projectFromFile }); // for tools/export_check.mjs

boot();
