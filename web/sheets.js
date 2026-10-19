// Pure logic behind the Drawing and Settings sheets (owner, 2026-10-12:
// "reorganize the settings tray, and move new/save/open etc to more prominent
// positions", after Noodle Pads): the chips on the Settings sections, which
// sections a device keeps open, drawing names and file names, the "saved a
// moment ago" line, and what New asks. No DOM.
import { MODE_LABEL } from './engine/protect.js';

export const DEFAULT_NAME = 'Untitled drawing';

// A drawing name as stored: a trimmed string up to 80 characters, or the default.
export function cleanName(name) {
  const s = typeof name === 'string' ? name.replace(/[\u0000-\u001f\u007f]/g, '').replace(/\s+/g, ' ').trim().slice(0, 80) : '';
  return s || DEFAULT_NAME;
}

// The start of a saved file's name: the drawing's name in lowercase, with
// characters that file systems refuse removed, spaces as dashes. "isopix" when
// nothing is left. (Owner, 2026-10-15: "lowercase filenames".)
export function fileBase(name) {
  const s = cleanName(name).replace(/[\\/:*?"<>|]/g, '').replace(/^\.+/, '').replace(/\s+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '').slice(0, 60).toLowerCase();
  return s || 'isopix';
}

// "a moment ago", "3 minutes ago", "2 h ago".
export function ago(ms) {
  const min = Math.floor(ms / 60000);
  return ms < 60000 ? 'a moment ago' : min < 60 ? `${min} ${min === 1 ? 'minute' : 'minutes'} ago` : `${Math.floor(min / 60)} h ago`;
}

// "Kept in this browser …" for the time since the last autosave; nothing
// before the first one lands (a "not saved" line there read like an error).
export function savedAgo(ms) {
  if (ms == null || !Number.isFinite(ms)) return '';
  return `Kept in this browser ${ago(ms)}.`;
}

// The file line under it: whether this drawing is in a file, and whether it
// changed since. `file` is app.file: {name, at (when saved or opened), via:
// 'save' | 'open', dirty, linked (Save writes that same file again)}.
export function fileLine(file, hasContent, now = Date.now()) {
  const f = file || {};
  if (!f.at || !Number.isFinite(f.at)) return hasContent ? 'Not in a file yet. Save drawing to keep it on any device.' : '';
  const when = ago(Math.max(0, now - f.at));
  if (f.dirty) return `Changed since ${f.via === 'open' ? 'you opened' : 'you saved'} ${f.name} ${when}. Save drawing to keep the changes.`;
  const done = f.via === 'open' ? `Opened ${f.name} ${when}.` : `Saved as ${f.name} ${when}.`;
  return f.linked ? `${done} Save drawing writes to the same file.` : done;
}

// The update notice's second line (web/index.html #update-saved): Reload saves
// first, so the drawing is safe, unless this browser keeps nothing (a private
// window, no space), when only a file keeps it. kept: the last autosave landed.
export const reloadSafeLine = (kept, hasContent) => (kept || !hasContent
  ? 'Your drawing is saved.'
  : 'This browser is not keeping your drawing: Save drawing first.');

// Whether something drawn is not in a file (New and Open ask first then).
export const unsavedToFile = (file, hasContent) => !!hasContent && (!file || !file.at || !!file.dirty);
// The dot on the Save buttons: changes since this drawing was last saved to
// (or opened from) a file. Never before the first file: then it would only
// nag (Owner: "helpful only if it's been created first. otherwise it's premature").
export const saveDot = (file, hasContent) => !!hasContent && !!file && !!file.at && !!file.dirty;


// ---------- Settings sections ----------
export const SECTION_IDS = ['set-drawing', 'set-display', 'set-selection', 'set-learning'];

// The chip on each section's heading: the current value, in a few words.
export function chipText(id, s, paper = 'light') {
  switch (id) {
    case 'set-drawing': {
      const parts = [MODE_LABEL[s.protect] || 'Keep', `${paper === 'dark' ? 'dark' : 'light'} paper`];
      if (s.symmetry && s.symmetry !== 'off') parts.push('symmetry');
      return parts.join(' · ');
    }
    case 'set-display': {
      const parts = [s.foldColors && 'colors folded', !s.gutters ? 'gutters off' : s.hint === 'off' ? 'hints off' : `hints ${s.hint}`];
      return parts.filter(Boolean).join(' · ');
    }
    case 'set-selection': {
      const on = [s.densityHandle && 'handle', s.densityPinch && 'pinch', s.densityLongpress && 'long-press'].filter(Boolean);
      return on.length ? on.join(' · ') : 'buttons only';
    }
    case 'set-learning': {
      const on = [s.limited && 'limited palette', s.gray && 'grayscale', s.trace && 'picture'].filter(Boolean);
      return on.length ? on.join(' · ') : 'off';
    }
    default: return '';
  }
}

// Which folding sections this device keeps open (Settings', and Help's).
// Every section starts closed until the person opens it; then it stays open
// until they close it (owner: "start with sections collapsed unless the user
// has done differently (and its remembered)"). Stored as a JSON list of the
// open ids; an older "!set-drawing" entry reads as closed, the new default.
// Grid became Display (2026-10-19): its old id keeps that section open.
const RENAMED = { 'set-grid': 'set-display' };
export function rememberedOpen(raw) {
  try {
    const list = JSON.parse(raw ?? '[]');
    return new Set(Array.isArray(list) ? list.filter((x) => typeof x === 'string').map((x) => RENAMED[x] || x) : []);
  } catch { return new Set(); }
}
export const startsOpen = (id, remembered) => remembered.has(id);
// ids: the sections there are (Settings' by default); others are dropped.
export const rememberOpen = (openIds, ids = SECTION_IDS) => JSON.stringify(ids.filter((id) => openIds.has(id)));
