// The justfile is the menu (docs/justfile-style.md): every recipe has a `#` doc comment
// directly above it, so `just --list` says what it does, and every file in tools/ is
// named in a doc, so a session can find what a tool is for (as in noodlepads).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');

// [name, documented] for each recipe in a justfile's text. Pure.
export function recipesOf(text) {
  const lines = text.split('\n');
  const out = [];
  lines.forEach((line, i) => {
    const m = /^@?([a-z][a-z0-9-]*)(?: [^:=]*)?:(?!=)/.exec(line);
    if (!m || /^\w+\s*:=/.test(line)) return;
    let j = i - 1;
    while (j >= 0 && /^\[.*\]\s*$/.test(lines[j])) j--; // attributes sit between the comment and the recipe
    out.push([m[1], j >= 0 && /^# \S/.test(lines[j])]);
  });
  return out;
}

test('recipesOf finds a recipe and whether a comment sits directly above it', () => {
  const text = '# 🔎 Does a thing\n[positional-arguments]\nfoo *args:\n    echo\n\nbar:\n    echo\n\n# comment\n\nbaz:\n    echo\nx := "a"\n';
  assert.deepEqual(recipesOf(text), [['foo', true], ['bar', false], ['baz', false]]);
});

test('every recipe has a doc comment directly above it', () => {
  const bad = [];
  for (const f of ['justfile', 'deploy.just']) {
    for (const [name, documented] of recipesOf(read(f))) if (!documented && name !== 'default') bad.push(`${f}: ${name}`);
  }
  assert.deepEqual(bad, [], 'put a `# <emoji> what it does` line directly above each (docs/justfile-style.md)');
});

test('every tool in tools/ is named in a doc', () => {
  const docs = ['README.md', 'AGENTS.md', ...readdirSync(new URL('../docs/', import.meta.url)).filter((f) => f.endsWith('.md')).map((f) => `docs/${f}`)]
    .map(read).join('\n');
  const missing = readdirSync(new URL('../tools/', import.meta.url), { withFileTypes: true })
    .filter((e) => e.isFile() && /\.(sh|py|mjs)$/.test(e.name) && !e.name.startsWith('test_'))
    .map((e) => e.name).filter((n) => !docs.includes(n));
  assert.deepEqual(missing, [], 'name each in README.md\'s tools row or a doc');
});
