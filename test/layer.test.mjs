// The cell-layer cache rule (web/layer.js), and the model's change tracking it relies on.
import test from 'node:test';
import assert from 'node:assert/strict';
import { layerPlan, MARGIN_PAN, MARGIN_TIGHT } from '../web/layer.js';
import { Drawing } from '../web/engine/model.js';
import * as L from '../web/engine/lattice.js';

const d = {};
const cache = { drawing: d, version: 5, zoom: 256, dpr: 2, x0: -3, y0: -3, x1: 3, y1: 3 };
const want = (o = {}) => ({ drawing: d, version: 5, zoom: 256, dpr: 2, box: { x0: -2, y0: -2, x1: 2, y1: 2 }, dirtyOverflow: false, ...o });

test('nothing changed and the screen is covered: just move the bitmap', () => {
  assert.deepEqual(layerPlan(cache, want()), { action: 'blit' });
});

test('a pan past the covered area redraws with a wide margin', () => {
  assert.deepEqual(layerPlan(cache, want({ box: { x0: 1, y0: -2, x1: 4, y1: 2 } })), { action: 'full', margin: MARGIN_PAN });
});

test('any zoom change redraws at the new scale (never a scaled bitmap), tightly', () => {
  assert.deepEqual(layerPlan(cache, want({ zoom: 256.5 })), { action: 'full', margin: MARGIN_TIGHT });
});

test('a new drawing (open, new, replay) or pixel ratio redraws all', () => {
  assert.equal(layerPlan(cache, want({ drawing: {} })).action, 'full');
  assert.equal(layerPlan(cache, want({ dpr: 3 })).action, 'full');
  assert.equal(layerPlan(null, want()).action, 'full');
});

test('painted cells patch; too many changes at once redraw all', () => {
  assert.deepEqual(layerPlan(cache, want({ version: 6 })), { action: 'patch' });
  assert.equal(layerPlan(cache, want({ version: 6, dirtyOverflow: true })).action, 'full');
});

test('the model records every changed cell key, through paint, undo and clear', () => {
  const dr = new Drawing();
  dr.begin(); dr.paint(L.mk(0, 0, 0, 1), { c: '#ff0000' }); dr.commit();
  assert.deepEqual([...dr.dirty], ['0,0,0,1']);
  dr.dirty.clear();
  dr.begin(); dr.paint(L.mk(2, 1, 0, 1), { c: '#0000ff' }); dr.commit();
  assert.ok(dr.dirty.has('0,0,0,1') && dr.dirty.has('2,1,0,1'), 'the split parent and the new cell');
  dr.dirty.clear();
  dr.undo();
  assert.ok(dr.dirty.has('0,0,0,1'), 'undo marks what it restores');
  dr.clear();
  assert.equal(dr.dirtyOverflow, true, 'clear forces a full redraw');
});
