// The welcome card (web/welcome.js): when it opens, the cube it holds, and
// the line under the cube. `just look welcome welcome-first` opens the real
// card, from Settings and on a fresh first visit.
import test from 'node:test';
import assert from 'node:assert/strict';
import { welcomeDue, cubeTriangles, cubeCaption } from '../web/welcome.js';

test('the card opens only on a first visit over an empty drawing', () => {
  assert.equal(welcomeDue({ welcomed: false, hasContent: false, arriving: false }), true);
  assert.equal(welcomeDue({ welcomed: true, hasContent: false, arriving: false }), false, 'closed before on this device');
  assert.equal(welcomeDue({ welcomed: false, hasContent: true, arriving: false }), false, 'this browser already has a drawing');
  assert.equal(welcomeDue({ welcomed: false, hasContent: false, arriving: true }), false, 'a drawing moving here from an old address');
});

test('the cube is six equilateral triangles around one point, two per face', () => {
  const r = 54, tris = cubeTriangles(85, 66, r);
  assert.equal(tris.length, 6);
  const d = ([x1, y1], [x2, y2]) => Math.hypot(x2 - x1, y2 - y1);
  for (const { points: [c, a, b] } of tris) {
    assert.deepEqual(c, [85, 66], 'every triangle has the center');
    for (const side of [d(c, a), d(a, b), d(b, c)]) assert.ok(Math.abs(side - r) < 1e-9, `side ${side}`);
  }
  const faces = tris.map((t) => t.face).join('');
  assert.equal(faces, 'TRRLLT');
  // The top face is above the center, the left face left of it, the right face right of it.
  const mid = (t) => [(t.points[0][0] + t.points[1][0] + t.points[2][0]) / 3, (t.points[0][1] + t.points[1][1] + t.points[2][1]) / 3];
  for (const t of tris) {
    const [x, y] = mid(t);
    if (t.face === 'T') assert.ok(y < 66);
    if (t.face === 'L') assert.ok(x < 85 && y > 66 - 1e-9);
    if (t.face === 'R') assert.ok(x > 85 && y > 66 - 1e-9);
  }
});

test('the line under the cube counts down and cheers at the end', () => {
  assert.equal(cubeCaption(6), 'Tap the six triangles to build a cube');
  assert.equal(cubeCaption(4), 'Tap the triangles to build a cube (4 left)');
  assert.equal(cubeCaption(1), 'Tap the triangles to build a cube (1 left)');
  assert.match(cubeCaption(0), /A cube!/);
});
