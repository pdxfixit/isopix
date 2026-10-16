// Several drawings: opening, adding, copying, renaming and deleting this
// browser's drawings, their thumbnails, and the grid on the Drawing sheet.
// The list and the keys are web/gallery.js (pure, tested); this file stores
// them and draws the grid.

import * as G from '../gallery.js';
import * as AS from '../autosave.js';
import * as P from '../engine/project.js';
import * as store from '../storage.js';
import { ago, unsavedToFile } from '../sheets.js';
import { sillyName } from '../sillynames.js';
import { nextIdea, nameFor } from '../prompts.js';
import { $, app, flushSave, newDrawing, requestRender, scheduleSave, toast } from '../app.js';
import { buildPalette, computeLevel } from './controls.js';
import { afterChange } from './tools.js';
import { hasContent, leaveDrawing, setName, startDrawing, syncMenu } from './screens.js';
import { loadProjectObject, rememberFile, saveFile, thumbURL, updateFileUI } from './files.js';

const NO_FILE = () => ({ name: null, at: null, via: null, dirty: false, handle: null });
const fileFrom = (f) => (f && typeof f === 'object'
  ? { name: String(f.name || ''), at: Number(f.at) || null, via: f.via === 'open' ? 'open' : 'save', dirty: !!f.dirty, handle: f.handle || null }
  : NO_FILE());
const saveList = () => store.idbSet(G.LIST, app.gallery);
const nameOf = (id) => (id === app.drawingId ? app.drawingName : app.gallery.find((e) => e.id === id)?.name) || 'Untitled drawing';

// Load drawing `id` into the app: its record, or its newest copy that opens
// when the record will not (web/autosave.js). False when nothing opens.
async function load(id) {
  const [record, copies, file] = await Promise.all([store.idbGet(G.recordKey(id)), store.idbGet(G.copiesKey(id)), store.idbGet(G.fileKey(id))]);
  const opened = AS.openFirst(record, copies, loadProjectObject);
  if (opened.from === 'copy') toast(`The last autosave could not open, so Isopix opened the copy kept ${ago(Date.now() - opened.savedAt)}.`);
  else if (opened.error) toast(`That drawing could not open: ${opened.error.message}`);
  if (!opened.from) return false;
  app.drawingId = id;
  app.lastSaved = opened.savedAt;
  app.session.copyAt = AS.copiesOf(copies)[0]?.savedAt || 0;
  app.file = fileFrom(file);
  store.idbSet(G.OPEN, id);
  return true;
}

// A new, empty drawing with a new id. It joins the list at its first save.
function fresh() {
  app.drawing = newDrawing();
  app.selection = null; app.lastDensity = null; app.trace = null;
  setName(sillyName(Math.random, app.drawingName));
  app.file = NO_FILE();
  app.drawingId = G.newId();
  app.lastSaved = null;
  app.session.copyAt = 0;
  store.idbSet(G.OPEN, app.drawingId);
}

function refresh() {
  buildPalette(); syncMenu(); computeLevel(true); afterChange({ changed: false }); updateFileUI(); requestRender();
}

// At start: the drawing in use opens. Before several drawings there was one,
// kept at `autosave`; it moves in once (G.migrate) and those keys stay as they
// were. True when a drawing opened.
export async function openAtStart() {
  let list = await store.idbGet(G.LIST);
  if (!Array.isArray(list)) {
    const m = G.migrate({ list, autosave: await store.idbGet('autosave'), copies: await store.idbGet('autosave-copies'), file: await store.idbGet('file') }, G.newId());
    if (m) {
      let ok = true;
      for (const [k, v] of m.writes) ok = (await store.idbSet(k, v)) && ok;
      if (ok && (await store.idbSet(G.LIST, m.list))) { list = m.list; await store.idbSet(G.OPEN, m.id); }
      else return openLegacy(); // storage refuses writes (a private window): open it where it is
    }
  }
  app.gallery = G.entriesOf(list);
  const id = G.whichOpen(app.gallery, await store.idbGet(G.OPEN));
  if (id && (await load(id))) return true;
  fresh();
  return !!id;
}
// The old single drawing, opened in place when it cannot move in.
async function openLegacy() {
  const autosave = await store.idbGet('autosave');
  const opened = AS.openFirst(autosave, await store.idbGet('autosave-copies'), loadProjectObject);
  app.drawingId = G.newId();
  if (opened.from) app.lastSaved = opened.savedAt;
  return !!opened.from;
}

