// The Stamps drawer (the owner's pick, 2026-10-16): the starter set and the
// person's own (Mine) as big tiles; tap one, then the grid. Mine belongs to
// this browser across drawings and is kept in IndexedDB (web/stampbook.js).

import * as SB from '../stampbook.js';
import * as store from '../storage.js';
import { placeStamp } from '../engine/density.js';
import { Drawing } from '../engine/model.js';
import { $, app, set, toast } from '../app.js';
import { thumbURL } from './files.js';
import { setTool } from './tools.js';

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

let tab = 'starter';
function render() {
  for (const t of ['starter', 'mine']) {
    const b = $(`#stamps-${t}`);
    b.setAttribute('aria-selected', String(tab === t));
    b.tabIndex = tab === t ? 0 : -1;
  }
  $('#stamps-mine').textContent = app.stamps.length ? `Mine · ${app.stamps.length}` : 'Mine';
  const grid = $('#stamps-grid');
  grid.replaceChildren();
  const list = tab === 'starter' ? SB.STARTER : app.stamps;
  const on = app.settings.brush === 'stamp' ? SB.chosen(app.stampChoice, app.stamps) : null;
  list.forEach((s, i) => {
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
    b.addEventListener('click', () => choose(tab, i));
    grid.append(b);
  });
  $('#stamps-empty').hidden = !(tab === 'mine' && !app.stamps.length);
}

export function openStamps(which) {
  tab = which || (app.stampChoice?.from === 'mine' && app.stamps.length ? 'mine' : 'starter');
  render();
  if (!$('#stamps').open) $('#stamps').showModal();
}

function choose(from, i) {
  app.stampChoice = { from, i };
  set('brush', 'stamp');
  if (app.settings.tool !== 'pencil') setTool('pencil');
  $('#stamps').close();
  toast(`${SB.chosen(app.stampChoice, app.stamps).name}: tap the grid to place it`);
}

export function wireStamps() {
  for (const t of ['starter', 'mine']) $(`#stamps-${t}`).addEventListener('click', () => { tab = t; render(); });
  $('#stamps .stamp-tabs').addEventListener('keydown', (e) => {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
    tab = tab === 'starter' ? 'mine' : 'starter';
    render();
    $(`#stamps-${tab}`).focus();
  });
}
