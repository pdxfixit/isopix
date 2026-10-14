// The owner's bug report (2026-10-12): "clicking on existing content with a larger tile
// isn't overpainting". Cause, reproduced: Keep fine detail (then named Protect; the default)
// skips bigger cells with finer detail inside; Replace overpaints. These tests
// pin that behavior and the logic that makes it visible.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as L from '../web/engine/lattice.js';
import { Drawing } from '../web/engine/model.js';
import { protectSplit, nextMode, MODES, skipNotice } from '../web/engine/protect.js';

const fineThenBig = () => {
  const d = new Drawing();
  const big = L.mk(2, 0, 0, 1);
  const fine = L.descendantsAt(big, 5).slice(0, 3);
  for (const c of fine) d.paint(c, { c: '#e63946' });
  return { d, big, fine };
};

test('the reported case: a bigger tile over finer content', () => {
  for (const [mode, overpaints] of [['protect', false], ['replace', true], ['behind', false]]) {
    const { d, big, fine } = fineThenBig();
    d.paint(big, { c: '#3a86ff' }, mode);
    assert.equal(fine.every((c) => d.get(c)?.c === '#e63946'), !overpaints, mode);
  }
});

test('protectSplit names exactly the cells Keep would skip', () => {
  const { d, big } = fineThenBig();
  const other = L.mk(2, 3, 3, 1);
  assert.deepEqual(protectSplit(d, [big, other], 'protect'), { paint: [other], skip: [big] });
  assert.deepEqual(protectSplit(d, [big, other], 'replace'), { paint: [big, other], skip: [] });
  assert.deepEqual(protectSplit(d, [big, other], 'behind'), { paint: [big, other], skip: [] });
  // A cell inside a painted bigger cell has no finer detail: not skipped.
  d.paint(other, { c: '#000000' });
  assert.equal(protectSplit(d, [L.children(other)[0]], 'protect').skip.length, 0);
});

test('the mode chip cycles Keep, Paint behind, Replace', () => {
  assert.deepEqual(MODES, ['protect', 'behind', 'replace']);
  assert.equal(nextMode('protect'), 'behind');
  assert.equal(nextMode('behind'), 'replace');
  assert.equal(nextMode('replace'), 'protect');
});

test('the skip notice shows once a session, and only when cells were skipped', () => {
  const s = { told: false };
  assert.equal(skipNotice(s, 0), null);
  assert.match(skipNotice(s, 4), /skipped 4 cells/);
  assert.equal(skipNotice(s, 9), null);
  assert.match(skipNotice({ told: false }, 1), /skipped 1 cell\./);
});

test('the mode chip and the Fill tool show the same single fill can in every mode', async () => {
  const fs = await import('node:fs');
  const { CAN, GLYPHS } = await import('../web/glyphs.js');
  const html = fs.readFileSync(new URL('../web/index.html', import.meta.url), 'utf8');
  const fillButton = html.slice(html.indexOf('data-tool="fill"'), html.indexOf('</button>', html.indexOf('data-tool="fill"')));
  assert.ok(fillButton.includes(CAN), 'the Fill button draws the shared can');
  assert.ok(GLYPHS['mode-can'].includes(CAN));
  assert.ok(!('mode-protect' in GLYPHS) && !('mode-behind' in GLYPHS), 'no per-mode icons');
});

test('Keep is the word people read; a stored "protect" setting still means Keep', async () => {
  const { MODE_LABEL, MODE_SAYS, skipNotice } = await import('../web/engine/protect.js');
  assert.equal(MODE_LABEL.protect, 'Keep');
  assert.match(MODE_SAYS.protect, /^Keep fine detail/);
  assert.match(skipNotice({ told: false }, 2), /^Keep fine detail skipped 2 cells/);
  assert.equal(nextMode('protect'), 'behind');
});
