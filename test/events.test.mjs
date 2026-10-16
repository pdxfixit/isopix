// Usage events (web/events.js): the shared record (pdxfixit/telemetry
// docs/standard.md §3), what a detail may hold, the switch, the queue, and
// the hooks in app.js that name only listed events.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as E from '../web/events.js';
import { createEvents } from '../web/events-client.js';
import { appSource } from './appsource.mjs';

const appJs = appSource; // web/app.js and web/ui/*.js
const eventsJs = fs.readFileSync(new URL('../web/events.js', import.meta.url), 'utf8');

// A stand-in for localStorage, with the key()/length the client lists entries by.
function fakeStorage(init = {}) {
  const m = new Map(Object.entries(init));
  return {
    m, getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k),
    key: (i) => [...m.keys()][i] ?? null, get length() { return m.size; },
  };
}
// The real shared client (vendored from flarepress) on stand-in globals, under Isopix's tracker.
function tracker({ on = true, t0 = Date.UTC(2026, 9, 16, 12), storage = fakeStorage(), sent = [] } = {}) {
  const state = { on, now: t0 };
  let n = 0;
  const later = [];
  let t = null;
  const client = createEvents({
    app: E.APP, version: '1.2.80', player: () => E.playerId(storage, state.now), screen: () => t.screen, enabled: () => state.on,
    form: 'phone', maxRecords: E.MAX_QUEUE,
    globals: {
      window: {}, document: undefined, navigator: {}, storage, now: () => state.now,
      uuid: () => `00000000-0000-4000-8000-${String(++n).padStart(12, '0')}`,
      fetch: async (url, init) => { sent.push({ url, init }); return { status: 204 }; },
      setInterval: () => 0, clearInterval: () => {},
    },
  });
  t = E.createTracker({ client, enabled: () => state.on, now: () => state.now, later: (fn) => { later.push(fn); return later.length; }, cancel: () => {} });
  const records = () => client.queued().records.map((l) => JSON.parse(l));
  return { t, client, state, storage, records, sent, runLater: () => later.splice(0).forEach((fn) => fn()) };
}

test('a record has every column of the standard, in order, and only listed keys', () => {
  const { t, records } = tracker();
  t.track('app.open', { vw: 375, vh: 812, first_run: true, name: 'My dragon' });
  const [r] = records();
  assert.deepEqual(Object.keys(r), ['app', 'platform', 'form', 'version', 'player', 'session', 'seq', 'at', 'tz', 'event', 'screen', 'details']);
  assert.equal(r.app, 'isopix');
  assert.equal(r.platform, 'web');
  assert.equal(r.form, 'phone');
  assert.equal(r.version, '1.2.80');
  assert.match(r.player, /^[0-9a-f]{12}$/);
  assert.equal(r.at, Date.UTC(2026, 9, 16, 12));
  assert.equal(r.screen, 'draw');
  assert.deepEqual(r.details, { vw: 375, vh: 812, first_run: true });
});

test('seq counts from 0 within a session; the player is the device code, one function', () => {
  const storage = fakeStorage();
  const { t, records } = tracker({ storage });
  t.track('app.open'); t.track('dialog.open', { dialog: 'welcome' });
  const [a, b] = records();
  assert.deepEqual([a.seq, b.seq], [0, 1]);
  assert.equal(a.player, b.player);
  assert.equal(JSON.parse(storage.getItem('isopix-usage-device')).id, a.player, 'the stored device code');
});

