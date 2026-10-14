// The view's zoom slider mapping (owner, 2026-10-12: "there needs to be a zoom
// slider"): even in log scale across the whole zoom range, and its label.
import test from 'node:test';
import assert from 'node:assert/strict';
import { View, MIN_ZOOM, MAX_ZOOM, HOME_ZOOM, zoomToSlider, sliderToZoom, zoomLabel } from '../web/engine/view.js';

test('the slider ends are the zoom limits, and out-of-range values clamp', () => {
  assert.equal(sliderToZoom(0), MIN_ZOOM);
  assert.ok(Math.abs(sliderToZoom(1) - MAX_ZOOM) < 1e-6);
  assert.equal(sliderToZoom(-3), MIN_ZOOM);
  assert.ok(Math.abs(sliderToZoom(9) - MAX_ZOOM) < 1e-6);
  assert.equal(zoomToSlider(MIN_ZOOM / 4), 0);
  assert.equal(zoomToSlider(MAX_ZOOM * 4), 1);
});

test('slider and zoom round trip', () => {
  for (const z of [MIN_ZOOM, 30, HOME_ZOOM, 1000, 12345, MAX_ZOOM]) {
    assert.ok(Math.abs(sliderToZoom(zoomToSlider(z)) / z - 1) < 1e-9, `zoom ${z}`);
  }
});

test('every doubling of zoom is the same distance along the slider', () => {
  const step = zoomToSlider(2 * HOME_ZOOM) - zoomToSlider(HOME_ZOOM);
  assert.ok(step > 0);
  for (const z of [MIN_ZOOM, 100, 4000]) {
    assert.ok(Math.abs(zoomToSlider(2 * z) - zoomToSlider(z) - step) < 1e-12);
  }
});

test('the label is zoom relative to the start', () => {
  assert.equal(zoomLabel(HOME_ZOOM), '1×');
  assert.equal(zoomLabel(HOME_ZOOM * 4), '4×');
  assert.equal(zoomLabel(HOME_ZOOM / 4), '0.25×');
  assert.equal(zoomLabel(HOME_ZOOM * 1.5), '1.5×');
  assert.equal(zoomLabel(MAX_ZOOM), '160×');
  assert.equal(zoomLabel(MIN_ZOOM), '0.047×');
});

test('a new view and a reset view start at the home zoom', () => {
  const v = new View();
  v.zoomAt(10, 10, 3);
  v.reset();
  assert.equal(v.zoom, HOME_ZOOM);
  assert.equal(zoomLabel(new View().zoom), '1×');
});

test('fitTo frames a box inside a screen rectangle, centered, within the zoom limits', () => {
  const v = new View(400, 800);
  const rect = { x0: 60, y0: 70, x1: 340, y1: 650 };
  v.fitTo({ x0: 1, y0: 2, x1: 3, y1: 3 }, rect); // 2 wide, 1 tall: width limits
  assert.equal(v.zoom, 140);
  const [ax, ay] = v.toScreen(1, 2), [bx, by] = v.toScreen(3, 3);
  assert.ok(Math.abs(ax - 60) < 1e-9 && Math.abs(bx - 340) < 1e-9, 'fills the width');
  assert.ok(Math.abs((ay + by) / 2 - 360) < 1e-9, 'centered in the rectangle, not the screen');
  v.fitTo({ x0: 0, y0: 0, x1: 1e-6, y1: 1e-6 }, rect); // one tiny cell
  assert.equal(v.zoom, MAX_ZOOM);
  v.fitTo({ x0: -1e4, y0: -1e4, x1: 1e4, y1: 1e4 }, rect); // huge
  assert.equal(v.zoom, MIN_ZOOM);
});