// Before another drawing opens: this one is saved with a fresh thumbnail, or
// dropped when nothing was drawn (G.keepOnLeave).
async function leaveCurrent(why) {
  leaveDrawing(why);
  if (!app.drawingId) return;
  if (!G.keepOnLeave(hasContent())) return drop(app.drawingId);
  app.gallery = G.withEntry(app.gallery, { id: app.drawingId, name: app.drawingName, thumb: thumbURL() });
  await flushSave();
}
async function drop(id) {
  await Promise.all([G.recordKey(id), G.copiesKey(id), G.fileKey(id)].map((k) => store.idbDel(k)));
  app.gallery = G.without(app.gallery, id);
  await saveList();
}

const notInLesson = () => {
  if (!app.practice) return true;
  toast('Finish the lesson first: Stop lesson is in the bubble');
  return false;
};
const closeSheet = () => { if ($('#drawing').open) $('#drawing').close(); };

// New: another drawing, never in place of this one.
export async function galleryNew() {
  if (!notInLesson()) return;
  await leaveCurrent('new');
  fresh();
  refresh();
  closeSheet();
  startDrawing(false);
  toast('New drawing');
}

export async function galleryOpen(id) {
  if (!notInLesson()) return;
  if (id === app.drawingId) return closeSheet();
  const back = app.drawingId;
  await leaveCurrent('switched');
  if (!(await load(id))) {
    if (!(back && app.gallery.some((e) => e.id === back) && (await load(back)))) fresh();
    refresh();
    return renderGallery();
  }
  refresh();
  closeSheet();
  startDrawing(true);
  toast(`Opened ${app.drawingName}`);
}

// A project from somewhere else (a file, an old address, a lesson's Keep it)
// becomes a new drawing in the list. `obj` is checked before anything moves.
export async function addDrawing(obj, { file = null, say = '' } = {}) {
  P.load(obj); // throws on a project that will not open; nothing has changed yet
  await leaveCurrent('replaced');
  loadProjectObject(obj);
  app.drawingId = G.newId();
  app.lastSaved = null;
  app.session.copyAt = 0;
  app.file = file || NO_FILE();
  store.idbSet(G.OPEN, app.drawingId);
  rememberFile();
  app.gallery = G.withEntry(app.gallery, { id: app.drawingId, name: app.drawingName, savedAt: Date.now(), thumb: thumbURL() });
  await flushSave();
  refresh();
  startDrawing(true);
  if (say) toast(say);
}

export async function galleryCopy(id) {
  if (id === app.drawingId) await flushSave();
  const record = await store.idbGet(G.recordKey(id));
  if (!record) return toast('That drawing could not be copied');
  const name = G.copyName(nameOf(id), app.gallery.map((e) => e.name));
  const copy = G.newId();
  if (!(await store.idbSet(G.recordKey(copy), { ...record, name }))) return toast('There is no room to copy it');
  const thumb = id === app.drawingId ? thumbURL() : app.gallery.find((e) => e.id === id)?.thumb;
  app.gallery = G.withEntry(app.gallery, { id: copy, name, savedAt: Date.now(), thumb: thumb || null });
  await saveList();
  renderGallery();
  toast(`Made ${name}`);
}

export async function galleryRename(id, name) {
  name = String(name || '').trim().slice(0, 80);
  if (!name) return;
  if (id === app.drawingId) { setName(name); $('#drawing-name').value = app.drawingName; scheduleSave(); return renderGallery(); }
  const record = await store.idbGet(G.recordKey(id));
  if (record) await store.idbSet(G.recordKey(id), { ...record, name });
  app.gallery = G.withEntry(app.gallery, { id, name });
  await saveList();
  renderGallery();
}

