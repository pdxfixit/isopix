"""The daily live check's rules, with a fake network and clock (tools/live_check.py)."""
import unittest

import live_check as lc

GOOD = {"/": 200, "/manifest.webmanifest": 200, "/sw.js": 200}


class Decide(unittest.TestCase):
    def test_live_equals_main(self):
        ok, lines, notice = lc.decide(GOOD, "1.0.4", "1.0.4", 10 * 86400)
        self.assertTrue(ok)
        self.assertIsNone(notice)

    def test_behind_by_ten_minutes_passes_with_a_notice(self):
        ok, lines, notice = lc.decide(GOOD, "1.0.3", "1.0.4", 10 * 60)
        self.assertTrue(ok)
        self.assertIn("deploy in flight, live is behind main by 10 min", notice)

    def test_behind_by_two_hours_fails_naming_both_and_the_age(self):
        ok, lines, notice = lc.decide(GOOD, "1.0.3", "1.0.4", 2 * 3600)
        self.assertFalse(ok)
        bad = [l for l in lines if l.startswith("❌")][0]
        self.assertIn("1.0.3", bad)
        self.assertIn("1.0.4", bad)
        self.assertIn("120 min", bad)

    def test_site_down_fails_even_when_versions_match(self):
        ok, lines, _ = lc.decide({**GOOD, "/": 0}, "x", "x", 0)
        self.assertFalse(ok)
        ok, _, _ = lc.decide({**GOOD, "/sw.js": 503}, "x", "y", 60)  # the grace never covers a broken site
        self.assertFalse(ok)

    def test_stamp_reads_version_js(self):
        self.assertEqual(lc.stamp("self.ISOPIX_VERSION = '1.0.4';"), "1.0.4")
        self.assertIsNone(lc.stamp("<html>not found</html>"))


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
        ok, _, _ = lc.decide(out, "x", "x", 0)
        self.assertFalse(ok)


if __name__ == "__main__":
    unittest.main()
