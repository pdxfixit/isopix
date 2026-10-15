// Moving house. Isopix lives at https://isopix.app; its old addresses
// (isopix.pdxfixit.com and Isogrid's) hand over what a browser saved there.
// Browsers keep saved data per address, so a plain redirect would leave every
// drawing behind. Each old address serves a small page (flarepress, its move
// Worker) that loads this file from isopix.app and runs moveToNewHome(): it
// reads that browser's autosave, settings and file record, packs them into the
// new address's #move= fragment (a fragment is never sent to any server), and
// goes. At the new address, app.js reads the fragment on start (readMoveHash)
// and keeps the drawing unless it already has one (landing). The old copy is
// left where it was.
//
// No imports and no DOM at load: the old pages load this one file cross-origin
// (see _headers: it is served with CORS), and the tests import its pure parts
// in Node.

export const HOME = 'https://isopix.app';
// The longest address to hand a browser: Chrome takes 2 MB; others less.
export const MAX_URL = 1_000_000;

// ---------- pure parts (test/move.test.mjs) ----------

const isObj = (x) => !!x && typeof x === 'object' && !Array.isArray(x);
export const hasDrawing = (p) => isObj(p) && ((p.cells?.length || 0) + (p.edges?.length || 0) + (p.log?.length || 0)) > 0;

// What to send, best first: everything; then without the trace picture; then
// without the undo history too; at last only the settings.
export function shrinkings(autosave) {
  if (!isObj(autosave)) return [{ autosave: null, dropped: [] }];
  const noTrace = { ...autosave };
  delete noTrace.trace;
  return [
    { autosave, dropped: [] },
    { autosave: noTrace, dropped: ['trace'] },
    { autosave: { ...noTrace, log: [], redo: [] }, dropped: ['trace', 'history'] },
    { autosave: null, dropped: ['drawing'] },
  ];
}

// The browser's saved settings worth carrying: Isopix's keys, and Isogrid's
// under their Isopix names. A key the new address already has is kept there.
export function keysToCopy(local, has) {
  const out = new Map();
  for (const [k, v] of Object.entries(isObj(local) ? local : {})) {
    if (typeof v !== 'string' || !/^(isopix|isogrid)-[a-z-]+$/.test(k)) continue;
    const to = k.replace(/^isogrid-/, 'isopix-');
    if (has(to) || (out.has(to) && k.startsWith('isogrid-'))) continue; // Isopix's own wins over Isogrid's
    out.set(to, v);
  }
  return [...out];
}

// What the new address does with a drawing that arrives:
//   'load'   it has none of its own: take it, silently
//   'offer'  it has its own: keep that, and offer the arrival
//   'ignore' nothing drawn, already taken once, or the same drawing
export function landing({ incoming, current, seen = [] }) {
  if (!incoming || !incoming.hasContent) return 'ignore';
  if (seen.some((s) => s && s.from === incoming.from && s.savedAt === incoming.savedAt)) return 'ignore';
  if (!current || !current.hasContent) return 'load';
  if (current.savedAt != null && current.savedAt === incoming.savedAt) return 'ignore';
  return 'offer';
}

// ---------- packing: JSON, gzip, base64url ----------

