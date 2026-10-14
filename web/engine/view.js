// The view: zoom and pan (never changes data), and how the active level
// follows zoom. Pure logic, no DOM.
import { S0, MAX_LEVEL } from './lattice.js';

export const MIN_ZOOM = 12;       // px per world unit (a level-0 edge of 12 px)
export const MAX_ZOOM = 128 * 320; // a level-7 edge of 320 px
export const HOME_ZOOM = 256;     // the starting zoom, shown as 1×

// The zoom slider runs 0 (all the way out) to 1 (all the way in), even in log
// scale, so every doubling of zoom is the same distance along it.
const SPAN = Math.log(MAX_ZOOM / MIN_ZOOM);
const unit = (t) => Math.max(0, Math.min(1, t));
export const zoomToSlider = (z) => unit(Math.log(z / MIN_ZOOM) / SPAN);
export const sliderToZoom = (t) => MIN_ZOOM * Math.exp(unit(t) * SPAN);
// Zoom relative to the start, in two significant figures: "1×", "4×", "0.25×", "160×".
export function zoomLabel(z) {
  const r = z / HOME_ZOOM;
  const v = r >= 10 ? Math.round(r) : Number(r.toPrecision(2));
  return `${v}×`;
}

// Slider notch n -> target on-screen edge length in CSS px when following
// zoom: 96 px down to 6 px, evenly in log scale, so every notch is usable on
// a phone (owner, 2026-10-12). Two notches can then pick the same level at some
// zooms; the readout shows the real size.
export const NOTCH_MAX_PX = 96;
export const NOTCH_MIN_PX = 6;
export const targetPx = (n) => NOTCH_MAX_PX * (NOTCH_MIN_PX / NOTCH_MAX_PX) ** (n / 7);
// The notch whose target is nearest an on-screen size (for unlocking the level).
export const notchFor = (px) => Math.max(0, Math.min(7, Math.round((7 * Math.log(px / NOTCH_MAX_PX)) / Math.log(NOTCH_MIN_PX / NOTCH_MAX_PX))));

export class View {
  constructor(w = 800, h = 600) {
    this.w = w; this.h = h;
    this.zoom = HOME_ZOOM;
    this.cx = 0; this.cy = 0; // world point at the screen center
  }
  toScreen(x, y) { return [(x - this.cx) * this.zoom + this.w / 2, (y - this.cy) * this.zoom + this.h / 2]; }
  toWorld(sx, sy) { return [(sx - this.w / 2) / this.zoom + this.cx, (sy - this.h / 2) / this.zoom + this.cy]; }
  // Zoom by `factor` keeping the world point under (sx, sy) fixed.
  zoomAt(sx, sy, factor) {
    const [wx, wy] = this.toWorld(sx, sy);
    this.zoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, this.zoom * factor));
    this.cx = wx - (sx - this.w / 2) / this.zoom;
    this.cy = wy - (sy - this.h / 2) / this.zoom;
  }
  pan(dx, dy) { this.cx -= dx / this.zoom; this.cy -= dy / this.zoom; }
  worldBox() {
    const [x0, y0] = this.toWorld(0, 0), [x1, y1] = this.toWorld(this.w, this.h);
    return { x0, y0, x1, y1 };
  }
  reset() { this.zoom = HOME_ZOOM; this.cx = 0; this.cy = 0; }
  // Fit a world box {x0, y0, x1, y1} inside a screen rectangle (px, the part
  // the controls leave clear), as big as the zoom limits allow, centered in it.
  fitTo(box, rect) {
    const bw = Math.max(box.x1 - box.x0, 1e-9), bh = Math.max(box.y1 - box.y0, 1e-9);
    const rw = Math.max(rect.x1 - rect.x0, 1), rh = Math.max(rect.y1 - rect.y0, 1);
    this.zoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, Math.min(rw / bw, rh / bh)));
    this.cx = (box.x0 + box.x1) / 2 - ((rect.x0 + rect.x1) / 2 - this.w / 2) / this.zoom;
    this.cy = (box.y0 + box.y1) / 2 - ((rect.y0 + rect.y1) / 2 - this.h / 2) / this.zoom;
  }
}

// The level that gives about `target` px edges at this zoom, with hysteresis:
// the level only changes once the ideal level is more than 0.5 + hyst away.
export function followLevel(zoom, target, current, hyst = 0.15) {
  const ideal = Math.log2((zoom * S0) / target);
  const clamp = (l) => Math.max(0, Math.min(MAX_LEVEL, l));
  if (current == null) return clamp(Math.round(ideal));
  if (Math.abs(ideal - current) <= 0.5 + hyst) return current;
  return clamp(Math.round(ideal));
}
