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
//   node tools/look.mjs [VIEW ...] [--all] [--js CODE] [--url URL] [--out DIR] [--widths 320,375] [--height PX] [--light|--dark]
//   views: draw (default) drawn settings settings-open-all drawing-sheet drawing-new brushes select selmore rail update updatesel protect hoverskip help move pinchpan save-file welcome welcome-first name-roll loading loading-slow replay
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
// A mouse tap on the canvas at screen (x, y): places a stamp or a one-cell brush.
const TAP = (x, y) => `{ const c = document.querySelector('#stage'); const f = (t) => c.dispatchEvent(new PointerEvent(t, { clientX: ${x}, clientY: ${y}, pointerId: 7, pointerType: 'mouse', isPrimary: true, bubbles: true, button: 0, buttons: t === 'pointerup' ? 0 : 1 })); f('pointerdown'); f('pointerup'); }`;
// A small drawing made through the real pointer handlers.
const DRAW = `
  document.querySelector('[data-tool="pencil"]').click();
  const c = document.querySelector('#stage');
  const fire = (type, x, y, id = 1) => c.dispatchEvent(new PointerEvent(type, { clientX: x, clientY: y, pointerId: id, pointerType: 'touch', isPrimary: true, bubbles: true, button: 0, buttons: type === 'pointerup' ? 0 : 1 }));
  const w = innerWidth, h = innerHeight;
  fire('pointerdown', w * 0.3, h * 0.35); for (let i = 1; i <= 10; i++) fire('pointermove', w * (0.3 + i * 0.04), h * (0.35 + i * 0.01)); fire('pointerup', w * 0.7, h * 0.45);`;
const SETTLE = 'await new Promise((r) => setTimeout(r, 1100));'; // past the 800 ms autosave
// Three drawings made with the real New button; the last, open one has a long name.
const GALLERY = `{ ${DRAW} } ${SETTLE} ${q('#drawing-open')} ${q('#file-new')} ${SETTLE}
  { ${DRAW} } ${SETTLE} ${q('#drawing-open')} ${q('#file-new')} ${SETTLE} { ${DRAW} }
  const nm = document.querySelector('#drawing-name'); nm.value = 'Wobbly Woolly Whirligig Watermelon Wonderland'; nm.dispatchEvent(new Event('input', { bubbles: true }));
  ${SETTLE} ${q('#drawing-open')} await new Promise((r) => setTimeout(r, 300));
  const cards = document.querySelectorAll('#gallery .drawing-card');
  if (cards.length !== 3) throw new Error('Drawings shows ' + cards.length + ' cards, not 3');
  if (!cards[0].classList.contains('current')) throw new Error('the open drawing is not first and outlined');
  const long = cards[0].querySelector('.card-name'), px = parseFloat(long.style.fontSize);
  if (!(px >= 12 && px <= 15)) throw new Error('a long name is ' + px + ' px');
  if (long.scrollWidth > long.clientWidth && getComputedStyle(long).textOverflow !== 'ellipsis') throw new Error('a long name neither fits nor ends in an ellipsis');
  if ([...cards].some((c) => !c.querySelector('img'))) throw new Error('a drawing has no thumbnail');
  for (const n of document.querySelectorAll('#gallery .card-name')) if (n.scrollWidth > n.clientWidth && parseFloat(n.style.fontSize) > 12) throw new Error(n.textContent + ' ends in an ellipsis at ' + n.style.fontSize + ' before shrinking to 12 px');`;
