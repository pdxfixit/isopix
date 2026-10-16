// Pointer, wheel and keyboard input: which gesture a finger starts, strokes,
// two-finger pan and pinch, and the keys from web/keys.js.

import * as L from '../engine/lattice.js';
import * as B from '../engine/brushes.js';
import * as S from '../engine/symmetry.js';
import { keyFor } from '../keys.js';
import { protectSplit } from '../engine/protect.js';
import { dropOnSecondFinger, oneFinger } from '../engine/gesture.js';
import { $, DRAG_BRUSHES, app, canvas, emit, requestRender, set, stopReplay, symCenter, toast } from '../app.js';
import { chooseNotch, computeLevel, fitView, toggleLock } from './controls.js';
import { applyCells, applyEdges, brushAt, closePopover, commit, doFill, eraseEdgesNear, marqueeRegion, openPopover, preview, previewEnd, previewStart, previewTo, redo, reportSkips, setMoveMode, setTool, stampItemsAt, undo, updateCursor, updateSelbar } from './tools.js';
import { askFirst, openDrawing, openHelp, openSettings, syncMenu } from './screens.js';
import { saveFile } from './files.js';

// ---------- pointer input ----------
const pointers = new Map();
export let gesture = null;
export let spaceHeld = false;

function local(e) {
  const r = canvas.getBoundingClientRect();
  return [e.clientX - r.left, e.clientY - r.top];
}
function worldOf(e) { const [x, y] = local(e); return app.view.toWorld(x, y); }

export function cancelGesture() {
  if (!gesture) return;
  if (gesture.tx && app.drawing.inTx) app.drawing.rollback();
  if (gesture.kind === 'density') previewEnd(false);
  clearTimeout(gesture.timer);
  gesture = null;
  app.crosshair = null;
  updateCursor();
  requestRender();
}

function startTwoFinger() {
  const pts = [...pointers.values()];
  const dist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
  const mid = [(pts[0].x + pts[1].x) / 2, (pts[0].y + pts[1].y) / 2];
  const s = app.settings;
  const prior = gesture;
  // A young or short stroke was the first finger of a pinch: drop it. A real one is kept.
  if (prior && prior.tx && app.drawing.inTx) {
    if (dropOnSecondFinger({ ageMs: performance.now() - prior.t0, travelPx: prior.travel || 0 })) { app.drawing.rollback(); app.strokeSkips.clear(); } else { commit(); reportSkips(); }
  }
  clearTimeout(prior?.timer);
  app.crosshair = null;
  const insideSel = prior && prior.startInSel;
  if (app.selection && s.tool === 'select' && ((s.densityPinch && insideSel) || (prior && prior.armed))) {
    previewStart();
    gesture = { kind: 'density', dist };
    toast('Density: pinch out finer, in coarser');
    return;
  }
  gesture = { kind: 'pinch', dist, mid, zoom: app.view.zoom, world: app.view.toWorld(...mid) };
  updateCursor();
}

function inSelection(wx, wy) {
  const sel = app.selection;
  return !!sel && sel.region.keys.has(L.cellKey(L.hitTest(sel.region.l, wx, wy)));
}

