// When the cached cell layer can be reused, patched or must be redrawn.
// Pure logic (no DOM), so the rule is tested in node (test/layer.test.mjs).
//
// The renderer keeps the cells in an offscreen bitmap a little larger than
// the screen. Panning only moves that bitmap; painting redraws the changed
// area; zoom or a new pixel ratio redraws all of it at the new scale, so cells
// stay crisp at any zoom (a stale bitmap is never scaled).

export const MARGIN_PAN = 256;  // CSS px kept around the screen after a pan, so the next pans are free
export const MARGIN_TIGHT = 32; // after a zoom step: more zoom steps follow, so draw little beyond the screen

// cache: null or {drawing, version, zoom, dpr, x0, y0, x1, y1} (the world box the bitmap covers)
// want:  {drawing, version, zoom, dpr, box: {x0, y0, x1, y1}, dirtyOverflow}
// → {action: 'blit' | 'patch' | 'full', margin?}
export function layerPlan(cache, want) {
  if (!cache || cache.drawing !== want.drawing || cache.dpr !== want.dpr) return { action: 'full', margin: MARGIN_PAN };
  if (cache.zoom !== want.zoom) return { action: 'full', margin: MARGIN_TIGHT };
  const b = want.box;
  if (b.x0 < cache.x0 || b.y0 < cache.y0 || b.x1 > cache.x1 || b.y1 > cache.y1) return { action: 'full', margin: MARGIN_PAN };
  if (cache.version !== want.version) return want.dirtyOverflow ? { action: 'full', margin: MARGIN_PAN } : { action: 'patch' };
  return { action: 'blit' };
}
