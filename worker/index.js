// The isopix.app Worker (site/wrangler.toml: main, the ASSETS binding and D1
// database `isopix` as DB). Static files are served by Workers
// Static Assets before this runs; it sees only paths no file matches.
//
// POST /api/visit: one visit's usage counts (web/telemetry.js), checked with
// the app's own cleanVisit, given the country Cloudflare read from the
// request, and kept in D1's `visits` table (worker/schema.sql) for 90
// days. The IP address is never read. A visit sends its whole tally each time
// the page is hidden, so the row is replaced, never added to. Every answer is
// 204 unless the request is plainly wrong; a database error is swallowed.
// POST /api/events: usage events in the shared standard (web/events.js),
// written as they came to the R2 bucket `isopix-telemetry` (binding EVENTS)
// by flarepress's shared route (events-worker.js, vendored): never parsed,
// never the IP. The telemetry runner's job reads and empties the bucket.
// Anything else goes to the static files (their 404).

import { cleanVisit, ENDPOINT, HOST, MAX_BYTES, ROTATE_MS } from '../web/telemetry.js';
import { handleEvents } from './events-worker.js';

export const ORIGIN = `https://${HOST}`;
export const EVENTS_PATH = '/api/events';
export const EVENTS_OPTS = { bucket: 'EVENTS', origins: [`https://${HOST}`] };
export const KEEP_MS = ROTATE_MS; // 90 days, the same as the device code's life
// One visit in this many also deletes rows past KEEP_MS: nothing scheduled.
export const SWEEP_EVERY = 50;

const reply = (status, text = '') => new Response(text ? `${text}\n` : null, { status, headers: { 'Cache-Control': 'no-store', 'Content-Type': 'text/plain; charset=utf-8' } });

// Cloudflare's guess of where a request came from: the country only, in
// every app (the owner, 2026-10-16; COPPA treats a street or a city as personal).
export function placeOf(request) {
  const cf = request.cf || {};
  return { country: typeof cf.country === 'string' && /^[A-Z0-9]{1,2}$/.test(cf.country) ? cf.country : null };
}

// Reads at most `max` bytes of the body, or null when it is longer.
async function readCapped(request, max) {
  const len = Number(request.headers.get('Content-Length'));
  if (len > max) return null;
  const text = await request.text();
  return new TextEncoder().encode(text).length > max ? null : text;
}

export const UPSERT = `INSERT INTO visits (visit, device, first_seen, last_seen, day, app, country, width, touch, pwa, dark, reduced, lang, since, seconds, cells, longtasks, counts, errors)
VALUES (?1, ?2, ?3, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16, ?17, ?18)
ON CONFLICT (visit) DO UPDATE SET last_seen = ?3, seconds = ?14, cells = ?15, longtasks = ?16, counts = ?17, errors = ?18
WHERE visits.device = ?2`;

export async function handleVisit(request, env, ctx, now = Date.now()) {
  if (request.method !== 'POST') return new Response('Use POST\n', { status: 405, headers: { Allow: 'POST', 'Cache-Control': 'no-store' } });
  if (request.headers.get('Origin') !== ORIGIN) return reply(403, 'Wrong origin');
  if (/HeadlessChrome/.test(request.headers.get('User-Agent') || '')) return reply(204); // the deploy's own checks
  const type = (request.headers.get('Content-Type') || '').split(';')[0].trim().toLowerCase();
  if (type !== 'text/plain' && type !== 'application/json') return reply(415, 'Send JSON');
  const text = await readCapped(request, MAX_BYTES);
  if (text === null) return reply(413, 'Too big');
  let body;
  try { body = JSON.parse(text); } catch { return reply(400, 'Not JSON'); }
  const r = cleanVisit(body);
  if (!r.ok) return reply(400, `Not a visit: ${r.why}`);
  if (!env.DB) return reply(204);
  const v = r.visit, { country } = placeOf(request);
  const write = async () => {
    try {
      await env.DB.prepare(UPSERT).bind(
        v.visit, v.device, now, new Date(now).toISOString().slice(0, 10), v.app, country,
        v.width, v.touch, v.pwa, v.dark, v.reduced, v.lang, v.since, v.seconds, v.cells, v.longtasks,
        JSON.stringify(v.counts), JSON.stringify(v.errors),
      ).run();
      if (Math.random() * SWEEP_EVERY < 1) await env.DB.prepare('DELETE FROM visits WHERE last_seen < ?1').bind(now - KEEP_MS).run();
    } catch { /* a missing table or a busy database never fails a visit */ }
  };
  if (ctx?.waitUntil) ctx.waitUntil(write()); else await write();
  return reply(204);
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (url.pathname === ENDPOINT) return handleVisit(request, env, ctx);
    if (url.pathname === EVENTS_PATH) {
      // The deploy's own checks run headless Chrome on the live site: nothing of theirs is kept.
      if (request.method === 'POST' && /HeadlessChrome/.test(request.headers.get('User-Agent') || '')) return new Response(null, { status: 204, headers: { 'Cache-Control': 'no-store' } });
      return handleEvents(request, env, EVENTS_OPTS);
    }
    return env.ASSETS.fetch(request);
  },
};
