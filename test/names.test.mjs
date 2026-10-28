// Every commit is authored by PDXfixIT (the owner's rule: no personal name in the
// repo's history; `just setup` sets the author). The names themselves are kept
// out by the rule in AGENTS.md, not by a scan (the owner, 2026-10-28).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';

// What is wrong with the commits in a `git log` made with LOG_FORMAT. Pure.
export const LOG_FORMAT = '%H%x00%an%x1e';
export function commitProblems(log) {
  const bad = [];
  for (const rec of log.split('\x1e').map((s) => s.trim()).filter(Boolean)) {
    const [id, an] = rec.split('\0');
    if (an !== 'PDXfixIT') bad.push(`${id.slice(0, 7)}: the author is not PDXfixIT (just setup)`);
  }
  return bad;
}

test('commitProblems finds a stranger author', () => {
  const rec = (an) => ['abcdef1234', an].join('\0') + '\x1e';
  assert.deepEqual(commitProblems(rec('PDXfixIT')), []);
  assert.deepEqual(commitProblems(rec('someone')), ['abcdef1: the author is not PDXfixIT (just setup)']);
});

test('every commit is authored by PDXfixIT', () => {
  const root = new URL('..', import.meta.url);
  let log;
  try { log = execFileSync('git', ['log', `--format=${LOG_FORMAT}`], { cwd: root, stdio: ['ignore', 'pipe', 'ignore'] }).toString(); } catch { return; } // no commits yet
  assert.deepEqual(commitProblems(log), []);
});
