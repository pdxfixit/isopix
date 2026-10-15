// Silly drawing names (web/sillynames.js): the word lists and the rolls.
import test from 'node:test';
import assert from 'node:assert/strict';
import { ADJECTIVES, NOUNS, sillyName } from '../web/sillynames.js';

test('each list has close to 100 single, capitalized, different words', () => {
  for (const [what, list] of [['adjectives', ADJECTIVES], ['nouns', NOUNS]]) {
    assert.ok(list.length >= 90 && list.length <= 100, `${list.length} ${what}`);
    assert.equal(new Set(list).size, list.length, `a repeated ${what.slice(0, -1)}`);
    for (const w of list) assert.match(w, /^[A-Z][a-z]+$/, `${what}: ${w}`);
  }
});

test('every adjective has at least two nouns with its first letter, so a roll can always match', () => {
  for (const a of ADJECTIVES) assert.ok(NOUNS.filter((n) => n[0] === a[0]).length >= 2, `${a} has no partner`);
});

test('a name is two words that start with the same letter', () => {
  for (let i = 0; i < 500; i++) {
    const [a, n, extra] = sillyName().split(' ');
    assert.equal(extra, undefined);
    assert.ok(ADJECTIVES.includes(a) && NOUNS.includes(n));
    assert.equal(a[0], n[0]);
  }
});

test('a roll never repeats the name it replaces, even when the dice say so', () => {
  // The first two draws would give the same name again; the roll draws again.
  const seq = [0, 0, 0, 0, 0.5, 0.5];
  const rand = () => seq.shift() ?? 0.99;
  const first = sillyName(() => 0);
  assert.equal(first, 'Amazing Acorn');
  assert.notEqual(sillyName(rand, first), first);
});

test('the edges of rand stay in the lists', () => {
  assert.equal(sillyName(() => 0), `${ADJECTIVES[0]} ${NOUNS.filter((n) => n[0] === ADJECTIVES[0][0])[0]}`);
  assert.ok(sillyName(() => 0.9999999).startsWith(ADJECTIVES.at(-1)));
});
