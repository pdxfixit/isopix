// The support address is never written out in a tracked file, so a spam harvester that reads the page, its
// scripts or this public repo finds none (Owner, 2026-10-16: "consider protecting the email address from
// scrapers"). web/update.js keeps it reversed and base64-encoded and builds it; the help dialog fills it in from
// there. A GitHub no-reply address and the agent co-author line are not mailboxes and are allowed.
import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { SUPPORT } from '../web/update.js';

const root = new URL('..', import.meta.url).pathname;
const EMAIL = /[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}/g;
const ALLOWED = /@users\.noreply\.github\.com$|^noreply@anthropic\.com$/;

test('no tracked file holds a plain email address', () => {
  const files = execFileSync('git', ['ls-files', '-z'], { cwd: root }).toString().split('\0').filter(Boolean)
    .filter((f) => !/\.(png|ico|webp|woff2?|jpg|jpeg|gif|zip)$/i.test(f));
  const found = [];
  for (const f of files) {
    let text;
    try { text = readFileSync(root + f, 'utf8'); } catch { continue; }
    for (const m of text.match(EMAIL) ?? []) if (!ALLOWED.test(m)) found.push(`${f}: ${m.replace(/^.{3}/, '***')}`);
  }
  assert.deepEqual(found, [], 'write the address only through web/update.js (SUPPORT), never as text');
});

test('the support address is built from the encoded constant', () => {
  assert.match(SUPPORT, /^[a-z]+@[a-z.]+$/, 'SUPPORT decodes to an address');
  const html = readFileSync(root + 'web/index.html', 'utf8');
  assert.match(html, /id="report-addr"/, 'the help link names the address through a span the app fills in');
});
