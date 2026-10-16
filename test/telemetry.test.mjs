// What Isopix keeps about use (docs/telemetry.md): the device code that never
// changes, the switch in Settings with its privacy link, the Worker that
// stores usage events, and the per-visit beacon that is gone (retired
// 2026-10-16: no /api/visit, no D1 write, no web/telemetry.js).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as E from '../web/events.js';
import worker, { ORIGIN, EVENTS_OPTS } from '../worker/index.js';

const DAY = 24 * 60 * 60 * 1000;
const read = (f) => fs.readFileSync(new URL(f, import.meta.url), 'utf8');
const html = read('../web/index.html');
const schema = read('../worker/schema.sql');

test('the device code is plain random, made once, and never changes', () => {
  const rand = (a) => a.fill(0xab);
  const first = E.deviceCode(null, 1000, rand);
  assert.equal(first.id, 'abababababab');
  // Kept for good: a day, 90 days, ten years on (owner, 2026-10-16: "keep it simple").
  for (const later of [1000 + DAY, 1000 + 90 * DAY, 1000 + 3650 * DAY]) {
    assert.equal(E.deviceCode(first, later, () => assert.fail('a new code was made')), first);
  }
  // A code stored by an older release, with its date, stays as it is.
  const old = { id: 'cdcdcdcdcdcd', since: 5000 };
  assert.equal(E.deviceCode(old, 1000 + 400 * DAY, () => assert.fail('replaced')), old);
  assert.equal(E.deviceCode(old, 1000, () => assert.fail('replaced')), old);
  // Only a missing or malformed code is replaced, by a plain random one.
  assert.deepEqual(E.deviceCode({ id: 'Bob' }, 1000, (a) => a.fill(0x12)), { id: '121212121212' });
  assert.deepEqual(E.deviceCode('x', 1000, (a) => a.fill(0x12)), { id: '121212121212' });
});

test('an error is sent as its kind and place, never its message', () => {
  assert.equal(E.errorAt('SyntaxError', 'https://isopix.app/engine/project.js?v=2', 88), 'SyntaxError project.js:88');
  assert.equal(E.errorAt(undefined, '', undefined), 'Error ?:0');
  assert.equal(E.errorAt('Type"Err<or>', 'a b.js', 3), 'TypeError ab.js:3');
});

test('the switch says Share play data and links the policy, with no note of its own', () => {
  // What is sent lives in the shared policy only, so every app says it the same way
  // (owner, 2026-10-16: "have it in the privacy policy so that all apps are consistent").
  assert.match(html, /<label class="row"><input type="checkbox" id="opt-usage"> Share play data<\/label>\s*<a id="privacy-link"/);
  assert.doesNotMatch(html, /id="usage-(note|short|more)"|Send usage counts|set-about-title/);
  // The shared privacy policy, from Settings and from Help.
  for (const id of ['privacy-link', 'privacy-link-help']) assert.match(html, new RegExp(`<a id="${id}"[^>]* href="https://privacy\\.pdxfixit\\.com/isopix/" target="_blank" rel="noopener">Privacy policy</a>`));
});

test('the cells bucket names a size, never a count', () => {
  assert.deepEqual([0, 5, 500, 5000, 50000].map(E.cellsBucket), E.CELLS);
});

test('the per-visit beacon is gone: no module, no route, no D1 write, no table', async () => {
  assert.ok(!fs.existsSync(new URL('../web/telemetry.js', import.meta.url)), 'web/telemetry.js is back');
  for (const f of ['../web/app.js', '../web/events.js', '../web/index.html', '../web/sw.js']) assert.doesNotMatch(read(f), /telemetry\.js|initUsage|\/api\/visit|handleVisit/, `${f} names the beacon`);
  assert.doesNotMatch(read('../worker/index.js'), /handleVisit|cleanVisit|env\.DB|INSERT INTO/, 'the Worker writes to D1 again');
  // A tab still running the old page posts to /api/visit: it reaches the static files, never the database.
  let asked = null;
  const DB = { prepare: () => assert.fail('wrote to D1') };
  const req = new Request('https://isopix.app/api/visit', { method: 'POST', body: '{}', headers: { Origin: ORIGIN } });
  await worker.fetch(req, { DB, ASSETS: { fetch: async (r) => { asked = new URL(r.url).pathname; return new Response('', { status: 404 }); } } }, null);
  assert.equal(asked, '/api/visit');
  assert.doesNotMatch(schema.replace(/^--.*$/gm, ''), /CREATE/i, 'worker/schema.sql creates a table again');
});

