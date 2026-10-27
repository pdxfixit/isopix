# Usage events (telemetry)

Isopix records how it is used, so the owner can decide what to build and fix
next. The rules are in [decisions.md](decisions.md) (Telemetry); this page says
how it works and what each field means.

The per-visit beacon (`POST /api/visit` into the D1 table `visits`) was retired
on 2026-10-16, once the events below replaced it. Its rows in the D1 table and in the
telemetry runner's archive stay (the runner blanks their device codes after a
year); nothing writes new ones.

## The path

1. **The app** (`web/events.js`) records events in memory and localStorage
   during a visit and sends them from https://isopix.app only, only while
   Settings → **Share play data** is on (the default), and never from automated
   browsers (`navigator.webdriver`).
2. **The Worker** (`worker/index.js`, the `isopix-app` Worker) writes each
   batch as it came to the R2 bucket `isopix-telemetry` (details below). It
   never reads the IP address.
3. **The harvest** is the telemetry runner's (pdxfixit/telemetry), the only
   harvester: its `isopix_events` job reads and empties the bucket into an
   archive kept for good, except the device code, which the runner removes a
   year on. Cloudflare's daily stats come from `site/harvest.conf` (`analytics=1`;
   the retired beacon's `table=visits` line is gone). Deploys do not harvest. The owner reads the
   archive on his Mac with the runner's `telemetry.py pull`.
4. **Cloudflare Web Analytics** counts page views on its own (no cookies). The
   CSP in `web/_headers` allows its beacon.

## What is never sent

The drawing, its name, file names, anything typed (key presses inside a text
field are not recorded, since they would spell part of a name, and nothing
typed into Feedback is ever an event), colors chosen,
the symmetry center, coordinates, the IP address, the city, the User-Agent, or
an error's message. `cleanDetails` in `web/events.js` drops any key an event
may not carry and any value that is not a number, a boolean or one of the app's
own words.

## Feedback is not telemetry

Settings → About → **Feedback** (beside the version) is the one place
something typed leaves the device, and only when the person presses Send
(the owner, 2026-10-19). A grown-up check comes first (a sum; kids use the
app). It sends only what was typed into the box, as plain text, to
`POST /api/feedback` (`web/feedback.js`, `web/ui/feedback.js`); the Worker
(flarepress's `handleFeedback`, vendored in `worker/events-worker.js`) stores
it as it came in the R2 bucket `app-suggestions` (binding `FEEDBACK`), which
every app's feedback shares, under `v1/isopix/<day>/<version>-<id>.txt`: the
version and a random id the page makes per message, no name, no device code,
no IP. A rate limit (`FEEDBACK_LIMITER`, 10 a minute) counts the whole box,
never the sender. The telemetry runner moves each message to the owner's
notes and removes it after 90 days. It goes to the owner only, and the box
says not to include names or contact details, since nobody can write back.
`test/feedback.test.mjs` fails if `web/ui/feedback.js` reaches the usage
events or storage, and `just look feedback` checks that the text sent never
lands in a queued event.

## COPPA

Isopix is used by kids. Under the FTC's COPPA rule a persistent identifier is
personal information, but it may be collected without a parent's consent when
it is used only to support the site's internal operations (here: deciding what
to improve), the privacy notice says so, and it is kept no longer than needed.
So the device code is one plain random code that never changes (the owner,
2026-10-16: "do away with the cleverness … keep it simple"; a rotating code is
still an identifier), the telemetry runner removes the code
from every kept copy a year on (its `ids` for this job), no location is recorded, only the time zone's offset (2026-10-16: the events carry
no country; the owner chose country-only in every app, a city or street counts
as personal), and the shared privacy policy (https://privacy.pdxfixit.com/isopix/,
its text is `docs/privacy-policy.md` here, sent to pdxfixit/privacy by `just policy`) says all of it. Settings has
no note of its own, only the switch and the policy's link, so every app says it
the same way (the owner, 2026-10-16). Change the policy in the same change as
anything that changes what is sent. `test/telemetry.test.mjs` fails when the
link goes missing or a note comes back, or when the visit beacon returns. This is the building agent's reading, not legal
advice.

