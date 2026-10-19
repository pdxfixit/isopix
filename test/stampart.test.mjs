// The starter art the app draws itself (web/engine/stampart.js; owner, 2026-10-19,
// docs/spec-stamp-size-turn.md step 2): flat pictures drawn anew at each size and
// laid on the floor or a wall, letters stood on either wall or the floor.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as ART from '../web/engine/stampart.js';
import * as SB from '../web/stampbook.js';
import { scaleStamp } from '../web/engine/density.js';
import * as L from '../web/engine/lattice.js';

const set = (stamp) => new Set(stamp.cells.map((c) => JSON.stringify(c)));
const same = (a, b) => { const A = set(a), B = set(b); return A.size === B.size && [...A].every((c) => B.has(c)); };
const starter = (id) => SB.STARTER.find((s) => s.id === id).stamp;
const FLAT = Object.keys(ART.FLAT);
// A stamp's cells as a Map key → {cell, c, f} at the art's level, its anchor at the origin.
const placeAll = (stamp) => stamp.cells.map(([, p, q, u, c, f]) => { const cell = L.mk(ART.LV, p, q, u); return [L.cellKey(cell), { cell, c, f }]; });

test('drawn at 1× on its own plane, every flat picture, letter and number is exactly the starter stamp', () => {
  assert.equal(FLAT.length, 18);
  for (const id of FLAT) assert.ok(same(ART.variant(id, 'upright', 1), starter(id)), id);
  const glyphs = SB.STARTER.filter((s) => ART.glyphOf(s.id));
  assert.equal(glyphs.length, 36);
  for (const s of glyphs) assert.ok(same(ART.variant(s.id, 'left', 1), s.stamp), s.name);
});

test('which stamps go on planes, own plane first', () => {
  assert.deepEqual(ART.planesOf('moon'), ['upright', 'floor', 'left', 'right']);
  assert.deepEqual(ART.planesOf('letter-q'), ['left', 'right', 'floor']);
  assert.deepEqual(ART.planesOf('number-7'), ['left', 'right', 'floor']);
  assert.deepEqual(ART.planesOf('cat'), []);
  assert.deepEqual(ART.glyphOf('letter-c'), { ch: 'C', color: ART.RAINBOW[2] });
  assert.equal(ART.glyphOf('cat'), null);
  assert.equal(ART.drawnAtSize('seed'), true);
  assert.deepEqual(Object.keys(ART.FLAT).filter(ART.drawnAtSize).length, 12);
  assert.equal(ART.drawnAtSize('letter-a'), false, 'block letters scale, they are not redrawn');
});

test('the lattice-line pictures scale exactly, and drawn anew they would come out the same (but the Snowflake\'s zig-zag arms)', () => {
  for (const id of ['sierpinski', 'star', 'stars', 'merkaba', 'star-cube', 'snowflake']) {
    assert.equal(ART.drawnAtSize(id), false, id);
    for (const k of [2, 3]) {
      assert.ok(same(ART.variant(id, 'upright', k), scaleStamp(starter(id), k)), `${id} at ${k}×`);
      if (id !== 'snowflake') assert.ok(same(ART.stampFrom(ART.flatCells(id, 'upright', k), { p: 0, q: 0 }), ART.stampFrom(new Map(placeAll(scaleStamp(ART.stampFrom(ART.flatCells(id), { p: 0, q: 0 }), k))), { p: 0, q: 0 })), `${id} drawn anew at ${k}×`);
    }
  }
});

test('a round picture drawn at 4× is drawn anew, not blown up, and covers about 16 times the cells', () => {
  for (const id of ['moon', 'seed', 'smiley', 'flower-of-life', 'lightning', 'rainbow']) { // the rainbow's flat foot is no lattice line
    const one = starter(id), four = ART.variant(id, 'upright', 4);
    assert.ok(!same(four, scaleStamp(one, 4)), `${id}: not just scaled`);
    const ratio = four.cells.length / (16 * one.cells.length);
    assert.ok(ratio > 0.9 && ratio < 1.1, `${id}: ${four.cells.length} cells at 4×, ${one.cells.length} at 1× (${ratio.toFixed(2)})`);
  }
});

test('grown about its foot: at k× a picture\'s outline is k times its 1× outline, within k edges (the 1× one is a cell out at most)', () => {
  const box = (stamp) => {
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const [, p, q, u] of stamp.cells) for (const w of L.cellWorldVerts({ l: 0, p, q, u })) { x0 = Math.min(x0, w.x); y0 = Math.min(y0, w.y); x1 = Math.max(x1, w.x); y1 = Math.max(y1, w.y); }
    return [x0, y0, x1, y1];
  };
  for (const id of FLAT) for (const plane of ART.planesOf(id)) {
    const b1 = box(ART.variant(id, plane, 1)), b3 = box(ART.variant(id, plane, 3));
    b3.forEach((v, i) => assert.ok(Math.abs(v - 3 * b1[i]) <= 3.01, `${id} on ${plane}: ${b3} vs 3 × ${b1}`));
  }
});

test('on a plane, a flat picture is shaded as that face and keeps its area (seen at a slant, H as much)', () => {
  for (const id of FLAT) {
    const up = ART.variant(id, 'upright', 2).cells.length;
    for (const [plane, f] of [['floor', 'T'], ['left', 'L'], ['right', 'R']]) {
      const cells = ART.variant(id, plane, 2).cells;
      assert.ok(cells.every((c) => c[5] === f), `${id} on ${plane}: every cell a ${f} face`);
      const ratio = cells.length / up;
      assert.ok(ratio > 0.75 && ratio < 1, `${id} on ${plane}: ${cells.length} cells, ${up} upright (${ratio.toFixed(2)})`);
    }
  }
});

test('a letter stands on either wall or lies on the floor, each plane showing its own face most; a symmetric one mirrors', () => {
  const faces = (id, plane) => ART.variant(id, plane, 1).cells.reduce((m, c) => ({ ...m, [c[5]]: (m[c[5]] || 0) + 1 }), {});
  const most = (m) => Object.entries(m).sort((a, b) => b[1] - a[1])[0][0];
  for (const s of SB.STARTER.filter((x) => ART.glyphOf(x.id))) {
    assert.deepEqual(['left', 'right', 'floor'].map((plane) => most(faces(s.id, plane))), ['L', 'R', 'T'], s.name);
  }
  for (const id of ['letter-a', 'letter-h', 'letter-o', 'number-8']) {
    const left = faces(id, 'left'), right = faces(id, 'right');
    assert.deepEqual([right.R, right.L, right.T], [left.L, left.R, left.T], `${id}: the right wall is the left wall mirrored`);
  }
});
