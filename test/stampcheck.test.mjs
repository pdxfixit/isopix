// The stamp art contract's check (docs/stamp-art-contract.md, tools/stamp_check.mjs):
// art handed in is data, checked before it comes in; each REJECT says what to fix.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { check } from '../tools/stamp_check.mjs';
import { MODELS, PARTS, fromParts } from '../web/engine/stampmodels.js';
import * as ART from '../web/engine/stampart.js';

const example = JSON.parse(fs.readFileSync(new URL('../docs/stamp-art/doghouse.json', import.meta.url), 'utf8'));
const copy = () => JSON.parse(JSON.stringify(example));
const codes = (s, o) => check(s, o).rej.map((r) => r.code);

test('the contract\'s example passes, with nothing to warn about', () => {
  const r = check(example);
  assert.deepEqual(r.rej, []);
  assert.deepEqual(r.warn, []);
  assert.equal(r.cells, 86);
});

test('a malformed file is rejected with a line for each thing wrong', () => {
  assert.deepEqual(codes(null), ['R1']);
  assert.deepEqual(codes([]), ['R1']);
  const s = copy(); s.contract = 2; s.id = 'Bad Id'; s.name = ''; s.group = 'letters';
  assert.deepEqual(codes(s), ['R2', 'R3', 'R4', 'R5']);
  const c = copy(); c.id = 'cat'; assert.deepEqual(codes(c), ['R3'], 'a shipped id needs --replace');
  assert.deepEqual(codes(c, { replace: true }), []);
  const p = copy(); p.parts = []; assert.deepEqual(codes(p), ['R6']);
  const q = copy(); q.parts[0].size = [0, 4, 3]; q.parts[1].color = 'red'; q.parts[2] = { box: [0, 0, 0], decal: '+x' };
  assert.deepEqual(codes(q), ['R7', 'R7', 'R7']);
  const n = copy(); n.parts[0].box = [0.5, 0, 0]; assert.deepEqual(codes(n), ['R7'], 'half units are whole numbers');
  const d = copy(); d.parts[1].to = [3, 1]; assert.deepEqual(codes(d), ['R8']);
});

test('a slope off the grid, steep or bent, is rejected', () => {
  const steep = copy(); steep.parts[7].slope = [[0, 4, 3], [4, 4, 3], [2, 2, 8]];
  assert.deepEqual(codes(steep), ['R9']);
  const bent = copy(); bent.parts.push({ slope: [[6, 0, 0], [8, 0, 0], [8, 2, 2], [6, 2, 1]], faces: '+y', color: '#e63946' });
  assert.ok(codes(bent).includes('R9'));
});

test('overlapping blocks and parts out of order are rejected, naming the parts', () => {
  const o = copy(); o.parts.push({ box: [1, 1, 1], size: [2, 2, 2], color: '#3a86ff' });
  const r = check(o).rej;
  assert.deepEqual(r.map((x) => x.code), ['R10']);
  assert.match(r[0].msg, /parts 1 and 12 overlap/);
  const b = copy(); b.parts = [b.parts[8], ...b.parts.slice(0, 8), ...b.parts.slice(9)]; // the front roof slope first
  const s = check(b).rej;
  assert.deepEqual(s.map((x) => x.code), ['R11']);
  assert.match(s[0].msg, /move part 2 before part 1/);
});

test('too big is rejected; big, off the palette or bare on a side is a warning', () => {
  const big = copy(); big.parts = [{ box: [0, 0, 0], size: [30, 30, 30], color: '#3a86ff' }];
  assert.deepEqual(codes(big), ['R12']);
  const w = copy(); w.parts = [{ box: [0, 0, 0], size: [4, 4, 4], color: '#123456' }, ...['+x', '+y', '-x'].map((side) => ({ decal: side, at: side === '-x' ? 0 : 4, from: [1, 1], to: [2, 2], color: '#2b2d42' }))];
  const warn = check(w).warn.join(' ');
  assert.match(warn, /not in the palette/);
  assert.match(warn, /no decal on the -y side/);
});

test('a stamp handed in becomes a model through PARTS, drawn like any other', () => {
  assert.deepEqual(PARTS, {}, 'none handed in yet');
  const faces = fromParts(example.parts);
  assert.equal(ART.paint(faces).size, 86);
  for (const n of [1, 2, 3]) assert.ok(ART.render(faces, n).size > 0);
  assert.ok(Object.keys(MODELS).length >= 39);
});
