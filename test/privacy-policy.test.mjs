// docs/privacy-policy.md is the text of privacy.pdxfixit.com/isopix/: this repo holds it beside the code, and
// `just policy` copies it into pdxfixit/privacy (whose build.py is the strict reader). This test catches here what
// that build would refuse there, so a malformed policy never gets as far as a copy: front matter with name, blurb
// and a real `updated` date, no plain email address (the text says {contact}), and every @include naming a shared
// block the privacy repo has. The app's own link to the policy must point at the page this text becomes.
import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

const root = new URL('..', import.meta.url).pathname;
const policy = readFileSync(root + 'docs/privacy-policy.md', 'utf8');

// { meta, body } of a file that starts with a --- front matter block of `key: value` lines. Pure.
export function frontMatter(text) {
  const m = /^---\n([\s\S]*?)\n---\n([\s\S]*)$/.exec(text);
  if (!m) return null;
  const meta = {};
  for (const line of m[1].split('\n')) {
    const kv = /^([a-z]+): (.+)$/.exec(line);
    if (!kv) return null;
    meta[kv[1]] = kv[2].trim();
  }
  return { meta, body: m[2] };
}

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
// "19 October 2026" as a real calendar date, or null. Pure.
export function parseDate(s) {
  const m = /^(\d{1,2}) ([A-Z][a-z]+) (\d{4})$/.exec(s);
  if (!m) return null;
  const month = MONTHS.indexOf(m[2]);
  if (month < 0) return null;
  const d = new Date(Date.UTC(+m[3], month, +m[1]));
  return d.getUTCMonth() === month && d.getUTCDate() === +m[1] ? d : null;
}

// The privacy checkout, if there is one: $PRIVACY, else beside this repo's main checkout (as `just policy` finds it).
function privacyCheckout() {
  const common = execFileSync('git', ['rev-parse', '--path-format=absolute', '--git-common-dir'], { cwd: root, encoding: 'utf8' }).trim();
  for (const dir of [process.env.PRIVACY, resolve(dirname(common), '..', 'privacy')].filter(Boolean)) {
    if (existsSync(dir + '/src/_shared')) return dir;
  }
  return null;
}

test('the policy has front matter: name, blurb and a real updated date', () => {
  const fm = frontMatter(policy);
  assert.ok(fm, 'docs/privacy-policy.md must start with a --- block of "key: value" lines');
  for (const k of ['name', 'blurb', 'updated']) assert.ok(fm.meta[k], `front matter needs ${k}:`);
  assert.equal(fm.meta.name, 'Isopix');
  const d = parseDate(fm.meta.updated);
  assert.ok(d, `updated: "${fm.meta.updated}" is not a date like "19 October 2026"`);
  assert.ok(d.getTime() <= Date.now() + 864e5, 'updated: is in the future');
  assert.match(fm.body, /^# Isopix privacy policy$/m, 'the page has its title');
});

test('the policy writes {contact}, never an email address or a mailto: link', () => {
  assert.doesNotMatch(policy, /mailto:/i, 'write {contact}, which builds the address in the browser');
  assert.doesNotMatch(policy, /[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}/, 'write {contact}, not an address');
  assert.match(policy, /\{contact\}/, 'the policy tells people whom to write to');
});

test('every @include is a line of its own', () => {
  const lines = policy.split('\n');
  lines.forEach((l, i) => {
    if (!l.includes('@include')) return;
    assert.match(l, /^@include [a-z0-9-]+$/, `line ${i + 1}: an include is "@include name" and nothing else`);
    assert.equal(lines[i - 1], '', `line ${i + 1}: a blank line before an include`);
    assert.ok(lines[i + 1] === '' || lines[i + 1] === undefined, `line ${i + 1}: a blank line after an include`);
  });
});

test('every @include names a shared block the privacy repo has', (t) => {
  const pv = privacyCheckout();
  if (!pv) { t.skip('no privacy checkout beside this repo ($PRIVACY or ../privacy): shared blocks not checked'); return; }
  const names = [...policy.matchAll(/^@include ([a-z0-9-]+)$/gm)].map((m) => m[1]);
  assert.ok(names.length > 0, 'the policy includes the shared rules');
  for (const n of names) assert.ok(existsSync(`${pv}/src/_shared/${n}.md`), `@include ${n}: pdxfixit/privacy has no src/_shared/${n}.md`);
});

test('the app links the page this policy becomes', () => {
  const url = frontMatter(policy).meta.url;
  assert.equal(url, 'https://isopix.app/', 'front matter url: is the app, as the privacy page links it');
  const html = readFileSync(root + 'web/index.html', 'utf8');
  for (const id of ['privacy-link', 'privacy-link-help']) {
    assert.match(html, new RegExp(`id="${id}"[^>]*href="https://privacy\\.pdxfixit\\.com/isopix/"`), `#${id} points at privacy.pdxfixit.com/isopix/`);
  }
});
