# Usage counts (telemetry)

Isopix counts how it is used, so the owner can decide what to build and fix
next. The rules are in [decisions.md](decisions.md) (Telemetry); this page says
how it works and what each field means.

## The path

1. **The app** (`web/telemetry.js`) counts in memory during a visit (one page
   load). When the page is hidden or closed, it sends the whole visit so far to
   `POST /api/visit` with a beacon. It sends only at https://isopix.app, only
   while Settings → About → **Send usage counts** is on (the default), and never
   from automated browsers (`navigator.webdriver`).
2. **The Worker** (`worker/index.js`, the `isopix-app` Worker) checks it with
   the app's own `cleanVisit`, adds the country Cloudflare read from the
   request, and writes one row per visit to D1 (`worker/schema.sql`). A
   later send from the same visit replaces the row. It never reads the IP
   address. One visit in 50 also deletes rows older than 90 days.
3. **The harvest** copies D1 and Cloudflare's daily stats into an archive
   kept for good. The telemetry runner (pdxfixit/telemetry) is the only
   harvester (the owner, 2026-10-15): daily, in a cloud container, flarepress's
   `harvest.py` on this repo's `site/` (`site/harvest.conf` says what; it gains
   `table=visits upsert visit` once the runner has the `isopix` database's id).
   Deploys do not harvest. The owner reads the archive on his Mac with the
   runner's `telemetry.py pull`.
4. **Cloudflare Web Analytics** counts page views on its own (no cookies). The
   CSP in `web/_headers` allows its beacon.

## What a visit holds

| Field | What it is |
|---|---|
| `visit` | Random, one per page load. |
| `device` | Random, made on the device and replaced every 90 days (`ROTATE_DAYS`). Linked to nothing else. |
| `app` | The release (`version.js`). |
| `width` | Screen width rounded down to 0, 400, 700, 1000, 1400 or 2000 px. |
| `touch`, `pwa`, `dark`, `reduced` | Touch screen; opened as an installed app; prefers dark mode; asks for reduced motion. |
| `lang` | The browser's language, two or three letters (`en`, not `en-US`). |
| `since` | How long since this device first used Isopix: new, week, month, quarter, year, older. Kept on the device, so it outlives the device code. |
| `seconds` | How long the visit has lasted, up to a day. |
| `cells` | The drawing's size: 0, 1-99, 100-999, 1k-10k, 10k+ cells. |
| `longtasks` | Main-thread tasks over 50 ms (Chrome only): a sign of slowness. |
| `counts` | `{"kind:word": n}`. Kinds: `tool` (a tool button), `btn` (any other button, by id), `color:swatch`, `brush`, `line`, `marquee` (a shape picked), `key` (a key's action from `web/keys.js`), `set` (a setting changed: `set:gray-on`, `set:protect-behind`), `stroke` (a pointer down on the canvas, by pointer type), `touch:second` (a second finger), `view:wheel`, `saved` (what a save did), `move:arrived`. |
| `errors` | Up to 5 uncaught errors as kind and place (`TypeError app.js:120`), never the message: a message can carry a file's text. |
| `country` | Added by the Worker from Cloudflare: the ISO country code. Never the region or city. |

## What is never sent

The drawing, its name, file names, anything typed (key presses inside a text
field are not counted, since their counts would spell part of a name), colors
chosen, the IP address, the city, or the User-Agent. `cleanVisit` drops any
field not in the table above, and a count whose name is not `kind:word` in
lower-case letters, digits and dashes.

## COPPA

Isopix is used by kids. Under the FTC's COPPA rule a persistent identifier is
personal information, but it may be collected without a parent's consent when
it is used only to support the site's internal operations (here: deciding what
to improve), the privacy notice says so, and it is kept no longer than needed.
So the device code changes every 90 days, D1 keeps 90 days, the location stops
at the country (in every app, the owner, 2026-10-16; a city or street counts as personal), and the note under the
switch in Settings → About says all of it. `test/telemetry.test.mjs` fails when
the note stops saying any of it, or when the schema gains an IP, city, address,
User-Agent or name column. This is the building agent's reading, not legal
advice.

