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
