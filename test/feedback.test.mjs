// Feedback (owner, 2026-10-19): a button beside the version in Settings →
// About, a grown-up check, then a box whose text goes only to POST
// /api/feedback when Send is pressed (web/feedback.js, web/ui/feedback.js).
// The Worker's side is in test/telemetry.test.mjs.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as F from '../web/feedback.js';

const read = (f) => fs.readFileSync(new URL(f, import.meta.url), 'utf8');
const html = read('../web/index.html');
const ui = read('../web/ui/feedback.js');
const dialog = (id) => html.slice(html.indexOf(`<dialog id="${id}"`), html.indexOf('</dialog>', html.indexOf(`<dialog id="${id}"`)));
const UUID = '0b9f5c1e-2a4d-4c6e-9f00-123456789abc';

test('the grown-up check asks a two-digit sum with a carry, and takes only its answer', () => {
  const seen = new Set();
  for (const r1 of [0, 0.2, 0.4, 0.6, 0.8, 0.9999]) for (const r2 of [0, 0.5, 0.9999]) {
    const rs = [r1, r2], q = F.gateQuestion(() => rs.shift());
    assert.ok(q.a >= 12 && q.a <= 19 && q.b >= 6 && q.b <= 9, `${q.a} + ${q.b}`);
    assert.ok(q.answer >= 18 && q.answer <= 28 && (q.a % 10) + q.b >= 10, `${q.a} + ${q.b}: a carry, so it is not read off at a glance`);
    seen.add(q.answer);
    assert.equal(q.text, `Grown-ups: what is ${q.a} + ${q.b}?`);
  }
  assert.ok(seen.size >= 6, 'random each time');
  const q = F.gateQuestion(() => 0.5); // 16 + 8
  assert.equal(q.text, 'Grown-ups: what is 16 + 8?');
  assert.ok(F.gateRight(q, '24'));
  assert.ok(F.gateRight(q, ' 24 '));
  assert.ok(F.gateRight(q, 24));
  for (const no of ['', '23', '25', '2 4', '24.0', '0x18', '1e1', '-24', 'twenty-three', null, undefined]) assert.equal(F.gateRight(q, no), false, `${no}`);
});

test('Send waits for something typed, fits what the Worker takes, and never sends twice at once', () => {
  assert.equal(F.canSend('', false), false);
  assert.equal(F.canSend('   \n\t ', false), false);
  assert.equal(F.canSend('the stamps are great', false), true);
  assert.equal(F.canSend('the stamps are great', true), false, 'while sending');
  assert.equal(F.canSend('a'.repeat(F.MAX_CHARS), false), true);
  // The box counts 2000 characters; 2000 in Chinese are 6000 bytes, more than the Worker's 4096.
  assert.equal(F.tooLong('水'.repeat(2000)), true);
  assert.equal(F.canSend('水'.repeat(2000), false), false);
  assert.equal(F.tooLong('🧊'.repeat(1024)), false, '4096 bytes exactly');
  assert.equal(F.tooLong('🧊'.repeat(1025)), true);
});

test('the request is plain text, with no cookies, a message id and the version', () => {
  const [url, init] = F.feedbackRequest('hello', UUID, '1.2.118');
  assert.equal(url, '/api/feedback');
  assert.deepEqual(init, {
    method: 'POST', credentials: 'omit', body: 'hello',
    headers: { 'content-type': 'text/plain;charset=UTF-8', 'x-feedback': UUID, 'x-app-version': '1.2.118' },
  });
  // A version the Worker would refuse is sent as dev.
  for (const v of [undefined, '', 'dev', '1.2.3-dirty', 'a'.repeat(33), '1 2', 42]) assert.equal(F.appVersion(v), 'dev');
  assert.equal(F.appVersion('1.2.3+abc_d'), '1.2.3+abc_d');
});

