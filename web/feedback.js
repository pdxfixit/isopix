// Feedback (owner, 2026-10-19: "next to the version in about, there should be
// a feedback button (or similar) which opens a dialog to send the feedback").
// Pure: the grown-up check in front of it, and the one request it sends. The
// dialogs are web/ui/feedback.js; the Worker's route is worker/index.js
// (flarepress's handleFeedback, into the shared bucket `app-suggestions`).
//
// Only what someone types into the box, when they press Send. It is never put
// into a usage event (events.js), and the Worker stores no name or IP.

export const FEEDBACK_PATH = '/api/feedback';
export const MAX_CHARS = 2000; // the box's maxlength
export const MAX_BYTES = 4096; // what the Worker takes (UTF-8): 2000 characters of emoji or CJK can be more

// The grown-up check (owner: "agree"): a sum a young kid cannot do at a
// glance: 12–19 plus 6–9, always with a carry (13 + 9, never 11 + 6).
// rand() is Math.random or a stand-in.
export function gateQuestion(rand = Math.random) {
  const ones = 2 + Math.floor(rand() * 8), low = Math.max(6, 10 - ones);
  const a = 10 + ones, b = low + Math.floor(rand() * (10 - low));
  return { a, b, answer: a + b, text: `Grown-ups: what is ${a} + ${b}?` };
}
// Whether what was typed is the answer: digits only (spaces around are fine).
export function gateRight(question, typed) {
  const s = String(typed ?? '').trim();
  return /^\d{1,3}$/.test(s) && Number(s) === question.answer;
}

// The version the request names: the release stamp, or 'dev' when it is not
// one the Worker accepts (1–32 of A-Z a-z 0-9 . + _).
const VERSION = /^[0-9A-Za-z.+_]{1,32}$/;
export const appVersion = (v) => (typeof v === 'string' && VERSION.test(v) ? v : 'dev');

// Over what the Worker takes, counted as it is sent (UTF-8).
export const tooLong = (text) => new TextEncoder().encode(String(text ?? '')).length > MAX_BYTES;
// What Send may do: never with nothing in the box (spaces only count as
// nothing), never with more than the Worker takes, never twice at once.
export const canSend = (text, sending) => !sending && String(text ?? '').trim().length > 0 && !tooLong(text);

// The fetch arguments for one message. `id` is a UUID kept for every retry of
// the same text, so a retry overwrites instead of filing it twice.
export function feedbackRequest(text, id, version) {
  return [FEEDBACK_PATH, {
    method: 'POST',
    credentials: 'omit',
    headers: { 'content-type': 'text/plain;charset=UTF-8', 'x-feedback': id, 'x-app-version': appVersion(version) },
    body: text,
  }];
}

// One feedback box's sending: the id lives until a message gets through.
// fetch and uuid are the page's, or stand-ins in tests. send() resolves to
// 'sent' (204) or 'failed' (anything else, or no network).
export function createSender({ fetch, uuid, version }) {
  let id = null;
  return {
    get id() { return id; },
    async send(text) {
      id ??= uuid();
      let ok = false;
      try { ok = (await fetch(...feedbackRequest(text, id, version))).status === 204; } catch { /* offline: keep the id for the retry */ }
      if (ok) id = null; // the next message is a new one
      return ok ? 'sent' : 'failed';
    },
  };
}