## Usage events (the shared standard)

Isopix records **events**, one record per thing that happened, in the
shape every app shares (the standard in pdxfixit/telemetry, Arrow-Rama
backlog #151). `web/events.js` keeps only each event's listed keys and hands
it to flarepress's shared client (`web/events-client.js`, vendored: never
edit it here; update it with flarepress's `just events-vendor --client web
--worker worker`, and `test/telemetry.test.mjs` fails on a hand edit). The
client fills in the columns below, queues in memory and localStorage
(`events:isopix:<session>`, at most 1000 records), and sends batches of JSON
lines to `POST /api/events` every 60 s and when the page is hidden. The
Worker (`worker/events-worker.js`, vendored) writes each batch as it came to
the R2 bucket `isopix-telemetry` (binding `EVENTS`, `site/wrangler.toml`)
under `v1/<day>/<batch>.jsonl`; the telemetry runner's job reads and empties
it. It sends only from https://isopix.app and never from automated browsers.
With the switch off nothing is recorded and the queue is emptied.

| Column | Isopix |
|---|---|
| `app`, `platform` | `isopix`, `web` |
| `form` | `phone`, `tablet` or `desktop`, from the screen size and whether the main pointer is a finger |
| `version` | `version.js` |
| `player` | the device code: one random 12-hex code kept in localStorage (`playerId()` and `deviceCode` in `web/events.js`) |
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
| `control.use` | the one document click listener in `events.js`; keyboard shortcuts (`group: keys`) | `control` (id, `tool-…`, `pick-…`, `swatch`), `group` (`topleft`, `topright`, `levels`, `zoom`, `palette`, `tools`, `selbar`, `popover`, a sheet …), `layout` (`levels`: `rail` or `top`; `palette` and `tools`: `stacked` or `row`; `zoom`: `track` or `buttons`; else `narrow` or `wide`), `vw`, `vh`, `input` (`touch`, `mouse`, `pen`, `key`). **No coordinates.** |
| `setting.change` | `set(k, v)` in `app.js` | `key`, `from`, `to`; a slider's run folds into one record; colors and the symmetry center are never recorded; a lesson's own picks are not counted |
| `content.start`, `finish`, `abandon` | a drawing: page load, New, Open (start), Save (finish), New/Open over unsaved work or closing the page with it (abandon); a lesson: Start, last step, Stop / another lesson / closing | `kind` (`drawing`, `lesson`), `item` (the lesson), `resumed`, `ms`, `why` (`replaced`, `left`, `stopped`, `switched`) |
| `error` | `error`, `unhandledrejection` (20 a page load) | `kind`, `where` (`file:line`), `fatal` (before the controls work) |
| `perf.load` | the controls work | `ms` from navigation start, `cold` (no service worker yet) |
| `perf.longtask` | `PerformanceObserver`, summed when the page is put away | `n`, `ms` |
| `isopix.save`, `isopix.strokes`, `isopix.move_arrived` | what a save did; strokes by input (and the drawing's size bucket) per sitting; a drawing carried from an old address | |

`test/events.test.mjs` fails on an event or key not in `EVENTS`, a listed
event nothing sends, a new write to `app.settings` that skips `set()`, or a
coordinate; `just look events` (in CI) checks the real page.

## Adding an event

Most new buttons are recorded with no code: a click on a button with an id is a
`control.use`, and a setting written through `set()` in `app.js` is a
`setting.change`. Something else needs its event and keys in `EVENTS`
(`web/events.js`), the shared list in pdxfixit/telemetry `events.toml`, this
page and the shared privacy policy; `test/events.test.mjs` says which one is
missing.
