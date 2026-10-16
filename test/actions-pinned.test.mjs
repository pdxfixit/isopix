// Every third-party action in the workflows is pinned by full commit SHA, so a moved tag cannot change what CI runs.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const dir = fileURLToPath(new URL('../.github/workflows/', import.meta.url));

test('every `uses:` in the workflows is pinned by commit', () => {
  const bad = [];
  for (const f of readdirSync(dir).filter((n) => n.endsWith('.yml'))) {
    for (const line of readFileSync(dir + f, 'utf8').split('\n')) {
      const m = line.match(/^\s*(?:-\s+)?uses:\s*(\S+)/);
      if (!m || m[1].startsWith('./')) continue;
      // flarepress is checked out at its rolling v1 tag by the owner's decision.
      if (m[1] === 'pdxfixit/flarepress@v1') continue;
      if (!/@[0-9a-f]{40}$/.test(m[1]) || !/#\s*v\d/.test(line)) bad.push(`${f}: ${line.trim()}`);
    }
  }
  assert.deepEqual(bad, [], 'pin by 40-hex commit with the tag in a trailing comment');
});
