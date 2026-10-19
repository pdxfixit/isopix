// Every modal the same way (owner, 2026-10-19: "just have them centered,
// modalish, esc exits (which should be applied to modals on both isopix and
// noodlepads equally)"). Every <dialog> is opened with showModal, which keeps
// focus inside and closes on Esc by itself; nothing swallows Esc in a dialog;
// and each is centered, except the two drawers the owner picked to slide up
// from the bottom (Stamps: "place 2, the drawer"; Palettes, the same drawer).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const web = new URL('../web/', import.meta.url);
const read = (f) => fs.readFileSync(new URL(f, web), 'utf8');
const html = read('index.html');
const css = read('styles.css');
const js = ['', 'ui/'].flatMap((d) => fs.readdirSync(new URL(d || '.', web)).filter((f) => f.endsWith('.js')).map((f) => read(d + f))).join('\n');
const dialogs = [...html.matchAll(/<dialog id="([a-z-]+)"(?: class="([^"]*)")?/g)].map(([, id, cls = '']) => ({ id, cls: cls.split(' ') }));
const DRAWERS = new Set(['stamps', 'palettes']);

test('every dialog opens modal, so Esc closes it and focus stays inside', () => {
  assert.ok(dialogs.length >= 10, `found ${dialogs.length} dialogs`);
  assert.doesNotMatch(js, /\.show\(\)/, 'a dialog opened with show(): Esc would not close it');
  for (const { id } of dialogs) {
    const opened = new RegExp(`\\$\\('#${id}'\\)\\.showModal\\(\\)|openSheet\\('#${id}'\\)|const d = \\$\\('#${id}'\\)[^]*?d\\.showModal\\(\\)`).test(js) || id === 'welcome'; // welcome.js gets its dialog passed in
    assert.ok(opened, `#${id} is never opened with showModal`);
  }
  // Nothing cancels the dialogs' own Esc ('cancel' preventDefault would keep one open).
  assert.doesNotMatch(js, /addEventListener\('cancel'[^\n]*preventDefault/);
});

test('every dialog is centered, but the two drawers the owner chose', () => {
  for (const { id, cls } of dialogs) {
    assert.equal(cls.includes('drawer'), DRAWERS.has(id), `#${id}: ${cls.includes('drawer') ? 'a drawer the owner did not choose' : 'not the drawer the owner chose'}`);
  }
  // A dialog's margin is the browser's (auto: centered) unless a rule moves it; only .drawer may.
  for (const [, sel, body] of [...css.matchAll(/(^|\n)([^{}\n]*dialog[^{}]*)\{([^}]*)\}/g)].map((m) => [m[0], m[2], m[3]])) {
    if (!sel.split(',').some((part) => /(^|\s)dialog([#.][\w-]+)*\s*$/.test(part))) continue; // a rule for what is inside
    const margin = body.match(/(?:^|;|\s)margin(?:-[a-z]+)?\s*:\s*([^;]+)/)?.[1]?.trim();
    if (margin === undefined || margin === 'auto') continue;
    assert.match(sel, /dialog\.drawer/, `${sel.trim()} moves a dialog off center (margin: ${margin})`);
  }
});
