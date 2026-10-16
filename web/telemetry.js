// Usage counts (docs/telemetry.md; docs/decisions.md, Telemetry): which
// buttons, tools, keys and settings get used in a visit, how long it lasts and
// what kind of device it is, sent once the page is hidden to the site's own
// Worker (POST /api/visit, worker/index.js), which adds the country and region
// and keeps it in D1 for 90 days. Settings → About → "Send usage counts"
// turns it off; it is on by default.
//
// Never sent: the drawing, any name, anything typed, the IP address (the
// Worker never reads it). A device is a random code that changes every 90
// days, so no device can be followed for longer (COPPA: a persistent
// identifier used only to improve the app, named in the privacy note).
//
// The pure parts (buckets, the code's rotation, cleanVisit) are exported for
// tests and for the Worker, which checks every visit with cleanVisit. Nothing
// here touches the page until initUsage runs.

export const ENDPOINT = '/api/visit';
export const HOST = 'isopix.app';
export const ROTATE_DAYS = 90;
const DAY = 24 * 60 * 60 * 1000;
export const ROTATE_MS = ROTATE_DAYS * DAY;
export const DEVICE_KEY = 'isopix-usage-device';
export const FIRST_KEY = 'isopix-usage-first';
export const MAX_COUNTS = 200;
export const MAX_COUNT = 100000;
export const MAX_ERRORS = 5;
export const MAX_BYTES = 16 * 1024;

// A count's name: a kind and one of the app's own words (a tool, a button's
// id, a key's action, a setting). Nothing a person typed can match this.
export const COUNT_NAME = /^[a-z]{1,12}:[a-z0-9-]{1,32}$/;
const HEX = (n) => new RegExp(`^[0-9a-f]{${n}}$`);
const DEVICE_RE = HEX(12), VISIT_RE = HEX(12);

export const WIDTHS = [0, 400, 700, 1000, 1400, 2000];
export const SINCE = ['new', 'week', 'month', 'quarter', 'year', 'older'];
export const CELLS = ['0', '1-99', '100-999', '1k-10k', '10k+'];

export const widthBucket = (w) => WIDTHS.filter((b) => w >= b).pop() ?? 0;
export function sinceBucket(firstDay, now) {
  const days = (now - firstDay) / DAY;
  if (!(days >= 1)) return 'new';
  return days < 7 ? 'week' : days < 31 ? 'month' : days < 92 ? 'quarter' : days < 366 ? 'year' : 'older';
}
export const cellsBucket = (n) => (n <= 0 ? '0' : n < 100 ? '1-99' : n < 1000 ? '100-999' : n < 10000 ? '1k-10k' : '10k+');

export function randomHex(n, rand = (a) => crypto.getRandomValues(a)) {
  return [...rand(new Uint8Array(Math.ceil(n / 2)))].map((b) => b.toString(16).padStart(2, '0')).join('').slice(0, n);
}

// The device's code: kept while it is under 90 days old, else a new one.
export function deviceCode(stored, now, rand) {
  if (stored && DEVICE_RE.test(stored.id) && Number.isFinite(stored.since) && stored.since <= now && now - stored.since < ROTATE_MS) return stored;
  return { id: randomHex(12, rand), since: now };
}

// A count's name from what was used: lower case, safe characters only, or null.
export function countName(kind, word) {
  const name = `${kind}:${String(word).toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 32)}`;
  return COUNT_NAME.test(name) ? name : null;
}

