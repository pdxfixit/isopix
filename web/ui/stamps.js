// The Stamps drawer (the owner's pick, 2026-10-16): the person's own (Mine)
// and the starter stamps in folding sections of big tiles (owner, 2026-10-19:
// folding sections, room for many more); tap one, then the grid. Mine belongs to
// this browser across drawings and is kept in IndexedDB (web/stampbook.js).

import * as SB from '../stampbook.js';
import * as store from '../storage.js';
import { placeStamp } from '../engine/density.js';
import { Drawing } from '../engine/model.js';
import { $, app, set, toast } from '../app.js';
import { thumbURL } from './files.js';
import { setTool } from './tools.js';
import { rememberOpen, rememberedOpen } from '../sheets.js';

// Mine, read at start; a lesson's practice stamps are kept only with the
// practice drawing (endPractice), so nothing is stored during one.
export async function loadMine() {
  app.stamps = SB.mergeMine(await store.idbGet(SB.KEY), app.stamps);
}
export function saveMine() {
  if (!app.practice) store.idbSet(SB.KEY, app.stamps);
}
export function addToMine(list) {
  const before = app.stamps.length;
  app.stamps = SB.mergeMine(app.stamps, list);
  if (app.stamps.length !== before) saveMine();
}

// A stamp's picture, drawn once per stamp and paper.
const thumbs = new Map();
function stampThumb(s) {
  const key = app.drawing.paper + SB.sigOf(s);
  if (!thumbs.has(key)) {
    const d = new Drawing();
    d.paper = app.drawing.paper;
    const { cells, edges } = placeStamp(s.stamp, { l: 3, p: 0, q: 0 });
    d.begin();
    for (const { cell, c, f } of cells) d.paint(cell, { c, f });
    for (const { edge, c } of edges) d.paintEdge(edge, { c });
    d.commit();
    thumbs.set(key, thumbURL(160, 120, d));
  }
  return thumbs.get(key);
}

// Mine and each group fold like Palettes' sections: closed until opened, and
// which are open is remembered on this device. A closed section's pictures
// are not drawn, so many stamps open quickly.
const OPEN_KEY = 'isopix-stamps-open';
const ids = () => SB.sections([]).map((sec) => sec.id);
function readOpen() { try { return rememberedOpen(localStorage.getItem(OPEN_KEY)); } catch { return new Set(); } }
let open = new Set();

function tile(s, choice, on) {
  const b = document.createElement('button');
  b.type = 'button';
  b.className = 'stamp-tile';
  b.setAttribute('aria-pressed', String(s === on));
  const img = document.createElement('img');
  img.alt = '';
  img.src = stampThumb(s) || '';
  const name = document.createElement('span');
  name.textContent = s.name;
  b.append(img, name);
  b.addEventListener('click', () => choose(choice));
  return b;
}

function render() {
  const on = app.settings.brush === 'stamp' ? SB.chosen(app.stampChoice, app.stamps) : null;
  $('#stamps-sections').replaceChildren(...SB.sections(app.stamps).map((sec) => {
    const isOpen = open.has(sec.id), here = sec.items.find((it) => it.s === on);
    const box = document.createElement('section');
    box.className = 'set-fold';
    box.id = `st-${sec.id}`;
    const head = document.createElement('button');
    head.type = 'button';
    head.className = 'set-head';
    head.setAttribute('aria-expanded', String(isOpen));
    head.setAttribute('aria-controls', `st-${sec.id}-body`);
    head.innerHTML = `<span class="set-head-caret" aria-hidden="true">${isOpen ? '▾' : '▸'}</span><span></span><span class="set-head-chip"></span>`;
    head.children[1].textContent = sec.name;
    // The chip: the stamp in use when it is in there, else how many there are.
    head.children[2].textContent = here ? `using ${here.s.name}` : sec.items.length ? `${sec.items.length}` : 'none yet';
    head.addEventListener('click', () => toggle(sec.id));
    const h = document.createElement('h3');
    h.append(head);
    const body = document.createElement('div');
    body.className = 'set-body';
    body.id = `st-${sec.id}-body`;
    body.hidden = !isOpen;
    if (isOpen && sec.items.length) {
      const grid = document.createElement('div');
      grid.className = 'stamp-grid';
      grid.append(...sec.items.map((it) => tile(it.s, it.choice, on)));
      body.append(grid);
    } else if (isOpen) {
      const p = document.createElement('p');
      p.className = 'note';
      p.textContent = 'None yet. Select part of a drawing, then Save as stamp: it lands here, ready in every drawing.';
      body.append(p);
    }
    box.append(h, body);
    return box;
  }));
}

function toggle(id) {
  if (open.has(id)) open.delete(id); else open.add(id);
  try { localStorage.setItem(OPEN_KEY, rememberOpen(open, ids())); } catch { /* storage blocked */ }
  const y = $('#stamps form').scrollTop;
  render();
  $('#stamps form').scrollTop = y;
  $(`#st-${id} .set-head`).focus();
}

export function openStamps() {
  open = readOpen();
  render();
  if (!$('#stamps').open) $('#stamps').showModal();
}

function choose(choice) {
  app.stampChoice = choice;
  set('brush', 'stamp');
  if (app.settings.tool !== 'pencil') setTool('pencil');
  $('#stamps').close();
  toast(`${SB.chosen(app.stampChoice, app.stamps).name}: tap the grid to place it`);
}
