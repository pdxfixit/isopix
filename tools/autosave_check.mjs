// Autosave copies, end to end in headless Chrome (web/autosave.js, app.js
// saveNow and boot): a drawing with something in it takes a copy at its
// autosave, and a damaged autosave opens the newest copy that loads, saying
// so. Since several drawings (web/gallery.js) the keys are per drawing, and
// the single drawing kept before moves in once. Exits 1 when a check fails.
//
//   node tools/autosave_check.mjs        (just autosave-check)
import { spawn } from 'node:child_process';
import path from 'node:path';
import { launchChrome, connect, evaluate, sleep, freePort, waitFor, skipWelcome } from './chrome.mjs';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const port = await freePort();
const srv = spawn('python3', ['tools/serve.py', String(port)], { cwd: ROOT, stdio: 'ignore' });
process.on('exit', () => srv.kill());
const chrome = await launchChrome();
const { send, listeners } = await connect(await chrome.page());
await send('Page.enable');
await send('Runtime.enable');
await skipWelcome(send);
const errors = [];
listeners.push((m) => { if (m.method === 'Runtime.exceptionThrown') errors.push(m.params.exceptionDetails.exception?.description || m.params.exceptionDetails.text); });
const home = `http://localhost:${port}`;
await waitFor('the dev server', () => fetch(`${home}/version.json`).then((r) => r.ok));
let failed = 0;
const check = (ok, what) => { console.log(`${ok ? '✅' : '❌'} ${what}`); if (!ok) failed++; };
const go = async (url, ms = 2500) => { await send('Page.navigate', { url: 'about:blank' }); await sleep(200); await send('Page.navigate', { url }); await sleep(ms); };
// Runs `body` with `db` open (the app's own IndexedDB) inside a promise: call res or rej.
// A throw inside an IndexedDB callback is caught by nothing, so a step that
// breaks would wait forever: after 10 s it fails, saying so.
const idb = (body) => `new Promise((res, rej) => { setTimeout(() => rej(new Error('an IndexedDB step did not finish in 10 s (a callback threw?)')), 10000);
  const r = indexedDB.open('isopix', 1); r.onupgradeneeded = () => r.result.createObjectStore('kv');
  r.onsuccess = () => { const db = r.result; ${body} }; r.onerror = rej; })`;

// 1. A drawing with something in it takes a copy at its first autosave.
await go(`${home}/version.json`, 300);
await evaluate(send, `new Promise((r) => { localStorage.clear(); const q = indexedDB.deleteDatabase('isopix'); q.onsuccess = q.onerror = q.onblocked = () => r(true); })`);
await go(`${home}/`);
await evaluate(send, `(async () => { const c = document.querySelector('#stage');
  const f = (t, px, py) => c.dispatchEvent(new PointerEvent(t, { clientX: px, clientY: py, pointerId: 1, pointerType: 'mouse', isPrimary: true, bubbles: true, button: 0, buttons: t === 'pointerup' ? 0 : 1 }));
  document.querySelector('[data-tool="pencil"]').click();
  f('pointerdown', 150, 300); for (let i = 1; i <= 6; i++) f('pointermove', 150 + i * 20, 300); f('pointerup', 270, 300);
  await new Promise((r) => setTimeout(r, 1500)); })()`);
const cells = await evaluate(send, 'window.isopix.drawing.cells.size');
const id = await evaluate(send, 'window.isopix.drawingId');
const copies = await evaluate(send, idb(`const g = db.transaction('kv').objectStore('kv').get('copies:${id}'); g.onsuccess = () => res(g.result ? g.result.map((c) => Object.keys(c.project.picture.cells).length) : null);`));
check(cells > 0 && Array.isArray(copies) && copies.length === 1 && copies[0] === cells, `a drawing with something in it took one copy at its autosave (${cells} cells, copies ${JSON.stringify(copies)})`);

// 2. A damaged autosave opens the newest copy that loads, and says so.
await go(`${home}/version.json`, 300);
await evaluate(send, idb(`const tx = db.transaction('kv', 'readwrite'); const st = tx.objectStore('kv');
  st.get('drawing:${id}').onsuccess = (e) => {
    const good = e.target.result;
    st.put({ ...good, picture: { ...good.picture, name: 'Broken', cells: { 'not a key': 'nope' } } }, 'drawing:${id}');
    st.put([{ savedAt: Date.now() - 6 * 60000, project: { ...good, picture: { ...good.picture, name: 'Rescued' } } }], 'copies:${id}');
  };
  tx.oncomplete = () => res(true); tx.onerror = rej;`));
await go(`${home}/`, 1200);
const s = await evaluate(send, `({ name: window.isopix.drawingName, cells: window.isopix.drawing.cells.size, toast: document.querySelector('#toast').textContent })`);
check(s.name === 'Rescued' && s.cells === cells, `the damaged autosave opened its copy instead ("${s.name}", ${s.cells} cells)`);
check(/copy kept 6 minutes ago/.test(s.toast), `and said so: "${s.toast}"`);

// 3. The single drawing kept before several drawings moves in once, copies and all.
await go(`${home}/version.json`, 300);
await evaluate(send, `new Promise((r) => { localStorage.clear(); const q = indexedDB.deleteDatabase('isopix'); q.onsuccess = q.onerror = q.onblocked = () => r(true); })`);
await evaluate(send, idb(`const tx = db.transaction('kv', 'readwrite'); const st = tx.objectStore('kv');
  st.put({ format: 'isopix', version: 1, seq: 1, cells: [['2,0,0,1', { c: '#3a86ff', id: 1 }]], edges: [], hidden: [], log: [], redo: [], name: 'Before galleries', savedAt: 1000 }, 'autosave');
  st.put([{ savedAt: 900, project: { format: 'isopix', version: 1, cells: [], edges: [], hidden: [], name: 'old copy' } }], 'autosave-copies');
  tx.oncomplete = () => res(true); tx.onerror = rej;`));
await go(`${home}/`, 1500);
const m = await evaluate(send, idb(`const st = db.transaction('kv').objectStore('kv'); const a = window.isopix;
  const l = st.get('drawings'), c = st.get('copies:' + a.drawingId), o = st.get('autosave'), rec = st.get('drawing:' + a.drawingId);
  rec.onsuccess = () => res({ name: a.drawingName, cells: a.drawing.cells.size, list: (l.result || []).map((e) => e.name), copies: (c.result || []).map((x) => x.project.picture?.name ?? x.project.name), converted: !!rec.result?.picture && (c.result || []).every((x) => x.project.picture), legacy: !!o.result });`));
check(m.name === 'Before galleries' && m.cells === 1, `the drawing kept before opened (${m.name}, ${m.cells} cell)`);
check(m.list.length === 1 && m.list[0] === 'Before galleries' && m.copies.includes('old copy'), `it moved into Drawings with its copy (${JSON.stringify(m.list)}, copies ${JSON.stringify(m.copies)})`);
check(m.legacy, 'the old autosave key is left as it was');
check(m.converted, 'it and its copies were rewritten in spec 1.0 (P.fromOldLayout, temporary)');
check(!errors.length, errors.length ? `page errors: ${errors.join(' | ')}` : 'no page errors');
process.exit(failed ? 1 : 0);
