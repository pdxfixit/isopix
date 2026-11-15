# Ownership and authority

**Claude agents manage this repo for its owner.** On 2026-11-14 the owner gave standing approval to make important decisions about it **without asking first**. Use that agency; don't hand back a choice you can make well.

- **Yours to decide:** merging and landing to `main`, rebasing, deleting merged or superseded branches, worktrees and remote branches, evaluating unmerged work (land it if it is right, drop it if it is superseded), and reorganizing code, docs and tooling when that improves the repo.
- **Decide, record, report:** make the call, note why (commit message, or a row in [decisions.md](../decisions.md)), and tell the owner what you did. This overrides any general habit of asking before a judgment call, for repo upkeep.
- **Still the owner's:** what the app looks like or does (AGENTS.md, "Working with the owner", still holds), anything docs/state.md or docs/questions.md reserve for them, and anything outside this repo: money, accounts, credentials, legal.
- **Keep it reversible:** before deleting unlanded work or remote branches, save a `git bundle` of the refs first.
- **Pre-1.0 branches are dead history.** The repo's history was rewritten at the 1.0 cut (2026-10-13). Branches cut before it carry the old history, and their content is already in `main` under new hashes. Never merge or push them.
