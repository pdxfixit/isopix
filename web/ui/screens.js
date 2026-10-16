// The sheets: Help, Settings and the Drawing sheet (its Drawings grid is
// web/ui/gallery.js); the pure rules are in web/sheets.js.

import * as store from '../storage.js';
import { reportURL, SUPPORT } from '../update.js';
import { helpHTML, helpIds } from '../help.js';
import { cleanName, savedAgo, fileLine, unsavedToFile, chipText, SECTION_IDS, rememberedOpen, startsOpen, rememberOpen } from '../sheets.js';
import { paperName } from '../engine/paper.js';
import { sillyName } from '../sillynames.js';
import { $, app, emit, flipPaper, readDone, requestRender, scheduleSave, set, startLesson, startReplay, toast } from '../app.js';
import { buildPalette } from './controls.js';
import { updateModeChip, updateSelbar } from './tools.js';
import { galleryNew, renderGallery, wireGallery } from './gallery.js';
import { openMoved, openProject, openTrace, saveFile, savePicture, saveVector, savesPng, updateFileUI } from './files.js';

// ---------- help ----------
export function openHelp() {
  // The report link is filled in now: this copy's version, browser and screen.
  $('#report-addr').textContent = SUPPORT;
  $('#report-link').href = reportURL({ app: self.ISOPIX_VERSION, json: app.versionJson ?? null, ua: navigator.userAgent,
    screen: `${screen.width}×${screen.height}`, installed: matchMedia('(display-mode: standalone)').matches || navigator.standalone === true });
  $('#help-body').innerHTML = helpHTML((sel) => {
    const svg = document.querySelector(`${sel} svg`);
    return svg ? svg.outerHTML.replace(/ id="[^"]*"/g, '') : '';
  }, readOpen(HELP_OPEN_KEY), readDone());
  openSheet('#help');
}
// Help's sections fold (help.js): a head opens or closes the body it
// controls, and this device remembers which are open, as Settings does.
const HELP_OPEN_KEY = 'isopix-help-open';
function toggleFold(head) {
  const open = head.getAttribute('aria-expanded') !== 'true';
  head.setAttribute('aria-expanded', String(open));
  head.querySelector('.set-head-caret').textContent = open ? '▾' : '▸';
  document.getElementById(head.getAttribute('aria-controls')).hidden = !open;
  const ids = new Set([...$('#help-body').querySelectorAll('.set-head[aria-expanded="true"]')].map((h) => h.getAttribute('aria-controls')));
  try { localStorage.setItem(HELP_OPEN_KEY, rememberOpen(ids, helpIds())); } catch { /* storage blocked */ }
}

// ---------- sheets ----------
// Each sheet is a modal <dialog> (it keeps focus inside, and Esc closes it).
// One sheet at a time; closing gives focus back to the button that opened it.
let opener = null;
function openSheet(sel) {
  for (const d of document.querySelectorAll('dialog[open]')) d.close();
  opener = document.activeElement instanceof HTMLElement && document.activeElement !== document.body ? document.activeElement : opener;
  $(sel).showModal();
  emit('sheet', { id: sel.slice(1) });
}
for (const d of document.querySelectorAll('dialog')) {
  d.addEventListener('close', () => { if (opener && document.contains(opener) && !document.querySelector('dialog[open]')) opener.focus({ preventScroll: true }); });
}
// The sheets openSheet shows are screens (screen.view, events.js); any other
// <dialog> (the welcome card) is a dialog. Watching `open` catches every way
// one opens or closes (openSheet, showModal, Esc, close()).
const SCREENS = new Set(['settings', 'drawing', 'help']);
export function watchDialogs() {
  const openedAt = new Map();
  for (const d of document.querySelectorAll('dialog')) {
    new MutationObserver(() => {
      if (d.open && !openedAt.has(d.id)) {
        openedAt.set(d.id, Date.now());
        if (SCREENS.has(d.id)) app.events?.view(d.id); else app.events?.track('dialog.open', { dialog: d.id });
      } else if (!d.open && openedAt.has(d.id)) {
        const ms = Date.now() - openedAt.get(d.id);
        openedAt.delete(d.id);
        if (!SCREENS.has(d.id)) app.events?.track('dialog.close', { dialog: d.id, answer: d.returnValue || 'closed', ms });
        if (!document.querySelector('dialog[open]')) app.events?.view('draw');
      }
    }).observe(d, { attributes: true, attributeFilter: ['open'] });
  }
}