const VIEWS = {
  // A long drawing name: the widest the top bar's Drawing button gets, so the
  // top-bar clearance check in MEASURE sees the worst case at every width.
  draw: { js: `const n = document.querySelector('#drawing-name'); n.value = 'Wobbly Woolly Whirligig Watermelon Wonderland';
    n.dispatchEvent(new Event('input', { bubbles: true }));` },
  drawn: { js: DRAW },
  settings: { js: q('#settings-open') },
  // Every Settings section open (heads that are shut get a click; the state is remembered).
  'settings-open-all': { js: `${q('#settings-open')} for (const h of document.querySelectorAll('#settings .set-head')) if (h.getAttribute('aria-expanded') !== 'true') h.click();` },
  'drawing-sheet': { js: q('#drawing-open') },
  // Usage events (web/events.js): a tool tap is a control.use with its toolbar and the
  // layout showing at this width, the brush popover a dialog, Settings a screen, a
  // setting its from and to, a key shortcut a control in group keys but letters typed in the name
  // field none; Share play data starts on and turning it off empties the queue.
  events: { js: `const ev = window.isopix.events; ev.clear();
    const recs = () => ev.queued().records.map((l) => JSON.parse(l));
    ${q('[data-tool="eraser"]')} ${q('#options')} document.querySelector('#popover [data-pick="hexagon"]').click();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'g', bubbles: true }));
    ${q('#drawing-open')} const name = document.querySelector('#drawing-name'); name.focus();
    for (const key of 'pelf') name.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }));
    document.querySelector('#drawing').close();
    ${q('#settings-open')} await new Promise((r) => setTimeout(r, 50)); document.querySelector('#opt-gray').click(); document.querySelector('#opt-gray').click();
    document.querySelector('#settings').close(); await new Promise((r) => setTimeout(r, 50));
    const got = recs().map((r) => r.event + ' ' + JSON.stringify(r.details));
    const row = getComputedStyle(document.querySelector('.bottom')).flexDirection === 'row' ? 'row' : 'stacked';
    const want = ['control.use {"control":"tool-eraser","group":"tools","layout":"' + row + '"', 'dialog.open {"dialog":"brush"}', 'dialog.close {"dialog":"brush","answer":"picked"',
      'screen.view {"from":"draw"}', 'setting.change {"key":"gray","from":false,"to":true}', 'screen.view {"from":"settings"}'];
    want.push('control.use {"control":"gutters","group":"keys"');
    for (const w of want) if (!got.some((g) => g.startsWith(w))) throw new Error('no ' + w + ' in ' + JSON.stringify(got));
    // Letters typed in the name field are not shortcuts (their counts would spell part of the name).
    if (got.some((g) => g.startsWith('control.use') && /"group":"keys"/.test(g) && /"control":"(tool-eraser|tool-line|tool-fill)"/.test(g))) throw new Error('typing a name recorded a shortcut: ' + JSON.stringify(got));
    if (!document.querySelector('#opt-usage').checked) throw new Error('Share play data should start on');
    if (got.some((g) => /"x"|"y"|clientX/.test(g))) throw new Error('a coordinate was recorded');
    if (recs().some((r, i, a) => r.seq !== a[0].seq + i || r.app !== 'isopix' || r.platform !== 'web' || !r.session || !r.player || !r.screen)) throw new Error('records out of order or missing columns');
    ${q('#settings-open')} document.querySelector('#opt-usage').click();
    const stored = () => Object.keys(localStorage).filter((k) => k.startsWith('events:isopix:'));
    if (recs().length || stored().length) throw new Error('switching usage off left ' + recs().length + ' records, ' + stored().length + ' stored');
    ${q('[data-tool="pencil"]')} if (recs().length) throw new Error('recorded with usage off');
    document.querySelector('#opt-usage').click(); document.querySelector('#settings').close();` },
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
  // New with something drawn adds a drawing: the old one stays in Drawings (web/ui/gallery.js).
  'drawing-new': { fresh: true, js: `${DRAW} ${SETTLE} const a = window.isopix, first = a.drawingId;
    ${q('#drawing-open')} ${q('#file-new')} ${SETTLE}
    if (a.drawing.cells.size || a.drawingId === first) throw new Error('New did not start an empty drawing');
    if (!a.gallery.some((e) => e.id === first)) throw new Error('New dropped the drawing it left');
    ${q('#drawing-open')} ${nap} const n = document.querySelectorAll('#gallery .drawing-card').length;
    if (n !== 2) throw new Error('Drawings shows ' + n + ' cards, not 2');` },
  // Need an idea? opens only when asked; 🎲 shows another; Draw this starts a new drawing named after it.
  idea: { fresh: true, js: `{ ${DRAW} } ${SETTLE} const a = window.isopix, first = a.drawingId; ${q('#drawing-open')} ${nap}
    if (!document.querySelector('#idea-box').hidden) throw new Error('the idea showed without being asked');
    ${q('#idea-show')} ${nap} const t = () => document.querySelector('#idea-text').textContent, one = t();
    if (!one) throw new Error('no idea shown'); ${q('#idea-roll')} if (t() === one) throw new Error('🎲 showed the same idea');
    const idea = t(); ${q('#idea-draw')} ${SETTLE}
    if (a.drawingId === first || a.drawing.cells.size) throw new Error('Draw this did not start a new drawing');
    if (a.drawingName.toLowerCase() !== idea.replace(/ \\(.*\\)$/, '').toLowerCase()) throw new Error('the new drawing is named ' + a.drawingName + ', not after ' + idea);
    if (!a.gallery.some((e) => e.id === first)) throw new Error('the drawing it left is gone');
    ${q('#drawing-open')} ${nap} ${q('#idea-show')}` },
  // Three drawings, one with a long name: it shrinks to 12 px at most, then ends in an ellipsis.
  gallery: { fresh: true, js: GALLERY },
  'gallery-menu': { fresh: true, js: `${GALLERY} document.querySelectorAll('#gallery .card-more')[1].click(); ${nap}
    if (document.querySelector('#card-menu').hidden) throw new Error('the ⋯ menu did not open');` },
  // Tap a drawing to open it; Make a copy adds one; Rename names another drawing without opening it.
  'gallery-ops': { fresh: true, js: `${GALLERY} const a = window.isopix, act = async (i, what) => { document.querySelectorAll('#gallery .card-more')[i].click(); ${nap}
      document.querySelector('#card-menu [data-act="' + what + '"]').click(); ${nap} };
    const second = document.querySelectorAll('#gallery .drawing-card')[1].dataset.id, secondName = a.gallery.find((e) => e.id === second).name;
    document.querySelectorAll('#gallery .card-open')[1].click(); ${SETTLE}
    if (a.drawingId !== second || a.drawingName !== secondName || !a.drawing.cells.size) throw new Error('tapping ' + secondName + ' opened ' + a.drawingName);
    ${q('#drawing-open')} ${nap} await act(0, 'copy'); ${SETTLE}
    if (document.querySelectorAll('#gallery .drawing-card').length !== 4) throw new Error('Make a copy did not add a drawing');
    if (!a.gallery.some((e) => e.name === secondName + ' copy')) throw new Error('the copy is not named ' + secondName + ' copy');
    const other = [...document.querySelectorAll('#gallery .drawing-card')].findIndex((c) => !c.classList.contains('current'));
    const otherId = document.querySelectorAll('#gallery .drawing-card')[other].dataset.id;
    await act(other, 'rename'); const rn = document.querySelector('#rename-name'); rn.value = 'Renamed Rhino';
    rn.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true })); ${SETTLE}
    if (a.gallery.find((e) => e.id === otherId).name !== 'Renamed Rhino' || a.drawingId !== second) throw new Error('Rename did not rename the other drawing in place');` },
  // Mid-lesson, Drawings shows the practice drawing as its own card (no ⋯); theirs stays as saved.
  'lesson-gallery': { fresh: true, js: `{ ${DRAW} } ${SETTLE} const a = window.isopix, mine = a.drawingId, name = a.drawingName;
    a.tour.start('basics'); ${nap} ${q('#drawing-open')} ${nap}
    const cards = [...document.querySelectorAll('#gallery .drawing-card')];
    const cur = cards.filter((c) => c.classList.contains('current'));
    if (cur.length !== 1 || cur[0].dataset.id !== 'practice' || cur[0].querySelector('.card-more')) throw new Error('the practice drawing is not its own card without ⋯');
    const theirs = cards.find((c) => c.dataset.id === mine);
    if (!theirs || theirs.classList.contains('current') || theirs.querySelector('.card-name').textContent !== name) throw new Error('their drawing does not show as saved');` },
  // Delete asks first; deleting one leaves two; the ask on a drawing in no file says it cannot come back.
  'gallery-delete': { fresh: true, js: `${GALLERY} const del = async (i) => { document.querySelectorAll('#gallery .card-more')[i].click(); ${nap}
      document.querySelector('#card-menu [data-act="delete"]').click(); ${nap} };
    await del(2); const d = document.querySelector('#delete-confirm');
    if (!d.open) throw new Error('Delete did not ask first');
    d.close('delete'); ${SETTLE}
    const n = document.querySelectorAll('#gallery .drawing-card').length;
    if (n !== 2) throw new Error(n + ' cards after a delete, not 2');
    await del(1);
    if (!/cannot come back/.test(document.querySelector('#delete-says').textContent)) throw new Error('the ask does not say it cannot come back');` },
  brushes: { js: q('[data-tool="pencil"]') + q('#options') },
  select: { js: `${DRAW} ${q('[data-tool="select"]')} ${nap}
    const c2 = document.querySelector('#stage');
    const f = (type, x, y) => c2.dispatchEvent(new PointerEvent(type, { clientX: x, clientY: y, pointerId: 2, pointerType: 'mouse', isPrimary: true, bubbles: true, button: 0, buttons: type === 'pointerup' ? 0 : 1 }));
    f('pointerdown', innerWidth * 0.5, innerHeight * 0.4); f('pointermove', innerWidth * 0.5 + 90, innerHeight * 0.4 + 20); f('pointerup', innerWidth * 0.5 + 90, innerHeight * 0.4 + 20);` },
};
// When the replay ends: Done playing · Watch again · Save video · ✕, wrapping rather than running off a phone.
VIEWS['replay-end'] = { js: `${DRAW} const a = window.isopix; ${q('#drawing-open')} ${q('#file-replay')}
  for (let i = 0; i < 100 && document.querySelector('#replay-bar').dataset.mode !== 'ended'; i++) await new Promise((r) => setTimeout(r, 100));
  const bar = document.querySelector('#replay-bar');
  if (bar.dataset.mode !== 'ended') throw new Error('the replay did not end in Done playing: ' + bar.dataset.mode);
  for (const id of ['#replay-again', '#replay-video', '#replay-close']) if (document.querySelector(id).hidden) throw new Error(id + ' is not shown');
  const r = bar.getBoundingClientRect(); if (r.left < 0 || r.right > innerWidth) throw new Error('the bar runs off the screen: ' + Math.round(r.left) + '..' + Math.round(r.right));` };
