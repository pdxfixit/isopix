# Questions for the owner

Open questions for the owner, one card each. The owner answered cards 1 to 6 on 2026-10-12, 7 the same day, 8 to 10 on 2026-10-15, and 12 and 13 on 2026-10-16, and 14 on 2026-10-19;
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

## 15. A search box in Stamps?

Now: 86 starter stamps in eleven folding sections, plus Mine. A search box on
top would filter every stamp by name. Asked 2026-10-19; the owner: "maybe.
size is a huge consideration".

- **A. Not yet** (recommended): sections are enough at this count; revisit
  past about 150 stamps. Costs nothing.
- **B. A search box now**: a text field and a filter over names, about 1 KB
  of code; little use to a child who cannot read yet.

A, because the sections hold 86 comfortably and the owner weighs size.

**The owner:**

## 16. Stamps you size by dragging, and turn: three choices

The whole picture, with the prototype's findings, is
[spec-stamp-size-turn.md](spec-stamp-size-turn.md). In short: whole-number
sizes (1×, 2×, 3×…) are exact for every stamp and need no new art; 1½× comes
out saw-toothed; bigger box art is the same picture, not more detail.

1. **How you size it.**
   - **A. Drag to size**, like Drag a face: quick, but the stamp lands where the
     finger first touched (no more slide-to-aim), and the drag's direction
     would also turn it.
   - **B. Place, then adjust** (recommended): place as today; the stamp stays
     live with a size handle and a stamp bar (− 3× +, Spin or Turn, Flip,
     Done) until the next tap or tool.
   - **C. Choose before placing**, a size row in the Stamps drawer.
2. **What "turn" means.** **Spin** a 3D stamp to face four ways, **lay a flat
   picture on a plane** (floor, left wall, right wall), or both (recommended,
   planes first: cheaper, and closest to "like drawing a face/plane").
3. **High-def.** **H1** (recommended now): the dozen stamps drawn from a
   formula (Flower, Sun, Smiley, sacred geometry…) get rounder when bigger.
   **H2** (later): new, finer art for a few favorites first, shown from 3× up.

B, both turns with planes first, and H1, built in that order: size (about
3–4 hours of agent time), planes and rounder curves (about 3), spin (about
4–6). Each ships on its own.

**The owner:**
