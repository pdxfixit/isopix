// Usage counts (web/telemetry.js) and the Worker that keeps them
// (worker/index.js): what a visit may carry, the device code's 90-day life,
// and the privacy note in Settings that must say so.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as T from '../web/telemetry.js';
import worker, { handleVisit, placeOf, UPSERT, KEEP_MS, ORIGIN } from '../worker/index.js';

const DAY = 24 * 60 * 60 * 1000;
const html = fs.readFileSync(new URL('../web/index.html', import.meta.url), 'utf8');
const schema = fs.readFileSync(new URL('../worker/schema.sql', import.meta.url), 'utf8');
const good = () => ({
  v: 1, visit: 'aaaaaaaaaaaa', device: 'bbbbbbbbbbbb', app: '1.3.20', width: 400, touch: true, pwa: false,
  dark: true, reduced: false, lang: 'en', since: 'week', seconds: 95, cells: '100-999', longtasks: 2,
  counts: { 'tool:pencil': 3, 'key:undo': 1 }, errors: ['TypeError app.js:120'],
});

test('the device code lasts 90 days, then a new one is made', () => {
  const rand = (a) => a.fill(0xab);
  const first = T.deviceCode(null, 1000, rand);
  assert.equal(first.id, 'abababababab');
  assert.equal(T.deviceCode(first, 1000 + 89 * DAY, () => assert.fail('kept')), first);
  const next = T.deviceCode(first, 1000 + 90 * DAY, (a) => a.fill(0x12));
  assert.equal(next.id, '121212121212');
  assert.equal(next.since, 1000 + 90 * DAY);
  // A code from the future, or a malformed one, is replaced.
  assert.notEqual(T.deviceCode({ id: first.id, since: 5000 }, 1000, (a) => a.fill(1)).id, first.id);
  assert.notEqual(T.deviceCode({ id: 'Bob', since: 1000 }, 1000, (a) => a.fill(1)).id, 'Bob');
  assert.equal(T.ROTATE_MS, 90 * DAY);
  assert.equal(KEEP_MS, 90 * DAY, 'D1 keeps a visit as long as a device code lives');
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
  for (const words of ['buttons', 'tools', 'keys', 'settings', 'how long a visit lasts', 'screen size', 'touch', 'language', 'light or dark', 'the country the visit came from', 'Never your drawings, names or anything you type', 'never your internet address', 'changes every 90 days', '90 days online', 'never sells or shares']) {
    assert.ok(note.includes(words), `the note should say "${words}"`);
  }
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
