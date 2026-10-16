// The drawing model: a sparse map from cell key to value, bold edges, the
// hidden children that coarsening keeps, and the undo log.
// Pure logic, no DOM.
//
// Invariant: any region is covered by one painted cell OR by its painted
// descendants, never both. `sub` counts painted descendants per cell, so
// "does this cell have finer detail?" is one lookup.
//
// A value is {c: '#rrggbb', f?: 'T'|'L'|'R', t, id}. c is the color as drawn,
// f an optional cube-face tag (so a recolor keeps the shading), t the paint
// time used for tie-breaks, id a unique token (hidden children are valid only
// while the cell still holds the value with that id).
//
// Every mutation goes through setCell / setEdge / setHidden. Inside a
// transaction (begin ... commit) the first "before" of each key is logged, so
// commit gives an exact diff, rollback restores, and undo/redo replay diffs.
import * as L from './lattice.js';

export class Drawing {
  constructor() {
    this.cells = new Map();
    this.sub = new Map();
    this.edges = new Map();
    this.hidden = new Map();
    // Bold edges a coarsen hid, so refining brings them back exactly:
    // 'c:<cellKey>' -> {edges: [[edgeKey, value]]}, edges that lay inside that cell;
    // 'e:<edgeKey>' -> {t, halves: [[edgeKey, value|null] x2]}, what a merged edge was made of.
    this.hiddenEdges = new Map();
    this.seq = 0;
    this.tx = null;
    this.undoStack = [];
    this.redoStack = [];
    this.version = 0; // bumps on any change, for the renderer
    this.emptyHidden = 0; // how many hidden entries belong to emptied cells
    // Cell keys changed since the renderer last looked (it clears them), so
    // its cached bitmap redraws only that area. Too many: redraw everything.
    this.dirty = new Set();
    this.dirtyOverflow = false;
    this.paper = 'light'; // each drawing keeps its own paper (engine/paper.js)
    this.light = 'left'; // and the side auto-shade lights cube faces from (engine/color.js)
  }

  nextId() { return ++this.seq; }

  makeValue(spec, t) {
    const id = this.nextId();
    const v = { c: spec.c, t: t ?? id, id };
    if (spec.f) v.f = spec.f;
    if (spec.f && spec.s === 'r') v.s = 'r'; // shaded with the light on the right (engine/color.js)
    if (spec.f && spec.b) v.b = spec.b; // the base color it was shaded from, so Relight is exact
    return v;
  }
  inherit(v) { return { ...v, id: this.nextId() }; }

  // ---------- primitives ----------
  _log(map, k, before) {
    if (this.tx && !this.tx[map].has(k)) this.tx[map].set(k, before === undefined ? null : before);
  }
  setCell(k, v) {
    const before = this.cells.get(k);
    if (before === v || (before === undefined && v == null)) return;
    this._log('cells', k, before);
    if (v == null) { this.cells.delete(k); this._bump(k, -1); }
    else { this.cells.set(k, v); if (before === undefined) this._bump(k, 1); }
    if (this.dirty.size < 50000) this.dirty.add(k); else this.dirtyOverflow = true;
    this.version++;
  }
  _bump(k, d) {
    let c = L.parseKey(k);
    while (c.l > 0) {
      c = L.parent(c);
      const ak = L.cellKey(c);
      const n = (this.sub.get(ak) || 0) + d;
      if (n) this.sub.set(ak, n); else this.sub.delete(ak);
    }
  }
  setEdge(k, v) {
    const before = this.edges.get(k);
    if (before === v || (before === undefined && v == null)) return;
    this._log('edges', k, before);
    if (v == null) this.edges.delete(k); else this.edges.set(k, v);
    this.version++;
  }
  setHidden(k, v) {
    const before = this.hidden.get(k);
    if (before === v || (before === undefined && v == null)) return;
    this._log('hidden', k, before);
    this.emptyHidden += (v?.empty ? 1 : 0) - (before?.empty ? 1 : 0);
    if (v == null) this.hidden.delete(k); else this.hidden.set(k, v);
  }

  setHiddenEdge(k, v) {
    const before = this.hiddenEdges.get(k);
    if (before === v || (before === undefined && v == null)) return;
    this._log('hiddenEdges', k, before);
    if (v == null) this.hiddenEdges.delete(k); else this.hiddenEdges.set(k, v);
  }
  // Drop edges a coarsen hid inside cells that `touches(cell)` says were drawn over.
  _dropHiddenEdges(touches) {
    if (!this.hiddenEdges.size) return;
    for (const k of [...this.hiddenEdges.keys()]) if (k.startsWith('c:') && touches(L.parseKey(k.slice(2)))) this.setHiddenEdge(k, null);
  }

