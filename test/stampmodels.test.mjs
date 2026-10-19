// Spin (owner, 2026-10-19, docs/spec-stamp-size-turn.md step 3): the box stamps as
// 3D models (web/engine/stampmodels.js), drawn a quarter turn at a time by depth
// (web/engine/stampart.js render), the light staying where it is.
import test from 'node:test';
import assert from 'node:assert/strict';
import { MODELS, spins, spun } from '../web/engine/stampmodels.js';
import { render, COLORS } from '../web/engine/stampart.js';
import { shade } from '../web/engine/color.js';
import { placeStamp } from '../web/engine/density.js';
import { Drawing } from '../web/engine/model.js';
import * as SB from '../web/stampbook.js';

const set = (stamp) => new Set(stamp.cells.map((c) => JSON.stringify(c)));
const same = (a, b) => { const A = set(a), B = set(b); return A.size === B.size && [...A].every((c) => B.has(c)); };
const IDS = Object.keys(MODELS);
const colorsOf = (stamp) => new Set(stamp.cells.map((c) => c[4]));

test('every box stamp spins four ways, and view 0 is the starter stamp exactly', () => {
  assert.equal(IDS.length, 39);
  for (const id of IDS) {
    assert.deepEqual(spins(id), [0, 1, 2, 3], id);
    assert.ok(same(spun(id, 0), SB.STARTER.find((s) => s.id === id).stamp), `${id}: view 0`);
  }
  assert.deepEqual(spins('moon'), []);
  assert.deepEqual(spins('letter-a'), []);
});

test('each spun view places at every level as a proper stamp: no two cells on one spot, faces T, L or R', () => {
  for (const id of IDS) {
    for (const n of [1, 2, 3]) {
      const st = spun(id, n);
      assert.ok(st.cells.length > 0, `${id} ${n}`);
      assert.ok(st.cells.every((c) => ['T', 'L', 'R'].includes(c[5])), `${id} ${n}: faces`);
      const d = new Drawing(), { cells } = placeStamp(st, { l: 3, p: 4, q: 4 });
      d.begin(); for (const { cell, c, f } of cells) d.paint(cell, { c, f }); d.commit();
      assert.equal(d.checkInvariant(), null, `${id} ${n}`);
      assert.equal(d.cells.size, cells.length, `${id} ${n}: no two cells overlap`);
    }
  }
});

test('the light stays put: in every view a face is shaded as the side it now faces', () => {
  for (const id of IDS) {
    const bases = [...new Set(MODELS[id]().map((face) => face.color))]; // the model's own colors
    for (const n of [1, 2, 3]) {
      for (const [, , , , c, f] of spun(id, n).cells) assert.ok(bases.some((b) => shade(b, f) === c), `${id} ${n}: ${c} is none of its colors shaded as ${f}`);
    }
  }
});

test('turned the way it should: the Cat\'s eye (on its left side) shows facing right and toward the right, not from behind or the far side', () => {
  const eye = (n) => colorsOf(spun('cat', n)).has(shade(COLORS.INK, n === 0 ? 'L' : 'R'));
  assert.deepEqual([0, 1, 2, 3].map(eye), [true, false, false, true]);
});

test('a model the same from every side looks the same spun; the House shows its roof from behind', () => {
  for (const id of ['cube', 'pyramid']) for (const n of [1, 2, 3]) assert.ok(same(spun(id, n), spun(id, 0)), `${id} ${n}`);
  for (const n of [1, 2, 3]) {
    const st = spun('house', n);
    assert.ok(st.cells.some((c) => c[4] === shade(COLORS.RED, 'L') || c[4] === shade(COLORS.RED, 'R')), `house ${n}: its roof`);
    assert.ok(!st.cells.some((c) => c[4] === shade(COLORS.YELLOW, 'T')), `house ${n}: no wall top showing through the roof`);
  }
});

test('four quarter turns come back to the start', () => {
  for (const id of IDS) assert.deepEqual([...render(MODELS[id](), 4)].sort(), [...render(MODELS[id](), 0)].sort(), id);
});
