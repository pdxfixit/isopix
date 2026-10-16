// The isopix.app Worker (site/wrangler.toml: main and the ASSETS binding).
// Static files are served by Workers Static Assets before this runs; it sees
// only paths no file matches.
//
// POST /api/events: usage events in the shared standard (web/events.js),
// written as they came to the R2 bucket `isopix-telemetry` (binding EVENTS)
// by flarepress's shared route (events-worker.js, vendored): never parsed,
// never the IP. The telemetry runner's job reads and empties the bucket.
// Anything else goes to the static files. That includes POST /api/visit, the
// retired per-visit beacon (2026-10-16): a tab still running the old page gets
// the static files' answer, which its beacon never reads.

import { HOST } from '../web/events.js';
import { handleEvents } from './events-worker.js';

export const ORIGIN = `https://${HOST}`;
export const EVENTS_PATH = '/api/events';
export const EVENTS_OPTS = { bucket: 'EVENTS', origins: [ORIGIN] };

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === EVENTS_PATH) {
      // The deploy's own checks run headless Chrome on the live site: nothing of theirs is kept.
      if (request.method === 'POST' && /HeadlessChrome/.test(request.headers.get('User-Agent') || '')) return new Response(null, { status: 204, headers: { 'Cache-Control': 'no-store' } });
      return handleEvents(request, env, EVENTS_OPTS);
    }
    return env.ASSETS.fetch(request);
  },
};
