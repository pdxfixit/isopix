// Splitting `just look`'s views into shards that run in parallel (`--shard i/n`,
// `--shards n`). Pure: no Chrome, no server, so test/look-shard.test.mjs checks
// the split without running a view.
//
// The split is fixed and deterministic: the slowest view goes to the emptiest
// shard first (longest first), by the seconds below, and each shard keeps the
// views in their usual order. So a shard always runs the same views, and a view
// that fails only in its shard's order fails there every time.

// Seconds each view took over CI's wide pass (5 widths), measured locally on
// 2026-10-20. A view not listed counts as SECONDS_DEFAULT. These only balance
// the shards: a stale number makes one shard a little longer, never skips a view.
export const SECONDS = {
  'gallery-ops': 57, 'gallery-delete': 45, 'gallery-menu': 37, gallery: 36,
  'stamp-spin': 23, idea: 20, 'stamp-turn': 20, 'stamp-plane': 19, 'drawing-new': 19,
  'stamp-size': 18, 'stamp-bigger': 17, video: 17, 'stamps-mine': 16, 'lesson-end': 16,
  'stamp-move': 16, palettes: 16, 'stamp-flip': 14, 'lesson-gallery': 14, stamps: 13,
  'replay-end': 12, 'palette-delete': 12, feedback: 11, update: 11, light: 11,
  selturn: 10, updatedone: 9, taps: 9, pinchpan: 9, lesson: 8, 'fold-open': 8,
  updatesel: 8, 'feedback-gate': 8, clean: 8,
};
export const SECONDS_DEFAULT = 6;
export const seconds = (names) => names.reduce((t, v) => t + (SECONDS[v] ?? SECONDS_DEFAULT), 0);

// "2/4" -> { i: 2, n: 4 } (1-based); anything else throws, naming what is wrong.
export function parseShard(s) {
  const m = /^(\d+)\/(\d+)$/.exec(String(s));
  const i = m ? Number(m[1]) : 0, n = m ? Number(m[2]) : 0;
  if (!m || n < 1 || i < 1 || i > n) throw new Error(`--shard takes i/n with 1 <= i <= n, like 2/4, not '${s}'`);
  return { i, n };
}

// Every shard's views: shards(names, n)[i - 1] is shard i/n. Each view lands in
// exactly one shard, and each shard keeps the order of `names`.
export function shards(names, n) {
  const cost = (v) => SECONDS[v.name] ?? SECONDS_DEFAULT;
  const order = names.map((name, at) => ({ name, at })).sort((a, b) => cost(b) - cost(a) || a.at - b.at);
  const load = Array(n).fill(0), out = Array.from({ length: n }, () => []);
  for (const v of order) {
    const k = load.indexOf(Math.min(...load));
    load[k] += cost(v);
    out[k].push(v);
  }
  return out.map((s) => s.sort((a, b) => a.at - b.at).map((v) => v.name));
}

// Shard i/n's views.
export const shard = (names, i, n) => shards(names, n)[i - 1];
