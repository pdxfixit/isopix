// How Save reaches a file on each kind of device (web/storage.js saveMethod).
import test from 'node:test';
import assert from 'node:assert/strict';
import { saveMethod } from '../web/storage.js';

test('the Save dialog where the browser has one; the share sheet on iPhone and iPad; else a download', () => {
  assert.equal(saveMethod({ picker: true }), 'picker', 'Chrome or Edge on a computer');
  assert.equal(saveMethod({ picker: true, shareFiles: true, ios: true }), 'picker');
  assert.equal(saveMethod({ ios: true, shareFiles: true }), 'share', 'iPhone, iPad: Save to Files');
  assert.equal(saveMethod({ ios: true, shareFiles: false }), 'download', 'an old iPhone without file sharing');
  assert.equal(saveMethod({ shareFiles: true }), 'download', 'Android: a download, not the share sheet');
  assert.equal(saveMethod({}), 'download', 'Firefox, Safari on a Mac');
  assert.equal(saveMethod(), 'download');
});
