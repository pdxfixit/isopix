// Color math: hex <-> Oklab, cube-face shading, Oklab averaging and nearest
// palette color. Pure logic, no DOM.

const clamp01 = (x) => Math.min(1, Math.max(0, x));
const toLin = (c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const toGamma = (c) => (c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055);

export function hexToRgb(hex) {
  const h = hex.replace('#', '');
  const n = parseInt(h.length === 3 ? h.split('').map((x) => x + x).join('') : h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
export function rgbToHex([r, g, b]) {
  const to = (x) => Math.round(clamp01(x / 255) * 255).toString(16).padStart(2, '0');
  return `#${to(r)}${to(g)}${to(b)}`;
}

export function hexToOklab(hex) {
  const [r, g, b] = hexToRgb(hex).map((x) => toLin(x / 255));
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return [
    0.2104542553 * l + 0.7936177850 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.4285922050 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.8086757660 * s,
  ];
}
export function oklabToHex([L, a, b]) {
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (L - 0.0894841775 * a - 1.2914855480 * b) ** 3;
  const r = 4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s;
  const g = -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s;
  const bl = -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s;
  return rgbToHex([r, g, bl].map((x) => toGamma(clamp01(x)) * 255));
}

// Shade a base color by cube face. Light from the left (the default): T
// light, L mid (the base), R dark; from the right, L and R swap. Very light
// bases move down so the top face can still be lighter.
export const TONE = { T: 'light', L: 'mid', R: 'dark' };
export const toneOf = (face, light = 'left') => (light === 'right' && face !== 'T' ? (face === 'L' ? 'dark' : 'mid') : TONE[face]);
export function shade(hex, face, light = 'left') {
  if (!face) return hex;
  const [L0, a, b] = hexToOklab(hex);
  const top = Math.min(0.99, L0 + 0.12);
  const mid = top - 0.12;
  const tone = toneOf(face, light);
  const L = tone === 'light' ? top : tone === 'mid' ? mid : Math.max(0.04, mid - 0.16);
  return oklabToHex([L, a, b]);
}
// The base color a shaded cell was painted with, from its tone (Relight).
// Exact unless shade() clipped it: a base lighter than L 0.87 (its mid was
// moved down) or a dark tone held at L 0.04.
export function baseOf(hex, face, light = 'left') {
  if (!face) return hex;
  const [L, a, b] = hexToOklab(hex);
  const tone = toneOf(face, light);
  return oklabToHex([tone === 'light' ? L - 0.12 : tone === 'dark' ? L + 0.16 : L, a, b]);
}

export function mixOklab(hexes) {
  const acc = [0, 0, 0];
  for (const h of hexes) { const o = hexToOklab(h); acc[0] += o[0]; acc[1] += o[1]; acc[2] += o[2]; }
  return oklabToHex(acc.map((x) => x / hexes.length));
}

export function nearest(hex, palette) {
  const o = hexToOklab(hex);
  let best = palette[0], bd = Infinity;
  for (const p of palette) {
    const q = hexToOklab(p);
    const d = (o[0] - q[0]) ** 2 + (o[1] - q[1]) ** 2 + (o[2] - q[2]) ** 2;
    if (d < bd) { bd = d; best = p; }
  }
  return best;
}

export function luminance(hex) {
  const [r, g, b] = hexToRgb(hex).map((x) => toLin(x / 255));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
export function grayOf(hex) {
  const y = toGamma(luminance(hex)) * 255;
  return rgbToHex([y, y, y]);
}
