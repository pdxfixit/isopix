"""The daily live check's rules, with a fake network and clock (tools/live_check.py)."""
import unittest

import live_check as lc

GOOD = {"/": 200, "/manifest.webmanifest": 200, "/sw.js": 200}


class Decide(unittest.TestCase):
    def test_every_page_200_passes(self):
        ok, lines = lc.decide(GOOD)
        self.assertTrue(ok)
        self.assertEqual(lines, ["✅ / 200", "✅ /manifest.webmanifest 200", "✅ /sw.js 200"])

    def test_site_down_or_broken_fails(self):
        ok, lines = lc.decide({**GOOD, "/": 0})
        self.assertFalse(ok)
        self.assertIn("❌ / answered 0", lines[0])
        ok, _ = lc.decide({**GOOD, "/sw.js": 503})
        self.assertFalse(ok)


class Retries(unittest.TestCase):
    def test_a_flaky_page_is_retried_and_passes(self):
        calls, sleeps = [], []
        answers = {"/": [503, 200]}

        def fetch(p):
            calls.append(p)
            seq = answers.get(p)
            return (seq.pop(0) if seq else 200), ""

        out = lc.check_pages(fetch, sleeps.append)
        self.assertEqual(out, GOOD)
        self.assertEqual(sleeps, [20])
        self.assertEqual(calls.count("/"), 2)
        self.assertEqual(calls.count("/sw.js"), 1, "pages that answered are not asked again")

    def test_a_down_site_is_tried_four_times_then_fails(self):
        sleeps = []
        out = lc.check_pages(lambda p: (0, ""), sleeps.append)
        self.assertEqual(sleeps, [20, 20, 20])
        ok, _ = lc.decide(out)
        self.assertFalse(ok)


if __name__ == "__main__":
    unittest.main()
