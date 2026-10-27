// No personal names in the repo: the owner's and his family's names must never
// appear in any file this repo publishes, nor in a commit message (the owner,
// 2026-10-13, making the repo public). This file holds no names and no hashes:
// an unsalted SHA-256 of a first name falls to a word list in seconds, and the
// repo is public (the owner, 2026-10-27, as in noodlepads). The hashes are one
// JSON document kept outside it:
//   - CI: the GitHub secret ISOPIX_NAME_HASHES
//   - the owner's Mac: ~/.config/isopix/names.json
// {"anyCase": ["…"], "exact": ["…"], "inside": [{"length": 8, "hashes": ["…"]}]}
// anyCase: names matched as a whole word in any case; exact: a name that is also
// a word in code, matched only as written (capitalized); inside: a surname,
// matched inside a longer word too (domains such as <name><surname>.com).
// `just names-secret` (tools/names_secret.py) makes the document. A checkout
// without it (a cloud session) skips the scan and says so; CI has it.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

const sha = (s) => createHash('sha256').update(s).digest('hex');

// The hashes from the environment, else the Mac's file; null when neither holds any.
export function outsideHashes(env = process.env, file = join(homedir(), '.config/isopix/names.json')) {
  const raw = env.ISOPIX_NAME_HASHES || (existsSync(file) ? readFileSync(file, 'utf8') : '');
  if (!raw.trim()) return null;
  const j = JSON.parse(raw);
  return {
    anyCase: new Set(j.anyCase || []),
    exact: new Set(j.exact || []),
    inside: (j.inside || []).map((i) => ({ length: i.length, hashes: new Set(i.hashes) })),
  };
}

const NONE = { anyCase: new Set(), exact: new Set(), inside: [] };
const HASHES = outsideHashes() ?? NONE;
const HAVE = HASHES.anyCase.size + HASHES.exact.size + HASHES.inside.length > 0;

// Every line number in `text` where a name is written. The hash sets are a
// parameter so the self-tests run on made-up names: a test that spelled out a
// real name, even built from parts, would show it in a public file.
export function namesIn(text, h = HASHES) {
  const hits = [];
  text.split('\n').forEach((line, i) => {
    for (const w of line.match(/[A-Za-z]+/g) || []) {
      const low = w.toLowerCase();
      let hit = h.anyCase.has(sha(low)) || h.exact.has(sha(w));
      for (const { length, hashes } of h.inside) {
        for (let j = 0; !hit && j + length <= low.length; j++) hit = hashes.has(sha(low.slice(j, j + length)));
      }
      if (hit) hits.push(i + 1);
    }
  });
  return hits;
}

// What is wrong with the commits in a `git log` made with LOG_FORMAT. Pure.
export const LOG_FORMAT = '%H%x00%an%x00%ae%x00%cn%x00%ce%x00%B%x1e';
export function commitProblems(log, h = HASHES) {
  const bad = [];
  for (const rec of log.split('\x1e').map((s) => s.trim()).filter(Boolean)) {
    const [id, an, ae, cn, ce, body = ''] = rec.split('\0');
    if (an !== 'PDXfixIT') bad.push(`${id.slice(0, 7)}: the author is not PDXfixIT (just setup)`);
    if (namesIn([an, ae, cn, ce, body].join('\n'), h).length) bad.push(`${id.slice(0, 7)}: a personal name in its author, committer or message`);
  }
  return bad;
}

// Made-up names, with the hashes the real ones would have.
const madeUp = {
  anyCase: new Set([sha('pip'), sha('juno')]),
  exact: new Set([sha('Wren')]),
  inside: [{ length: 8, hashes: new Set([sha('tobyjones'.slice(0, 8))]) }],
};

test('outsideHashes reads the secret first, then the Mac file, and null when neither is there', () => {
  assert.equal(outsideHashes({}, '/nonexistent/names.json'), null);
  const doc = { anyCase: ['a', 'b'], exact: ['c'], inside: [{ length: 8, hashes: ['d'] }] };
  const got = outsideHashes({ ISOPIX_NAME_HASHES: JSON.stringify(doc) }, '/nonexistent');
  assert.deepEqual([[...got.anyCase], [...got.exact], got.inside.map((i) => [i.length, [...i.hashes]])], [['a', 'b'], ['c'], [[8, ['d']]]]);
  assert.deepEqual([...outsideHashes({ ISOPIX_NAME_HASHES: '{}' }, '/nonexistent').anyCase], []);
});

test('namesIn finds a name as each list says, and passes everyday words', () => {
  assert.deepEqual(namesIn('ok\nby Pip here\nPIP and juno', madeUp), [2, 3, 3]);
  assert.deepEqual(namesIn('Wren plays\nwren, Math.max(a, b); benefit, bench', madeUp), [1]);
  assert.deepEqual(namesIn('x.tobyjones.com and TobyJonesFamily', madeUp), [1, 1]);
  assert.deepEqual(namesIn('Pippa and Junior', madeUp), [], 'only whole words with those hashes');
  assert.deepEqual(namesIn('Pip', NONE), [], 'with no hashes nothing is found');
});

test('commitProblems finds a stranger author and a name in a message', () => {
  const rec = (an, body) => ['abcdef1234', an, 'x@y.z', an, 'x@y.z', body].join('\0') + '\x1e';
  assert.deepEqual(commitProblems(rec('PDXfixIT', 'feat: a thing'), madeUp), []);
  assert.deepEqual(commitProblems(rec('someone', 'feat: a thing'), madeUp), ['abcdef1: the author is not PDXfixIT (just setup)']);
  assert.equal(commitProblems(rec('PDXfixIT', 'fix: asked by Pip'), madeUp).length, 1);
});

// Every tracked file and every new one git would add (not ignored).
const root = new URL('..', import.meta.url);
const files = () => execFileSync('git', ['ls-files', '-co', '--exclude-standard', '-z'], { cwd: root }).toString().split('\0').filter(Boolean);

test('every commit is authored by PDXfixIT and names no one (messages are public too)', (t) => {
  let log;
  try { log = execFileSync('git', ['log', `--format=${LOG_FORMAT}`], { cwd: root, stdio: ['ignore', 'pipe', 'ignore'] }).toString(); } catch { return; } // no commits yet
  assert.deepEqual(commitProblems(log), []);
  if (!HAVE) t.diagnostic('author checked; names not (no ISOPIX_NAME_HASHES or ~/.config/isopix/names.json)');
});

test('no file, and no file name, names the owner or his family', (t) => {
  if (!HAVE) { t.skip('no ISOPIX_NAME_HASHES or ~/.config/isopix/names.json here: the names scan runs in CI and on the owner\'s Mac'); return; }
  const bad = [];
  for (const f of files()) {
    if (namesIn(f).length) bad.push(`${f}: in its name`);
    let text;
    try { text = readFileSync(new URL(f, root), 'utf8'); } catch { continue; }
    if (text.includes('\0')) continue; // binary (icons)
    for (const line of namesIn(text)) bad.push(`${f}:${line}`);
  }
  // Locations only: the CI log is public too.
  assert.deepEqual(bad, [], `a personal name appears at:\n${bad.join('\n')}`);
});