// Save to a file: this drawing, or another one opened for a moment and put back.
export async function gallerySaveToFile(id) {
  if (id === app.drawingId) return saveFile();
  if (!notInLesson()) return false;
  const back = app.drawingId;
  await leaveCurrent('switched');
  if (!(await load(id))) { await load(back); refresh(); return false; }
  const ok = await saveFile();
  await flushSave();
  await load(back);
  refresh();
  renderGallery();
  return ok;
}

export async function galleryDelete(id) {
  const name = nameOf(id);
  if (id === app.drawingId) {
    leaveDrawing('deleted');
    await drop(id);
    const next = G.afterDelete(app.gallery, id);
    if (!(next && (await load(next)))) fresh();
    refresh();
    startDrawing(hasContent());
  } else await drop(id);
  renderGallery();
  toast(`Deleted ${name}`);
}

// The grid: the drawing in use (with a fresh thumbnail) is always there.
// During a lesson that is the practice drawing, a card of its own: the
// person's own drawings show as saved, theirs under its own name.
export const PRACTICE_ID = 'practice';
export function renderGallery() {
  const box = $('#gallery');
  if (!box) return;
  let list = app.gallery;
  const current = app.practice ? PRACTICE_ID : app.drawingId;
  if (app.practice) list = [{ id: PRACTICE_ID, name: app.drawingName, savedAt: Date.now(), thumb: thumbURL() }, ...list];
  else if (app.drawingId) list = G.withEntry(list, { id: app.drawingId, name: app.drawingName, savedAt: app.lastSaved || Date.now(), thumb: thumbURL() });
  for (const card of [...box.querySelectorAll('.drawing-card')]) card.remove();
  for (const e of list) {
    const now = e.id === current;
    const card = document.createElement('div');
    card.className = 'drawing-card' + (now ? ' current' : '');
    card.dataset.id = e.id;
    const open = document.createElement('button');
    open.type = 'button';
    open.className = 'card-open';
    open.setAttribute('aria-label', now ? `${e.name}, open now` : `Open ${e.name}`);
    if (e.thumb) { const img = document.createElement('img'); img.src = e.thumb; img.alt = ''; open.append(img); }
    else { const blank = document.createElement('span'); blank.className = 'card-blank'; blank.textContent = 'Nothing drawn yet'; open.append(blank); }
    if (now) { const badge = document.createElement('span'); badge.className = 'card-badge'; badge.textContent = 'Open now'; open.append(badge); }
    open.addEventListener('click', () => (e.id === PRACTICE_ID ? closeSheet() : galleryOpen(e.id)));
    const foot = document.createElement('div');
    foot.className = 'card-foot';
    const name = document.createElement('span');
    name.className = 'card-name';
    name.textContent = e.name;
    const more = document.createElement('button');
    more.type = 'button';
    more.className = 'btn card-more';
    more.setAttribute('aria-label', `More for ${e.name}`);
    more.setAttribute('aria-haspopup', 'menu');
    more.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="5" cy="12" r="1.8"/><circle cx="12" cy="12" r="1.8"/><circle cx="19" cy="12" r="1.8"/></svg>';
    more.addEventListener('click', () => openCardMenu(e.id, more));
    foot.append(name);
    const top = document.createElement('div');
    top.className = 'card-top';
    top.append(open);
    if (e.id !== PRACTICE_ID) top.append(more); // the practice drawing is the lesson's, not yet theirs
    card.append(top, foot);
    box.append(card);
  }
  requestAnimationFrame(() => { for (const n of box.querySelectorAll('.card-name')) fitName(n); });
}

// A long name shrinks to fit its card, down to a readable 12 px, then ends
// in an ellipsis (owner, 2026-10-16).
export const NAME_PX = { max: 15, min: 12 };
function fitName(el) {
  let px = NAME_PX.max;
  el.style.fontSize = `${px}px`;
  while (px > NAME_PX.min && el.scrollWidth > el.clientWidth) { px -= 0.5; el.style.fontSize = `${px}px`; }
}

