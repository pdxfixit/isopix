"""tools/archive_agent.sh on a throwaway repo: it archives a landed branch and its
worktree, and refuses a branch with work main lacks and a worktree with edits."""
import os
import subprocess
import tempfile
import unittest
from pathlib import Path

SCRIPT = Path(__file__).resolve().parent / "archive_agent.sh"


class ArchiveAgent(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.root = Path(self.tmp.name) / "repo"
        self.root.mkdir()
        # A git hook runs with GIT_DIR and GIT_INDEX_FILE set; the throwaway repo must not inherit them.
        self.env = {**{k: v for k, v in os.environ.items() if not k.startswith("GIT_")}, "GIT_AUTHOR_NAME": "t", "GIT_AUTHOR_EMAIL": "t@t", "GIT_COMMITTER_NAME": "t",
                    "GIT_COMMITTER_EMAIL": "t@t", "GIT_CONFIG_GLOBAL": os.devnull, "GIT_CONFIG_NOSYSTEM": "1"}
        self.git("init", "-q", "-b", "main")
        self.git("commit", "-q", "--allow-empty", "-m", "first")
        self.wt = Path(self.tmp.name) / "wt"
        self.git("worktree", "add", "-q", "-b", "worktree-agent-abc", str(self.wt))

    def tearDown(self):
        self.tmp.cleanup()

    def git(self, *args, cwd=None, check=True):
        return subprocess.run(["git", *args], cwd=cwd or self.root, env=self.env, capture_output=True, text=True,
                              check=check).stdout.strip()

    def commit_in_agent(self, name):
        (self.wt / name).write_text(name)
        self.git("add", name, cwd=self.wt)
        self.git("commit", "-q", "-m", f"feat: {name}", cwd=self.wt)

    def run_script(self, ident):
        return subprocess.run(["bash", str(SCRIPT), ident], cwd=self.root, env=self.env, capture_output=True, text=True)

    def test_a_landed_branch_is_tagged_and_removed(self):
        self.commit_in_agent("a.txt")
        self.git("cherry-pick", "worktree-agent-abc")  # what just land does: the same patch on main
        r = self.run_script("abc")
        self.assertEqual(r.returncode, 0, r.stderr)
        self.assertIn("archived worktree-agent-abc", r.stdout)
        self.assertFalse(self.wt.exists())
        self.assertEqual(self.git("branch", "--list", "worktree-agent-abc"), "")
        self.assertTrue(self.git("tag", "--list", "archive/worktree-agent-abc"))

    def test_a_commit_main_lacks_stops_it(self):
        self.commit_in_agent("a.txt")
        r = self.run_script("worktree-agent-abc")
        self.assertEqual(r.returncode, 1)
        self.assertIn("land it first", r.stderr)
        self.assertTrue(self.wt.exists())

    def test_uncommitted_edits_stop_it(self):
        (self.wt / "dirty.txt").write_text("x")
        r = self.run_script("abc")
        self.assertEqual(r.returncode, 1)
        self.assertIn("uncommitted", r.stderr)

    def test_an_unknown_branch_stops_it(self):
        r = self.run_script("nope")
        self.assertEqual(r.returncode, 1)
        self.assertIn("no branch", r.stderr)


if __name__ == "__main__":
    unittest.main()