  // ---------- transactions and undo ----------
  begin(label = '') {
    if (this.tx) throw new Error('transaction already open');
    this.tx = { label, cells: new Map(), edges: new Map(), hidden: new Map(), hiddenEdges: new Map() };
  }
  get inTx() { return !!this.tx; }
  _diff(tx) {
    const out = { label: tx.label, cells: [], edges: [], hidden: [], hiddenEdges: [] };
    for (const name of ['cells', 'edges', 'hidden', 'hiddenEdges']) {
      for (const [k, b] of tx[name]) {
        const a = this[name].get(k) ?? null;
        if (a !== b) out[name].push([k, b, a]);
      }
    }
    return out;
  }
  static isEmptyDiff(d) { return !d.cells.length && !d.edges.length && !d.hidden.length && !(d.hiddenEdges || []).length; }
  commit() {
    const tx = this.tx;
    this.tx = null;
    if (!tx) return null;
    const d = this._diff(tx);
    if (Drawing.isEmptyDiff(d)) return null;
    this.undoStack.push(d);
    this.redoStack.length = 0;
    return d;
  }
  rollback() {
    const tx = this.tx;
    this.tx = null;
    if (!tx) return;
    for (const [k, b] of tx.cells) this.setCell(k, b);
    for (const [k, b] of tx.edges) this.setEdge(k, b);
    for (const [k, b] of tx.hidden) this.setHidden(k, b);
    for (const [k, b] of tx.hiddenEdges) this.setHiddenEdge(k, b);
  }
  applyDiff(d, side) { // side 1 = before, 2 = after
    for (const e of d.cells) this.setCell(e[0], e[side]);
    for (const e of d.edges) this.setEdge(e[0], e[side]);
    for (const e of d.hidden) this.setHidden(e[0], e[side]);
    for (const e of d.hiddenEdges || []) this.setHiddenEdge(e[0], e[side]); // logs before 2026-10-12 have none
  }
  undo() {
    if (this.tx) this.rollback();
    const d = this.undoStack.pop();
    if (!d) return null;
    this.applyDiff(d, 1);
    this.redoStack.push(d);
    return d;
  }
  redo() {
    if (this.tx) this.rollback();
    const d = this.redoStack.pop();
    if (!d) return null;
    this.applyDiff(d, 2);
    this.undoStack.push(d);
    return d;
  }
  clear() {
    this.cells.clear(); this.sub.clear(); this.edges.clear(); this.hidden.clear(); this.hiddenEdges.clear(); this.emptyHidden = 0;
    this.dirty.clear(); this.dirtyOverflow = true;
    this.undoStack = []; this.redoStack = []; this.tx = null; this.version++;
  }

  // ---------- queries ----------
  get(c) { return this.cells.get(L.cellKey(c)); }
  hasDetail(c) { return (this.sub.get(L.cellKey(c)) || 0) > 0; }
  paintedAncestor(c) {
    let a = c;
    while (a.l > 0) {
      a = L.parent(a);
      const v = this.cells.get(L.cellKey(a));
      if (v) return { cell: a, v };
    }
    return null;
  }
  // What covers cell c: {kind: 'paint', v, cell} | {kind: 'mixed'} | {kind: 'empty'}.
  colorAt(c) {
    const v = this.cells.get(L.cellKey(c));
    if (v) return { kind: 'paint', v, cell: c };
    const a = this.paintedAncestor(c);
    if (a) return { kind: 'paint', v: a.v, cell: a.cell };
    if (this.hasDetail(c)) return { kind: 'mixed' };
    return { kind: 'empty' };
  }
  // The finest thing under a world point: the painted cell there, or null.
  leafAt(x, y) {
    for (let l = 0; l <= L.MAX_LEVEL; l++) {
      const c = L.hitTest(l, x, y);
      const k = L.cellKey(c);
      const v = this.cells.get(k);
      if (v) return { cell: c, v };
      if (!this.sub.get(k)) return null;
    }
    return null;
  }
  // Total painted area in level-0 cells.
  area() {
    let a = 0;
    for (const k of this.cells.keys()) a += 4 ** -L.parseKey(k).l;
    return a;
  }

