#!/usr/bin/env node
// `just look`: checks Isopix at every width in a private headless Chrome.
//
// Each run gets its own Chrome (throwaway profile, tools/chrome.mjs) and its
// own dev server on a free port, so agents never fight over the shared
// Browser pane. For each width and view it loads the page, opens the view,
// runs any extra JS, then reports sideways scroll, console errors, CSP blocks,
// controls under 44 px tall or wide and controls that overlap, and saves a
// screenshot. Exits 1 when a check fails.
//
//   node tools/look.mjs [VIEW ...] [--js CODE] [--url URL] [--out DIR] [--widths 320,375] [--height PX] [--light|--dark]
//   views: draw (default) drawn settings settings-open-all drawing-sheet drawing-new brushes select selmore rail update updatesel protect hoverskip help move pinchpan save-file welcome welcome-first name-roll loading loading-slow
//   console.log() in --js prints under the table (📝).
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { launchChrome, connect, evaluate as evaluateIn, waitFor, sleep, freePort, skipWelcome } from './chrome.mjs';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const MIN_TAP = 44;
const q = (sel) => `document.querySelector(${JSON.stringify(sel)}).click();`;
const nap = 'await new Promise((r) => setTimeout(r, 150));';
// A small drawing made through the real pointer handlers.
const DRAW = `
  document.querySelector('[data-tool="pencil"]').click();
  const c = document.querySelector('#stage');
  const fire = (type, x, y, id = 1) => c.dispatchEvent(new PointerEvent(type, { clientX: x, clientY: y, pointerId: id, pointerType: 'touch', isPrimary: true, bubbles: true, button: 0, buttons: type === 'pointerup' ? 0 : 1 }));
  const w = innerWidth, h = innerHeight;
  fire('pointerdown', w * 0.3, h * 0.35); for (let i = 1; i <= 10; i++) fire('pointermove', w * (0.3 + i * 0.04), h * (0.35 + i * 0.01)); fire('pointerup', w * 0.7, h * 0.45);`;
const VIEWS = {
  draw: { js: '' },
  drawn: { js: DRAW },
  settings: { js: q('#settings-open') },
  // Every Settings section open (heads that are shut get a click; the state is remembered).
  'settings-open-all': { js: `${q('#settings-open')} for (const h of document.querySelectorAll('#settings .set-head')) if (h.getAttribute('aria-expanded') !== 'true') h.click();` },
  'drawing-sheet': { js: q('#drawing-open') },
  // A real swatch tap on the Eraser switches to the Pencil; on Fill it does not; the auto-shade toggle never does.
  'color-pick': { js: `const pressed = () => document.querySelector('[data-tool][aria-pressed="true"]').dataset.tool;
    ${q('[data-tool="eraser"]')} document.querySelector('#palette .swatch:nth-child(2)').click();
    if (pressed() !== 'pencil') throw new Error('a color pick on the Eraser left ' + pressed());
    ${q('[data-tool="eraser"]')} document.querySelector('#palette .swatch.tool[aria-pressed]').click();
    if (pressed() !== 'eraser') throw new Error('the auto-shade toggle changed the tool to ' + pressed());
    document.querySelector('#palette .swatch.tool[aria-pressed]').click();
    ${q('[data-tool="fill"]')} document.querySelector('#palette .swatch:nth-child(3)').click();
    if (pressed() !== 'fill') throw new Error('a color pick on Fill changed it to ' + pressed());
    ${q('[data-tool="pencil"]')}` },
  // Focus goes back to the button that opened a sheet; a key opens the other sheet.
  'sheet-focus': { js: `const b = document.querySelector('#settings-open'); b.focus(); b.click();
    document.querySelector('#settings').close(); await new Promise((r) => setTimeout(r, 50));
    if (document.activeElement !== b) throw new Error('focus did not return to Settings, it is on ' + (document.activeElement.id || document.activeElement.tagName));
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'd', bubbles: true }));
    if (!document.querySelector('#drawing').open) throw new Error('D did not open the Drawing sheet');` },
  // New with something drawn: the three choices.
  'drawing-new': { js: `${DRAW} ${q('#drawing-open')} ${q('#file-new')}
    if (document.querySelector('#new-confirm').hidden) throw new Error('New did not ask first');` },
  brushes: { js: q('[data-tool="pencil"]') + q('#options') },
  select: { js: `${DRAW} ${q('[data-tool="select"]')} ${nap}
    const c2 = document.querySelector('#stage');
    const f = (type, x, y) => c2.dispatchEvent(new PointerEvent(type, { clientX: x, clientY: y, pointerId: 2, pointerType: 'mouse', isPrimary: true, bubbles: true, button: 0, buttons: type === 'pointerup' ? 0 : 1 }));
    f('pointerdown', innerWidth * 0.5, innerHeight * 0.4); f('pointermove', innerWidth * 0.5 + 90, innerHeight * 0.4 + 20); f('pointerup', innerWidth * 0.5 + 90, innerHeight * 0.4 + 20);` },
};
// The selection with ⋯ More open, and the level rail held open by a finger.
VIEWS.selmore = { js: `${VIEWS.select.js} ${nap} ${q('#sel-more')}` };
VIEWS.rail = { js: `const n = document.querySelector('.notch[aria-checked="true"]'); const r = n.getBoundingClientRect();
  n.dispatchEvent(new PointerEvent('pointerdown', { clientX: r.x + 22, clientY: r.y + 22, pointerId: 5, pointerType: 'touch', bubbles: true, buttons: 1 }));` };

