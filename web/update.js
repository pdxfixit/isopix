// The "🆕 An update for Isopix is ready." bar, ported from Noodle Pads.
// A copy left open (or installed on a home screen) keeps running the code it
// loaded. Now and then this asks version.json which version is live (the
// deploy writes it; sw.js never caches it) and, when it differs from the one
// this page loaded, offers a reload.
//
// It never interrupts: mid-stroke, while a density change previews, a
// marquee or the handle is dragged, a replay runs, or the menu or a picker is
// open, it neither checks nor shows, and catches up once that is over.
// Reload first saves the drawing to IndexedDB and lets a new service worker
// take over, so it loses nothing. ✕ hides the bar until the next check (every
// 10 minutes, or on coming back to the app). A dev copy ('dev') never asks.

export const CHECK_MS = 10 * 60_000;   // while the page shows
export const MIN_GAP_MS = 60_000;      // focus and showing again ask at most this often
export const TICK_MS = 2_000;          // how often a waiting check or bar looks again for a quiet moment

// What the bar should do. Pure.
//   loaded:    the version this page started with ('dev' or null when unknown)
//   live:      the version version.json names now, or null when unknown
//   busy:      a stroke, preview, drag or open menu
//   dismissed: the version ✕ was tapped on since the last check, or null
// → 'show' | 'wait' (newer, but not now) | 'none'
const real = (v) => typeof v === 'string' && v !== '' && v !== 'dev';
export function updateOffer({ loaded, live, busy, dismissed }) {
  if (!real(loaded) || !real(live) || live === loaded || live === dismissed) return 'none';
  return busy ? 'wait' : 'show';
}

// The version a version.json response names, or null.
export function liveVersionOf(json) {
  if (!json || typeof json !== 'object' || typeof json.version !== 'string') return null;
  const v = json.version.slice(0, 60);
  return real(v) ? v : null;
}

// Wires the bar. `deps` lets the tests drive it:
//   loaded() the version this page loaded; busy() true while not to disturb;
//   beforeReload() async, saves and readies the new worker;
//   fetch, reload, now, every (setInterval), doc and win (event targets).
export function initUpdate(deps) {
  const {
    bar, reloadBtn, closeBtn,
    loaded, busy,
    beforeReload = async () => {},
    fetch = (...a) => globalThis.fetch(...a),
    reload = () => globalThis.location.reload(),
    now = () => Date.now(),
    every = (fn, ms) => setInterval(fn, ms),
    doc = globalThis.document,
    win = globalThis.window,
  } = deps;
  let live = null;
  let dismissed = null;
  let owed = false;
  let lastAsked = now();  // the page just loaded what is live
  let asking = false;
  let reloading = false;

  const visible = () => doc?.visibilityState !== 'hidden';
  const show = () => {
    const offer = updateOffer({ loaded: loaded(), live, busy: busy(), dismissed });
    if (bar) bar.hidden = offer !== 'show';
    return offer;
  };

  async function ask() {
    if (asking) return;
    asking = true;
    owed = false;
    lastAsked = now();
    try {
      const res = await fetch('version.json', { cache: 'no-store' });
      if (res?.ok) live = liveVersionOf(await res.json()) ?? live;
      dismissed = null; // ✕ lasts one round: each check offers the newer version again
    } catch { /* offline, or no version file: try again later */ }
    asking = false;
    show();
  }

  function tick() {
    if (owed && real(loaded()) && visible() && !busy() && now() - lastAsked >= MIN_GAP_MS) return ask();
    show();
    return undefined;
  }

  const due = () => { owed = true; return tick(); };
  doc?.addEventListener?.('visibilitychange', () => { if (visible()) due(); });
  win?.addEventListener?.('focus', due);
  every(() => { if (visible()) due(); }, CHECK_MS);
  every(() => tick(), TICK_MS);

  reloadBtn?.addEventListener('click', async () => {
    if (reloading || show() !== 'show') return; // busy since it showed: it waits, hidden
    reloading = true;
    try { await beforeReload(); } catch { /* reload anyway: the autosave already ran on each change */ }
    reload();
  });
  closeBtn?.addEventListener('click', () => {
    dismissed = live;
    show();
  });

  return { tick, due, ask, live: () => live };
}
