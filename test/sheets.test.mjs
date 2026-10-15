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
  assert.equal(S.fileBase('My cube: v2/final?'), 'my-cube-v2final');
  assert.equal(S.fileBase('..\\\\..'), 'isopix');
  assert.equal(S.fileBase('Untitled drawing'), 'untitled-drawing');
  assert.equal(S.fileBase('Bouncy Badger'), 'bouncy-badger', 'file names are lowercase');
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
  assert.deepEqual(S.newChoices(true, false), ['new-now'], 'every change is already in a file');
  assert.deepEqual(S.newChoices(false, true), ['new-now']);
});

test('the file line says whether the drawing is in a file, and whether it changed since', () => {
  const now = 1e12;
  assert.equal(S.fileLine(null, false, now), '');
  assert.match(S.fileLine(null, true, now), /^Not saved to a file yet/);
  assert.equal(S.fileLine({ name: 'cube.isopix.json', at: now - 5000, via: 'save' }, true, now), 'Saved as cube.isopix.json a moment ago.');
  assert.equal(S.fileLine({ name: 'cube.isopix.json', at: now - 3 * 60000, via: 'save', linked: true }, true, now), 'Saved as cube.isopix.json 3 minutes ago. Save writes to the same file.');
  assert.equal(S.fileLine({ name: 'a.json', at: now - 1000, via: 'open', dirty: true }, true, now), 'Changed since you opened a.json a moment ago. Save file to keep the changes.');
  assert.equal(S.fileLine({ name: 'a.json', at: now, via: 'open' }, true, now), 'Opened a.json a moment ago.');
});

test('the Save dot: something drawn that is not in a file, or changed since', () => {
  assert.equal(S.unsavedToFile(null, false), false, 'empty paper');
  assert.equal(S.unsavedToFile(null, true), true);
  assert.equal(S.unsavedToFile({ at: 1, dirty: false }, true), false);
  assert.equal(S.unsavedToFile({ at: 1, dirty: true }, true), true);
});

test('the Save dot shows only for changes since a file was made, never before the first one', () => {
  assert.equal(S.saveDot(null, true), false, 'drawn, never saved to a file: no dot yet');
  assert.equal(S.saveDot({ at: null, dirty: true }, true), false);
  assert.equal(S.saveDot({ at: 1, dirty: false }, true), false, 'saved, unchanged');
  assert.equal(S.saveDot({ at: 1, dirty: true }, true), true, 'changed since the save');
  assert.equal(S.saveDot({ at: 1, dirty: true }, false), false, 'nothing drawn');
});

test('the saved line', () => {
  assert.equal(S.savedAgo(null), 'Not saved in this browser yet.');
  assert.equal(S.savedAgo(5000), 'Saved in this browser a moment ago. Nothing leaves your device.');
  assert.match(S.savedAgo(3 * 60000), /3 minutes ago/);
  assert.match(S.savedAgo(61000), /1 minute ago/);
});
