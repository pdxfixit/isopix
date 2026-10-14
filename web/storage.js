// Browser storage: the autosaved project and saved stamps in IndexedDB,
// settings in localStorage, and file save/open/download helpers.
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

export function download(blob, name) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
}

export function pickFile(accept) {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = accept;
    input.addEventListener('change', () => resolve(input.files[0] || null));
    input.click();
  });
}

export const stampName = () => new Date().toISOString().slice(0, 16).replace('T', ' ').replace(':', '.');
