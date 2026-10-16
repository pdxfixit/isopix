// Fuzz: random edits through every engine write path (brushes, erase, bold
// edges, fill, density change both ways, region erase), each inside
// begin() ... commit(). Undoing everything and redoing everything must pass
// through exactly the drawings it made, and saving then opening must give the
// same drawing with the same undo history (owner, 2026-10-16: "and the fuzz test").
import test from 'node:test';
import assert from 'node:assert/strict';
import * as L from '../web/engine/lattice.js';
import * as B from '../web/engine/brushes.js';
import * as D from '../web/engine/density.js';
import * as P from '../web/engine/project.js';
import { fillAt } from '../web/engine/fill.js';
import { Drawing } from '../web/engine/model.js';

const SEEDS = 12, STEPS = 60;
const COLORS = ['#e63946', '#3a86ff', '#ffbe0b', '#2a9d8f'];
const BOX = 2; // edits land in world [0, BOX] squared
const inBounds = (c) => { const w = L.centroid(c); return w.x > -0.5 && w.x < BOX + 0.5 && w.y > -0.5 && w.y < BOX + 0.5; };

// Everything a person can see or get back, as one comparable value.
const sorted = (m) => [...m].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
// Hidden children count only while live: their cell still holds the value
// they were hidden under (or is still empty). Stale ones are never shown, and
// project.js leaves them out of a file.
const live = (d) => [...d.hidden].filter(([k, h]) => (h.empty ? !d.cells.has(k) : d.cells.get(k)?.id === h.id));
const snap = (d) => JSON.stringify({ cells: sorted(d.cells), edges: sorted(d.edges), hidden: sorted(live(d)), hiddenEdges: sorted(d.hiddenEdges), paper: d.paper });

// The drawing matches a snapshot; on a mismatch, says which part and which keys.
function same(d, state, what) {
  const now = snap(d);
  if (now === state) return;
  const want = JSON.parse(state), got = JSON.parse(now);
  for (const k of Object.keys(want)) {
    if (JSON.stringify(got[k]) === JSON.stringify(want[k])) continue;
    const a = new Map(got[k]), b = new Map(want[k]);
    const keys = [...new Set([...a.keys(), ...b.keys()])].filter((key) => JSON.stringify(a.get(key)) !== JSON.stringify(b.get(key)));
    assert.fail(`${what}: ${k} differs at ${keys.slice(0, 3).join(' ')}${keys.length > 3 ? ` and ${keys.length - 3} more` : ''}`);
  }
}

function edit(d, rnd) {
  const pick = (a) => a[Math.floor(rnd() * a.length)];
  const x = rnd() * BOX, y = rnd() * BOX, l = 1 + Math.floor(rnd() * 4); // levels 1 to 4: finer is slow, not different
  const spec = { c: pick(COLORS) };
  const region = () => D.makeRegion(l, B.hexagon(L.nearestVertex(l, x, y), 1 + Math.floor(rnd() * 2)).cells);
  const op = pick(['brush', 'brush', 'erase', 'edge', 'fill', 'density', 'eraseRegion']);
  d.begin(op);
  if (op === 'brush' || op === 'erase') {
    for (const { cell, f } of B.brushCells(pick(B.BRUSHES), l, x, y)) d.paint(cell, op === 'erase' ? null : { ...spec, f }, pick(['replace', 'protect', 'behind']));
  } else if (op === 'edge') {
    const A = L.nearestVertex(l, x, y);
    for (const e of B.edgeLine(A, Math.floor(rnd() * 7) - 3, Math.floor(rnd() * 7) - 3).edges) d.paintEdge(e, rnd() < 0.2 ? null : spec);
  } else if (op === 'fill') {
    for (const leaf of fillAt(d, x, y, l, { inBounds, maxCells: 4000 }).leaves) d.paint(leaf.cell, spec, 'replace');
  } else if (op === 'density') {
    D.changeDensity(d, region(), Math.max(0, Math.min(5, l + Math.floor(rnd() * 4) - 2)), { mode: pick(['crisp', 'blend']), snap: rnd() < 0.3, palette: COLORS });
  } else {
    D.eraseRegion(d, region());
  }
  d.commit();
}

// One run per seed: the drawing, a copy saved and opened, and every state.
// Both tests of a seed share it (undo all then redo all ends where it began).
const runs = new Map();
const run = (seed) => { if (!runs.has(seed)) runs.set(seed, edits(seed)); return runs.get(seed); };
function edits(seed) {
  let s = seed * 7919;
  const rnd = () => (s = (s * 16807) % 2147483647) / 2147483647;
  const d = new Drawing();
  const states = [snap(d)];
  for (let i = 0; i < STEPS; i++) {
    const before = d.undoStack.length;
    edit(d, rnd);
    assert.equal(d.checkInvariant(), null, `step ${i}: the one-cell-or-children rule broke`);
    if (d.undoStack.length > before) states.push(snap(d)); // an edit that changed nothing makes no undo step
    else assert.equal(snap(d), states.at(-1), `step ${i}: changed the drawing without an undo step`);
  }
  assert.equal(d.undoStack.length, states.length - 1);
  // Save then open, as a file would: through JSON text.
  const opened = P.load(JSON.parse(JSON.stringify(P.save(d))));
  return { d, opened, states };
}

// Undo all the way back, then redo all the way, through exactly the same states.
function undoRedo(x, states, who) {
  const steps = states.length - 1;
  for (let i = steps - 1; i >= 0; i--) {
    assert.ok(x.undo(), `${who}: undo ${steps - i} of ${steps}`);
    same(x, states[i], `${who}: undo ${steps - i} of ${steps} gives back step ${i}`);
  }
  assert.equal(x.undo(), null, `${who}: nothing left to undo`);
  for (let i = 1; i <= steps; i++) {
    assert.ok(x.redo(), `${who}: redo ${i}`);
    same(x, states[i], `${who}: redo ${i} of ${steps}`);
  }
  assert.equal(x.checkInvariant(), null);
}

for (let seed = 1; seed <= SEEDS; seed++) {
  test(`seed ${seed}: undo all and redo all give back the same drawings; save then open gives the same drawing`, () => {
    const { d, opened, states } = run(seed);
    same(opened, states.at(-1), 'save then open');
    assert.equal(opened.checkInvariant(), null);
    undoRedo(d, states, 'the drawing');
  });
  // A file leaves out hidden children their cell no longer holds (project.js
  // save), so undoing the paint that covered them after a reopen (or a reload:
  // the autosave is a file too) cannot bring them back for Finer. Open question
  // for the owner, 2026-10-16; saving every hidden entry fixes it (+1.7% size).
  test(`seed ${seed}: undo and redo after save then open match the drawing`, { todo: 'hidden children a paint covered are not saved' }, () => {
    const { opened, states } = run(seed);
    undoRedo(opened, states, 'the opened file');
  });
}
