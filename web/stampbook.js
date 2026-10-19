// The stamps a person can place: the starter set (web/stamps.js) and their
// own (Mine), which belong to this browser across all its drawings (owner,
// 2026-10-16: "shapes belong to the user, across drawings"). Pure logic
// (test/stampbook.test.mjs); app.js keeps Mine in IndexedDB at `stamps`.

import { GROUPS, PACKED } from './stamps.js';
import { unpack } from './stamppack.js';

export { GROUPS };
// The starter stamps, unpacked: {id, name, group, stamp}.
export const STARTER = PACKED.map(({ pal, rows, ...s }) => ({ ...s, stamp: unpack({ pal, rows }) }));
export const KEY = 'stamps';

const okStamp = (s) => s && typeof s === 'object' && s.stamp && Array.isArray(s.stamp.cells)
  && s.stamp.cells.every((c) => Array.isArray(c) && c.length >= 5) && (s.stamp.cells.length > 0 || (Array.isArray(s.stamp.edges) && s.stamp.edges.length > 0));

// Two stamps are the same when their cells and edges are.
export const sigOf = (s) => JSON.stringify([s.stamp.cells, s.stamp.edges || []]);

// Mine, with `incoming` (from storage, a drawing or a file) added: each stamp
// once, the first name it had, in order. Anything that is not a stamp is dropped.
export function mergeMine(mine, incoming) {
  const out = [], seen = new Set();
  for (const s of [...(Array.isArray(mine) ? mine : []), ...(Array.isArray(incoming) ? incoming : [])]) {
    if (!okStamp(s)) continue;
    const sig = sigOf(s);
    if (seen.has(sig)) continue;
    seen.add(sig);
    out.push({ name: typeof s.name === 'string' && s.name.trim() ? s.name.slice(0, 40) : `Stamp ${out.length + 1}`, stamp: s.stamp });
  }
  return out;
}

// The next name for a stamp of one's own: "Stamp 3" after Stamp 1 and 2.
export function nextName(mine) {
  const used = new Set(mine.map((s) => s.name));
  for (let n = mine.length + 1; ; n++) if (!used.has(`Stamp ${n}`)) return `Stamp ${n}`;
}

// The stamp chosen: {from: 'starter', id} (by id, so adding or regrouping
// starter stamps never swaps one for another) or {from: 'mine', i}; a choice
// that no longer exists falls back to the first starter stamp.
export function chosen(choice, mine) {
  if (choice?.from === 'mine' && mine[choice.i]) return mine[choice.i];
  return (choice?.from === 'starter' && STARTER.find((s) => s.id === choice.id)) || STARTER[0];
}

// The Stamps drawer's sections: Mine, then each group of starter stamps.
// Each item is {s, choice}: the stamp and the choice that picks it.
export function sections(mine) {
  return [
    { id: 'mine', name: 'Mine', items: mine.map((s, i) => ({ s, choice: { from: 'mine', i } })) },
    ...GROUPS.map((g) => ({ ...g, items: STARTER.filter((s) => s.group === g.id).map((s) => ({ s, choice: { from: 'starter', id: s.id } })) })),
  ];
}
