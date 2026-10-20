// Checks a stamp handed in under the stamp art contract (docs/stamp-art-contract.md):
// a JSON file of parts, from an artist, another agent or another model. Prints
// ACCEPT, or one REJECT line per problem, each saying how to fix it, to send back
// to whoever drew it (never hand-fix delivered art). Draws the stamp from every
// side, in a grid of two by two, beside the file (<id>.svg) to look at by eye.
//
//   node tools/stamp_check.mjs <stamp.json> [--out DIR] [--replace]
//     --replace   the id may be a starter stamp's (new art for a stamp that ships)
// Exit 0 on ACCEPT (warnings allowed), 1 on REJECT, 2 on bad arguments.
import fs from 'node:fs';
import path from 'node:path';
import * as ART from '../web/engine/stampart.js';
import { fromParts } from '../web/engine/stampmodels.js';
import * as SB from '../web/stampbook.js';
import { gridSVG } from './stampsheet.mjs';

export const CONTRACT = 1;
const LIMIT = { coord: 60, parts: 400, cells: 600, warnCells: 450, name: 20, id: 24 };
const SIDES = ['+x', '-x', '+y', '-y', 'top'], FACES = ['+x', '-x', '+y', '-y', 'up'];
const GROUPS = SB.GROUPS.map((g) => g.id).filter((g) => !['letters', 'numbers', 'sacred'].includes(g));
const PALETTE = new Set(Object.values(ART.COLORS).map((c) => c.toLowerCase()));

// Whole half units; a detail part (shown from 2× up) may also use halves of them (.5).
let isInt;
const halves = (n) => Number.isInteger(n * 2) && Math.abs(n) <= LIMIT.coord;
const isTriple = (v) => Array.isArray(v) && v.length === 3 && v.every(isInt);
const isPair = (v) => Array.isArray(v) && v.length === 2 && v.every(isInt);
// The sizes a part shows at: from minSize (1 or 2) up, below maxSize (1).
const shownAt = (p, s) => (p.minSize ?? 0) <= s && s < (p.maxSize ?? Infinity);
const TIERS = [{ s: 1, k: 1, at: '' }, { s: 0.5, k: 1, at: ' at ½×' }, { s: 2, k: 2, at: ' at 2×' }];
const isColor = (c) => typeof c === 'string' && /^#[0-9a-f]{6}$/i.test(c);

