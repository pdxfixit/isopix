# Verify

1. **`just test`** must be green. Judge it by the exit code, not by grepping: a syntax error stops it at `node --check` before any test runs.
2. **Every engine change ships with a test that fails without it.** Prove it: `just prove test/<file>.test.mjs web/engine/<file>.js`.
3. **Look at it** for anything a user sees: `just look [draw|drawn|select|settings|drawing-sheet|brushes …] [--js CODE]` (`just look --help` lists every view) reports sideways scroll, console errors, CSP blocks, controls under 44 px and overlaps at 320, 375, 700, 900 and 1100 px, and saves screenshots to the folder it prints. Run it with `--light` and again with `--dark`. Read the screenshots: the script cannot judge layout. A new screen or state gets a view: add an entry to `VIEWS` in `tools/look.mjs` (JS that opens it and throws if it did not); CI runs `just look --all`, as can you.
4. **Output changes:** `just export-check`. **Moving house** (`web/move.js`, the old addresses): `just move-check`. **Autosave** (`web/autosave.js`): `just autosave-check`. **Installing** (manifest, service worker, home-screen tags): `just install-check`.
5. **The shared Browser pane** is for real clicks and drags only. Serve on 8791 and pass your own `tabId` to every call. Its service worker fails to register (a pane limit); headless Chrome registers it and runs offline.
6. **Rendering changes:** `just perf` before and after; the bar is in docs/decisions.md (Shipping).
7. **What no tool here can test:** real multi-touch (pinch, long-press then pinch, two-finger pan), pen pressure, and performance on a real phone. Pointer events dispatched from script cover the logic, not the feel. Say so in your report.
