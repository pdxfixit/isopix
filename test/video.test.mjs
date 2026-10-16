// The time-lapse video (web/video.js): its pace, its file type, its frame.
import test from 'node:test';
import assert from 'node:assert/strict';
import { plan, pickType, frameSize, HOLD_MS } from '../web/video.js';

test('the video keeps Watch it being drawn\'s pace, then holds the finished drawing', () => {
  assert.equal(plan(32).stepMs, 250, 'few steps: a quarter second each');
  assert.equal(plan(800).stepMs, 16, 'many steps: as fast as a frame');
  assert.equal(plan(100).stepMs, 80);
  assert.equal(plan(100).totalMs, 100 * 80 + HOLD_MS);
  assert.ok(plan(0).stepMs > 0);
});

test('MP4 where the browser records it, else WebM, else none', () => {
  assert.equal(pickType((m) => m.startsWith('video/mp4')).ext, 'mp4');
  assert.equal(pickType((m) => m === 'video/webm').ext, 'webm');
  assert.equal(pickType(() => false), null);
  assert.equal(pickType(() => { throw new Error('no MediaRecorder'); }), null);
});

test('the frame keeps the drawing\'s shape, long side 1080, even sides', () => {
  assert.deepEqual(frameSize(2, 1), { w: 1080, h: 540 });
  assert.deepEqual(frameSize(1, 3), { w: 360, h: 1080 });
  const f = frameSize(1, 0.0001);
  assert.ok(f.h >= 16 && f.h % 2 === 0 && f.w % 2 === 0);
});
