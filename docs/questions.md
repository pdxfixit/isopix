# Questions for the owner

Open questions for the owner, one card each. The owner answered cards 1 to 6 on 2026-10-12, 7 the same day, 8 to 10 on 2026-10-15, and 12 and 13 on 2026-10-16;
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

## 14. Resize a stamp after placing it?

Now: a stamp's size is the grid size when it is tapped; once placed it cannot
be made bigger or smaller (asked 2026-10-19: "can stamps be resized on the
board"). The way round it is Select, Save as stamp, change the grid size,
place again, erase the old one.

- **A. Bigger and Smaller on the selection bar** (recommended): doubles or
  halves what is selected, about its bottom vertex, in one undo step. Exact,
  because one level maps onto the next; Smaller merges four cells into one,
  so the finest detail blends or snaps like Coarser does.
- **B. Pick the size in the Stamps drawer**: a size chip (S, M, L) beside the
  tiles, separate from the grid size. Simple for kids, but a second notion of
  size next to the grid size.
- **C. Leave it**: the grid size is the size; teach it in the Stamps lesson.

A, because it works on anything selected, not only stamps, and keeps one
meaning of size.

**The owner:**
