// The lessons (docs/lessons.md): short tours on the real canvas, in a
// practice drawing. Pure data and a pure step machine, no DOM, so a test can
// drive a lesson with the events the app sends and check that every control
// on the Help sheet is taught somewhere (owner: "wonderful", 2026-10-15).
// web/tour.js draws the bubble and wires it to the app.
//
// A step:
//   id       short name, unique in its lesson
//   say      what the bubble says: a string, or { touch, mouse, pen } (owner:
//            "each device presents unique ways that present in the tour")
//   target   a selector, or a list of them (the first one on screen wins),
//            for the thing the bubble points at; none: the paper
//   setup    what the tour does first: { tool, brush, lineStyle, marquee,
//            shading, protect, open: 'settings:<section>' | 'drawing' }
//   done     (event, mem) => true when the step is done; mem is the step's
//            own scratch object, for steps that need two things in order
//   show     true: nothing to do, the bubble has Next
//   optional true: the bubble also offers "Skip this step"
//   covers   the Help sheet items (by name) this step teaches
//
// Events (app.js sends them, see `emit`): stroke {tool, brush, lineStyle,
// level, cells, skipped}, fill, undo, redo, view, fit, level {level}, color
// {custom}, shading {on}, tool {tool}, pick {what, value}, mode {mode},
// select, density {dir}, seldone, stamp, symmetry {mode}, name, saved {what},
// replay, gray {on}, sheet {id}.

const ev = (type, test = () => true) => (e) => e.type === type && test(e);
const after = (first, then) => (e, mem) => { if (first(e)) mem.first = true; return !!mem.first && then(e); };
const stroke = (test = () => true) => ev('stroke', test);
const DRAW_SOMETHING = {
  id: 'cube', setup: { tool: 'pencil', brush: 'hexagon' },
  say: { touch: 'First, tap the paper a few times: each tap makes a cube.', mouse: 'First, click the paper a few times: each click makes a cube.', pen: 'First, tap the paper a few times with the pen: each tap makes a cube.' },
  done: stroke((e) => e.cells > 0), covers: [],
};