// The zoom rail, slid by a finger from the middle toward the top (or, on a screen
// too short to show the track, its + pressed): the view must zoom in.
VIEWS.zoom = { js: `${DRAW} const t = document.querySelector('#zoom-track'); const r = t.getBoundingClientRect(); const z0 = window.isopix.view.zoom;
  const f = (type, y) => t.dispatchEvent(new PointerEvent(type, { clientX: r.x + 22, clientY: y, pointerId: 6, pointerType: 'touch', bubbles: true, buttons: type === 'pointerup' ? 0 : 1 }));
  if (t.offsetParent) { f('pointerdown', r.y + r.height / 2); f('pointermove', r.y + r.height * 0.3); f('pointerup', r.y + r.height * 0.3); }
  else document.querySelector('#zoom-in').click();
  if (!(window.isopix.view.zoom > z0 * 1.5)) throw new Error('the zoom slider did not zoom in');
  if (!/Zoom/.test(document.querySelector('#level-readout').textContent)) throw new Error('no zoom readout');` };

// ⌖ Fit drawing after zooming far in: the drawing must land in the area the
// controls leave clear (caught a fit that ignored every fixed control).
VIEWS.fit = { js: `${DRAW} const app = window.isopix; app.view.zoomAt(app.view.w / 2, app.view.h / 2, 64);
  document.querySelector('#fit-view').click();
  const { bounds } = await import(new URL('engine/svg.js', location.href)); const b = bounds(app.drawing);
  const [x0, y0] = app.view.toScreen(b.x0, b.y0), [x1, y1] = app.view.toScreen(b.x1, b.y1);
  const box = (s) => document.querySelector(s).getBoundingClientRect();
  const lv = box('#levels'), top = Math.max(box('.topleft').bottom, lv.height < lv.width ? lv.bottom : 0);
  const right = lv.height > lv.width ? lv.left : innerWidth, bottom = Math.min(box('#palette').top, box('.tools').top);
  if (x0 < box('#zoom').right - 1 || x1 > right + 1 || y0 < top - 1 || y1 > bottom + 1) throw new Error('fit left the drawing under the controls: ' + [x0, y0, x1, y1].map(Math.round));` };
// The update notice: the page loads as version look-a, then look-b goes "live".
VIEWS.update = { live: ['look-a', 'look-b'], js: `await window.isopix.update.ask();
  if (document.querySelector('#update-bar').hidden) throw new Error('the update bar did not appear');` };
// With a selection open, the bar must sit above the selection bar.
VIEWS.updatesel = { live: ['look-a', 'look-b'], js: `${VIEWS.select.js} ${nap} await window.isopix.update.ask(); ${nap}
  if (document.querySelector('#update-bar').hidden) throw new Error('the update bar did not appear');` };