## Usage events (the shared standard)

Isopix also records **events**, one record per thing that happened, in the
shape every app shares (the standard in pdxfixit/telemetry, Arrow-Rama
backlog #151). `web/events.js` builds them with `track(event, details)` and
queues them in memory and in localStorage (`isopix-events`, at most 1000,
oldest dropped). **Nothing sends them yet:** the visit beacon above stays
until the shared flarepress client and Worker (`POST /api/events`, to R2)
take over. With the switch off nothing is recorded and the queue is emptied.

| Column | Isopix |
|---|---|
| `app`, `platform` | `isopix`, `web` |
| `form` | `phone`, `tablet` or `desktop`, from the screen size and whether the main pointer is a finger |
| `version` | `version.js` |
| `player` | the device code above (`playerId()`, one function, for the id rework #150) |
| `session`, `seq` | random per page load; order within it from 0 |
| `at`, `tz` | epoch ms; UTC offset in minutes |
| `screen` | `draw`, or the open sheet: `settings`, `drawing`, `help` |
| `details` | only the keys listed for the event (`EVENTS`); each a number, a boolean or one of the app's own words, never text someone typed |

| Event | Where it is caught | Details |
|---|---|---|
| `app.open` | page load | viewport, density, font scale, dark, reduced motion, language, main input, installed, first run |
| `app.foreground`, `app.background`, `app.close` | `visibilitychange`, `pagehide` | time away or shown |
| `screen.view` | a sheet opens or the last one closes (watching each `<dialog>`'s `open`) | `from` |
| `dialog.open`, `dialog.close` | the welcome card, the brush popover (`brush`, `line`, `marquee`), the grid rail on phones (`levels`) | `answer` (`picked`, `dismissed`, `closed`, the card's return value), `ms` |
| `control.use` | the click listener in `telemetry.js`; keyboard shortcuts (`group: keys`) | `control` (id, `tool-…`, `pick-…`, `swatch`), `group` (`topleft`, `topright`, `levels`, `zoom`, `palette`, `tools`, `selbar`, `popover`, a sheet …), `layout` (`levels`: `rail` or `top`; `palette` and `tools`: `stacked` or `row`; `zoom`: `track` or `buttons`; else `narrow` or `wide`), `vw`, `vh`, `input` (`touch`, `mouse`, `pen`, `key`). **No coordinates.** |
| `setting.change` | `set(k, v)` in `app.js` | `key`, `from`, `to`; a slider's run folds into one record; colors and the symmetry center are never recorded; a lesson's own picks are not counted |
| `content.start`, `finish`, `abandon` | a drawing: page load, New, Open (start), Save (finish), New/Open over unsaved work or closing the page with it (abandon); a lesson: Start, last step, Stop / another lesson / closing | `kind` (`drawing`, `lesson`), `item` (the lesson), `resumed`, `ms`, `why` (`replaced`, `left`, `stopped`, `switched`) |
| `error` | `error`, `unhandledrejection` (20 a page load) | `kind`, `where` (`file:line`), `fatal` (before the controls work) |
| `perf.load` | the controls work | `ms` from navigation start, `cold` (no service worker yet) |
| `perf.longtask` | `PerformanceObserver`, summed when the page is put away | `n`, `ms` |
| `isopix.save`, `isopix.strokes`, `isopix.move_arrived` | what a save did; strokes by input (and the drawing's size bucket) per sitting; a drawing carried from an old address | |

`test/events.test.mjs` fails on an event or key not in `EVENTS`, a listed
event nothing sends, a new write to `app.settings` that skips `set()`, or a
coordinate; `just look events` (in CI) checks the real page.

## Adding a count

Most new buttons and settings are counted with no code: a click on a button
with an id, and a change in a dialog, name themselves. Something no click
shows goes through `app.usage.count(countName(kind, word))` in `app.js`. A new
field in the visit needs `cleanVisit`, the schema, the Worker's `UPSERT`, this
page and the privacy note, and the tests will say which one is missing.
