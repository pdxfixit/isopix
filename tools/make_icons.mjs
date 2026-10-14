#!/usr/bin/env node
// Draws the app icons (web/icons/icon-192.png, icon-512.png, icon.svg): a
// three-tone isometric cube on the paper color. Node with no dependencies:
// a tiny rasterizer and PNG encoder (node:zlib). Run: node tools/make_icons.mjs
import fs from 'node:fs';
import zlib from 'node:zlib';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const OUT = path.join(ROOT, 'web', 'icons');
const BG = [247, 245, 240];
const TOP = '#6ea8ff', LEFT = '#3a86ff', RIGHT = '#1f5fcc';
const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));

// The cube, in a 0..1 box: center (0.5, 0.52), radius 0.3 (maskable safe zone).
const r = 0.3, cx = 0.5, cy = 0.52, h = Math.sqrt(3) / 2;
const V = (a) => [cx + r * Math.cos(a), cy + r * Math.sin(a)];
const d = (deg) => (deg * Math.PI) / 180;
const top = [V(d(-90)), V(d(-30)), [cx, cy], V(d(-150))];
const right = [[cx, cy], V(d(-30)), V(d(30)), V(d(90))];
const left = [[cx, cy], V(d(90)), V(d(150)), V(d(-150))];
const faces = [[top, hex(TOP)], [left, hex(LEFT)], [right, hex(RIGHT)]];
void h;

function inside(poly, x, y) {
  let c = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i], [xj, yj] = poly[j];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) c = !c;
  }
  return c;
}

function png(size) {
  const ss = 4, raw = Buffer.alloc(size * (size * 4 + 1));
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0;
    for (let x = 0; x < size; x++) {
      const acc = [0, 0, 0];
      for (let sy = 0; sy < ss; sy++) for (let sx = 0; sx < ss; sx++) {
        const px = (x + (sx + 0.5) / ss) / size, py = (y + (sy + 0.5) / ss) / size;
        let col = BG;
        for (const [poly, c] of faces) if (inside(poly, px, py)) col = c;
        acc[0] += col[0]; acc[1] += col[1]; acc[2] += col[2];
      }
      const o = y * (size * 4 + 1) + 1 + x * 4;
      raw[o] = acc[0] / ss / ss; raw[o + 1] = acc[1] / ss / ss; raw[o + 2] = acc[2] / ss / ss; raw[o + 3] = 255;
    }
  }
  const crcTable = Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
  const crc = (buf) => { let c = 0xffffffff; for (const b of buf) c = crcTable[(c ^ b) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
  const chunk = (type, data) => {
    const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
    const td = Buffer.concat([Buffer.from(type), data]);
    const c = Buffer.alloc(4); c.writeUInt32BE(crc(td));
    return Buffer.concat([len, td, c]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4); ihdr[8] = 8; ihdr[9] = 6;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}

const pts = (poly) => poly.map(([x, y]) => `${(x * 100).toFixed(2)},${(y * 100).toFixed(2)}`).join(' ');
const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect width="100" height="100" rx="18" fill="rgb(${BG})"/>${faces.map(([p, c]) => `<polygon points="${pts(p)}" fill="rgb(${c})"/>`).join('')}</svg>\n`;

fs.mkdirSync(OUT, { recursive: true });
fs.writeFileSync(path.join(OUT, 'icon-192.png'), png(192));
fs.writeFileSync(path.join(OUT, 'icon-512.png'), png(512));
fs.writeFileSync(path.join(OUT, 'icon.svg'), svg);
console.log('🎨 wrote web/icons/icon-192.png, icon-512.png, icon.svg');
