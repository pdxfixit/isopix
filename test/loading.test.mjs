// The loading screen's timing (web/loading.js, a classic script, so it runs
// here in a bare context). `just look loading loading-slow` shows the screen.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const src = fs.readFileSync(new URL('../web/loading.js', import.meta.url), 'utf8');
const ctx = { self: {}, setTimeout, clearTimeout, performance };
vm.runInNewContext(src, ctx);
const L = ctx.self.ISOPIX_LOADING;

test('a quick start never shows the sweep: it just lets the paper go', () => {
  assert.deepEqual({ ...L.plan(0) }, { wait: 0, sweep: false });
  assert.deepEqual({ ...L.plan(L.SHOW_MS - 1) }, { wait: 0, sweep: false });
});

test('once the sweep shows, it stays at least MIN_MS, then completes its turn', () => {
  assert.deepEqual({ ...L.plan(L.SHOW_MS) }, { wait: L.MIN_MS, sweep: true });
  assert.deepEqual({ ...L.plan(L.SHOW_MS + 200) }, { wait: L.MIN_MS - 200, sweep: true });
  assert.deepEqual({ ...L.plan(4000) }, { wait: 0, sweep: true });
});

test('a return visit (0.2 s) is under the show delay, and the slow notice waits 10 s', () => {
  assert.ok(L.SHOW_MS > 200);
  assert.equal(L.SLOW_MS, 10000);
});

test('without the page (no #loading), done() still resolves, so the app never waits on it', async () => {
  await L.done();
});

test('styles.css waits as long as loading.js before showing the sweep and the bar', () => {
  const css = fs.readFileSync(new URL('../web/styles.css', import.meta.url), 'utf8');
  const delay = `${L.SHOW_MS / 1000}s forwards`;
  assert.match(css, new RegExp(`\\.loading-sweep \\{[^}]*loading-in 0\\.2s ${delay.replace('.', '\\.')}`));
  assert.match(css, new RegExp(`\\.loading-bar \\{[^}]*loading-in 0\\.2s ${delay.replace('.', '\\.')}`));
});
