# CI (GitHub Actions, `.github/workflows/`)

- `test.yml` runs on every push and pull request: `just test`, `just export-check`, `just look` (screenshots uploaded as an artifact), and the version-bump rule (`tools/version_bumped.sh`). `live.yml` runs daily (`tools/live_check.py`): the live site must answer (3 retries); it does not check which version is live, since `deploy.yml` deploys every push to `main`. No secrets, `contents: read`, pinned actions. `deploy.yml` deploys with this repo's own Cloudflare token (the only secrets: `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`).
