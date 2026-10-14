// Lattice math for Isopix: coordinates, hit testing, the parent/child
// hierarchy, neighbors, edges and the three lattice line families.
// Pure logic, no DOM. Every other engine module builds on this.
//
// A cell is {l, p, q, u}: level l (0 coarsest, 7 finest), lattice coords
// (p, q), and u = 1 for an "up" cell, 0 for a "down" cell. With lattice lines
// vertical, 30 deg and 150 deg (the standard isometric cube view), an "up"
// cell points right and a "down" cell points left on screen. The names stay
// up/down because they are the two orientations of the triangle.

export const MAX_LEVEL = 7;
export const LEVELS = 8;
export const S0 = 1; // edge length of a level-0 cell, in world units
export const H = Math.sqrt(3) / 2;
export const INV_SQRT3 = 1 / Math.sqrt(3);

export const edgeLen = (l) => S0 / 2 ** l;
export const mk = (l, p, q, u) => ({ l, p, q, u });
export const key = (l, p, q, u) => `${l},${p},${q},${u}`;
export const cellKey = (c) => `${c.l},${c.p},${c.q},${c.u}`;
export function parseKey(k) {
  const a = k.split(',');
  return { l: +a[0], p: +a[1], q: +a[2], u: +a[3] };
}
export const sameCell = (a, b) => a.l === b.l && a.p === b.p && a.q === b.q && a.u === b.u;

// Lattice vertex (p, q) at level l -> world point.
export function vertexWorld(l, p, q) {
  const s = edgeLen(l);
  return { x: q * H * s, y: (p + q / 2) * s };
}

// World point -> fractional lattice coords at level l.
export function worldToLattice(l, x, y) {
  const s = edgeLen(l);
  const qq = x / (H * s);
  return { pp: y / s - qq / 2, qq };
}

export function latticeToWorld(l, pp, qq) {
  const s = edgeLen(l);
  return { x: qq * H * s, y: (pp + qq / 2) * s };
}

// The three lattice vertices of a cell, as [p, q] pairs at the cell's level.
export function cellVerts(c) {
  const { p, q } = c;
  return c.u ? [[p, q], [p + 1, q], [p, q + 1]] : [[p + 1, q], [p, q + 1], [p + 1, q + 1]];
}
export const cellWorldVerts = (c) => cellVerts(c).map(([p, q]) => vertexWorld(c.l, p, q));

export function centroidLattice(c) {
  return c.u ? { pp: c.p + 1 / 3, qq: c.q + 1 / 3 } : { pp: c.p + 2 / 3, qq: c.q + 2 / 3 };
}
export function centroid(c) {
  const { pp, qq } = centroidLattice(c);
  return latticeToWorld(c.l, pp, qq);
}

// The cell at level l that holds lattice point (pp, qq).
export function cellAtLattice(l, pp, qq) {
  const fp = Math.floor(pp), fq = Math.floor(qq);
  const u = (pp - fp) + (qq - fq) < 1 ? 1 : 0;
  return { l, p: fp, q: fq, u };
}

// Hit test: the cell at level l under world point (x, y).
export function hitTest(l, x, y) {
  const { pp, qq } = worldToLattice(l, x, y);
  return cellAtLattice(l, pp, qq);
}

// Four children at level l+1: three corners pointing the same way, then the
// inverted middle child last.
export function children(c) {
  const l = c.l + 1, P = 2 * c.p, Q = 2 * c.q;
  return c.u
    ? [mk(l, P, Q, 1), mk(l, P + 1, Q, 1), mk(l, P, Q + 1, 1), mk(l, P, Q, 0)]
    : [mk(l, P + 1, Q, 0), mk(l, P, Q + 1, 0), mk(l, P + 1, Q + 1, 0), mk(l, P + 1, Q + 1, 1)];
}

export function parent(c) {
  const p = Math.floor(c.p / 2), q = Math.floor(c.q / 2);
  const a = c.p - 2 * p, b = c.q - 2 * q;
  const u = c.u ? (a + b < 2 ? 1 : 0) : (a + b === 0 ? 1 : 0);
  return mk(c.l - 1, p, q, u);
}

export function ancestorAt(c, k) {
  let a = c;
  while (a.l > k) a = parent(a);
  return a;
}
export const isAncestorOrSelf = (a, c) => a.l <= c.l && sameCell(ancestorAt(c, a.l), a);

// All descendants of c at level k (k >= c.l). 4^(k - l) cells: use with care.
export function descendantsAt(c, k) {
  let out = [c];
  for (let l = c.l; l < k; l++) out = out.flatMap(children);
  return out;
}

// The six cells around vertex (p, q) at level l.
export function cellsAroundVertex(l, p, q) {
  return [mk(l, p, q, 1), mk(l, p - 1, q, 1), mk(l, p, q - 1, 1),
    mk(l, p - 1, q - 1, 0), mk(l, p, q - 1, 0), mk(l, p - 1, q, 0)];
}

// The three neighbors across a cell's edges, with the shared edge's shape:
// 'v' vertical, '/' and '\\' as they look on screen.
export function edgeNeighbors(c) {
  const { l, p, q } = c;
  return c.u
    ? [{ cell: mk(l, p, q - 1, 0), edge: 'v' }, { cell: mk(l, p - 1, q, 0), edge: '\\' }, { cell: mk(l, p, q, 0), edge: '/' }]
    : [{ cell: mk(l, p, q + 1, 1), edge: 'v' }, { cell: mk(l, p + 1, q, 1), edge: '\\' }, { cell: mk(l, p, q, 1), edge: '/' }];
}

