// Files: saving and opening drawings, pictures and SVG, the trace picture,
// and taking a drawing over from an old address (web/move.js).

import * as L from '../engine/lattice.js';
import * as P from '../engine/project.js';
import { toSVG, bounds } from '../engine/svg.js';
import { drawCells, drawEdges } from '../render.js';
import * as store from '../storage.js';
import { fileKey } from '../gallery.js';
import { addDrawing } from './gallery.js';
import { addToMine } from './stamps.js';
import { adoptPalette, currentPalette } from './palettes.js';
import { isPreset } from '../palettes.js';
import { fileBase, saveDot } from '../sheets.js';
import { paperOf } from '../engine/paper.js';
import { keysToCopy, landing } from '../move.js';
import * as PNGP from '../engine/pngproject.js';
import { $, DEFAULTS, app, emit, requestRender, scheduleSave, toast } from '../app.js';
import { buildPalette, computeLevel } from './controls.js';
import { afterChange } from './tools.js';
import { drawingRun, hasContent, setName, syncMenu, updateChips, updateSavedLine } from './screens.js';

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
export const savesPng = () => app.settings.savePng || !store.offersIsopixFile({ ios: store.isIOS() });
const saveExt = () => (savesPng() ? '.isopix.png' : '.isopix');
export function isopixFile({ now = false } = {}) {
  const json = new TextEncoder().encode(JSON.stringify(projectData()));
  if (now) return new Blob([json], { type: ISOPIX_TYPE.type });
  return store.gzip(json).then((z) => new Blob([z], { type: ISOPIX_TYPE.type }));
}
export function updateFileUI() {
  const dot = saveDot(app.file, hasContent());
  for (const b of ['#top-save', '#file-save']) {
    $(b).classList.toggle('unsaved', dot);
    $(b).setAttribute('aria-label', `Save drawing${dot ? ' (changes since the last save)' : ''}`);
  }
  $('#file-saveas').hidden = !app.file.handle;
  if ($('#drawing').open) updateSavedLine();
}
// The file record outlives a reload (IndexedDB can keep a file handle in
// Chrome; where it cannot, it is kept without one).
export async function rememberFile() {
  if (app.practice) return; // a lesson's practice drawing is never this browser's drawing
  if (!app.drawingId) return;
  const key = fileKey(app.drawingId);
  if (!(await store.idbSet(key, app.file))) await store.idbSet(key, { ...app.file, handle: null });
}
// Every change: the dot follows whether something drawn is not in a file
// (already "changed" on an empty page, a first stroke still needs the dot).
export function markChanged() {
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
export function sayResult(r, what) {
  const how = r.cancelled ? 'cancelled' : r.failed ? 'failed' : r.how || (r.handle ? 'file' : 'download');
  app.events?.track('isopix.save', { what: what.replace(/ /g, '-'), how });
  if (r.cancelled) toast('Not saved');
  else if (r.failed) toast(`Could not save the ${what}: ${r.failed}`);
  else if (r.handle) toast(`Saved to ${r.name}`);
  else if (r.how === 'share') toast(`${what[0].toUpperCase()}${what.slice(1)} saved`);
  else toast(`Saved ${r.name} to your downloads`);
}
// Returns true once the drawing is in a file. A file kept from an earlier
// Save is written again only when it is the same kind (PNG or project file).
export async function saveFile({ asNew = false } = {}) {
  const png = savesPng();
  if (png && !pngCanvas()) { toast('Nothing to save yet'); return false; }
  const ext = saveExt(), h = app.file.handle;
  const handle = !asNew && h && String(h.name || '').endsWith(ext) ? h : null;
  const r = await store.saveBlob({ name: `${fileBase(app.drawingName)}${ext}`, ...(png ? PNG_TYPE : ISOPIX_TYPE), make: png ? projectPng : isopixFile, handle });
  sayResult(r, 'drawing');
  if (r.cancelled || r.failed) return false;
  fileSaved(r, 'save');
  if (!app.practice && drawingRun) app.events?.track('content.finish', { kind: 'drawing', ms: Date.now() - drawingRun.at });
  emit('saved', { what: 'drawing' });
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
export function projectPng({ now = false } = {}) {
  const c = pngCanvas();
  if (!c) throw new Error('nothing drawn');
  const text = JSON.stringify(projectData());
  if (now) return new Blob([PNGP.embedNow(canvasBytesNow(c), text)], { type: 'image/png' });
  return new Promise((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error('the picture is too big for this browser'))), 'image/png'))
    .then(async (b) => new Blob([await PNGP.embed(new Uint8Array(await b.arrayBuffer()), text, store.deflate)], { type: 'image/png' }));
}
export async function savePicture() {
  const c = pngCanvas();
  if (!c) return toast('Nothing to save yet');
  const make = ({ now }) => (now ? canvasBlobNow(c) : new Promise((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error('the picture is too big for this browser'))), 'image/png')));
  sayResult(await store.saveBlob({ name: `${fileBase(app.drawingName)}.png`, type: 'image/png', accept: { description: 'PNG picture', ext: ['.png'] }, make }), 'picture');
}
export async function saveVector() {
  if (!app.drawing.cells.size && !app.drawing.edges.size) return toast('Nothing to save yet');
  sayResult(await store.saveBlob({ name: `${fileBase(app.drawingName)}.svg`, type: 'image/svg+xml', accept: { description: 'SVG vector picture', ext: ['.svg'] }, make: () => svgBlob() }), 'sharp picture');
}
// ---------- files ----------
export function projectData() {
  const s = app.settings;
  const extra = { view: { zoom: app.view.zoom, cx: app.view.cx, cy: app.view.cy }, stamps: app.stamps, symmetry: { mode: s.symmetry, l: s.symL, p: s.symP, q: s.symQ } };
  extra.name = app.drawingName;
  // The palette of one's own in use travels with the drawing; opening the file adds it to Mine.
  const pal = currentPalette();
  if (!s.limited && !isPreset(pal.id)) extra.palette = { name: pal.name, colors: pal.colors };
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
// A small picture of a drawing (the open one unless given) for the Drawings
// grid and the Stamps drawer, centered on its paper; null when nothing is drawn.
export function thumbURL(w = 240, h = 160, d = app.drawing) {
  const b = bounds(d);
  if (!b) return null;
  const bw = b.x1 - b.x0, bh = b.y1 - b.y0, pad = 0.08 * Math.max(bw, bh, 0.1);
  const scale = Math.min(w / (bw + 2 * pad), h / (bh + 2 * pad));
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const ctx = c.getContext('2d');
  ctx.fillStyle = paperOf(d.paper).bg;
  ctx.fillRect(0, 0, w, h);
  const ox = (b.x0 + b.x1) / 2 - w / 2 / scale, oy = (b.y0 + b.y1) / 2 - h / 2 / scale;
  drawCells(ctx, d, { zoom: scale, ox, oy }, { x0: ox, y0: oy, x1: ox + w / scale, y1: oy + h / scale }, 0.7);
  drawEdges(ctx, d, { zoom: scale, ox, oy });
  return c.toDataURL('image/png');
}
export function pngBlob() {
  const c = pngCanvas();
  return c ? new Promise((r) => c.toBlob(r, 'image/png')) : Promise.resolve(null);
}
export function loadProjectObject(obj) {
  const d = P.load(obj);
  app.drawing = d;
  // Stamps a drawing or file carries join this browser's own (Mine), once each.
  const m = P.meta(obj);
  if (Array.isArray(m.stamps)) addToMine(m.stamps);
  if (m.view && Number.isFinite(m.view.zoom)) { app.view.zoom = m.view.zoom; app.view.cx = m.view.cx || 0; app.view.cy = m.view.cy || 0; }
  app.selection = null;
  app.trace = null;
  setName(m.name); // none: "Untitled drawing"
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
// Whatever goes wrong inside (not gzip, not JSON, a damaged chunk), the
// person hears one plain sentence (P.NOT_ISOPIX), not a parser's message.
export async function projectFromFile(f) {
  let bytes = new Uint8Array(await f.arrayBuffer());
  const json = (text) => { try { return JSON.parse(text); } catch { throw new Error(P.NOT_ISOPIX); } };
  try { if (bytes[0] === 0x1f && bytes[1] === 0x8b) bytes = await store.gunzip(bytes); } catch { throw new Error(P.NOT_ISOPIX); }
  if (!PNGP.isPNG(bytes)) return json(new TextDecoder().decode(bytes));
  let text;
  try { text = await PNGP.extract(bytes, store.inflate); } catch { throw new Error(P.NOT_ISOPIX); }
  if (text == null) throw new Error('this picture has no Isopix drawing inside. To draw over a picture, use Settings → Learning → Trace a picture');
  return json(text);
}
export async function openProject() {
  const r = await store.openFile({ accept: { 'image/png': ['.png'], 'application/x-isopix': ['.isopix'], 'application/json': ['.json'] }, description: 'Isopix drawing' });
  if (!r) return;
  const f = r.file;
  if (f.size > 50 * 1024 * 1024) return toast('That file is too big for a project');
  try {
    const obj = await projectFromFile(f);
    // It joins this browser's drawings; the one open now stays in the list.
    await addDrawing(obj, { file: { name: f.name, at: Date.now(), via: 'open', dirty: false, handle: r.handle || null }, say: `Opened ${f.name}` });
    adoptPalette(P.meta(obj).palette);
    if ($('#settings').open) $('#settings').close(); if ($('#drawing').open) $('#drawing').close();
  } catch (err) { toast(`Could not open it: ${err.message}`); }
}
export async function openTrace() {
  const f = await store.pickFile('image/*');
  if (f) placeTrace(f);
}
// Place a picture file under the grid (also used by tools/export_check.mjs).
export function placeTrace(f) {
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
// here, offered by a note, until opened (as another drawing) or dismissed.
export async function openMoved() {
  const m = app.pendingMove;
  if (!m) return;
  try {
    await addDrawing(m, { say: 'Opened the drawing from the old address; yours is in Drawings' });
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
export function takeMovedSettings(arriving) {
  const has = (k) => { try { return localStorage.getItem(k) !== null; } catch { return true; } };
  const copy = keysToCopy(arriving.local, has);
  for (const [k, v] of copy) { try { localStorage.setItem(k, v); } catch { /* storage blocked */ } }
  if (copy.length) app.settings = store.loadSettings(DEFAULTS);
}
// The drawing carried from the old address: taken when this browser has none
// here, else offered; one already taken is never taken twice (move.js landing).
export async function takeMovedDrawing(arriving) {
  if (arriving.dropped.includes('drawing')) {
    showMoveNote(arriving.savedFile
      ? 'Isopix moved to isopix.app. Your drawing was too big to bring along by itself, so it was saved to your downloads as a file: open it with Drawing → Open.'
      : 'Isopix moved to isopix.app. Your drawing at the old address was too big to bring along.', false);
    return;
  }
  const m = arriving.autosave;
  if (!m) return;
  const seen = (await store.idbGet('moved-in')) || [];
  const savedAt = P.meta(m).savedAt;
  const what = landing({ incoming: { from: arriving.from, savedAt, hasContent: P.hasContent(m) }, current: { hasContent: hasContent(), savedAt: app.lastSaved }, seen: Array.isArray(seen) ? seen : [] });
  if (what === 'ignore') return;
  store.idbSet('moved-in', [...(Array.isArray(seen) ? seen : []), { from: arriving.from, savedAt }].slice(-20));
  if (what === 'offer') {
    app.pendingMove = m;
    showMoveNote('Isopix moved to isopix.app, and your drawing from the old address came along. This browser already has a drawing here, so that one stays open; Open it adds the other one.', true);
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