export const LESSONS = [
  {
    id: 'basics', title: 'Basics', about: 'Draw, make a shaded cube, change the size, undo, move and zoom.',
    steps: [
      { id: 'draw', setup: { tool: 'pencil', brush: 'triangle' },
        say: { touch: 'Drag a finger across the paper to draw.', mouse: 'Click and drag across the paper to draw.', pen: 'Draw across the paper with your pen.' },
        done: stroke((e) => e.tool === 'pencil' && e.cells >= 3), covers: ['Pencil', 'Triangle'] },
      { id: 'cube', setup: { tool: 'pencil', brush: 'hexagon' }, target: '#options',
        say: { touch: 'Now the Hexagon brush (it lives here). Tap the paper: a whole cube, shaded for you.', mouse: 'Now the Hexagon brush (it lives here). Click the paper: a whole cube, shaded for you.', pen: 'Now the Hexagon brush (it lives here). Tap the paper: a whole cube, shaded for you.' },
        done: stroke((e) => e.brush === 'hexagon'), covers: ['Hexagon', 'Shapes', 'Auto-shade'] },
      { id: 'size', target: '#levels',
        say: { touch: 'The grid size is the brush size. Pick a bigger hexagon here, then tap the paper again.', mouse: 'The grid size is the brush size. Pick a bigger hexagon here (or press [), then click the paper again.', pen: 'The grid size is the brush size. Pick a bigger hexagon here, then tap the paper again.' },
        done: after(ev('level'), stroke()), covers: ['Size notches'] },
      { id: 'undo', target: '#undo',
        say: { touch: 'Tap Undo to take that back.', mouse: 'Click Undo (or press Ctrl+Z) to take that back.', pen: 'Tap Undo to take that back.' },
        done: ev('undo'), covers: ['Undo'] },
      { id: 'redo', target: '#redo',
        say: { touch: 'Redo puts it back. Tap it.', mouse: 'Redo puts it back. Click it (or press Ctrl+Shift+Z).', pen: 'Redo puts it back. Tap it.' },
        done: ev('redo'), covers: ['Redo'] },
      { id: 'move', target: '#zoom',
        say: { touch: 'Two fingers move the paper and pinch to zoom. The rail on the left zooms too, and its hand moves the paper. Try one.', mouse: 'Scroll to move the paper; Ctrl+scroll (or a trackpad pinch) zooms. The rail on the left does both. Try one.', pen: 'Use the rail on the left: + and − zoom, the hand moves the paper. Try one.' },
        done: ev('view'), covers: ['Zoom in', 'Zoom slider', 'Zoom out', 'Move'] },
      { id: 'fit', target: '#fit-view',
        say: { touch: 'Lost your drawing? Tap ⌖ to bring it back.', mouse: 'Lost your drawing? Click ⌖ (or press 0) to bring it back.', pen: 'Lost your drawing? Tap ⌖ to bring it back.' },
        done: ev('fit'), covers: ['Fit drawing'] },
    ],
  },
  {
    id: 'colors', title: 'Colors and shading', about: 'Pick colors, pick any color, and see how auto-shade works.',
    steps: [
      { id: 'pick', target: '#palette .swatch:not(.tool)', say: 'Tap a color.', done: ev('color', (e) => !e.custom), covers: ['Swatch'] },
      { id: 'any', target: '#pick-any', optional: true,
        say: 'The eyedropper picks any color of your own. Try it.', done: ev('color', (e) => e.custom), covers: ['Any color'] },
      { id: 'flat', setup: { tool: 'pencil', brush: 'hexagon', shading: true }, target: '#shade-toggle',
        say: { touch: 'Turn auto-shade off with the cube button, then tap the paper: one flat color.', mouse: 'Turn auto-shade off with the cube button, then click the paper: one flat color.', pen: 'Turn auto-shade off with the cube button, then tap the paper: one flat color.' },
        done: after(ev('shading', (e) => !e.on), stroke()), covers: ['Auto-shade'] },
      { id: 'back', target: '#shade-toggle', say: 'Turn auto-shade back on.', done: ev('shading', (e) => e.on), covers: [] },
      { id: 'why', show: true,
        say: 'One triangle has no face of its own, so it paints flat. The Hexagon, Trapezoid and cube brushes know their faces, so they shade.', covers: [] },
      { id: 'paper', show: true, target: '#settings-open',
        say: 'Each drawing has its own paper, light or dark: Settings → Drawing → Paper. The colors follow it.', covers: ['Paper'] },
    ],
  },
  {
    id: 'fill', title: 'Fill and erase', about: 'Fill a face, erase, and get back to the Pencil.',
    steps: [
      DRAW_SOMETHING,
      { id: 'fill', target: '[data-tool="fill"]', say: 'Pick another color, then the Fill bucket, then tap a face of a cube. The shading stays.',
        done: ev('fill'), covers: ['Fill bucket'] },
      { id: 'erase', target: '[data-tool="eraser"]',
        say: { touch: 'Pick the Eraser and drag over part of it.', mouse: 'Pick the Eraser (or press E) and drag over part of it.', pen: 'Pick the Eraser and draw over part of it.' },
        done: stroke((e) => e.tool === 'eraser'), covers: ['Eraser'] },
      { id: 'pencil', target: '#palette .swatch:not(.tool)', say: 'Tap a color: you are back on the Pencil.',
        done: ev('color'), covers: [] },
    ],
  },
  {
    id: 'shapes', title: 'Brush shapes', about: 'Every brush shape, and the two you drag to size.',
    steps: [
      { id: 'small', setup: { tool: 'pencil' }, target: '#options',
        say: 'Open the brush shapes and try the Rhombus, the Trapezoid and the Big triangle.',
        done: (e, mem) => { if (e.type === 'stroke' && e.tool === 'pencil') (mem.seen ||= new Set()).add(e.brush); return ['rhombus', 'trapezoid', 'bigtri'].every((b) => mem.seen?.has(b)); },
        covers: ['Rhombus', 'Trapezoid', 'Big triangle'] },
      { id: 'face', target: '#options', say: 'Now pick Drag a face, and drag on the paper to size a cube face.',
        done: stroke((e) => e.brush === 'face'), covers: ['Drag a face'] },
      { id: 'cube', target: '#options', say: 'And Drag a cube: drag to size a whole cube.',
        done: stroke((e) => e.brush === 'cube'), covers: ['Drag a cube'] },
    ],
  },
  {
    id: 'lines', title: 'Lines', about: 'Straight lines on the grid, and bold edge lines.',
    steps: [
      { id: 'strip', setup: { lineStyle: 'strip' }, target: '[data-tool="line"]',
        say: 'Pick Line and drag: it snaps to the grid\'s three directions.',
        done: stroke((e) => e.tool === 'line' && e.lineStyle === 'strip'), covers: ['Line', 'Strip'] },
      { id: 'edge', target: '#options', say: 'Open the line styles, pick Edge, and drag along the grid lines.',
        done: stroke((e) => e.tool === 'line' && e.lineStyle === 'edge'), covers: ['Edge'] },
    ],
  },
  {
    id: 'big', title: 'Big over small', about: 'What a big stroke does over small detail: Keep, Behind, Replace.',
    steps: [
      { id: 'detail', setup: { tool: 'pencil', brush: 'hexagon', protect: 'protect' }, target: '#levels',
        say: 'Pick a small size and draw a little.', done: stroke((e) => e.level >= 5), covers: [] },
      { id: 'keep', target: '#levels', say: 'Now pick a big size and draw over it: the striped cells are kept.',
        done: stroke((e) => e.skipped > 0), covers: ['Keep'] },
      { id: 'chip', target: '#mode-chip', say: 'Tap Keep to switch: Behind fills only the empty parts; Replace paints over everything.',
        done: ev('mode'), covers: ['Behind', 'Replace'] },
      { id: 'lock', show: true, target: '#lock',
        say: 'The lock keeps the grid size the same while you zoom. The number is the size in use.', covers: ['Lock'] },
    ],
  },
  {
    id: 'select', title: 'Selecting', about: 'Select part of a drawing, and make it coarser or finer.',
    steps: [
      DRAW_SOMETHING,
      { id: 'select', setup: { marquee: 'hexagon' }, target: '[data-tool="select"]',
        say: 'Pick Select, press a grid point and drag out a hexagon around your cubes. (Shapes also has a triangle and a rhombus.)',
        done: ev('select'), covers: ['Select', 'Hexagon selection', 'Triangle selection', 'Rhombus selection'] },
      { id: 'coarser', target: '#sel-coarser', say: 'Tap Coarser: four cells become one bigger cell.',
        done: ev('density', (e) => e.dir < 0), covers: ['Coarser'] },
      { id: 'finer', target: '#sel-finer',
        say: { touch: 'Tap Finer (or drag the round handle up): the detail comes back.', mouse: 'Click Finer (or drag the round handle up): the detail comes back.', pen: 'Tap Finer (or drag the round handle up): the detail comes back.' },
        done: ev('density', (e) => e.dir > 0), covers: ['Finer', 'Handle'] },
      { id: 'crisp', show: true, target: '#sel-mode',
        say: 'Crisp keeps the color most cells have; Blend mixes them, and Snap moves a blend to the nearest palette color. Erase empties the selection.',
        covers: ['Crisp / Blend', 'Snap', 'Erase selection'] },
      { id: 'done', target: '#sel-done',
        say: { touch: 'Tap Done to finish.', mouse: 'Click Done (or press Esc) to finish.', pen: 'Tap Done to finish.' },
        done: ev('seldone'), covers: ['Done'] },
    ],
  },
  {
    id: 'stamps', title: 'Stamps', about: 'Turn part of a drawing into a stamp, and place it at any size.',
    steps: [
      DRAW_SOMETHING,
      { id: 'select', setup: { marquee: 'hexagon' }, target: '[data-tool="select"]', say: 'Pick Select and drag around it.',
        done: ev('select'), covers: [] },
      { id: 'save', target: ['#sel-stamp', '#sel-more'], say: 'Tap Save as stamp (on a phone, it is under More).',
        done: ev('stamp'), covers: ['Save as stamp', 'More'] },
      { id: 'place', setup: { tool: 'pencil', brush: 'stamp' },
        say: { touch: 'The Stamp brush is picked. Tap the paper to place it.', mouse: 'The Stamp brush is picked. Click the paper to place it.', pen: 'The Stamp brush is picked. Tap the paper to place it.' },
        done: stroke((e) => e.brush === 'stamp'), covers: ['Stamp'] },
      { id: 'scale', target: '#levels', say: 'Pick another size and place it again: a stamp scales with the grid.',
        done: after(ev('level'), stroke((e) => e.brush === 'stamp')), covers: [] },
    ],
  },
  {
    id: 'symmetry', title: 'Symmetry', about: 'Draw six at once.',
    steps: [
      { id: 'open', target: '#settings-open', say: 'Open Settings.', done: ev('sheet', (e) => e.id === 'settings'), covers: ['Settings'] },
      { id: 'on', setup: { open: 'settings:set-drawing' }, target: 'input[name="symmetry"][value="rot6"]', say: 'Pick 6-fold rotation.',
        done: ev('symmetry', (e) => e.mode === 'rot6'), covers: [] },
      { id: 'draw', setup: { tool: 'pencil', brush: 'triangle' },
        say: { touch: 'Close Settings and draw a little: six copies at once.', mouse: 'Close Settings and draw a little: six copies at once.', pen: 'Close Settings and draw a little: six copies at once.' },
        done: stroke(), covers: [] },
      { id: 'off', setup: { open: 'settings:set-drawing' }, target: 'input[name="symmetry"][value="off"]', say: 'Pick Off to draw one at a time again.',
        done: ev('symmetry', (e) => e.mode === 'off'), covers: [] },
    ],
  },
  {
    id: 'saving', title: 'Saving and sharing', about: 'Name it, save it to keep drawing later, and share a picture.',
    steps: [
      DRAW_SOMETHING,
      { id: 'sheet', target: '#drawing-open', say: 'Open the Drawing sheet.', done: ev('sheet', (e) => e.id === 'drawing'), covers: ['Drawing'] },
      { id: 'name', setup: { open: 'drawing' }, target: '#name-roll', say: 'Roll a silly name, or type your own.',
        done: ev('name'), covers: ['Name', 'Roll a name'] },
      { id: 'newopen', show: true, setup: { open: 'drawing' }, target: '#gallery',
        say: 'Drawings holds every drawing you make here. New starts another, and the one you were on stays; tap a picture to go back. ⋯ on a drawing renames, copies or deletes it. Open a file adds one Isopix saved. On a wide screen New, Open and Save are in the top bar too.',
        covers: ['New', 'A drawing', 'More for a drawing', 'Open a file', 'Open', 'Save'] },
      { id: 'save', setup: { open: 'drawing' }, target: '#file-save', optional: true,
        say: { touch: 'Tap Save drawing: a file that opens again here, ready to keep drawing. (On iPhone and iPad, pick Save to Files.)', mouse: 'Click Save drawing (or press Ctrl+S): a file that opens again here, ready to keep drawing.', pen: 'Tap Save drawing: a file that opens again here, ready to keep drawing.' },
        done: ev('saved', (e) => e.what === 'drawing'), covers: ['Save drawing'] },
      { id: 'share', show: true, setup: { open: 'drawing' }, target: '#file-png',
        say: 'To share or print, use Save picture: it holds just the picture. Sharp picture (SVG) stays sharp at any size.',
        covers: ['Save picture', 'Sharp picture (SVG)'] },
      { id: 'watch', setup: { open: 'drawing' }, target: '#file-replay', say: 'Tap Watch it being drawn.',
        done: ev('replay'), covers: ['Watch it being drawn'] },
    ],
  },
  {
    id: 'learning', title: 'Learning tools', about: 'Grayscale view, a limited palette, and tracing a picture.',
    steps: [
      { id: 'gray', setup: { open: 'settings:set-learning' }, target: '#opt-gray', say: 'Turn on Grayscale view: tops should look light and sides dark.',
        done: ev('gray', (e) => e.on), covers: [] },
      { id: 'grayoff', setup: { open: 'settings:set-learning' }, target: '#opt-gray', say: 'Turn it off again.',
        done: ev('gray', (e) => !e.on), covers: [] },
      { id: 'limited', show: true, setup: { open: 'settings:set-learning' }, target: '#opt-limited',
        say: 'Limited palette starts you with 3 tones; + adds one more when you are ready.', covers: [] },
      { id: 'trace', show: true, setup: { open: 'settings:set-learning' }, target: '#trace-open',
        say: 'Trace a picture puts a photo under the grid to draw over.', covers: [] },
    ],
  },
];

