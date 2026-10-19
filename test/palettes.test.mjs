// Palettes (web/palettes.js): presets never change; a color of one's own on a
// preset copies it into Mine with the color added, so no picked color is lost
// (owner, 2026-10-18). Mine comes from storage and files, so it is checked.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as PB from '../web/palettes.js';
import { PAPERS } from '../web/engine/paper.js';
import * as P from '../web/engine/project.js';
import { Drawing } from '../web/engine/model.js';

const sunsetBefore = JSON.stringify(PB.PRESETS);

test('Isopix comes first and follows the paper; the other presets are fixed, each color once', () => {
  assert.equal(PB.PRESETS[0].id, 'isopix');
  assert.deepEqual(PB.colorsOf(PB.find('isopix', []), 'light'), PAPERS.light.inks);
  assert.deepEqual(PB.colorsOf(PB.find('isopix', []), 'dark'), PAPERS.dark.inks);
  assert.equal(new Set(PB.PRESETS.map((p) => p.id)).size, PB.PRESETS.length);
  for (const p of PB.PRESETS.slice(1)) {
    assert.equal(new Set(p.colors).size, p.colors.length, p.name);
    assert.ok(p.colors.every((c) => /^#[0-9a-f]{6}$/.test(c)), p.name);
  }
});

test('an unknown or deleted palette falls back to Isopix', () => {
  assert.equal(PB.find('m9', []).id, 'isopix');
  assert.equal(PB.find(undefined, []).id, 'isopix');
});

test('a second color of one\'s own keeps the first (the old app replaced it)', () => {
  let r = PB.addColor([], 'isopix', '#123456', 'light');
  assert.equal(r.copied, 'My colors');
  r = PB.addColor(r.mine, r.id, '#ABCDEF', 'light');
  const p = PB.find(r.id, r.mine);
  assert.deepEqual(p.colors.slice(-2), ['#123456', '#abcdef']);
  assert.equal(r.mine.length, 1, 'the second pick joins the same palette');
});

test('a preset is never changed: a pick on it makes a copy in Mine, in use from then on', () => {
  const r = PB.addColor([], 'sunset', '#00ff00', 'light');
  assert.equal(r.copied, 'My Sunset');
  assert.equal(r.id, 'm1');
  assert.deepEqual(r.mine[0].colors, [...PB.find('sunset', []).colors, '#00ff00']);
  assert.equal(JSON.stringify(PB.PRESETS), sunsetBefore);
  const again = PB.addColor(r.mine, 'sunset', '#0000ff', 'light');
  assert.equal(again.copied, 'My Sunset 2', 'a second copy gets its own name');
});

test('a color already there is just used; a full palette keeps its colors and says so', () => {
  const ink = PAPERS.light.inks[3];
  assert.deepEqual(PB.addColor([], 'isopix', ink, 'light'), { mine: [], id: 'isopix' });
  const full = [{ id: 'm1', name: 'Full', colors: Array.from({ length: PB.MAX }, (_, i) => `#0000${i.toString(16).padStart(2, '0')}`) }];
  const r = PB.addColor(full, 'm1', '#ffffff', 'light');
  assert.equal(r.full, true);
  assert.equal(r.mine, full);
  assert.equal(PB.addColor(full, 'm1', 'red', 'light').mine, full, 'not a hex color');
});

test('a new palette starts with the color in use; the last color cannot be taken out', () => {
  let { mine, id } = PB.newPalette([], '#ff0000');
  assert.deepEqual(PB.find(id, mine), { id: 'm1', name: 'Palette', colors: ['#ff0000'] });
  mine = PB.removeColor(mine, id, '#ff0000');
  assert.deepEqual(mine[0].colors, ['#ff0000']);
  mine = PB.addColor(mine, id, '#00ff00', 'light').mine;
  mine = PB.removeColor(mine, id, '#ff0000');
  assert.deepEqual(mine[0].colors, ['#00ff00']);
  assert.equal(PB.rename(mine, id, '  Moss  ')[0].name, 'Moss');
  assert.equal(PB.rename(mine, id, '   ')[0].name, 'Palette', 'a blank name keeps the old one');
  assert.deepEqual(PB.remove(mine, id), []);
});

test('Mine from storage or a file is checked: junk dropped, colors fixed, ids unique', () => {
  const got = PB.clean([
    null, 'x', { colors: 'no' }, { name: 'Empty', colors: ['nope'] },
    { id: 'm2', name: 'A', colors: ['#AABBCC', '#aabbcc', 'red', '#112233'] },
    { id: 'm2', name: 'B', colors: ['#000000'] },
    { id: '<script>', name: 7, colors: ['#ffffff'] },
    { id: 'm3', name: 'x'.repeat(99), colors: Array(40).fill(0).map((_, i) => `#0000${i.toString(16).padStart(2, '0')}`) },
  ]);
  assert.deepEqual(got.map((p) => p.colors.length), [2, 1, 1, PB.MAX]);
  assert.deepEqual(got[0].colors, ['#aabbcc', '#112233']);
  assert.equal(new Set(got.map((p) => p.id)).size, 4);
  assert.ok(got.every((p) => /^m\d+$/.test(p.id)));
  assert.equal(got[2].name, 'Palette');
  assert.equal(got[3].name.length, 40);
  assert.deepEqual(PB.clean('junk'), []);
});

test('a palette a file carries joins Mine once', () => {
  const carried = { name: 'Moss', colors: ['#3a5a40', '#a3b18a'] };
  let r = PB.adopt([], carried);
  assert.deepEqual(r.mine, [{ id: 'm1', name: 'Moss', colors: ['#3a5a40', '#a3b18a'] }]);
  r = PB.adopt(r.mine, carried);
  assert.equal(r.mine.length, 1);
  assert.equal(r.id, 'm1');
  r = PB.adopt(r.mine, { name: 'Moss', colors: ['#000000'] });
  assert.equal(r.mine[1].name, 'Moss 2');
  assert.deepEqual(PB.adopt(r.mine, { colors: ['bad'] }).id, null);
});

test('the old single custom color becomes "My colors" beside the inks it sat with', () => {
  const r = PB.fromCustom([], '#123456', 'dark');
  assert.deepEqual(r.mine[0].colors, [...PAPERS.dark.inks, '#123456']);
  assert.equal(r.mine[0].name, 'My colors');
  assert.deepEqual(PB.fromCustom([], '', 'light'), { mine: [], id: null });
});

test('a saved drawing carries the palette in use, and reading it back hands it over', () => {
  const palette = { name: 'Moss', colors: ['#3a5a40', '#a3b18a'] };
  const doc = JSON.parse(JSON.stringify(P.save(new Drawing(), { palette })));
  assert.deepEqual(P.meta(doc).palette, palette);
  assert.equal(P.meta(P.save(new Drawing())).palette, undefined);
});
