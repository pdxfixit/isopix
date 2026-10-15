// The welcome card: shown once, on a first visit, over an empty drawing. It
// says how to touch the app, and holds a cube of six triangles to tap: each
// fills with the chosen color, shaded by its face the way auto-shade paints
// (the owner chose "A's card with C's tappable cube inside it", 2026-10-15).
// Start drawing, ✕ and Esc close it whether the cube is finished or not; the
// cube is practice and is not part of the drawing. Settings → About shows it
// again.
//
// welcomeDue, cubeTriangles and cubeCaption are pure (test/welcome.test.mjs);
// initWelcome wires the dialog that index.html holds.

// Whether the card opens at start. Pure.
//   welcomed:   the card was closed on this device before (a setting)
//   hasContent: this browser already has a drawing
//   arriving:   a drawing is being carried here from an old address
export function welcomeDue({ welcomed, hasContent, arriving }) {
  return !welcomed && !hasContent && !arriving;
}

// The six triangles of a cube around (cx, cy), radius r: the hexagon's
// corners in turn from the top, each triangle with the center. face is the
// cube face it shades as: T top, L left, R right. Pure.
export function cubeTriangles(cx, cy, r) {
  const w = r * Math.sqrt(3) / 2;
  const T = [cx, cy - r], UR = [cx + w, cy - r / 2], LR = [cx + w, cy + r / 2];
  const B = [cx, cy + r], LL = [cx - w, cy + r / 2], UL = [cx - w, cy - r / 2];
  const C = [cx, cy];
  return [[T, UR, 'T'], [UR, LR, 'R'], [LR, B, 'R'], [B, LL, 'L'], [LL, UL, 'L'], [UL, T, 'T']]
    .map(([a, b, face]) => ({ points: [C, a, b], face }));
}

// The line under the cube. Pure.
export function cubeCaption(left) {
  if (left <= 0) return '🎉 A cube! Each color shades itself.';
  return left === 6 ? 'Tap the six triangles to build a cube' : `Tap the triangles to build a cube (${left} left)`;
}

const SVG_NS = 'http://www.w3.org/2000/svg';
const pointsAttr = (pts) => pts.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' ');

// Wires the card. deps:
//   dialog   the <dialog>; cube the <svg> (viewBox 0 0 170 132); caption the live line;
//            start the Start drawing button
//   color()  the color in use; shade(hex, face) auto-shade's tones
//   shading() whether auto-shade is on; onClose() runs when the card closes
// Returns { open() }, which resets the cube and shows the card.
export function initWelcome({ dialog, cube, caption, start, color, shade, shading, onClose }) {
  const tris = cubeTriangles(85, 66, 54);
  let done = [];
  const center = (pts) => [(pts[0][0] + pts[1][0] + pts[2][0]) / 3, (pts[0][1] + pts[1][1] + pts[2][1]) / 3];
  function render() {
    cube.replaceChildren();
    const next = done.indexOf(false);
    tris.forEach((t, i) => {
      const p = document.createElementNS(SVG_NS, 'polygon');
      p.setAttribute('points', pointsAttr(t.points));
      if (done[i]) {
        p.setAttribute('class', 'cube-done');
        p.setAttribute('fill', shading() ? shade(color(), t.face) : color());
      } else {
        p.setAttribute('class', 'cube-todo');
        p.setAttribute('tabindex', '0');
        p.setAttribute('role', 'button');
        p.setAttribute('aria-label', `Triangle ${i + 1} of 6`);
        p.dataset.i = String(i);
      }
      cube.append(p);
    });
    if (next >= 0) {
      const [x, y] = center(tris[next].points);
      const c = document.createElementNS(SVG_NS, 'circle');
      c.setAttribute('class', 'cube-hint');
      c.setAttribute('cx', x.toFixed(1)); c.setAttribute('cy', y.toFixed(1)); c.setAttribute('r', '7');
      cube.append(c);
    }
    caption.textContent = cubeCaption(done.filter((d) => !d).length);
  }
  // A keyboard tap moves focus on to the next triangle (the one tapped is redrawn).
  function tap(i, byKey) {
    if (done[i]) return;
    done[i] = true;
    render();
    if (byKey) (cube.querySelector('.cube-todo') || start).focus();
  }
  cube.addEventListener('click', (e) => { const i = e.target.dataset?.i; if (i != null) tap(Number(i), false); });
  cube.addEventListener('keydown', (e) => {
    const i = e.target.dataset?.i;
    if (i != null && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); tap(Number(i), true); }
  });
  dialog.addEventListener('close', () => onClose());
  return {
    open() {
      done = tris.map(() => false);
      render();
      dialog.showModal();
    },
  };
}