// Save video makes the time-lapse (MediaRecorder), then offers Save video.
VIEWS.video = { js: `${DRAW} ${q('#drawing-open')} ${nap}
  if (document.querySelector('#file-video').hidden) throw new Error('Save it as a video is not on the sheet');
  ${q('#file-video')} ${nap}
  const bar = document.querySelector('#replay-bar');
  if (bar.dataset.mode !== 'making') throw new Error('Save it as a video did not start making it: ' + bar.dataset.mode);
  for (let i = 0; i < 150 && bar.dataset.mode === 'making'; i++) await new Promise((r) => setTimeout(r, 100));
  if (bar.dataset.mode !== 'ready') throw new Error('the video did not become ready: ' + bar.dataset.mode + ' ' + document.querySelector('#replay-say').textContent);` };
// The selection with ⋯ More open, and the level rail held open by a finger.
VIEWS.selmore = { js: `${VIEWS.select.js} ${nap} ${q('#sel-more')}` };
// Light from the right, then Relight: the right faces take the base color (the mid tone).
VIEWS.light = { js: `const a = window.isopix; a.settings.shading = true; ${q('[data-tool="pencil"]')}
  window.isopix.settings.brush = 'hexagon'; ${TAP('innerWidth * 0.5', 'innerHeight * 0.4')} ${nap}
  const base = a.settings.color, right = () => [...a.drawing.cells.values()].filter((v) => v.f === 'R');
  if (!right().length || right().some((v) => v.c === base)) throw new Error('no darker right faces to start with');
  ${q('#settings-open')} ${nap} ${q('#light-flip')} document.querySelector('#settings').close(); ${nap}
  if (a.drawing.light !== 'right') throw new Error('Light from did not switch');
  ${q('[data-tool="select"]')} ${nap}
  const c2 = document.querySelector('#stage');
  const f = (type, x, y) => c2.dispatchEvent(new PointerEvent(type, { clientX: x, clientY: y, pointerId: 2, pointerType: 'mouse', isPrimary: true, bubbles: true, button: 0, buttons: type === 'pointerup' ? 0 : 1 }));
  f('pointerdown', innerWidth * 0.5, innerHeight * 0.4); f('pointermove', innerWidth * 0.5 + 120, innerHeight * 0.4 + 20); f('pointerup', innerWidth * 0.5 + 120, innerHeight * 0.4 + 20); ${nap}
  ${q('#sel-more')} ${nap} ${q('#sel-relight')} ${nap}
  if (right().some((v) => v.c !== base)) throw new Error('after Relight the right faces are not the base color');` };
