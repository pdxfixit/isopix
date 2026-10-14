// Fill bucket. Floods over "leaves" (the cells as stored, at whatever level),
// so a fill stores big cells: a painted region is recolored cell by cell as
// it is stored, and an empty region is filled with cells at the active level,
// going finer only beside detail that is finer than that. An empty canvas is
// unbounded, so the caller passes a bounds test (the visible area) and a cap.
// Pure logic, no DOM.
import * as L from './lattice.js';

function sharedVerts(a, b) {
  const sb = new Set(L.cellVerts(b).map((v) => v.join(',')));
  return L.cellVerts(a).filter((v) => sb.has(v.join(',')));
}

// Children of cell y that touch the edge with lattice vertices e0, e1 (at y's level).
function childrenOnEdge(y, e0, e1) {
  const A = [2 * e0[0], 2 * e0[1]], M = [e0[0] + e1[0], e0[1] + e1[1]], B = [2 * e1[0], 2 * e1[1]];
  const has = (vs, v) => vs.some((w) => w[0] === v[0] && w[1] === v[1]);
  return L.children(y).filter((ch) => {
    const vs = L.cellVerts(ch);
    return (has(vs, A) && has(vs, M)) || (has(vs, M) && has(vs, B));
  }).map((ch) => ({ ch, edges: [[A, M], [M, B]] }));
}

export function floodFill(drawing, seedCell, opts = {}) {
  const level = seedCell.l;
  const inBounds = opts.inBounds || (() => true);
  const maxCells = opts.maxCells ?? 20000;
  const isPainted = (c) => drawing.cells.has(L.cellKey(c));
  const sub = (c) => (drawing.sub.get(L.cellKey(c)) || 0) > 0;

  // An empty cell grows up to the coarsest empty ancestor at or finer than `level`.
  const climbEmpty = (c) => {
    while (c.l > level) {
      const p = L.parent(c);
      if (sub(p) || isPainted(p)) break;
      c = p;
    }
    return c;
  };
  // The leaf (or leaves) covering cell y along the edge e0-e1.
  const leavesAcross = (y, e0, e1, out) => {
    const anc = isPainted(y) ? { cell: y, v: drawing.cells.get(L.cellKey(y)) } : drawing.paintedAncestor(y);
    if (anc) { out.push({ cell: anc.cell, kind: 'paint', v: anc.v }); return; }
    if (!sub(y) && y.l >= level) { out.push({ cell: climbEmpty(y), kind: 'empty' }); return; }
    if (y.l >= L.MAX_LEVEL) { out.push({ cell: y, kind: 'empty' }); return; }
    for (const { ch } of childrenOnEdge(y, e0, e1)) {
      const lv = L.cellVerts(ch);
      // Pass on the half of the edge this child touches.
      const A = [2 * e0[0], 2 * e0[1]], M = [e0[0] + e1[0], e0[1] + e1[1]], B = [2 * e1[0], 2 * e1[1]];
      const hasV = (v) => lv.some((w) => w[0] === v[0] && w[1] === v[1]);
      if (hasV(A) && hasV(M)) leavesAcross(ch, A, M, out); else leavesAcross(ch, M, B, out);
    }
  };

  // The seed leaf: the stored thing under the seed cell's centroid.
  let seed;
  const sc = drawing.colorAt(seedCell);
  if (sc.kind === 'paint') seed = { cell: sc.cell, kind: 'paint', v: sc.v };
  else if (sc.kind === 'empty') seed = { cell: seedCell, kind: 'empty' };
  else {
    // Mixed: descend to the finer leaf under the seed's centroid.
    const cen = L.centroid(seedCell);
    const leaf = drawing.leafAt(cen.x, cen.y);
    if (leaf) seed = { cell: leaf.cell, kind: 'paint', v: leaf.v };
    else {
      let c = seedCell;
      while (c.l < L.MAX_LEVEL && sub(c)) c = L.hitTest(c.l + 1, cen.x, cen.y);
      seed = { cell: climbEmpty(c), kind: 'empty' };
    }
  }
  const match = (leaf) => (seed.kind === 'empty' ? leaf.kind === 'empty' : leaf.kind === 'paint' && leaf.v.c === seed.v.c);

  const seen = new Map([[L.cellKey(seed.cell), seed]]);
  const queue = [seed];
  let tooBig = false;
  while (queue.length) {
    const cur = queue.shift();
    for (const { cell: y } of L.edgeNeighbors(cur.cell)) {
      const [e0, e1] = sharedVerts(cur.cell, y);
      const found = [];
      leavesAcross(y, e0, e1, found);
      for (const leaf of found) {
        const k = L.cellKey(leaf.cell);
        if (seen.has(k) || !match(leaf)) continue;
        if (seed.kind === 'empty' && !inBounds(leaf.cell)) continue;
        seen.set(k, leaf);
        if (seen.size > maxCells) { tooBig = true; break; }
        queue.push(leaf);
      }
      if (tooBig) break;
    }
    if (tooBig) break;
  }
  if (tooBig) return { tooBig: true, leaves: [] };
  return { tooBig: false, leaves: [...seen.values()], seed };
}

// Fill at `level`, and if that would need more than maxCells, at bigger cells
// (one level coarser at a time) instead, so a fill stays fast and never
// refuses (owner, 2026-10-12). Returns {leaves, level, tooBig}.
export function fillAt(drawing, x, y, level, opts = {}) {
  for (let l = level; l >= 0; l--) {
    const r = floodFill(drawing, L.hitTest(l, x, y), opts);
    if (!r.tooBig) return { leaves: r.leaves, level: l, tooBig: false };
  }
  return { leaves: [], level: 0, tooBig: true };
}