// Keep fine detail made visible: fine detail, then a bigger tile clicked on it (the
// skipped cells hatch and the once-a-session notice shows), then hovered.
const PROTECT = `
  const a = window.isopix, c = document.querySelector('#stage');
  const f = (type, x, y, buttons = 1) => c.dispatchEvent(new PointerEvent(type, { clientX: x, clientY: y, pointerId: 3, pointerType: 'mouse', isPrimary: true, bubbles: true, button: 0, buttons }));
  document.querySelector('[data-tool="pencil"]').click();
  Object.assign(a.settings, { protect: 'protect', locked: true, lockedLevel: 5, brush: 'triangle' }); a.level = 5;
  const x = innerWidth * 0.45, y = innerHeight * 0.4;
  f('pointerdown', x, y); for (let i = 1; i < 8; i++) f('pointermove', x + i * 4, y + i); f('pointerup', x + 28, y + 7, 0);
  a.settings.lockedLevel = 2; a.level = 2; a.settings.brush = 'hexagon';
  f('pointerdown', x + 10, y + 3); f('pointerup', x + 10, y + 3, 0);
  if (document.querySelector('#protect-note').hidden) throw new Error('the skip notice did not show');`;
// The welcome card: from Settings → About, half built (three of six taps).
const TAP3 = `const tris = () => [...document.querySelectorAll('#welcome-cube .cube-todo')];
  for (let i = 0; i < 3; i++) tris()[0].dispatchEvent(new MouseEvent('click', { bubbles: true }));
  const cap = document.querySelector('#welcome-caption').textContent;
  if (tris().length !== 3 || !cap.includes('3 left')) throw new Error('the cube did not take three taps: ' + cap);`;
VIEWS.welcome = { js: `${q('#settings-open')} ${nap} ${q('#welcome-again')} ${nap}
  if (!document.querySelector('#welcome').open) throw new Error('Show the welcome again did not open it');
  if (document.querySelector('#settings').open) throw new Error('Settings stayed open under the welcome');
  ${TAP3}` };
// A first visit: a fresh profile (storage cleared, never marked welcomed)
// opens on the card by itself, over an empty drawing.
const SILLY = /^([A-Z])[a-z]+ \1[a-z]+$/;
VIEWS['welcome-first'] = { fresh: true, js: `if (!document.querySelector('#welcome').open) throw new Error('a first visit did not open the welcome');
  if (!${SILLY}.test(window.isopix.drawingName)) throw new Error('the first drawing has no silly name: ' + window.isopix.drawingName);
  ${TAP3}` };
// The loading screen, shown again over the app: mid-sweep, and after 10 s.
const LOADING = (p, slow) => `const l = document.getElementById('loading'), s = l.querySelector('.loading-sweep');
  l.className = 'loading${slow ? ' slow' : ''}'; l.hidden = false; l.querySelector('.loading-slow').hidden = ${!slow};
  for (const e of [s, l.querySelector('.loading-bar')]) { e.style.animation = 'none'; e.style.opacity = '1'; }
  s.style.setProperty('--p', '${p}');
  if (getComputedStyle(l).display === 'none') throw new Error('the loading screen did not show');`;
VIEWS.loading = { js: LOADING('220deg', false) };
VIEWS['loading-slow'] = { js: LOADING('324deg', true) };
// The Drawing sheet after 🎲: a different silly name, in the field too.
VIEWS['name-roll'] = { js: `${q('#drawing-open')} ${nap}
  const before = window.isopix.drawingName; ${q('#name-roll')} ${nap}
  const after = window.isopix.drawingName;
  if (after === before || !${SILLY}.test(after) || document.querySelector('#drawing-name').value !== after) throw new Error('🎲 gave ' + after + ' after ' + before);` };
VIEWS.help = { js: `document.dispatchEvent(new KeyboardEvent('keydown', { key: '?', bubbles: true }));
  if (!document.querySelector('#help').open) throw new Error('? did not open Help');` };
