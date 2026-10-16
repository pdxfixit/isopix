// The Help sheet: every control, gesture and key, grouped, with the real icon
// beside each name. Pure data and a pure HTML builder (no DOM reads), so a
// test can check nothing is missing. app.js puts the HTML in #help-body and
// copies icons drawn in index.html (`from: selector`) at render time.
//
// An item is {name, says, glyph?: GLYPHS key, from?: selector of a button in
// index.html whose svg is the icon, text?: a short label drawn as the icon}.
import { KEYS } from './keys.js';
import { GLYPHS, notchGlyph } from './glyphs.js';
import { LESSONS } from './lessons.js';

export const SECTIONS = [
  {
    title: 'Words',
    intro: 'A few words this app uses, in plain English.',
    items: [
      { name: 'Lattice', text: '△', says: 'The isometric grid: rows of triangles. The lines run up and down and at 30° and 150°.' },
      { name: 'Cell', glyph: 'triangle', says: 'One triangle of the lattice. Drawing fills cells.' },
      { name: 'Level', text: 'L3', says: 'How fine the grid is: 0 has the biggest cells, 7 the smallest. Each level halves the cell size. The level is the brush size.' },
      { name: 'Gutter', text: '┼', says: 'The thin line between two cells. It is only drawn on screen, never saved.' },
      { name: 'Density', text: 'L↕', says: 'The cell size inside a selection. Finer splits each cell into four; coarser merges four into one.' },
    ],
  },
  {
    title: 'Tools',
    intro: 'The row of buttons at the bottom.',
    items: [
      { name: 'Pencil', from: '[data-tool="pencil"]', says: 'Drag to fill cells with the chosen color and brush shape.' },
      { name: 'Eraser', from: '[data-tool="eraser"]', says: 'Drag to empty cells. It also lifts bold lines. It always erases.' },
      { name: 'Line', from: '[data-tool="line"]', says: 'Drag a straight line, locked to the three grid directions.' },
      { name: 'Fill bucket', from: '[data-tool="fill"]', says: 'Tap to fill an area of one color at the current grid size. A very big area fills with bigger cells.' },
      { name: 'Select', from: '[data-tool="select"]', says: 'Press a grid point and drag out a triangle, rhombus or hexagon. Then change its density, save it as a stamp, or erase it.' },
      { name: 'Shapes', from: '#options', says: 'Opens the shapes for the tool in use: brush shapes, line styles or selection shapes.' },
    ],
  },
  {
    title: 'Brush shapes',
    intro: 'For the pencil and the eraser.',
    items: [
      { name: 'Triangle', glyph: 'triangle', says: 'One cell.' },
      { name: 'Rhombus', glyph: 'rhombus', says: 'Two cells: one face of a cube.' },
      { name: 'Hexagon', glyph: 'hexagon', says: 'Six cells around a grid point: a small cube when auto-shade is on.' },
      { name: 'Trapezoid', glyph: 'trapezoid', says: 'Three cells: half a hexagon.' },
      { name: 'Big triangle', glyph: 'bigtri', says: 'Four cells that make one triangle of the next bigger level.' },
      { name: 'Drag a face', glyph: 'face', says: 'Drag to size a cube face of any size.' },
      { name: 'Drag a cube', glyph: 'cube', says: 'Drag to size a hexagon or cube of any size.' },
      { name: 'Stamp', glyph: 'stamp', says: 'Opens Stamps: tap one, then tap the grid to place it. It grows and shrinks with the grid size.' },
      { name: 'Starter stamps', from: '#stamps-starter', says: 'In Stamps: a cube, stairs, a house, a tree, a wall, a pyramid, a flower and a star, ready to place.' },
      { name: 'My stamps', from: '#stamps-mine', says: 'In Stamps: the ones you made with Save as stamp. They are kept in this browser, ready in every drawing.' },
    ],
  },
  {
    title: 'Line styles and selection shapes',
    items: [
      { name: 'Strip', glyph: 'strip', says: 'The line fills the strip of cells under it.' },
      { name: 'Edge', glyph: 'edge', says: 'A bold line on the grid lines. Its weight follows the level.' },
      { name: 'Triangle selection', glyph: 'm-triangle', says: 'Drag from a grid point; the direction sets which way it points.' },
      { name: 'Rhombus selection', glyph: 'm-rhombus', says: 'Drag from a grid point to size both sides.' },
      { name: 'Hexagon selection', glyph: 'm-hexagon', says: 'Drag out from its center point.' },
    ],
  },
  {
    title: 'Top buttons',
    items: [
      { name: 'Drawing', from: '#drawing-open', says: 'Opens the Drawing sheet: the name of this drawing, New, Open, Save drawing and Save picture. On a phone this narrow it shows only its folder.' },
      { name: 'New', from: '#top-new', says: 'On wider screens: starts a new drawing. It asks first if this one has anything in it.' },
      { name: 'Open', from: '#top-open', says: 'On wider screens: opens a drawing Isopix saved.' },
      { name: 'Save', from: '#top-save', says: 'On wider screens: Save drawing, as in the Drawing sheet. A dot means changes since the last save to a file.' },
      { name: 'Help', from: '#help-top', says: 'This sheet: every button, gesture and key. It sits next to Settings when there is room, and always in Settings, next to ✕.' },
      { name: 'Settings', from: '#settings-open', says: 'Drawing, Grid, Selection, Learning and About. Each part folds; its chip shows what is set.' },
      { name: 'Welcome', from: '#welcome-again', text: '👋', says: 'Show the welcome again, at the bottom of Settings, opens the card a first visit shows. Its Show me around starts the Basics lesson.' },
      { name: 'Undo', from: '#undo', says: 'Takes back the last change. There is no limit.' },
      { name: 'Redo', from: '#redo', says: 'Puts it back.' },
      { name: 'Keep', from: '#mode-chip', says: 'What a big stroke does over finer detail. Keep: it skips cells that already have finer detail (the preview hatches them). Tap to switch.' },
      { name: 'Behind', from: '#mode-chip', says: 'Paint behind: it fills only the empty parts and keeps everything painted.' },
      { name: 'Replace', from: '#mode-chip', says: 'It paints over everything.' },
    ],
  },
  {
    title: 'Drawing sheet',
    intro: 'Opened by the Drawing button. At the top, Drawings: every drawing this browser keeps, as pictures, newest first, each saved as you go, even when you switch apps. Below, This drawing: the one open now. A file keeps a drawing anywhere.',
    items: [
      { name: 'Name', text: 'Aa', says: 'The drawing\'s name. A new drawing gets a silly one; type your own any time. Saved files are named after it, in lowercase.' },
      { name: 'Roll a name', from: '#name-roll', text: '🎲', says: 'Rolls another silly name for this drawing: two words with the same first letter.' },
      { name: 'New', from: '#file-new', says: 'Starts another drawing. The one you were on stays in Drawings; tap its picture to go back to it.' },
      { name: 'A drawing', text: '▦', says: 'Tap a drawing\'s picture to open it. The one open now is outlined and says Open now. A long name gets smaller to fit, then ends in …' },
      { name: 'More for a drawing', text: '⋯', says: 'On each drawing: Rename, Make a copy, Save to a file, and Delete. Delete asks first, and says when the drawing is in no file and so cannot come back.' },
      { name: 'Open a file', from: '#file-open', says: 'Opens a drawing Isopix saved: its PNG, an .isopix file, or an older .isopix.json. It joins Drawings as another drawing; none is replaced.' },
      { name: 'Save drawing', from: '#file-save', says: 'Keeps your drawing in a file that opens again in Isopix, ready to keep drawing: its undo history, stamps, paper and trace picture all come along. It is a PNG that photo apps show too (except on iPhone and iPad, Settings → Drawing can make it an .isopix file instead). To share or print, use Save picture: it holds only the picture. On a computer with Chrome or Edge you choose where once, and Save writes that same file after. On an iPhone or iPad the share sheet opens: pick Save to Files. Elsewhere it goes to your downloads. Once the drawing is in a file, a dot on Save means it changed since.' },
      { name: 'Save a copy', from: '#file-saveas', text: '⇩', says: 'Shows after Save drawing has a file to write to: saves the drawing as a new file instead.' },
      { name: 'Save picture', from: '#file-png', says: 'A plain PNG picture of the drawing, to share or print. Nothing else is inside it.' },
      { name: 'Sharp picture (SVG)', from: '#file-svg', text: 'SVG', says: 'A picture that stays sharp at any size, for printing big or for design apps.' },
      { name: 'Watch it being drawn', from: '#file-replay', text: '▶', says: 'Plays the drawing back from the start, like a time-lapse. Tap Stop, or the paper, to end it.' },
    ],
  },
  {
    title: 'Grid size',
    intro: 'On a phone it is a slim rail on the right; touch it to open all eight sizes. On a tablet it is a bar along the top.',
    items: [
      { name: 'Size notches', html: notchGlyph(1), says: 'Big hexagons give big cells, small ones give small cells. Slide a finger along them. Following zoom, a notch keeps the cells about the same size on screen as you zoom.' },
      { name: 'Lock', from: '#lock', says: 'Freezes the level: then a notch is an exact level and zooming only changes the view. The number is the level in use.' },
    ],
  },
  {
    title: 'Zoom and move',
    intro: 'The rail on the left. Zoom and Move only change the view, never the drawing. Following zoom, the grid level changes with it.',
    items: [
      { name: 'Zoom in', from: '#zoom-in', says: 'Twice as close.' },
      { name: 'Zoom slider', from: '#zoom-track', text: '⇕', says: 'Slide up to come closer, down to see more. Each step of the same length doubles or halves the zoom.' },
      { name: 'Zoom out', from: '#zoom-out', says: 'Half as close.' },
      { name: 'Fit drawing', from: '#fit-view', says: 'Zooms and moves so everything you drew fills the screen. On empty paper it goes back to the start.' },
      { name: 'Move', from: '#move-mode', says: 'The hand. While it is lit, one finger (or the mouse) moves the view and draws nothing. Tap it again, or tap any tool, to draw.' },
    ],
  },
  {
    title: 'Selection bar',
    intro: 'Shows when something is selected.',
    items: [
      { name: 'Coarser', from: '#sel-coarser', says: 'Merges every four cells into one bigger cell.' },
      { name: 'Finer', from: '#sel-finer', says: 'Splits every cell into four. Nothing is lost, and detail merged before comes back.' },
      { name: 'Crisp / Blend', from: '#sel-mode', text: 'Aa', says: 'How merging picks a color. Crisp: the color most of the four cells have. Blend: the average.' },
      { name: 'Done', from: '#sel-done', says: 'Clears the selection.' },
      { name: 'More', from: '#sel-more', says: 'On a phone: Snap, Save as stamp and Erase.' },
      { name: 'Turn', from: '#sel-turn', says: 'Turns what is in the selection a sixth of a turn clockwise, exactly on the grid; six turns bring it back. A hexagon selection turns in place.' },
      { name: 'Flip', from: '#sel-flip', says: 'Flips what is in the selection left to right, like a mirror.' },
      { name: 'Snap', from: '#sel-snap', text: 'Snap', says: 'With Blend, moves the average to the nearest palette color.' },
      { name: 'Save as stamp', from: '#sel-stamp', says: 'Turns the selection into a stamp: it goes in Stamps → Mine, ready in every drawing.' },
      { name: 'Erase selection', from: '#sel-erase', says: 'Empties everything inside the selection.' },
      { name: 'Handle', from: '#handle', text: '⇕', says: 'The round knob on the selection: drag up for finer, down for coarser. The track shows each level.' },
    ],
  },
  {
    title: 'Colors',
    items: [
      { name: 'Swatch', text: '●', says: 'Tap a color. With the Eraser on, picking a color switches to the Pencil. The two small tones show auto-shade.' },
      { name: 'Auto-shade', glyph: 'cube', says: 'One color becomes three tones on cube faces: top light, left mid, right dark.' },
      { name: 'Any color', glyph: 'eyedropper', says: 'Pick a color of your own. On the Eraser, this also switches to the Pencil.' },
      { name: 'Paper', text: '◐', says: 'Settings → Drawing → Paper: each drawing keeps its own light or dark paper. The inks follow the paper.' },
    ],
  },
  {
    title: 'Gestures',
    items: [
      { name: 'One finger, or the mouse', text: '☝', says: 'Draws with the tool in use. A pen draws too. With the Move hand lit, it moves the view instead.' },
      { name: 'Two fingers', text: '✌', says: 'Drag to move the view, pinch to zoom. If the first finger left a mark, it is taken back. Lift one finger and keep moving the other to keep panning.' },
      { name: 'Two-finger tap', text: '✌', says: 'Tap with two fingers together to undo, like the Undo button.' },
      { name: 'Three-finger tap', text: '3', says: 'Tap with three fingers together to redo.' },
      { name: 'Mouse wheel', text: '⇅', says: 'Pans. Ctrl + wheel, or a trackpad pinch, zooms.' },
      { name: 'Middle button, or Space + drag', text: '✋', says: 'Pans with the mouse.' },
      { name: 'Hover', text: '◌', says: 'With a mouse or pen, shows the cells a stroke would paint, and hatches the ones Keep would skip.' },
      { name: 'Pinch inside a selection', text: '⤧', says: 'Experimental (turn it on in Settings → Selection): pinch out for finer, in for coarser.' },
      { name: 'Long-press, then pinch', text: '⏲', says: 'Experimental: hold inside the selection, then pinch with a second finger.' },
    ],
  },
];

