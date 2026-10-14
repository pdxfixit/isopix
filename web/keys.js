// The keyboard table: the app binds keys from it (app.js onKey) and the Help
// sheet lists them from it (help.js), so the two cannot drift. Pure data.
//
// keys: what to press, as the Help sheet shows it. `match` is how a
// KeyboardEvent is recognised: {key} for a plain key, {mod: true, key, shift}
// for Ctrl (or Cmd) combinations. `action` names what app.js does.
export const KEYS = [
  { keys: ['P'], match: [{ key: 'p' }], action: 'tool:pencil', says: 'Pencil' },
  { keys: ['E'], match: [{ key: 'e' }], action: 'tool:eraser', says: 'Eraser' },
  { keys: ['L'], match: [{ key: 'l' }], action: 'tool:line', says: 'Line' },
  { keys: ['F'], match: [{ key: 'f' }], action: 'tool:fill', says: 'Fill bucket' },
  { keys: ['S'], match: [{ key: 's' }], action: 'tool:select', says: 'Select' },
  { keys: ['B'], match: [{ key: 'b' }], action: 'options', says: 'Open the shapes for this tool (brush shapes, line styles or selection shapes)' },
  { keys: ['['], match: [{ key: '[' }], action: 'size:-1', says: 'Bigger cells: one notch up the grid-size rail' },
  { keys: [']'], match: [{ key: ']' }], action: 'size:+1', says: 'Smaller cells: one notch down' },
  { keys: ['K'], match: [{ key: 'k' }], action: 'lock', says: 'Lock or unlock the grid level' },
  { keys: ['G'], match: [{ key: 'g' }], action: 'gutters', says: 'Show or hide the gutters (the thin grid lines)' },
  { keys: ['0'], match: [{ key: '0' }], action: 'reset', says: 'Fit the drawing on screen (on empty paper, reset the view)' },
  { keys: ['+'], match: [{ key: '+' }, { key: '=' }], action: 'zoom:in', says: 'Zoom in' },
  { keys: ['−'], match: [{ key: '-' }], action: 'zoom:out', says: 'Zoom out' },
  { keys: ['M'], match: [{ key: 'm' }], action: 'settings', says: 'Open Settings' },
  { keys: ['D'], match: [{ key: 'd' }], action: 'drawing', says: 'Open the Drawing sheet: name, new, open, save' },
  { keys: ['?'], match: [{ key: '?' }], action: 'help', says: 'Open this help' },
  { keys: ['Esc'], match: [{ key: 'Escape' }], action: 'escape', says: 'Clear the selection, or close a picker' },
  { keys: ['Ctrl+Z'], match: [{ mod: true, key: 'z', shift: false }], action: 'undo', says: 'Undo' },
  { keys: ['Ctrl+Shift+Z', 'Ctrl+Y'], match: [{ mod: true, key: 'z', shift: true }, { mod: true, key: 'y' }], action: 'redo', says: 'Redo' },
  { keys: ['Space'], match: [{ key: ' ' }], action: 'pan-hold', says: 'Hold Space and drag with the mouse to pan' },
];

// The table row a KeyboardEvent-like {key, ctrlKey, metaKey, shiftKey} matches, or null.
export function keyFor(e) {
  const mod = !!(e.ctrlKey || e.metaKey);
  const key = mod || /^[A-Z]$/.test(e.key) ? String(e.key).toLowerCase() : e.key; // Caps Lock still works
  for (const row of KEYS) {
    for (const m of row.match) {
      if (!!m.mod !== mod || m.key !== key) continue;
      if (m.shift !== undefined && m.shift !== !!e.shiftKey) continue;
      return row;
    }
  }
  return null;
}
