// The isopix.app Worker (site/wrangler.toml: main and the ASSETS binding).
// Static files are served by Workers Static Assets before this runs; it sees
// only paths no file matches.
//
// POST /api/events: usage events in the shared standard (web/events.js),
// written as they came to the R2 bucket `isopix-telemetry` (binding EVENTS)
// by flarepress's shared route (events-worker.js, vendored): never parsed,
// never the IP. The telemetry runner's job reads and empties the bucket.
// POST /api/feedback: what someone typed into Settings → About → Feedback
// (web/ui/feedback.js), behind the grown-up check, by flarepress's shared
// handleFeedback (same file): plain text into the bucket every app's feedback
// shares, `app-suggestions` (binding FEEDBACK), under
// v1/isopix/<day>/<version>-<id>.txt; never parsed, never the IP, rate-limited
// for the whole box (FEEDBACK_LIMITER, keyed by the app, not the sender). The
// telemetry runner copies each one to the owner's notes and deletes it; kept
// 90 days at most (owner: "90d?").
// Anything else goes to the static files. That includes POST /api/visit, the
// retired per-visit beacon (2026-10-16): a tab still running the old page gets
// the static files' answer, which its beacon never reads.

import { HOST } from '../web/events.js';
import { handleEvents, handleFeedback } from './events-worker.js';

export const ORIGIN = `https://${HOST}`;
export const EVENTS_PATH = '/api/events';
export const EVENTS_OPTS = { bucket: 'EVENTS', origins: [ORIGIN] };
export const FEEDBACK_PATH = '/api/feedback';
export const FEEDBACK_OPTS = { bucket: 'FEEDBACK', app: 'isopix', origins: [ORIGIN], limiter: 'FEEDBACK_LIMITER' };

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === EVENTS_PATH) {
      // The deploy's own checks run headless Chrome on the live site: nothing of theirs is kept.
      if (request.method === 'POST' && /HeadlessChrome/.test(request.headers.get('User-Agent') || '')) return new Response(null, { status: 204, headers: { 'Cache-Control': 'no-store' } });
      return handleEvents(request, env, EVENTS_OPTS);
    }
    // Feedback is typed by a person: no shortcut for headless checks, which never send any.
    if (url.pathname === FEEDBACK_PATH) return handleFeedback(request, env, FEEDBACK_OPTS);
    return env.ASSETS.fetch(request);
  },
};