// Two fingers tapped together undo a stroke, three redo it; the view stays where it was.
VIEWS.taps = { js: `{ ${DRAW} } const a = window.isopix, drawn = a.drawing.cells.size, view = [a.view.zoom, a.view.cx, a.view.cy].join();
  const c = document.querySelector('#stage');
  const touch = (t, id, x, y) => c.dispatchEvent(new PointerEvent(t, { clientX: x, clientY: y, pointerId: id, pointerType: 'touch', isPrimary: id === 11, bubbles: true, button: 0, buttons: t === 'pointerup' ? 0 : 1 }));
  const tap = async (n) => { for (let i = 0; i < n; i++) touch('pointerdown', 11 + i, 150 + i * 60, 300); await new Promise((r) => setTimeout(r, 60));
    for (let i = 0; i < n; i++) touch('pointerup', 11 + i, 150 + i * 60 + 2, 301); await new Promise((r) => setTimeout(r, 80)); };
  if (!drawn) throw new Error('nothing drawn');
  await tap(2); if (a.drawing.cells.size !== 0) throw new Error('a two-finger tap did not undo: ' + a.drawing.cells.size + ' cells');
  if ([a.view.zoom, a.view.cx, a.view.cy].join() !== view) throw new Error('the tap moved the view');
  await tap(3); if (a.drawing.cells.size !== drawn) throw new Error('a three-finger tap did not redo');
  // A slow two-finger hold is a pinch or pan, not a tap.
  touch('pointerdown', 21, 150, 300); touch('pointerdown', 22, 210, 300); await new Promise((r) => setTimeout(r, 450));
  touch('pointerup', 21, 150, 300); touch('pointerup', 22, 210, 300);
  if (a.drawing.cells.size !== drawn) throw new Error('a slow two-finger hold undid');` };
