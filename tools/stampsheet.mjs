// The sheet of a stamp from every side, in a grid of two by two: shared by
// tools/stamp_sheets.mjs (docs/stamps/) and tools/stamp_check.mjs (a stamp handed in).
import * as ART from '../web/engine/stampart.js';
import * as M from '../web/engine/stampmodels.js';
import { placeStamp } from '../web/engine/density.js';
import { Drawing } from '../web/engine/model.js';
import { toSVG } from '../web/engine/svg.js';

const WIDTH = 640; // px a sheet is shown at
const SPIN_SAYS = ['as drawn', 'a quarter turn', 'half a turn', 'three quarters'];
const PLANE_SAYS = { upright: 'upright', floor: 'on the floor', left: 'on the left wall', right: 'on the right wall' };

// A stamp's views: [label, stamp].
export function viewsOf(s) {
  if (M.spins(s.id).length) return M.spins(s.id).map((n) => [SPIN_SAYS[n], M.spun(s.id, n)]);
  const planes = ART.planesOf(s.id);
  if (planes.length) return planes.map((p) => [PLANE_SAYS[p], ART.variant(s.id, p, 1)]);
  return [['as drawn', s.stamp]];
}

// The views in a grid of two by two (owner: "how about each mockup is in a 4 grid"),
// read like a page: the first two on top, feet level along each row.
export const sheetSVG = (s) => gridSVG(viewsOf(s).map(([, stamp]) => stamp));
export function gridSVG(stamps) {
  const views = stamps.map((stamp) => {
    const qs = stamp.cells.map((c) => c[2]), ys = stamp.cells.map((c) => c[1] + c[2] / 2); // screen x goes with q, y with p + q / 2
    return { stamp, q0: Math.min(...qs), q1: Math.max(...qs) + 1, y0: Math.min(...ys), y1: Math.max(...ys) + 1 };
  });
  const colW = Math.max(...views.map((v) => v.q1 - v.q0)) + 6, rowH = Math.ceil(Math.max(...views.map((v) => v.y1 - v.y0))) + 4;
  const footY = Math.ceil(Math.max(...views.map((v) => -v.y0))); // the feet sit this far below a row's top
  const d = new Drawing();
  views.forEach((v, i) => {
    const q = 2 * Math.round(((i % 2) * colW - v.q0) / 2), p = Math.floor(i / 2) * rowH + footY - q / 2; // q even, so p is whole
    const { cells } = placeStamp(v.stamp, { l: ART.LV, p, q });
    d.begin(); for (const { cell, c, f } of cells) d.paint(cell, { c, f }); d.commit();
  });
  const svg = toSVG(d, { background: '#f7f5f0' });
  // Shown WIDTH px wide, whatever the stamp's size.
  return svg.replace(/width="(\d+)" height="(\d+)"/, (_, w, h) => `width="${WIDTH}" height="${Math.round((WIDTH * h) / w)}"`);
}

