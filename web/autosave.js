// Autosave copies: besides the autosave itself (IndexedDB key `autosave`), a
// few older copies (key `autosave-copies`), so one damaged autosave cannot lose
// the drawing. Which copies to keep, and which save to open at start.
// Pure logic, no DOM or IndexedDB (test/autosave.test.mjs); app.js stores them.

export const KEEP = 3; // copies kept besides the autosave
export const EVERY = 5 * 60 * 1000; // at most one new copy per 5 minutes, so they span time

// The copies as stored: [{savedAt, project}], newest first. Anything else is dropped.
export function copiesOf(stored) {
  if (!Array.isArray(stored)) return [];
  return stored.filter((c) => c && typeof c === 'object' && c.project && typeof c.project === 'object' && Number.isFinite(c.savedAt));
}

// True when a copy of the drawing is due at `now`: the newest copy is
// `every` old (or there is none). `newest` is that copy's savedAt, or 0.
export const copyDue = (newest, now, every = EVERY) => !(newest > 0) || now - newest >= every || now < newest;

// The copies after taking one of `project` at `now`: it goes first, the oldest
// beyond `keep` go.
export function withCopy(stored, project, now, keep = KEEP) {
  return [{ savedAt: now, project }, ...copiesOf(stored)].slice(0, keep);
}

// At start: try the autosave, then each copy, newest first, with `load` (which
// throws on a project it cannot open). Returns which one opened, as
// {from: 'autosave' | 'copy' | null, savedAt, error}: the first error met, so
// the app can say why the autosave did not open.
export function openFirst(autosave, stored, load) {
  const tries = [];
  if (autosave) tries.push({ from: 'autosave', savedAt: autosave.savedAt, project: autosave });
  for (const c of copiesOf(stored)) tries.push({ from: 'copy', savedAt: c.savedAt, project: c.project });
  let error = null;
  for (const t of tries) {
    try {
      load(t.project);
      return { from: t.from, savedAt: Number.isFinite(t.savedAt) ? t.savedAt : null, error };
    } catch (err) {
      error ??= err;
    }
  }
  return { from: null, savedAt: null, error };
}
