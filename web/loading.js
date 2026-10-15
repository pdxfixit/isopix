// The loading screen (#loading in index.html): paper that sweeps in
// clockwise like a progress ring, under a bar with the icon's cube building
// and the tagline (owner, 2026-10-15: "L2, but the bar at the bottom, should
// have the L1 cube, and tag line ... gradually appear in a clockwise /
// progress bar style"). A classic script, not a module, so it runs before the
// app's modules arrive; the page's CSP allows no inline script.
//
// The screen is plain paper from the first frame, so a quick start (a return
// visit is about 0.2 s) shows nothing but the paper the app opens on. Its
// sweep and bar appear after SHOW_MS (styles.css waits the same), stay at
// least MIN_MS once shown, and the sweep, which eases toward nine tenths of a
// turn, completes when the app is ready. After SLOW_MS it says so, with Reload.
// app.js calls ISOPIX_LOADING.done() when the controls work.
(() => {
  const SHOW_MS = 500, MIN_MS = 400, FINISH_MS = 200, FADE_MS = 150, SLOW_MS = 10000;

  // How to finish, `t` ms after the page started. Pure.
  //   wait:  ms to hold before finishing (the shown minimum)
  //   sweep: whether the sweep was showing and should complete its turn first
  function plan(t) {
    if (t < SHOW_MS) return { wait: 0, sweep: false };
    return { wait: Math.max(0, SHOW_MS + MIN_MS - t), sweep: true };
  }

  const api = { plan, SHOW_MS, MIN_MS, SLOW_MS, done: () => Promise.resolve() };
  self.ISOPIX_LOADING = api;
  const el = typeof document !== 'undefined' && document.getElementById('loading');
  if (!el) return;
  const sweep = el.querySelector('.loading-sweep');
  const slow = setTimeout(() => {
    el.classList.add('slow');
    el.querySelector('.loading-slow').hidden = false;
  }, SLOW_MS);
  el.querySelector('#loading-reload').addEventListener('click', () => location.reload());
  const later = (ms) => new Promise((r) => setTimeout(r, ms));

  let finishing = null;
  api.done = () => finishing || (finishing = (async () => {
    clearTimeout(slow);
    const p = plan(performance.now());
    await later(p.wait);
    if (p.sweep && sweep) {
      // Hold the sweep where it is, then turn it the rest of the way.
      const now = getComputedStyle(sweep).getPropertyValue('--p');
      sweep.style.animation = 'none';
      if (now) sweep.style.setProperty('--p', now);
      void sweep.offsetWidth;
      el.classList.add('finishing');
      await later(FINISH_MS);
    }
    el.classList.add('gone');
    await later(FADE_MS);
    el.hidden = true;
  })());
})();
