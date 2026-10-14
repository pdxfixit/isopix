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

// The start of a saved file's name: the drawing's name with characters that
// file systems refuse removed, spaces as dashes. "isopix" when nothing is left.
export function fileBase(name) {
  const s = cleanName(name).replace(/[\\/:*?"<>|]/g, '').replace(/^\.+/, '').replace(/\s+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '').slice(0, 60);
  return s || 'isopix';
}

// "a moment ago", "3 minutes ago", "2 h ago".
function ago(ms) {
  const min = Math.floor(ms / 60000);
  return ms < 60000 ? 'a moment ago' : min < 60 ? `${min} ${min === 1 ? 'minute' : 'minutes'} ago` : `${Math.floor(min / 60)} h ago`;
}

// "Saved in this browser …" for the time since the last autosave.
export function savedAgo(ms) {
  if (ms == null || !Number.isFinite(ms)) return 'Not saved in this browser yet.';
  return `Saved in this browser ${ago(ms)}. Nothing leaves your device.`;
}

// The file line under it: whether this drawing is in a file, and whether it
// changed since. `file` is app.file: {name, at (when saved or opened), via:
// 'save' | 'open', dirty, linked (Save writes that same file again)}.
export function fileLine(file, hasContent, now = Date.now()) {
  const f = file || {};
  if (!f.at || !Number.isFinite(f.at)) return hasContent ? 'Not saved to a file yet. Save file keeps a copy you can open on any device.' : '';
  const when = ago(Math.max(0, now - f.at));
  if (f.dirty) return `Changed since ${f.via === 'open' ? 'you opened' : 'you saved'} ${f.name} ${when}. Save file to keep the changes.`;
  const done = f.via === 'open' ? `Opened ${f.name} ${when}.` : `Saved as ${f.name} ${when}.`;
  return f.linked ? `${done} Save writes to the same file.` : done;
}

// Whether the Save buttons wear the "not in a file" dot.
export const unsavedToFile = (file, hasContent) => !!hasContent && (!file || !file.at || !!file.dirty);

// What New and Open do: go ahead when there is nothing to lose (nothing
// drawn, or every change already in a file), else ask.
export function newChoices(hasContent, unsaved = true) {
  return hasContent && unsaved ? ['save-first', 'new-anyway', 'cancel'] : ['new-now'];
}

// ---------- Settings sections ----------
export const SECTION_IDS = ['set-drawing', 'set-grid', 'set-selection', 'set-learning'];
export const OPEN_FIRST = 'set-drawing';

// The chip on each section's heading: the current value, in a few words.
export function chipText(id, s, paper = 'light') {
  switch (id) {
    case 'set-drawing': {
      const parts = [MODE_LABEL[s.protect] || 'Keep', `${paper === 'dark' ? 'dark' : 'light'} paper`];
      if (s.symmetry && s.symmetry !== 'off') parts.push('symmetry');
      return parts.join(' · ');
    }
    case 'set-grid':
      if (!s.gutters) return 'gutters off';
      return s.hint === 'off' ? 'hints off' : `hints ${s.hint}`;
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

// Which sections this device keeps open. Stored as a JSON list: the ids of
// sections opened, and "!<id>" for the open-first section once folded.
export function rememberedOpen(raw) {
  try {
    const list = JSON.parse(raw ?? '[]');
    return new Set(Array.isArray(list) ? list.filter((x) => typeof x === 'string') : []);
  } catch { return new Set(); }
}
export const startsOpen = (id, remembered) => (id === OPEN_FIRST ? !remembered.has(`!${id}`) : remembered.has(id));
export function rememberOpen(openIds) {
  const list = [];
  for (const id of SECTION_IDS) {
    const open = openIds.has(id);
    if (id === OPEN_FIRST ? !open : open) list.push(id === OPEN_FIRST ? `!${id}` : id);
  }
  return JSON.stringify(list);
}