// Every key row, for the Keys section (built from the table the app binds).
export const keyItems = () => KEYS.map((k) => ({ name: k.keys.join(' or '), text: k.keys[0], says: k.says, key: true }));

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

// HTML for the sheet. `iconOf(selector)` returns the svg of a button in the
// page (app.js passes one; tests pass a stub).
// Each section's id, from its title, so a remembered open section survives
// sections being added or moved.
export const helpId = (title) => `help-${String(title).toLowerCase().replace(/[^a-z]+/g, '-').replace(/^-|-$/g, '')}`;
export const lessonFoldId = (id) => `lesson-${id}`;
export const helpIds = () => [...LESSONS.map((l) => lessonFoldId(l.id)), ...[...SECTIONS.map((s) => s.title), 'Keys'].map(helpId)];

// The lessons, first: one folding row each, its chip saying ✓ once done on
// this device, and Start inside (app.js starts the lesson from data-lesson).
function lessonsHTML(open, done) {
  const rows = LESSONS.map((l) => {
    const id = lessonFoldId(l.id), on = open.has(id), chip = done.has(l.id) ? '✓ done' : `${l.steps.length} steps`;
    return `<section class="set-fold" aria-labelledby="${id}-h"><h3><button type="button" class="set-head" aria-expanded="${on}" aria-controls="${id}"><span class="set-head-caret" aria-hidden="true">${on ? '▾' : '▸'}</span><span id="${id}-h">${esc(l.title)}</span><span class="set-head-chip lesson-chip">${chip}</span></button></h3><div class="set-body" id="${id}"${on ? '' : ' hidden'}><p class="note">${esc(l.about)}</p><button type="button" class="btn wide" data-lesson="${l.id}">Start ${esc(l.title)}</button></div></section>`;
  }).join('');
  return `<h3 class="help-group">Lessons</h3><p class="note">Short tours on the real paper, in a practice drawing you can keep or throw away.</p>${rows}<h3 class="help-group">Every button, gesture and key</h3>`;
}

