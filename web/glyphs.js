// SVG glyphs for brush shapes, line styles, marquee shapes and the
// grid-level notches. Strokes use currentColor so they follow the theme.
const svg = (body, extra = '') => `<svg viewBox="0 0 24 24" aria-hidden="true"${extra}>${body}</svg>`;
// Cells point right: in the isometric cube view, lattice lines are vertical.
// One cell shown inside its faint hexagon of six, so a lone triangle reads as
// "one cell of the grid", not a media Play button (owner, 2026-10-13).
const HEX_FRAME = '<path d="M12 3 19.8 7.5v9L12 21l-7.8-4.5v-9ZM12 3v18M4.2 7.5l15.6 9M4.2 16.5l15.6-9" stroke-width="1.2" opacity="0.4"/>';
const CELL = 'M4.2 7.5v9L12 12Z';
// The fill can, shared by the Fill tool (index.html) and the mode chip: a
// squat paint can tipped 45 degrees, a rim ellipse over the open top, a thin
// wire bail arcing over the opening from one side of the rim to the other,
// paint pouring from the lip and ending in a drop. (owner, 2026-10-12: "looking
// a bit more like the classic paint-fill-can than a coffee cup", then "needs
// a paint can handle, regardless of taper".) A test keeps the Fill button's
// copy the same as this one.
export const CAN = '<g transform="translate(9.4 10.8) rotate(45)"><path d="M-4.8-3-4.4 4h8.8l.4-7"/><ellipse cy="-3" rx="4.8" ry="1.3" stroke-width="1.5"/><path d="M-4.8-3C-5.6-10.6 5.6-10.6 4.8-3" stroke-width="1.2"/></g><path d="M14.92 12.07c1.6.4 2.4 2.4 2.4 4.2"/><path d="M17.32 17.07s2 2.5 2 3.7a2 2 0 0 1-4 0c0-1.2 2-3.7 2-3.7Z" fill="currentColor"/>';

export const GLYPHS = {
  // The Keep / Behind / Replace chip shows the one fill can in every mode;
  // its word (and its screen-reader label) tells the modes apart.
  'mode-can': svg(CAN),
  triangle: svg(`${HEX_FRAME}<path d="${CELL}" fill="currentColor"/>`),
  rhombus: svg('<path d="M12 3 19.8 7.5 12 12 4.2 7.5Z"/><path d="M12 3v9" stroke-width="1"/>'),
  hexagon: svg('<path d="M12 3 19.8 7.5v9L12 21l-7.8-4.5v-9Z"/>'),
  trapezoid: svg('<path d="M4.2 7.5 12 3l7.8 4.5v9L12 12Z"/>'),
  bigtri: svg('<path d="M5 3v18l15.6-9ZM5 12l7.8-4.5v9Z"/>'),
  face: svg('<path d="M4 8l8-4.6 8 4.6-8 4.6Z"/><path d="M17 17l3 3m0-4v4h-4"/>'),
  cube: svg('<path d="M12 3 19.8 7.5v9L12 21l-7.8-4.5v-9Z"/><path d="M12 12v9M12 12l7.8-4.5M12 12 4.2 7.5"/>'),
  stamp: svg('<path d="M8 4h8v6l3 3v3H5v-3l3-3ZM5 20h14"/>'),
  // Pick any color (owner: "an eyedropper instead of a crosshairs"), in the palette and in Help.
  eyedropper: svg('<path d="M13.5 7.5l2.6-2.6a2.5 2.5 0 0 1 3.5 3.5l-2.6 2.6"/><path d="M10.5 6.5l7 7"/><path d="M12 9 5 16l-1 4 4-1 7-7"/>', ' stroke-linecap="round" stroke-linejoin="round"'),
  strip: svg('<path d="M4 18 18 4l2 2L6 20Z"/>'),
  edge: svg('<path d="M5 19 19 5" stroke-width="4"/>'),
  'm-triangle': svg(`${HEX_FRAME}<path d="${CELL}" stroke-dasharray="2.2 1.6"/>`),
  'm-rhombus': svg('<path d="M12 3 19 7.5 12 12 5 7.5Z" stroke-dasharray="3 2.4"/>'),
  'm-hexagon': svg('<path d="M12 3 19.8 7.5v9L12 21l-7.8-4.5v-9Z" stroke-dasharray="3 2.4"/>'),
};

// Notch n (0 coarsest .. 7 finest): a solid hexagon of six cells that shrinks,
// pointed at top and bottom like the lattice's hexagons, its cell lines drawn
// faintly while it is big enough to show them. (A lone triangle read as a
// media Play button; the owner chose hexagons, 2026-10-13.)
export function notchGlyph(n) {
  const r = 15 * 0.8 ** n; // center to corner, px
  const pts = [0, 1, 2, 3, 4, 5].map((i) => { const a = Math.PI / 2 + (i * Math.PI) / 3; return [r * Math.cos(a), -r * Math.sin(a)].map((v) => v.toFixed(2)); });
  const hex = `<path d="M${pts.map((p) => p.join(' ')).join('L')}Z"/>`;
  const cells = r >= 7 ? `<path class="cells" d="${[0, 1, 2].map((i) => `M${pts[i].join(' ')}L${pts[i + 3].join(' ')}`).join('')}"/>` : '';
  return `<svg width="32" height="32" viewBox="-16 -16 32 32" aria-hidden="true">${hex}${cells}</svg>`;
}