// Every problem in a stamp object: [{code, msg}] rejections and [msg] warnings.
export function check(stamp, { replace = false } = {}) {
  const rej = [], warn = [];
  const R = (code, msg) => rej.push({ code, msg });
  if (!stamp || typeof stamp !== 'object' || Array.isArray(stamp)) { R('R1', 'the file is not one JSON object: send exactly the object, nothing before or after it'); return { rej, warn }; }
  if (stamp.contract !== CONTRACT) R('R2', `"contract" must be ${CONTRACT}, the version of the contract this file follows`);
  if (typeof stamp.id !== 'string' || !/^[a-z][a-z0-9]*(-[a-z0-9]+)*$/.test(stamp.id) || stamp.id.length > LIMIT.id) R('R3', `"id" must be lowercase letters and digits, single dashes between words, at most ${LIMIT.id} long (like "fire-truck")`);
  else if (!replace && SB.STARTER.some((s) => s.id === stamp.id)) R('R3', `"id" "${stamp.id}" is a stamp that already ships: pick a new id, or say this is new art for it (check with --replace)`);
  if (typeof stamp.name !== 'string' || !stamp.name.trim() || stamp.name.length > LIMIT.name) R('R4', `"name" must be the stamp's name as a child would say it, 1 to ${LIMIT.name} characters (like "Fire truck")`);
  if (!GROUPS.includes(stamp.group)) R('R5', `"group" must be one of: ${GROUPS.join(', ')}`);
  for (const k of ['author', 'tool']) if (stamp[k] !== undefined && (typeof stamp[k] !== 'string' || stamp[k].length > 80)) R('R4', `"${k}" must be a short line of text`);
  const parts = stamp.parts;
  if (!Array.isArray(parts) || !parts.length || parts.length > LIMIT.parts) { R('R6', `"parts" must be a list of 1 to ${LIMIT.parts} parts`); return { rej, warn }; }
  parts.forEach((p, i) => {
    const at = `part ${i + 1}`;
    const kinds = ['box', 'decal', 'slope'].filter((k) => p && typeof p === 'object' && k in p);
    if (kinds.length !== 1) { R('R7', `${at} must have exactly one of "box", "decal" or "slope"`); return; }
    if (!isColor(p.color)) R('R7', `${at}: "color" must be "#rrggbb"`);
    if (p.minSize !== undefined && ![1, 2].includes(p.minSize)) R('R13', `${at}: "minSize" is 2 (detail, from twice the size up) or 1 (hidden below its own size)`);
    if (p.maxSize !== undefined && (p.maxSize !== 1 || p.minSize !== undefined)) R('R13', `${at}: "maxSize" is 1 (a stand-in shown only below its own size), and not with "minSize"`);
    isInt = halves; // halves pass here; R13 below says they are only for detail
    if (kinds[0] === 'box') {
      if (!isTriple(p.box)) R('R7', `${at}: "box" is the corner nearest the back, [x, y, z], three whole numbers in half units from -${LIMIT.coord} to ${LIMIT.coord}`);
      if (!isTriple(p.size) || p.size.some((n) => n < (p.minSize === 2 ? 0.5 : 1))) R('R7', `${at}: "size" is [width along x, depth along y, height], in half units, each at least 1 (½ for detail)`);
    } else if (kinds[0] === 'decal') {
      if (!SIDES.includes(p.decal)) R('R7', `${at}: "decal" is the side it is on: ${SIDES.join(', ')}`);
      if (!isInt(p.at) || !isPair(p.from) || !isPair(p.to)) R('R7', `${at}: a decal needs "at" (a whole number) and "from" and "to" ([a, b] whole numbers), in half units`);
      else if (p.from[0] >= p.to[0] || p.from[1] >= p.to[1]) R('R8', `${at}: "from" must be below and before "to" in both numbers, so the decal has an area`);
    } else {
      if (!FACES.includes(p.faces)) R('R7', `${at}: "faces" is which way the slope faces: ${FACES.join(', ')}`);
      if (!Array.isArray(p.slope) || ![3, 4].includes(p.slope.length) || !p.slope.every(isTriple)) R('R9', `${at}: "slope" is 3 or 4 corners, each [x, y, z], whole numbers in half units`);
      else {
        // Each edge must run along a grid line: on screen those are the edges where two of
        // the changes in x, y and z are equal. Any other edge comes out saw-toothed.
        const c = p.slope, ok = c.every((u, k) => { const v = c[(k + 1) % c.length], [dx, dy, dz] = [0, 1, 2].map((m) => v[m] - u[m]); return dx === dy || dy === dz || dx === dz; });
        if (!ok) R('R9', `${at}: a slope edge cuts across the grid and would come out saw-toothed; a roof rises one half unit for every half unit it runs in from its edge (its peak half its base's width up)`);
        if (c.length === 4) {
          const [o, u, v, w] = c, d = (a2, b2) => [0, 1, 2].map((m) => a2[m] - b2[m]), x = (a2, b2) => [a2[1] * b2[2] - a2[2] * b2[1], a2[2] * b2[0] - a2[0] * b2[2], a2[0] * b2[1] - a2[1] * b2[0]];
          const n = x(d(u, o), d(v, o)), off = d(w, o);
          if (n[0] * off[0] + n[1] * off[1] + n[2] * off[2] !== 0) R('R9', `${at}: a four-cornered slope must be flat: its fourth corner is off the plane of the first three`);
        }
      }
    }
    const nums = [p.box, p.size, p.at, p.from, p.to, p.slope].flat(2).filter((v) => typeof v === 'number');
    if ([undefined, 1].includes(p.minSize) && nums.some((v) => !Number.isInteger(v) && Number.isInteger(v * 2))) R('R13', `${at}: halves (.5) are only for detail, a part with "minSize": 2; elsewhere whole half units`);
    if (isColor(p.color) && !PALETTE.has(p.color.toLowerCase())) warn.push(`${at}: ${p.color} is not in the palette (section 5); fine if no palette color will do`);
  });
  if (rej.length) return { rej, warn };

  // Built and drawn at each size tier (its own size, ½×, 2× with its detail): on the
  // grid, no blocks overlapping, painted in order the same as by depth.
  const key = (cells) => JSON.stringify([...cells].map(([k, v]) => [k, v.c, v.f]).sort());
  const seen = new Set(), say = (code, msg) => { if (!seen.has(msg)) { seen.add(msg); R(code, msg); } };
  let painted, faces1;
  for (const { s, k, at } of TIERS) {
    const idx = parts.map((p, i) => (shownAt(p, s) ? i : -1)).filter((i) => i >= 0);
    const each = idx.map((i) => ART.scaled(fromParts([parts[i]]), k));
    let tierPaint;
    try { tierPaint = ART.paint(each.flat()); } catch {
      const n = each.findIndex((f) => { try { ART.paint(f); return false; } catch { return true; } });
      say('R9', `part ${idx[n] + 1}${at}: a corner falls between grid points; a slope must rise one half unit for every half unit it runs in from its edge (its peak half its base's width up), and only detail ("minSize": 2) may use halves (.5)`);
      continue;
    }
    if (s === 1) { painted = tierPaint; faces1 = each.flat(); }
    // Blocks may touch, never overlap: overlapping blocks have no order that draws right from every side.
    const boxes = idx.filter((i) => parts[i].box).map((i) => ({ i, a: parts[i].box, b: parts[i].box.map((v, m) => v + parts[i].size[m]) }));
    for (let m = 0; m < boxes.length; m++) for (let n = m + 1; n < boxes.length; n++) {
      const P = boxes[m], Q = boxes[n];
      if ([0, 1, 2].every((d) => P.a[d] < Q.b[d] && Q.a[d] < P.b[d])) say('R10', `parts ${P.i + 1} and ${Q.i + 1} overlap: blocks may touch but not share space; split one so they meet face to face`);
    }
    if (rej.length || key(tierPaint) === key(ART.render(each.flat(), 0))) continue;
    // Which parts: for each cell that comes out wrong, the part painted there last
    // against the part that is really in front there.
    const depthOf = ART.render(each.flat(), 0), mine = each.map((f) => ART.paint(f)), pairs = new Set();
    let shown = 0;
    for (const [c, v] of tierPaint) {
      const want = depthOf.get(c);
      if (!want || (want.c === v.c && want.f === v.f)) continue;
      const last = mine.map((m, n) => (m.has(c) ? n : -1)).reduce((a2, b2) => Math.max(a2, b2));
      const front = mine.findIndex((m, n) => n !== last && m.get(c)?.c === want.c && m.get(c)?.f === want.f);
      if (front < 0 || pairs.has(`${last} ${front}`) || shown >= 3) continue;
      pairs.add(`${last} ${front}`); shown++;
      say('R11', `part ${idx[last] + 1} is painted over part ${idx[front] + 1}${at}, which is in front of it: move part ${idx[last] + 1} before part ${idx[front] + 1} (back to front: far x and y first, low z first)`);
    }
    if (!shown) say('R11', `the parts are not in back-to-front order${at}: far x and y first, low z first, each decal right after its block`);
  }
  if (!painted) return { rej, warn };
  // A part never seen from any side at any of its sizes is a mistake, most often a decal
  // listed before the block it sits on (a tie on one face goes to the later part).
  if (!rej.length) {
    const seenPart = new Set();
    for (const { s, k } of TIERS) {
      const idx = parts.map((p, i) => (shownAt(p, s) ? i : -1)).filter((i) => i >= 0);
      const each = idx.map((i) => ART.scaled(fromParts([parts[i]]), k));
      for (const n of [0, 1, 2, 3]) {
        const all = n ? ART.render(each.flat(), n) : ART.paint(each.flat());
        each.forEach((f, m) => { const own = n ? ART.render(f, n) : ART.paint(f); for (const [c, v] of own) if (all.get(c)?.c === v.c && all.get(c)?.f === v.f) { seenPart.add(idx[m]); break; } });
      }
    }
    const hidden = parts.map((_, i) => i).filter((i) => !seenPart.has(i));
    if (hidden.length) warn.push(`part${hidden.length > 1 ? 's' : ''} ${hidden.map((i) => i + 1).join(', ')} never seen from any side: a decal goes after the block it sits on; a block inside another is wasted`);
  }
  const n = painted.size;
  if (n > LIMIT.cells) R('R12', `${n} cells at its own size: at most ${LIMIT.cells}; make it smaller or plainer`);
  else if (n > LIMIT.warnCells) warn.push(`${n} cells at its own size: over ${LIMIT.warnCells}, so it grows to fewer sizes; fine if it must be big`);
  // Something on every side: a stamp seen from behind should not be a blank.
  const sideHas = { R: 0, L: 0, r: 0, l: 0 };
  for (const p of parts) { const s = p.decal || p.faces; if (s === '+x') sideHas.R++; if (s === '+y') sideHas.L++; if (s === '-x') sideHas.r++; if (s === '-y') sideHas.l++; }
  const bare = Object.entries({ '+x': sideHas.R, '+y': sideHas.L, '-x': sideHas.r, '-y': sideHas.l }).filter(([, c]) => !c).map(([s]) => s);
  if (bare.length) warn.push(`no decal on the ${bare.join(', ')} side${bare.length > 1 ? 's' : ''}: Spin shows every side, so give each one something (rule 4), unless the shape alone says it`);
  if (!parts.some((p) => p.minSize === 2)) warn.push('no detail for 2× and up ("minSize": 2): the stamp looks the same, only bigger, when a child makes it big (rule 10)');
  return { rej, warn, cells: n, faces: faces1, parts };
}

