#!/usr/bin/env node
// `just export-check`: the output round trip in a private headless Chrome.
// Draws a known scene through the real pointer handlers, then checks:
//   PNG      decodes, has the right pixels at a cube's three faces, white margin
//   SVG      parses, has one merged path per color, renders as an image
//   project  saves, loads back with the same cells and undo log, and undo works
//   layer    the cached cell bitmap matches a fresh redraw after strokes, symmetry, erase, density, undo, pan, zoom
// Saves the three files to a temp folder (or --out DIR) to look at. Exits 1 on any failure.
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { launchChrome, connect, evaluate as evaluateIn, waitFor, sleep, freePort } from './chrome.mjs';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const argv = process.argv.slice(2);
const outArg = argv.includes('--out') ? argv[argv.indexOf('--out') + 1] : null;

const children = [];
process.on('exit', () => { for (const c of children) try { c.kill(); } catch { /* gone */ } });
const port = await freePort();
children.push(spawn('python3', [path.join(ROOT, 'tools/serve.py'), String(port), '--quiet'], { stdio: 'ignore' }));
const base = `http://localhost:${port}/`;
await waitFor('the dev server', async () => (await fetch(base)).ok);

const chrome = await launchChrome();
const { send, listeners } = await connect(await chrome.page());
const evaluate = (e) => evaluateIn(send, e);
const errors = [];
listeners.push((m) => { if (m.method === 'Runtime.exceptionThrown') errors.push(m.params.exceptionDetails.exception?.description || m.params.exceptionDetails.text); });
await send('Page.enable');
await send('Runtime.enable');
await send('Emulation.setDeviceMetricsOverride', { width: 900, height: 800, deviceScaleFactor: 1, mobile: false });
const loaded = new Promise((r) => listeners.push((m) => { if (m.method === 'Page.loadEventFired') r(); }));
await send('Page.navigate', { url: base });
await loaded;
await sleep(500);

const result = await evaluate(`(async () => {
  const a = window.isopix, app = await import('./app.js'), P = await import('./engine/project.js');
  a.drawing.clear();
  a.drawing.paper = 'light';
  const c = document.querySelector('#stage');
  const fire = (type, x, y) => c.dispatchEvent(new PointerEvent(type, { clientX: x, clientY: y, pointerId: 1, pointerType: 'mouse', isPrimary: true, bubbles: true, button: 0, buttons: type === 'pointerup' ? 0 : 1 }));
  const drag = (pts) => { fire('pointerdown', ...pts[0]); for (const p of pts.slice(1)) fire('pointermove', ...p); fire('pointerup', ...pts.at(-1)); };
  document.querySelector('[data-tool="pencil"]').click();
  Object.assign(a.settings, { shading: true, color: '#3a86ff', symmetry: 'off', protect: 'protect', locked: true, lockedLevel: 3 });
  a.level = 3;
  a.settings.brush = 'cube';
  const [ox, oy] = a.view.toScreen(0, 0);
  drag([[ox, oy], [ox + 96, oy]]);                 // a radius-3 cube at the origin
  a.settings.brush = 'triangle'; a.settings.color = '#e63946';
  drag([[ox + 200, oy + 10], [ox + 260, oy + 10]]); // a red stroke
  a.drawing.begin('edge'); a.drawing.paintEdge({ l: 2, p: 2, q: 2, d: 0 }, { c: '#1d1d1f' }); a.drawing.commit();
  const out = { cells: a.drawing.cells.size, log: a.drawing.undoStack.length };

  // PNG: decode it and read pixels at the three cube faces.
  const pngBlob = await app.pngBlob();
  const pc = app.pngCanvas();
  const bmp = await createImageBitmap(pngBlob);
  const cv = new OffscreenCanvas(bmp.width, bmp.height); const cx = cv.getContext('2d'); cx.drawImage(bmp, 0, 0);
  const L = await import('./engine/lattice.js'), svgm = await import('./engine/svg.js'), C = await import('./engine/color.js');
  const b = svgm.bounds(a.drawing); const w = b.x1 - b.x0, h = b.y1 - b.y0; const pad = 0.05 * Math.max(w, h, 0.1);
  const scale = pc.width / (w + 2 * pad);
  const px = (x, y) => Array.from(cx.getImageData(Math.round((x - b.x0 + pad) * scale), Math.round((y - b.y0 + pad) * scale), 1, 1).data).slice(0, 3);
  const hex = (rgb) => '#' + rgb.map((v) => v.toString(16).padStart(2, '0')).join('');
  const s = L.edgeLen(3);
  out.png = { type: pngBlob.type, size: pngBlob.size, w: bmp.width, h: bmp.height,
    top: hex(px(0, -1.5 * s)), left: hex(px(-1.5 * s, 0.6 * s)), right: hex(px(1.5 * s, 0.6 * s)), corner: hex(px(b.x0 - pad / 2, b.y0 - pad / 2)),
    want: { top: C.shade('#3a86ff', 'T'), left: C.shade('#3a86ff', 'L'), right: C.shade('#3a86ff', 'R') } };
  out.pngBytes = Array.from(new Uint8Array(await pngBlob.arrayBuffer()));

  // SVG: parse, count paths, render as an image.
  const svgText = await app.svgBlob().text();
  const doc = new DOMParser().parseFromString(svgText, 'image/svg+xml');
  const img = new Image(); img.src = URL.createObjectURL(new Blob([svgText], { type: 'image/svg+xml' }));
  let svgRenders = true; try { await img.decode(); } catch { svgRenders = false; }
  out.svg = { parseError: !!doc.querySelector('parsererror'), paths: doc.querySelectorAll('path').length, lines: doc.querySelectorAll('line').length,
    colors: new Set([...a.drawing.cells.values()].map((v) => v.c)).size, renders: svgRenders && img.naturalWidth > 0 };
  out.svgText = svgText;

  // Project: through JSON and back, then undo on the loaded copy.
  const json = JSON.stringify(app.projectData());
  const d2 = P.load(JSON.parse(json));
  const same = JSON.stringify([...d2.cells].sort()) === JSON.stringify([...a.drawing.cells].sort());
  d2.undo();
  out.project = { bytes: json.length, same, log: d2.undoStack.length + 1 === a.drawing.undoStack.length, undoWorks: d2.edges.size === 0, invariant: d2.checkInvariant() };
  out.projectJson = json;
  a.settings.locked = false;
  return out;
})()`);

