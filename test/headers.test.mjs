// web/_headers is the security boundary of the live site, so its policy is
// pinned: what it must keep, and that it allows no more than the page loads.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';

const headers = readFileSync(new URL('../web/_headers', import.meta.url), 'utf8');
const html = readFileSync(new URL('../web/index.html', import.meta.url), 'utf8');
const value = (name) => headers.match(new RegExp(`^\\s+${name}:\\s*(.+)$`, 'mi'))?.[1];
const csp = Object.fromEntries(value('Content-Security-Policy').split(';').map((d) => {
  const [name, ...sources] = d.trim().split(/\s+/);
  return [name, sources];
}));

test('the policy is closed by default, with no framing, plugins, <base> or form post', () => {
  assert.deepEqual(csp['default-src'], ["'self'"]);
  assert.deepEqual(csp['object-src'], ["'none'"]);
  assert.deepEqual(csp['frame-ancestors'], ["'none'"]);
  assert.deepEqual(csp['base-uri'], ["'none'"]);
  assert.deepEqual(csp['form-action'], ["'none'"]);
});

test('scripts: this site and Cloudflare\'s page counter only, never inline or eval', () => {
  assert.deepEqual(csp['script-src'], ["'self'", 'https://static.cloudflareinsights.com']);
  assert.doesNotMatch(csp['script-src'].join(' '), /unsafe-|\*/);
});

test('styles come from this site\'s files only: no style attribute or <style> anywhere the page is built', () => {
  assert.deepEqual(csp['style-src'], ["'self'"]);
  // A style="" attribute (in markup or in a string that becomes markup) or setAttribute('style') is blocked
  // by this policy; element.style.x = … is not. Set colors through the style object.
  const sources = [['index.html', html]];
  const walk = (dir) => {
    for (const e of readdirSync(new URL(`../web/${dir}`, import.meta.url), { withFileTypes: true })) {
      const rel = `${dir}${e.name}`;
      if (e.isDirectory()) { if (!/^(clips|fonts|icons)/.test(e.name)) walk(`${rel}/`); } else if (e.name.endsWith('.js')) sources.push([rel, readFileSync(new URL(`../web/${rel}`, import.meta.url), 'utf8')]);
    }
  };
  walk('');
  assert.ok(sources.length > 20);
  for (const [name, text] of sources) {
    assert.doesNotMatch(text, /\bstyle\s*=\s*["'`\\]|<style\b|setAttribute\(\s*['"]style['"]/i, `${name} sets an inline style`);
    // Copying one element's markup into another carries the style attributes the style object made (the folded
    // Colors button once did); copy nodes with cloneNode instead.
    assert.doesNotMatch(text, /\.innerHTML\b(?!\s*(=(?!=)|\+=))/, `${name} reads innerHTML (copy nodes, not markup)`);
  }
});

test('connections and outside origins: only Cloudflare\'s page counter', () => {
  assert.deepEqual(csp['connect-src'], ["'self'", 'https://cloudflareinsights.com']);
  const outside = new Set(Object.values(csp).flat().filter((s) => /^https?:/.test(s)));
  assert.deepEqual([...outside].sort(), ['https://cloudflareinsights.com', 'https://static.cloudflareinsights.com']);
  // What the page loads: <link href> and src. A plain <a href> loads nothing.
  const origins = [...html.matchAll(/(?:<link\b[^>]*\bhref|\bsrc)="(https?:\/\/[^/"]+)/g)].map((m) => m[1]);
  assert.deepEqual(origins, []);
});

test('the page has no <base> and no form that posts anywhere: its forms only close sheets', () => {
  assert.doesNotMatch(html, /<base\b/i);
  const forms = [...html.matchAll(/<form\b[^>]*>/gi)].map((m) => m[0]);
  assert.ok(forms.length > 0);
  for (const f of forms) assert.match(f, /method="dialog"/, `${f} must be method="dialog" (form-action 'none' blocks a post)`);
});

test('the other hardening headers are still there', () => {
  assert.equal(value('X-Content-Type-Options'), 'nosniff');
  assert.equal(value('Referrer-Policy'), 'no-referrer');
  assert.equal(value('Cross-Origin-Opener-Policy'), 'same-origin');
  const perms = value('Permissions-Policy');
  for (const feature of ['camera', 'microphone', 'geolocation', 'payment', 'usb']) assert.match(perms, new RegExp(`${feature}=\\(\\)`));
  // The service worker and the release stamp are never cached; the deploy label is not stored at all.
  const rule = (path) => headers.match(new RegExp(`^${path.replace('.', '\\.')}\\n\\s+Cache-Control:\\s*(.+)$`, 'm'))?.[1];
  assert.equal(rule('/sw.js'), 'no-cache');
  assert.equal(rule('/version.js'), 'no-cache');
  assert.equal(rule('/version.json'), 'no-store');
});