VIEWS.protect = { js: `${PROTECT} window.isopix.settings.locked = false;` };
VIEWS.hoverskip = { js: `${PROTECT}
  document.querySelector('#protect-close').click();
  f('pointermove', x + 12, y + 3, 0);
  if (!window.isopix.ghostSkip) throw new Error('the hover preview shows no skipped cells');
  window.isopix.settings.locked = false;` };

// Move mode: the hand on the zoom rail makes one finger pan and draw nothing;
// tapping a tool draws again.
VIEWS.move = { js: `${DRAW} const a = window.isopix, n = a.drawing.cells.size, cx = a.view.cx;
  ${q('#move-mode')} if (!a.moveMode) throw new Error('the hand did not turn Move on');
  fire('pointerdown', w * 0.5, h * 0.5, 7); for (let i = 1; i <= 6; i++) fire('pointermove', w * 0.5 - i * 20, h * 0.5, 7); fire('pointerup', w * 0.5 - 120, h * 0.5, 7);
  if (a.drawing.cells.size !== n) throw new Error('a drag in Move mode drew cells');
  if (!(a.view.cx > cx)) throw new Error('a drag in Move mode did not move the view');
  ${q('[data-tool="pencil"]')} if (a.moveMode) throw new Error('tapping a tool left Move on');
  ${q('#move-mode')}` };
// Two fingers: a first finger held still is not a stroke, and the finger left
// after the pinch pans instead of drawing.
VIEWS.pinchpan = { js: `${q('[data-tool="pencil"]')} const a = window.isopix, c = document.querySelector('#stage');
  const f = (type, x, y, id) => c.dispatchEvent(new PointerEvent(type, { clientX: x, clientY: y, pointerId: id, pointerType: 'touch', isPrimary: id === 11, bubbles: true, button: 0, buttons: type === 'pointerup' ? 0 : 1 }));
  const x = innerWidth * 0.5, y = innerHeight * 0.45;
  f('pointerdown', x, y, 11); await new Promise((r) => setTimeout(r, 650)); f('pointermove', x + 3, y, 11);
  f('pointerdown', x + 80, y, 12); f('pointermove', x + 100, y, 12); f('pointerup', x + 100, y, 12);
  const cx = a.view.cx; for (let i = 1; i <= 5; i++) f('pointermove', x + 3 + i * 20, y, 11); f('pointerup', x + 103, y, 11);
  if (a.drawing.cells.size) throw new Error('two fingers left ' + a.drawing.cells.size + ' cells drawn');
  if (!(a.view.cx < cx)) throw new Error('the finger left after a pinch did not pan');` };
// Save file with the browser's Save dialog (stubbed: headless has no dialog):
// the first Save asks, the next writes the same file, and the dot follows
// changes, but only once there is a file (never before the first save).
VIEWS['save-file'] = { js: `window.isopix.file = { name: null, at: null, via: null, dirty: false, handle: null }; // each width starts with no file
  ${DRAW} const a = window.isopix; let asked = 0, writes = 0;
  const handle = { name: 'look.isopix.png', queryPermission: async () => 'granted', createWritable: async () => ({ write: async () => { writes++; }, close: async () => {} }) };
  window.showSaveFilePicker = async () => { asked++; return handle; };
  const dot = () => document.querySelector('#file-save').classList.contains('unsaved');
  ${q('#drawing-open')} if (dot()) throw new Error('a Save dot before the drawing was ever saved to a file');
  ${q('#file-save')} await new Promise((r) => setTimeout(r, 100));
  if (asked !== 1 || writes !== 1 || dot()) throw new Error('first Save: asked ' + asked + ', wrote ' + writes + ', dot ' + dot());
  ${q('#file-save')} await new Promise((r) => setTimeout(r, 100));
  if (asked !== 1 || writes !== 2) throw new Error('second Save asked again or did not write: asked ' + asked + ', wrote ' + writes);
  if (document.querySelector('#file-saveas').hidden) throw new Error('Save as new file is hidden with a file to write to');
  document.querySelector('#drawing').close(); { ${DRAW} }
  if (!dot()) throw new Error('no dot after a change');
  ${q('#drawing-open')} if (!/Changed since/.test(document.querySelector('#file-status').textContent)) throw new Error('file line: ' + document.querySelector('#file-status').textContent);` };

