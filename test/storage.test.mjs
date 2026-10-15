// How Save reaches a file on each kind of device (web/storage.js saveMethod).
import test from 'node:test';
import assert from 'node:assert/strict';
import { saveMethod, offersIsopixFile } from '../web/storage.js';

test('the Save dialog where the browser has one; the share sheet on iPhone and iPad; else a download', () => {
  assert.equal(saveMethod({ picker: true }), 'picker', 'Chrome or Edge on a computer');
  assert.equal(saveMethod({ picker: true, shareFiles: true, ios: true }), 'picker');
  assert.equal(saveMethod({ ios: true, shareFiles: true }), 'share', 'iPhone, iPad: Save to Files');
  assert.equal(saveMethod({ ios: true, shareFiles: false }), 'download', 'an old iPhone without file sharing');
  assert.equal(saveMethod({ shareFiles: true }), 'download', 'Android: a download, not the share sheet');
  assert.equal(saveMethod({}), 'download', 'Firefox, Safari on a Mac');
  assert.equal(saveMethod(), 'download');
});

test('the .isopix file is offered everywhere except iPhone and iPad, where Save always makes the PNG', () => {
  assert.equal(offersIsopixFile({ ios: true }), false);
  assert.equal(offersIsopixFile({ ios: false }), true);
  assert.equal(offersIsopixFile(), true);
});
