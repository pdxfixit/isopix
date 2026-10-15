// index.html preloads every module app.js imports (<link rel="modulepreload">),
// so a first visit fetches them at once instead of one level of imports at a
// time (on the live site, throttled 3G: 2.9 s to 2.3 s). This fails when a
// module is added or dropped without its link.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const web = new URL('../web/', import.meta.url);
const read = (rel) => fs.readFileSync(new URL(rel, web), 'utf8');

// The static import graph from app.js: every module it loads, app.js aside.
function graph(entry = 'app.js') {
  const seen = new Set();
  const walk = (rel) => {
    if (seen.has(rel)) return;
    seen.add(rel);
    for (const m of read(rel).matchAll(/^\s*(?:import|export)\s[^'"]*?from\s*['"](\.[^'"]+)['"]|^\s*import\s*['"](\.[^'"]+)['"]/gm)) {
      walk(path.posix.normalize(path.posix.join(path.posix.dirname(rel), m[1] || m[2])));
    }
  };
  walk(entry);
  seen.delete(entry);
  return seen;
}

test('index.html preloads exactly the modules app.js imports', () => {
  const html = read('index.html');
  const preloaded = new Set([...html.matchAll(/<link rel="modulepreload" href="([^"]+)">/g)].map((m) => m[1]));
  const needed = graph();
  assert.ok(needed.size > 10, `the import graph looks wrong: ${[...needed]}`);
  const missing = [...needed].filter((m) => !preloaded.has(m));
  const extra = [...preloaded].filter((m) => !needed.has(m));
  assert.deepEqual(missing, [], `add <link rel="modulepreload" href="…"> for: ${missing.join(', ')}`);
  assert.deepEqual(extra, [], `app.js no longer imports, so drop the preload of: ${extra.join(', ')}`);
});

test('the preloads sit in <head>, after the app script', () => {
  const html = read('index.html');
  const head = html.slice(0, html.indexOf('</head>'));
  assert.ok(head.indexOf('<script type="module" src="app.js">') < head.indexOf('rel="modulepreload"'));
  assert.equal((head.match(/rel="modulepreload"/g) || []).length, (html.match(/rel="modulepreload"/g) || []).length);
});
