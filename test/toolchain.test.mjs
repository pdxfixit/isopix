// One place for each tool version, so CI, a cloud session and the docs cannot drift:
// Node comes from .node-version in every workflow, and the `just` the workflows
// install is the one tools/cloud_setup.sh pins (as in noodlepads).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const workflows = readdirSync(new URL('../.github/workflows/', import.meta.url)).filter((f) => f.endsWith('.yml'));

test('every workflow that sets up Node reads .node-version, one file', () => {
  assert.match(read('.node-version').trim(), /^\d+\.\d+\.\d+$/, 'a full version, so a bump is a decision');
  let setups = 0;
  for (const name of workflows) {
    const wf = read(`.github/workflows/${name}`);
    setups += (wf.match(/uses: actions\/setup-node@/g) || []).length;
    assert.equal((wf.match(/^\s+node-version-file: \.node-version$/gm) || []).length, (wf.match(/uses: actions\/setup-node@/g) || []).length, `${name}: each setup-node reads it`);
    assert.doesNotMatch(wf, /^\s+node-version: /m, `${name} pins no Node of its own`);
  }
  assert.ok(setups >= 3);
});

test('CI installs the just that cloud sessions install, and the docs name it', () => {
  const pinned = read('tools/cloud_setup.sh').match(/^JUST_VERSION=(\d+\.\d+\.\d+)$/m)?.[1];
  assert.ok(pinned, 'cloud_setup.sh pins JUST_VERSION');
  let installs = 0;
  for (const name of workflows) {
    for (const m of read(`.github/workflows/${name}`).matchAll(/casey\/just\/releases\/download\/([\d.]+)\/just-([\d.]+)-/g)) {
      installs++;
      assert.deepEqual([m[1], m[2]], [pinned, pinned], `${name} installs just ${pinned}`);
    }
  }
  assert.ok(installs >= 3);
  assert.match(read('docs/environment.md'), new RegExp(`just ${pinned.replace(/\.\d+$/, '')} or newer`));
});