  // ---------- painting ----------
  // Split any painted ancestor of c down the chain, so c itself is painted
  // with the ancestor's color (its siblings at every level keep the color).
  splitDownTo(c) {
    const anc = this.paintedAncestor(c);
    if (!anc) return;
    let cur = anc.cell, v = anc.v;
    while (cur.l < c.l) {
      this.setCell(L.cellKey(cur), null);
      let next = null;
      for (const ch of L.children(cur)) {
        this.setCell(L.cellKey(ch), this.inherit(v));
        if (L.isAncestorOrSelf(ch, c)) next = ch;
      }
      cur = next;
      v = this.cells.get(L.cellKey(cur));
    }
  }
  clearDescendants(c, k = L.cellKey(c)) {
    if (!(this.sub.get(k) > 0)) return;
    for (const ch of L.children(c)) {
      const ck = L.cellKey(ch);
      if (this.cells.has(ck)) this.setCell(ck, null);
      else this.clearDescendants(ch, ck);
    }
  }
  // Paint cell c with spec {c, f?}, or erase it when spec is null.
  // mode 'replace': overwrite everything in c.
  // mode 'protect': skip c when it already has finer detail inside.
  // mode 'behind':  fill only the empty parts of c; keep everything painted.
  // Returns true when something changed.
  paint(c, spec, mode = 'replace') {
    const k = L.cellKey(c);
    const v0 = this.version;
    if (mode === 'behind' && spec) { this._behind(c, k, spec, true); return this.version !== v0; }
    if (mode === 'protect' && this.sub.get(k) > 0) return false;
    const cur = this.cells.get(k);
    if (spec && cur && cur.c === spec.c && (cur.f || null) === (spec.f || null)) return false;
    this.dropHidden(c);
    this.splitDownTo(c);
    this.clearDescendants(c, k);
    this.setCell(k, spec ? this.makeValue(spec) : null);
    return this.version !== v0;
  }
  _behind(c, k, spec, checkAncestors) {
    if (this.cells.has(k)) return;
    if (checkAncestors && this.paintedAncestor(c)) return;
    if (!(this.sub.get(k) > 0)) { this.dropHidden(c); this.setCell(k, this.makeValue(spec)); return; }
    for (const ch of L.children(c)) this._behind(ch, L.cellKey(ch), spec, false);
  }
  // Painting on a cell ends the "keep fidelity" promise for it: drop hidden
  // children kept by a coarsen at this cell or its ancestors (a direct lookup
  // each), and emptied-cell entries below it (only those can come back
  // without their id matching, so only those are scanned).
  dropHidden(c) {
    this._dropHiddenEdges((h) => L.isAncestorOrSelf(h, c) || L.isAncestorOrSelf(c, h));
    if (!this.hidden.size) return;
    for (let a = c; ; a = L.parent(a)) {
      const k = L.cellKey(a);
      if (this.hidden.has(k)) this.setHidden(k, null);
      if (a.l === 0) break;
    }
    if (!this.emptyHidden) return;
    for (const [k, h] of [...this.hidden]) if (h.empty && L.isAncestorOrSelf(c, L.parseKey(k))) this.setHidden(k, null);
  }
  paintEdge(e, spec) {
    const k = L.edgeKey(e);
    // Drawing a bold line over a cell ends the promise for edges hidden in it.
    const [a] = L.edgeCells(e);
    this._dropHiddenEdges((h) => h.l <= a.l && L.isAncestorOrSelf(h, a));
    if (!spec) { this.setEdge(k, null); return; }
    const cur = this.edges.get(k);
    if (cur && cur.c === spec.c) return;
    this.setEdge(k, { c: spec.c, t: this.nextId() });
  }

  // Rebuild `sub` from cells (after loading).
  rebuildSub() {
    this.sub.clear();
    for (const k of this.cells.keys()) this._bump(k, 1);
  }
  // Check the invariant: no painted cell has a painted ancestor, and sub
  // matches. For tests.
  checkInvariant() {
    const sub = new Map();
    for (const k of this.cells.keys()) {
      let c = L.parseKey(k);
      while (c.l > 0) {
        c = L.parent(c);
        const ak = L.cellKey(c);
        if (this.cells.has(ak)) return `cell ${k} has painted ancestor ${ak}`;
        sub.set(ak, (sub.get(ak) || 0) + 1);
      }
    }
    if (sub.size !== this.sub.size) return `sub size ${this.sub.size} != ${sub.size}`;
    for (const [k, n] of sub) if (this.sub.get(k) !== n) return `sub ${k} = ${this.sub.get(k)} != ${n}`;
    return null;
  }
}
