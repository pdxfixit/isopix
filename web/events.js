// Usage events, the shared standard (pdxfixit/telemetry docs/standard.md, §3
// and §4; Arrow-Rama backlog #151): one record per thing that happened, with
// its time and order, instead of one row of counts per visit.
//
// `track(event, details)` fills in the rest of a record (app, platform, form,
// version, player, session, seq, at, tz, screen) and queues it, in memory and
// in localStorage. Nothing here sends yet: the visit beacon (telemetry.js)
// stays until the shared flarepress client takes over the transport (#151
// phase B). With Settings → About → "Send usage counts" off, nothing is
// recorded and the queue is emptied.
//
// Never recorded: coordinates, the drawing, any name or text typed, colors
// chosen, an error's message. A detail is a number, a boolean or one of the
// app's own words (`WORD`); anything else is dropped.
//
// The pure parts are exported for tests. Nothing touches the page until
// initEvents runs.

import { randomHex, deviceCode, DEVICE_KEY, FIRST_KEY, errorAt } from './telemetry.js';

export const APP = 'isopix';
export const PLATFORM = 'web';
export const QUEUE_KEY = 'isopix-events';
export const MAX_QUEUE = 1000;      // oldest dropped first: nothing sends until phase B
export const MAX_ERRORS = 20;       // per page load
export const SETTLE_MS = 1000;      // a slider's run of number changes is one setting.change

// The events Isopix sends and the keys each may carry: Isopix's rows of the
// shared list (pdxfixit/telemetry events.toml). Anything else is dropped.
export const EVENTS = {
  'app.open': ['first_run', 'vw', 'vh', 'density', 'font_scale', 'dark', 'reduced_motion', 'lang', 'input', 'pwa'],
  'app.foreground': ['away_ms'],
  'app.background': ['shown_ms'],
  'app.close': ['shown_ms'],
  'screen.view': ['from'],
  'dialog.open': ['dialog'],
  'dialog.close': ['dialog', 'answer', 'ms'],
  'control.use': ['control', 'group', 'layout', 'vw', 'vh', 'input'],
  'content.start': ['kind', 'item', 'resumed'],
  'content.finish': ['kind', 'item', 'ms'],
  'content.abandon': ['kind', 'item', 'ms', 'why'],
  'setting.change': ['key', 'from', 'to'],
  'error': ['kind', 'where', 'fatal'],
  'perf.load': ['ms', 'cold'],
  'perf.longtask': ['n', 'ms'],
  // Isopix's own (named in the report to #151's list).
  'isopix.save': ['what', 'how'],
  'isopix.strokes': ['n', 'touch', 'mouse', 'pen', 'second', 'cells'],
  'isopix.move_arrived': [],
};

