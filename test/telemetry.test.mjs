// Usage counts (web/telemetry.js) and the Worker that keeps them
// (worker/index.js): what a visit may carry, the device code that never changes,
// and the privacy note in Settings that must say so.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as T from '../web/telemetry.js';
import worker, { handleVisit, placeOf, UPSERT, KEEP_MS, ORIGIN, EVENTS_OPTS } from '../worker/index.js';

const DAY = 24 * 60 * 60 * 1000;
const html = fs.readFileSync(new URL('../web/index.html', import.meta.url), 'utf8');
const schema = fs.readFileSync(new URL('../worker/schema.sql', import.meta.url), 'utf8');
const good = () => ({
  v: 1, visit: 'aaaaaaaaaaaa', device: 'bbbbbbbbbbbb', app: '1.3.20', width: 400, touch: true, pwa: false,
  dark: true, reduced: false, lang: 'en', since: 'week', seconds: 95, cells: '100-999', longtasks: 2,
  counts: { 'tool:pencil': 3, 'key:undo': 1 }, errors: ['TypeError app.js:120'],
});

test('the device code is plain random, made once, and never changes', () => {
  const rand = (a) => a.fill(0xab);
  const first = T.deviceCode(null, 1000, rand);
  assert.equal(first.id, 'abababababab');
  // Kept for good: a day, 90 days, ten years on (owner, 2026-10-16: "keep it simple").
  for (const later of [1000 + DAY, 1000 + 90 * DAY, 1000 + 3650 * DAY]) {
    assert.equal(T.deviceCode(first, later, () => assert.fail('a new code was made')), first);
  }
  // A code stored by an older release, with its date, stays as it is.
  const old = { id: 'cdcdcdcdcdcd', since: 5000 };
  assert.equal(T.deviceCode(old, 1000 + 400 * DAY, () => assert.fail('replaced')), old);
  assert.equal(T.deviceCode(old, 1000, () => assert.fail('replaced')), old);
  // Only a missing or malformed code is replaced, by a plain random one.
  assert.deepEqual(T.deviceCode({ id: 'Bob' }, 1000, (a) => a.fill(0x12)), { id: '121212121212' });
  assert.deepEqual(T.deviceCode('x', 1000, (a) => a.fill(0x12)), { id: '121212121212' });
  assert.equal(KEEP_MS, 90 * DAY, 'D1 keeps a visit 90 days');
});

test('buckets', () => {
  assert.deepEqual([0, 399, 400, 1399, 5000].map(T.widthBucket), [0, 0, 400, 1000, 2000]);
  assert.deepEqual([0, 12 * 3600e3, 3 * DAY, 20 * DAY, 60 * DAY, 200 * DAY, 400 * DAY].map((d) => T.sinceBucket(0, d)), ['new', 'new', 'week', 'month', 'quarter', 'year', 'older']);
  assert.deepEqual([0, 5, 500, 5000, 50000].map(T.cellsBucket), T.CELLS);
});

test('count names hold only the app\'s own words', () => {
  assert.equal(T.countName('tool', 'pencil'), 'tool:pencil');
  assert.equal(T.countName('key', 'size:+1'.replace(/[:+]/g, '-')), 'key:size--1');
  assert.equal(T.countName('btn', 'Zoom In!'), 'btn:zoom-in');
  assert.equal(T.countName('set', ''), null);
  assert.equal(T.countName('Bad Kind', 'x'), null);
});

test('an error is sent as its kind and place, never its message', () => {
  assert.equal(T.errorAt('SyntaxError', 'https://isopix.app/engine/project.js?v=2', 88), 'SyntaxError project.js:88');
  assert.equal(T.errorAt(undefined, '', undefined), 'Error ?:0');
  assert.equal(T.errorAt('Type"Err<or>', 'a b.js', 3), 'TypeError ab.js:3');
});

test('cleanVisit keeps checked fields and drops everything else', () => {
  const r = T.cleanVisit({ ...good(), name: 'My dragon', ip: '1.2.3.4', counts: { 'tool:pencil': 3, 'name:Alice Smith': 1, 'x:y': -1, 'set:big': 1e9 }, errors: ['TypeError app.js:120', 'Error: could not read "Alice"'] });
  assert.ok(r.ok);
  assert.deepEqual(Object.keys(r.visit).sort(), ['app', 'cells', 'counts', 'dark', 'device', 'errors', 'lang', 'longtasks', 'pwa', 'reduced', 'seconds', 'since', 'touch', 'visit', 'width']);
  assert.deepEqual(r.visit.counts, { 'tool:pencil': 3 });
  assert.deepEqual(r.visit.errors, ['TypeError app.js:120']);
  assert.equal(T.cleanVisit({ ...good(), v: 2 }).ok, false);
  assert.equal(T.cleanVisit({ ...good(), device: 'Alice' }).ok, false);
  const odd = T.cleanVisit({ ...good(), width: 401, lang: 'English', since: 'forever', app: 'x', touch: 'yes' }).visit;
  assert.deepEqual([odd.width, odd.lang, odd.since, odd.app, odd.touch], [null, null, null, null, null]);
});

