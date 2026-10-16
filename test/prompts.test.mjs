// Drawing ideas (web/prompts.js): shown only when asked, never the same twice
// in a row, and each becomes a tidy drawing name.
import test from 'node:test';
import assert from 'node:assert/strict';
import { IDEAS, nextIdea, nameFor } from '../web/prompts.js';

test('plenty of ideas, each short, none twice', () => {
  assert.ok(IDEAS.length >= 40);
  assert.equal(new Set(IDEAS).size, IDEAS.length);
  for (const i of IDEAS) assert.ok(i.length <= 45 && /^[a-z]/.test(i), i);
});

test('the next idea is never the one just shown', () => {
  let last = null;
  for (let k = 0; k < 200; k++) { const n = nextIdea(Math.random, last); assert.notEqual(n, last); assert.ok(IDEAS.includes(n)); last = n; }
  assert.ok(IDEAS.includes(nextIdea(() => 0.999999)), 'the top of the range is still an idea');
});

test('an idea names a drawing: capitalized, without the bracketed hint', () => {
  assert.equal(nameFor('a treehouse'), 'A treehouse');
  assert.equal(nameFor('a city at night (try dark paper)'), 'A city at night');
});
