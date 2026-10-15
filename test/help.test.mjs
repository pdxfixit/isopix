// The Help sheet lists every control, gesture and key (web/help.js), and the
// keys come from the same table the app binds (web/keys.js). These fail when
// a key, tool, brush or button is added without its Help line.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { KEYS, keyFor } from '../web/keys.js';
import { SECTIONS, helpHTML, helpIds } from '../web/help.js';

const html = fs.readFileSync(new URL('../web/index.html', import.meta.url), 'utf8');
const app = fs.readFileSync(new URL('../web/app.js', import.meta.url), 'utf8');
const sheet = helpHTML((sel) => `<svg data-from='${sel}'></svg>`);
const items = SECTIONS.flatMap((s) => s.items);

test('every bound key is on the sheet, and the app handles every action in the table', () => {
  for (const row of KEYS) {
    assert.ok(sheet.includes(row.keys.join(' or ').replace(/&/g, '&amp;')), `key ${row.keys} missing from Help`);
    const what = row.action.split(':')[0];
    if (what === 'pan-hold') { assert.match(app, /spaceHeld = true/); continue; }
    assert.match(app, new RegExp(`\\b${what}\\b[:,]`), `app.js does not handle ${row.action}`);
  }
});

test('keyFor reads keyboard events the way the table says', () => {
  assert.equal(keyFor({ key: 'p' }).action, 'tool:pencil');
  assert.equal(keyFor({ key: 'P' }).action, 'tool:pencil', 'Caps Lock');
  assert.equal(keyFor({ key: 'z', ctrlKey: true }).action, 'undo');
  assert.equal(keyFor({ key: 'Z', metaKey: true, shiftKey: true }).action, 'redo');
  assert.equal(keyFor({ key: 'y', ctrlKey: true }).action, 'redo');
  assert.equal(keyFor({ key: '=' }).action, 'zoom:in');
  assert.equal(keyFor({ key: '?' }).action, 'help');
  assert.equal(keyFor({ key: 'p', ctrlKey: true }), null, 'Ctrl+P is the browser\'s');
  assert.equal(keyFor({ key: 's', ctrlKey: true }).action, 'save', 'Ctrl+S saves the drawing, not the web page');
  assert.equal(keyFor({ key: 'S', metaKey: true, shiftKey: true }).action, 'saveas');
  assert.equal(keyFor({ key: 'o', ctrlKey: true }).action, 'open');
  assert.equal(keyFor({ key: 'h' }).action, 'move');
  assert.equal(keyFor({ key: 's' }).action, 'tool:select', 'plain S is still Select');
  assert.equal(keyFor({ key: 'x' }), null);
});

test('every tool button and brush shape has a Help line with its real icon', () => {
  for (const [, tool] of html.matchAll(/data-tool="([a-z]+)"/g)) {
    assert.ok(items.some((it) => it.from === `[data-tool="${tool}"]`), `tool ${tool} missing from Help`);
  }
  const brushes = Object.keys(eval(`(${app.match(/const BRUSH_LABEL = (\{[^}]+\})/)[1]})`));
  for (const b of brushes) assert.ok(items.some((it) => it.glyph === b), `brush ${b} missing from Help`);
});

test('the palette\'s pick-any-color button and its Help line show the same icon', () => {
  const m = app.match(/custom\.innerHTML = `\$\{GLYPHS\.([a-z-]+)\}/);
  assert.ok(m, 'the palette draws its pick-any-color icon from GLYPHS');
  assert.equal(items.find((it) => it.name === 'Any color')?.glyph, m[1]);
});

test('every button and slider on the page and in the Drawing sheet is on the Help sheet, and every icon it borrows exists', () => {
  const drawing = html.slice(html.indexOf('<dialog id="drawing"'), html.indexOf('</dialog>', html.indexOf('<dialog id="drawing"')));
  const page = html.slice(0, html.indexOf('<dialog')) + drawing;
  // Notices are explained in place; the New confirmation's choices are explained under New.
  const notControls = new Set(['update-reload', 'update-close', 'protect-close', 'save-note-save', 'save-note-close', 'move-open', 'move-close', 'replay-stop', 'new-save-first', 'new-anyway', 'new-cancel', 'loading-reload']);
  // Sliders (role="slider": the zoom track, the density handle) count as controls too.
  const controls = [...page.matchAll(/<button[^>]*\bid="([^"]+)"/g), ...page.matchAll(/<div[^>]*\bid="([^"]+)"[^>]*\brole="slider"/g)];
  for (const [, id] of controls) {
    if (notControls.has(id)) continue;
    assert.ok(items.some((it) => it.from === `#${id}`), `#${id} missing from Help`);
  }
  for (const it of items.filter((x) => x.from)) {
    const sel = it.from.startsWith('#') ? `id="${it.from.slice(1)}"` : it.from.slice(1, -1);
    assert.ok(html.includes(sel), `Help borrows the icon of ${it.from}, which is not in index.html`);
  }
});

test('the paint-can chip is explained in all three modes, and the words are defined', () => {
  for (const w of ['Keep', 'Behind', 'Replace', 'Lattice', 'Cell', 'Level', 'Gutter', 'Density', 'Handle', 'Lock', 'Drawing', 'Settings', 'Name', 'Fit drawing']) {
    assert.ok(items.some((it) => it.name === w), `${w} missing`);
  }
});

test('each Help section folds, closed unless opened before, its head naming the body it opens', () => {
  const heads = [...sheet.matchAll(/<button type="button" class="set-head" aria-expanded="false" aria-controls="(help-[a-z-]+)">/g)].map((m) => m[1]);
  assert.deepEqual(heads, helpIds(), 'every section and Keys has a closed fold head');
  for (const id of heads) assert.match(sheet, new RegExp(`<div class="set-body" id="${id}" hidden>`));
  const opened = helpHTML(() => '', new Set(['help-tools']));
  assert.match(opened, /aria-expanded="true" aria-controls="help-tools"/);
  assert.match(opened, /<div class="set-body" id="help-tools">/);
  assert.equal(new Set(helpIds()).size, helpIds().length, 'section titles give distinct ids');
});