// Turn six times gives the drawing back exactly; Flip changes it (the selection bar's More open).
VIEWS.selturn = { js: `window.isopix.settings.brush = 'triangle'; // a lone-triangle stroke: no turn leaves it as it was
  ${VIEWS.select.js} ${nap} ${q('#sel-more')} ${nap}
  const a = window.isopix, snap = () => JSON.stringify([...a.drawing.cells].map(([k, v]) => [k, v.c, v.f || null]).sort());
  const start = snap(); if (!a.drawing.cells.size) throw new Error('nothing drawn to turn');
  ${q('#sel-turn')} ${nap} if (snap() === start) throw new Error('Turn changed nothing');
  for (let i = 0; i < 5; i++) { ${q('#sel-turn')} } ${nap}
  if (snap() !== start) throw new Error('six turns did not give the drawing back');
  ${q('#sel-flip')} ${nap} if (snap() === start) throw new Error('Flip changed nothing');` };
// Stamp in the brush picker opens Stamps; the eight starter tiles; House, then a tap places it.
VIEWS.stamps = { fresh: true, js: `${q('[data-tool="pencil"]')} ${q('#options')} document.querySelector('#popover [data-pick="stamp"]').click(); ${nap}
  if (!document.querySelector('#stamps').open) throw new Error('Stamp did not open Stamps');
  const tiles = [...document.querySelectorAll('#stamps-grid .stamp-tile')];
  if (tiles.map((t) => t.textContent).join() !== 'Cube,Stairs,House,Tree,Wall,Pyramid,Flower,Star') throw new Error('the starter tiles are ' + tiles.map((t) => t.textContent));
  if (tiles.some((t) => !t.querySelector('img').src.startsWith('data:image/'))) throw new Error('a tile has no picture');
  tiles[2].click(); ${nap}
  if (document.querySelector('#stamps').open || window.isopix.settings.brush !== 'stamp') throw new Error('picking House did not close Stamps and pick the Stamp brush');
  ${TAP('innerWidth * 0.5', 'innerHeight * 0.45')} ${nap}
  const n = window.isopix.drawing.cells.size;
  if (n !== 88) throw new Error('a tap placed ' + n + ' cells, not 88 (the House)');
  ${q('#options')} document.querySelector('#popover [data-pick="stamp"]').click(); ${nap}` };
