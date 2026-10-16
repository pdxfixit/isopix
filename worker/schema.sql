-- Isopix's D1 database, `isopix` (binding DB on the isopix-app Worker): the
-- full schema. Every statement is IF NOT EXISTS, so running it again changes
-- nothing. Apply (the owner, from this repo): `D1_DATABASE_ID=<id>
-- ~/src/flarepress/tools/wrangler.sh site d1 execute isopix --remote --file ../worker/schema.sql`
-- (wrangler runs from site/). What each field means: docs/telemetry.md.
-- Times are milliseconds since 1970.
-- 2026-10-16: country only, no region (the owner). A database made before
-- keeps an empty `region` column; `ALTER TABLE visits DROP COLUMN region` removes it.

-- One row per visit (a page load), replaced as the visit sends its tally.
-- Kept 90 days (worker/index.js KEEP_MS); the harvest copies it to the Mac.
CREATE TABLE IF NOT EXISTS visits (
  visit      TEXT PRIMARY KEY,  -- random, one per page load
  device     TEXT NOT NULL,     -- random, made on the device, never changes
  first_seen INTEGER NOT NULL,
  last_seen  INTEGER NOT NULL,
  day        TEXT NOT NULL,     -- UTC date of the first send, YYYY-MM-DD
  app        TEXT,              -- release, e.g. 1.3.20
  country    TEXT,              -- ISO 3166 code, from Cloudflare
  width      INTEGER,           -- screen width, rounded down to a bucket
  touch      INTEGER,           -- 1: has a touch screen
  pwa        INTEGER,           -- 1: opened as an installed app
  dark       INTEGER,           -- 1: the device prefers dark mode
  reduced    INTEGER,           -- 1: the device asks for reduced motion
  lang       TEXT,              -- language, two or three letters
  since      TEXT,              -- time since this device first used Isopix: new week month quarter year older
  seconds    INTEGER,           -- how long the visit has lasted
  cells      TEXT,              -- drawing size bucket: 0 1-99 100-999 1k-10k 10k+
  longtasks  INTEGER,           -- main-thread tasks over 50 ms (Chrome only)
  counts     TEXT NOT NULL,     -- JSON {"tool:pencil": 3, ...}
  errors     TEXT NOT NULL      -- JSON ["TypeError app.js:120", ...], at most 5
);
CREATE INDEX IF NOT EXISTS visits_last_seen ON visits (last_seen);
CREATE INDEX IF NOT EXISTS visits_device ON visits (device);
