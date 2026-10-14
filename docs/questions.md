# Questions for the owner

Open questions for the owner, one card each. The owner answered cards 1 to 6 on 2026-10-12;
[decisions.md](decisions.md) has the answers.

## How this works

**Asking.** A question goes here when it is a real judgment call (how the app
looks or behaves, a tradeoff, anything that changes what users get) and it can
wait. Give the card the next number and a short title, then in a few plain
sentences: what is true now, the options (two or three), and your
recommendation with the reason. End it with an empty `**The owner:**` line. Commit it,
and tell the owner in chat that a card is waiting. A question that blocks the work
right now goes to the owner in chat instead, in the same shape (options and a
recommendation); he is often on his phone, so keep it short. Meanwhile, do the
approved work that does not depend on the answer. Do not guess on a real
ambiguity: one clear question beats a wrong build.

**Answering.** The owner types under **The owner:**, or answers in chat. The next agent:

1. Records the answer in [decisions.md](decisions.md) in the right section as
   Rule, Why and Since. The Why quotes his words: `Owner: "…"`. A rule his answer
   replaces is deleted, not annotated, and a *(default)* mark it settles is
   removed.
2. Deletes the card (keep the numbers going up; do not reuse one).
3. Adds any work he approved to [TODO.md](../TODO.md) "Agents do".
4. Commits all three together.

## 8. Where Move lives, and how it turns off

**Now** (built 2026-10-14, on branch `claude/ui-cleanup-usability-p711b2`): a
hand at the foot of the zoom rail (and `H`). While it is lit, one finger moves
the view and draws nothing; tapping any tool, the hand again or Esc turns it
off, and it is never remembered. Options:

1. **Keep it on the zoom rail** (recommended): it is a view control like zoom,
   and the tool row has no room for a seventh button at 320 px.
2. **Put it in the tool row** as a sixth tool, moving the brush-shape button
   into a long-press on the Pencil. Easier to find; a bigger change.
3. **Hold to move**: Move works only while the hand is held down, like Space on
   a keyboard. No mode to forget, but it needs two hands on a phone.

**The owner:**

## 9. How Save behaves on each device

**Now** (built 2026-10-14): Chrome and Edge on a computer show their Save
dialog the first time, then Save writes that same file with no dialog (Save as
new file picks another). iPhone and iPad open the share sheet (Save to Files).
Everything else downloads, as before. A dot on Save marks changes not in a
file. Options:

1. **Keep it** (recommended): a real "Save" on computers, and the only reliable
   way on iPhone and iPad.
2. **Downloads everywhere except iPhone and iPad**, as before on computers: no
   dialog, but each Save adds another `name (1).isopix.json` to Downloads.
3. **Drop the dot**: less to look at, but no sign that the work is only in the
   browser.

**The owner:**

## 10. Which release items next

[release-plan.md](release-plan.md) lists every idea from the 2026-10-14
usability pass, in a recommended order, with sizes. Recommended first: several
drawings in the browser (a gallery), since New replacing the only drawing is
the biggest way a new user loses work; then pen mode for tablets, and
two-finger-tap undo. Pick any, in any order.

**The owner:**
