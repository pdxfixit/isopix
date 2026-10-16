// Usage events (web/events.js): the shared record (pdxfixit/telemetry
// docs/standard.md §3), what a detail may hold, the switch, the queue, and
// the hooks in app.js that name only listed events.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as E from '../web/events.js';

const appJs = fs.readFileSync(new URL('../web/app.js', import.meta.url), 'utf8');
const eventsJs = fs.readFileSync(new URL('../web/events.js', import.meta.url), 'utf8');
const telemetryJs = fs.readFileSync(new URL('../web/telemetry.js', import.meta.url), 'utf8');

// A stand-in for localStorage.
function fakeStorage(init = {}) {
  const m = new Map(Object.entries(init));
  return { m, getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) };
}
function tracker({ on = true, t0 = Date.UTC(2026, 9, 16, 12), storage = fakeStorage() } = {}) {
  const state = { on, now: t0 };
  const t = E.createTracker({ enabled: () => state.on, now: () => state.now, storage, form: 'phone', version: '1.2.80', setTimeout: () => 0 });
  return { t, state, storage };
}

test('a record has every column of the standard, in order', () => {
  const { t } = tracker();
  const r = t.track('app.open', { vw: 375, vh: 812, first_run: true });
  assert.deepEqual(Object.keys(r), ['app', 'platform', 'form', 'version', 'player', 'session', 'seq', 'at', 'tz', 'event', 'screen', 'details']);
  assert.equal(r.app, 'isopix');
  assert.equal(r.platform, 'web');
  assert.equal(r.form, 'phone');
  assert.equal(r.version, '1.2.80');
  assert.match(r.player, /^[0-9a-f]{12}$/);
  assert.match(r.session, /^[0-9a-f]{16}$/);
  assert.equal(r.at, Date.UTC(2026, 9, 16, 12));
  assert.equal(r.tz, -new Date(r.at).getTimezoneOffset() || 0);
  assert.equal(r.screen, 'draw');
  assert.deepEqual(r.details, { vw: 375, vh: 812, first_run: true });
});

test('seq counts from 0 within a session; the player is the device code, one function', () => {
  const storage = fakeStorage();
  const { t } = tracker({ storage });
  const a = t.track('app.open'), b = t.track('screen.view', { from: 'draw' });
  assert.deepEqual([a.seq, b.seq], [0, 1]);
  assert.equal(a.player, b.player);
  assert.equal(JSON.parse(storage.getItem('isopix-usage-device')).id, a.player, 'the same code the visit beacon sends');
  const other = tracker({ storage }).t.track('app.open');
  assert.equal(other.player, a.player);
  assert.notEqual(other.session, a.session, 'each page load is its own session');
  assert.equal(other.seq, 0);
});

test('an event not in the list is not recorded, and a detail key not listed for it is dropped', () => {
  const { t } = tracker();
  assert.equal(t.track('made.up', { a: 1 }), null);
  assert.equal(t.queue.items.length, 0);
  const r = t.track('control.use', { control: 'undo', group: 'topleft', x: 120, y: 44, layout: 'rail' });
  assert.deepEqual(r.details, { control: 'undo', group: 'topleft', layout: 'rail' }, 'no coordinates');
});

test('a detail is a number, a boolean or one of the app\'s own words, never text someone typed', () => {
  assert.equal(E.cleanValue('pencil'), 'pencil');
  assert.equal(E.cleanValue('10k+'), '10k+');
  assert.equal(E.cleanValue('app.js:120'), 'app.js:120');
  assert.equal(E.cleanValue('My dragon'), null);
  assert.equal(E.cleanValue('<b>'), null);
  assert.equal(E.cleanValue('x'.repeat(49)), null);
  assert.equal(E.cleanValue(1 / 3), 0.333);
  assert.equal(E.cleanValue(NaN), null);
  assert.equal(E.cleanValue({ a: 1 }), null);
  assert.equal(E.cleanValue(false), false);
});

