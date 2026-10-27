import hashlib
import unittest

import names_secret as n


def sha(s):
    return hashlib.sha256(s.encode()).hexdigest()


class NamesSecret(unittest.TestCase):
    def test_build_on_made_up_names(self):
        doc = n.build(['Pip', 'JUNO'], ['Wren'], ['Toby-Smith', 'Pipsqueak'])
        self.assertEqual(doc['anyCase'], [sha('pip'), sha('juno')])
        self.assertEqual(doc['exact'], [sha('Wren')])
        self.assertEqual(doc['inside'], [
            {'length': 9, 'hashes': [sha('pipsqueak')]},
            {'length': 10, 'hashes': [sha('toby-smith')]},
        ])

    def test_rebuilds_from_the_old_test_file(self):
        old = f"""const WORD_ANY_CASE = new Set([
  '{sha('a')}',
  '{sha('b')}',
]);
const WORD_EXACT = new Set(['{sha('C')}']);
const INSIDE_WORD = {{ length: 8, hashes: new Set(['{sha('dddddddd')}']) }};
"""
        self.assertEqual(n.from_old_test(old), {
            'anyCase': [sha('a'), sha('b')], 'exact': [sha('C')],
            'inside': [{'length': 8, 'hashes': [sha('dddddddd')]}],
        })
        with self.assertRaises(SystemExit):
            n.from_old_test('nothing here')


if __name__ == '__main__':
    unittest.main()