test('an event not in the list is not recorded, and a detail key not listed for it is dropped', () => {
  const { t, records } = tracker();
  assert.equal(t.track('made.up', { a: 1 }), false);
  assert.equal(records().length, 0);
  t.track('control.use', { control: 'undo', group: 'topleft', x: 120, y: 44, layout: 'rail' });
  assert.deepEqual(records()[0].details, { control: 'undo', group: 'topleft', layout: 'rail' }, 'no coordinates');
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

test('with the switch off nothing is recorded and the queue is emptied, stored copy too', () => {
  const storage = fakeStorage();
  const { t, state, records } = tracker({ storage });
  t.track('app.open');
  assert.ok([...storage.m.keys()].some((k) => k.startsWith('events:isopix:')));
  state.on = false;
  t.clear();
  assert.equal(records().length, 0);
  assert.ok(![...storage.m.keys()].some((k) => k.startsWith('events:isopix:')));
  assert.equal(t.track('dialog.open', { dialog: 'welcome' }), false);
  t.setting('gray', false, true);
  assert.equal(records().length, 0);
});

test('a batch goes to POST /api/events as JSON lines, with a batch id', async () => {
  const { t, client, sent } = tracker();
  t.track('app.open'); t.track('dialog.open', { dialog: 'welcome' });
  await client.flush();
  assert.equal(sent.length, 1);
  assert.equal(sent[0].url, '/api/events');
  assert.match(sent[0].init.headers['x-batch'], /^[0-9a-f-]{36}$/);
  assert.deepEqual(sent[0].init.body.trim().split('\n').map((l) => JSON.parse(l).event), ['app.open', 'dialog.open']);
  assert.equal(client.queued().batches.length, 0, 'dropped after a 2xx');
});

test('it sends only from the live site, never from a test browser', () => {
  assert.equal(E.sendsFrom({ hostname: 'isopix.app', webdriver: false }), true);
  assert.equal(E.sendsFrom({ hostname: 'isopix.app', webdriver: true }), false);
  assert.equal(E.sendsFrom({ hostname: 'localhost', webdriver: false }), false);
});

test('screen.view says where the person came from', () => {
  const { t, records } = tracker();
  t.view('settings'); t.view('settings'); t.view('draw');
  assert.deepEqual(records().map((r) => [r.event, r.screen, r.details.from]), [['screen.view', 'settings', 'draw'], ['screen.view', 'draw', 'settings']]);
});

test('setting.change carries from and to; a slider\'s run is one record, a switch flipped twice is two; colors are never recorded', () => {
  const { t, state, records, runLater } = tracker();
  t.setting('gray', false, true);
  t.setting('gray', true, true);
  t.setting('gray', true, false);
  t.setting('traceOpacity', 0.3, 0.4);
  state.now += 200; t.setting('traceOpacity', 0.4, 0.5);
  state.now += 200; t.setting('traceOpacity', 0.5, 0.7);
  t.track('dialog.open', { dialog: 'welcome' }); // the slider's change is recorded before what came next
  state.now += 200; t.setting('traceOpacity', 0.7, 0.2);
  runLater();
  t.setting('color', '#3a86ff', '#ff006e');
  t.setting('symP', 0, 4);
  assert.deepEqual(records().map((r) => r.details), [
    { key: 'gray', from: false, to: true },
    { key: 'gray', from: true, to: false },
    { key: 'traceOpacity', from: 0.3, to: 0.7 },
    { dialog: 'welcome' },
    { key: 'traceOpacity', from: 0.7, to: 0.2 },
  ]);
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
  assert.match(eventsJs, /control\(el, e\);/);
  assert.match(eventsJs, /shortcut\(a\)/);
  assert.match(eventsJs, /addEventListener\('pointerdown', stroke/);
  assert.match(appJs, /initEvents\(\{ enabled: \(\) => app\.settings\.usage, keyAction: /);
  assert.match(appJs, /const from = app\.settings\[k\];[\s\S]{0,300}app\.events\?\.setting\(k, from, v\)/);
  assert.match(appJs, /if \(k === 'usage' && !v\) app\.events\?\.clear\(\)/);
  // app.settings is written only in set(), at load, and when a lesson gives the person's settings back.
  const writes = [...appJs.matchAll(/app\.settings(?:\[[^\]]+\]|\.\w+)? = /g)].length;
  assert.equal(writes, 3, 'app.settings is written in set(), when settings move house, and when a lesson ends; a new write skips setting.change: use set()');
});

test('a UUID without crypto.randomUUID (plain http has none), so the client starts there too', () => {
  const insecure = { getRandomValues: (a) => a.fill(0xab) };
  assert.equal(E.uuidV4(insecure), 'abababab-abab-4bab-abab-abababababab');
  assert.match(E.uuidV4(), /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  assert.match(eventsJs, /globals: \{ uuid: uuidV4,/);
});