// A stamp of one's own goes in Mine and stays there in a new drawing.
VIEWS['stamps-mine'] = { fresh: true, js: `${VIEWS.select.js} ${nap} ${q('#sel-stamp')} ${nap}
  ${q('#drawing-open')} ${q('#file-new')} await new Promise((r) => setTimeout(r, 1100));
  ${q('[data-tool="pencil"]')} ${q('#options')} document.querySelector('#popover [data-pick="stamp"]').click(); ${nap}
  if (document.querySelector('#stamps-mine').getAttribute('aria-selected') !== 'true') throw new Error('Stamps did not open on Mine');
  ${q('#stamps-mine')} ${nap}
  const mine = [...document.querySelectorAll('#stamps-grid .stamp-tile')].map((t) => t.textContent);
  if (mine.join() !== 'Stamp 1') throw new Error('Mine in a new drawing shows ' + JSON.stringify(mine));` };
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
// A replay in progress: its bar sits above the palette and tools, clear of everything.
VIEWS.replay = { js: `${DRAW} document.querySelector('#replay').click(); ${nap}
  if (document.querySelector('#replay-bar').hidden) throw new Error('the replay bar did not appear');` };
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
// The welcome card: from the bottom of Settings; Show me around starts Basics in a practice drawing.
const TOUR = `if (!document.querySelector('#welcome-tour')) throw new Error('the card has no Show me around');`;
VIEWS.welcome = { js: `${q('#settings-open')} ${nap} ${q('#welcome-again')} ${nap}
  if (!document.querySelector('#welcome').open) throw new Error('Show the welcome again did not open it');
  if (document.querySelector('#settings').open) throw new Error('Settings stayed open under the welcome');
  ${TOUR}` };
// A first visit: a fresh profile (storage cleared, never marked welcomed)
// opens on the card by itself, over an empty drawing.
const SILLY = /^([A-Z])[a-z]+ \1[a-z]+$/;
VIEWS['welcome-first'] = { fresh: true, js: `if (!document.querySelector('#welcome').open) throw new Error('a first visit did not open the welcome');
  if (!${SILLY}.test(window.isopix.drawingName)) throw new Error('the first drawing has no silly name: ' + window.isopix.drawingName);
  ${TOUR}` };
// Lessons (web/lessons.js, web/tour.js). A stroke on the paper, through the real handlers.
const STROKE = `const st = document.querySelector('#stage');
  const fp = (type, x, y) => st.dispatchEvent(new PointerEvent(type, { clientX: x, clientY: y, pointerId: 7, pointerType: 'touch', isPrimary: true, bubbles: true, button: 0, buttons: type === 'pointerup' ? 0 : 1 }));
  const stroke = async (x, y) => { fp('pointerdown', x, y); for (let i = 1; i <= 8; i++) fp('pointermove', x + i * 9, y + i * 3); fp('pointerup', x + 72, y + 24); await new Promise((r) => setTimeout(r, 120)); };`;
const STEP = `const tour = () => window.isopix.tour.state(); const say = () => document.querySelector('#tour .tour-say').textContent;
  const at = (i) => { if (tour()?.index !== i) throw new Error('lesson at step ' + (tour()?.index) + ', not ' + i + ': ' + say()); };`;
