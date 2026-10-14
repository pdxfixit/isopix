// Each drawing keeps its own paper (owner, 2026-10-12): light or dark, saved
// with the drawing. The inks (the palette) follow the paper: a lighter set on
// dark paper, so strokes never vanish. Flipping the paper never recolors
// strokes. Pure data and logic, no DOM.

const NAMES = ['Red', 'Orange', 'Yellow', 'Green', 'Teal', 'Blue', 'Purple', 'Pink', 'Brown', 'White', 'Gray', 'Black'];

export const PAPERS = {
  light: {
    bg: '#f7f5f0', grid: '#2b2d3a',
    inks: ['#e63946', '#f4a261', '#e9c46a', '#6a994e', '#2a9d8f', '#3a86ff', '#8338ec', '#ff70a6', '#8d5524', '#f1faee', '#8d99ae', '#1d1d1f'],
    // Limited palettes start with three values (dark, mid, light), then add colors.
    limited: ['#1d1d1f', '#8d99ae', '#f1faee', '#e63946', '#3a86ff', '#e9c46a', '#2a9d8f', '#f4a261', '#8338ec', '#6a994e', '#ff70a6', '#8d5524'],
  },
  dark: {
    bg: '#1f2228', grid: '#d4d8e4',
    // Lighter inks; the darkest is a slate that still reads on the dark paper.
    inks: ['#ff6b6b', '#ffa94d', '#ffe066', '#8ce99a', '#63e6be', '#74c0fc', '#b197fc', '#f783ac', '#d4a373', '#f8f9fa', '#adb5bd', '#6c7686'],
    limited: ['#f8f9fa', '#adb5bd', '#6c7686', '#ff6b6b', '#74c0fc', '#ffe066', '#63e6be', '#ffa94d', '#b197fc', '#8ce99a', '#f783ac', '#d4a373'],
  },
};

export const paperName = (p) => (p === 'dark' ? 'dark' : 'light');
export const paperOf = (p) => PAPERS[paperName(p)];
export const inkName = (paper, color) => {
  const i = paperOf(paper).inks.indexOf(color);
  return i >= 0 ? NAMES[i] : null;
};
// The same ink on the other paper (by position), for keeping the chosen color
// when the paper flips; a custom color stays as it is.
export function matchInk(color, from, to) {
  const f = paperOf(from), t = paperOf(to);
  let i = f.inks.indexOf(color);
  if (i >= 0) return t.inks[i];
  i = f.limited.indexOf(color);
  return i >= 0 ? t.limited[i] : color;
}
