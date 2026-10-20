# Stamp takes waiting on the owner

Other drawings made in the 2026-10-19 art pass, kept so one can replace the shipped stamp if the owner picks it (docs/decisions.md, "The box stamps, redrawn richer in 3D"). It is a model entry for `web/engine/models/vehicles.js`, with its detail by size (it uses that file's helpers): to ship it, put it in place of the `planet` entry, renamed from `planet-gap`, then `just stamps` and `just test`. (The Starship rocket take was dropped: owner, "Drop the starship flavored one".)

## Planet: the ring apart

The shipped Planet has its ring touching the ball. Owner: "if there was a way to have a visible space between ring + planet, that'd be fun to see in a followup mockup".

```js
  'planet-gap': () => [
    ...hbox([-2, -2, 4], [11, 1, 1], SAND), ...hbox([-2, -1, 4], [1, 9, 1], SAND), // the ring behind, a gap from the ball
    ...hbox([2, 2, 0], [3, 3, 1], PLANET), ...hbox([1, 1, 1], [5, 5, 1], PLANET),
    ...[[[1, 0, 2], [5, 1, 5]], [[0, 1, 2], [7, 5, 5]], [[1, 6, 2], [5, 1, 5]]].flatMap(([o, sz]) => banded(o, sz, PLANET, [6, 7], VIOLET)),
    ...hbox([1, 1, 7], [5, 5, 1], PLANET), ...hbox([2, 2, 8], [3, 3, 1], PLANET),
    ...hbox([8, -1, 4], [1, 9, 1], SAND), ...hbox([-2, 8, 4], [11, 1, 1], SAND), // and in front
  ],
```
