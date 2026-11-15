# Ship

Hosting is https://isopix.app. **GitHub deploys** (`.github/workflows/deploy.yml`) with this repo's own Cloudflare token, running the same `just --yes deploy` as the owner's Mac, through the public flarepress (`github.com/pdxfixit/flarepress`); the site's config is `site/` here. **It deploys every push to `main` that changes `web/`, `worker/` or `site/`**. The old addresses carry drawings over by `web/move.js`; their move Workers are the owner's, outside this repo. Detail, rollback and the DNS-conflict steps: [docs/deploy-cloudflare.md](../deploy-cloudflare.md). A commit that changes nothing under `web/` (docs, tests, tools, workflows) is pushed, CI read, and not deployed (docs/decisions.md, Shipping).

1. **Bump the release stamp:** `just version` (semver; PATCH becomes the commit count) (edits `web/version.js`; installed copies key their cache on it). Do it in the same commit as the change.
2. **Commit on your branch** (your own worktree) by explicit path, then **`just land`** there and **`just ci-wait`** for green CI. It is flarepress's shared tool (`land.conf`): pull `main`, cherry-pick, restamp `web/version.js`, test, push.
3. **The deploy** is GitHub's: it runs `deploy-check` (on `main`, `web/` and `site/` committed, files present, `just test` and **GitHub's CI run for that commit green**), gate, stamp, push, then `deploy-verify` (the live version, headers and a `just look` on the live site). Agents never run `just --yes deploy`; the owner may, from his Mac. **`just deploy-plan`** (wrangler's dry run, sending nothing) is fine anywhere.
4. **Look at the live site:** `just live` (status, cache headers, etag, versions, ✅/⚠️). A red deploy run after its push step means the new version is already live: fix forward, or the owner runs `just rollback` (prints the steps; `--yes` runs them).

Rules:

- **Land every commit with `just land`; every one that changes `web/` is deployed by GitHub**, then `just live`. Never deploy with failing tests (`deploy-check` refuses), and bump `web/version.js` with each release that changes `web/` (CI fails without it).
- **While the address does not answer at all, `deploy` refuses** unless `FIRST_PUBLISH=1` is set: the first publish creates the Custom Domain (a DNS record) and needs the owner's go.
- **Never delete or edit a DNS record without the owner's approval.** If the domain will not attach, show him the exact record (see the doc).
- Only `web/` is uploaded, configured by `site/`, so both must be committed (`ALLOW_DIRTY=1` overrides on the Mac, and stamps the version `-dirty`).
- `web/version.json` is the deploy's label (`v1.2.174-dce9c71`: release, commit), from `deploy-stamp`, gitignored; `web/version.js` is the release stamp.
- Never force-push `main`.
- **Auth fails at push** (`push` fails on auth): nothing was published. On GitHub the repo secret `CLOUDFLARE_API_TOKEN` needs the owner; on his Mac, `npx wrangler login`. Details: [docs/deploy-cloudflare.md](../deploy-cloudflare.md).