function usage(msg) {
  if (msg) console.error(`❌ ${msg}`);
  // Built from VIEWS, so the list cannot fall behind the views (test/docs.test.mjs reads it).
  console.error(`usage: just look [${Object.keys(VIEWS).join('|')} ...] [--js CODE] [--url URL] [--out DIR] [--widths 320,375] [--height PX] [--light|--dark]`);
  process.exit(msg ? 2 : 0);
}
const opts = { screens: [], widths: [320, 375, 700, 900, 1100], js: '', url: null, out: null, height: 800, scheme: null };
const argv = process.argv.slice(2);
for (let i = 0; i < argv.length; i++) {
  const a = argv[i];
  if (a === '--help' || a === '-h') usage();
  else if (a === '--js') opts.js = argv[++i];
  else if (a === '--url') opts.url = argv[++i];
  else if (a === '--out') opts.out = argv[++i];
  else if (a === '--height') opts.height = Number(argv[++i]);
  else if (a === '--widths') opts.widths = argv[++i].split(',').map(Number);
  else if (a === '--light' || a === '--dark') opts.scheme = a.slice(2);
  else if (VIEWS[a]) opts.screens.push(a);
  else usage(`unknown argument: ${a}`);
}
if (!opts.screens.length) opts.screens = ['draw'];

const children = [];
process.on('exit', () => { for (const c of children) try { c.kill(); } catch { /* gone */ } });
process.on('SIGINT', () => process.exit(130));

let base = opts.url;
const liveFile = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'look-live-')), 'version.json');
const setLive = (v) => fs.writeFileSync(liveFile, v ? JSON.stringify({ version: v, date: 'look' }) : JSON.stringify({ version: 'dev' }));
setLive(null);
if (!base) {
  const port = await freePort();
  children.push(spawn('python3', [path.join(ROOT, 'tools/serve.py'), String(port), '--quiet'], { stdio: 'ignore', env: { ...process.env, ISOPIX_LIVE_VERSION: liveFile } }));
  base = `http://localhost:${port}/`;
  await waitFor('the dev server', async () => (await fetch(base)).ok);
}

const chrome = await launchChrome();
const { send, listeners } = await connect(await chrome.page());
const evaluate = (expression) => evaluateIn(send, expression);
let errors = [], csp = [], logs = [];
listeners.push((m) => {
  if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'log') logs.push(m.params.args.map((a) => a.value ?? a.description ?? '').join(' '));
  else if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error') errors.push(m.params.args.map((a) => a.value ?? a.description ?? '').join(' '));
  else if (m.method === 'Runtime.exceptionThrown') { const d = m.params.exceptionDetails; errors.push(d.exception?.description?.split('\n')[0] || d.text); }
  else if (m.method === 'Log.entryAdded' && m.params.entry.level === 'error') {
    const { text, url } = m.params.entry;
    if (/Content Security Policy/i.test(text)) csp.push(text); else errors.push(`${text}${url ? ` (${url})` : ''}`);
  }
});
await send('Page.enable');
await skipWelcome(send);
await send('Runtime.enable');
await send('Log.enable');
// Without --light or --dark, Chrome follows this Mac's appearance.
if (opts.scheme) await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: opts.scheme }] });