// Settings: folding sections with a chip naming the current value; which are
// open is this device's (localStorage, like the other settings).
const OPEN_KEY = 'isopix-settings-open';
function readOpen(key = OPEN_KEY) { try { return rememberedOpen(localStorage.getItem(key)); } catch { return new Set(); } }
export function showFold(id, open) {
  const sec = $('#' + id), head = sec.querySelector('.set-head');
  head.setAttribute('aria-expanded', String(open));
  head.querySelector('.set-head-caret').textContent = open ? '▾' : '▸';
  sec.querySelector('.set-body').hidden = !open;
}
function saveOpen() {
  const open = new Set(SECTION_IDS.filter((id) => $('#' + id + ' .set-head').getAttribute('aria-expanded') === 'true'));
  try { localStorage.setItem(OPEN_KEY, rememberOpen(open)); } catch { /* storage blocked */ }
}
export function updateChips() {
  const s = { ...app.settings, trace: !!app.trace };
  for (const id of SECTION_IDS) $('#' + id + '-chip').textContent = chipText(id, s, app.drawing.paper);
}
export function openSettings() { syncMenu(); openSheet('#settings'); }
export function syncMenu() {
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
  $('#opt-usage').checked = s.usage;
  $('#opt-save-png-row').hidden = !store.offersIsopixFile({ ios: store.isIOS() });
  // With the picture setting off it writes an .isopix file; the label stays, the line under it says so.
  $('#file-save-says').textContent = savesPng() ? 'Opens again in Isopix to keep drawing' : 'An .isopix file that opens again in Isopix';
  $('#opt-trace').value = String(s.traceOpacity);
  document.body.classList.toggle('gray', s.gray);
  const dark = paperName(app.drawing.paper) === 'dark';
  $('#paper-flip').textContent = dark ? 'Paper: dark · switch to light' : 'Paper: light · switch to dark';
  updateChips();
}

// The Drawing sheet: Drawings (this browser's drawings, New first; web/ui/gallery.js),
// then This drawing: the name; Save drawing, Save a copy; Save picture, Sharp
// picture; Open a file; Watch it being drawn.
export function openDrawing() {
  $('#drawing-name').value = app.drawingName;
  updateSavedLine();
  renderGallery();
  openSheet('#drawing');
}
export function updateSavedLine() {
  $('#autosave-status').textContent = savedAgo(app.lastSaved ? Date.now() - app.lastSaved : null);
  $('#file-status').textContent = fileLine({ ...app.file, linked: !!app.file.handle }, hasContent());
}
export function setName(name) {
  app.drawingName = cleanName(name);
  $('#drawing-name-small').textContent = app.drawingName === 'Untitled drawing' ? '' : app.drawingName;
  $('#drawing-open').setAttribute('aria-label', `Drawing: ${app.drawingName}. Name, new, open, save`);
}
export const hasContent = () => app.drawing.cells.size > 0 || app.drawing.edges.size > 0 || app.drawing.undoStack.length > 0;