// The cached cell layer must match a fresh full redraw, pixel for pixel,
// after every kind of change: no seams, no ghost cells.
const layer = await evaluate(`(async () => {
  const a = window.isopix, L = await import('./engine/lattice.js'), D = await import('./engine/density.js'), B = await import('./engine/brushes.js');
  const stage = document.querySelector('#stage'), sctx = stage.getContext('2d');
  a.drawing.clear(); a.selection = null; a.view.reset(); a.settings.symmetry = 'off';
  const snap = () => sctx.getImageData(0, 0, stage.width, stage.height).data;
  const compare = (label) => {
    a.renderNow(); const cached = snap();
    a.renderer.layer = null; a.renderNow(); const fresh = snap();
    // A ghost cell or a seam shows as paper against paint: a big difference.
    // Software rasterizers (CI) differ by a few levels at antialiased edges
    // where chunk boundaries fall differently; those are invisible and allowed.
    let bad = 0, small = 0, max = 0;
    for (let i = 0; i < cached.length; i++) { const dlt = Math.abs(cached[i] - fresh[i]); max = Math.max(max, dlt); if (dlt > 40) bad++; else if (dlt > 2) small++; }
    return [label, bad, small, max];
  };
  const c = document.querySelector('#stage');
  const fire = (type, x, y) => c.dispatchEvent(new PointerEvent(type, { clientX: x, clientY: y, pointerId: 1, pointerType: 'mouse', isPrimary: true, bubbles: true, button: 0, buttons: type === 'pointerup' ? 0 : 1 }));
  const drag = (pts) => { fire('pointerdown', ...pts[0]); for (const p of pts.slice(1)) { fire('pointermove', ...p); a.renderNow(); } fire('pointerup', ...pts.at(-1)); };
  const out = [];
  document.querySelector('[data-tool="pencil"]').click();
  a.settings.brush = 'cube'; a.settings.color = '#3a86ff'; a.renderNow();
  drag([[450, 400], [500, 400], [560, 400]]); out.push(compare('cube stroke'));
  a.settings.brush = 'triangle'; a.settings.symmetry = 'rot6mirror'; a.settings.color = '#e63946';
  drag([[480, 360], [520, 380], [600, 420]]); out.push(compare('symmetry stroke'));
  a.settings.symmetry = 'off';
  document.querySelector('[data-tool="eraser"]').click(); a.settings.brush = 'hexagon';
  drag([[450, 400], [470, 405]]); out.push(compare('erase'));
  const region = D.makeRegion(3, B.hexagon({ l: 3, p: 0, q: 0 }, 4).cells);
  a.drawing.begin(); D.changeDensity(a.drawing, region, 2, { mode: 'crisp' }); a.drawing.commit(); out.push(compare('coarsen'));
  a.drawing.begin(); D.changeDensity(a.drawing, D.snapRegion(region, 2), 4); a.drawing.commit(); out.push(compare('refine'));
  a.drawing.undo(); out.push(compare('undo'));
  a.drawing.undo(); a.drawing.undo(); out.push(compare('undo x2'));
  a.drawing.redo(); out.push(compare('redo'));
  a.renderNow(); a.view.pan(10, -6); out.push(compare('pan'));
  a.view.zoomAt(500, 400, 1.37); out.push(compare('zoom'));
  return out;
})()`);

