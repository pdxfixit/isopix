// Starter stamps and the person's own (web/stampbook.js, web/stamps.js):
// the eight the owner picked and ten animals, each a real stamp that places
// at every level, and Mine kept once across drawings (owner, 2026-10-16).
import test from 'node:test';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
import * as SB from '../web/stampbook.js';
import { placeStamp } from '../web/engine/density.js';
import { Drawing } from '../web/engine/model.js';
import * as L from '../web/engine/lattice.js';

test('the starter set is the eight the owner picked, then the animals, in order', () => {
  assert.deepEqual(SB.STARTER.map((s) => s.name), ['Cube', 'Stairs', 'House', 'Tree', 'Wall', 'Pyramid', 'Flower', 'Star', 'Cat', 'Bunny', 'Duck', 'Fox', 'Snake', 'Frog', 'Pig', 'Dog', 'Fish', 'Bird']);
  assert.equal(new Set(SB.STARTER.map((s) => s.id)).size, 18);
});

test('web/stamps.js is exactly what tools/make_stamps.mjs makes', () => {
  const r = spawnSync(process.execPath, [fileURLToPath(new URL('../tools/make_stamps.mjs', import.meta.url)), '--check'], { encoding: 'utf8' });
  assert.equal(r.status, 0, r.stderr + r.stdout);
});

test('every starter stamp places at every level and keeps the one-cell-or-children rule', () => {
  for (const s of SB.STARTER) {
    for (let l = 0; l <= L.MAX_LEVEL; l++) {
      const d = new Drawing();
      const { cells } = placeStamp(s.stamp, { l, p: 4, q: 4 });
      assert.equal(cells.length, s.stamp.cells.length, `${s.name} at level ${l}`);
      d.begin(); for (const { cell, c, f } of cells) d.paint(cell, { c, f }); d.commit();
      assert.equal(d.checkInvariant(), null, `${s.name} at level ${l}`);
      assert.equal(d.cells.size, cells.length, `${s.name}: no two cells overlap`);
    }
    assert.ok(s.stamp.cells.every(([, , , , c, f]) => /^#[0-9a-f]{6}$/i.test(c) && (f === null || ['T', 'L', 'R'].includes(f))), `${s.name}: colors and faces`);
  }
});

const mk = (name, n) => ({ name, stamp: { base: 0, cells: [[0, n, 0, 1, '#ff0000', null]], edges: [] } });

test('Mine keeps each stamp once, drops what is not a stamp, and names the unnamed', () => {
  const mine = SB.mergeMine([mk('A', 1)], [mk('again', 1), mk('B', 2), null, { name: 'x' }, { stamp: { cells: [] } }, { stamp: { cells: [[0, 3, 0, 1, '#00ff00', null]] } }]);
  assert.deepEqual(mine.map((s) => s.name), ['A', 'B', 'Stamp 3']);
  assert.deepEqual(SB.mergeMine(undefined, 'nope'), []);
});

test('a new stamp of one\'s own gets the next free name', () => {
  assert.equal(SB.nextName([]), 'Stamp 1');
  assert.equal(SB.nextName([mk('Stamp 1', 1), mk('Stamp 3', 2)]), 'Stamp 4');
  assert.equal(SB.nextName([mk('Stamp 2', 1)]), 'Stamp 3');
});

test('the chosen stamp, or the Cube when the choice is gone', () => {
  const mine = [mk('A', 1)];
  assert.equal(SB.chosen({ from: 'mine', i: 0 }, mine).name, 'A');
  assert.equal(SB.chosen({ from: 'starter', i: 2 }, mine).name, 'House');
  assert.equal(SB.chosen({ from: 'mine', i: 5 }, mine).name, 'Cube');
  assert.equal(SB.chosen(null, mine).name, 'Cube');
});
