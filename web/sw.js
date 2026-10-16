// Service worker: makes Isopix installable and usable offline.
// Network first, cache as the fallback, so a deploy is picked up on the next
// load with a connection and the app still opens with none. The cache name
// carries the version from version.js; activating a new version deletes the
// old caches, so nothing stale is served forever.
importScripts('./version.js');
const CACHE = `isopix-${self.ISOPIX_VERSION}`;
// Every file the app loads (test/sw.test.mjs fails when one is missing: the
// first load runs before this worker controls the page, so a module left out
// here is not cached until a second visit, and an offline start breaks).
const SHELL = [
  './', './index.html', './styles.css', './version.js', './manifest.webmanifest',
  './app.js', './render.js', './layer.js', './update.js', './storage.js', './glyphs.js',
  './keys.js', './help.js', './palette.js', './sheets.js', './move.js', './events.js', './events-client.js', './welcome.js', './tour.js', './lessons.js', './sillynames.js', './loading.js', './autosave.js', './gallery.js',
  './ui/controls.js', './ui/tools.js', './ui/input.js', './ui/screens.js', './ui/files.js', './ui/gallery.js',
  './engine/lattice.js', './engine/model.js', './engine/brushes.js', './engine/symmetry.js',
  './engine/fill.js', './engine/density.js', './engine/svg.js', './engine/project.js',
  './engine/view.js', './engine/color.js', './engine/paper.js', './engine/protect.js',
  './engine/gesture.js', './engine/pngproject.js',
  './icons/icon.svg', './icons/icon-192.png', './icons/icon-512.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys()
    .then((keys) => Promise.all(keys.filter((k) => k.startsWith('isopix-') && k !== CACHE).map((k) => caches.delete(k))))
    .then(() => self.clients.claim()));
});

// The update bar's Reload asks a waiting worker to take over now.
self.addEventListener('message', (e) => { if (e.data && e.data.type === 'skip-waiting') self.skipWaiting(); });

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
  // version.json is the deploy's label: never cache it.
  if (new URL(req.url).pathname.endsWith('/version.json')) return;
  e.respondWith(
    fetch(req)
      .then((res) => {
        if (res.ok) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)); }
        return res;
      })
      .catch(() => caches.match(req, { ignoreSearch: true }).then((hit) => hit || caches.match('./index.html'))),
  );
});