function b64url(bytes) {
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function unb64url(s) {
  const bin = atob(s.replace(/-/g, '+').replace(/_/g, '/'));
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}
async function through(bytes, stream) {
  return new Uint8Array(await new Response(new Blob([bytes]).stream().pipeThrough(stream)).arrayBuffer());
}
// "z…" is gzip, "j…" plain JSON where the browser has no CompressionStream.
export async function pack(obj) {
  const bytes = new TextEncoder().encode(JSON.stringify(obj));
  if (typeof CompressionStream === 'function') return `z${b64url(await through(bytes, new CompressionStream('gzip')))}`;
  return `j${b64url(bytes)}`;
}
export async function unpack(s) {
  if (typeof s !== 'string' || s.length < 2) throw new Error('empty');
  let bytes = unb64url(s.slice(1));
  if (s[0] === 'z') bytes = await through(bytes, new DecompressionStream('gzip'));
  else if (s[0] !== 'j') throw new Error('unknown packing');
  return JSON.parse(new TextDecoder().decode(bytes));
}

// The address to go to, with as much as fits (shrinkings, best first), and
// what had to stay behind. savedFile: the drawing went to the downloads instead.
export async function moveURL(saved, limit = MAX_URL, savedFile = false) {
  for (const { autosave, dropped } of shrinkings(saved.autosave)) {
    const url = `${HOME}/#move=${await pack({ v: 1, from: saved.from, autosave, file: saved.file || null, local: saved.local || {}, dropped, savedFile: savedFile && dropped.includes('drawing') })}`;
    if (url.length <= limit) return { url, dropped };
  }
  return { url: `${HOME}/`, dropped: ['drawing'] };
}

// A drawing's project file name, as the app names them.
export function fileNameFor(autosave) {
  const base = String(autosave?.name || '').replace(/[\\/:*?"<>|\u0000-\u001f]/g, '').trim().replace(/\s+/g, '-').slice(0, 60);
  return `${base || 'isopix'}.isopix.json`;
}

// The arrival, checked for shape (anyone can make a link with #move=). The
// drawing itself is checked again by project.js when it loads.
export function arrival(obj) {
  if (!isObj(obj) || obj.v !== 1) return null;
  return {
    from: typeof obj.from === 'string' ? obj.from.slice(0, 200) : '',
    autosave: isObj(obj.autosave) ? obj.autosave : null,
    file: isObj(obj.file) && typeof obj.file.name === 'string' ? { name: obj.file.name.slice(0, 200), at: Number(obj.file.at) || null, via: obj.file.via === 'open' ? 'open' : 'save', dirty: !!obj.file.dirty, handle: null } : null,
    local: isObj(obj.local) ? obj.local : {},
    dropped: Array.isArray(obj.dropped) ? obj.dropped.filter((d) => ['trace', 'history', 'drawing'].includes(d)) : [],
    savedFile: obj.savedFile === true,
  };
}

// ---------- in the browser ----------

// At the new address: the arrival in #move=, or null. The fragment is removed
// from the address either way, so a reload or a shared link never repeats it.
export async function readMoveHash() {
  const m = /^#move=(.+)$/.exec(location.hash);
  if (!m) return null;
  try { history.replaceState(null, '', location.pathname + location.search); } catch { /* sandboxed */ }
  try { return arrival(await unpack(m[1])); } catch { return null; }
}

// One IndexedDB database, read only: its autosave and file record, from the
// first store that has an autosave. A database that does not exist is not made.
function readDb(name) {
  return new Promise((resolve) => {
    let req;
    try { req = indexedDB.open(name); } catch { resolve(null); return; }
    req.onupgradeneeded = () => req.transaction.abort(); // it did not exist: leave it so
    req.onerror = () => resolve(null);
    req.onblocked = () => resolve(null);
    req.onsuccess = () => {
      const db = req.result;
      const stores = [...db.objectStoreNames];
      const next = (i) => {
        if (i >= stores.length) { db.close(); resolve(null); return; }
        try {
          const st = db.transaction(stores[i]).objectStore(stores[i]);
          const a = st.get('autosave'), f = st.get('file');
          f.onsuccess = () => {
            if (isObj(a.result)) { db.close(); resolve({ autosave: a.result, file: isObj(f.result) ? { ...f.result, handle: null } : null }); } else next(i + 1);
          };
          f.onerror = () => next(i + 1);
        } catch { next(i + 1); }
      };
      next(0);
    };
  });
}

async function readSaved() {
  let names = ['isopix', 'isogrid'];
  try { if (indexedDB.databases) names = [...new Set([...names, ...(await indexedDB.databases()).map((d) => d.name).filter(Boolean)])]; } catch { /* not listed here */ }
  let found = null;
  for (const name of names) if ((found = await readDb(name))) break;
  const local = {};
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (/^(isopix|isogrid)-/.test(k)) local[k] = localStorage.getItem(k);
    }
  } catch { /* storage blocked */ }
  return { from: location.hostname, autosave: found?.autosave || null, file: found?.file || null, local };
}

// A drawing too big for the address goes to the downloads as a project file.
function download(obj) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([JSON.stringify(obj)], { type: 'application/json' }));
  a.download = fileNameFor(obj);
  document.body.append(a);
  a.click();
  a.remove();
}

// At an old address: carry what this browser saved here to the new one, and
// go. The old service worker is let go, so this address stops serving a
// stale copy. Whatever goes wrong, it still goes, within a few seconds.
export async function moveToNewHome({ wait = 4000 } = {}) {
  const work = (async () => {
    const saved = await readSaved();
    let { url, dropped } = await moveURL(saved);
    if (dropped.includes('drawing') && hasDrawing(saved.autosave)) {
      try {
        download(saved.autosave);
        await new Promise((r) => setTimeout(r, 800)); // let the download start before the page goes
        ({ url } = await moveURL(saved, MAX_URL, true));
      } catch { /* left at the old address */ }
    }
    try {
      const regs = await navigator.serviceWorker?.getRegistrations?.();
      await Promise.all((regs || []).map((r) => r.unregister()));
    } catch { /* none, or not allowed */ }
    return url;
  })().catch(() => `${HOME}/`);
  const url = await Promise.race([work, new Promise((r) => setTimeout(() => r(`${HOME}/`), wait))]);
  location.replace(url);
}
