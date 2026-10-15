// Moving house to isopix.app (web/move.js): what travels, what fits in the
// address, and what the new address does with it.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { HOME, OLD_HOSTS, shrinkings, keysToCopy, landing, pack, unpack, moveURL, arrival, hasDrawing } from '../web/move.js';
import * as P from '../web/engine/project.js';
import { Drawing } from '../web/engine/model.js';

const drawn = () => {
  const d = new Drawing();
  d.begin('paint');
  d.paint({ l: 3, p: 0, q: 0, u: 0 }, { c: '#3a86ff' }, 'replace');
  d.commit();
  return JSON.parse(JSON.stringify(P.save(d, { name: 'Cube', savedAt: 1000, trace: { src: 'data:image/jpeg;base64,AAAA', rect: { x: 0, y: 0, w: 1, h: 1 } } })));
};

test('the new home, and the old address that moves', () => {
  assert.equal(HOME, 'https://isopix.app');
  assert.deepEqual(OLD_HOSTS, ['isopix.pdxfixit.com']);
  assert.ok(!OLD_HOSTS.includes('localhost'), 'a local server never moves');
});

test('a drawing packs and unpacks exactly, and loads as a project', async () => {
  const a = drawn();
  const back = await unpack(await pack({ v: 1, autosave: a }));
  assert.deepEqual(back.autosave, a);
  assert.equal(P.load(back.autosave).cells.size, 1);
  assert.match(await pack({ x: 1 }), /^z[A-Za-z0-9_-]+$/, 'gzip, base64url: safe in an address');
});

test('too big for the address: the trace picture goes first, then the history, never silently the drawing', async () => {
  const a = drawn();
  const steps = shrinkings(a);
  assert.deepEqual(steps.map((s) => s.dropped), [[], ['trace'], ['trace', 'history'], ['drawing']]);
  assert.equal(steps[1].autosave.trace, undefined);
  assert.deepEqual(steps[2].autosave.log, []);
  assert.equal(steps[2].autosave.cells.length, 1, 'the cells always go');
  assert.equal(a.trace.src.length > 0, true, 'the original is untouched');
  // A huge trace picture (random bytes do not compress): it is left behind.
  const big = { ...a, trace: { ...a.trace, src: Array.from({ length: 40000 }, () => Math.random().toString(36).slice(2)).join('') } };
  const url = await moveURL({ from: 'isopix.pdxfixit.com', autosave: big, local: {} }, 100000);
  assert.ok(url.length <= 100000);
  const got = arrival(await unpack(url.split('#move=')[1]));
  assert.deepEqual(got.dropped, ['trace']);
  assert.equal(got.autosave.cells.length, 1);
  assert.equal((await moveURL({ from: 'x', autosave: a }, 10)), `${HOME}/`, 'nothing fits: go anyway');
});

test('settings: Isopix and Isogrid keys travel, a key already here stays, junk does not', () => {
  const got = keysToCopy({ 'isopix-settings': '{"a":1}', 'isogrid-settings': '{"b":2}', 'isogrid-settings-open': '[]', other: 'x', 'isopix-x': 5 }, (k) => k === 'isopix-settings-open');
  assert.deepEqual(got, [['isopix-settings', '{"a":1}']], 'Isopix wins over Isogrid; the open sections were already here');
  assert.deepEqual(keysToCopy({ 'isogrid-settings': 's' }, () => false), [['isopix-settings', 's']]);
  assert.deepEqual(keysToCopy(null, () => false), []);
});

test('landing: taken when the new address has nothing, offered when it has its own, never twice', () => {
  const incoming = { from: 'isopix.pdxfixit.com', savedAt: 5, hasContent: true };
  assert.equal(landing({ incoming, current: { hasContent: false } }), 'load');
  assert.equal(landing({ incoming, current: { hasContent: true, savedAt: 9 } }), 'offer');
  assert.equal(landing({ incoming, current: { hasContent: true, savedAt: 5 } }), 'ignore', 'the same drawing');
  assert.equal(landing({ incoming, current: { hasContent: false }, seen: [{ from: 'isopix.pdxfixit.com', savedAt: 5 }] }), 'ignore', 'a bookmark to the old address, visited again');
  assert.equal(landing({ incoming: { ...incoming, hasContent: false }, current: { hasContent: false } }), 'ignore');
  assert.equal(hasDrawing(drawn()), true);
  assert.equal(hasDrawing({ cells: [], edges: [], log: [] }), false);
});

test('an arrival is shape-checked: anyone can make a #move= link', () => {
  assert.equal(arrival(null), null);
  assert.equal(arrival({ v: 2 }), null);
  const a = arrival({ v: 1, from: 7, autosave: [], file: { name: 'a.json', at: 'x', handle: { evil: 1 } }, local: 'no', dropped: ['trace', 'rm -rf'] });
  assert.equal(a.from, '');
  assert.equal(a.autosave, null);
  assert.deepEqual(a.file, { name: 'a.json', at: null, via: 'save', dirty: false, handle: null });
  assert.deepEqual(a.local, {});
  assert.deepEqual(a.dropped, ['trace']);
});

test('move.js stands alone (the old Isogrid page loads it by itself) and is served with CORS', () => {
  const src = fs.readFileSync(new URL('../web/move.js', import.meta.url), 'utf8');
  assert.doesNotMatch(src, /^\s*import\b/m, 'move.js imports nothing');
  const headers = fs.readFileSync(new URL('../web/_headers', import.meta.url), 'utf8');
  assert.match(headers, /^\/move\.js\n\s+Access-Control-Allow-Origin: \*$/m);
});