// Show me around: Basics starts in a practice drawing; a stroke moves it to the cube step.
VIEWS.lesson = { js: `${q('#settings-open')} ${nap} ${q('#welcome-again')} ${nap} ${q('#welcome-tour')} ${nap} ${STROKE} ${STEP}
  if (window.isopix.drawingName !== 'Practice') throw new Error('not a practice drawing: ' + window.isopix.drawingName);
  at(0); await stroke(innerWidth * 0.4, innerHeight * 0.4); at(1);
  if (window.isopix.settings.brush !== 'hexagon') throw new Error('the cube step did not pick the Hexagon brush');
  if (!document.querySelector('#options').classList.contains('tour-target')) throw new Error('the cube step does not point at the shapes button');` };
// All of Basics over a drawing of one's own: Back to my drawing gives it back
// untouched; a second run, kept, asks first (that drawing is in no file).
VIEWS['lesson-end'] = { js: `${DRAW} ${STROKE} ${STEP} const a = window.isopix; const mine = a.drawing.cells.size, name = a.drawingName;
  const run = async () => {
    a.tour.start('basics'); await new Promise((r) => setTimeout(r, 150)); at(0);
    await stroke(innerWidth * 0.4, innerHeight * 0.45); at(1);
    await stroke(innerWidth * 0.5, innerHeight * 0.5); at(2);
    document.querySelector('#notches .notch[data-n="1"]').dispatchEvent(new MouseEvent('click', { bubbles: true, detail: 0 }));
    await stroke(innerWidth * 0.45, innerHeight * 0.55); at(3);
    ${q('#undo')} at(4); ${q('#redo')} at(5); ${q('#zoom-in')} at(6); ${q('#fit-view')}
    await new Promise((r) => setTimeout(r, 150));
    if (!tour()?.ending) throw new Error('Basics did not end: ' + say());
  };
  await run();
  const btn = (t) => [...document.querySelectorAll('#tour button')].find((b) => b.textContent === t);
  btn('Back to my drawing').click(); await new Promise((r) => setTimeout(r, 150));
  if (a.drawing.cells.size !== mine || a.drawingName !== name) throw new Error('Back did not bring the drawing back: ' + a.drawing.cells.size + ' cells, ' + a.drawingName);
  if (a.tour.active()) throw new Error('the lesson is still on');
  // Keep it adds the practice drawing as another drawing; theirs stays in Drawings, as it was.
  const mineId = a.drawingId;
  await run(); const practice = a.drawing.cells.size;
  btn('Keep it').click(); await new Promise((r) => setTimeout(r, 600));
  if (a.drawing.cells.size !== practice || a.drawingName === 'Practice' || a.tour.active()) throw new Error('Keep it did not keep the practice drawing');
  if (a.drawingId === mineId || !a.gallery.some((e) => e.id === mineId && e.name === name)) throw new Error('Keep it took the place of their drawing');` };