// content.start, finish and abandon for a drawing (events.js): it starts at
// New, Open or the page load, finishes at each Save, and is abandoned when
// something replaces it, or the page closes, with work not in a file.
export let drawingRun = null; // {at}
export function startDrawing(resumed) {
  if (app.practice) return;
  drawingRun = { at: Date.now() };
  app.events?.track('content.start', { kind: 'drawing', resumed });
}
export function leaveDrawing(why) {
  if (app.practice || !drawingRun) return;
  if (unsavedToFile(app.file, hasContent())) app.events?.track('content.abandon', { kind: 'drawing', ms: Date.now() - drawingRun.at, why });
  drawingRun = null;
}
export function wireMenu() {
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
    for (const el of document.querySelectorAll(`input[name="${name}"]`)) el.addEventListener('change', () => { set(name, el.value); updateModeChip(); updateChips(); requestRender(); if (name === 'symmetry') emit('symmetry', { mode: el.value }); });
  }
  const check = (id, key, after) => $(id).addEventListener('change', (e) => { set(key, e.target.checked); after?.(); updateChips(); requestRender(); });
  check('#opt-shading', 'shading', () => { buildPalette(); emit('shading', { on: app.settings.shading }); });
  check('#opt-gutters', 'gutters');
  check('#opt-handle', 'densityHandle', updateSelbar);
  check('#opt-pinch', 'densityPinch');
  check('#opt-longpress', 'densityLongpress');
  check('#opt-limited', 'limited', buildPalette);
  check('#opt-gray', 'gray', () => { syncMenu(); emit('gray', { on: app.settings.gray }); });
  check('#opt-save-png', 'savePng', () => { updateFileUI(); syncMenu(); });
  check('#opt-usage', 'usage');
  $('#opt-hint-levels').addEventListener('change', (e) => { set('hintLevels', +e.target.value); requestRender(); });
  $('#opt-trace').addEventListener('input', (e) => { set('traceOpacity', +e.target.value); requestRender(); });
  $('#paper-flip').addEventListener('click', flipPaper);
  $('#settings-help').addEventListener('click', openHelp);
  $('#help-top').addEventListener('click', openHelp);
  $('#help-body').addEventListener('click', (e) => {
    const head = e.target.closest('.set-head');
    if (head) toggleFold(head);
    const lesson = e.target.closest('[data-lesson]');
    if (lesson) startLesson(lesson.dataset.lesson);
  });
  $('#welcome-again').addEventListener('click', () => { $('#settings').close(); app.welcome.open(); });
  $('#sym-center').addEventListener('click', () => { app.pickCenter = true; $('#settings').close(); toast('Tap a grid point for the symmetry center'); });
  $('#trace-open').addEventListener('click', openTrace);
  $('#trace-clear').addEventListener('click', () => { app.trace = null; scheduleSave(); updateChips(); requestRender(); });
  $('#replay').addEventListener('click', () => { $('#settings').close(); startReplay(); });
  // The Drawing sheet and the top bar's New, Open and Save.
  $('#drawing-name').addEventListener('input', (e) => { setName(e.target.value); scheduleSave(); emit('name'); });
  $('#name-roll').addEventListener('click', () => { setName(sillyName(Math.random, app.drawingName)); $('#drawing-name').value = app.drawingName; scheduleSave(); emit('name'); });
  $('#drawing-name').addEventListener('change', (e) => { e.target.value = app.drawingName; });
  // New and Open add a drawing to this browser's drawings, never in place of one.
  $('#top-new').addEventListener('click', galleryNew);
  $('#file-open').addEventListener('click', openProject);
  $('#top-open').addEventListener('click', openProject);
  $('#file-save').addEventListener('click', () => saveFile());
  $('#top-save').addEventListener('click', () => saveFile());
  $('#file-saveas').addEventListener('click', () => saveFile({ asNew: true }));
  $('#file-png').addEventListener('click', savePicture);
  $('#file-svg').addEventListener('click', saveVector);
  $('#file-replay').addEventListener('click', () => { $('#drawing').close(); startReplay(); });
  $('#save-note-save').addEventListener('click', async () => { if (await saveFile()) $('#save-note').hidden = true; });
  $('#save-note-close').addEventListener('click', () => { $('#save-note').hidden = true; });
  $('#move-open').addEventListener('click', openMoved);
  wireGallery();
  $('#move-close').addEventListener('click', () => { $('#move-note').hidden = true; app.pendingMove = null; });
}
