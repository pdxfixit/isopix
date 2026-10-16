// Several drawings in one browser: the list of drawings, which one is open,
// and where each is kept in IndexedDB. Pure logic, no DOM or IndexedDB
// (test/gallery.test.mjs); web/ui/gallery.js shows it and app.js stores it.
//
// IndexedDB keys (store `kv`):
//   drawings          the list: [{id, name, savedAt, thumb}], newest first
//   drawing-open      the id of the drawing in use
//   drawing:<id>      its project (engine/project.js save)
//   copies:<id>       its autosave copies (web/autosave.js)
//   file:<id>         its file record (which file it was saved to or opened from)
// Before several drawings, one drawing lived at `autosave`, `autosave-copies`
// and `file`; migrate() moves it in once and leaves those keys as they were.

import { meta } from './engine/project.js';

export const LIST = 'drawings';
export const OPEN = 'drawing-open';
export const recordKey = (id) => `drawing:${id}`;
export const copiesKey = (id) => `copies:${id}`;
export const fileKey = (id) => `file:${id}`;

const ID_RE = /^[a-z0-9-]{4,40}$/;

// A new id: crypto.randomUUID where there is one (it needs https or localhost).
export function newId(rand = Math.random, now = Date.now()) {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  return `${now.toString(36)}-${Math.floor(rand() * 36 ** 8).toString(36).padStart(8, '0')}`;
}

// The list as stored: anything that is not an entry is dropped, never opened.
export function entriesOf(stored) {
  if (!Array.isArray(stored)) return [];
  const seen = new Set();
  const out = [];
  for (const e of stored) {
    if (!e || typeof e !== 'object' || typeof e.id !== 'string' || !ID_RE.test(e.id) || seen.has(e.id)) continue;
    seen.add(e.id);
    out.push({
      id: e.id,
      name: typeof e.name === 'string' && e.name.trim() ? e.name.slice(0, 80) : 'Untitled drawing',
      savedAt: Number.isFinite(e.savedAt) ? e.savedAt : 0,
      thumb: typeof e.thumb === 'string' && e.thumb.startsWith('data:image/') ? e.thumb : null,
    });
  }
  return sortNewest(out);
}

const sortNewest = (list) => list.sort((a, b) => b.savedAt - a.savedAt);

// The list with `entry` added or updated (fields it does not give are kept).
export function withEntry(list, entry) {
  const old = list.find((e) => e.id === entry.id);
  const merged = { ...(old || { name: 'Untitled drawing', savedAt: 0, thumb: null }), ...entry };
  return sortNewest([merged, ...list.filter((e) => e.id !== entry.id)]);
}

export const without = (list, id) => list.filter((e) => e.id !== id);

// Which drawing to open: the one marked open when it is still in the list,
// else the newest, else none (a new one is made).
export function whichOpen(list, openId) {
  if (openId && list.some((e) => e.id === openId)) return openId;
  return list[0]?.id ?? null;
}

// After deleting `id`: the drawing to open next (the newest left), or null.
export const afterDelete = (list, id) => without(list, id)[0]?.id ?? null;

// The one-time move of the single drawing kept before several drawings.
// Returns null when there is nothing to move (a first visit, or done already),
// else the list, the id and the writes to make: [[key, value], …].
export function migrate({ list, autosave, copies, file }, id, now = Date.now()) {
  if (Array.isArray(list)) return null;
  if (!autosave || typeof autosave !== 'object') return null;
  const m = meta(autosave);
  const savedAt = m.savedAt ?? now;
  const writes = [[recordKey(id), autosave]];
  if (copies) writes.push([copiesKey(id), copies]);
  if (file && typeof file === 'object') writes.push([fileKey(id), file]);
  const entry = { id, name: typeof m.name === 'string' && m.name.trim() ? m.name : 'Untitled drawing', savedAt, thumb: null };
  return { id, list: [entry], writes };
}

// "Bouncy Badger copy", then "Bouncy Badger copy 2", … never a name in use.
export function copyName(name, names) {
  const used = new Set(names);
  const base = `${name} copy`.slice(0, 80);
  if (!used.has(base)) return base;
  for (let n = 2; ; n++) {
    const c = `${name.slice(0, 74)} copy ${n}`;
    if (!used.has(c)) return c;
  }
}

// A drawing left empty (New, then nothing drawn) is not kept when another
// is opened: it would only clutter the list.
export const keepOnLeave = (hasContent) => !!hasContent;
