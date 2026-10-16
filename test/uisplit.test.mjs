// web/ui/*.js import from app.js and app.js imports them, so each ui module
// runs its top level before app.js has made `app`, `$` or anything else of its
// own. A top-level line that uses one throws at start, and the app never loads
// (app.js itself, which runs last, may). Functions are fine: they run later.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { APP_FILES } from './appsource.mjs';

const web = new URL('../web/', import.meta.url);

// The names a module imports from ../app.js.
const fromApp = (src) => [...src.matchAll(/^import \{([^}]*)\} from '\.\.\/app\.js';/gm)].flatMap((m) => m[1].split(',').map((s) => s.trim()));

// Top-level lines that run when the module loads: not imports, comments,
// function declarations, closing braces, or a const that is an arrow function.
function eager(src) {
  return src.split('\n').filter((l) => /^\S/.test(l)
    && !/^(import |\/\/|\/\*|\*|\}|\)|\])/.test(l)
    && !/^(export )?(async )?function/.test(l)
    && !/^(export )?(const|let) [\w$]+ = (async )?\([^)]*\) =>/.test(l)
    && !/^(export )?(const|let) [\w$]+ = (async )?[\w$]+ =>/.test(l));
}

test('no web/ui module uses what it imports from app.js while it loads', () => {
  for (const f of APP_FILES.filter((f) => f.startsWith('ui/'))) {
    const src = fs.readFileSync(new URL(f, web), 'utf8');
    for (const name of fromApp(src)) {
      for (const l of eager(src)) {
        assert.ok(!new RegExp(`(?<![\\w$.])${name.replace('$', '\\$')}(?![\\w$])`).test(l), `${f}: "${l.trim()}" uses ${name} from app.js while loading; move it into a function or into app.js`);
      }
    }
  }
});
