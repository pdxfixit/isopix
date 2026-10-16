# Questions for the owner

Open questions for the owner, one card each. The owner answered cards 1 to 6 on 2026-10-12, 7 the same day, and 8 to 10 on 2026-10-15;
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

## 12. Light direction for auto-shade

Today auto-shade lights a cube from the upper left: the top face is lightest,
the left face is the color picked, the right face is darkest. Each cell stores
its shaded color, so a change applies to new strokes only. The owner finds this
of little importance but is open to it if people want it.

- **(a) Leave it as is.** Nothing to learn, nothing to clutter.
- **(b) "Light from: Left / Right" in Settings → Drawing,** saved with each
  drawing so one drawing stays consistent. Right swaps the left and right
  tones. The palette's three-tone chip shows the result. S.
- **(c) As (b), plus a Relight button on the selection bar** that re-shades
  the selected cells. It works from the stored face tags; the base color can be
  recovered from the tone except where a very light or very dark color was
  clipped, so a few cells would shift slightly. M.

Recommendation: (a) for now, and (b) if anyone asks for it. (b) is cheap and
safe; (c) is the version that teaches light, but its clipping edge case is not
worth building before anyone wants it.

**The owner:**
