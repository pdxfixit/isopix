#!/usr/bin/env node
// `just move-check`: moving house to isopix.app, end to end in a private
// headless Chrome (web/move.js). Local servers stand in for the old addresses
// (Chrome maps their names to 127.0.0.1) and localhost for the new home;
// https://isopix.app itself is never contacted: the check catches the
// navigation to it and opens its #move= fragment on localhost instead. On an
// old address it does what that address's move page does (flarepress): import
// move.js from the new home, cross-origin, and call moveToNewHome().
//
//   1. isopix.pdxfixit.com: draw there with the 1.x app, then its move page
//      heads for isopix.app
//   2. the new home takes the drawing and settings silently, clears #move=
//   3. the same arrival again is ignored
//   4. another drawing arriving while the home has its own is offered, not
//      put in its place; Open it asks first, then opens it
//   5. the old Isogrid address: its storage names, move.js loaded cross-origin
//      (CORS from _headers), Isogrid settings under Isopix's names
// Exits 1 when a check fails.
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { launchChrome, connect, evaluate, sleep, freePort, waitFor } from './chrome.mjs';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const port = await freePort(), oport = await freePort();
const plain = fs.mkdtempSync(path.join(os.tmpdir(), 'move-check-'));
fs.writeFileSync(path.join(plain, 'index.html'), '<!doctype html><title>old Isogrid page</title>');
const srv = spawn('python3', ['tools/serve.py', String(port)], { cwd: ROOT, stdio: 'ignore' });
// The old Isogrid page, as a plain server: its real CSP (flarepress) allows isopix.app.
const osrv = spawn('python3', ['-m', 'http.server', String(oport), '--bind', '127.0.0.1'], { cwd: plain, stdio: 'ignore' });
process.on('exit', () => { srv.kill(); osrv.kill(); fs.rmSync(plain, { recursive: true, force: true }); });
process.env.CHROME_HOST_RULES = 'MAP isopix.pdxfixit.com 127.0.0.1, MAP oldgrid.test 127.0.0.1';
const chrome = await launchChrome();
const { send, listeners } = await connect(await chrome.page());
await send('Page.enable');
await send('Runtime.enable');
const errors = [];
listeners.push((m) => { if (m.method === 'Runtime.exceptionThrown') errors.push(m.params.exceptionDetails.exception?.description || m.params.exceptionDetails.text); });
let target = null;
listeners.push((m) => {
  if (m.method !== 'Page.frameRequestedNavigation' && m.method !== 'Page.frameStartedNavigating') return;
  if (m.params.url?.startsWith('https://isopix.app')) target = target || m.params.url;
});
const home = `http://localhost:${port}`;
await waitFor('the dev server', () => fetch(`${home}/version.json`).then((r) => r.ok));
let failed = 0;
const check = (ok, what) => { console.log(`${ok ? '✅' : '❌'} ${what}`); if (!ok) failed++; };
const go = async (url, ms = 2500) => { await send('Page.navigate', { url: 'about:blank' }); await sleep(200); await send('Page.navigate', { url }); await sleep(ms); };
const caught = async () => { for (let i = 0; i < 50 && !target; i++) await sleep(200); const t = target; target = null; return t; };
const DRAW = (x, y) => `(async () => { const c = document.querySelector('#stage');
  const f = (t, px, py) => c.dispatchEvent(new PointerEvent(t, { clientX: px, clientY: py, pointerId: 1, pointerType: 'mouse', isPrimary: true, bubbles: true, button: 0, buttons: t === 'pointerup' ? 0 : 1 }));
  document.querySelector('[data-tool="pencil"]').click();
  f('pointerdown', ${x}, ${y}); for (let i = 1; i <= 8; i++) f('pointermove', ${x} + i * 20, ${y}); f('pointerup', ${x} + 160, ${y});
  await new Promise((r) => setTimeout(r, 1200)); return window.isopix.drawing.cells.size; })()`;
const state = `({ cells: window.isopix.drawing.cells.size, hash: location.hash, color: window.isopix.settings.color, gutters: window.isopix.settings.gutters, note: !document.querySelector('#move-note').hidden, offer: !document.querySelector('#move-open').hidden })`;

