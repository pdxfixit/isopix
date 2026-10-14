// The service worker precaches every file the app loads (web/sw.js SHELL).
// The first visit loads the modules before the worker controls the page, so a
// file missing from SHELL is not cached then, and an offline start fails on
// it. Six modules were missing until 2026-10-14.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const WEB = new URL('../web/', import.meta.url).pathname;
const sw = fs.readFileSync(path.join(WEB, 'sw.js'), 'utf8');
const shell = new Set(JSON.parse(sw.match(/const SHELL = (\[[^\]]+\])/)[1].replace(/'/g, '"').replace(/,\s*\]/, ']')));
// Served but not part of the app shell: the worker itself, response headers, the deploy label.
const NOT_SHELL = new Set(['sw.js', '_headers', 'version.json']);

function files(dir, rel = '') {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? files(path.join(dir, e.name), `${rel}${e.name}/`) : [`${rel}${e.name}`]);
}

test('every file in web/ is in the service worker\'s SHELL', () => {
  for (const f of files(WEB)) {
    if (NOT_SHELL.has(f) || f.startsWith('.')) continue;
    assert.ok(shell.has(`./${f}`), `web/${f} is not in sw.js SHELL: an offline start would fail on it`);
  }
});

test('every SHELL entry exists', () => {
  for (const s of shell) {
    if (s === './') continue;
    assert.ok(fs.existsSync(path.join(WEB, s)), `sw.js SHELL lists ${s}, which is not in web/`);
  }
});
