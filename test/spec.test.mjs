// The open spec (spec/): its examples open in Isopix, the schema's patterns
// accept what Isopix saves, and both reference renderers draw exactly the
// triangles and lines Isopix does, from all three containers.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import zlib from 'node:zlib';
import { execFileSync } from 'node:child_process';
import * as P from '../web/engine/project.js';
import * as L from '../web/engine/lattice.js';
import * as PNGP from '../web/engine/pngproject.js';
import { Drawing } from '../web/engine/model.js';

const SPEC = new URL('../spec/', import.meta.url).pathname;
const examples = fs.readdirSync(path.join(SPEC, 'examples')).map((f) => path.join(SPEC, 'examples', f));

test('every example opens in Isopix', () => {
  assert.ok(examples.length >= 2);
  for (const f of examples) assert.equal(P.load(JSON.parse(fs.readFileSync(f, 'utf8'))).checkInvariant(), null, f);
});

test('the schema\'s key and color patterns accept what Isopix saves', () => {
  const s = JSON.parse(fs.readFileSync(path.join(SPEC, 'isopix.schema.json'), 'utf8'));
  const cellRe = new RegExp(s.properties.picture.properties.cells.propertyNames.pattern), edgeRe = new RegExp(s.properties.picture.properties.edges.propertyNames.pattern);
  const colorRe = new RegExp(s.$defs.color.pattern);
  const doc = P.save(drawn(), { name: 'x' });
  assert.equal(s.properties.version.const, doc.version);
  for (const [k, c] of Object.entries(doc.picture.cells)) assert.ok(cellRe.test(k) && colorRe.test(c), k);
  for (const [k, c] of Object.entries(doc.picture.edges)) assert.ok(edgeRe.test(k) && colorRe.test(c), k);
});

// A drawing with cells at three levels, both orientations, negative coordinates, a face and edges.
function drawn() {
  const d = new Drawing();
  d.begin();
  d.paint(L.mk(0, -1, 0, 1), { c: '#3a86ff', f: 'T', b: '#3a86ff' });
  d.paint(L.mk(1, 2, -3, 0), { c: '#e63946' });
  d.paint(L.mk(3, 9, 9, 1), { c: '#2a9d8f' });
  d.setEdge('2,1,1,2', { c: '#1d1e22', t: 1 });
  d.setEdge('0,3,0,0', { c: '#ffbe0b', t: 2 });
  d.commit();
  d.paper = 'dark';
  return d;
}
const r4 = (v) => Math.round(v * 1e4) / 1e4;
// What Isopix draws: each cell's three corners and color, each edge's ends and color.
function expected(doc) {
  const d = P.load(doc);
  const tris = [...d.cells].map(([k, v]) => `${v.c} ${L.cellWorldVerts(L.parseKey(k)).map((p) => `${r4(p.x)},${r4(p.y)}`).sort().join(' ')}`).sort();
  const lines = [...d.edges].map(([k, v]) => { const e = L.parseEdgeKey(k); return `${v.c} ${L.edgeEnds(e).map(([p, q]) => { const w = L.vertexWorld(e.l, p, q); return `${r4(w.x)},${r4(w.y)}`; }).sort().join(' ')}`; }).sort();
  return { tris, lines, paper: d.paper === 'dark' ? '#1f2228' : '#f7f5f0' };
}
// What a renderer drew, read back from its SVG.
function drew(svg) {
  const tris = [...svg.matchAll(/<polygon points="([^"]+)" fill="([^"]+)"/g)].map(([, pts, c]) => `${c} ${pts.split(' ').map((p) => p.split(',').map((v) => r4(+v)).join(',')).sort().join(' ')}`).sort();
  const lines = [...svg.matchAll(/<line x1="([^"]+)" y1="([^"]+)" x2="([^"]+)" y2="([^"]+)" stroke="([^"]+)"/g)].map(([, a, b, c, e, col]) => `${col} ${[`${r4(+a)},${r4(+b)}`, `${r4(+c)},${r4(+e)}`].sort().join(' ')}`).sort();
  const paper = /<rect [^>]*fill="([^"]+)"/.exec(svg)[1];
  return { tris, lines, paper };
}

test('both reference renderers draw what Isopix draws, from .isopix.json, .isopix and .isopix.png', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'isopix-spec-'));
  const doc = P.save(drawn(), { name: 'Spec check' });
  const json = JSON.stringify(doc);
  // A 1×1 PNG to carry the drawing, built here (signature, IHDR, IDAT, IEND).
  const chunk = (type, data) => { const t = Buffer.from(type, 'latin1'), len = Buffer.alloc(4), crc = Buffer.alloc(4); len.writeUInt32BE(data.length); crc.writeUInt32BE(PNGP.crc32(Buffer.concat([t, data])) >>> 0); return Buffer.concat([len, t, data, crc]); };
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(1, 0); ihdr.writeUInt32BE(1, 4); ihdr[8] = 8; ihdr[9] = 2;
  const png = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(Buffer.from([0, 255, 255, 255]))), chunk('IEND', Buffer.alloc(0))]);
  const files = {
    'a.isopix.json': json,
    'a.isopix': zlib.gzipSync(json),
    'a.isopix.png': Buffer.from(await PNGP.embed(new Uint8Array(png), json, async (b) => zlib.deflateSync(b))),
    'plain.isopix.png': Buffer.from(PNGP.embedNow(new Uint8Array(png), json)),
  };
  const want = expected(doc);
  assert.equal(want.tris.length, 3); assert.equal(want.lines.length, 2);
  for (const [name, bytes] of Object.entries(files)) {
    const f = path.join(dir, name);
    fs.writeFileSync(f, bytes);
    for (const run of [['python3', [path.join(SPEC, 'render-svg.py'), f]], ['node', [path.join(SPEC, 'render-svg.mjs'), f]]]) {
      const got = drew(execFileSync(run[0], run[1], { encoding: 'utf8' }));
      assert.deepEqual(got, want, `${path.basename(run[1][0])} on ${name}`);
    }
  }
  for (const f of examples) {
    const svgPy = execFileSync('python3', [path.join(SPEC, 'render-svg.py'), f], { encoding: 'utf8' });
    assert.deepEqual(drew(svgPy), expected(JSON.parse(fs.readFileSync(f, 'utf8'))), path.basename(f));
  }
  fs.rmSync(dir, { recursive: true, force: true });
});
