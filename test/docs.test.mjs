// The docs are the only memory a fresh session has, so they must not drift from
// the repo. These fail when AGENTS.md, README.md, TODO.md or docs/*.md name a
// `just` recipe or `just look` view that does not exist, link to a file or
// heading that does not exist, or name a repo path (in backticks) that does not
// exist; when CI stops running a look view; when CLAUDE.md stops being a bare
// import of AGENTS.md; or when AGENTS.md outgrows its budget.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const read = (f) => fs.readFileSync(path.join(ROOT, f), 'utf8');

// AGENTS.md is loaded into every session (CLAUDE.md imports it). 16,000 bytes is
// about 4,000 tokens: room for the contract, while the detail lives in docs/.
const AGENTS_MAX_BYTES = 16000;

// Paths the docs name that are made by tools and never committed.
const GENERATED = new Set(['web/version.json', 'shots', 'shots/']);

const DOCS = ['AGENTS.md', 'README.md', 'TODO.md',
  ...fs.readdirSync(path.join(ROOT, 'docs')).filter((f) => f.endsWith('.md')).map((f) => `docs/${f}`)];

// Code in a Markdown file: each line of a fenced block, and each inline `span`.
function codeOf(md) {
  const out = [];
  const fence = /^```[^\n]*\n([\s\S]*?)^```/gm;
  for (const m of md.matchAll(fence)) out.push(...m[1].split('\n'));
  for (const m of md.replace(fence, '').matchAll(/`([^`\n]+)`/g)) out.push(m[1]);
  return out;
}

function recipes() {
  let out;
  try {
    out = execFileSync('just', ['--summary'], { cwd: ROOT, encoding: 'utf8' });
  } catch (e) {
    throw new Error(`could not list recipes with \`just --summary\` (is just installed?): ${e.message}`);
  }
  const names = out.trim().split(/\s+/);
  assert.ok(names.length > 5, `just --summary listed only: ${out}`);
  return new Set(names);
}

function lookViews() {
  const r = spawnSync('node', [path.join(ROOT, 'tools/look.mjs'), '--help'], { encoding: 'utf8' });
  const m = /usage: just look \[([^\]]+?) \.\.\.\]/.exec(r.stderr);
  assert.ok(m, `could not read the view list from \`just look --help\`: ${r.stderr}`);
  return new Set(m[1].split('|'));
}

const LOOK_VALUE_FLAGS = new Set(['--js', '--url', '--out', '--widths', '--height']);
const WORD = /^[a-z][a-z0-9-]*$/;

