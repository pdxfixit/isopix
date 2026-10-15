// The project inside a PNG (web/engine/pngproject.js).
import test from 'node:test';
import assert from 'node:assert/strict';
import zlib from 'node:zlib';
import { crc32, isPNG, chunks, embed, embedNow, extract, KEYWORD } from '../web/engine/pngproject.js';

// A real 1×1 PNG, made by hand with Node's zlib (an RGBA pixel).
function tinyPNG() {
  const chunk = (type, data) => {
    const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
    const td = Buffer.concat([Buffer.from(type, 'ascii'), data]);
    const crc = Buffer.alloc(4); crc.writeUInt32BE(zlib.crc32(td));
    return Buffer.concat([len, td, crc]);
  };
  const ihdr = Buffer.from([0, 0, 0, 1, 0, 0, 0, 1, 8, 6, 0, 0, 0]);
  const idat = zlib.deflateSync(Buffer.from([0, 58, 134, 255, 255]));
  return new Uint8Array(Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', idat), chunk('IEND', Buffer.alloc(0))]));
}
const deflate = async (b) => new Uint8Array(zlib.deflateSync(b));
const inflate = async (b) => new Uint8Array(zlib.inflateSync(b));
const project = JSON.stringify({ format: 'isopix', version: 1, name: 'Sky castle ☁️', cells: [['3,0,0,0', { c: '#3a86ff' }]] });

test('crc32 matches zlib', () => {
  for (const s of ['', 'IEND', 'isopix drawing ☁️']) {
    const b = new TextEncoder().encode(s);
    assert.equal(crc32(b), zlib.crc32(b));
  }
});

test('the drawing goes in and comes back out, compressed or plain', async () => {
  const png = tinyPNG();
  for (const z of [deflate, null]) {
    const out = await embed(png, project, z);
    assert.ok(isPNG(out));
    assert.equal(await extract(out, inflate), project);
    const types = chunks(out).map((c) => c.type);
    assert.deepEqual(types, ['IHDR', 'IDAT', 'iTXt', 'IEND'], 'the text sits just before IEND');
    for (const c of chunks(out)) {
      const td = out.subarray(c.start - 4, c.start + c.length);
      assert.equal(new DataView(out.buffer).getUint32(c.start + c.length), zlib.crc32(td), `${c.type} CRC`);
    }
  }
});

test('the at-once version (for the share sheet) reads back the same', async () => {
  const out = embedNow(tinyPNG(), project);
  assert.ok(out instanceof Uint8Array);
  assert.equal(await extract(out, inflate), project);
});

test('saving again replaces the drawing inside instead of adding a second one', async () => {
  const once = await embed(tinyPNG(), project, deflate);
  const twice = await embed(once, '{"second":true}', deflate);
  assert.equal(chunks(twice).filter((c) => c.type === 'iTXt').length, 1);
  assert.equal(await extract(twice, inflate), '{"second":true}');
});

test('a plain picture has no drawing; a damaged or non-PNG file is refused', async () => {
  assert.equal(await extract(tinyPNG(), inflate), null);
  const out = await embed(tinyPNG(), project, null);
  const bad = out.slice();
  bad[bad.length - 30] ^= 0xff; // a byte inside the text
  await assert.rejects(extract(bad, inflate), /damaged/);
  assert.throws(() => chunks(new TextEncoder().encode('{"format":"isopix"}')), /Not a PNG/);
  assert.equal(KEYWORD, 'isopix');
});
