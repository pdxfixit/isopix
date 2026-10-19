// The starter stamps' packed form (web/stamps.js, written by
// tools/make_stamps.mjs), four times smaller gzipped than the stamps as cell
// lists (owner: "size is a huge consideration"). Pure, no imports, so the
// generator and the app share it.
//
// A stamp's cells are all at its own level (dl 0). Packed, it is a palette,
// `pal` (each "#rrggbb" plus its face tag T, L or R, if any), and `rows`:
// one "dp,c0,runs" per lattice row dp, space-separated, where column c is
// 2·dq + u and runs gives each column from c0 on, a palette index in base 36
// or "." for none.

export function pack(stamp) {
  const pal = [], idx = new Map(), rows = new Map();
  for (const [dl, dp, dq, u, c, f] of stamp.cells) {
    if (dl !== 0) throw new Error('a starter stamp has cells at its own level only');
    const k = c + (f || '');
    if (!idx.has(k)) idx.set(k, pal.length), pal.push(k);
    if (!rows.has(dp)) rows.set(dp, []);
    rows.get(dp).push([2 * dq + u, idx.get(k)]);
  }
  if (pal.length > 36) throw new Error('a starter stamp has more than 36 colors');
  const out = [...rows].sort((a, b) => a[0] - b[0]).map(([dp, cs]) => {
    cs.sort((a, b) => a[0] - b[0]);
    let runs = '', at = cs[0][0];
    for (const [c, i] of cs) { runs += '.'.repeat(c - at) + i.toString(36); at = c + 1; }
    return `${dp},${cs[0][0]},${runs}`;
  });
  return { pal, rows: out.join(' ') };
}

export function unpack({ pal, rows }) {
  const cells = [];
  for (const row of rows ? rows.split(' ') : []) {
    const [dp, c0, runs] = row.split(',');
    [...runs].forEach((ch, k) => {
      if (ch === '.') return;
      const c = +c0 + k, k2 = pal[parseInt(ch, 36)];
      cells.push([0, +dp, Math.floor(c / 2), c - 2 * Math.floor(c / 2), k2.slice(0, 7), k2[7] || null]);
    });
  }
  return { base: 0, cells, edges: [] };
}