// The stamp from every side, as docs/stamps/ draws one.
// Square, so a square thumbnail (a phone's preview, a file browser's) shows all four views.
export function sheetOf(faces) {
  const svg = gridSVG([0, 1, 2, 3].map((n) => { const c = n ? ART.render(faces, n) : ART.paint(faces); return ART.stampFrom(c, ART.anchorOf(c)); }));
  return svg.replace(/width="(\d+)" height="(\d+)" viewBox="([-\d.]+) ([-\d.]+) ([\d.]+) ([\d.]+)"><rect x="[-\d.]+" y="[-\d.]+" width="[\d.]+" height="[\d.]+"/, (_, w, h, x, y, vw, vh) => {
    const s = Math.max(+vw, +vh), X = +x - (s - vw) / 2, Y = +y - (s - vh) / 2;
    return `width="${Math.max(+w, +h)}" height="${Math.max(+w, +h)}" viewBox="${X} ${Y} ${s} ${s}"><rect x="${X}" y="${Y}" width="${s}" height="${s}"`;
  });
}

// The stamp as placed at its own size, twice and four times: its detail by size.
export function sizesOf(parts) {
  return gridSVG([[1, 1], [2, 2], [2, 4]].map(([s, k]) => {
    const c = ART.paint(ART.scaled(fromParts(parts.filter((p) => shownAt(p, s))), k));
    return ART.stampFrom(c, ART.anchorOf(c));
  }));
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const file = process.argv[2];
  if (!file || file.startsWith('-')) { console.error('usage: node tools/stamp_check.mjs <stamp.json> [--out DIR] [--replace]'); process.exit(2); }
  let stamp;
  try { stamp = JSON.parse(fs.readFileSync(file, 'utf8')); } catch (e) { console.log(`REJECT R1 ${path.basename(file)}: not readable JSON (${e.message}); send exactly one JSON object`); process.exit(1); }
  const res = check(stamp, { replace: process.argv.includes('--replace') });
  const id = typeof stamp?.id === 'string' ? stamp.id : path.basename(file, '.json');
  for (const w of res.warn) console.log(`WARN ${id}: ${w}`);
  if (res.rej.length) { for (const r of res.rej) console.log(`REJECT ${r.code} ${id}: ${r.msg}`); process.exit(1); }
  const outDir = process.argv.includes('--out') ? process.argv[process.argv.indexOf('--out') + 1] : path.dirname(path.resolve(file));
  const sheet = path.join(outDir, `${id}.svg`);
  fs.writeFileSync(sheet, sheetOf(res.faces));
  fs.writeFileSync(path.join(outDir, `${id}-sizes.svg`), sizesOf(res.parts));
  console.log(`ACCEPT ${id}: ${res.cells} cells at its own size; every side drawn in ${sheet}, and its sizes (1×, 2×, 4×) in ${id}-sizes.svg beside it (look at both: the check cannot judge the art)`);
}
