// Browser storage: the autosaved project and saved stamps in IndexedDB,
// settings in localStorage, and saving and opening files (saveBlob, openFile).
// Every storage call is wrapped: a private window or blocked storage must
// never stop the app from drawing.

const DB = 'isopix';
const STORE = 'kv';

function open() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function idbGet(key) {
  try {
    const db = await open();
    return await new Promise((resolve, reject) => {
      const r = db.transaction(STORE).objectStore(STORE).get(key);
      r.onsuccess = () => resolve(r.result);
      r.onerror = () => reject(r.error);
    });
  } catch { return undefined; }
}

export async function idbSet(key, value) {
  try {
    const db = await open();
    await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).put(value, key);
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
    });
    return true;
  } catch { return false; }
}

export function loadSettings(defaults) {
  try {
    const s = JSON.parse(localStorage.getItem('isopix-settings') || '{}');
    const out = { ...defaults };
    // Only keep known keys with the default's type: a stale or bad value falls back.
    for (const k of Object.keys(defaults)) if (k in s && typeof s[k] === typeof defaults[k]) out[k] = s[k];
    return out;
  } catch { return { ...defaults }; }
}
export function saveSettings(s) {
  try { localStorage.setItem('isopix-settings', JSON.stringify(s)); } catch { /* storage blocked */ }
}

// ---------- saving and opening files ----------
// How Save reaches a file on this device. Pure, so test/storage.test.mjs can
// check every case:
//  'picker'   the browser's own Save dialog (Chrome and Edge on a computer).
//             The app keeps hold of the file, so the next Save writes the same one.
//  'share'    the share sheet, whose "Save to Files" is the dependable way on an
//             iPhone or iPad: a download link there can do nothing, or open the
//             file over the app with no way back when Isopix is on the home screen.
//  'download' a download link (Android, Firefox, Safari on a Mac).
export function saveMethod({ picker = false, shareFiles = false, ios = false } = {}) {
  if (picker) return 'picker';
  if (ios && shareFiles) return 'share';
  return 'download';
}

export const isIOS = () => /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

// Whether Save may make an .isopix file here. Not on iPhone or iPad: iOS does
// not know the type, so its file picker can grey the file out and the share
// sheet can refuse it; there Save always makes the PNG with the drawing inside
// (Owner: "devices where we can't save that stuff, we just shouldn't offer it").
export const offersIsopixFile = ({ ios = false } = {}) => !ios;
function canShareFiles(file) {
  try { return !!navigator.canShare && navigator.canShare({ files: [file] }); } catch { return false; }
}
const aborted = (err) => err && err.name === 'AbortError';

export function download(blob, name) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.hidden = true;
  document.body.append(a);
  a.click();
  a.remove();
  // Long enough for a slow phone to start writing a big picture.
  setTimeout(() => URL.revokeObjectURL(a.href), 60000);
}

async function writeTo(handle, blob) {
  if (handle.queryPermission && (await handle.queryPermission({ mode: 'readwrite' })) !== 'granted'
    && (await handle.requestPermission({ mode: 'readwrite' })) !== 'granted') throw new DOMException('no permission', 'NotAllowedError');
  const w = await handle.createWritable();
  await w.write(blob);
  await w.close();
}

// Saves a file the way this device does it best (saveMethod).
//   name     the suggested file name
//   type     its media type; accept: {'.ext': description} for the Save dialog
//   make({now})  makes the Blob. With now: true it must return it at once
//            (the share sheet needs the tap that asked for it to be recent);
//            otherwise it may return a promise.
//   handle   a file this drawing was saved to or opened from (picker only):
//            written again without a dialog; a failure there asks for a new file.
// Returns {how, handle?, name} when saved, {cancelled: true} when the person
// closed the dialog or sheet, {failed: message} when nothing could be saved.
export async function saveBlob({ name, type, accept, make, handle = null }) {
  const how = saveMethod({
    picker: typeof window.showSaveFilePicker === 'function',
    shareFiles: isIOS() && canShareFiles(new File([''], name, { type })),
    ios: isIOS(),
  });
  if (how === 'picker') {
    try {
      if (handle) {
        try { await writeTo(handle, await make({ now: false })); return { how, handle, name: handle.name }; } catch (err) { if (aborted(err)) return { cancelled: true }; }
      }
      const h = await window.showSaveFilePicker({ suggestedName: name, types: [{ description: accept.description, accept: { [type]: accept.ext } }] });
      await writeTo(h, await make({ now: false }));
      return { how, handle: h, name: h.name };
    } catch (err) {
      if (aborted(err)) return { cancelled: true };
      // Blocked here (an iframe, a policy): fall back to a download.
    }
  }
  if (how === 'share') {
    try {
      await navigator.share({ files: [new File([make({ now: true })], name, { type })] });
      return { how, name };
    } catch (err) {
      if (aborted(err)) return { cancelled: true };
    }
  }
  try {
    download(await make({ now: false }), name);
    return { how: 'download', name };
  } catch (err) { return { failed: err && err.message ? err.message : String(err) }; }
}

// Opens one file. Where the browser can (Chrome and Edge on a computer), it
// also hands back the file itself, so Save can write to it again.
// accept: {'media/type': ['.ext', …]}. Returns {file, handle?} or null when
// the person cancelled.
export async function openFile({ accept, description }) {
  if (typeof window.showOpenFilePicker === 'function') {
    try {
      const [handle] = await window.showOpenFilePicker({ types: [{ description, accept }] });
      return { file: await handle.getFile(), handle };
    } catch (err) {
      if (aborted(err)) return null;
    }
  }
  const file = await pickFile([...Object.values(accept).flat(), ...Object.keys(accept)].join(','));
  return file ? { file } : null;
}

// zlib (de)compression through the browser's streams, for the drawing inside a PNG.
const through = async (bytes, stream) => new Uint8Array(await new Response(new Blob([bytes]).stream().pipeThrough(stream)).arrayBuffer());
export const deflate = (bytes) => through(bytes, new CompressionStream('deflate'));
export const inflate = (bytes) => through(bytes, new DecompressionStream('deflate'));
export const gzip = (bytes) => through(bytes, new CompressionStream('gzip'));
export const gunzip = (bytes) => through(bytes, new DecompressionStream('gzip'));

export function pickFile(accept) {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = accept;
    input.hidden = true;
    // In the page, not floating: some Safari versions ignore a detached input.
    document.body.append(input);
    const done = (f) => { input.remove(); resolve(f); };
    input.addEventListener('change', () => done(input.files[0] || null));
    input.addEventListener('cancel', () => done(null));
    input.click();
  });
}

// Ask the browser not to clear the autosave when space runs low (Safari
// clears a site's storage after weeks unused otherwise). Firefox asks the
// person with a prompt, so it is not asked there; Chrome and Safari decide
// quietly. Once per session, after something is drawn.
let persistAsked = false;
export async function keepStorage() {
  if (persistAsked) return;
  persistAsked = true;
  try {
    if (/Firefox\//.test(navigator.userAgent) || !navigator.storage?.persist) return;
    if (!(await navigator.storage.persisted())) await navigator.storage.persist();
  } catch { /* not offered here */ }
}

export const stampName = () => new Date().toISOString().slice(0, 16).replace('T', ' ').replace(':', '.');
