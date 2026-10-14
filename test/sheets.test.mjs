// The Drawing and Settings sheets' pure logic (web/sheets.js).
import test from 'node:test';
import assert from 'node:assert/strict';
import * as S from '../web/sheets.js';
import * as P from '../web/engine/project.js';
import { Drawing } from '../web/engine/model.js';

const base = { protect: 'protect', symmetry: 'off', gutters: true, hint: 'faint', densityHandle: true, densityPinch: false, densityLongpress: false, limited: false, gray: false, trace: false };

test('section chips show the current value in a few words', () => {
  assert.equal(S.chipText('set-drawing', base, 'light'), 'Keep · light paper');
  assert.equal(S.chipText('set-drawing', { ...base, protect: 'replace', symmetry: 'rot6' }, 'dark'), 'Replace · dark paper · symmetry');
  assert.equal(S.chipText('set-grid', base), 'hints faint');
  assert.equal(S.chipText('set-grid', { ...base, hint: 'off' }), 'hints off');
  assert.equal(S.chipText('set-grid', { ...base, gutters: false }), 'gutters off');
  assert.equal(S.chipText('set-selection', base), 'handle');
  assert.equal(S.chipText('set-selection', { ...base, densityHandle: false }), 'buttons only');
  assert.equal(S.chipText('set-learning', base), 'off');
  assert.equal(S.chipText('set-learning', { ...base, gray: true, trace: true }), 'grayscale · picture');
});

test('folded sections: Drawing starts open until folded, the rest closed until opened; junk reads as nothing', () => {
  const none = S.rememberedOpen(null);
  assert.equal(S.startsOpen('set-drawing', none), true);
  assert.equal(S.startsOpen('set-grid', none), false);
  const raw = S.rememberOpen(new Set(['set-grid']));
  const back = S.rememberedOpen(raw);
  assert.equal(S.startsOpen('set-drawing', back), false, 'Drawing was folded');
  assert.equal(S.startsOpen('set-grid', back), true);
  assert.equal(S.rememberedOpen('{oops').size, 0);
  assert.equal(S.rememberedOpen('[1,"set-grid"]').has('set-grid'), true);
});

test('drawing names and file names', () => {
  assert.equal(S.cleanName(undefined), 'Untitled drawing');
  assert.equal(S.cleanName('   '), 'Untitled drawing');
  assert.equal(S.cleanName('  My   cube\n'), 'My cube');
  assert.equal(S.fileBase('My cube: v2/final?'), 'My-cube-v2final');
  assert.equal(S.fileBase('..\\\\..'), 'isopix');
  assert.equal(S.fileBase('Untitled drawing'), 'Untitled-drawing');
  assert.ok(S.fileBase('x'.repeat(200)).length <= 60);
});

test('the name saves with the drawing; an old project without one gets the default', () => {
  const d = new Drawing();
  const saved = JSON.parse(JSON.stringify(P.save(d, { name: 'Sky castle' })));
  assert.equal(S.cleanName(saved.name), 'Sky castle');
  assert.equal(S.cleanName(JSON.parse(JSON.stringify(P.save(d))).name), 'Untitled drawing');
});

test('New asks only when there is something to lose, with three clear choices', () => {
  assert.deepEqual(S.newChoices(false), ['new-now']);
  assert.deepEqual(S.newChoices(true), ['save-first', 'new-anyway', 'cancel']);
});

test('the saved line', () => {
  assert.equal(S.savedAgo(null), 'Not saved in this browser yet.');
  assert.equal(S.savedAgo(5000), 'Saved in this browser a moment ago. Nothing leaves your device.');
  assert.match(S.savedAgo(3 * 60000), /3 minutes ago/);
  assert.match(S.savedAgo(61000), /1 minute ago/);
});
