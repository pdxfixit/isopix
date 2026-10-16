// Every name a module in web/ imports from another module in web/ is exported
// there. A missing one is a SyntaxError when the page loads, so nothing starts,
// and no other test sees it (node --check reads one file at a time). Found the
// hard way on 2026-10-16: Ctrl+O still imported a function the gallery removed.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const web = new URL('../web/', import.meta.url).pathname;
const files = (dir) => fs.readdirSync(dir, { withFileTypes: true }).flatMap((d) => (d.isDirectory() ? files(path.join(dir, d.name)) : d.name.endsWith('.js') ? [path.join(dir, d.name)] : []));

function exportsOf(file) {
  const s = fs.readFileSync(file, 'utf8');
  const out = new Set();
  for (const m of s.matchAll(/^export\s+(?:async\s+)?(?:function\*?|const|let|var|class)\s+([\w$]+)/gm)) out.add(m[1]);
  for (const m of s.matchAll(/^export\s+(?:const|let|var)\s+([\w$]+)\s*=[^;]*?,\s*([\w$]+)\s*=/gm)) out.add(m[2]);
  for (const m of s.matchAll(/^export\s*\{([^}]*)\}/gm)) for (const n of m[1].split(',')) out.add(n.trim().split(/\s+as\s+/).pop());
  for (const m of s.matchAll(/^let\s+([^;=]+);/gm)) void m; // plain lets are not exports
  return out;
}

test('every named import from a module in web/ is exported by it', () => {
  const missing = [];
  for (const file of files(web)) {
    const s = fs.readFileSync(file, 'utf8');
    for (const m of s.matchAll(/^import\s*\{([^}]*)\}\s*from\s*'(\.[^']+)'/gm)) {
      const target = path.resolve(path.dirname(file), m[2]);
      if (!target.startsWith(web)) continue;
      const have = exportsOf(target);
      for (const n of m[1].split(',').map((x) => x.trim().split(/\s+as\s+/)[0]).filter(Boolean)) {
        if (!have.has(n)) missing.push(`${path.relative(web, file)} imports ${n} from ${m[2]}`);
      }
    }
  }
  assert.deepEqual(missing, []);
});