test('with the switch off nothing is recorded and the queue is emptied', () => {
  const storage = fakeStorage();
  const { t, state } = tracker({ storage });
  t.track('app.open');
  t.flush();
  assert.ok(storage.getItem(E.QUEUE_KEY));
  state.on = false;
  assert.equal(t.track('screen.view', { from: 'draw' }), null);
  assert.equal(t.queue.items.length, 0);
  assert.equal(storage.getItem(E.QUEUE_KEY), null, 'the stored copy is gone too');
  t.setting('gray', false, true);
  assert.equal(t.queue.items.length, 0);
});

test('the queue survives a reload and keeps at most MAX_QUEUE records, oldest dropped', () => {
  const storage = fakeStorage();
  const q = new E.Queue(storage, 'k', 3);
  for (let i = 0; i < 5; i++) q.push({ event: 'app.open', seq: i });
  q.save();
  assert.deepEqual(new E.Queue(storage, 'k', 3).items.map((r) => r.seq), [2, 3, 4]);
  assert.deepEqual(new E.Queue(fakeStorage({ k: 'not json' }), 'k').items, []);
  assert.deepEqual(new E.Queue(fakeStorage({ k: '[1, null, {"event": "app.open"}]' }), 'k').items, [{ event: 'app.open' }]);
  assert.equal(E.MAX_QUEUE, 1000);
});

test('screen.view says where the person came from', () => {
  const { t } = tracker();
  t.view('settings');
  t.view('settings');
  t.view('draw');
  const v = t.queue.items;
  assert.deepEqual(v.map((r) => [r.event, r.screen, r.details.from]), [['screen.view', 'settings', 'draw'], ['screen.view', 'draw', 'settings']]);
});

test('setting.change carries from and to; a slider\'s run folds into one record, a switch flipped twice is two; colors are never recorded', () => {
  const { t, state } = tracker();
  t.setting('gray', false, true);
  t.setting('gray', true, true);
  t.setting('gray', true, false);
  t.setting('traceOpacity', 0.3, 0.4);
  state.now += 200; t.setting('traceOpacity', 0.4, 0.5);
  state.now += 200; t.setting('traceOpacity', 0.5, 0.7);
  state.now += E.SETTLE_MS + 1; t.setting('traceOpacity', 0.7, 0.2);
  t.setting('color', '#3a86ff', '#ff006e');
  t.setting('symP', 0, 4);
  assert.deepEqual(t.queue.items.map((r) => r.details), [
    { key: 'gray', from: false, to: true },
    { key: 'gray', from: true, to: false },
    { key: 'traceOpacity', from: 0.3, to: 0.7 },
    { key: 'traceOpacity', from: 0.7, to: 0.2 },
  ]);
});

test('form: a phone, a tablet or a desktop, from the screen and the main pointer', () => {
  assert.equal(E.formOf({ screenW: 390, screenH: 844, coarse: true }), 'phone');
  assert.equal(E.formOf({ screenW: 844, screenH: 390, coarse: true }), 'phone', 'turned sideways, still a phone');
  assert.equal(E.formOf({ screenW: 820, screenH: 1180, coarse: true }), 'tablet');
  assert.equal(E.formOf({ screenW: 1440, screenH: 900, coarse: false }), 'desktop');
});

// A stand-in for an element: closest() over a chain of selectors it matches.
const el = ({ id = '', dataset = {}, classes = [], controls = null, inside = [] } = {}) => ({
  id, dataset, classList: { contains: (c) => classes.includes(c) },
  getAttribute: (a) => (a === 'aria-controls' ? controls : null),
  closest: (sel) => { const hit = inside.find((x) => x.sel === sel); return hit ? { id: hit.id || '' } : null; },
});