test('every other path goes to the static files', async () => {
  let asked = null;
  const res = await worker.fetch(new Request('https://isopix.app/app.js'), { ASSETS: { fetch: async (r) => { asked = r.url; return new Response('ok'); } } }, null);
  assert.equal(asked, 'https://isopix.app/app.js');
  assert.equal(await res.text(), 'ok');
});

// POST /api/events: the shared route (worker/events-worker.js, vendored from flarepress) into R2.
const eventsPost = (body, headers = {}, q = '') => new Request(`https://isopix.app/api/events${q}`, {
  method: 'POST', body, headers: { Origin: ORIGIN, 'Content-Type': 'text/plain;charset=UTF-8', 'User-Agent': 'Mozilla/5.0 Mobile Safari', ...headers },
});
const BATCH = '0b9f5c1e-2a4d-4c6e-9f00-123456789abc';
function fakeBucket() {
  const puts = [];
  return { puts, put: async (key, body) => { puts.push({ key, body: new TextDecoder().decode(body) }); } };
}

test('/api/events stores a batch in the EVENTS bucket as it came', async () => {
  const EVENTS = fakeBucket();
  const line = '{"app":"isopix","event":"app.open"}\n';
  const res = await worker.fetch(eventsPost(line, { 'X-Batch': BATCH }), { EVENTS, ASSETS: { fetch: () => assert.fail('to assets') } }, null);
  assert.equal(res.status, 204);
  assert.match(EVENTS.puts[0].key, new RegExp(`^v1/\\d{4}-\\d{2}-\\d{2}/${BATCH}\\.jsonl$`));
  assert.equal(EVENTS.puts[0].body, line);
  // A beacon carries the batch id in the query.
  assert.equal((await worker.fetch(eventsPost(line, {}, `?batch=${BATCH}`), { EVENTS }, null)).status, 204);
});

test('/api/events turns away other origins, and keeps nothing from the deploy\'s headless checks', async () => {
  const EVENTS = fakeBucket();
  assert.equal((await worker.fetch(eventsPost('x\n', { 'X-Batch': BATCH, Origin: 'https://evil.example' }), { EVENTS }, null)).status, 403);
  assert.equal((await worker.fetch(eventsPost('x\n', { 'X-Batch': BATCH, 'User-Agent': 'Mozilla/5.0 HeadlessChrome/140' }), { EVENTS }, null)).status, 204);
  assert.equal(EVENTS.puts.length, 0);
  assert.equal((await worker.fetch(eventsPost('x\n', { 'X-Batch': BATCH }), {}, null)).status, 503, 'no binding: the client keeps the batch');
});

test('site/wrangler.toml binds the R2 bucket as EVENTS, the name the Worker reads', () => {
  const toml = fs.readFileSync(new URL('../site/wrangler.toml', import.meta.url), 'utf8');
  assert.match(toml, /\[\[r2_buckets\]\]\s*\nbinding = "EVENTS"\s*\nbucket_name = "isopix-telemetry"/);
  assert.equal(EVENTS_OPTS.bucket, 'EVENTS');
  assert.deepEqual(EVENTS_OPTS.origins, [ORIGIN]);
});

test('the vendored flarepress copies are unedited (their body matches the sha256 in their header)', async () => {
  const { createHash } = await import('node:crypto');
  for (const f of ['../web/events-client.js', '../worker/events-worker.js']) {
    const text = fs.readFileSync(new URL(f, import.meta.url));
    const parts = text.toString('utf8').split('\n');
    const want = parts[2].match(/^\/\/ sha256 of the original: ([0-9a-f]{64})$/)?.[1];
    assert.ok(want, `${f} has no vendored header`);
    const body = text.subarray(Buffer.byteLength(parts.slice(0, 3).join('\n') + '\n'));
    assert.equal(createHash('sha256').update(body).digest('hex'), want, `${f} was edited here: change it in flarepress and run just events-vendor`);
  }
});
