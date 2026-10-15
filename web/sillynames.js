// Silly names for new drawings: two words that start with the same letter,
// "Bouncy Badger" (the owner chose this over any-letter pairs and three
// words, 2026-10-15, with "closer to 100" words a side). New and the very
// first drawing roll one; 🎲 in the Drawing sheet rolls another. Pure, so
// test/sillynames.test.mjs can check the lists and the rolls.
//
// Words are kid-safe: no people's names, nothing about bodies, nothing mean.

export const ADJECTIVES = [
  'Amazing', 'Artsy', 'Awesome',
  'Bashful', 'Bouncy', 'Brave', 'Breezy', 'Bubbly',
  'Cheeky', 'Chirpy', 'Cosmic', 'Crispy', 'Crunchy', 'Cuddly', 'Curious',
  'Dapper', 'Dazzling', 'Dizzy', 'Dreamy',
  'Eager', 'Epic',
  'Fancy', 'Feisty', 'Fizzy', 'Fluffy', 'Frosty', 'Funky', 'Fuzzy',
  'Gentle', 'Giggly', 'Glittery', 'Goofy', 'Groovy', 'Grumpy',
  'Happy', 'Hoppy', 'Hungry',
  'Jazzy', 'Jiggly', 'Jolly', 'Jumbo', 'Jumpy',
  'Kind', 'Kooky',
  'Lively', 'Loopy', 'Lucky',
  'Magic', 'Mellow', 'Merry', 'Mighty', 'Misty',
  'Nifty', 'Nimble', 'Noisy', 'Nutty',
  'Perky', 'Peppy', 'Plucky', 'Prickly', 'Puffy',
  'Quick', 'Quiet', 'Quirky',
  'Rosy', 'Rowdy', 'Royal', 'Rusty',
  'Silly', 'Sleepy', 'Snazzy', 'Sneaky', 'Sparkly', 'Speedy', 'Spotty', 'Squishy', 'Sticky', 'Swirly',
  'Tangy', 'Ticklish', 'Tiny', 'Toasty', 'Twirly',
  'Velvety', 'Vivid',
  'Wacky', 'Wiggly', 'Wise', 'Witty', 'Wobbly', 'Wonky', 'Woolly',
  'Yummy',
  'Zany', 'Zesty', 'Zippy',
];

export const NOUNS = [
  'Acorn', 'Alpaca', 'Armadillo', 'Astronaut',
  'Badger', 'Bagel', 'Banana', 'Beetle', 'Biscuit', 'Bunny', 'Button',
  'Cactus', 'Coconut', 'Comet', 'Crayon', 'Cricket', 'Cupcake',
  'Dinosaur', 'Dolphin', 'Donut', 'Dragon', 'Dumpling',
  'Eggplant', 'Elephant',
  'Ferret', 'Flamingo', 'Frog',
  'Gecko', 'Giraffe', 'Goblin', 'Gumdrop',
  'Hamster', 'Hedgehog', 'Hippo', 'Honeybee',
  'Jaguar', 'Jellybean', 'Jellyfish',
  'Kazoo', 'Kitten', 'Koala',
  'Lemon', 'Lizard', 'Llama', 'Lobster', 'Lollipop',
  'Mango', 'Marshmallow', 'Meatball', 'Meerkat', 'Moose', 'Muffin',
  'Nacho', 'Narwhal', 'Noodle', 'Nugget',
  'Pancake', 'Penguin', 'Pickle', 'Platypus', 'Pretzel', 'Puffin', 'Pumpkin',
  'Quail', 'Quokka',
  'Raccoon', 'Radish', 'Rhino', 'Robot', 'Rocket',
  'Sandwich', 'Sloth', 'Snail', 'Sprout', 'Squid', 'Squirrel', 'Starfish',
  'Taco', 'Tadpole', 'Teapot', 'Toaster', 'Toucan', 'Turnip', 'Turtle',
  'Vole', 'Volcano',
  'Waffle', 'Walrus', 'Wizard', 'Wombat',
  'Yak', 'Yeti', 'Yoyo',
  'Zebra', 'Zeppelin', 'Zucchini',
];

const pick = (list, rand) => list[Math.min(list.length - 1, Math.floor(rand() * list.length))];

// A silly name, never the same as `last` (so 🎲 always changes it).
// rand() gives [0, 1), like Math.random.
export function sillyName(rand = Math.random, last = '') {
  for (;;) {
    const a = pick(ADJECTIVES, rand);
    const name = `${a} ${pick(NOUNS.filter((n) => n[0] === a[0]), rand)}`;
    if (name !== last) return name;
  }
}
