// "Keep fine detail" made visible (owner, 2026-10-12: keep it as the default,
// make it visible; then "rename it to Keep"). The stored setting and the
// paint mode keep their old value, 'protect', so saved settings still work;
// only what people read says Keep. Which cells a stroke would skip, the order the
// mode chip cycles through, and the once-a-session notice. Pure logic, no DOM.
import * as L from './lattice.js';

export const MODES = ['protect', 'behind', 'replace'];
export const MODE_LABEL = { protect: 'Keep', behind: 'Behind', replace: 'Replace' };
export const MODE_SAYS = {
  protect: 'Keep fine detail: a bigger cell skips cells that already have finer detail inside',
  behind: 'Paint behind: fills only the empty parts, keeps everything painted',
  replace: 'Replace: paints over everything',
};
export const nextMode = (m) => MODES[(MODES.indexOf(m) + 1) % MODES.length];

// Split stroke cells into the ones that would be painted and the ones Keep
// would skip (they hold finer painted detail). Only Keep skips; the eraser
// always erases, so callers pass mode 'replace' for it.
export function protectSplit(drawing, cells, mode) {
  const paint = [], skip = [];
  for (const c of cells) {
    if (mode === 'protect' && (drawing.sub.get(L.cellKey(c)) || 0) > 0) skip.push(c); else paint.push(c);
  }
  return { paint, skip };
}

// The first stroke that skips cells in a session says so, once.
// session: {told: boolean}. Returns the message, or null.
export function skipNotice(session, skipped) {
  if (session.told || skipped <= 0) return null;
  session.told = true;
  return `Keep fine detail skipped ${skipped} ${skipped === 1 ? 'cell' : 'cells'}. Tap the paint can by ⌖ to switch to Replace.`;
}