test('a failed send keeps its id for the retry; a sent one makes the next message new', async () => {
  const calls = [];
  let answer = 503, n = 0;
  const sender = F.createSender({
    fetch: async (url, init) => { calls.push(init.headers['x-feedback']); if (answer === 'offline') throw new TypeError('Failed to fetch'); return { status: answer }; },
    uuid: () => `00000000-0000-4000-8000-00000000000${n++}`,
    version: '1.2.118',
  });
  assert.equal(await sender.send('one'), 'failed');
  answer = 'offline';
  assert.equal(await sender.send('one'), 'failed');
  answer = 204;
  assert.equal(await sender.send('one'), 'sent');
  assert.equal(await sender.send('two'), 'sent');
  assert.deepEqual(calls, [
    '00000000-0000-4000-8000-000000000000', '00000000-0000-4000-8000-000000000000', '00000000-0000-4000-8000-000000000000',
    '00000000-0000-4000-8000-000000000001',
  ]);
  answer = 200; // only 204 is stored
  assert.equal(await sender.send('three'), 'failed');
});

test('About has one row of plain links (Privacy policy, Send feedback, Show the welcome again), then the version', () => {
  // Owner, 2026-10-19: "one row of links, but allow wrapping on the phone gracefully"
  const row = html.match(/<nav class="about-links"[^>]*>([\s\S]*?)<\/nav>\s*<p class="version"><a id="version-label"[^>]*><\/a><\/p>/);
  assert.ok(row, 'the links, then the version alone');
  const links = [...row[1].matchAll(/<(a|button) [^>]*id="([^"]+)"[^>]*class="link-btn"[^>]*>([^<]+)</g)].map((m) => [m[2], m[3]]);
  assert.deepEqual(links, [['privacy-link', 'Privacy policy'], ['feedback-open', 'Send feedback'], ['welcome-again', 'Show the welcome again']]);
  assert.match(row[1], /id="feedback-open" class="link-btn" aria-haspopup="dialog"/);
  assert.doesNotMatch(html, /feedback-open" class="btn|💌<\/span> Feedback/, 'no bordered or emoji button among the links');
  assert.match(read('../web/styles.css'), /\.about-links \{ display: flex; flex-wrap: wrap; justify-content: center;/);
  assert.match(read('../web/help.js'), /from: '#feedback-open'/);
});

test('the grown-up check and the box are centered modal dialogs with what the owner asked for', () => {
  const gate = dialog('feedback-gate'), box = dialog('feedback');
  for (const d of [gate, box]) {
    assert.match(d, /^<dialog id="[a-z-]+" class="small-dialog/, 'a small-dialog: centered at every width, never a drawer');
    assert.doesNotMatch(d, /class="[^"]*drawer/);
  }
  assert.match(gate, /<input type="number" id="gate-answer" inputmode="numeric"/);
  assert.match(gate, /<button class="btn wide" value="cancel">Cancel<\/button>/);
  assert.match(gate, /id="gate-ok">OK</);
  assert.match(box, /<h2 id="feedback-title">Send feedback<\/h2>/);
  assert.match(box, /Ideas, problems, anything\. Please don't include names or contact details: we can't write back\. We keep messages for 90 days\./);
  assert.match(box, /<textarea id="feedback-text" aria-label="[^"]+" maxlength="2000"[^>]* autofocus><\/textarea>/);
  assert.match(box, /value="close" aria-label="Close feedback"/);
  assert.match(box, /<button class="btn wide" value="cancel">Cancel<\/button>/);
  assert.match(box, /<button type="button" [^>]*id="feedback-send" disabled>Send<\/button>/, 'Send starts disabled, and is a button, never a form post');
  assert.doesNotMatch(box, /<form[^>]*action=/);
});

test('the text goes only to the feedback request: never a usage event, a log or storage', () => {
  assert.doesNotMatch(ui, /app\.events|\.track\(|console\.|localStorage|sessionStorage|idb|store\./, 'web/ui/feedback.js reaches telemetry or storage');
  assert.match(ui, /import \{ uuidV4 \} from '\.\.\/events\.js';/, 'from events.js it takes only the UUID maker');
  assert.match(ui, /sender\.send\(text\)/);
  // What Esc or Cancel leaves on the gate is never the answer typed.
  assert.doesNotMatch(ui, /close\([^)'"]*value/);
  assert.match(ui, /'Thanks! Sent\. 💌'/);
  assert.match(ui, /"Couldn't send\. Please try again\."/);
});
