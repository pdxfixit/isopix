// Picking a color on the Eraser switches to the Pencil (web/palette.js).
import test from 'node:test';
import assert from 'node:assert/strict';
import { toolAfterColorPick } from '../web/palette.js';

test('a color pick turns the Eraser into the Pencil and leaves every other tool alone', () => {
  assert.equal(toolAfterColorPick('eraser'), 'pencil');
  for (const t of ['pencil', 'line', 'fill', 'select']) assert.equal(toolAfterColorPick(t), t);
});
