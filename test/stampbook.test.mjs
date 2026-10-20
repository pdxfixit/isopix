// Starter stamps and the person's own (web/stampbook.js, web/stamps.js):
// the eight the owner picked, animals and more in groups, each a real stamp
// that places at every level, and Mine kept once across drawings (owner, 2026-10-16).
import test from 'node:test';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
import * as SB from '../web/stampbook.js';
import { pack, unpack } from '../web/stamppack.js';
import { placeStamp, scaleStamp, sizeSteps, nearestStep, placeSized } from '../web/engine/density.js';
import { Drawing } from '../web/engine/model.js';
import * as L from '../web/engine/lattice.js';

test('the starter stamps, group by group: the eight the owner picked, the animals, and more', () => {
  const by = Object.fromEntries(SB.GROUPS.map((g) => [g.name, SB.STARTER.filter((s) => s.group === g.id).map((s) => s.name)]));
  assert.deepEqual(by, {
    Shapes: ['Cube', 'Stairs', 'Pyramid', 'Star'],
    'Sacred geometry': ['Seed of Life', 'Flower of Life', 'Fruit of Life', 'Merkaba', 'Mandala', 'Sierpinski', 'Star cube'],
    Buildings: ['House', 'Wall', 'Castle', 'Tower', 'Bridge'],
    Nature: ['Tree', 'Flower', 'Rock', 'Mushroom', 'Pine tree', 'Bush'],
    Weather: ['Sun', 'Cloud', 'Rainbow', 'Rain cloud', 'Snowflake', 'Lightning'],
    Animals: ['Cat', 'Bunny', 'Duck', 'Fox', 'Snake', 'Frog', 'Pig', 'Dog', 'Fish', 'Bird'],
    People: ['Smiley', 'Kid', 'Person'],
    Vehicles: ['Car', 'Truck', 'Train', 'Boat', 'Rocket', 'Plane'],
    Space: ['Planet', 'Moon', 'Stars', 'UFO'],
    Food: ['Apple', 'Cake', 'Ice cream', 'Cupcake', 'Pizza', 'Carrot'],
    Letters: [...'ABCDEFGHIJKLMNOPQRSTUVWXYZ'],
    Numbers: [...'0123456789'],
  });
  assert.equal(new Set(SB.STARTER.map((s) => s.id)).size, SB.STARTER.length, 'ids are unique');
});

test('web/stamps.js is exactly what tools/make_stamps.mjs makes', () => {
  const r = spawnSync(process.execPath, [fileURLToPath(new URL('../tools/make_stamps.mjs', import.meta.url)), '--check'], { encoding: 'utf8' });
  assert.equal(r.status, 0, r.stderr + r.stdout);
});

test('docs/stamps/ is exactly what tools/stamp_sheets.mjs makes: every stamp from every side', () => {
  const r = spawnSync(process.execPath, [fileURLToPath(new URL('../tools/stamp_sheets.mjs', import.meta.url)), '--check'], { encoding: 'utf8' });
  assert.equal(r.status, 0, r.stderr + r.stdout);
});

