// Drawing or moving the view: web/engine/gesture.js.
import test from 'node:test';
import assert from 'node:assert/strict';
import { dropOnSecondFinger, oneFinger, YOUNG_MS, SHORT_PX } from '../web/engine/gesture.js';

test('a second finger drops a stroke that is young or short, and keeps a real one', () => {
  assert.equal(dropOnSecondFinger({ ageMs: 100, travelPx: 200 }), true, 'young');
  assert.equal(dropOnSecondFinger({ ageMs: 2000, travelPx: 3 }), true, 'a finger held still, then a pinch: a stray dot before');
  assert.equal(dropOnSecondFinger({ ageMs: YOUNG_MS - 1, travelPx: 500 }), true);
  assert.equal(dropOnSecondFinger({ ageMs: YOUNG_MS, travelPx: SHORT_PX }), false, 'old and long: kept');
  assert.equal(dropOnSecondFinger({ ageMs: 1500, travelPx: 120 }), false);
});

test('one finger draws, except in Move mode, after a pinch, or with a mouse pan button', () => {
  assert.equal(oneFinger({}), 'tool');
  assert.equal(oneFinger({ moveMode: true }), 'pan');
  assert.equal(oneFinger({ afterPinch: true }), 'pan', 'the finger left after a pinch never draws');
  assert.equal(oneFinger({ pointerType: 'pen' }), 'tool');
  assert.equal(oneFinger({ pointerType: 'pen', moveMode: true }), 'pan');
  assert.equal(oneFinger({ pointerType: 'mouse', button: 1 }), 'pan', 'middle button');
  assert.equal(oneFinger({ pointerType: 'mouse', button: 2 }), 'pan', 'right button');
  assert.equal(oneFinger({ pointerType: 'mouse', spaceHeld: true }), 'pan', 'Space + drag');
  assert.equal(oneFinger({ pointerType: 'mouse', button: 3 }), 'ignore', 'back button');
});

test('two fingers tapped together undo, three redo; anything slower, longer or moved is not a tap', async () => {
  const { multiTap, TAP_MS, TAP_PX, LAND_MS } = await import('../web/engine/gesture.js');
  const tap = { ms: 120, travelPx: 3, landMs: 40 };
  assert.equal(multiTap({ fingers: 2, ...tap }), 'undo');
  assert.equal(multiTap({ fingers: 3, ...tap }), 'redo');
  assert.equal(multiTap({ fingers: 1, ...tap }), null, 'one finger draws');
  assert.equal(multiTap({ fingers: 4, ...tap }), null);
  assert.equal(multiTap({ fingers: 2, ...tap, ms: TAP_MS + 1 }), null, 'a hold is a pan or pinch');
  assert.equal(multiTap({ fingers: 2, ...tap, travelPx: TAP_PX + 1 }), null, 'a moved finger is a pinch');
  assert.equal(multiTap({ fingers: 2, ...tap, landMs: LAND_MS + 1 }), null, 'a finger that landed late is not the same tap');
});
