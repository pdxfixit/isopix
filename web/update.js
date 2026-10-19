// The "🆕 App update ready." bar, ported from Noodle Pads.
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

// Whether the bar fits above an open selection bar, with the density handle
// above it: placeHandle keeps the handle's middle 30 px above the bar and at
// least 80 px down, under the top buttons (without the handle, the bar need
// only clear their bottom, 56 px down). Pure. At 480 × 320 it does not, so the bar waits
// for Done (owner, 2026-10-19: "hold the update bar while a selection is open
// on a screen too short for it, and show it after Done").
//   selTop: the selection bar's top; barH: the update bar's height; handle: shown
export function barFits({ selTop, barH, handle }) {
  return selTop - 8 - barH >= (handle ? 80 + 30 : 56);
}

// The version a version.json response names, or null.
export function liveVersionOf(json) {
  if (!json || typeof json !== 'object' || typeof json.version !== 'string') return null;
  const v = json.version.slice(0, 60);
  return real(v) ? v : null;
}

// The tiny build stamp in the bottom-right corner: the app's release and the
// commit the deploy stamped into version.json. Pure. A copy with no
// version.json (a dev server) says 'dev' after the release.
//   app:  self.ISOPIX_VERSION, or undefined
//   json: the parsed version.json, or null
const releaseOf = (app) => (typeof app === 'string' && app ? app : 'dev');
const shaOf = (json) => (json ? (typeof json.commit === 'string' && /^[0-9a-f]{4,40}$/.test(json.commit) ? json.commit.slice(0, 7) : '') : 'dev');
export function buildStamp(app, json) {
  const sha = shaOf(json);
  return sha ? `${releaseOf(app)} · ${sha}` : releaseOf(app);
}

// The bottom of Settings says the same in words: "Version 1.0.2 (55a1363)". Pure.
export function aboutVersion(app, json) {
  const sha = shaOf(json);
  return sha ? `Version ${releaseOf(app)} (${sha})` : `Version ${releaseOf(app)}`;
}

// Where problems go: an email to support (Owner: "offer an email instead"; no
// GitHub account needed, and it stays private). The version in Settings →
// About links to its commit in the public repo.
export const REPO = 'https://github.com/pdxfixit/isopix';
// The address is never written out in a served file, so a spam harvester that
// reads the page or its scripts finds none: it is kept reversed and
// base64-encoded and built here (Owner, 2026-10-16: "consider protecting the
// email address from scrapers"). test/no-plain-email.test.mjs holds the line.
const SUPPORT_ENC = 'cHBhLnhpcG9zaUB0cm9wcHVz';
export const SUPPORT = atob(SUPPORT_ENC).split('').reverse().join('');
const hasSha = (json) => { const s = shaOf(json); return s && s !== 'dev' ? s : null; };
// The version at the bottom of Settings links to the commit this copy was built from
// (a dev copy, or a stamp without one, to the repo). Pure.
export const versionURL = (json) => (hasSha(json) ? `${REPO}/commit/${hasSha(json)}` : REPO);
// An email to support, filled in with what helps fix a problem: the version
// (and the link to its commit), the browser, the screen, whether it runs
// installed. Nothing is sent until the person sends it from their mail app. Pure.
export function reportURL({ app, json, ua = '', screen = '', installed = false } = {}) {
  const body = [
    'What happened?', '', '', 'What did you expect?', '', '',
    '--', `Isopix ${buildStamp(app, json)}${hasSha(json) ? ` (${versionURL(json)})` : ''}`,
    `Browser: ${String(ua).slice(0, 240)}`, `Screen: ${String(screen).slice(0, 40)}`, `Installed: ${installed ? 'yes' : 'no'}`,
  ].join('\n');
  // mailto wants %20 for spaces, not URLSearchParams' +.
  const q = (s) => encodeURIComponent(s);
  return `mailto:${SUPPORT}?subject=${q(`Isopix ${releaseOf(app)}: `)}&body=${q(body)}`;
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
