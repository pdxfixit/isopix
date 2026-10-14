// No personal names in the repo: the owner's and his family's names must never
// appear in any file this repo publishes (the owner, 2026-10-13, making the repo
// public). The names are kept here only as SHA-256 hashes, so this test does not
// publish them either. Words are runs of letters; most names match a word in any
// case, one matches only with its capital (so the code's `max` passes), and the
// surname matches inside a longer word too (domains such as <name><surname>.com).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const sha = (s) => createHash('sha256').update(s).digest('hex');
const WORD_ANY_CASE = new Set([
  '6700869c8ff7480e34a70a708b028700dbaa3a033b5652b903afe89f49a31456',
  'c157a0b0d40f9d9506c72fae584069d1692b816da16cd76c648d5761c588057a',
  'b9138194ffe9e7c8bb6d79d1ed56259553d18d9cb60b66e3ba5aa2e5b078055a',
]);
const WORD_EXACT = new Set(['a1a5936d3b0f8a69fd62c91ed9990d3bd414c5e78c603e2837c65c9f46a93eb8']);
const INSIDE_WORD = { length: 8, hashes: new Set(['6bf2f9505451ffc3ef54cc5999d8cbf5fba341b207a1eabd2ad92f3f886ae9a2']) };

// Every tracked file and every new one git would add (not ignored).
const root = new URL('..', import.meta.url);
const files = () => execFileSync('git', ['ls-files', '-co', '--exclude-standard', '-z'], { cwd: root })
  .toString().split('\0').filter(Boolean);

// The words in text that are a listed name, with their line numbers. Pure.
export function namesIn(text) {
  const hits = [];
  text.split('\n').forEach((line, i) => {
    for (const w of line.match(/[A-Za-z]+/g) || []) {
      const low = w.toLowerCase();
      let hit = WORD_ANY_CASE.has(sha(low)) || WORD_EXACT.has(sha(w));
      for (let j = 0; !hit && j + INSIDE_WORD.length <= low.length; j++) {
        hit = INSIDE_WORD.hashes.has(sha(low.slice(j, j + INSIDE_WORD.length)));
      }
      if (hit) hits.push(i + 1);
    }
  });
  return hits;
}

test('the name check finds a name, and passes code words', () => {
  // Built from char codes so this file does not spell them.
  const n = (...c) => String.fromCharCode(...c);
  assert.deepEqual(namesIn(`ok\nby ${n(66, 101, 110)} here`), [2]);
  assert.deepEqual(namesIn(`x.${n(98, 101, 110, 115, 97, 110, 100, 98, 101, 114, 103)}.com`), [1]);
  assert.deepEqual(namesIn(`See ${n(77, 97, 120)}.`), [1]);
  assert.deepEqual(namesIn('Math.max(a, b); const MAX_CELLS = 1; benefit, bench'), []);
});

test('no file names the owner or his family', () => {
  const bad = [];
  for (const f of files()) {
    let text;
    try { text = readFileSync(new URL(f, root), 'utf8'); } catch { continue; }
    if (text.includes('\0')) continue; // binary (icons)
    for (const line of namesIn(text)) bad.push(`${f}:${line}`);
  }
  // Locations only: the CI log is public too.
  assert.deepEqual(bad, [], `a personal name appears at:\n${bad.join('\n')}`);
});