// 1. The old Isopix address.
const old = `http://isopix.pdxfixit.com:${port}`;
await go(`${old}/`, 1500);
const drawn = await evaluate(send, DRAW(120, 300));
await evaluate(send, `localStorage.setItem('isopix-settings', JSON.stringify({ ...window.isopix.settings, color: '#ff006e', gutters: false }))`);
// Its move page: the same origin, move.js from the new home (served with CORS).
// The dev server's CSP allows only its own scripts; the real move page's
// allows isopix.app (flarepress), so the check sets the CSP aside here.
await send('Page.setBypassCSP', { enabled: true });
await go(`${old}/version.json`, 300);
await evaluate(send, `import('${home}/move.js').then((m) => { m.moveToNewHome(); return true; })`);
const t1 = await caught();
await send('Page.setBypassCSP', { enabled: false });
check(!!t1 && t1.includes('#move=') && drawn > 0, `isopix.pdxfixit.com heads for isopix.app with its drawing (${drawn} cells, ${t1 ? t1.length : 0} chars)`);
if (!t1) process.exit(1);
// 2. Arriving at an empty new home.
await go(`${home}/${t1.slice(t1.indexOf('#'))}`);
const s2 = await evaluate(send, state);
check(s2.cells === drawn, `the new home took the drawing silently (${s2.cells} cells${s2.note ? ', but showed a note' : ''})`);
check(!s2.note, 'no note when the new home had no drawing');
check(s2.hash === '', 'the #move= fragment is gone from the address');
check(s2.color === '#ff006e' && s2.gutters === false, `settings came along (${s2.color}, gutters ${s2.gutters})`);
// 3. The same arrival again: a bookmark to the old address, visited again.
await go(`${home}/${t1.slice(t1.indexOf('#'))}`);
const s3 = await evaluate(send, state);
check(!s3.note && s3.cells === drawn, 'the same drawing arriving twice is ignored');
// 4. Another drawing arrives while the home has its own.
const mine = await evaluate(send, DRAW(120, 500));
const other = await evaluate(send, `(async () => { const m = await import('./move.js'); const P = await import('./engine/project.js');
  const s = JSON.parse(JSON.stringify(P.save(window.isopix.drawing, { savedAt: 42 }))); s.cells = s.cells.slice(0, 1);
  return (await m.moveURL({ from: 'isopix.pdxfixit.com', autosave: s, local: {} })).url; })()`);
await go(`${home}/${other.slice(other.indexOf('#'))}`);
const s4 = await evaluate(send, state);
check(s4.cells === mine && s4.note && s4.offer, `its own drawing stays (${s4.cells} cells) and the arrival is offered`);
const mineId = await evaluate(send, 'window.isopix.drawingId');
await evaluate(send, `document.querySelector('#move-open').click()`);
await sleep(800);
const s4b = await evaluate(send, `({ cells: window.isopix.drawing.cells.size, id: window.isopix.drawingId, kept: window.isopix.gallery.some((e) => e.id === ${JSON.stringify('MINE')}) })`.replace('"MINE"', JSON.stringify(mineId)));
check(s4b.cells === 1 && s4b.id !== mineId && s4b.kept, 'Open it opens the arrival as another drawing; its own stays in Drawings');
// 5. The old Isogrid address: Isogrid's database and settings names, move.js cross-origin.
await go(`http://oldgrid.test:${oport}/`, 800);
await evaluate(send, `(async () => {
  const proj = { format: 'isogrid', version: 1, seq: 1, cells: [['2,0,0,1', { c: '#8338ec', id: 1 }]], edges: [], hidden: [], log: [{ cells: [['2,0,0,1', null, { c: '#8338ec', id: 1 }]], edges: [], hidden: [] }], redo: [], name: 'Isogrid days', savedAt: 777 };
  await new Promise((res, rej) => { const r = indexedDB.open('isogrid', 1); r.onupgradeneeded = () => r.result.createObjectStore('kv');
    r.onsuccess = () => { const tx = r.result.transaction('kv', 'readwrite'); tx.objectStore('kv').put(proj, 'autosave'); tx.oncomplete = res; tx.onerror = rej; }; });
  localStorage.setItem('isogrid-settings', JSON.stringify({ color: '#8338ec' }));
})()`);
await evaluate(send, `import('${home}/move.js').then((m) => { m.moveToNewHome(); return true; })`);
const t5 = await caught();
check(!!t5 && t5.includes('#move='), 'the Isogrid page loads move.js cross-origin and heads for isopix.app');
// A fresh home: clear the localhost origin's storage first.
await go(`${home}/version.json`, 300);
await evaluate(send, `new Promise((r) => { localStorage.clear(); const q = indexedDB.deleteDatabase('isopix'); q.onsuccess = q.onerror = q.onblocked = () => r(true); })`);
if (t5) {
  await go(`${home}/${t5.slice(t5.indexOf('#'))}`);
  const s5 = await evaluate(send, `({ cells: window.isopix.drawing.cells.size, name: window.isopix.drawingName, color: window.isopix.settings.color })`);
  check(s5.cells === 1 && s5.name === 'Isogrid days', `the Isogrid drawing arrived ("${s5.name}", ${s5.cells} cell)`);
  check(s5.color === '#8338ec', `Isogrid's settings arrived under Isopix's name (${s5.color})`);
}
check(!errors.length, errors.length ? `page errors: ${errors.join(' | ')}` : 'no page errors');
process.exit(failed ? 1 : 0);
