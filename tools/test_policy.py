"""tools/policy.sh (just policy): finds the privacy checkout, refuses an uncommitted copy, runs `just take` then `just land` there.
A fake privacy repo (a bare origin and a clone whose take and land recipes only write a note) stands in for the real one."""
import os
import shutil
import subprocess
import tempfile
import unittest

HERE = os.path.dirname(os.path.abspath(__file__))
SCRIPT = os.path.join(HERE, "policy.sh")
POLICY = "---\nname: Isopix\nblurb: x\nupdated: 1 January 2026\n---\n# Isopix privacy policy\n"
ENV = {**os.environ, "GIT_AUTHOR_NAME": "t", "GIT_AUTHOR_EMAIL": "t@example.invalid",
       "GIT_COMMITTER_NAME": "t", "GIT_COMMITTER_EMAIL": "t@example.invalid"}
# take records the app name and TAKE_SHA, copies the file it was given and commits both; land only leaves a note
PRIVACY_JUSTFILE = """set shell := ["bash", "-uc"]
take app file:
    echo "{{app}} $TAKE_SHA" > took.txt
    cp {{file}} copied.md
    git add took.txt copied.md
    git commit -q -m take
land:
    echo landed > landed.txt
"""


def read(*parts):
    with open(os.path.join(*parts)) as f:
        return f.read()


def run(cmd, cwd, **env):
    return subprocess.run(cmd, cwd=cwd, env={**ENV, **env}, capture_output=True, text=True)


class Policy(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.mkdtemp()
        self.addCleanup(shutil.rmtree, self.tmp, True)
        self.app = os.path.join(self.tmp, "isopix")
        os.makedirs(os.path.join(self.app, "docs"))
        os.makedirs(os.path.join(self.app, "tools"))
        shutil.copy(SCRIPT, os.path.join(self.app, "tools", "policy.sh"))
        with open(os.path.join(self.app, "docs", "privacy-policy.md"), "w") as f:
            f.write(POLICY)
        run(["git", "init", "-q", "-b", "main"], self.app)
        run(["git", "add", "-A"], self.app)
        run(["git", "commit", "-q", "-m", "app"], self.app)
        # the privacy repo: a bare origin and the checkout beside the app
        origin = os.path.join(self.tmp, "origin.git")
        seed = os.path.join(self.tmp, "seed")
        os.makedirs(seed)
        with open(os.path.join(seed, "justfile"), "w") as f:
            f.write(PRIVACY_JUSTFILE)
        run(["git", "init", "-q", "-b", "main"], seed)
        run(["git", "add", "-A"], seed)
        run(["git", "commit", "-q", "-m", "privacy"], seed)
        run(["git", "clone", "-q", "--bare", seed, origin], self.tmp)
        self.pv = os.path.join(self.tmp, "privacy")
        run(["git", "clone", "-q", origin, self.pv], self.tmp)
        self.origin, self.seed = origin, seed

    def policy(self, *args, **env):
        return run(["bash", "tools/policy.sh", *args], self.app, **env)

    def sha(self):
        return run(["git", "rev-parse", "--short", "HEAD"], self.app).stdout.strip()

    def test_runs_take_with_the_apps_commit_then_land(self):
        r = self.policy()
        self.assertEqual(r.returncode, 0, r.stderr)
        self.assertEqual(read(self.pv, "took.txt").strip(), f"isopix {self.sha()}")
        self.assertEqual(read(self.pv, "copied.md"), POLICY)
        self.assertTrue(os.path.exists(os.path.join(self.pv, "landed.txt")), "just land runs after take")

    def test_dry_run_runs_neither_take_nor_land(self):
        r = self.policy("--dry-run")
        self.assertEqual(r.returncode, 0, r.stderr)
        self.assertIn(f"TAKE_SHA={self.sha()} just take isopix", r.stdout)
        self.assertFalse(os.path.exists(os.path.join(self.pv, "took.txt")))
        self.assertFalse(os.path.exists(os.path.join(self.pv, "landed.txt")))

    def test_pulls_main_first(self):
        with open(os.path.join(self.seed, "newer.txt"), "w") as f:
            f.write("x")
        run(["git", "add", "-A"], self.seed)
        run(["git", "commit", "-q", "-m", "newer"], self.seed)
        run(["git", "push", "-q", self.origin, "main"], self.seed)
        self.assertEqual(self.policy("--dry-run").returncode, 0)
        self.assertTrue(os.path.exists(os.path.join(self.pv, "newer.txt")), "the checkout was brought up to date")

    def test_refuses_an_uncommitted_copy(self):
        with open(os.path.join(self.app, "docs", "privacy-policy.md"), "a") as f:
            f.write("more\n")
        r = self.policy()
        self.assertEqual(r.returncode, 1)
        self.assertIn("uncommitted", r.stderr)
        self.assertFalse(os.path.exists(os.path.join(self.pv, "took.txt")))

    def test_privacy_env_wins_over_the_checkout_beside(self):
        other = os.path.join(self.tmp, "elsewhere")
        run(["git", "clone", "-q", self.origin, other], self.tmp)
        r = self.policy(PRIVACY=other)
        self.assertEqual(r.returncode, 0, r.stderr)
        self.assertTrue(os.path.exists(os.path.join(other, "landed.txt")))
        self.assertFalse(os.path.exists(os.path.join(self.pv, "landed.txt")))

    def test_a_bad_privacy_env_stops(self):
        r = self.policy(PRIVACY=os.path.join(self.tmp, "nowhere"), XDG_CACHE_HOME=os.path.join(self.tmp, "cache"))
        self.assertEqual(r.returncode, 1)
        self.assertIn("PRIVACY", r.stderr)

    def test_refuses_a_privacy_checkout_off_main_or_dirty(self):
        with open(os.path.join(self.pv, "stray.txt"), "w") as f:
            f.write("x")
        r = self.policy()
        self.assertEqual(r.returncode, 1)
        self.assertIn("uncommitted", r.stderr)
        os.remove(os.path.join(self.pv, "stray.txt"))
        run(["git", "checkout", "-q", "-b", "side"], self.pv)
        r = self.policy()
        self.assertEqual(r.returncode, 1)
        self.assertIn("not on main", r.stderr)

    def test_nothing_changed_lands_nothing(self):
        # take that commits nothing: policy.sh says so and skips land
        with open(os.path.join(self.pv, "justfile"), "w") as f:
            f.write(PRIVACY_JUSTFILE.replace("    git commit -q -m take\n", "").replace("    git add took.txt copied.md\n", ""))
        run(["git", "commit", "-qam", "no-op take"], self.pv)
        r = self.policy()
        self.assertEqual(r.returncode, 0, r.stderr)
        self.assertIn("nothing to land", r.stdout)
        self.assertFalse(os.path.exists(os.path.join(self.pv, "landed.txt")))
