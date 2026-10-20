// The time-lapse as a video file (the owner's pick: Save video on the replay
// bar once it has played, and a link on the Drawings sheet), and the replay
// bar's states. Browsers open a save dialog or share sheet only right after a
// tap, and recording takes the replay's length, so it is two taps: Save video
// makes it ("Making the video… 40%"), then Save video saves it.

import { plan, pickType, frameSize } from '../video.js';
import * as P from '../engine/project.js';
import { bounds } from '../engine/svg.js';
import { drawCells, drawEdges } from '../render.js';
import { paperOf } from '../engine/paper.js';
import * as store from '../storage.js';
import { fileBase } from '../sheets.js';
import { $, app, emit, toast } from '../app.js';
import { sayResult } from './files.js';
import { endLive } from './livestamp.js';

const type = () => (typeof MediaRecorder === 'undefined' ? null : pickType((m) => MediaRecorder.isTypeSupported(m)));
export const canRecord = () => typeof HTMLCanvasElement !== 'undefined' && !!HTMLCanvasElement.prototype.captureStream && !!type();

// ---------- the replay bar ----------
// playing: Replaying · Stop. ended: Done playing · Watch again · Save video · ✕.
// making: Making the video… n% · Cancel. ready: Video ready · Save video · ✕.
// It wraps onto two lines rather than run off a narrow screen.
export function setBar(mode, say) {
  const bar = $('#replay-bar');
  bar.hidden = !mode;
  bar.dataset.mode = mode || '';
  if (!mode) return;
  // A stamp waiting for its ✓ is kept as it is: its bar and knobs would sit on this one (2026-10-20).
  endLive();
  $('#replay-say').textContent = say || { playing: 'Replaying', ended: 'Done playing', ready: 'Video ready' }[mode] || '';
  $('#replay-stop').hidden = !(mode === 'playing' || mode === 'making');
  $('#replay-stop').textContent = mode === 'making' ? 'Cancel' : 'Stop';
  $('#replay-stop').setAttribute('aria-label', mode === 'making' ? 'Stop making the video' : 'Stop replay');
  $('#replay-again').hidden = mode !== 'ended';
  $('#replay-video').hidden = !((mode === 'ended' && canRecord()) || mode === 'ready');
  $('#replay-close').hidden = !(mode === 'ended' || mode === 'ready');
  bar.classList.toggle('has-close', !$('#replay-close').hidden);
}
export const barMode = () => $('#replay-bar').dataset.mode || '';

// ---------- making it ----------
let made = null;   // {blob, ext, mime, version}: the last video, while the drawing is unchanged
let making = null; // {cancelled}

// Every step of the history drawn into a canvas that frames the whole time-lapse.
async function record(onProgress) {
  const t = type();
  const log = app.drawing.undoStack;
  // The frame holds everything the time-lapse ever shows, not only the end.
  let b = null;
  for (const d of P.replay(log)) {
    const s = bounds(d);
    if (s) b = b ? { x0: Math.min(b.x0, s.x0), y0: Math.min(b.y0, s.y0), x1: Math.max(b.x1, s.x1), y1: Math.max(b.y1, s.y1) } : s;
  }
  if (!b) throw new Error('nothing to show');
  const pad = 0.06 * Math.max(b.x1 - b.x0, b.y1 - b.y0, 0.1);
  const W = b.x1 - b.x0 + 2 * pad, H = b.y1 - b.y0 + 2 * pad;
  const size = frameSize(W, H);
  const c = document.createElement('canvas');
  c.width = size.w; c.height = size.h;
  const ctx = c.getContext('2d');
  const zoom = size.w / W, tr = { zoom, ox: b.x0 - pad, oy: b.y0 - pad };
  const box = { x0: tr.ox, y0: tr.oy, x1: tr.ox + W, y1: tr.oy + H };
  const bg = paperOf(app.drawing.paper).bg;
  const paint = (d) => { ctx.fillStyle = bg; ctx.fillRect(0, 0, size.w, size.h); drawCells(ctx, d, tr, box, 0.7); drawEdges(ctx, d, tr); };
  const rec = new MediaRecorder(c.captureStream(30), { mimeType: t.mime, videoBitsPerSecond: 4_000_000 });
  const chunks = [];
  rec.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data); };
  const stopped = new Promise((res) => { rec.onstop = res; });
  const { stepMs, holdMs, totalMs } = plan(log.length);
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  rec.start(500);
  let i = 0, elapsed = 0;
  for (const d of P.replay(log)) {
    if (making?.cancelled) break;
    paint(d);
    await wait(i++ ? stepMs : 300);
    elapsed += stepMs;
    onProgress(Math.min(0.99, elapsed / totalMs));
  }
  if (!making?.cancelled) await wait(holdMs);
  rec.stop();
  await stopped;
  return { blob: new Blob(chunks, { type: t.mime.split(';')[0] }), ext: t.ext, mime: t.mime.split(';')[0] };
}

export async function makeVideo() {
  if (!canRecord()) return toast('This browser cannot make videos');
  if (!app.drawing.undoStack.length) return toast('Draw something first');
  if (making) return;
  if (made && made.version === app.drawing.version) return setBar('ready');
  making = { cancelled: false };
  setBar('making', 'Making the video… 0%');
  try {
    const v = await record((f) => { if (making && !making.cancelled) $('#replay-say').textContent = `Making the video… ${Math.round(f * 100)}%`; });
    if (making.cancelled) return;
    made = { ...v, version: app.drawing.version };
    setBar('ready');
    emit('video');
  } catch (err) {
    setBar(null);
    toast(`Could not make the video: ${err.message}`);
  } finally { making = null; }
}
export function cancelVideo() { if (making) making.cancelled = true; setBar(null); }
export const isMaking = () => !!making;

// The second tap: the save dialog, the share sheet or a download, as Save picture.
export async function saveVideo() {
  if (!made) return makeVideo();
  const { blob, ext, mime } = made;
  sayResult(await store.saveBlob({ name: `${fileBase(app.drawingName)}.${ext}`, type: mime, accept: { description: 'Time-lapse video', ext: [`.${ext}`] }, make: () => blob }), 'video');
  setBar(null);
}

// Save video on the bar: make it after a replay, save it once made.
export const videoButton = () => (barMode() === 'ready' ? saveVideo() : makeVideo());
