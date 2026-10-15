// "🆕 An update for Isopix is ready.": when the bar shows, when it waits,
// what ✕ does, and that Reload saves first (web/update.js).
import test from 'node:test';
import assert from 'node:assert/strict';
import { updateOffer, liveVersionOf, buildStamp, aboutVersion, versionURL, issueURL, REPO, initUpdate, MIN_GAP_MS, CHECK_MS, TICK_MS } from '../web/update.js';

const offer = (o) => updateOffer({ loaded: 'aaa1111', live: 'bbb2222', busy: false, dismissed: null, ...o });

test('a newer live version shows the bar; the same one, or none known, does not', () => {
  assert.equal(offer({}), 'show');
  assert.equal(offer({ live: 'aaa1111' }), 'none');
  assert.equal(offer({ live: null }), 'none');
  assert.equal(offer({ live: '' }), 'none');
});

test('a dev copy, or one that never learned its version, never offers', () => {
  assert.equal(offer({ loaded: 'dev' }), 'none');
  assert.equal(offer({ loaded: null }), 'none');
  assert.equal(offer({ live: 'dev' }), 'none');
});

test('busy: it waits, and shows after', () => {
  assert.equal(offer({ busy: true }), 'wait');
  assert.equal(offer({ busy: false }), 'show');
});

test('✕ hides that version; a newer one still shows', () => {
  assert.equal(offer({ dismissed: 'bbb2222' }), 'none');
  assert.equal(offer({ dismissed: 'bbb2222', live: 'ccc3333' }), 'show');
});

test('liveVersionOf reads a version.json, and nothing else', () => {
  assert.equal(liveVersionOf({ version: 'bbb2222', date: '2026-10-12 13:45 PDT' }), 'bbb2222');
  assert.equal(liveVersionOf({ version: 'dev' }), null);
  assert.equal(liveVersionOf({ version: 42 }), null);
  assert.equal(liveVersionOf(null), null);
  assert.equal(liveVersionOf('bbb2222'), null);
});

// The bar wired to stand-ins: a clock, a version.json, timers run by hand.
function rig({ loaded = 'aaa1111', live = 'bbb2222' } = {}) {
  const listeners = { doc: new Map(), win: new Map() };
  const target = (map) => ({ addEventListener: (t, fn) => map.set(t, fn) });
  const doc = { visibilityState: 'visible', ...target(listeners.doc) };
  const win = target(listeners.win);
  const button = () => { const b = { fns: [], addEventListener: (_t, fn) => b.fns.push(fn), click: async () => { for (const f of b.fns) await f(); } }; return b; };
  const r = { t: 0, busy: false, live, fails: false, asked: [], reloads: 0, saved: 0, timers: [], bar: { hidden: true }, reloadBtn: button(), closeBtn: button(), doc, listeners };
  r.api = initUpdate({
    bar: r.bar, reloadBtn: r.reloadBtn, closeBtn: r.closeBtn,
    loaded: () => loaded, busy: () => r.busy,
    beforeReload: async () => { r.saved++; },
    fetch: async (url, opts) => {
      r.asked.push({ url, opts });
      if (r.fails) throw new Error('offline');
      return { ok: true, json: async () => ({ version: r.live }) };
    },
    reload: () => { r.reloads++; },
    now: () => r.t,
    every: (fn, ms) => r.timers.push({ fn, ms }),
    doc, win,
  });
  r.run = async (ms) => { for (const x of r.timers) if (x.ms === ms) await x.fn(); };
  r.focus = async () => { await listeners.win.get('focus')(); };
  return r;
}

test('it asks no-store, every 10 minutes and on focus, at most once a minute', async () => {
  const r = rig();
  await r.focus();
  assert.equal(r.asked.length, 0, 'the page just loaded');
  r.t = MIN_GAP_MS;
  await r.focus();
  assert.equal(r.asked.length, 1);
  assert.deepEqual(r.asked[0], { url: 'version.json', opts: { cache: 'no-store' } });
  assert.equal(r.bar.hidden, false);
  await r.focus();
  assert.equal(r.asked.length, 1, 'not again within the minute');
  r.t += CHECK_MS;
  await r.run(CHECK_MS);
  assert.equal(r.asked.length, 2);
});

test('a hidden page does not ask; showing again does', async () => {
  const r = rig();
  r.t = CHECK_MS;
  r.doc.visibilityState = 'hidden';
  await r.run(CHECK_MS);
  assert.equal(r.asked.length, 0);
  r.doc.visibilityState = 'visible';
  await r.listeners.doc.get('visibilitychange')();
  assert.equal(r.asked.length, 1);
});