// Help lists the lessons first, each folded with its step count and Start inside.
VIEWS['help-lessons'] = { js: `${q('#settings-open')} ${nap} ${q('#settings-help')} ${nap}
  const head = document.querySelector('#help-body .set-head[aria-controls="lesson-basics"]');
  if (!head) throw new Error('Help has no Basics lesson'); if (head.getAttribute('aria-expanded') !== 'true') head.click(); // folds are remembered
  if (!document.querySelector('[data-lesson="basics"]').getClientRects().length) throw new Error('Start Basics is not shown');` };
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
// Save drawing with the browser's Save dialog (stubbed: headless has no dialog):
// the first Save asks, the next writes the same file, and the dot follows
// changes, but only once there is a file (never before the first save).
VIEWS['save-file'] = { js: `window.isopix.file = { name: null, at: null, via: null, dirty: false, handle: null }; // each width starts with no file
  ${DRAW} const a = window.isopix; let asked = 0, writes = 0;
  const handle = { name: 'look.isopix.png', queryPermission: async () => 'granted', createWritable: async () => ({ write: async () => { writes++; }, close: async () => {} }) };
  window.showSaveFilePicker = async () => { asked++; return handle; };
  const dot = () => document.querySelector('#file-save').classList.contains('unsaved');
  // Save makes a PNG with the drawing inside, which takes longer on a busy machine: wait for the write, up to 3 s.
  const wrote = async (n) => { for (let i = 0; i < 60 && writes < n; i++) await new Promise((r) => setTimeout(r, 50)); await new Promise((r) => setTimeout(r, 50)); };
  ${q('#drawing-open')} if (dot()) throw new Error('a Save dot before the drawing was ever saved to a file');
  ${q('#file-save')} await wrote(1);
  if (asked !== 1 || writes !== 1 || dot()) throw new Error('first Save: asked ' + asked + ', wrote ' + writes + ', dot ' + dot());
  ${q('#file-save')} await wrote(2);
  if (asked !== 1 || writes !== 2) throw new Error('second Save asked again or did not write: asked ' + asked + ', wrote ' + writes);
  if (document.querySelector('#file-saveas').hidden) throw new Error('Save a copy is hidden with a file to write to');
  document.querySelector('#drawing').close(); { ${DRAW} }
  if (!dot()) throw new Error('no dot after a change');
  ${q('#drawing-open')} if (!/Changed since/.test(document.querySelector('#file-status').textContent)) throw new Error('file line: ' + document.querySelector('#file-status').textContent);` };

function usage(msg) {
  if (msg) console.error(`❌ ${msg}`);
  // Built from VIEWS, so the list cannot fall behind the views (test/docs.test.mjs reads it).
  console.error(`usage: just look [${Object.keys(VIEWS).join('|')} ...] [--all] [--js CODE] [--url URL] [--out DIR] [--widths 320,375] [--height PX] [--light|--dark]`);
  process.exit(msg ? 2 : 0);
}
const opts = { screens: [], widths: [320, 375, 700, 900, 1100], js: '', url: null, out: null, height: 800, scheme: null };
const argv = process.argv.slice(2);
for (let i = 0; i < argv.length; i++) {
  const a = argv[i];
  if (a === '--help' || a === '-h') usage();
  else if (a === '--all') opts.screens.push(...Object.keys(VIEWS)); // every view, as CI runs it
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
  // An open menu (the ⋯ on a drawing, role="menu") floats over the sheet under it.
  const menuOver = (a, b) => !!a.closest('[role="menu"]') !== !!b.closest('[role="menu"]');
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
    if (a.contains(b) || b.contains(a) || pinnedOver(a, b) || menuOver(a, b)) continue;
    const x = Math.min(ra.right, rb.right) - Math.max(ra.left, rb.left);
    const y = Math.min(ra.bottom, rb.bottom) - Math.max(ra.top, rb.top);
    if (x > 2 && y > 2 && !shapesApart(a, b, ra, rb)) overlaps.push(name(a) + ' ↔ ' + name(b) + ' (' + Math.round(Math.min(x, y)) + 'px)');
  }
  // The two top clusters sit in one row: Drawing, Undo, Redo on the left; the
  // Keep chip and Settings on the right. They must keep 8 px clear (in CI's Chrome
  // a long drawing name once pushed Redo 4 px into the chip, below the overlap check's 2 px).
  const edge = (sel, side) => { const rs = [...document.querySelectorAll(sel + ' > *')].filter(reachable).map((e) => e.getBoundingClientRect());
    return rs.length ? (side === 'right' ? Math.max(...rs.map((r) => r.right)) : Math.min(...rs.map((r) => r.left))) : null; };
  const tlRight = edge('.topleft', 'right'), trLeft = edge('.topright', 'left');
  const topGap = tlRight !== null && trLeft !== null && trLeft - tlRight < 8 ? Math.round(trLeft - tlRight) : null;
  return {
    sideways: Math.max(document.documentElement.scrollWidth, innerWidth) > ${width},
    scrollWidth: Math.max(document.documentElement.scrollWidth, innerWidth),
    small, overlaps, checked, topGap,
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
    if (m.topGap !== null) row.extra.push(`top bar: the left cluster ends ${m.topGap}px from the right one (need 8)`);
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
