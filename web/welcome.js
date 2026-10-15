// The welcome card: shown once, on a first visit, over an empty drawing. It
// says how to touch the app and invites the person to the Basics lesson
// (Show me around) or straight to drawing. Its cube is a picture: the
// tappable practice cube it held shaded six single triangles, which the
// Triangle brush never does, so the lessons teach on the real canvas
// instead (owner, 2026-10-15). Start drawing, ✕ and Esc close it. Settings →
// About → Show the welcome again opens it again.
//
// welcomeDue is pure (test/welcome.test.mjs); initWelcome wires the dialog
// that index.html holds.

// Whether the card opens at start. Pure.
//   welcomed:   the card was closed on this device before (a setting)
//   hasContent: this browser already has a drawing
//   arriving:   a drawing is being carried here from an old address
export function welcomeDue({ welcomed, hasContent, arriving }) {
  return !welcomed && !hasContent && !arriving;
}

const ARRIVE = 'tour';

// Wires the card. deps: dialog (the <dialog>), onClose(how): how is 'tour'
// when Show me around closed it (app.js starts the Basics lesson), else ''.
// Returns { open() }.
export function initWelcome({ dialog, onClose }) {
  dialog.addEventListener('close', () => onClose(dialog.returnValue === ARRIVE ? 'tour' : ''));
  return {
    open() {
      dialog.returnValue = '';
      dialog.showModal();
    },
  };
}