test('a control is named by its id or what it is, and grouped by the toolbar that holds it', () => {
  assert.equal(E.controlOf(el({ id: 'undo' })), 'undo');
  assert.equal(E.controlOf(el({ dataset: { tool: 'pencil' } })), 'tool-pencil');
  assert.equal(E.controlOf(el({ classes: ['swatch'] })), 'swatch');
  assert.equal(E.controlOf(el({ dataset: { pick: 'hexagon' } })), 'pick-hexagon');
  assert.equal(E.controlOf(el({ dataset: { lesson: 'basics' } })), 'lesson-basics');
  assert.equal(E.controlOf(el({ controls: 'help-lesson-basics' })), 'fold-help-lesson-basics');
  assert.equal(E.controlOf(el()), 'unnamed');
  assert.equal(E.groupOf(el({ inside: [{ sel: '.topleft' }] })), 'topleft');
  assert.equal(E.groupOf(el({ inside: [{ sel: '#levels' }] })), 'levels');
  assert.equal(E.groupOf(el({ inside: [{ sel: '.tools' }] })), 'tools');
  assert.equal(E.groupOf(el({ inside: [{ sel: 'dialog', id: 'settings' }] })), 'settings');
  assert.equal(E.groupOf(el()), 'other');
});

test('layout says which arrangement showed the control', () => {
  assert.equal(E.layoutOf('levels', { notchesColumn: true }), 'rail');
  assert.equal(E.layoutOf('levels', { notchesColumn: false }), 'top');
  assert.equal(E.layoutOf('tools', { bottomRow: false }), 'stacked');
  assert.equal(E.layoutOf('palette', { bottomRow: true }), 'row');
  assert.equal(E.layoutOf('zoom', { zoomTrack: false }), 'buttons');
  assert.equal(E.layoutOf('topright', { wide: true }), 'wide');
  assert.equal(E.layoutOf('keys', { wide: false }), 'narrow');
});

test('every grid notch has an id, so a notch counts as a control', () => {
  assert.match(appJs, /b\.className = 'notch';\s*\n\s*b\.id = `notch-\$\{i\}`/);
});

test('every event app.js and events.js record is in the list, with only listed keys', () => {
  const names = new Set();
  for (const src of [appJs, eventsJs]) {
    for (const m of src.matchAll(/\btrack\('([^']+)'(?:,\s*\{([^}]*)\})?/g)) {
      names.add(m[1]);
      assert.ok(Object.hasOwn(E.EVENTS, m[1]), `${m[1]} is not in EVENTS`);
      for (const k of (m[2] || '').matchAll(/(?:^|,)\s*([a-z_]+)(?=\s*[:,]|\s*$)/g)) {
        assert.ok(E.EVENTS[m[1]].includes(k[1]), `${m[1]} has no key ${k[1]}`);
      }
    }
  }
  // Every event Isopix lists is sent from somewhere.
  for (const e of ['screen.view', 'setting.change']) names.add(e); // sent through view() and setting()
  for (const e of Object.keys(E.EVENTS)) assert.ok(names.has(e), `nothing sends ${e}`);
});

test('the hooks: the click, key and stroke listeners pass on to events, and every setting goes through set()', () => {
  assert.match(telemetryJs, /count\(clickName\(el\)\);\s*\n\s*onControl\(el, e\);/);
  assert.match(telemetryJs, /onShortcut\(a\)/);
  assert.match(telemetryJs, /onStroke\(e\)/);
  assert.match(appJs, /onControl: app\.events\.control, onShortcut: app\.events\.shortcut, onStroke: app\.events\.stroke/);
  assert.match(appJs, /const from = app\.settings\[k\];[\s\S]{0,300}app\.events\?\.setting\(k, from, v\)/);
  assert.match(appJs, /if \(k === 'usage' && !v\) app\.events\?\.clear\(\)/);
  // app.settings is written only in set(), at load, and when a lesson gives the person's settings back.
  const writes = [...appJs.matchAll(/app\.settings(?:\[[^\]]+\]|\.\w+)? = /g)].length;
  assert.equal(writes, 3, 'app.settings is written in set(), when settings move house, and when a lesson ends; a new write skips setting.change: use set()');
});
