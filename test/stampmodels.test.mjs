// Spin (owner, 2026-10-19, docs/spec-stamp-size-turn.md step 3): the box stamps as
// 3D models (web/engine/stampmodels.js), drawn a quarter turn at a time by depth
// (web/engine/stampart.js render), the light staying where it is.
import test from 'node:test';
import assert from 'node:assert/strict';
import { MODELS, spins, spun, drawAtSize } from '../web/engine/stampmodels.js';
import { scaleStamp } from '../web/engine/density.js';
import { hbox, fromSize, belowSize, atSize, scaled, onGrid, DETAIL } from '../web/engine/stampart.js';
import { render, paint, COLORS } from '../web/engine/stampart.js';
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
    const bases = [...new Set(MODELS[id]().map((face) => face.color))]; // the model's own colors, every tier
    for (const n of [1, 2, 3]) {
      for (const [, , , , c, f] of spun(id, n).cells) assert.ok(bases.some((b) => shade(b, f) === c), `${id} ${n}: ${c} is none of its colors shaded as ${f}`);
    }
  }
});

test('turned the way it should: the Cat, an eye on each side, shows one from every side, and its left eye on the side it now faces', () => {
  const eye = (n, f) => colorsOf(spun('cat', n)).has(shade(COLORS.INK, f));
  assert.deepEqual([0, 1, 2, 3].map((n) => eye(n, 'L') || eye(n, 'R')), [true, true, true, true]);
  assert.ok(eye(0, 'L') && eye(1, 'R'), 'as drawn its +y side (lit, L) faces you; a quarter turn takes it to +x (R)');
});

test('a model the same from every side looks the same spun; the House shows its roof from behind', () => {
  for (const id of ['cube', 'pyramid']) for (const n of [1, 2, 3]) assert.ok(same(spun(id, n), spun(id, 0)), `${id} ${n}`);
  for (const n of [1, 2, 3]) {
    const st = spun('house', n);
    const ROOF = '#5b4a4f', WALLS = '#f4a582'; // web/engine/models/buildings.js
    assert.ok(st.cells.some((c) => c[4] === shade(ROOF, 'L') || c[4] === shade(ROOF, 'R')), `house ${n}: its roof`);
    assert.ok(!st.cells.some((c) => c[4] === shade(WALLS, 'T')), `house ${n}: no wall top showing through the roof`);
  }
});

// Box art must paint as drawn the same as by depth, or its turned views would not
// match (the nine older stamps that drew a feature on top were redrawn, 2026-10-19).
const ON_TOP = []; // the nine older ones were redrawn honest on 2026-10-19
test('box art looks the same front on whether painted in order or drawn by depth', () => {
  const key = (cells) => JSON.stringify([...cells].map(([k, v]) => [k, v.c, v.f]).sort());
  for (const id of IDS) {
    const one = atSize(MODELS[id](), 1), same = key(paint(one)) === key(render(one, 0));
    assert.equal(same, !ON_TOP.includes(id), same ? `${id} now draws the same by depth: take it off ON_TOP` : `${id} paints differently than it draws by depth: order its boxes back to front, and do not let boxes overlap`);
  }
});

test('the Castle is a castle all round (owner: "boxier and have more features on the back. maybe even a drawbridge")', () => {
  const colors = (n) => new Set(spun('castle', n).cells.map((c) => c[4]));
  const has = (n, color, f) => colors(n).has(shade(color, f));
  assert.ok(has(0, COLORS.BROWN, 'T') && has(0, COLORS.BLUE, 'T'), 'the drawbridge down over the moat, from the front');
  assert.ok(has(2, COLORS.YELLOW, 'R') || has(2, COLORS.YELLOW, 'L'), 'a banner on the back');
  assert.ok(has(2, COLORS.GREEN, 'L') || has(2, COLORS.GREEN, 'R'), 'ivy or the bush, behind');
  for (const n of [0, 1, 2, 3]) assert.ok(has(n, COLORS.RED, 'T'), `${n}: red tower caps`);
});

test('four quarter turns come back to the start', () => {
  for (const id of IDS) { const one = atSize(MODELS[id](), 1); assert.deepEqual([...render(one, 4)].sort(), [...render(one, 0)].sort(), id); }
});

// Detail by size (owner, 2026-10-19: "less detail on the smaller version and more detail on the large versions").
const block = () => hbox([0, 0, 0], [4, 4, 4], '#3a86ff');
const knob = () => fromSize(DETAIL, hbox([4, 1.5, 1.5], [0.5, 1, 1], '#2b2d42')); // a quarter-unit knob on the +x side
const speck = () => fromSize(1, hbox([4, 0, 0], [1, 1, 1], '#e63946'));
const stand = () => belowSize(1, hbox([4, 1, 0], [1, 2, 1], '#2b2d42'));
const model = () => [...block(), ...speck(), ...stand(), ...knob()];
const cellsOf = (r) => r.stamp.cells.length;

test('a part shows only at its sizes: detail from 2× up, specks from 1×, a stand-in below 1×', () => {
  assert.equal(atSize(model(), 0.5).length, block().length + stand().length);
  assert.equal(atSize(model(), 1).length, block().length + speck().length);
  assert.equal(atSize(model(), 2).length, block().length + speck().length + knob().length);
});

test('detail in quarter units is drawn a level finer when its size alone would put it off the grid, and grows in place', () => {
  const at2 = drawAtSize(model, 0, { s: 2, k: 2, j: 0 });
  assert.equal(at2.j, 0, 'at 2× a quarter unit is a whole step');
  const at3 = drawAtSize(model, 0, { s: 3, k: 3, j: 0 });
  assert.equal(at3.j, 1, 'at 3× it needs cells one level finer');
  const plain3 = drawAtSize(() => [...block(), ...speck()], 0, { s: 3, k: 3, j: 0 });
  assert.equal(plain3.j, 0);
  assert.ok(cellsOf(at3) > 4 * cellsOf(plain3) - 1, 'the same size, on cells a quarter as big, plus the knob');
  const one = spun('cube', 0);
  assert.deepEqual(new Set(drawAtSize(MODELS.cube, 0, { s: 3, k: 3, j: 0 }).stamp.cells.map(String)), new Set(scaleStamp(one, 3).cells.map(String)), 'with no detail, the stamp scaled');
});

test('detail that cannot land on the grid, even finer, falls back to the stamp without it', () => {
  const fine = () => [...block(), ...fromSize(DETAIL, hbox([4, 1.25, 1], [0.25, 1, 1], '#2b2d42'))];
  const r = drawAtSize(fine, 0, { s: 2, k: 2, j: 0 }, 0), plain = drawAtSize(block, 0, { s: 2, k: 2, j: 0 });
  assert.equal(r.j, 0);
  assert.deepEqual(new Set(r.stamp.cells.map(String)), new Set(plain.stamp.cells.map(String)));
});

test('every tier of every box stamp is on the grid and paints back to front the same as by depth', () => {
  const key = (cells) => JSON.stringify([...cells].map(([k, v]) => [k, v.c, v.f]).sort());
  for (const id of IDS) for (const s of [0.5, 1, 2, 3]) {
    // The tier at s, at the smallest whole multiple that puts every corner on the grid.
    const faces = atSize(MODELS[id](), s), k = [1, 2, 4].find((m) => onGrid(scaled(faces, m)));
    assert.ok(k, `${id} at ${s}×: detail off the grid even at 4 times (quarter units only)`);
    const big = scaled(faces, k);
    assert.equal(key(paint(big)), key(render(big, 0)), `${id} at ${s}×: paints differently than it draws by depth`);
  }
});