// Help items no lesson teaches, and why. The drift test allows only these.
export const NOT_TAUGHT = {
  Welcome: 'it is the card that starts the lessons',
  'Save a copy': 'it shows only after Save drawing has a file; Help explains it',
  Help: 'the lessons live in it',
};
// The Help sections the drift test checks (Words, Gestures and Keys explain, they are not controls).
export const TAUGHT_SECTIONS = ['Tools', 'Brush shapes', 'Line styles and selection shapes', 'Top buttons', 'Drawing sheet', 'Grid size', 'Zoom and move', 'Selection bar', 'Colors'];

export const lessonById = (id) => LESSONS.find((l) => l.id === id) || null;

// Which wording to use: the last pointer used, or before any, the screen's
// main pointer. Pure.
export function deviceOf({ pointerType = '', coarse = false } = {}) {
  if (pointerType === 'pen') return 'pen';
  if (pointerType === 'mouse') return 'mouse';
  if (pointerType === 'touch') return 'touch';
  return coarse ? 'touch' : 'mouse';
}
export const sayFor = (step, device) => (typeof step.say === 'string' ? step.say : step.say[device] || step.say.touch);

// The step machine. state: { lesson, index, mem } or null when no lesson
// runs. Returns the next state; index === steps.length means finished.
export function startLesson(id) {
  const lesson = lessonById(id);
  return lesson ? { lesson: id, index: 0, mem: {} } : null;
}
export function onEvent(state, e) {
  if (!state) return state;
  const step = lessonById(state.lesson).steps[state.index];
  if (!step || step.show || !step.done(e, state.mem)) return state;
  return { ...state, index: state.index + 1, mem: {} };
}
// Next (a show-only step) or Skip this step (an optional one).
export function next(state) {
  if (!state) return state;
  const step = lessonById(state.lesson).steps[state.index];
  return step && (step.show || step.optional) ? { ...state, index: state.index + 1, mem: {} } : state;
}
export const finished = (state) => !!state && state.index >= lessonById(state.lesson).steps.length;
export const progress = (state) => (state ? `Step ${Math.min(state.index + 1, lessonById(state.lesson).steps.length)} of ${lessonById(state.lesson).steps.length}` : '');

// Lessons done on this device, stored as a JSON list of ids.
export function doneLessons(raw) {
  try {
    const list = JSON.parse(raw ?? '[]');
    return new Set(Array.isArray(list) ? list.filter((x) => typeof x === 'string' && lessonById(x)) : []);
  } catch { return new Set(); }
}
