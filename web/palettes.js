// The palettes a person paints from: the presets, which never change, and
// their own (Mine), which belong to this browser across all its drawings.
// Owner, 2026-10-18: "Pre-Saved pallets cannot be overridden. They can be
// copied and added to as a personal one, but they should stay the same like
// other presets in the game." Picking a color of one's own on a preset copies
// the preset into Mine with that color added, so no picked color is lost.
// Pure logic (test/palettes.test.mjs); app.js keeps Mine in IndexedDB at `palettes`.

import { paperOf } from './engine/paper.js';

export const KEY = 'palettes';
export const MAX = 24; // colors in one palette
const HEX = /^#[0-9a-f]{6}$/i;

// Isopix's own inks follow the drawing's paper (engine/paper.js); the others are fixed.
export const PRESETS = [
  { id: 'isopix', name: 'Isopix' },
  { id: 'sunset', name: 'Sunset', colors: ['#ffd166', '#ffbe0b', '#fb8500', '#f3722c', '#e63946', '#c1121f', '#780000', '#3d1a40'] },
  { id: 'forest', name: 'Forest', colors: ['#283618', '#3a5a40', '#588157', '#a3b18a', '#dad7cd', '#606c38', '#7f5539', '#b08968'] },
  { id: 'ocean', name: 'Ocean', colors: ['#03045e', '#023e8a', '#0077b6', '#00b4d8', '#90e0ef', '#caf0f8', '#f8f9fa', '#f4a261'] },
  { id: 'candy', name: 'Candy', colors: ['#ffafcc', '#ffc8dd', '#cdb4db', '#bde0fe', '#a2d2ff', '#caffbf', '#fdffb6', '#ffd6a5'] },
  { id: 'stone', name: 'Stone', colors: ['#111111', '#333333', '#555555', '#777777', '#999999', '#bbbbbb', '#dddddd', '#ffffff'] },
];

export const isPreset = (id) => PRESETS.some((p) => p.id === id);
const hex = (c) => (typeof c === 'string' && HEX.test(c) ? c.toLowerCase() : null);

// The palette with this id, or Isopix when there is none (deleted, or from another browser).
export function find(id, mine) {
  return mine.find((p) => p.id === id) || PRESETS.find((p) => p.id === id) || PRESETS[0];
}
export function colorsOf(p, paper) {
  return p.id === 'isopix' ? paperOf(paper).inks.slice() : p.colors.slice();
}

// Mine, from storage or a file: untrusted, so anything that is not a palette
// is dropped, colors are checked and made lowercase, each once, at most MAX.
export function clean(list) {
  const out = [], ids = new Set();
  for (const p of Array.isArray(list) ? list : []) {
    if (!p || typeof p !== 'object' || !Array.isArray(p.colors)) continue;
    const colors = [...new Set(p.colors.map(hex).filter(Boolean))].slice(0, MAX);
    if (!colors.length) continue;
    let id = typeof p.id === 'string' && /^m\d{1,9}$/.test(p.id) && !ids.has(p.id) ? p.id : null;
    if (!id) id = nextId([...out, ...list.filter((x) => x && typeof x.id === 'string')]);
    ids.add(id);
    const name = typeof p.name === 'string' && p.name.trim() ? p.name.trim().slice(0, 40) : nextName(out, 'Palette');
    out.push({ id, name, colors });
  }
  return out;
}

// m1, m2 …: the first number no palette in Mine uses.
export function nextId(mine) {
  const used = new Set(mine.map((p) => p.id));
  for (let n = 1; ; n++) if (!used.has(`m${n}`)) return `m${n}`;
}
// "My colors", then "My colors 2" …
export function nextName(mine, base) {
  const used = new Set(mine.map((p) => p.name));
  if (!used.has(base)) return base;
  for (let n = 2; ; n++) if (!used.has(`${base} ${n}`)) return `${base} ${n}`;
}

// A color of one's own, added to the palette in use. On one of Mine it joins
// the end (once; a full palette says so and keeps its colors). On a preset,
// Mine gets a copy of the preset with the color added, and that copy is the
// one in use from now on. Returns {mine, id, copied?: name, full?: true}.
export function addColor(mine, id, color, paper) {
  const c = hex(color);
  const p = find(id, mine);
  if (!c) return { mine, id: p.id };
  const colors = colorsOf(p, paper);
  if (colors.includes(c)) return { mine, id: p.id };
  if (!isPreset(p.id)) {
    if (colors.length >= MAX) return { mine, id: p.id, full: true };
    return { mine: mine.map((q) => (q === p ? { ...q, colors: [...colors, c] } : q)), id: p.id };
  }
  const copy = { id: nextId(mine), name: nextName(mine, p.id === 'isopix' ? 'My colors' : `My ${p.name}`), colors: [...colors, c].slice(-MAX) };
  return { mine: [...mine, copy], id: copy.id, copied: copy.name };
}

// A new palette of one's own, starting with the color in use.
export function newPalette(mine, color) {
  const p = { id: nextId(mine), name: nextName(mine, 'Palette'), colors: [hex(color) || '#1d1d1f'] };
  return { mine: [...mine, p], id: p.id };
}

// The last color stays: a palette is never empty (delete the palette instead).
export function removeColor(mine, id, color) {
  return mine.map((p) => (p.id === id && p.colors.length > 1 ? { ...p, colors: p.colors.filter((c) => c !== color) } : p));
}
export function rename(mine, id, name) {
  const n = typeof name === 'string' ? name.trim().slice(0, 40) : '';
  return n ? mine.map((p) => (p.id === id ? { ...p, name: n } : p)) : mine;
}
export const remove = (mine, id) => mine.filter((p) => p.id !== id);

// A palette a drawing file carries joins Mine, unless one there already has
// the same colors. Returns {mine, id}: the id of the palette with those colors.
export function adopt(mine, carried) {
  const [p] = clean([carried]);
  if (!p) return { mine, id: null };
  const same = mine.find((q) => q.colors.join() === p.colors.join());
  if (same) return { mine, id: same.id };
  const added = { ...p, id: nextId(mine), name: nextName(mine, p.name) };
  return { mine: [...mine, added], id: added.id };
}

// Before palettes the app kept one custom color, replaced by each new pick.
// It becomes "My colors": the inks it sat beside, then the custom color.
export function fromCustom(mine, custom, paper) {
  const c = hex(custom);
  if (!c) return { mine, id: null };
  const inks = paperOf(paper).inks;
  return adopt(mine, { name: 'My colors', colors: inks.includes(c) ? inks : [...inks, c] });
}