// One of the app's own words: an id, a tool, a setting's value. Nothing a
// person types reaches a detail (names and text fields are never read).
export const WORD = /^[A-Za-z0-9][A-Za-z0-9._:#+-]{0,47}$/;
// Settings never recorded: colors chosen, and the symmetry center (a point
// on the paper). A swatch tap still shows as a control.use.
export const PRIVATE_SETTINGS = new Set(['color', 'custom', 'symL', 'symP', 'symQ']);

export function cleanValue(v) {
  if (typeof v === 'boolean') return v;
  if (typeof v === 'number') return Number.isFinite(v) ? Math.round(v * 1000) / 1000 : null;
  if (typeof v === 'string') return WORD.test(v) ? v : null;
  return null;
}
// Only the keys the event may carry, each a clean value.
export function cleanDetails(event, details = {}) {
  const keys = EVENTS[event] || [];
  const out = {};
  for (const k of keys) {
    if (details[k] === undefined) continue;
    const v = cleanValue(details[k]);
    if (v !== null) out[k] = v;
  }
  return out;
}

// The kind of device, from the screen (not the window, so rotating or
// resizing does not change it) and whether its main pointer is a finger.
export function formOf({ screenW, screenH, coarse }) {
  const short = Math.min(screenW || 0, screenH || 0);
  if (!coarse) return 'desktop';
  return short && short < 600 ? 'phone' : 'tablet';
}
// UTC offset in minutes (east positive): Date's offset is the other way round.
export const tzOf = (d = new Date()) => -d.getTimezoneOffset() || 0;

// A record of the standard shape (standard.md §3), or null for an unknown event.
export function makeRecord(event, details, ctx) {
  if (!Object.hasOwn(EVENTS, event)) return null;
  return {
    app: APP, platform: PLATFORM, form: ctx.form, version: ctx.version ?? null,
    player: ctx.player, session: ctx.session, seq: ctx.seq, at: ctx.at, tz: ctx.tz,
    event, screen: ctx.screen, details: cleanDetails(event, details),
  };
}

// Which toolbar or cluster holds a control (`closest` on the element).
export const GROUPS = [
  ['.topleft', 'topleft'], ['.topright', 'topright'], ['#levels', 'levels'], ['#zoom', 'zoom'],
  ['#palette', 'palette'], ['.tools', 'tools'], ['#selbar', 'selbar'], ['#popover', 'popover'],
  ['#replay-bar', 'replay'], ['#tour', 'lesson'], ['#update-bar', 'update'], ['#protect-note', 'note'],
  ['#save-note', 'note'], ['#move-note', 'note'], ['dialog', null],
];
export function groupOf(el) {
  for (const [sel, name] of GROUPS) {
    const at = el.closest?.(sel);
    if (at) return name ?? (at.id || 'dialog');
  }
  return 'other';
}
// A control's name: its id, else what it is (a tool, a swatch, a pick in the
// brush popover, a lesson, a fold), never its text.
export function controlOf(el) {
  const d = el.dataset || {};
  const name = el.id || (d.tool && `tool-${d.tool}`) || (el.classList?.contains('swatch') && 'swatch')
    || (d.pick && `pick-${d.pick}`) || (d.lesson && `lesson-${d.lesson}`)
    || (el.getAttribute?.('aria-controls') && `fold-${el.getAttribute('aria-controls')}`) || 'unnamed';
  return WORD.test(name) ? name : 'unnamed';
}
// Which arrangement shows a group, read from the page as it is laid out
// (styles.css): the grid notches are a rail on phones and short screens and a
// bar along the top on wider ones; the palette and tools stack on phones and
// share a row on wider or short landscape screens; the zoom rail drops its
// track when there is no room. `look` is what the page shows right now.
export function layoutOf(group, look) {
  if (group === 'levels') return look.notchesColumn ? 'rail' : 'top';
  if (group === 'palette' || group === 'tools') return look.bottomRow ? 'row' : 'stacked';
  if (group === 'zoom') return look.zoomTrack ? 'track' : 'buttons';
  return look.wide ? 'wide' : 'narrow';
}

// The queue: kept in memory, copied to localStorage, at most MAX_QUEUE records.
export class Queue {
  constructor(storage, key = QUEUE_KEY, max = MAX_QUEUE) {
    this.storage = storage; this.key = key; this.max = max;
    this.items = [];
    try {
      const old = JSON.parse(storage?.getItem(key) || '[]');
      if (Array.isArray(old)) this.items = old.filter((r) => r && typeof r === 'object' && typeof r.event === 'string').slice(-max);
    } catch { /* storage blocked or spoiled: start empty */ }
  }
  push(r) { this.items.push(r); if (this.items.length > this.max) this.items.splice(0, this.items.length - this.max); }
  save() { try { this.storage?.setItem(this.key, JSON.stringify(this.items)); } catch { /* full or blocked */ } }
  clear() { this.items = []; try { this.storage?.removeItem(this.key); } catch { /* blocked */ } }
}

// The player: the existing device code (telemetry.js), through this one
// function, so the id rework (#150) changes only here.
export function playerId(storage, now = Date.now()) {
  let stored = null;
  try { stored = JSON.parse(storage?.getItem(DEVICE_KEY) || 'null'); } catch { /* blocked */ }
  const code = deviceCode(stored, now);
  if (code !== stored) { try { storage?.setItem(DEVICE_KEY, JSON.stringify(code)); } catch { /* blocked */ } }
  return code.id;
}

// The core, without the page: records, the screen, settings, the switch.
// `env` gives enabled(), now(), storage, form and version.
export function createTracker(env) {
  const queue = new Queue(env.storage);
  const session = randomHex(16);
  let seq = 0, screen = 'draw', saveTimer = 0;
  const lastSetting = new Map(); // key -> {rec, at}: a slider's run folds into one record
  const on = () => { if (env.enabled()) return true; if (queue.items.length) queue.clear(); return false; };
  function track(event, details = {}) {
    if (!on()) return null;
    const at = env.now();
    const r = makeRecord(event, details, { form: env.form, version: env.version, player: playerId(env.storage, at), session, seq, at, tz: tzOf(new Date(at)), screen });
    if (!r) return null;
    seq++;
    queue.push(r);
    if (!saveTimer) saveTimer = (env.setTimeout || setTimeout)(() => { saveTimer = 0; queue.save(); }, 2000);
    return r;
  }
  return {
    track,
    session,
    queue,
    get screen() { return screen; },
    // A new screen: screen.view says where it came from.
    view(name) { if (name === screen) return; const from = screen; screen = name; track('screen.view', { from }); },
    // A setting changed. Number changes to one key less than SETTLE_MS apart
    // (a slider dragged) fold into the first one's record: from its old value
    // to the latest. A switch flipped twice is two records. Colors and the symmetry center are never recorded.
    setting(key, from, to) {
      if (from === to || PRIVATE_SETTINGS.has(key) || !env.enabled()) return;
      const at = env.now(), last = lastSetting.get(key);
      if (last && typeof to === 'number' && typeof last.rec.details.to === 'number' && at - last.at < SETTLE_MS && queue.items.includes(last.rec)) {
        last.at = at;
        const v = cleanValue(to);
        if (v === null) delete last.rec.details.to; else last.rec.details.to = v;
        return;
      }
      const rec = track('setting.change', { key, from, to });
      if (rec) lastSetting.set(key, { rec, at });
    },
    flush() { queue.save(); },
    clear() { lastSetting.clear(); queue.clear(); },
  };
}

// What the page shows now, for layoutOf.
function lookOfPage() {
  const cs = (sel) => { const el = document.querySelector(sel); return el ? getComputedStyle(el) : null; };
  return {
    notchesColumn: cs('#notches')?.flexDirection === 'column',
    bottomRow: cs('.bottom')?.flexDirection === 'row',
    zoomTrack: cs('.zoom-track')?.display !== 'none',
    wide: innerWidth >= 768 && innerHeight >= 560,
  };
}

// Starts recording. `enabled()` is the setting. Returns the tracker, plus
// control(el, input) for the click listener (telemetry.js) and opened() for
// perf.load once the controls work.
export function initEvents({ enabled, now = Date.now, storage = globalThis.localStorage } = {}) {
  const coarse = matchMedia('(pointer: coarse)').matches;
  // The first page load on this device (telemetry.js keeps the same day for its `since`).
  const firstRun = (() => { try { if (storage.getItem(FIRST_KEY) != null) return false; storage.setItem(FIRST_KEY, JSON.stringify(now())); return true; } catch { return false; } })();
  const t = createTracker({ enabled, now, storage, version: self.ISOPIX_VERSION, form: formOf({ screenW: screen.width, screenH: screen.height, coarse }) });
  let lastPointer = coarse ? 'touch' : 'mouse';
  let shownAt = now(), hiddenAt = 0, ready = false, closed = false, errors = 0;
  let longN = 0, longMs = 0;
  const strokes = { n: 0, touch: 0, mouse: 0, pen: 0, second: 0 };

  t.track('app.open', {
    first_run: firstRun, vw: innerWidth, vh: innerHeight, density: devicePixelRatio,
    font_scale: (parseFloat(getComputedStyle(document.documentElement).fontSize) || 16) / 16,
    dark: matchMedia('(prefers-color-scheme: dark)').matches,
    reduced_motion: matchMedia('(prefers-reduced-motion: reduce)').matches,
    lang: String(navigator.language || '').toLowerCase().split('-')[0],
    input: lastPointer,
    pwa: matchMedia('(display-mode: standalone)').matches || navigator.standalone === true,
  });

  document.addEventListener('pointerdown', (e) => { if (e.pointerType) lastPointer = e.pointerType; }, { capture: true, passive: true });
  // A control used, from the one document click listener (telemetry.js).
  // A click with no pointer (detail 0) came from a key or a screen reader.
  const control = (el, e) => {
    const group = groupOf(el);
    const input = e?.detail === 0 ? 'key' : (e?.pointerType || lastPointer);
    t.track('control.use', { control: controlOf(el), group, layout: layoutOf(group, lookOfPage()), vw: innerWidth, vh: innerHeight, input });
  };
  // A keyboard shortcut (keys.js) is a control too, with no place on screen.
  const shortcut = (action) => t.track('control.use', { control: String(action).replace(/[:+]/g, '-'), group: 'keys', layout: layoutOf('keys', lookOfPage()), vw: innerWidth, vh: innerHeight, input: 'key' });
  const stroke = (e) => {
    strokes.n++;
    if (!e.isPrimary) strokes.second++;
    else if (strokes[e.pointerType] !== undefined) strokes[e.pointerType]++;
  };

  addEventListener('error', (e) => {
    if (errors >= MAX_ERRORS) return;
    errors++;
    const [kind, where] = errorAt(e.error?.name, e.filename, e.lineno).split(' ');
    t.track('error', { kind, where: where.replace(/^\?/, 'unknown'), fatal: !ready });
  });
  addEventListener('unhandledrejection', (e) => {
    if (errors >= MAX_ERRORS) return;
    errors++;
    const [kind] = errorAt(`Unhandled${e.reason?.name || ''}`, '', 0).split(' ');
    t.track('error', { kind, where: 'unknown:0', fatal: false });
  });
  try {
    new PerformanceObserver((l) => { for (const en of l.getEntries()) { longN++; longMs += en.duration; } }).observe({ type: 'longtask', buffered: true });
  } catch { /* not in this browser */ }

  // What a sitting held, said when the page is put away.
  const summaries = (cells) => {
    if (longN) { t.track('perf.longtask', { n: longN, ms: Math.round(longMs) }); longN = 0; longMs = 0; }
    if (strokes.n) { t.track('isopix.strokes', { ...strokes, cells }); for (const k in strokes) strokes[k] = 0; }
  };
  let cellsNow = () => null;
  const leaving = []; // what the app says when the page closes (work left unsaved)
  document.addEventListener('visibilitychange', () => {
    const at = now();
    if (closed) return t.flush(); // app.close already said how long it was shown
    if (document.visibilityState === 'hidden') {
      summaries(cellsNow());
      t.track('app.background', { shown_ms: at - shownAt });
      hiddenAt = at;
      t.flush();
    } else {
      t.track('app.foreground', { away_ms: hiddenAt ? at - hiddenAt : 0 });
      shownAt = at;
    }
  });
  addEventListener('pagehide', () => {
    closed = true;
    for (const fn of leaving) { try { fn(); } catch { /* never block the close */ } }
    if (document.visibilityState !== 'hidden') summaries(cellsNow());
    t.track('app.close', { shown_ms: document.visibilityState === 'hidden' ? 0 : now() - shownAt });
    hiddenAt = now();
    t.flush();
  });

  addEventListener('pageshow', (e) => { if (e.persisted) { closed = false; shownAt = now(); t.track('app.foreground', { away_ms: hiddenAt ? now() - hiddenAt : 0 }); } });

  return {
    track: t.track, view: t.view, setting: t.setting, flush: t.flush, clear: t.clear,
    session: t.session, queue: t.queue,
    get screen() { return t.screen; },
    control, shortcut, stroke,
    cells(fn) { cellsNow = fn; },
    onLeave(fn) { leaving.push(fn); },
    // The controls work: how long it took from the start of the page load.
    opened() {
      if (ready) return;
      ready = true;
      t.track('perf.load', { ms: Math.round(performance.now()), cold: !navigator.serviceWorker?.controller });
    },
  };
}
