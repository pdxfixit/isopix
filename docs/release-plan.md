# Release plan: before a wide public launch

An agent's list of ideas (2026-10-14), after a usability pass for a large
public release. Nothing here is approved yet: the owner picks, and picked
items move to [TODO.md](../TODO.md) "Agents do". Sizes: **S** under an hour,
**M** a session, **L** several sessions.

## Done in this pass (on `main` since 2026-10-15)

- **Saving that works on every device.** Chrome and Edge on a computer: the
  Save dialog once, then Save (and Ctrl+S) writes the same file. iPhone and
  iPad: the share sheet (Save to Files), since a download link there can do
  nothing or trap a home-screen app. Everything else downloads. A dot on Save
  marks changes not in a file; the Drawing sheet says which file and when.
- **No lost work on a quick close.** The autosave runs at once when the app is
  put away, not 800 ms later; the browser is asked to keep the storage; a
  private window gets a one-time notice with a Save file button.
- **Two data-loss bugs fixed.** "Save file first" started the new drawing even
  when the save was cancelled; Open replaced the drawing without asking.
- **Drawing or moving the view.** A Move hand on the zoom rail (and `H`): one
  finger pans and draws nothing until a tool is tapped. A pinch now takes back
  the first finger's mark when it had barely moved (before: only within
  350 ms, so a finger resting a moment left a dot). The finger left after a
  pinch keeps panning instead of doing nothing.
- **Offline start fixed.** Six modules were missing from the service worker's
  list, so a copy opened once online and next opened offline could fail to
  start. A test now fails when a file is missing from the list.

## Next, recommended order

1. **Several drawings in the browser (a gallery).** L. Today the browser keeps
   one drawing and New replaces it: the biggest way a new user loses work. A
   grid of thumbnails on the Drawing sheet; New adds, never replaces; delete
   asks. Recommended first.
2. **Pen mode on tablets.** Deferred with no date (owner, 2026-10-16: "I
   don't have a pen/stylus"). It needs a real pen to tune.
3. **Two-finger tap undoes, three-finger tap redoes.** S–M. The convention
   from Procreate and most drawing apps; cheap to add on top of the gesture
   code. Needs a real phone to tune timing.
4. **First-run tips.** Done as the welcome card (2026-10-15, the owner's
   pick of three mocks): see docs/decisions.md.
5. **Share a picture.** S. A Share button (phones) that sends the PNG to
   Messages, Photos and so on through the share sheet.
6. **Install button.** S. "Add Isopix to your home screen": the browser's own
   prompt on Android and desktop Chrome, two-line steps on iPhone.
7. **Open files from outside.** M. Drag a `.isopix.json` or a picture onto the
   page; on an installed desktop copy, double-click a `.isopix.json` to open
   it (manifest `file_handlers`); on Android, share a picture to Isopix to
   trace it (`share_target`).
8. **Link previews.** S. Open Graph and Twitter card tags with a picture, so a
   shared link shows Isopix. Needs one absolute URL, which breaks the "every
   path is relative" rule: the owner's call.
9. **Undo history size.** M. Project files carry the whole undo log; a long
   session makes big files. Offer "Save without history", or cap it.
10. **Kid mode.** M. Fewer controls (no Settings, selection or Keep chip),
    bigger buttons, a gentler palette; a grown-up switch to leave it.

## Polish

- **Labels under the tool icons** (or a "Show labels" setting). S. Icons alone
  are hard for new users and young kids.
- **The Keep / Behind / Replace chip** sits in the top bar on every screen and
  is the app's most technical idea. Move it into the brush picker or Settings,
  or show it only once finer detail exists. S, the owner's call.
- **Undo and redo within thumb reach** on phones (now at the top left). S,
  the owner's call: it changes the layout.
- **Recent custom colors** next to the color picker. S.
- **Pan inertia** (a flick keeps gliding). S. Feels native on phones.
- **Brush-shape button** looks like a sixth tool; give it a frame or a caret
  so it reads as "options for this tool". S.

## Public-release hygiene

- **Real-device pass:** an iPhone, an Android phone, an iPad with a pen, and a
  cheap Android tablet. Pinch feel, the Move hand, the share-sheet save,
  install, offline start, speed. No tool here can test these.
- **Screen readers:** one run with VoiceOver and TalkBack end to end.
- **Old browsers:** a plain message when `<dialog>` or ES modules are missing,
  instead of a blank page. S.
- **A privacy policy link** in About, to https://privacy.pdxfixit.com/isopix/ (done 2026-10-16: About and Help).
  (the shared policy for every app): no accounts, no ads, drawings never leave
  the device, and usage counts as the note under the switch says. S.
- **Errors:** a friendly "Something went wrong" with a Copy details button and
  no telemetry. S.
- **Words in one table**, ready for other languages later. M.
- **Manifest:** description, categories and screenshots, for a richer install
  dialog on Android. S.
