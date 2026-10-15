// The lessons (web/lessons.js, docs/lessons.md): every step is well formed,
// a lesson runs on the events the app sends, and every control on the Help
// sheet is taught by some step or named in NOT_TAUGHT with its reason, so
// the lessons cannot fall behind the app (owner: "wonderful", 2026-10-15).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { LESSONS, NOT_TAUGHT, TAUGHT_SECTIONS, deviceOf, sayFor, startLesson, onEvent, next, finished, progress, doneLessons } from '../web/lessons.js';
import { SECTIONS } from '../web/help.js';

const html = fs.readFileSync(new URL('../web/index.html', import.meta.url), 'utf8');
const app = fs.readFileSync(new URL('../web/app.js', import.meta.url), 'utf8');

test('every step is well formed: an id, wording for each device, and a way to finish', () => {
  for (const l of LESSONS) {
    assert.ok(l.steps.length >= 2 && l.steps.length <= 7, `${l.id}: ${l.steps.length} steps (lessons stay short)`);
    assert.equal(new Set(l.steps.map((s) => s.id)).size, l.steps.length, `${l.id}: step ids repeat`);
    for (const s of l.steps) {
      const where = `${l.id}/${s.id}`;
      if (typeof s.say !== 'string') for (const d of ['touch', 'mouse', 'pen']) assert.ok(s.say[d], `${where} has no ${d} wording`);
      assert.ok(s.show ? !s.done : typeof s.done === 'function', `${where}: a show step has Next, any other a done test`);
      assert.ok(Array.isArray(s.covers), `${where}: covers`);
    }
  }
  assert.equal(new Set(LESSONS.map((l) => l.id)).size, LESSONS.length);
});

test('every place a step points at exists in the page or is made by app.js', () => {
  for (const l of LESSONS) for (const s of l.steps) {
    for (const sel of [].concat(s.target || [])) {
      for (const [, id] of sel.matchAll(/#([a-z-]+)/g)) assert.ok(html.includes(`id="${id}"`) || app.includes(`'${id}'`), `${l.id}/${s.id} points at #${id}, which nothing makes`);
      for (const [, tool] of sel.matchAll(/data-tool="([a-z]+)"/g)) assert.ok(html.includes(`data-tool="${tool}"`), `${l.id}/${s.id}: no ${tool} tool`);
      for (const [, name, v] of sel.matchAll(/input\[name="([a-z]+)"\]\[value="([a-z0-9]+)"\]/g)) assert.ok(html.includes(`name="${name}" value="${v}"`), `${l.id}/${s.id}: no ${name}=${v}`);
    }
  }
});

test('every control on the Help sheet is taught by a lesson, or NOT_TAUGHT says why', () => {
  const taught = new Set(LESSONS.flatMap((l) => l.steps.flatMap((s) => s.covers)));
  const names = new Set();
  for (const title of TAUGHT_SECTIONS) {
    const sec = SECTIONS.find((s) => s.title === title);
    assert.ok(sec, `Help has no section ${title}`);
    for (const it of sec.items) {
      names.add(it.name);
      assert.ok(taught.has(it.name) || NOT_TAUGHT[it.name], `"${it.name}" (Help → ${title}) is in no lesson: add it to a step's covers, or to NOT_TAUGHT with the reason`);
    }
  }
  for (const n of taught) assert.ok(names.has(n), `a step covers "${n}", which is not on the Help sheet`);
  for (const n of Object.keys(NOT_TAUGHT)) assert.ok(names.has(n) && !taught.has(n), `NOT_TAUGHT names "${n}", which is taught or gone`);
});

test('Basics runs on the app\'s events, in order, and ignores what does not fit', () => {
  let s = startLesson('basics');
  assert.equal(progress(s), 'Step 1 of 7');
  s = onEvent(s, { type: 'stroke', tool: 'pencil', brush: 'triangle', cells: 2 });
  assert.equal(s.index, 0, 'two cells is not a stroke yet');
  s = onEvent(s, { type: 'stroke', tool: 'pencil', brush: 'triangle', cells: 5 });
  s = onEvent(s, { type: 'stroke', tool: 'pencil', brush: 'triangle', cells: 5 });
  assert.equal(s.index, 1, 'the cube step wants the Hexagon');
  s = onEvent(s, { type: 'stroke', tool: 'pencil', brush: 'hexagon', cells: 6 });
  s = onEvent(s, { type: 'stroke', tool: 'pencil', brush: 'hexagon', cells: 6 });
  assert.equal(s.index, 2, 'size: a stroke before a new size does not count');
  s = onEvent(s, { type: 'level', level: 2 });
  s = onEvent(s, { type: 'stroke', tool: 'pencil', brush: 'hexagon', cells: 6 });
  for (const type of ['undo', 'redo', 'view', 'fit']) s = onEvent(s, { type });
  assert.ok(finished(s));
});

test('Next moves on only from a show step or an optional one', () => {
  let s = startLesson('colors');
  assert.equal(next(s).index, 0, 'Tap a color has no Next');
  s = onEvent(s, { type: 'color', custom: false });
  assert.equal(next(s).index, 2, 'the eyedropper step can be skipped');
  assert.equal(startLesson('nope'), null);
});

test('the wording follows the device: the last pointer, else the screen\'s main one', () => {
  assert.equal(deviceOf({ pointerType: 'pen' }), 'pen');
  assert.equal(deviceOf({ pointerType: 'mouse', coarse: true }), 'mouse');
  assert.equal(deviceOf({ coarse: true }), 'touch');
  assert.equal(deviceOf({}), 'mouse');
  const step = LESSONS[0].steps[0];
  assert.match(sayFor(step, 'touch'), /finger/);
  assert.match(sayFor(step, 'mouse'), /Click/);
  assert.match(sayFor(step, 'pen'), /pen/);
});

test('lessons done are kept as a list of known ids; junk reads as none', () => {
  assert.deepEqual([...doneLessons('["basics","nope",3]')], ['basics']);
  assert.equal(doneLessons('{oops').size, 0);
  assert.equal(doneLessons(null).size, 0);
});
