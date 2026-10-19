// The Palettes drawer (owner, 2026-10-18): the person's own palettes first,
// then the presets, which never change. Mine belongs to this browser across
// drawings and is kept in IndexedDB (web/palettes.js); a drawing file carries
// the palette it used, and opening the file adds it to Mine.

import * as PB from '../palettes.js';
import * as store from '../storage.js';
import { $, app, emit, set, toast } from '../app.js';
import { buildPalette, pickedColor } from './controls.js';

// Mine, read at start. A lesson's practice palettes are kept only with the
// practice drawing (endPractice), so nothing is stored during one. The one
// custom color the app kept before palettes becomes "My colors", once.
export async function loadPalettes() {
  app.palettes = PB.clean([...PB.clean(await store.idbGet(PB.KEY)), ...app.palettes]);
  const s = app.settings;
  if (s.custom) {
    const r = PB.fromCustom(app.palettes, s.custom, app.drawing.paper);
    app.palettes = r.mine;
    if (r.id && s.color === s.custom) set('palette', r.id);
    set('custom', '');
    savePalettes();
  }
  buildPalette();
}
export function savePalettes() {
  if (!app.practice) store.idbSet(PB.KEY, app.palettes);
}

export const currentPalette = () => PB.find(app.settings.palette, app.palettes);

// A drawing file opened here: the palette it used joins Mine (once) and is the one in use.
export function adoptPalette(carried) {
  if (!carried) return;
  const r = PB.adopt(app.palettes, carried);
  if (!r.id) return;
  if (r.mine !== app.palettes) { app.palettes = r.mine; savePalettes(); }
  set('palette', r.id);
  buildPalette();
}

// The eyedropper: the color joins the palette in use (a preset is copied first).
export function pickAny(color) {
  const was = currentPalette();
  const r = PB.addColor(app.palettes, app.settings.palette, color, app.drawing.paper);
  if (r.mine !== app.palettes) { app.palettes = r.mine; savePalettes(); }
  if (r.id !== app.settings.palette) set('palette', r.id);
  set('color', color.toLowerCase());
  buildPalette();
  pickedColor();
  emit('color', { custom: true });
  if (r.copied) toast(`${was.name} stays as it is: this color went in ${r.copied}, your own copy`);
  else if (r.full) toast(`${was.name} is full (${PB.MAX} colors). Take one out in Palettes to keep this one`);
}

function card(p, mine) {
  const box = document.createElement('div');
  const on = p.id === currentPalette().id;
  box.className = 'pal-card' + (on ? ' on' : '');
  const colors = PB.colorsOf(p, app.drawing.paper);
  const pick = document.createElement('button');
  pick.type = 'button';
  pick.className = 'pal-pick';
  pick.setAttribute('aria-pressed', String(on));
  pick.setAttribute('aria-label', `${p.name}, ${colors.length} colors`);
  const name = document.createElement('b');
  name.textContent = (on ? '✓ ' : '') + p.name;
  const dots = document.createElement('span');
  dots.className = 'pal-dots';
  for (const c of colors) { const i = document.createElement('i'); i.style.background = c; dots.append(i); }
  pick.append(name, dots);
  pick.addEventListener('click', () => choose(p.id));
  box.append(pick);
  if (mine) {
    const more = document.createElement('button');
    more.type = 'button';
    more.className = 'btn';
    more.textContent = '⋯';
    more.setAttribute('aria-label', `Change ${p.name}: rename, take out colors or delete`);
    more.addEventListener('click', () => openEdit(p.id));
    box.append(more);
  }
  return box;
}

function render() {
  $('#palettes-mine').replaceChildren(...app.palettes.map((p) => card(p, true)));
  $('#palettes-empty').hidden = app.palettes.length > 0;
  $('#palettes-presets').replaceChildren(...PB.PRESETS.map((p) => card(p, false)));
}

export function openPalettes() {
  render();
  if (!$('#palettes').open) $('#palettes').showModal();
}

// Switching palettes: the color in use stays if the new palette has it, else its first.
function usePalette(id) {
  set('palette', id);
  const colors = PB.colorsOf(currentPalette(), app.drawing.paper);
  if (!colors.includes(app.settings.color)) set('color', colors[0]);
  buildPalette();
}
function choose(id) {
  usePalette(id);
  $('#palettes').close();
  emit('palette', { preset: PB.isPreset(id) });
  toast(`Painting from ${currentPalette().name}`);
}

let editing = null, deleteArmed = false;
function renderEdit() {
  const p = app.palettes.find((q) => q.id === editing);
  if (!p) return $('#palette-edit').close();
  const box = $('#palette-edit-colors');
  box.replaceChildren(...p.colors.map((c) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'swatch';
    b.style.setProperty('--c', c);
    b.disabled = p.colors.length === 1;
    b.setAttribute('aria-label', p.colors.length === 1 ? `${c}, the last color (delete the palette instead)` : `Take out ${c}`);
    b.addEventListener('click', () => {
      app.palettes = PB.removeColor(app.palettes, editing, c);
      savePalettes(); renderEdit(); render(); buildPalette();
    });
    return b;
  }));
  const del = $('#palette-delete');
  del.textContent = deleteArmed ? `Tap again to delete ${p.name}` : 'Delete palette';
}
function openEdit(id) {
  editing = id; deleteArmed = false;
  $('#palette-edit-name').value = app.palettes.find((p) => p.id === id)?.name || '';
  renderEdit();
  $('#palette-edit').showModal();
}

export function wirePalettes() {
  $('#palette-new').addEventListener('click', () => {
    const r = PB.newPalette(app.palettes, app.settings.color);
    app.palettes = r.mine;
    savePalettes();
    set('palette', r.id);
    buildPalette(); render();
    toast('New palette: add colors with the eyedropper');
  });
  $('#palette-delete').addEventListener('click', () => {
    if (!deleteArmed) { deleteArmed = true; return renderEdit(); }
    const p = app.palettes.find((q) => q.id === editing);
    app.palettes = PB.remove(app.palettes, editing);
    savePalettes();
    if (app.settings.palette === editing) usePalette('isopix');
    editing = null; // so closing does not rename it
    $('#palette-edit').close();
    render();
    toast(`Deleted ${p?.name || 'the palette'}`);
  });
  $('#palette-edit').addEventListener('close', () => {
    if (editing) {
      app.palettes = PB.rename(app.palettes, editing, $('#palette-edit-name').value);
      savePalettes(); buildPalette();
      if ($('#palettes').open) render();
    }
    editing = null;
  });
}