// The ⋯ menu on a card: Rename, Make a copy, Save to a file, Delete.
let menuFor = null;
function openCardMenu(id, anchor) {
  menuFor = id;
  const m = $('#card-menu');
  m.hidden = false;
  const sheet = $('#drawing form').getBoundingClientRect(), a = anchor.getBoundingClientRect();
  m.style.top = `${a.bottom - sheet.top + $('#drawing form').scrollTop + 4}px`;
  m.style.left = `${Math.max(8, Math.min(a.right - sheet.left - m.offsetWidth, sheet.width - m.offsetWidth - 8))}px`;
  m.querySelector('button').focus();
}
function closeCardMenu() { $('#card-menu').hidden = true; }

async function askDelete(id) {
  const d = $('#delete-confirm');
  const file = id === app.drawingId ? app.file : fileFrom(await store.idbGet(G.fileKey(id)));
  const has = id === app.drawingId ? hasContent() : true;
  const unsaved = unsavedToFile(file, has);
  $('#delete-title').textContent = `Delete ${nameOf(id)}?`;
  $('#delete-says').textContent = unsaved
    ? 'It is not saved in any file, so it cannot come back after this.'
    : `It stays in the file ${file.name}, which you can open again.`;
  $('#delete-save-first').hidden = !unsaved;
  d.dataset.id = id;
  d.showModal();
}

// Need an idea? One idea at a time, only when asked; Draw this starts a new
// drawing named after it (web/prompts.js).
let idea = null;
function showIdea(next = true) {
  if (next || !idea) idea = nextIdea(Math.random, idea);
  $('#idea-text').textContent = idea;
}
export function wireGallery() {
  $('#idea-show').addEventListener('click', () => {
    const box = $('#idea-box'), open = box.hidden;
    box.hidden = !open;
    $('#idea-show').setAttribute('aria-expanded', String(open));
    if (open) showIdea(!idea);
  });
  $('#idea-roll').addEventListener('click', () => showIdea());
  $('#idea-draw').addEventListener('click', async () => {
    const name = nameFor(idea);
    await galleryNew();
    setName(name); $('#drawing-name').value = app.drawingName; scheduleSave();
    toast(`Let's draw ${idea}!`);
  });
  $('#card-menu').addEventListener('click', async (ev) => {
    const b = ev.target.closest('[data-act]');
    if (!b) return;
    const id = menuFor;
    closeCardMenu();
    if (b.dataset.act === 'rename') {
      $('#rename-name').value = nameOf(id);
      $('#rename').dataset.id = id;
      $('#rename').showModal();
    } else if (b.dataset.act === 'copy') galleryCopy(id);
    else if (b.dataset.act === 'save') gallerySaveToFile(id);
    else if (b.dataset.act === 'delete') askDelete(id);
  });
  document.addEventListener('pointerdown', (ev) => { if (!$('#card-menu').hidden && !ev.target.closest('#card-menu, .card-more')) closeCardMenu(); });
  $('#card-menu').addEventListener('keydown', (ev) => { if (ev.key === 'Escape') { ev.stopPropagation(); ev.preventDefault(); closeCardMenu(); } });
  // Enter in the name field renames (a form's Enter would press its first button, Cancel).
  $('#rename-name').addEventListener('keydown', (ev) => { if (ev.key === 'Enter') { ev.preventDefault(); $('#rename').close('ok'); } });
  $('#rename').addEventListener('close', () => { if ($('#rename').returnValue === 'ok') galleryRename($('#rename').dataset.id, $('#rename-name').value); });
  $('#delete-confirm').addEventListener('close', () => { if ($('#delete-confirm').returnValue === 'delete') galleryDelete($('#delete-confirm').dataset.id); });
  $('#delete-save-first').addEventListener('click', async () => {
    const id = $('#delete-confirm').dataset.id;
    $('#delete-confirm').close('cancel');
    if (await gallerySaveToFile(id)) askDelete(id);
  });
  $('#file-new').addEventListener('click', galleryNew);
}