// Every `just <recipe>` in code, and every view after `just look`.
function justCalls(line) {
  const calls = [];
  for (const cmd of line.split(/;|&&|\|\||\s\|\s|\s#/)) calls.push(...justCallsIn(cmd));
  return calls;
}
function justCallsIn(cmd) {
  const calls = [];
  const tokens = cmd.trim().split(/\s+/);
  for (let i = 0; i < tokens.length; i++) {
    if (tokens[i] !== 'just') continue;
    let j = i + 1;
    while (j < tokens.length && tokens[j].startsWith('-')) j++;
    const recipe = tokens[j];
    if (!recipe || !WORD.test(recipe)) continue;
    const views = [];
    if (recipe === 'look') {
      for (let k = j + 1; k < tokens.length; k++) {
        const t = tokens[k];
        if (LOOK_VALUE_FLAGS.has(t)) { k++; continue; }
        if (t.startsWith('-')) continue;
        if (t.startsWith('[') && t.includes('|')) { views.push(...t.replace(/[[\]]/g, '').split('|').filter((v) => WORD.test(v))); continue; }
        if (!WORD.test(t)) break;
        views.push(t);
      }
    }
    calls.push({ recipe, views });
  }
  return calls;
}

// GitHub's heading anchors: lowercase, punctuation dropped, spaces to hyphens.
const slug = (h) => h.trim().toLowerCase().replace(/[^\p{L}\p{N} _-]/gu, '').replace(/ /g, '-');
const anchorsOf = (md) => new Set([...md.replace(/^```[\s\S]*?^```/gm, '').matchAll(/^#{1,6} (.+)$/gm)].map((m) => slug(m[1])));

const TOP = new Set(fs.readdirSync(ROOT).filter((f) => f !== '.git'));
function looksLikeRepoPath(span) {
  if (/[\s<>*{}…$~|"'()=,]/.test(span) || span.includes('://')) return false;
  const first = span.split('/')[0];
  return TOP.has(first) && (span.includes('/') || /\.\w+$/.test(span));
}

test('every `just` recipe and `just look` view the docs name exists', () => {
  const have = recipes();
  const views = lookViews();
  const bad = [];
  for (const doc of DOCS) {
    for (const line of codeOf(read(doc))) {
      if (line.includes('flarepress')) continue; // flarepress's own recipes (plan, push, whoami)
      for (const { recipe, views: vs } of justCalls(line)) {
        if (!have.has(recipe)) bad.push(`${doc}: just ${recipe}`);
        for (const v of vs) if (!views.has(v)) bad.push(`${doc}: just look ${v}`);
      }
    }
  }
  assert.deepEqual(bad, [], `named in the docs but missing:\n${bad.join('\n')}`);
});

test('every relative link in the docs resolves, headings included', () => {
  const bad = [];
  for (const doc of DOCS) {
    const md = read(doc).replace(/^```[\s\S]*?^```/gm, '');
    for (const m of md.matchAll(/\]\(([^)\s]+)\)/g)) {
      const target = m[1];
      if (/^(https?:|mailto:)/.test(target)) continue;
      const [file, anchor] = target.split('#');
      const abs = file ? path.resolve(path.dirname(path.join(ROOT, doc)), file) : path.join(ROOT, doc);
      if (!fs.existsSync(abs)) { bad.push(`${doc}: ${target} (no such file)`); continue; }
      if (anchor && abs.endsWith('.md') && !anchorsOf(fs.readFileSync(abs, 'utf8')).has(anchor)) bad.push(`${doc}: ${target} (no such heading)`);
    }
  }
  assert.deepEqual(bad, [], `broken links:\n${bad.join('\n')}`);
});

test('every repo path the docs name in backticks exists', () => {
  const bad = [];
  for (const doc of DOCS) {
    for (const span of codeOf(read(doc))) {
      const p = span.trim();
      if (!looksLikeRepoPath(p) || GENERATED.has(p)) continue;
      if (!fs.existsSync(path.join(ROOT, p))) bad.push(`${doc}: ${p}`);
    }
  }
  assert.deepEqual(bad, [], `named in the docs but not in the repo:\n${bad.join('\n')}`);
});

test('CI runs every `just look` view, in both passes, through just look-ci', () => {
  // test.yml runs each pass as its own job (a matrix); `just look-ci` runs both, so a local run is CI's (2026-10-20).
  const yml = read('.github/workflows/test.yml');
  assert.match(yml, /^ {6}- name: [^\n]*\n(?: {8}if: [^\n]*\n)? {8}run: just look-ci \$\{\{ matrix\.pass \}\}\n/m, 'test.yml does not run just look-ci for each pass');
  assert.match(yml, /^ {8}pass: \[wide, short\]\n/m, 'test.yml\'s look matrix is not both passes, wide and short');
  const recipe = /^look-ci [^\n]*:\n((?:    [^\n]*\n)+)/m.exec(read('justfile'));
  assert.ok(recipe, 'no look-ci recipe in the justfile');
  const runs = recipe[1].split('\n').filter((l) => l.includes('node tools/look.mjs'));
  assert.equal(runs.length, 2, 'look-ci runs two passes');
  for (const l of runs) assert.match(l, / --all /, `a look-ci pass does not run every view: ${l.trim()}`);
  // Sharded, every view still runs: test/look-shard.test.mjs checks the split.
  for (const l of runs) assert.doesNotMatch(l, / --shard /, `a look-ci pass runs one shard, not all: ${l.trim()}`);
  assert.ok(runs.some((l) => / --height /.test(l)), 'look-ci has no short landscape pass');
});

test('CLAUDE.md only imports AGENTS.md, and AGENTS.md stays a short contract', () => {
  const claude = read('CLAUDE.md').replace(/<!--[\s\S]*?-->/g, '').trim();
  assert.equal(claude, '@AGENTS.md', 'CLAUDE.md must be just "@AGENTS.md" (plus comments); edit AGENTS.md instead');
  const bytes = Buffer.byteLength(read('AGENTS.md'));
  assert.ok(bytes <= AGENTS_MAX_BYTES, `AGENTS.md is ${bytes} bytes, over ${AGENTS_MAX_BYTES}: move detail into a linked doc`);
});