export function onDown(e) {
  if (app.replaying) { stopReplay(); return; }
  closePopover();
  try { canvas.setPointerCapture(e.pointerId); } catch { /* synthetic or already gone */ }
  const [x, y] = local(e);
  app.lastPointer = e.pointerType;
  pointers.set(e.pointerId, { x, y, type: e.pointerType });
  if (pointers.size === 2) { startTwoFinger(); return; }
  if (pointers.size > 2) return;
  const does = oneFinger({ moveMode: app.moveMode && !app.pickCenter, button: e.button, pointerType: e.pointerType, spaceHeld });
  if (does === 'pan') { gesture = { kind: 'pan', x, y }; app.ghost = null; updateCursor(); requestRender(); return; }
  if (does === 'ignore') return;
  const [wx, wy] = app.view.toWorld(x, y);
  const s = app.settings;
  const t0 = performance.now();
  app.ghost = null;

  if (app.pickCenter) {
    const v = L.nearestVertex(app.level, wx, wy);
    set('symL', v.l); set('symP', v.p); set('symQ', v.q);
    if (s.symmetry === 'off') set('symmetry', 'rot6mirror');
    app.pickCenter = false;
    syncMenu();
    toast('Symmetry center set');
    gesture = { kind: 'none' };
    requestRender();
    return;
  }

  const erase = s.tool === 'eraser';
  if (s.tool === 'pencil' || erase) {
    if (DRAG_BRUSHES.has(s.brush)) {
      const A = L.nearestVertex(app.level, wx, wy);
      gesture = { kind: 'drag', tx: true, t0, A, erase, x, y, sx: x, sy: y, travel: 0 };
      app.drawing.begin(s.brush);
      dragApply(gesture, wx, wy);
    } else {
      gesture = { kind: 'stroke', tx: true, t0, last: [wx, wy], erase, sx: x, sy: y, travel: 0 };
      app.drawing.begin(erase ? 'erase' : 'paint');
      applyCells(brushAt(wx, wy), erase);
      if (erase) eraseEdgesNear(wx, wy);
    }
  } else if (s.tool === 'line') {
    const A = L.nearestVertex(app.level, wx, wy);
    gesture = { kind: 'line', tx: true, t0, A, start: [wx, wy], sx: x, sy: y, travel: 0 };
    app.drawing.begin('line');
    lineApply(gesture, wx, wy);
  } else if (s.tool === 'fill') {
    doFill(wx, wy);
    gesture = { kind: 'none' };
  } else if (s.tool === 'select') {
    const startInSel = inSelection(wx, wy);
    // Anchor on a vertex of the next coarser level, so an even-sized marquee
    // lines up with bigger cells and can be coarsened without shrinking.
    const A = L.vertexAt(L.nearestVertex(Math.max(0, app.level - 1), wx, wy), app.level);
    gesture = { kind: 'marquee', A, x, y, moved: false, startInSel, t0 };
    app.crosshair = A;
    if (startInSel && s.densityLongpress) {
      gesture.timer = setTimeout(() => {
        if (gesture && gesture.kind === 'marquee' && !gesture.moved) {
          gesture.armed = true;
          app.crosshair = null;
          toast('Density mode: now pinch with a second finger');
          if (navigator.vibrate) navigator.vibrate(20);
        }
      }, 500);
    }
  }
  requestRender();
}

function dragApply(g, wx, wy) {
  app.strokeSkips.clear(); // each preview redoes the whole shape
  const s = app.settings;
  if (app.drawing.inTx) app.drawing.rollback();
  app.drawing.begin(s.brush);
  if (s.brush === 'stamp') {
    const { cells, edges } = stampItemsAt(wx, wy);
    applyCells(cells, g.erase);
    if (!g.erase) for (const { edge, c } of edges) applyEdges([edge], c);
    return;
  }
  const t = L.worldToLattice(g.A.l, wx, wy);
  const dp = t.pp - g.A.p, dq = t.qq - g.A.q;
  const cells = s.brush === 'face' ? B.parallelogram(g.A, dp, dq).cells : B.hexagon(g.A, B.hexRadius(dp, dq)).cells;
  applyCells(cells, g.erase);
}

function lineApply(g, wx, wy) {
  if (app.drawing.inTx) app.drawing.rollback();
  app.drawing.begin('line');
  if (app.settings.lineStyle === 'edge') {
    const t = L.worldToLattice(g.A.l, wx, wy);
    applyEdges(B.edgeLine(g.A, t.pp - g.A.p, t.qq - g.A.q).edges, app.settings.color);
  } else {
    applyCells(B.strip(app.level, g.start[0], g.start[1], wx, wy).cells, false);
  }
}