test('every starter stamp places at every level and keeps the one-cell-or-children rule', () => {
  for (const s of SB.STARTER) {
    for (let l = 0; l <= L.MAX_LEVEL; l++) {
      const d = new Drawing();
      const { cells } = placeStamp(s.stamp, { l, p: 4, q: 4 });
      assert.equal(cells.length, s.stamp.cells.length, `${s.name} at level ${l}`);
      d.begin(); for (const { cell, c, f } of cells) d.paint(cell, { c, f }); d.commit();
      assert.equal(d.checkInvariant(), null, `${s.name} at level ${l}`);
      assert.equal(d.cells.size, cells.length, `${s.name}: no two cells overlap`);
    }
    assert.ok(s.stamp.cells.every(([, , , , c, f]) => /^#[0-9a-f]{6}$/i.test(c) && (f === null || ['T', 'L', 'R'].includes(f))), `${s.name}: colors and faces`);
  }
});

// Sizing a placed stamp (docs/spec-stamp-size-turn.md): whole multiples are exact.
test('a stamp scaled by k has k² cells for each one, none twice, each the color of the cell it lies in', () => {
  const A = { l: 3, p: 0, q: 0 }, o = L.vertexWorld(3, 0, 0);
  for (const s of SB.STARTER) {
    const at1 = new Map(placeStamp(s.stamp, A).cells.map(({ cell, c, f }) => [L.cellKey(cell), `${c}${f || ''}`]));
    for (const k of [2, 3, 4]) {
      const { cells } = placeStamp(scaleStamp(s.stamp, k), A);
      assert.equal(cells.length, k * k * s.stamp.cells.length, `${s.name} at ${k}x`);
      assert.equal(new Set(cells.map(({ cell }) => L.cellKey(cell))).size, cells.length, `${s.name} at ${k}x: no cell twice`);
      for (const { cell, c, f } of cells) {
        // Shrunk back by k about the anchor, the cell's middle lies in the 1x cell it came from.
        const w = L.centroid(cell), back = L.hitTest(3, o.x + (w.x - o.x) / k, o.y + (w.y - o.y) / k);
        assert.equal(at1.get(L.cellKey(back)), `${c}${f || ''}`, `${s.name} at ${k}x: ${L.cellKey(cell)}`);
      }
    }
  }
});

test('a stamp at 2x is the stamp one level coarser, and at 1x it is itself', () => {
  for (const s of SB.STARTER) {
    assert.equal(scaleStamp(s.stamp, 1), s.stamp);
    const coarse = new Map(placeStamp(s.stamp, { l: 2, p: 3, q: -2 }).cells.map(({ cell, c }) => [L.cellKey(cell), c]));
    const fine = placeStamp(scaleStamp(s.stamp, 2), { l: 3, p: 6, q: -4 }).cells;
    assert.equal(fine.length, 4 * coarse.size, s.name);
    for (const { cell, c } of fine) assert.equal(coarse.get(L.cellKey(L.parent(cell))), c, `${s.name}: ${L.cellKey(cell)}`);
  }
  assert.throws(() => scaleStamp(SB.STARTER[0].stamp, 1.5), /whole number/);
  assert.throws(() => scaleStamp(SB.STARTER[0].stamp, 0), /whole number/);
});

test('a stamp\'s bold edges scale with it, k edges along each one\'s line', () => {
  const stamp = { base: 0, cells: [], edges: [[0, 1, 2, 0, '#000000'], [0, 0, 0, 1, '#111111'], [1, -1, 3, 2, '#222222']] };
  const { edges } = scaleStamp(stamp, 3);
  assert.deepEqual(edges, [
    [0, 3, 6, 0, '#000000'], [0, 4, 6, 0, '#000000'], [0, 5, 6, 0, '#000000'],
    [0, 0, 0, 1, '#111111'], [0, 0, 1, 1, '#111111'], [0, 0, 2, 1, '#111111'],
    [1, -3, 9, 2, '#222222'], [1, -4, 10, 2, '#222222'], [1, -5, 11, 2, '#222222'],
  ]);
});

// Any size (owner, 2026-10-19: "quarter steps on finer cells, clean edges").
const box = (cells) => {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const { cell } of cells) for (const w of L.cellWorldVerts(cell)) { x0 = Math.min(x0, w.x); y0 = Math.min(y0, w.y); x1 = Math.max(x1, w.x); y1 = Math.max(y1, w.y); }
  return [x0, y0, x1, y1];
};
test('at every size step a stamp is exactly s times its 1x self about its anchor, in s²·k² cells at j levels finer', () => {
  const A = { l: 3, p: 2, q: -1 }, o = L.vertexWorld(3, 2, -1);
  for (const s of SB.STARTER.filter((_, i) => i % 7 === 0)) {
    const b1 = box(placeStamp(s.stamp, A).cells);
    for (const step of sizeSteps(s.stamp, A.l)) {
      const { cells } = placeSized(s.stamp, A, step);
      assert.equal(cells.length, step.k * step.k * s.stamp.cells.length, `${s.name} at ${step.s}`);
      assert.ok(cells.every(({ cell }) => cell.l === A.l + step.j), `${s.name} at ${step.s}: cells ${step.j} levels finer`);
      const b = box(cells), want = b1.map((v, i) => (i % 2 ? o.y : o.x) + step.s * (v - (i % 2 ? o.y : o.x)));
      b.forEach((v, i) => assert.ok(Math.abs(v - want[i]) < 1e-9, `${s.name} at ${step.s}: outline ${b} not ${want}`));
    }
  }
});

test('size steps: quarters while small, then halves, then whole steps, under the cell cap and never past the finest level', () => {
  const cat = { base: 0, cells: Array.from({ length: 111 }, (_, i) => [0, i, 0, 1, '#000000', null]), edges: [] }; // a stamp of 111 cells
  const steps = sizeSteps(cat, 3), ss = steps.map((x) => x.s);
  assert.deepEqual(ss.slice(0, 8), [0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2]);
  assert.ok(ss.includes(3.25) && !ss.includes(3.75) && ss.includes(6.5) && !ss.includes(7.5) && ss.at(-1) === 13, ss.join());
  assert.ok(steps.every(({ k }) => k * k * 111 <= 20000));
  assert.deepEqual(steps.find((x) => x.s === 2), { s: 2, k: 2, j: 0 }, 'a whole size uses the grid\'s own cells');
  assert.ok(sizeSteps(cat, 6).every(({ s, j }) => j <= 1 && Number.isInteger(s * 2)), 'one level from the finest: half steps');
  assert.ok(sizeSteps(cat, L.MAX_LEVEL).every(({ s, j }) => j === 0 && Number.isInteger(s)), 'at the finest level: whole steps');
  const deep = { base: 0, cells: [[1, 0, 0, 1, '#123456', null]], edges: [] }; // a stamp of one's own with finer detail
  assert.ok(sizeSteps(deep, L.MAX_LEVEL - 1).every(({ j }) => j === 0), 'its finest cells never go past the finest level');
  assert.deepEqual(sizeSteps({ base: 0, cells: new Array(30000).fill([0, 0, 0, 1, '#000000', null]), edges: [] }, 3), [{ s: 1, k: 1, j: 0 }], 'a huge stamp keeps its own size');
  assert.equal(nearestStep(steps, 1.6).s, 1.5);
  assert.equal(nearestStep(steps, 1.625).s, 1.5, 'a tie goes to the smaller');
  assert.equal(nearestStep(steps, 99).s, 13);
  assert.equal(nearestStep(steps, -3).s, 0.25);
});

const mk = (name, n) => ({ name, stamp: { base: 0, cells: [[0, n, 0, 1, '#ff0000', null]], edges: [] } });

test('Mine keeps each stamp once, drops what is not a stamp, and names the unnamed', () => {
  const mine = SB.mergeMine([mk('A', 1)], [mk('again', 1), mk('B', 2), null, { name: 'x' }, { stamp: { cells: [] } }, { stamp: { cells: [[0, 3, 0, 1, '#00ff00', null]] } }]);
  assert.deepEqual(mine.map((s) => s.name), ['A', 'B', 'Stamp 3']);
  assert.deepEqual(SB.mergeMine(undefined, 'nope'), []);
});

test('a new stamp of one\'s own gets the next free name', () => {
  assert.equal(SB.nextName([]), 'Stamp 1');
  assert.equal(SB.nextName([mk('Stamp 1', 1), mk('Stamp 3', 2)]), 'Stamp 4');
  assert.equal(SB.nextName([mk('Stamp 2', 1)]), 'Stamp 3');
});

test('the chosen stamp, by id for a starter one, or the Cube when the choice is gone', () => {
  const mine = [mk('A', 1)];
  assert.equal(SB.chosen({ from: 'mine', i: 0 }, mine).name, 'A');
  assert.equal(SB.chosen({ from: 'starter', id: 'house' }, mine).name, 'House');
  assert.equal(SB.chosen({ from: 'starter', id: 'gone' }, mine).name, 'Cube');
  assert.equal(SB.chosen({ from: 'mine', i: 5 }, mine).name, 'Cube');
  assert.equal(SB.chosen(null, mine).name, 'Cube');
});

test('the drawer\'s sections: Mine first, then every group in order, each stamp in exactly one, each choice picking its own stamp', () => {
  const mine = [mk('A', 1), mk('B', 2)];
  const secs = SB.sections(mine);
  assert.deepEqual(secs.map((s) => s.id), ['mine', ...SB.GROUPS.map((g) => g.id)]);
  assert.deepEqual(secs[0].items.map((it) => it.s.name), ['A', 'B']);
  const starters = secs.slice(1).flatMap((s) => s.items.map((it) => it.s));
  assert.equal(starters.length, SB.STARTER.length);
  assert.equal(new Set(starters).size, SB.STARTER.length, 'no stamp twice');
  for (const sec of secs.slice(1)) assert.ok(sec.items.length, `${sec.name} is not empty`);
  for (const sec of secs) for (const it of sec.items) assert.equal(SB.chosen(it.choice, mine), it.s);
});

test('a packed stamp unpacks to exactly its cells: gaps, negative rows and columns, faces and none', () => {
  const cells = [[0, -3, -2, 1, '#ff0000', 'L'], [0, -3, 1, 0, '#00ff00', null], [0, 2, -1, 0, '#ff0000', 'L'], [0, 2, 0, 1, '#0000ff', 'T'], [0, 0, 0, 0, '#00ff00', null]];
  const p = pack({ base: 0, cells, edges: [] });
  const sorted = (cs) => cs.map((c) => JSON.stringify(c)).sort();
  assert.deepEqual(sorted(unpack(p).cells), sorted(cells));
  assert.equal(p.pal.length, 3, 'one palette entry per color and face');
  assert.throws(() => pack({ cells: [[1, 0, 0, 0, '#ff0000', null]] }), /own level/);
  assert.deepEqual(unpack({ pal: [], rows: '' }).cells, []);
});
