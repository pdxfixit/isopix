// The project inside a PNG: Save writes a picture that opens anywhere and
// also carries the whole drawing (Owner, 2026-10-15: "Let's do this by
// default, and with a setting to disable"). The project JSON goes in an iTXt
// chunk with the keyword "isopix", just before IEND; viewers ignore it, and
// Open reads it back. Pure logic on bytes, no DOM: compression is passed in
// (the browser's CompressionStream), so Node tests run it too.
//
// An iTXt chunk: keyword, NUL, compression flag (0 or 1), method (0 = zlib),
// language tag, NUL, translated keyword, NUL, then the UTF-8 text, zlib
// compressed when the flag is 1. https://www.w3.org/TR/png-3/#11iTXt

export const KEYWORD = 'isopix';
const SIGNATURE = [137, 80, 78, 71, 13, 10, 26, 10];

let table = null;
export function crc32(bytes) {
  if (!table) {
    table = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      table[n] = c >>> 0;
    }
  }
  let c = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) c = table[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

export const isPNG = (bytes) => bytes.length >= 8 && SIGNATURE.every((b, i) => bytes[i] === b);

// [{type, start, length}] for each chunk; start is where its data begins.
export function chunks(bytes) {
  if (!isPNG(bytes)) throw new Error('Not a PNG file');
  const out = [];
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let at = 8;
  while (at + 12 <= bytes.length) {
    const length = view.getUint32(at);
    const type = String.fromCharCode(...bytes.subarray(at + 4, at + 8));
    if (at + 12 + length > bytes.length) throw new Error('This PNG is cut short');
    out.push({ type, start: at + 8, length });
    at += 12 + length;
    if (type === 'IEND') break;
  }
  return out;
}

function chunk(type, data) {
  const out = new Uint8Array(12 + data.length);
  const view = new DataView(out.buffer);
  view.setUint32(0, data.length);
  for (let i = 0; i < 4; i++) out[4 + i] = type.charCodeAt(i);
  out.set(data, 8);
  view.setUint32(8 + data.length, crc32(out.subarray(4, 8 + data.length)));
  return out;
}

const ascii = (s) => Uint8Array.from(s, (c) => c.charCodeAt(0));

// The PNG with the text in an "isopix" iTXt chunk before IEND (an older one
// is replaced). deflate(bytes) returns zlib bytes, or null to store it plain.
export async function embed(png, text, deflate = null) {
  const utf8 = new TextEncoder().encode(text);
  return build(png, utf8, deflate ? await deflate(utf8) : null);
}
// The same, uncompressed and at once: the share sheet on an iPhone needs the
// file while the tap that asked for it is still fresh.
export const embedNow = (png, text) => build(png, new TextEncoder().encode(text), null);

function build(png, utf8, packed) {
  const list = chunks(png);
  if (!list.some((c) => c.type === 'IEND')) throw new Error('This PNG has no end');
  const head = ascii(`${KEYWORD}\0`);
  const data = new Uint8Array(head.length + 4 + (packed || utf8).length);
  data.set(head);
  data.set([packed ? 1 : 0, 0, 0, 0], head.length); // flag, method, empty language tag, empty translated keyword
  data.set(packed || utf8, head.length + 4);
  const parts = [png.subarray(0, 8)];
  for (const c of list) {
    const whole = png.subarray(c.start - 8, c.start + c.length + 4);
    if (c.type === 'IEND') parts.push(chunk('iTXt', data));
    if (!(c.type === 'iTXt' && keywordOf(png, c) === KEYWORD)) parts.push(whole);
  }
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let at = 0;
  for (const p of parts) { out.set(p, at); at += p.length; }
  return out;
}

function keywordOf(png, c) {
  const end = png.subarray(c.start, c.start + Math.min(c.length, 80)).indexOf(0);
  return end < 0 ? null : String.fromCharCode(...png.subarray(c.start, c.start + end));
}

// The text in the PNG's "isopix" chunk, or null when it has none (a plain
// picture). inflate(bytes) undoes deflate. The CRC is checked: a damaged
// chunk is refused, never half read.
export async function extract(png, inflate) {
  for (const c of chunks(png)) {
    if (c.type !== 'iTXt' || keywordOf(png, c) !== KEYWORD) continue;
    const whole = png.subarray(c.start - 4, c.start + c.length);
    const stored = new DataView(png.buffer, png.byteOffset).getUint32(c.start + c.length);
    if (crc32(whole) !== stored) throw new Error('The drawing inside this picture is damaged');
    let at = c.start + KEYWORD.length + 1;
    const flag = png[at];
    at += 2;
    at = png.indexOf(0, at) + 1; // language tag
    at = png.indexOf(0, at) + 1; // translated keyword
    const body = png.subarray(at, c.start + c.length);
    return new TextDecoder().decode(flag ? await inflate(body) : body);
  }
  return null;
}
