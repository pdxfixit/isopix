# Stamp takes waiting on the owner

Other drawings made in the 2026-10-19 art pass, kept so one can replace the shipped stamp if the owner picks it (docs/decisions.md, "The box stamps, redrawn richer in 3D"). Each is a model entry for `web/engine/models/vehicles.js` (it uses that file's `wheel` and `banded` helpers): to ship one, put it in place of the entry of the same stamp (renamed from `rocket-alt` to `rocket`, or `planet-gap` to `planet`), then `just stamps` and `just test`.

## Rocket: the Starship on Super Heavy take

The shipped Rocket is the Falcon 9 take. Owner: "could look more like falcon/superheavy, but I like these colors also".

```js
  'rocket-alt': () => [
    // A Starship on its Super Heavy booster: grid fins at the booster's top, a hot-staging ring, flaps fore and aft on the ship.
    ...hbox([1, 1, 0], [1, 1, 1], ORANGE), ...hbox([0, 0, 1], [3, 3, 1], STONE), // the flame, the engines
    ...hbox([1, -1, 11], [1, 1, 1], INK), ...hbox([-1, 1, 11], [1, 1, 1], INK), // grid fins behind
    ...hbox([0, -1, 13], [3, 1, 3], RED), ...hbox([1, -1, 19], [1, 1, 2], RED), // the far flaps
    ...hbox([0, 0, 2], [3, 3, 10], WHITE), // the booster
    ...hbox([0, 0, 12], [3, 3, 1], INK), // the hot-staging ring
    ...hbox([0, 0, 13], [3, 3, 8], WHITE), // the ship
    ...hbox([0, 0, 21], [3, 3, 1], RED), ...hbox([1, 1, 22], [1, 1, 1], RED), // the nose
    ...hbox([3, 1, 11], [1, 1, 1], INK), ...hbox([1, 3, 11], [1, 1, 1], INK),
    ...hbox([0, 3, 13], [3, 1, 3], RED), ...hbox([1, 3, 19], [1, 1, 2], RED), // the near flaps
  ],
```

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
