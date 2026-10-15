// The lesson bubble (docs/lessons.md): one step at a time, pointing at the
// real control, in a practice drawing. The steps and the step machine are
// web/lessons.js (pure); this file draws the bubble and talks to the app
// through `deps`, so app.js keeps its one write path to the drawing.
//
// deps:
//   device()          'touch' | 'mouse' | 'pen' (lessons.js deviceOf)
//   begin()           sets the person's drawing aside, starts a blank one
//   end(keep)         keep: the practice drawing becomes theirs; else theirs comes back
//   needsAsk()        true when theirs has something not in a file (Keep it asks first)
//   saveMineFirst()   saves theirs to a file; resolves true when it did
//   setup(setup)      does a step's setup (lessons.js)
//   practiceHasContent()
//   markDone(id)      remembers a finished lesson on this device
import { lessonById, startLesson, onEvent, next, finished, progress, sayFor } from './lessons.js';

export function initTour(deps) {
  let state = null;     // lessons.js step state
  let ending = null;    // null | 'end' | 'ask'
  let shownIndex = -1;  // the step whose setup already ran
  let lit = null;       // the element the bubble points at
  let timer = 0;
  let scrolledFor = '';  // the step whose target was scrolled into view in a sheet

  const bubble = document.createElement('div');
  bubble.className = 'tour';
  bubble.id = 'tour';
  bubble.setAttribute('role', 'dialog');
  bubble.hidden = true;
  bubble.innerHTML = '<p class="tour-progress"></p><p class="tour-say" aria-live="polite"></p><div class="tour-btns"></div>';
  document.body.append(bubble);
  const $p = bubble.querySelector('.tour-progress'), $say = bubble.querySelector('.tour-say'), $btns = bubble.querySelector('.tour-btns');

  const visible = (el) => !!el && el.getClientRects().length > 0 && !el.closest('[hidden]');
  function targetOf(step) {
    for (const sel of [].concat(step?.target || [])) {
      const el = document.querySelector(sel);
      if (visible(el)) return el;
    }
    return null;
  }
  function light(el) {
    if (lit === el) return;
    lit?.classList.remove('tour-target');
    lit = el;
    lit?.classList.add('tour-target');
  }
  function button(label, run, primary = false) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = `btn wide${primary ? ' tour-go' : ''}`;
    b.textContent = label;
    b.addEventListener('click', run);
    $btns.append(b);
    return b;
  }

  // The bubble lives in the open sheet when there is one (a modal sheet
  // leaves everything else behind it), else on the page, in the free paper
  // between the top buttons, the bottom bars and the two rails, so it never
  // covers a control the step asks for.
  const rectOf = (q) => { const el = document.querySelector(q); return visible(el) ? el.getBoundingClientRect() : null; };
  function freeArea(sheet) {
    const vw = window.innerWidth, vh = window.innerHeight;
    if (sheet) return { x0: 8, x1: vw - 8, y0: 8, y1: vh - 8 };
    const zoom = rectOf('#zoom'), levels = rectOf('#levels');
    const tops = ['.topleft', '.topright'].map(rectOf).filter(Boolean);
    const lows = ['.bottom > .palette', '.bottom > .tools', '#selbar'].map(rectOf).filter(Boolean);
    const a = { x0: 8, x1: vw - 8, y0: 8, y1: vh - 8 };
    if (zoom) a.x0 = zoom.right + 8;
    if (levels && levels.height > levels.width) a.x1 = levels.left - 8; else if (levels) tops.push(levels);
    for (const r of tops) a.y0 = Math.max(a.y0, r.bottom + 8);
    for (const r of lows) a.y1 = Math.min(a.y1, r.top - 8);
    return a;
  }
  function place() {
    if (!state) return;
    const sheet = document.querySelector('dialog[open]');
    // In a sheet, the bubble is a footer that sticks to its bottom: the
    // sheet's own content (its ✕ too) scrolls above it, never under it.
    const home = sheet ? sheet.querySelector('form') || sheet : document.body;
    if (bubble.parentElement !== home) home.append(bubble);
    bubble.classList.toggle('in-sheet', !!sheet);
    const step = !ending && lessonById(state.lesson).steps[state.index];
    const el = step ? targetOf(step) : null;
    light(el);
    if (sheet) {
      bubble.style.left = bubble.style.top = bubble.style.width = '';
      if (el && scrolledFor !== `${state.index}`) { scrolledFor = `${state.index}`; el.scrollIntoView({ block: 'center' }); }
      return;
    }
    const a = freeArea(sheet);
    const w = Math.max(200, Math.min(340, a.x1 - a.x0));
    bubble.style.width = `${w}px`;
    const bh = bubble.offsetHeight;
    let x = (a.x0 + a.x1) / 2 - w / 2, y = a.y0;
    if (el) {
      const r = el.getBoundingClientRect();
      x = r.left + r.width / 2 - w / 2;
      if (r.top >= a.y1) y = a.y1 - bh;                 // a bottom bar: just above the bars
      else if (r.bottom <= a.y0) y = a.y0;                   // a top button: just under the top row
      else y = r.top + r.height / 2 - bh / 2;                // a rail or something on the paper: beside it
    }
    bubble.style.left = `${Math.round(Math.max(a.x0, Math.min(a.x1 - w, x)))}px`;
    bubble.style.top = `${Math.round(Math.max(a.y0, Math.min(a.y1 - bh, y)))}px`;
  }

  function render() {
    if (!state) { bubble.hidden = true; light(null); return; }
    const lesson = lessonById(state.lesson);
    $btns.replaceChildren();
    bubble.setAttribute('aria-label', `Lesson: ${lesson.title}`);
    if (ending === 'ask') {
      $p.textContent = lesson.title;
      $say.textContent = 'Your own drawing is not in a file yet. This browser keeps one drawing, so keeping this one replaces it.';
      button('Save mine first', async () => { if (await deps.saveMineFirst()) finish(true); }, true);
      button('Replace it', () => finish(true));
      button('Cancel', () => { ending = 'end'; render(); });
    } else if (ending === 'end') {
      const all = finished(state);
      $p.textContent = all ? `🎉 ${lesson.title}: done!` : lesson.title;
      $say.textContent = `${all && state.lesson === 'basics' ? 'That\'s the basics. More lessons are in Help (?). ' : ''}${deps.practiceHasContent() ? 'Keep what you drew here, or go back to your drawing?' : ''}`;
      if (deps.practiceHasContent()) {
        button('Keep it', () => { if (deps.needsAsk()) { ending = 'ask'; render(); } else finish(true); }, true);
        button('Back to my drawing', () => finish(false));
      } else button('Back to my drawing', () => finish(false), true);
    } else {
      const step = lesson.steps[state.index];
      if (shownIndex !== state.index) { shownIndex = state.index; if (step.setup) deps.setup(step.setup); }
      $p.textContent = `${lesson.title} · ${progress(state)}`;
      $say.textContent = sayFor(step, deps.device());
      if (step.show) button('Next', () => go(next(state)), true);
      else if (step.optional) button('Skip this step', () => go(next(state)));
      button('Stop lesson', stop);
    }
    bubble.hidden = false;
    place();
    if (ending) $btns.querySelector('button')?.focus({ preventScroll: true });
  }
  function go(s) {
    state = s;
    if (finished(state)) { deps.markDone(state.lesson); ending = 'end'; }
    render();
  }
  function stop() { if (state && !ending) { ending = 'end'; render(); } }
  function finish(keep) {
    deps.end(keep);
    state = null; ending = null; shownIndex = -1; scrolledFor = '';
    clearInterval(timer);
    render();
  }

  window.addEventListener('resize', () => place());
  return {
    start(id) {
      const s = startLesson(id);
      if (!s) return;
      if (!state) deps.begin();
      state = s; ending = null; shownIndex = -1;
      clearInterval(timer);
      // Targets come and go (the selection bar, a sheet), so the bubble follows.
      timer = setInterval(() => place(), 300);
      render();
    },
    event(e) {
      if (!state || ending) return;
      const s = onEvent(state, e);
      if (s !== state) go(s); else place();
    },
    active: () => !!state,
    stop,
    // For tools/look.mjs.
    state: () => (state ? { ...state, ending } : null),
  };
}