const MEASURE = (width) => `(() => {
  const reachable = (el) => {
    if (el.closest('[hidden], [inert], [aria-hidden="true"], dialog:not([open])')) return false;
    if (!el.getClientRects().length) return false;
    const s = getComputedStyle(el);
    return s.visibility !== 'hidden' && Number(s.opacity) > 0 && s.pointerEvents !== 'none';
  };
  const name = (el) => el.id ? '#' + el.id : JSON.stringify(el.getAttribute('aria-label') || el.textContent.trim().slice(0, 24) || el.className);
  const small = [], boxes = [];
  let checked = 0;
  const scope = [...document.querySelectorAll('dialog[open]')].at(-1) || document;
  for (const el of scope.querySelectorAll('button, [role="button"], [role="slider"], select, input[type="range"], input[type="checkbox"], input[type="radio"], label.swatch')) {
    if (!reachable(el)) continue;
    const box = el.matches('input[type="checkbox"], input[type="radio"]') ? (el.closest('label') || el) : el;
    checked++;
    const r = box.getBoundingClientRect();
    const miss = [];
    if (r.height < ${MIN_TAP} - 0.5) miss.push(Math.round(r.height) + 'px tall');
    if (r.width < ${MIN_TAP} - 0.5) miss.push(Math.round(r.width) + 'px wide');
    if (miss.length) small.push(name(box) + ' ' + miss.join(' '));
    // Clip to scrolling parents (the palette row scrolls sideways inside itself).
    let v = { left: r.left, top: r.top, right: r.right, bottom: r.bottom };
    for (let e = box.parentElement; e; e = e.parentElement) {
      const cs = getComputedStyle(e);
      if (cs.overflowX === 'visible' && cs.overflowY === 'visible') continue;
      const c = e.getBoundingClientRect();
      v = { left: Math.max(v.left, c.left), top: Math.max(v.top, c.top), right: Math.min(v.right, c.right), bottom: Math.min(v.bottom, c.bottom) };
    }
    if (v.right - v.left > 2 && v.bottom - v.top > 2) boxes.push([box, v]);
  }
  // A control pinned with position: sticky (the palette's add-color and auto-shade)
  // is meant to cover what scrolls under it in the same scroll box.
  const up = (el, test) => { for (let e = el.parentElement; e; e = e.parentElement) if (test(getComputedStyle(e))) return e; return null; };
  const pin = (el) => (getComputedStyle(el).position === 'sticky' ? el : up(el, (cs) => cs.position === 'sticky'));
  const scroller = (el) => up(el, (cs) => /auto|scroll/.test(cs.overflowX + cs.overflowY));
  const pinnedOver = (a, b) => !!pin(a) !== !!pin(b) && scroller(a) && scroller(a) === scroller(b);
  // Two SVG shapes (the welcome cube's triangles) can share a box and not
  // touch: they overlap only if one sampled point of the shared box lies in both.
  const inFill = (el, px, py) => { const m = el.getScreenCTM(); if (!m) return false;
    const p = new DOMPoint(px, py).matrixTransform(m.inverse()); return el.isPointInFill(p); };
  const shapesApart = (a, b, ra, rb) => {
    if (!(a instanceof SVGGeometryElement && b instanceof SVGGeometryElement)) return false;
    const l = Math.max(ra.left, rb.left), r = Math.min(ra.right, rb.right), t = Math.max(ra.top, rb.top), btm = Math.min(ra.bottom, rb.bottom);
    for (let i = 0; i < 8; i++) for (let j = 0; j < 8; j++) {
      // Uneven offsets, so no sample lands on an edge two shapes share (a box diagonal).
      const px = l + (r - l) * (i + 0.37) / 8, py = t + (btm - t) * (j + 0.61) / 8;
      if (inFill(a, px, py) && inFill(b, px, py)) return false;
    }
    return true;
  };
  const overlaps = [];
  for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) {
    const [a, ra] = boxes[i], [b, rb] = boxes[j];
    if (a.contains(b) || b.contains(a) || pinnedOver(a, b)) continue;
    const x = Math.min(ra.right, rb.right) - Math.max(ra.left, rb.left);
    const y = Math.min(ra.bottom, rb.bottom) - Math.max(ra.top, rb.top);
    if (x > 2 && y > 2 && !shapesApart(a, b, ra, rb)) overlaps.push(name(a) + ' ↔ ' + name(b) + ' (' + Math.round(Math.min(x, y)) + 'px)');
  }
  return {
    sideways: Math.max(document.documentElement.scrollWidth, innerWidth) > ${width},
    scrollWidth: Math.max(document.documentElement.scrollWidth, innerWidth),
    small, overlaps, checked,
    dialogSideways: [...document.querySelectorAll('dialog[open]')].filter((d) => d.scrollWidth > d.clientWidth).map((d) => '#' + d.id),
  };
})()`;

