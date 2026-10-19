// Feedback, from Settings → About: the grown-up check, then the Feedback
// dialog (both modal <dialog>s, centered; Esc closes them). The pure parts
// (the sum, the request) are web/feedback.js. What is typed goes only to
// POST /api/feedback when Send is pressed, never into a usage event.

import { $ } from '../app.js';
import { gateQuestion, gateRight, canSend, tooLong, createSender } from '../feedback.js';
import { uuidV4 } from '../events.js';

let question = null;
let sending = false;
const sender = createSender({
  fetch: (...a) => fetch(...a),
  uuid: () => uuidV4(), // crypto.randomUUID where there is one
  version: self.ISOPIX_VERSION,
});

// Back to the button that opened it, whichever way the dialog closed.
const backToOpener = () => { const b = $('#feedback-open'); if (b && document.contains(b) && !$('#feedback').open && !$('#feedback-gate').open) b.focus({ preventScroll: true }); };

export function openGate() {
  question = gateQuestion();
  $('#gate-question').textContent = question.text;
  $('#gate-answer').value = '';
  $('#gate-wrong').hidden = true;
  $('#feedback-gate').returnValue = ''; // Esc keeps the last one; this open starts unanswered
  $('#feedback-gate').showModal();
  $('#gate-answer').focus();
}
function checkGate() {
  if (!question) return;
  if (!gateRight(question, $('#gate-answer').value)) {
    $('#gate-wrong').hidden = false;
    $('#gate-answer').select();
    return;
  }
  question = null;
  $('#feedback-gate').close('ok');
  openFeedback();
}

export function openFeedback() {
  $('#feedback-status').textContent = '';
  updateSend();
  $('#feedback').showModal();
  $('#feedback-text').focus();
}
function updateSend() { $('#feedback-send').disabled = !canSend($('#feedback-text').value, sending); }
async function send() {
  const box = $('#feedback-text');
  const text = box.value;
  if (!canSend(text, sending)) return;
  sending = true;
  updateSend();
  $('#feedback-status').textContent = 'Sending…';
  const result = await sender.send(text);
  sending = false;
  if (result === 'sent') {
    box.value = '';
    $('#feedback-status').textContent = 'Thanks! Sent. 💌';
  } else {
    $('#feedback-status').textContent = "Couldn't send. Please try again.";
  }
  updateSend();
}

export function wireFeedback() {
  $('#feedback-open').addEventListener('click', openGate);
  $('#gate-ok').addEventListener('click', checkGate);
  // Enter answers (a form's Enter would press its first button, Cancel).
  $('#gate-answer').addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); checkGate(); } });
  $('#gate-answer').addEventListener('input', () => { $('#gate-wrong').hidden = true; });
  $('#feedback-text').addEventListener('input', () => {
    if (!sending) $('#feedback-status').textContent = tooLong($('#feedback-text').value) ? 'That is a bit long. Please make it shorter.' : '';
    updateSend();
  });
  $('#feedback-send').addEventListener('click', send);
  // Closing the gate without the answer, or the Feedback dialog, gives focus back to the button.
  $('#feedback-gate').addEventListener('close', () => { if ($('#feedback-gate').returnValue !== 'ok') backToOpener(); });
  $('#feedback').addEventListener('close', backToOpener);
}
