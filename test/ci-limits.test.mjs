// The deploy waits for GitHub's test run, so its limits must outlast CI's.
// 2026-10-19: the test job took 18m49s of its 20, GitHub marked the run done
// 5 minutes after the job ended, and the deploy, which waited 20 minutes,
// gave up on a green run and shipped nothing.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const minutes = (p) => Number(read(p).match(/^\s+timeout-minutes: (\d+)$/m)?.[1]);

test("the deploy's wait for CI outlasts CI's own limit, and the deploy job outlasts its wait", () => {
  const ci = minutes('.github/workflows/test.yml');
  const deployJob = minutes('.github/workflows/deploy.yml');
  const wait = Number(read('tools/deploy.sh').match(/^CI_WAIT_MIN=(\d+)$/m)?.[1]);
  assert.ok(ci > 0 && deployJob > 0 && wait > 0, `read ci=${ci} wait=${wait} deploy=${deployJob}`);
  assert.ok(wait >= ci + 10, `deploy.sh waits ${wait} min for a CI job allowed ${ci}: GitHub can finish a run minutes after its job`);
  assert.ok(deployJob >= wait + 10, `deploy.yml allows ${deployJob} min, but the CI wait alone can take ${wait}, and the deploy and checks follow`);
});
