// Telling a stroke from a pan: what happens to a stroke under way when a
// second finger lands, and to the finger left behind when a pinch ends.
// Pure logic, no DOM; app.js measures and asks.

// A stroke this young (ms) or this short (screen px) when a second finger
// lands was the first finger of a pinch or a two-finger pan: it is dropped.
// Anything older and longer was meant, and is kept.
export const YOUNG_MS = 500;
export const SHORT_PX = 24;
export const dropOnSecondFinger = ({ ageMs, travelPx }) => ageMs < YOUNG_MS || travelPx < SHORT_PX;

// What one finger does on the canvas: draw with the tool, or move the view.
// Move mode (the hand on the zoom rail, or H) makes every one-finger drag a
// pan; so does the finger still down after a pinch, so it never draws a
// stray mark when the other finger lifts first.
export function oneFinger({ moveMode = false, afterPinch = false, button = 0, pointerType = 'touch', spaceHeld = false } = {}) {
  if (afterPinch) return 'pan';
  if (pointerType === 'mouse' && (button === 1 || button === 2 || spaceHeld)) return 'pan';
  if (button > 0) return 'ignore';
  return moveMode ? 'pan' : 'tool';
}

// Two fingers tapped together undo; three redo (the convention of Procreate
// and most drawing apps). A tap: every finger landed within LAND_MS of the
// first, all lifted within TAP_MS of it, and none moved more than TAP_PX.
// Numbers to tune on a real phone.
export const TAP_MS = 300;
export const TAP_PX = 12;
export const LAND_MS = 150;
export function multiTap({ fingers, ms, travelPx, landMs }) {
  if (ms > TAP_MS || travelPx > TAP_PX || landMs > LAND_MS) return null;
  return fingers === 2 ? 'undo' : fingers === 3 ? 'redo' : null;
}
