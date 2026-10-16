// The time-lapse as a video: how long each step shows, which file type this
// browser can record, and the frame size. Pure (test/video.test.mjs);
// web/ui/video.js records it.

// The same pace as Watch it being drawn (app.js startReplay): about 8 s in
// all, each step between 16 and 250 ms; then the finished drawing holds.
export const HOLD_MS = 1500;
export function plan(steps) {
  const stepMs = Math.max(16, Math.min(250, 8000 / Math.max(1, steps)));
  return { stepMs, holdMs: HOLD_MS, totalMs: steps * stepMs + HOLD_MS };
}

// The first type this browser records: MP4 where it can (Safari, newer
// Chrome; plays everywhere), else WebM. null: no video here.
export const TYPES = [
  { mime: 'video/mp4;codecs=avc1.42E01E', ext: 'mp4' },
  { mime: 'video/mp4', ext: 'mp4' },
  { mime: 'video/webm;codecs=vp9', ext: 'webm' },
  { mime: 'video/webm', ext: 'webm' },
];
export function pickType(isSupported) {
  try { return TYPES.find((t) => isSupported(t.mime)) || null; } catch { return null; }
}

// The video frame for a drawing w × h world units: the long side `max` px,
// both sides even (video encoders need that), and at least 16 px.
export function frameSize(w, h, max = 1080) {
  const k = max / Math.max(w, h, 1e-9);
  const even = (v) => Math.max(16, 2 * Math.round((v * k) / 2));
  return { w: even(w), h: even(h) };
}
