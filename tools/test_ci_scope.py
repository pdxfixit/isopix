"""Which pushes skip the browser checks (tools/ci_scope.py), with a fake git."""
import unittest

import ci_scope as cs

SHA = "a" * 40


def fake_git(paths, has_base=True, diff_ok=True):
    def git(args):
        if args[0] == "cat-file":
            return "" if has_base else None
        if args[0] == "diff":
            assert "--no-renames" in args, "a rename from web/ to docs/ must show both sides"
            return "\0".join(paths) + ("\0" if paths else "") if diff_ok else None
        raise AssertionError(args)
    return git


def browser(paths, **kw):
    return cs.decide(SHA, "HEAD", fake_git(paths, **kw))[0]


class Decide(unittest.TestCase):
    def test_docs_only_skips_the_browser_checks(self):
        self.assertFalse(browser(["docs/state.md"]))
        self.assertFalse(browser(["docs/state.md", "AGENTS.md", "TODO.md", "spec/README.md", "docs/stamps/cat.svg"]))

    def test_any_other_file_runs_everything(self):
        for other in ["web/app.js", "tools/look.mjs", "justfile", ".github/workflows/test.yml", "test/docs.test.mjs", "web/version.js"]:
            self.assertTrue(browser(["docs/state.md", other]), other)

    def test_markdown_that_ships_runs_everything(self):
        for shipped in ["web/notes.md", "worker/README.md", "site/README.md"]:
            self.assertTrue(browser([shipped]), shipped)

    def test_unsure_runs_everything(self):
        self.assertTrue(cs.decide(cs.ZERO, "HEAD", fake_git(["docs/a.md"]))[0], "a new branch")
        self.assertTrue(cs.decide("", "HEAD", fake_git(["docs/a.md"]))[0], "no base (an event without one)")
        self.assertTrue(browser(["docs/a.md"], has_base=False), "a base not in the clone (a force push)")
        self.assertTrue(browser(["docs/a.md"], diff_ok=False), "a diff that fails")
        self.assertTrue(browser([]), "nothing changed")

    def test_the_reason_names_a_changed_file(self):
        why = cs.decide(SHA, "HEAD", fake_git(["docs/a.md", "web/app.js", "web/render.js"]))[1]
        self.assertIn("web/app.js and 1 more", why)


if __name__ == "__main__":
    unittest.main()