// open: the ids of the sections to draw open (app.js remembers them per
// device); done: the lessons finished on this device.
export function helpHTML(iconOf = () => '', open = new Set(), done = new Set()) {
  const icon = (it) => {
    if (it.html) return it.html;
    if (it.glyph) return GLYPHS[it.glyph];
    const borrowed = it.from ? iconOf(it.from) : '';
    if (borrowed) return borrowed;
    // Long keys (Ctrl+Shift+S) wrap after each + to fit the 44 px box.
    const text = esc(it.text || '');
    return `<span class="help-text-icon">${it.key ? text.replace(/\+(?=.)/g, '+<wbr>') : text}</span>`;
  };
  const sections = [...SECTIONS, { title: 'Keys', intro: 'For a keyboard.', items: keyItems() }];
  // Each section folds like Settings' (owner: "keep sections collapsible to
  // make the length less daunting"), closed unless this device opened it.
  return lessonsHTML(open, done) + sections.map((s) => { const id = helpId(s.title), on = open.has(id); return `<section class="set-fold" aria-labelledby="${id}-h"><h3><button type="button" class="set-head" aria-expanded="${on}" aria-controls="${id}"><span class="set-head-caret" aria-hidden="true">${on ? '▾' : '▸'}</span><span id="${id}-h">${esc(s.title)}</span></button></h3><div class="set-body" id="${id}"${on ? '' : ' hidden'}>${s.intro ? `<p class="note">${esc(s.intro)}</p>` : ''}<ul class="help-list">${
    s.items.map((it) => `<li><span class="help-icon${it.key ? ' help-key' : ''}" aria-hidden="true">${icon(it)}</span><span><b>${esc(it.name)}</b> ${esc(it.says)}</span></li>`).join('')
  }</ul></div></section>`; }).join('');
}