export function onMove(e) {
  const [x, y] = local(e);
  if (pointers.has(e.pointerId)) pointers.set(e.pointerId, { x, y, type: e.pointerType });
  if (!gesture) { hover(e); return; }
  const [wx, wy] = app.view.toWorld(x, y);
  const g = gesture;
  // How far a stroke has gone from where it started, for dropOnSecondFinger.
  if (g.tx) g.travel = Math.max(g.travel || 0, Math.hypot(x - g.sx, y - g.sy));
  if (g.kind === 'pinch' && pointers.size >= 2) {
    const pts = [...pointers.values()];
    const dist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
    const mid = [(pts[0].x + pts[1].x) / 2, (pts[0].y + pts[1].y) / 2];
    const v = app.view;
    v.zoom = g.zoom;
    v.cx = g.world[0] - (g.mid[0] - v.w / 2) / v.zoom;
    v.cy = g.world[1] - (g.mid[1] - v.h / 2) / v.zoom;
    v.zoomAt(g.mid[0], g.mid[1], dist / g.dist);
    v.pan(mid[0] - g.mid[0], mid[1] - g.mid[1]);
    computeLevel();
    requestRender();
  } else if (g.kind === 'density' && pointers.size >= 2) {
    const pts = [...pointers.values()];
    const dist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
    previewTo(preview.d0 + Math.round(Math.log(dist / g.dist) / Math.log(1.6)));
  } else if (g.kind === 'pan') {
    app.view.pan(x - g.x, y - g.y);
    g.x = x; g.y = y;
    requestRender();
  } else if (g.kind === 'stroke') {
    // Single cells need fine sampling, or a line grazing a vertex skips the
    // cell it barely crosses and the stroke breaks into corner-to-corner pieces.
    const step = L.edgeLen(app.level) / (app.settings.brush === 'triangle' ? 16 : 4);
    for (const [px, py] of B.samplePath(g.last[0], g.last[1], wx, wy, step)) {
      applyCells(brushAt(px, py), g.erase);
      if (g.erase) eraseEdgesNear(px, py);
    }
    g.last = [wx, wy];
    requestRender();
  } else if (g.kind === 'drag') {
    dragApply(g, wx, wy);
    requestRender();
  } else if (g.kind === 'line') {
    lineApply(g, wx, wy);
    requestRender();
  } else if (g.kind === 'marquee') {
    if (Math.hypot(x - g.x, y - g.y) > 6) g.moved = true;
    if (g.moved && !g.armed) {
      clearTimeout(g.timer);
      g.region = marqueeRegion(g.A, wx, wy);
      app.selection = { region: g.region, anchor: g.A, live: true };
      $('#selbar').hidden = true;
      $('#handle').hidden = true;
      requestRender();
    }
  }
}

export function onUp(e) {
  pointers.delete(e.pointerId);
  const g = gesture;
  if (!g) return;
  if (g.kind === 'pinch' || g.kind === 'density') {
    if (pointers.size < 2) {
      if (g.kind === 'density') previewEnd(true); else emit('view');
      // The finger left after a pinch moves the view; it never draws.
      const [rest] = [...pointers.values()];
      gesture = !rest ? null : g.kind === 'pinch' && oneFinger({ afterPinch: true }) === 'pan' ? { kind: 'pan', x: rest.x, y: rest.y } : { kind: 'none' };
      updateCursor();
    }
    return;
  }
  if (pointers.size) return;
  gesture = null;
  updateCursor();
  if (g.kind === 'pan') emit('view');
  if (g.tx) {
    if (e.type === 'pointercancel') { app.drawing.rollback(); app.strokeSkips.clear(); } else {
      const skipped = app.strokeSkips.size, diff = commit();
      reportSkips();
      const s = app.settings;
      emit('stroke', { tool: s.tool, brush: s.brush, lineStyle: s.lineStyle, level: app.level, cells: diff ? diff.cells.length + diff.edges.length : 0, skipped });
    }
  }
  if (g.kind === 'marquee') {
    clearTimeout(g.timer);
    app.crosshair = null;
    if (!g.moved) {
      if (app.selection && !g.armed) { app.selection = null; app.lastDensity = null; }
      else if (!app.selection) app.selection = { region: marqueeRegion(g.A, ...app.view.toWorld(g.x + 1, g.y + 1)), anchor: g.A };
    } else if (g.region) {
      app.selection = { region: g.region, anchor: g.A };
      app.lastDensity = null;
      emit('select');
    }
    updateSelbar();
  }
  requestRender();
}

