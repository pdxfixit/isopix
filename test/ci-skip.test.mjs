// A docs-only push skips CI's browser checks (tools/ci_scope.py, owner 2026-10-20),
// never `just test` (the docs-drift check) or the version checks, and never a
// browser check on a change to code: every browser step waits on the scope step
// of its own job, and that step runs ci_scope.py against the push's base.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const yml = readFileSync(new URL('../.github/workflows/test.yml', import.meta.url), 'utf8');
const jobs = yml.split(/^ {2}(?=[a-z][\w-]*:\n)/m).slice(1);
const steps = (job) => job.split(/^ {6}- /m).slice(1);
const GATE = "if: steps.scope.outputs.browser == 'true'";

test('test.yml always runs just test and the version checks', () => {
  const always = ['run: just test\n', 'run: tools/version_bumped.sh\n', 'run: python3 tools/bump_version.py --check\n'];
  for (const run of always) {
    const found = jobs.flatMap(steps).filter((s) => s.includes(run));
    assert.equal(found.length, 1, `test.yml runs \`${run.trim()}\` ${found.length} times, not once`);
    assert.doesNotMatch(found[0], /^\s+if:/m, `\`${run.trim()}\` has a condition: a docs-only push would skip it`);
  }
});

test('every browser check in test.yml waits on its own job\'s docs-only check', () => {
  const browser = /run: just (export-check|move-check|install-check|autosave-check|look-ci|look)\b/;
  let seen = 0;
  for (const job of jobs) {
    const st = steps(job);
    const scope = st.findIndex((s) => /^ +id: scope$/m.test(s));
    for (const [i, s] of st.entries()) {
      if (!browser.test(s)) continue;
      seen++;
      assert.ok(s.includes(GATE), `a browser step runs on docs-only pushes too, or skips on a mistyped condition:\n${s}`);
      assert.ok(scope >= 0 && scope < i, `a gated step comes before its job's scope step, so it never runs:\n${s}`);
    }
    if (scope >= 0) {
      assert.match(st[scope], /run: python3 tools\/ci_scope\.py "\$BASE"\n/, 'the scope step does not run tools/ci_scope.py');
      assert.match(st[scope], /BASE: \$\{\{ github\.event\.pull_request\.base\.sha \|\| github\.event\.before \}\}/, 'the scope step does not compare with the push or pull request base');
    }
  }
  assert.equal(seen, 5, `expected 5 browser steps (4 checks and the look matrix), found ${seen}`);
});
