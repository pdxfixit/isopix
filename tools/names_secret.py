#!/usr/bin/env python3
"""Make the value of the names-hash secret (stdlib only).

test/names.test.mjs checks that no file, path or commit message names the
owner or his family. It holds no names and no hashes: an unsalted SHA-256 of a
first name falls to a word list in seconds, and this repo is public. The
hashes live outside it, as one JSON document:

  - the GitHub secret ISOPIX_NAME_HASHES (CI reads it), and
  - ~/.config/isopix/names.json on the owner's Mac (the same text).

This tool prints that JSON for names typed here, on the owner's own machine.
Agents never run it with real names and never print its output.

  names_secret.py --any NAME…      matched in any case, as a whole word
  names_secret.py --exact NAME…    matched as written only (a name that is also an everyday word in code, matched only when capitalized)
  names_secret.py --inside NAME…   matched anywhere inside a longer word too (a surname inside a domain)
  names_secret.py --from-commit SHA   rebuild the lists from the hashes test/names.test.mjs held at SHA (the old test),
                                      so nobody retypes the names
"""
import argparse
import hashlib
import json
import re
import subprocess
import sys


def sha(text):
    return hashlib.sha256(text.encode()).hexdigest()


def build(any_case=(), exact=(), inside=()):
    """The JSON document for these names. Pure: the tests run it on made-up names."""
    by_length = {}
    for name in inside:
        by_length.setdefault(len(name), []).append(sha(name.lower()))
    return {
        'anyCase': [sha(n.lower()) for n in any_case],
        'exact': [sha(n) for n in exact],
        'inside': [{'length': n, 'hashes': h} for n, h in sorted(by_length.items())],
    }


def from_old_test(source):
    """The same document from the text of the old test/names.test.mjs, which held the hashes in three sets."""
    def hashes(block):
        return re.findall(r"'([0-9a-f]{64})'", block)
    any_case = re.search(r'WORD_ANY_CASE = new Set\(\[(.*?)\]\)', source, re.S)
    exact = re.search(r'WORD_EXACT = new Set\(\[(.*?)\]\)', source, re.S)
    inside = re.search(r'INSIDE_WORD = \{ length: (\d+), hashes: new Set\(\[(.*?)\]\)', source, re.S)
    if not (any_case and exact and inside):
        raise SystemExit('that commit\'s test/names.test.mjs does not hold the three hash sets')
    return {
        'anyCase': hashes(any_case.group(1)),
        'exact': hashes(exact.group(1)),
        'inside': [{'length': int(inside.group(1)), 'hashes': hashes(inside.group(2))}],
    }


def main(argv):
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument('--any', nargs='*', default=[], dest='any_case')
    p.add_argument('--exact', nargs='*', default=[])
    p.add_argument('--inside', nargs='*', default=[])
    p.add_argument('--from-commit', metavar='SHA')
    a = p.parse_args(argv)
    if a.from_commit:
        source = subprocess.run(['git', 'show', f'{a.from_commit}:test/names.test.mjs'], check=True, capture_output=True, text=True).stdout
        doc = from_old_test(source)
    else:
        doc = build(a.any_case, a.exact, a.inside)
    print(json.dumps(doc, separators=(',', ':')))


if __name__ == '__main__':
    main(sys.argv[1:])
