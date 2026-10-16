// Can Isopix be installed as an app? Asks headless Chrome the way its Install
// button does (Page.getInstallabilityErrors), and checks what iPhone and iPad
// need, which Chrome does not: an apple-touch-icon and the home-screen meta
// tags. Exits 1 when a check fails.
//
//   node tools/install_check.mjs              (just install-check)
//   node tools/install_check.mjs --url URL    a live copy instead of a local server
import { spawn } from 'node:child_process';
import path from 'node:path';
import { launchChrome, connect, evaluate, sleep, freePort, waitFor, skipWelcome } from './chrome.mjs';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const urlArg = process.argv.indexOf('--url');
let home = urlArg > 0 ? process.argv[urlArg + 1].replace(/\/$/, '') : null;
if (!home) {
  const port = await freePort();
  const srv = spawn('python3', ['tools/serve.py', String(port)], { cwd: ROOT, stdio: 'ignore' });
  process.on('exit', () => srv.kill());
  home = `http://localhost:${port}`;
  await waitFor('the dev server', () => fetch(`${home}/version.json`).then((r) => r.ok));
}
const chrome = await launchChrome();
const { send } = await connect(await chrome.page());
await send('Page.enable');
await send('Runtime.enable');
await skipWelcome(send);
let failed = 0;
const check = (ok, what) => { console.log(`${ok ? '✅' : '❌'} ${what}`); if (!ok) failed++; };

await send('Page.navigate', { url: `${home}/` });
// The service worker must control the page before Chrome calls it installable.
await waitFor('the service worker', () => evaluate(send, '!!navigator.serviceWorker.controller'), 20000).catch(() => {});
await sleep(500);
const controlled = await evaluate(send, '!!navigator.serviceWorker.controller');
check(controlled, 'a service worker controls the page (works offline)');

const { installabilityErrors: errs } = await send('Page.getInstallabilityErrors');
check(errs.length === 0, errs.length ? `Chrome says not installable: ${errs.map((e) => e.errorId).join(', ')}` : 'Chrome would offer Install (Android, Windows, Mac, ChromeOS)');

const m = await send('Page.getAppManifest');
const man = m.data ? JSON.parse(m.data) : {};
check(!m.errors?.length, m.errors?.length ? `manifest errors: ${m.errors.map((e) => e.message).join('; ')}` : 'the manifest parses with no errors');
check(['standalone', 'fullscreen'].includes(man.display), `it opens in its own window (display: ${man.display})`);
const sizes = (man.icons || []).map((i) => `${i.sizes}${i.purpose ? ' ' + i.purpose : ''}`);
check(sizes.includes('192x192') && sizes.includes('512x512') && sizes.some((s) => s.includes('maskable')), `icons 192, 512 and maskable (${sizes.join(', ')})`);

// iPhone and iPad install from Share → Add to Home Screen; Safari reads these.
const ios = await evaluate(send, `({
  touch: !!document.querySelector('link[rel="apple-touch-icon"]'),
  capable: !!document.querySelector('meta[name="apple-mobile-web-app-capable"], meta[name="mobile-web-app-capable"]'),
  title: document.querySelector('meta[name="apple-mobile-web-app-title"]')?.content || '',
})`);
check(ios.touch, 'an apple-touch-icon for the iPhone and iPad home screen');
check(ios.capable, 'opens full screen from the iPhone and iPad home screen');
if (ios.touch) {
  const href = await evaluate(send, 'document.querySelector(\'link[rel="apple-touch-icon"]\').href');
  check(await fetch(href).then((r) => r.ok && /image\/png/.test(r.headers.get('content-type') || '')), `the apple-touch-icon is a PNG that loads (${href.replace(home, '')})`);
}
process.exit(failed ? 1 : 0);