// Where an error happened, never its message (a message can carry a file's text).
export function errorAt(name, file, line) {
  const base = String(file || '').split(/[?#]/)[0].split('/').pop().replace(/[^a-zA-Z0-9._-]/g, '').slice(0, 40);
  const kind = String(name || 'Error').replace(/[^A-Za-z]/g, '').slice(0, 30) || 'Error';
  return `${kind} ${base || '?'}:${Number.isSafeInteger(line) && line >= 0 ? line : 0}`;
}

const bool = (v) => (v === true ? 1 : v === false ? 0 : null);
const int = (v, max) => (Number.isSafeInteger(v) && v >= 0 && v <= max ? v : null);
const oneOf = (v, list) => (list.includes(v) ? v : null);

// A visit as the Worker keeps it, or {ok: false, why}. Unknown fields are
// dropped; every kept field is checked.
export function cleanVisit(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return { ok: false, why: 'not an object' };
  if (body.v !== 1) return { ok: false, why: 'version' };
  if (!VISIT_RE.test(body.visit ?? '')) return { ok: false, why: 'visit' };
  if (!DEVICE_RE.test(body.device ?? '')) return { ok: false, why: 'device' };
  const counts = {};
  if (body.counts && typeof body.counts === 'object' && !Array.isArray(body.counts)) {
    for (const [k, n] of Object.entries(body.counts).slice(0, MAX_COUNTS)) {
      if (COUNT_NAME.test(k) && int(n, MAX_COUNT) !== null && n > 0) counts[k] = n;
    }
  }
  const errors = Array.isArray(body.errors)
    ? body.errors.filter((e) => typeof e === 'string' && /^[A-Za-z]{1,30} [A-Za-z0-9._?-]{1,40}:\d{1,7}$/.test(e)).slice(0, MAX_ERRORS)
    : [];
  return {
    ok: true,
    visit: {
      visit: body.visit,
      device: body.device,
      app: typeof body.app === 'string' && /^\d{1,3}\.\d{1,3}\.\d{1,6}$/.test(body.app) ? body.app : null,
      width: oneOf(body.width, WIDTHS),
      touch: bool(body.touch),
      pwa: bool(body.pwa),
      dark: bool(body.dark),
      reduced: bool(body.reduced),
      lang: typeof body.lang === 'string' && /^[a-z]{2,3}$/.test(body.lang) ? body.lang : null,
      since: oneOf(body.since, SINCE),
      seconds: int(body.seconds, 24 * 60 * 60),
      cells: oneOf(body.cells, CELLS),
      longtasks: int(body.longtasks, MAX_COUNT),
      counts,
      errors,
    },
  };
}

// What a click names: a tool, a brush, a swatch, or a button by its id.
function clickName(el) {
  if (el.dataset.tool) return countName('tool', el.dataset.tool);
  if (el.closest('#palette')) return 'color:swatch';
  return el.id ? countName('btn', el.id) : null;
}

const read = (key) => { try { return JSON.parse(localStorage.getItem(key) || 'null'); } catch { return null; } };
const write = (key, v) => { try { localStorage.setItem(key, JSON.stringify(v)); } catch { /* storage blocked */ } };

// Starts counting. `enabled()` is the setting; `snapshot()` gives {cells};
// `keyAction(e)` names a key press (keys.js), or null. Returns {count}, for
// what no click shows (a brush picked, a save that worked, a drawing carried
// over). Sent as text/plain: a beacon with that type never needs a preflight.
// `onControl(el, event)`, `onShortcut(action)` and `onStroke(event)` pass the
// same clicks, keys and strokes on to the usage events (events.js).
export function initUsage({ enabled, snapshot = () => ({}), keyAction = () => null, host = HOST, now = Date.now, onControl = () => {}, onShortcut = () => {}, onStroke = () => {} } = {}) {
  const counts = {};
  const errors = [];
  let longtasks = 0, lastSent = '', lastWheel = 0;
  const start = now();
  const visit = randomHex(12);
  const count = (name) => { if (name && COUNT_NAME.test(name) && Object.keys(counts).length < MAX_COUNTS) counts[name] = (counts[name] || 0) + 1; };

  document.addEventListener('click', (e) => {
    const el = e.target.closest?.('button, [role="slider"], a[id]');
    if (!el) return;
    count(clickName(el));
    onControl(el, e);
  }, { capture: true, passive: true });
  document.addEventListener('change', (e) => {
    const el = e.target;
    if (!el.closest?.('dialog')) return;
    if (el.type === 'radio') count(countName('set', `${el.name}-${el.value}`));
    else if (el.type === 'checkbox') count(countName('set', `${el.id.replace(/^opt-/, '')}-${el.checked ? 'on' : 'off'}`));
    else if (el.id) count(countName('set', el.id.replace(/^opt-/, '')));
  }, { capture: true, passive: true });
  // Never while typing: counts of letters pressed in a name field would spell part of the name.
  document.addEventListener('keydown', (e) => {
    if (e.repeat || e.target.closest?.('input, select, textarea, [contenteditable]')) return;
    const a = keyAction(e);
    if (a) { count(countName('key', a.replace(/[:+]/g, '-'))); onShortcut(a); }
  }, { capture: true, passive: true });
  const stage = document.querySelector('#stage');
  stage?.addEventListener('pointerdown', (e) => { count(countName(e.isPrimary ? 'stroke' : 'touch', e.isPrimary ? e.pointerType || 'mouse' : 'second')); onStroke(e); }, { passive: true });
  stage?.addEventListener('wheel', () => { const t = now(); if (t - lastWheel > 500) { lastWheel = t; count('view:wheel'); } }, { passive: true });
  addEventListener('error', (e) => { if (errors.length < MAX_ERRORS) errors.push(errorAt(e.error?.name, e.filename, e.lineno)); });
  addEventListener('unhandledrejection', (e) => { if (errors.length < MAX_ERRORS) errors.push(errorAt(`Unhandled${e.reason?.name || ''}`, '', 0)); });
  try { new PerformanceObserver((l) => { longtasks += l.getEntries().length; }).observe({ type: 'longtask', buffered: true }); } catch { /* not in this browser */ }

  const payload = () => {
    const t = now();
    const device = deviceCode(read(DEVICE_KEY), t);
    write(DEVICE_KEY, device);
    let first = read(FIRST_KEY);
    if (!Number.isFinite(first) || first > t) { first = t; write(FIRST_KEY, first); }
    const snap = snapshot() || {};
    return {
      v: 1, visit, device: device.id,
      app: self.ISOPIX_VERSION,
      width: widthBucket(innerWidth),
      touch: navigator.maxTouchPoints > 0,
      pwa: matchMedia('(display-mode: standalone)').matches || navigator.standalone === true,
      dark: matchMedia('(prefers-color-scheme: dark)').matches,
      reduced: matchMedia('(prefers-reduced-motion: reduce)').matches,
      lang: String(navigator.language || '').toLowerCase().split('-')[0],
      since: sinceBucket(first, t),
      seconds: Math.min(24 * 60 * 60, Math.round((t - start) / 1000)),
      cells: cellsBucket(snap.cells ?? 0),
      longtasks,
      counts: { ...counts },
      errors: [...errors],
    };
  };
  // Each send carries the whole visit so far; the Worker keeps the latest.
  const send = () => {
    if (location.hostname !== host || navigator.webdriver || !enabled()) return;
    const p = payload();
    const sig = JSON.stringify({ c: p.counts, e: p.errors, s: Math.floor(p.seconds / 60) });
    if (sig === lastSent) return;
    lastSent = sig;
    const body = new Blob([JSON.stringify(p)], { type: 'text/plain;charset=UTF-8' });
    if (!(navigator.sendBeacon && navigator.sendBeacon(ENDPOINT, body))) fetch(ENDPOINT, { method: 'POST', body, keepalive: true }).catch(() => {});
  };
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') send(); });
  addEventListener('pagehide', send);
  return { count, payload, send };
}
