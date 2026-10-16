#!/usr/bin/env node
// Render an Isopix drawing as SVG (Isopix file format 1.0, spec/README.md).
//
//   node render-svg.mjs drawing.isopix.json > drawing.svg
//   node render-svg.mjs drawing.isopix.png  > drawing.svg      (also .isopix)
//
// Node.js, no packages. Public domain (CC0): copy it anywhere.
import fs from 'node:fs';
import zlib from 'node:zlib';

const PAPER = { light: '#f7f5f0', dark: '#1f2228' };
const DIRS = [[1, 0], [0, 1], [-1, 1]]; // edge directions d = 0, 1, 2

// The drawing's JSON from any container: .isopix.png, .isopix (gzip) or .isopix.json.
export function read(bytes) {
  if (bytes[0] === 0x1f && bytes[1] === 0x8b) bytes = zlib.gunzipSync(bytes);
  if (bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) bytes = pngText(bytes);
  const doc = JSON.parse(bytes.toString('utf8'));
  if (!doc || doc.format !== 'isopix' || doc.version !== 1) throw new Error('not an Isopix 1.0 drawing');
  return doc;
}

// The text of the PNG's iTXt chunk with the keyword "isopix".
function pngText(png) {
  for (let i = 8; i + 8 <= png.length;) {
    const n = png.readUInt32BE(i), kind = png.toString('latin1', i + 4, i + 8), body = png.subarray(i + 8, i + 8 + n);
    i += 12 + n;
    if (kind !== 'iTXt') continue;
    let at = body.indexOf(0);
    if (body.toString('latin1', 0, at) !== 'isopix') continue;
    const packed = body[at + 1];
    at = body.indexOf(0, at + 3); // language tag
    at = body.indexOf(0, at + 1); // translated keyword
    const text = body.subarray(at + 1);
    return packed ? zlib.inflateSync(text) : text;
  }
  throw new Error('this PNG has no Isopix drawing inside');
}

// Grid point (p, q) at level l, in world units (y down).
const point = (l, p, q) => { const s = 2 ** -l; return [q * (Math.sqrt(3) / 2) * s, (p + q / 2) * s]; };

function corners(key) {
  const [l, p, q, u] = key.split(',').map(Number);
  const pts = u ? [[p, q], [p + 1, q], [p, q + 1]] : [[p + 1, q], [p, q + 1], [p + 1, q + 1]];
  return [l, pts.map(([a, b]) => point(l, a, b))];
}

function ends(key) {
  const [l, p, q, d] = key.split(',').map(Number);
  const [dp, dq] = DIRS[d];
  return [l, point(l, p, q), point(l, p + dp, q + dq)];
}

export function svg(doc) {
  const pic = doc.picture;
  const tris = Object.entries(pic.cells || {}).map(([key, color]) => [color, ...corners(key)]);
  const lines = Object.entries(pic.edges || {}).map(([key, color]) => [color, ...ends(key)]);
  const pts = [...tris.flatMap(([, , c]) => c), ...lines.flatMap(([, , a, b]) => [a, b])];
  if (!pts.length) pts.push([0, 0]);
  const xs = pts.map((v) => v[0]), ys = pts.map((v) => v[1]);
  const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
  const pad = 0.05 * Math.max(x1 - x0, y1 - y0, 0.1);
  const vb = [x0 - pad, y0 - pad, x1 - x0 + 2 * pad, y1 - y0 + 2 * pad];
  const f = (v) => String(Number(v.toPrecision(6)));
  const out = [`<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vb.map(f).join(' ')}" width="${f(vb[2] * 512)}" height="${f(vb[3] * 512)}">`,
    `<rect x="${f(vb[0])}" y="${f(vb[1])}" width="${f(vb[2])}" height="${f(vb[3])}" fill="${PAPER[pic.paper] || PAPER.light}"/>`];
  // A hairline in the cell's own color hides the seams between neighbors.
  for (const [color, l, c] of tris) out.push(`<polygon points="${c.map(([x, y]) => `${f(x)},${f(y)}`).join(' ')}" fill="${color}" stroke="${color}" stroke-width="${f(0.02 * 2 ** -l)}" stroke-linejoin="round"/>`);
  for (const [color, l, a, b] of lines) out.push(`<line x1="${f(a[0])}" y1="${f(a[1])}" x2="${f(b[0])}" y2="${f(b[1])}" stroke="${color}" stroke-width="${f(0.14 * 2 ** -l)}" stroke-linecap="round"/>`);
  out.push('</svg>');
  return out.join('\n') + '\n';
}

if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href) {
  if (process.argv.length !== 3) { console.error('usage: node render-svg.mjs drawing.isopix.json'); process.exit(2); }
  try { process.stdout.write(svg(read(fs.readFileSync(process.argv[2])))); } catch (err) { console.error(err.message); process.exit(1); }
}