function hover(e) {
  if (e.pointerType === 'touch') return;
  if (app.moveMode) { if (app.ghost) { app.ghost = null; app.ghostSkip = null; requestRender(); } return; }
  const s = app.settings;
  app.ghostSkip = null;
  let items = null;
  if ((s.tool === 'pencil' || s.tool === 'eraser') && !DRAG_BRUSHES.has(s.brush)) items = brushAt(...worldOf(e));
  else if (s.tool === 'pencil' && s.brush === 'stamp') items = stampItemsAt(...worldOf(e)).cells;
  if (items) {
    // The preview outlines what would be painted and hatches what Keep fine detail would skip.
    const cells = S.expandCells(items, symCenter(), s.symmetry).map((i) => i.cell);
    const split = protectSplit(app.drawing, cells, s.tool === 'eraser' ? 'replace' : s.protect);
    app.ghost = split.paint;
    app.ghostSkip = split.skip.length ? split.skip : null;
  } else app.ghost = null;
  requestRender();
}

export function onWheel(e) {
  e.preventDefault();
  const [x, y] = local(e);
  if (e.ctrlKey || e.metaKey || e.deltaMode === 1) {
    const dy = e.deltaMode === 1 ? e.deltaY * 16 : e.deltaY;
    app.view.zoomAt(x, y, Math.exp(-dy * 0.01));
    computeLevel();
  } else {
    app.view.pan(-e.deltaX, -e.deltaY);
  }
  requestRender();
  emit('view');
}

export function zoomBy(f) {
  app.view.zoomAt(app.view.w / 2, app.view.h / 2, f);
  computeLevel();
  requestRender();
  emit('view');
}
// ---------- keyboard ----------
// Keys come from the table in keys.js; the Help sheet lists the same table.
const ANYWHERE = new Set(['save', 'saveas', 'open']); // Ctrl+S, Ctrl+Shift+S, Ctrl+O work in the sheets too
export function onKey(e) {
  if (e.target.closest && e.target.closest('dialog, input, select, textarea') && !ANYWHERE.has(keyFor(e)?.action)) return;
  if (e.key === ' ') {
    if (e.type === 'keydown') { spaceHeld = true; e.preventDefault(); } else spaceHeld = false;
    updateCursor();
    return;
  }
  if (e.type === 'keyup') return;
  const row = keyFor(e);
  if (!row) return;
  if (row.match[0].mod) e.preventDefault();
  const [what, arg] = row.action.split(':');
  const cur = app.settings.locked ? app.settings.lockedLevel : app.settings.notch;
  const run = {
    tool: () => setTool(arg),
    options: () => { if (!$('#options').disabled) openPopover(); },
    size: () => chooseNotch(Math.max(0, Math.min(7, cur + Number(arg)))),
    lock: toggleLock,
    gutters: () => { set('gutters', !app.settings.gutters); syncMenu(); requestRender(); },
    reset: fitView,
    zoom: () => zoomBy(arg === 'in' ? 1.25 : 0.8),
    settings: openSettings,
    drawing: openDrawing,
    help: openHelp,
    move: () => setMoveMode(!app.moveMode, true),
    save: () => saveFile(),
    saveas: () => saveFile({ asNew: true }),
    open: () => askFirst('open'),
    escape: () => {
      const nothingElse = $('#popover').hidden && !app.moveMode && !app.selection;
      closePopover(); if (app.moveMode) setMoveMode(false);
      if (app.selection) { app.selection = null; updateSelbar(); requestRender(); emit('seldone'); }
      if (nothingElse && app.tour?.active()) app.tour.stop();
    },
    undo, redo,
  }[what];
  if (run) run();
}
