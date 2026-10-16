// The app's own source as one text: web/app.js and every module in web/ui/
// (split out of app.js by job). Tests that check "the app handles X" read
// this, so code moving between those files never breaks a check.
import fs from 'node:fs';

const web = new URL('../web/', import.meta.url);
const ui = fs.readdirSync(new URL('ui/', web)).filter((f) => f.endsWith('.js')).sort().map((f) => `ui/${f}`);
export const APP_FILES = ['app.js', ...ui];
export const appSource = APP_FILES.map((f) => fs.readFileSync(new URL(f, web), 'utf8')).join('\n');