test('while busy (mid-stroke, preview, menu open) it neither asks nor shows, and catches up after', async () => {
  const r = rig();
  r.t = MIN_GAP_MS;
  r.busy = true;
  await r.focus();
  assert.equal(r.asked.length, 0);
  r.busy = false;
  await r.run(TICK_MS);
  assert.equal(r.asked.length, 1, 'owed, so it asks once idle');
  assert.equal(r.bar.hidden, false);
  r.busy = true; // a stroke starts with the bar up
  await r.run(TICK_MS);
  assert.equal(r.bar.hidden, true);
  await r.reloadBtn.click();
  assert.equal(r.reloads, 0, 'Reload never fires while busy');
  r.busy = false;
  await r.run(TICK_MS);
  assert.equal(r.bar.hidden, false);
});

test('Reload saves first, then reloads once', async () => {
  const r = rig();
  r.t = MIN_GAP_MS;
  await r.focus();
  await r.reloadBtn.click();
  assert.equal(r.saved, 1);
  assert.equal(r.reloads, 1);
  await r.reloadBtn.click();
  assert.equal(r.reloads, 1, 'a second tap while reloading does nothing');
});

test('✕ hides it until the next check; errors are ignored', async () => {
  const r = rig();
  r.t = MIN_GAP_MS;
  await r.focus();
  await r.closeBtn.click();
  assert.equal(r.bar.hidden, true);
  await r.run(TICK_MS);
  assert.equal(r.bar.hidden, true, 'stays hidden between checks');
  r.t += MIN_GAP_MS;
  await r.focus();
  assert.equal(r.bar.hidden, false, 'the next check offers it again');
  await r.closeBtn.click();
  r.fails = true;
  r.t += MIN_GAP_MS;
  await r.focus();
  assert.equal(r.bar.hidden, true, 'a failed check keeps it put away');
});

test('a dev copy never asks', async () => {
  const r = rig({ loaded: 'dev' });
  r.t = CHECK_MS * 3;
  await r.focus();
  await r.run(CHECK_MS);
  assert.equal(r.asked.length, 0);
  assert.equal(r.bar.hidden, true);
});

test('the corner stamp shows the release and the deployed commit, and never trusts a bad one', () => {
  assert.equal(buildStamp('1.0.2', { version: 'v1.0.2', commit: '55a1363' }), '1.0.2 · 55a1363');
  assert.equal(buildStamp('1.0.2', { version: 'v1.0.2', commit: '55a13639abcdef' }), '1.0.2 · 55a1363');
  assert.equal(buildStamp('1.0.2', { version: 'v1.0.2' }), '1.0.2');              // a stamp from before the commit field
  assert.equal(buildStamp('1.0.2', { version: 'v1', commit: '<b>x</b>' }), '1.0.2');
  assert.equal(buildStamp('1.0.2', null), '1.0.2 · dev');                          // no version.json: a dev server
  assert.equal(buildStamp(undefined, null), 'dev · dev');
});

test('About names the release and the commit in parentheses, never the release twice', () => {
  assert.equal(aboutVersion('1.0.4', { version: 'v1.0.4', commit: 'a95077f' }), 'Version 1.0.4 (a95077f)');
  assert.equal(aboutVersion('1.0.4', { version: 'v1.0.4' }), 'Version 1.0.4');
  assert.equal(aboutVersion('1.0.4', null), 'Version 1.0.4 (dev)');
});

test('the version links to its commit, and a problem report opens a filled-in GitHub issue', () => {
  const json = { version: 'v1.2.24', commit: 'e7bdc86f00' };
  assert.equal(REPO, 'https://github.com/pdxfixit/isopix');
  assert.equal(versionURL(json), `${REPO}/commit/e7bdc86`);
  assert.equal(versionURL(null), REPO, 'a dev copy links to the repo');
  assert.equal(versionURL({ version: 'v1', commit: '<b>' }), REPO);
  const url = new URL(issueURL({ app: '1.2.24', json, ua: 'Mozilla/5.0 (iPhone)', screen: '390×844', installed: true }));
  assert.equal(url.origin + url.pathname, `${REPO}/issues/new`);
  const body = url.searchParams.get('body');
  assert.match(body, /\*\*What happened\?\*\*/);
  assert.match(body, /Isopix \[1\.2\.24 · e7bdc86\]\(https:\/\/github\.com\/pdxfixit\/isopix\/commit\/e7bdc86\)/);
  assert.match(body, /Browser: Mozilla\/5\.0 \(iPhone\)/);
  assert.match(body, /Screen: 390×844/);
  assert.match(body, /Installed: yes/);
  assert.match(new URL(issueURL({ app: '1.2.24', json: null })).searchParams.get('body'), /Isopix 1\.2\.24 · dev/, 'a dev copy: no link');
});