// The trace picture: a 4000 x 3000 photo is made smaller to 2048 px, saves
// with the drawing (autosave), and comes back after a reload.
const trace1 = await evaluate(`(async () => {
  const a = window.isopix;
  const c = new OffscreenCanvas(4000, 3000); const g = c.getContext('2d'); g.fillStyle = '#3a86ff'; g.fillRect(0, 0, 4000, 3000);
  const blob = await c.convertToBlob({ type: 'image/jpeg' });
  a.placeTrace(new File([blob], 'photo.jpg', { type: 'image/jpeg' }));
  for (let i = 0; i < 50 && !a.trace; i++) await new Promise((r) => setTimeout(r, 100));
  await new Promise((r) => setTimeout(r, 1200)); // the autosave
  return { w: a.trace && a.trace.img.naturalWidth, h: a.trace && a.trace.img.naturalHeight, toast: document.querySelector('#toast').textContent };
})()`);
{
  const p = new Promise((r) => listeners.push(function once(m) { if (m.method === 'Page.loadEventFired') { listeners.splice(listeners.indexOf(once), 1); r(); } }));
  await send('Page.reload');
  await p;
  await sleep(1200);
}
const trace2 = await evaluate(`({ w: window.isopix.trace && window.isopix.trace.img.naturalWidth })`);

const dir = outArg ? path.resolve(outArg) : fs.mkdtempSync(path.join(os.tmpdir(), 'isopix-export-'));
fs.mkdirSync(dir, { recursive: true });
fs.writeFileSync(path.join(dir, 'check.png'), Buffer.from(result.pngBytes));
fs.writeFileSync(path.join(dir, 'check.svg'), result.svgText);
fs.writeFileSync(path.join(dir, 'check.isopix.json'), result.projectJson);

// Within 2 levels a channel: decoders may round a level differently (seen on CI).
const near = (a, b) => [1, 3, 5].every((i) => Math.abs(parseInt(a.slice(i, i + 2), 16) - parseInt(b.slice(i, i + 2), 16)) <= 2);
const checks = [
  ['🖼️  PNG is image/png and decodes', result.png.type === 'image/png' && result.png.w > 0],
  [`🖼️  PNG cube top face ${result.png.top} (want ${result.png.want.top})`, near(result.png.top, result.png.want.top)],
  [`🖼️  PNG cube left face ${result.png.left} (want ${result.png.want.left})`, near(result.png.left, result.png.want.left)],
  [`🖼️  PNG cube right face ${result.png.right} (want ${result.png.want.right})`, near(result.png.right, result.png.want.right)],
  [`🖼️  PNG margin is the drawing's light paper (${result.png.corner})`, near(result.png.corner, '#f7f5f0')],
  ['✏️  SVG parses', !result.svg.parseError],
  [`✏️  SVG has one merged path per color (${result.svg.paths} for ${result.svg.colors})`, result.svg.paths === result.svg.colors],
  [`✏️  SVG keeps the bold edge (${result.svg.lines} line)`, result.svg.lines === 1],
  ['✏️  SVG renders as an image', result.svg.renders],
  ['💾 project loads back with the same cells', result.project.same],
  ['💾 project keeps the undo log', result.project.log],
  ['💾 undo works on the loaded project', result.project.undoWorks],
  ['💾 loaded project keeps the one-cell-or-children rule', result.project.invariant === null],
  ...layer.map(([label, bad, small, max]) => [`🧱 cached cell layer matches a fresh redraw after ${label} (${bad} visible differences; ${small} faint edge values, largest ${max})`, bad === 0]),
  [`🖼️  a 4000x3000 trace photo is made smaller to ${trace1.w}x${trace1.h}, and says so`, trace1.w === 2048 && trace1.h === 1536 && /smaller/.test(trace1.toast)],
  [`💾 the trace picture comes back after a reload (${trace2.w} px wide)`, trace2.w === 2048],
  ['💥 no page errors', errors.length === 0],
];
for (const [label, ok] of checks) console.log(`${ok ? '✅' : '❌'} ${label}`);
for (const e of errors) console.log(`   ${e}`);
console.log(`\n📂 ${dir}  (check.png ${result.png.w}x${result.png.h}, check.svg, check.isopix.json ${result.project.bytes} bytes)`);
process.exit(checks.every(([, ok]) => ok) ? 0 : 1);