const out = opts.out ? path.resolve(opts.out) : fs.mkdtempSync(path.join(os.tmpdir(), 'look-'));
fs.mkdirSync(out, { recursive: true });
const rows = [];
for (const screen of opts.screens) {
  for (const w of opts.widths) {
    errors = []; csp = []; logs = [];
    await send('Emulation.setDeviceMetricsOverride', { width: w, height: opts.height, deviceScaleFactor: 1, mobile: w < 768 });
    // A fresh view first leaves the last page, which saves as it goes and would
    // undo the clear. It comes before `loaded`, so about:blank's load does not count.
    if (VIEWS[screen].fresh) {
      await send('Page.navigate', { url: 'about:blank' }); await sleep(300);
      await send('Storage.clearDataForOrigin', { origin: new URL(base).origin, storageTypes: 'all' });
    }
    const loaded = new Promise((r) => listeners.push(function once(m) {
      if (m.method === 'Page.loadEventFired') { listeners.splice(listeners.indexOf(once), 1); r(); }
    }));
    const live = VIEWS[screen].live;
    setLive(live ? live[0] : null);
    await send('Page.navigate', { url: `${base}?look=${screen}-${w}` });
    await loaded;
    await sleep(500);
    // The loading screen finishes its turn and fades once the app is ready.
    await waitFor('the loading screen to go', () => evaluate(`document.getElementById('loading')?.hidden !== false`), 8000).catch(() => {});
    if (live) setLive(live[1]);
    const row = { screen, w, extra: [] };
    try {
      // Each width starts from a blank drawing, not the last width's autosave.
      if (!VIEWS[screen].fresh) await evaluate(`(async () => { const a = window.isopix; a.drawing.clear(); a.selection = null; })()`);
      if (VIEWS[screen].js) await evaluate(`(async () => { ${VIEWS[screen].js} })()`);
      if (opts.js) await evaluate(`(async () => { ${opts.js} })()`);
    } catch (err) { row.extra.push(`script failed: ${err.message.split('\n')[0]}`); }
    await sleep(400);
    const m = await evaluate(MEASURE(w));
    const shot = path.join(out, `${screen}-${w}.png`);
    const r = await send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(shot, Buffer.from(r.data, 'base64'));
    Object.assign(row, m, { errors: [...new Set(errors)], csp: [...new Set(csp)], logs: [...logs], shot });
    for (const d of m.dialogSideways) row.extra.push(`${d} scrolls sideways`);
    for (const o of m.overlaps) row.extra.push(`overlap: ${o}`);
    if (!m.checked) row.extra.push('no buttons found: the page did not render');
    row.ok = !m.sideways && !row.errors.length && !row.csp.length && !m.small.length && !row.extra.length;
    rows.push(row);
  }
}

const pad = (s, n) => String(s).padEnd(n);
const VW = Math.max(11, ...opts.screens.map((v) => v.length + 2)); // the view column fits the longest name
console.log(`${pad('view', VW)}${pad('width', 6)}${pad('sideways', 10)}${pad('errors', 7)}${pad('csp', 5)}${pad('<44px', 6)}${pad('controls', 9)}result`);
for (const r of rows) {
  console.log(pad(r.screen, VW) + pad(r.w, 6) + pad(r.sideways ? `yes ${r.scrollWidth}` : 'no', 10)
    + pad(r.errors.length, 7) + pad(r.csp.length, 5) + pad(r.small.length, 6) + pad(r.checked, 9) + (r.ok ? '✅' : '❌'));
}
for (const r of rows.filter((x) => !x.ok)) {
  console.log(`\n${r.screen} @ ${r.w}px:`);
  for (const e of r.extra) console.log(`  ⚠️  ${e}`);
  if (r.sideways) console.log(`  ↔️  page is ${r.scrollWidth}px wide in a ${r.w}px window`);
  for (const e of r.errors) console.log(`  💥 ${e}`);
  for (const e of r.csp) console.log(`  🚫 ${e}`);
  if (r.small.length) console.log(`  👆 under ${MIN_TAP}px: ${r.small.join(', ')}`);
}
for (const r of rows.filter((x) => x.logs?.length)) for (const l of r.logs) console.log(`📝 ${r.screen} ${r.w}: ${l}`);
console.log(`\n📸 screenshots: ${out}`);
process.exit(rows.every((r) => r.ok) ? 0 : 1);
