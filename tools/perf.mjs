#!/usr/bin/env node
// `just perf`: frame times on a big drawing, in a private headless Chrome.
// Builds 38,400 cells (level 6, four colors), then times 60 synchronous
// frames each of: panning, zooming, and drawing (one cell painted per frame,
// as a stroke does). Prints median and 95th percentile in ms. The same method
// before and after a renderer change gives a fair comparison.
//   node tools/perf.mjs [--dpr 2] [--cells 38400]
import { spawn } from 'node:child_process';
import path from 'node:path';
import { launchChrome, connect, evaluate as evaluateIn, waitFor, sleep, freePort, skipWelcome } from './chrome.mjs';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const arg = (name, d) => { const i = process.argv.indexOf(name); return i > 0 ? Number(process.argv[i + 1]) : d; };
const dpr = arg('--dpr', 2), cells = arg('--cells', 38400);
const children = [];
process.on('exit', () => { for (const c of children) try { c.kill(); } catch { /* gone */ } });
const port = await freePort();
children.push(spawn('python3', [path.join(ROOT, 'tools/serve.py'), String(port), '--quiet'], { stdio: 'ignore' }));
const base = `http://localhost:${port}/`;
await waitFor('the dev server', async () => (await fetch(base)).ok);
const chrome = await launchChrome();
const { send, listeners } = await connect(await chrome.page());
await send('Page.enable'); await send('Runtime.enable');
await skipWelcome(send);
await send('Emulation.setDeviceMetricsOverride', { width: 1024, height: 768, deviceScaleFactor: dpr, mobile: false });
const loaded = new Promise((r) => listeners.push((m) => { if (m.method === 'Page.loadEventFired') r(); }));
await send('Page.navigate', { url: base });
await loaded;
await sleep(600);
const out = await evaluateIn(send, `(async () => {
  const a = window.isopix, L = await import('./engine/lattice.js');
  a.selection = null; a.drawing.clear(); a.view.reset();
  const cols = ['#e63946', '#3a86ff', '#e9c46a', '#2a9d8f'];
  const side = Math.ceil(Math.sqrt(${cells} / 2 / (4 / 3))); const P = Math.round(side * 0.75), Q = Math.round(side * 2 / 3 * 2);
  let n = 0;
  outer: for (let p = -P; p < P; p++) for (let q = -Q; q < Q; q++) for (const u of [0, 1]) {
    if (n >= ${cells}) break outer;
    a.drawing.setCell(L.key(6, p, q, u), { c: cols[(p * 7 + q * 3 + u) & 3], t: 1, id: ++n });
  }
  a.renderNow();
  // A 1-pixel read makes Chrome finish rasterizing, so the time includes the GPU work, not just the calls.
  const stage = document.querySelector('#stage').getContext('2d');
  const time = (step) => { const ts = []; for (let i = 0; i < 60; i++) { step(i); const t0 = performance.now(); a.renderNow(); stage.getImageData(0, 0, 1, 1); ts.push(performance.now() - t0); } ts.sort((x, y) => x - y); return { median: +ts[30].toFixed(1), p95: +ts[57].toFixed(1) }; };
  const pan = time(() => a.view.pan(6, 3));
  const zoom = time((i) => a.view.zoomAt(512, 384, i < 30 ? 1.01 : 0.99));
  a.view.reset();
  const draw = time((i) => { a.drawing.begin('perf'); a.drawing.paint(L.mk(6, -P + i, 0, 1), { c: '#000000' }); a.drawing.commit(); });
  return { cells: a.drawing.cells.size, dpr: ${dpr}, pan, zoom, draw };
})()`);
console.log(`🐢 ${out.cells} cells, 1024x768 at ${out.dpr}x: ms per frame (median / p95)`);
for (const k of ['pan', 'zoom', 'draw']) console.log(`  ${k.padEnd(5)} ${String(out[k].median).padStart(7)} / ${out[k].p95}`);
process.exit(0);