test('every column the Worker writes is in the schema, and the schema has no IP or city', () => {
  const cols = UPSERT.match(/INSERT INTO visits \(([^)]+)\)/)[1].split(',').map((c) => c.trim());
  for (const c of cols) assert.match(schema, new RegExp(`\\n  ${c}\\s`), `schema lacks ${c}`);
  assert.doesNotMatch(schema, /\b(ip|city|region|address|user_agent|name)\b\s+TEXT/i);
});

test('the privacy note says what is sent, the 90 days, and what never is', () => {
  const note = html.match(/<p class="note" id="usage-note">([^<]+)<\/p>/)[1];
  assert.match(html, /<input type="checkbox" id="opt-usage"/);
  // One short line shows; the whole note folds under it, never left out.
  assert.match(html, /<p class="note" id="usage-short">[^<]*never your drawings[^<]*<\/p>\s*<details class="usage-more" id="usage-more"><summary>[^<]+<\/summary>\s*<p class="note" id="usage-note">/);
  for (const words of ['buttons', 'tools', 'keys', 'settings', 'how long a visit lasts', 'screen size', 'touch', 'language', 'light or dark', 'the country the visit came from', 'Never your drawings, names or anything you type', 'never your internet address', 'a random code that never changes', 'removed after a year', '90 days online', 'never sells or shares']) {
    assert.ok(note.includes(words), `the note should say "${words}"`);
  }
  assert.doesNotMatch(note, /changes every/);
  // The shared privacy policy, from About and from Help.
  for (const id of ['privacy-link', 'privacy-link-help']) assert.match(html, new RegExp(`<a id="${id}"[^>]* href="https://privacy\\.pdxfixit\\.com/isopix/" target="_blank" rel="noopener">Privacy policy</a>`));
});

// A stand-in for D1: records each statement and its values.
function fakeDB({ fail = false } = {}) {
  const runs = [];
  return {
    runs,
    prepare: (sql) => ({ bind: (...v) => ({ run: async () => { if (fail) throw new Error('no such table: visits'); runs.push({ sql, v }); } }) }),
  };
}
const post = (body, headers = {}) => new Request('https://isopix.app/api/visit', {
  method: 'POST', body: typeof body === 'string' ? body : JSON.stringify(body),
  headers: { Origin: ORIGIN, 'Content-Type': 'text/plain;charset=UTF-8', 'User-Agent': 'Mozilla/5.0 Mobile Safari', ...headers },
});
const withCf = (req, cf) => Object.defineProperty(req, 'cf', { value: cf });

test('a visit is kept with its country, and never the region, IP or city', async () => {
  const DB = fakeDB();
  const req = withCf(post(good(), { 'CF-Connecting-IP': '203.0.113.9' }), { country: 'US', regionCode: 'OR', city: 'Portland', postalCode: '97201', latitude: '45.5' });
  const res = await handleVisit(req, { DB }, null, Date.UTC(2026, 9, 15));
  assert.equal(res.status, 204);
  const { sql, v } = DB.runs[0];
  assert.match(sql, /INSERT INTO visits/);
  assert.equal(v[0], 'aaaaaaaaaaaa');
  assert.equal(v[3], '2026-10-15');
  assert.equal(v[5], 'US');
  assert.doesNotMatch(sql, /region/);
  const all = JSON.stringify(v);
  for (const secret of ['203.0.113.9', 'OR', 'Portland', '97201', '45.5']) assert.ok(!all.includes(secret), `${secret} was stored`);
  assert.deepEqual(JSON.parse(v.at(-2)), { 'tool:pencil': 3, 'key:undo': 1 });
});

test('the Worker turns away what is not a visit from the app', async () => {
  const env = { DB: fakeDB() };
  assert.equal((await handleVisit(new Request('https://isopix.app/api/visit'), env)).status, 405);
  assert.equal((await handleVisit(post(good(), { Origin: 'https://evil.example' }), env)).status, 403);
  assert.equal((await handleVisit(post(good(), { 'Content-Type': 'image/png' }), env)).status, 415);
  assert.equal((await handleVisit(post('{not json'), env)).status, 400);
  assert.equal((await handleVisit(post({ ...good(), device: 'x' }), env)).status, 400);
  assert.equal((await handleVisit(post('x'.repeat(T.MAX_BYTES + 1)), env)).status, 413);
  assert.equal((await handleVisit(post(good(), { 'User-Agent': 'Mozilla/5.0 HeadlessChrome/140' }), env)).status, 204);
  assert.equal(env.DB.runs.length, 0, 'nothing was written');
});

test('a database error never fails a visit, and old rows are swept', async () => {
  assert.equal((await handleVisit(post(good()), { DB: fakeDB({ fail: true }) })).status, 204);
  const DB = fakeDB();
  const random = Math.random;
  Math.random = () => 0;
  try { await handleVisit(post(good()), { DB }, null, 100 * DAY); } finally { Math.random = random; }
  assert.equal(DB.runs[1].sql, 'DELETE FROM visits WHERE last_seen < ?1');
  assert.deepEqual(DB.runs[1].v, [10 * DAY]);
});

test('placeOf keeps only well-formed codes', () => {
  assert.deepEqual(placeOf({ cf: { country: 'GB', regionCode: 'ENG' } }), { country: 'GB' });
  assert.deepEqual(placeOf({ cf: { country: 'Great Britain', regionCode: '<b>' } }), { country: null });
  assert.deepEqual(placeOf({}), { country: null });
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