// Cube face of a rhombus, from its shared edge: vertical = top (light),
// "/" = left (mid), "\" = right (dark).
export const FACE_OF_EDGE = { 'v': 'T', '/': 'L', '\\': 'R' };

export const hexDist = (p, q) => Math.max(Math.abs(p), Math.abs(q), Math.abs(p + q));

export function nearestVertex(l, x, y) {
  const c = hitTest(l, x, y);
  let best = null, bd = Infinity;
  for (const [p, q] of cellVerts(c)) {
    const w = vertexWorld(l, p, q);
    const d = (w.x - x) ** 2 + (w.y - y) ** 2;
    if (d < bd) { bd = d; best = { l, p, q }; }
  }
  return best;
}

// Vertex at level l expressed at a finer level k (exact).
export const vertexAt = (v, k) => ({ l: k, p: v.p * 2 ** (k - v.l), q: v.q * 2 ** (k - v.l) });

// ---------- Edges ----------
// An edge is {l, p, q, d}: from vertex (p, q) to (p, q) + DIRS[d].
// d 0 = (1,0) vertical, d 1 = (0,1) "\" on screen, d 2 = (-1,1) "/" on screen.
export const DIRS = [[1, 0], [0, 1], [-1, 1]];
export const edgeKey = (e) => `${e.l},${e.p},${e.q},${e.d}`;
export function parseEdgeKey(k) {
  const a = k.split(',');
  return { l: +a[0], p: +a[1], q: +a[2], d: +a[3] };
}
export function edgeEnds(e) {
  const [dp, dq] = DIRS[e.d];
  return [[e.p, e.q], [e.p + dp, e.q + dq]];
}
// The edge between two adjacent lattice vertices, or null.
export function edgeBetween(l, a, b) {
  const dp = b[0] - a[0], dq = b[1] - a[1];
  for (let d = 0; d < 3; d++) {
    const [x, y] = DIRS[d];
    if (dp === x && dq === y) return { l, p: a[0], q: a[1], d };
    if (dp === -x && dq === -y) return { l, p: b[0], q: b[1], d };
  }
  return null;
}
// Refining an edge splits it into two edges at the next level.
export function edgeChildren(e) {
  const [dp, dq] = DIRS[e.d];
  const P = 2 * e.p, Q = 2 * e.q;
  return [{ l: e.l + 1, p: P, q: Q, d: e.d }, { l: e.l + 1, p: P + dp, q: Q + dq, d: e.d }];
}
// The coarser edge this edge is half of, or null when it does not lie on the
// coarser lattice.
export function edgeParent(e) {
  const { p, q, d } = e;
  if (d === 0) return q % 2 === 0 ? { l: e.l - 1, p: Math.floor(p / 2), q: q / 2, d } : null;
  if (d === 1) return p % 2 === 0 ? { l: e.l - 1, p: p / 2, q: Math.floor(q / 2), d } : null;
  if ((p + q) % 2 !== 0) return null;
  // Along a "/" line the vertices are (p - t, q + t); the coarse edge starts
  // at the vertex where both coordinates are even.
  const sp = (p % 2 === 0) ? p : p + 1;
  const sq = (p % 2 === 0) ? q : q - 1;
  return { l: e.l - 1, p: sp / 2, q: sq / 2, d };
}
// The two cells that share an edge.
export function edgeCells(e) {
  const [[p0, q0], [p1, q1]] = edgeEnds(e);
  const mp = (p0 + p1) / 2, mq = (q0 + q1) / 2;
  const eps = 1e-6;
  const off = e.d === 0 ? [0, eps] : e.d === 1 ? [eps, 0] : [eps, eps];
  return [cellAtLattice(e.l, mp + off[0], mq + off[1]), cellAtLattice(e.l, mp - off[0], mq - off[1])];
}

// ---------- Line families (for drawing gutters) ----------
// Family 'Q': q = k, the vertical line x = k*H*s.
// Family 'P': p = k, the line y = k*s + x/sqrt(3)   ("\" on screen).
// Family 'R': p + q = k, the line y = k*s - x/sqrt(3) ("/" on screen).
export const lineQx = (k, s) => k * H * s;
export const linePy = (k, s, x) => k * s + x * INV_SQRT3;
export const lineRy = (k, s, x) => k * s - x * INV_SQRT3;
// Range of k for each family that crosses a world-space box.
export function lineRanges(s, x0, y0, x1, y1) {
  const corners = [[x0, y0], [x1, y0], [x0, y1], [x1, y1]];
  const range = (f) => {
    let lo = Infinity, hi = -Infinity;
    for (const [x, y] of corners) { const k = f(x, y); lo = Math.min(lo, k); hi = Math.max(hi, k); }
    return [Math.floor(lo), Math.ceil(hi)];
  };
  return {
    Q: range((x) => x / (H * s)),
    P: range((x, y) => (y - x * INV_SQRT3) / s),
    R: range((x, y) => (y + x * INV_SQRT3) / s),
  };
}

// Gutter opacity from on-screen edge length.
export const gutterAlpha = (edgePx) => Math.min(1, Math.max(0, (edgePx - 5) / 25)) * 0.5;

// Cells in a lattice-coordinate bounding box at level l.
export function cellsInBox(l, p0, p1, q0, q1) {
  const out = [];
  for (let p = p0; p <= p1; p++) for (let q = q0; q <= q1; q++) { out.push(mk(l, p, q, 1), mk(l, p, q, 0)); }
  return out;
}
