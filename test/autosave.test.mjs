// Autosave copies (web/autosave.js): one damaged autosave cannot lose the
// drawing (owner, 2026-10-16: "yes to the autosave copies").
import test from 'node:test';
import assert from 'node:assert/strict';
import { KEEP, EVERY, copiesOf, copyDue, withCopy, openFirst } from '../web/autosave.js';
import * as P from '../web/engine/project.js';
import { Drawing } from '../web/engine/model.js';

const MIN = 60 * 1000;
const proj = (name) => ({ name });

test('a copy is due with none yet, then once every 5 minutes', () => {
  assert.equal(copyDue(0, 1000), true, 'no copy yet');
  assert.equal(copyDue(1000, 1000 + EVERY - 1), false);
  assert.equal(copyDue(1000, 1000 + EVERY), true);
  assert.equal(copyDue(10 * MIN, 5 * MIN), true, 'a clock set back does not stop copies');
});

test('copies keep the newest first, at most KEEP', () => {
  let c = [];
  for (let i = 0; i < 5; i++) c = withCopy(c, proj(`d${i}`), i * EVERY);
  assert.equal(c.length, KEEP);
  assert.deepEqual(c.map((x) => x.project.name), ['d4', 'd3', 'd2']);
});

test('stored copies that are not copies are dropped, never opened', () => {
  assert.deepEqual(copiesOf(null), []);
  assert.deepEqual(copiesOf({ savedAt: 1, project: {} }), []);
  assert.deepEqual(copiesOf([null, 7, { savedAt: 'x', project: {} }, { savedAt: 1 }, { savedAt: 2, project: proj('ok') }]), [{ savedAt: 2, project: proj('ok') }]);
});

test('the autosave opens when it loads', () => {
  const seen = [];
  const mine = { format: 'isopix', version: 1, picture: { name: 'mine', cells: {} }, app: { savedAt: 9 } };
  const r = openFirst(mine, [{ savedAt: 5, project: proj('old') }], (p) => seen.push(p.picture?.name ?? p.name));
  assert.deepEqual(r, { from: 'autosave', savedAt: 9, error: null });
  assert.deepEqual(seen, ['mine']);
});

test('a damaged autosave falls back to the newest copy that loads, and says why', () => {
  // The real loader: a project with a bad cell is refused by project.js.
  const good = (name) => P.save(new Drawing(), { name });
  const broken = P.save(new Drawing(), { name: 'broken' }); broken.picture.cells = { 'not a key': 'nope' };
  assert.throws(() => P.load(broken), 'the shape check refuses it');
  const copies = [{ savedAt: 30, project: broken }, { savedAt: 20, project: good('copy') }, { savedAt: 10, project: good('older') }];
  let opened = null;
  broken.app.savedAt = 40;
  const r = openFirst(broken, copies, (p) => { P.load(p); opened = p.picture.name; });
  assert.equal(r.from, 'copy');
  assert.equal(r.savedAt, 20);
  assert.equal(opened, 'copy');
  assert.ok(r.error instanceof Error, 'the autosave\'s error, for the message');
});

test('nothing loads: nothing opens, and the error is kept', () => {
  const r = openFirst({ savedAt: 1 }, [], () => { throw new Error('bad'); });
  assert.equal(r.from, null);
  assert.equal(r.error.message, 'bad');
  assert.deepEqual(openFirst(null, undefined, () => {}), { from: null, savedAt: null, error: null }, 'a first visit');
});
