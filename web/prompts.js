// Drawing ideas for "Need an idea?" on the Drawings sheet: kid-safe things
// that build well from cubes, faces and triangles. Shown only when asked,
// never over a drawing in progress (owner, 2026-10-16: "be careful not to
// interrupt a focused user"). Pure (test/prompts.test.mjs).

export const IDEAS = [
  'a castle with a tower', 'a robot', 'a rocket on its launch pad', 'a tiny town', 'a treehouse',
  'an island with a palm tree', 'a snowman', 'a pyramid of cubes', 'a rainbow staircase', 'a lighthouse',
  'your bedroom', 'a dragon', 'a race car', 'a cake with candles', 'a sailboat',
  'a fish tank', 'a bridge over a river', 'a spaceship', 'a garden with flowers', 'a train',
  'a giant ice cream cone', 'a cat in a box', 'a mountain with snow on top', 'a playground slide', 'a wizard tower',
  'a pirate ship', 'a hot air balloon', 'a mushroom house', 'a skyscraper', 'a dog house',
  'a farm with a barn', 'a cozy cabin', 'a maze', 'a volcano', 'a submarine',
  'a pizza', 'a game controller', 'a windmill', 'a beach with an umbrella', 'a monster truck',
  'a crystal cave', 'a block letter of your name', 'a bookshelf full of books', 'a campfire', 'a fort made of boxes',
  'a city at night (try dark paper)', 'a penguin on an iceberg', 'a robot dog',
];

// The next idea: random, never the one just shown.
export function nextIdea(rand = Math.random, last = null) {
  const pool = IDEAS.filter((i) => i !== last);
  return pool[Math.floor(rand() * pool.length) % pool.length];
}

// A drawing's name from an idea: "A treehouse", without the hint in brackets.
export function nameFor(idea) {
  const s = idea.replace(/\s*\(.*\)\s*$/, '').trim();
  return (s[0].toUpperCase() + s.slice(1)).slice(0, 80);
}
