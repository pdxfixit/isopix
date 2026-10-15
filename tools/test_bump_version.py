"""Unit tests for the semver stamp rule in tools/bump_version.py (run by `just test`)."""
import unittest

import bump_version as bv


class Bumped(unittest.TestCase):
    def test_patch_is_the_next_commit_count(self):
        self.assertEqual(bv.bumped("1.0.7", "patch", 12), "1.0.13")

    def test_minor_and_major(self):
        self.assertEqual(bv.bumped("1.0.7", "minor", 12), "1.1.13")
        self.assertEqual(bv.bumped("1.4.7", "major", 12), "2.0.13")

    def test_a_date_stamp_starts_at_1_0(self):
        self.assertEqual(bv.bumped("2026.10.13-2", "patch", 0), "1.0.1")

    def test_bumping_twice_before_committing_gives_the_same_stamp(self):
        self.assertEqual(bv.bumped(bv.bumped("1.0.3", "patch", 5), "patch", 5), "1.0.6")


class Staged(unittest.TestCase):
    def test_the_stamp_matches_the_commit_being_made(self):
        self.assertIsNone(bv.staged_problem("1.2.19", 18))

    def test_a_commit_landed_since_just_version(self):
        # 2026-10-15: bumped at 18 commits, then a docs commit, then the release.
        self.assertIn("PATCH must be 19", bv.staged_problem("1.2.18", 18))

    def test_a_merge_may_keep_either_parents_stamp(self):
        self.assertIsNone(bv.staged_problem("1.2.22", 26, ("1.2.20", "1.2.22")))
        self.assertIn("PATCH must be 27", bv.staged_problem("1.2.23", 26, ("1.2.20", "1.2.22")))


if __name__ == "__main__":
    unittest.main()
