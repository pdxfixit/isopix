// Draws every starter stamp from every side into docs/stamps/ (owner, 2026-10-19:
// "have the tooling produce mock-ups of each stamp from all four directions in the
// documentation folders"): one SVG per stamp, its views left to right, and an index,
// docs/stamps/README.md, by the Stamps drawer's sections. A 3D stamp shows its four
// turns (as drawn, then a quarter turn at a time, as Spin turns it); a flat picture
// its planes (upright, floor, left wall, right wall); a letter or number its walls
// and floor. The same code the app draws them with, so a sheet is what the app shows.
//
//   node tools/stamp_sheets.mjs            writes docs/stamps/
//   node tools/stamp_sheets.mjs --check    fails if docs/stamps/ is not what this makes
//   node tools/stamp_sheets.mjs --only ID  writes one stamp's sheet (and the index)
import fs from 'node:fs';
import path from 'node:path';
import * as SB from '../web/stampbook.js';
import { sheetSVG, viewsOf } from './stampsheet.mjs';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const DIR = path.join(ROOT, 'docs/stamps');

function indexMD() {
  const out = [
    '# Stamps from every side',
    '',
    'Made by `tools/stamp_sheets.mjs` (`just stamp-sheets`); edit the art, then run it, never these files. `just test` fails when they are stale.',
    'A 3D stamp is shown as drawn, then turned a quarter at a time (Spin); a flat picture upright and on the floor and walls; a letter or number on its walls and the floor.',
    'New stamps come in by [the stamp art contract](../stamp-art-contract.md).',
    '',
  ];
  for (const g of SB.GROUPS) {
    const items = SB.STARTER.filter((s) => s.group === g.id);
    out.push(`## ${g.name}`, '');
    for (const s of items) {
      const views = viewsOf(s).map(([label]) => label).join(', ');
      out.push(`**${s.name}** (\`${s.id}\`, ${s.stamp.cells.length} cells): ${views}`, '', `![${s.name} from every side](${s.id}.svg)`, '');
    }
  }
  return out.join('\n');
}

const files = new Map([['README.md', indexMD()]]);
const only = process.argv.includes('--only') ? process.argv[process.argv.indexOf('--only') + 1] : null;
for (const s of SB.STARTER) if (!only || s.id === only) files.set(`${s.id}.svg`, sheetSVG(s));

if (process.argv.includes('--check')) {
  const bad = [];
  for (const [name, text] of files) {
    const p = path.join(DIR, name);
    if (!fs.existsSync(p) || fs.readFileSync(p, 'utf8') !== text) bad.push(name);
  }
  const extra = fs.existsSync(DIR) ? fs.readdirSync(DIR).filter((n) => !files.has(n)) : [];
  if (bad.length || extra.length) {
    console.error(`❌ docs/stamps/ is not what tools/stamp_sheets.mjs makes (${[...bad, ...extra.map((n) => `${n}, not a stamp`)].slice(0, 6).join(', ')}${bad.length + extra.length > 6 ? ', …' : ''}): run just stamp-sheets`);
    process.exit(1);
  }
  console.log(`✅ docs/stamps/ matches: ${files.size - 1} stamps`);
  process.exit(0);
}
fs.mkdirSync(DIR, { recursive: true });
if (!only) for (const n of fs.readdirSync(DIR)) if (!files.has(n)) fs.rmSync(path.join(DIR, n));
for (const [name, text] of files) fs.writeFileSync(path.join(DIR, name), text);
console.log(`🖼️  docs/stamps/: ${files.size - 1} sheets and README.md`);
