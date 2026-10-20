// `just look --shards N` splits the views across N processes (tools/look_shard.mjs).
// A view left out of every shard would silently never run in CI, and a view in
// two would run twice; the split must be the same on every run.
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { shards, shard, parseShard, SECONDS, SECONDS_DEFAULT } from '../tools/look_shard.mjs';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const look = (...args) => {
  const r = spawnSync('node', [path.join(ROOT, 'tools/look.mjs'), ...args], { encoding: 'utf8' });
  assert.equal(r.status, 0, `just look ${args.join(' ')}: ${r.stderr}`);
  return r.stdout.split('\n').filter(Boolean);
};
const VIEWS = look('--all', '--list');
const cost = (v) => SECONDS[v] ?? SECONDS_DEFAULT;
const total = (vs) => vs.reduce((t, v) => t + cost(v), 0);

test('every view is in exactly one shard, in its usual order, for 1 to 6 shards', () => {
  assert.ok(VIEWS.length > 40, `read only ${VIEWS.length} views from just look --all --list`);
  for (let n = 1; n <= 6; n++) {
    const all = shards(VIEWS, n);
    assert.equal(all.length, n);
    assert.deepEqual(all.flat().sort(), [...VIEWS].sort(), `${n} shards do not hold every view once`);
    for (const s of all) assert.deepEqual(s, VIEWS.filter((v) => s.includes(v)), `a shard of ${n} is out of the usual order`);
    for (let i = 1; i <= n; i++) assert.deepEqual(shard(VIEWS, i, n), all[i - 1]);
  }
  assert.deepEqual(shard(VIEWS, 1, 1), VIEWS, '--shard 1/1 is not the whole run');
});

test('the shards take about equal time: none over an even share plus the slowest view', () => {
  const slowest = Math.max(...VIEWS.map(cost));
  for (let n = 2; n <= 6; n++) {
    const loads = shards(VIEWS, n).map(total);
    assert.ok(Math.max(...loads) <= total(VIEWS) / n + slowest, `${n} shards: ${loads.join(', ')} s`);
  }
});

test('the split is the same every run, and a view never moves for a view added after it', () => {
  assert.deepEqual(shards(VIEWS, 4), shards([...VIEWS], 4));
  // A new view (default seconds) joins a shard; the slow views stay where they were.
  const slow = VIEWS.filter((v) => cost(v) > 30);
  const before = shards(VIEWS, 4), after = shards([...VIEWS, 'a-new-view'], 4);
  for (const v of slow) assert.equal(after.findIndex((s) => s.includes(v)), before.findIndex((s) => s.includes(v)), v);
});

test('look.mjs runs only its shard: --shard i/n --list over every i is every view', () => {
  for (const n of [1, 4]) {
    const got = [];
    for (let i = 1; i <= n; i++) {
      const mine = look('--all', '--shard', `${i}/${n}`, '--list');
      assert.deepEqual(mine, shard(VIEWS, i, n), `shard ${i}/${n}`);
      got.push(...mine);
    }
    assert.deepEqual(got.sort(), [...VIEWS].sort());
  }
});

test('--shard takes i/n with 1 <= i <= n', () => {
  assert.deepEqual(parseShard('2/4'), { i: 2, n: 4 });
  for (const bad of ['0/4', '5/4', '1/0', '2', 'a/b', '-1/2', '']) assert.throws(() => parseShard(bad), /--shard takes i\/n/, bad);
});

test('every view the shard table times is a real view', () => {
  const stale = Object.keys(SECONDS).filter((v) => !VIEWS.includes(v));
  assert.deepEqual(stale, [], 'tools/look_shard.mjs times views that no longer exist');
});
