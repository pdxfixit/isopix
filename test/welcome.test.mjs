// The welcome card (web/welcome.js): when it opens. `just look welcome
// welcome-first` opens the real card, from Settings and on a fresh first
// visit, and Show me around starts the Basics lesson.
import test from 'node:test';
import assert from 'node:assert/strict';
import { welcomeDue } from '../web/welcome.js';

test('the card opens only on a first visit over an empty drawing', () => {
  assert.equal(welcomeDue({ welcomed: false, hasContent: false, arriving: false }), true);
  assert.equal(welcomeDue({ welcomed: true, hasContent: false, arriving: false }), false, 'closed before on this device');
  assert.equal(welcomeDue({ welcomed: false, hasContent: true, arriving: false }), false, 'this browser already has a drawing');
  assert.equal(welcomeDue({ welcomed: false, hasContent: false, arriving: true }), false, 'a drawing moving here from an old address');
});
