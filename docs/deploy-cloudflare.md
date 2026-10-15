# Hosting: isopix.app

**The app is served at https://isopix.app/**, public: anyone with
the address can open and use it. It is static files only (no server, no
accounts, no analytics). Drawings stay in the browser that made them.

**Status:** the first publish was release 1.0.1 at isopix.pdxfixit.com, 2026-10-13. The move to isopix.app (the owner bought it and set up its DNS, 2026-10-15) is committed and waits for its first deploy ([state.md](state.md)).

## Old addresses

Browsers keep saved data per address, so a plain 301 would leave every
drawing behind. Instead, the old addresses carry it over (`web/move.js`):

- **isopix.pdxfixit.com** (1.0's home) is a second Custom Domain on the same
  Worker and serves the same files. On start there, the app reads the
  autosave, settings and file record of that browser, packs them (gzip,
  base64url) into `https://isopix.app/#move=…`, lets its service worker go,
  and goes. A fragment is never sent to any server. `?stay` keeps the app
  there instead, for a drawing too big to carry (over 1 MB packed, even
  without its trace picture and undo history).
- **The old Isogrid address** is flarepress's move Worker (its folder's
  `index.js`): `/` is a small page that imports `https://isopix.app/move.js`
  (served with CORS, see `web/_headers`) and calls `moveToNewHome()`, which
  reads Isogrid's database there; every other path 301s to isopix.app.
- **At isopix.app**, the app reads `#move=` on start and removes it from the
  address. With no drawing of its own it takes the arrival silently; with one,
  it keeps its own and offers the arrival in a note ("Open it" asks first). An
  arrival it has taken once is never taken again. Isogrid's settings arrive
  under Isopix's names. The old copy stays where it was.
- An app installed to a home screen from an old address now opens isopix.app
  in the browser; install again from isopix.app.

## How it is deployed

Through **flarepress** (`~/src/flarepress`, private repo
`github.com/pdxfixit/flarepress`), the owner's Cloudflare deploy toolchain. Its
`AGENTS.md` is the authority on that account; read it before changing anything
there.

- `flarepress/isopix.app/public` is a symlink to this repo's
  `web/`, the same pattern as the owner's other app sites. A deploy ships this checkout's
  `web/` as it is on disk, committed or not. `just deploy-check` refuses
  uncommitted edits in `web/` so the live site is always a commit on `main`.
- `flarepress/isopix.app/wrangler.toml`: static assets from `./public` and
  two Custom Domains, `isopix.app` and `isopix.pdxfixit.com` (the old home,
  which moves visitors on). No Worker script, no database, no `www`.
  `pdxfixit.com` itself is a separate site in flarepress; this subdomain does
  not touch it.
- `flarepress/isopix.app/site.conf` configures
  `flarepress/tools/site.sh`, which does the steps every app site shares (check, gate,
  stamp, verify, live, rollback; the other app sites use the same tool). This repo's
  `tools/deploy.sh` calls it and adds Isopix's own steps: the tests and the
  `version.js` bump before a deploy, `just look` on the live site after one.
- `web/_headers` (when present) sets response headers. `web/.assetsignore` keeps
  `.DS_Store` out of uploads. Neither file is served.
- `web/version.json` is the deploy's label (git describe, plus `-dirty`),
  written by `just deploy-stamp` and gitignored; the app shows it in its
  corner. `web/version.js` is the app's own release stamp (`just version`);
  the service worker names its cache after it. `deploy-verify` checks both:
  the live `version.json` equals the local one, and the live `version.js` is
  byte-for-byte this checkout's.

From this repo (`just` lists them with their notes):

```
just deploy-check    # on main, web/ committed, files present, tests pass, shows the version that would ship
just deploy-plan     # deploy-check, then flarepress `plan`: wrangler lists the files, sends nothing
just --yes deploy    # check, stamp, flarepress `push`, then deploy-verify (never without --yes)
just deploy-verify   # wait for the live version, then check the live site
just live            # what is live right now (read-only)
just rollback        # print the steps to go back to the previous release; add --yes to run them
just --yes ship msg.txt <files…>   # commit those files to main, push, deploy
```

Auth is flarepress's: a Keychain token if
present, else wrangler's own login (`wrangler login`, OAuth, cached on the owner's
Mac). When that login expires, `push` fails with an authentication error and
nothing is published. An agent cannot renew it (it needs a browser and the owner's
Cloudflare account): stop, tell the owner, and ask him to run `npx wrangler login` in
a terminal, then run `just --yes deploy` again. Flarepress's `whoami` recipe
shows which login is in use. A session with no Mac, no flarepress or no login
follows [environment.md](environment.md#a-session-that-cannot-deploy).

### When to deploy

After every commit to `main` that changes anything under `web/`: push, then
`just --yes deploy`, then `just live`. A commit that touches nothing under
`web/` (docs, tests, tools, workflows) is pushed but not deployed: the live
files would be byte-for-byte the same, and a deploy would only change
`version.json`, which pops the update notice on every open copy for nothing.
The next real release carries the docs commit's label along with it.

### Edge delay

Cloudflare's edge can serve the old files for a few seconds after an upload,
and `version.json` can change before `version.js` and new files do (seen
2026-10-12, once for more than 90 s). `deploy-verify` waits up to 90 seconds
for `version.json` and 180 seconds for `version.js`, prints how long each took,
and retries the live `just look` three times, 20 s apart. A ❌ only after that
wait is real.

### If a deploy half-fails

- **`deploy-check` or the gate stops it:** nothing was sent. Fix what it names.
- **`push` (wrangler) fails:** read its error. An auth error: see above. A
  network blip: run `just --yes deploy` again. Then `just live` shows what is
  being served (wrangler uploads, then switches the live version, so the old
  version normally stays live; check rather than assume).
- **`deploy-verify` reports ❌:** the new version is live already. Fix forward
  with a new commit and deploy, or `just rollback --yes` to the previous
  commit, then record which in [state.md](state.md).

### The first publish

Right after it, this Mac may cache the new name as missing for up to 30 minutes (the pre-publish check looked it up before it existed). `deploy-verify` and `live` then say "this Mac cannot resolve … yet" and check at Cloudflare's address instead; that is expected, not a failure.

The first publish creates the Custom Domain, which adds a DNS record in the
zone. That is why `just deploy` refuses while the address does
not answer at all, unless you set `FIRST_PUBLISH=1`:

```
FIRST_PUBLISH=1 just --yes deploy
```

Only the owner's explicit go in chat starts that. After it, every deploy is the plain
`just --yes deploy`, and it follows every commit to `main` that changes `web/`
(The owner, 2026-10-12: "always deploy following a commit"; see "When to deploy"). `deploy-check` refuses a commit that is
not pushed. When the first publish is done, say so in `state.md`,
`AGENTS.md` and flarepress's `AGENTS.md` ("set up, not yet published" becomes
live).

## Recreate the flarepress folder

If `~/src/flarepress` is missing, clone it (private; the owner grants access):
`git clone git@github.com:pdxfixit/flarepress.git ~/src/flarepress`, or clone
anywhere and set `FLAREPRESS=/that/path`. Its `AGENTS.md` is the authority on
the Cloudflare account. If the clone has no `isopix.app/` folder,
make it again; this is its whole content (2026-10-15):

```
mkdir -p ~/src/flarepress/isopix.app
ln -s "$PWD/web" ~/src/flarepress/isopix.app/public   # run from this repo
```

`~/src/flarepress/isopix.app/site.conf` (2026-10-15; flarepress's
`flarepress/tools/site.sh` names every key):

```
url=https://isopix.app
committed=web
pwa=1
compare=version.js
compare_wait=180
version_wait=90
rollback=redeploy
```

`~/src/flarepress/isopix.app/wrangler.toml` (the Worker keeps its first name):

```toml
# Isopix, a touch drawing app on an isometric grid. The site lives in its own
# repo (github.com/pdxfixit/isopix); public/ links to its web/ folder. Static
# assets only: no Worker script, no bindings. Home: isopix.app; the old home,
# isopix.pdxfixit.com, serves the same files and moves visitors on (move.js).
name = "isopix-pdxfixit-com"
compatibility_date = "2026-10-13"

routes = [
  { pattern = "isopix.app", custom_domain = true },
  { pattern = "isopix.pdxfixit.com", custom_domain = true }
]

[assets]
directory = "./public"
```

Flarepress's `plan <folder>` runs `npx wrangler deploy --dry-run` in that
folder and `push <folder>` runs `npx wrangler deploy`, each with
`CLOUDFLARE_API_TOKEN` set from the Keychain token when there is one. The
Worker name must stay `isopix-pdxfixit-com`: a new name makes a second
Worker and fights over the Custom Domain. `deploy-check` confirms that
`public` resolves to this checkout's `web/`.

## Checks after a deploy

`just deploy` ends with `deploy-verify`; it waits up to 90 seconds for the edge
to serve the new version (180 for `version.js`), then checks and prints one line each:

| Check | Why |
|---|---|
| live `version.json` equals the local stamp; live `version.js` equals this checkout's | the new files are what is served, and installed apps get the right worker |
| `/`, the manifest and the service worker answer 200 | the app can load and install |
| the service worker's `Cache-Control` is `no-cache`, `no-store` or `max-age=0` | a stale worker file would pin devices to an old app |
| the service worker is served as JavaScript, the manifest parses as JSON | the browser accepts both |
| `just look --url` on the live site, when the repo has it | no console errors on the real site |

Any ❌ ends with exit 1 naming what failed. The new version is already live by
then: fix forward, or roll back (below).

## Service worker and caching

A device that installed the app keeps running its service worker, which serves
cached files. So a deploy reaches an installed app only after the browser has
fetched the new worker file and the new worker has taken over. Rules:

- Browsers re-check the worker file on each navigation and treat it as changed
  on any byte difference. Keep the file's cache header at `no-cache`, or
  `max-age=0`; the live header is `no-cache` (seen on the first publish, 2026-10-12), and
  `deploy-verify` keeps reading it.
- Run `just version` with every release: it changes `web/version.js`, which
  changes the worker's cache name. `deploy-check` warns when `web/` changed
  since the last bump.
- `version.json` is never cached (`_headers` says `no-store`; the worker skips
  it), so the label and the live check read the network's copy.
- Whether an updated worker waits for every tab to close or takes over at once
  is an app decision; write it down in the app's own docs.

## Rollback

`just rollback` prints the steps for the previous release and changes nothing.
The previous release is the second-newest commit that changed `web/` (commits
that change nothing under `web/` are not deployed, so `HEAD~1` could ship the
same files). `just rollback --to <commit> --yes` runs them:

1. A throwaway `git worktree` of that commit.
2. A throwaway flarepress site folder: the real `wrangler.toml` copied, every
   link in the site folder (`public`) re-pointed into the worktree.
3. `version.json` written there with that commit's version.
4. flarepress `push` on that folder (it accepts a path), then flarepress's
   verify for that version (not the live `just look`: run it by hand).
5. The worktree and the folder are removed.

Afterwards the live site is **not** `main`'s head. Fix forward, or run `just
--yes deploy` to put `main` back. Installed copies pick the rolled-back version
up like any other update (see the service worker notes above).

To take the site down entirely (only on the owner's explicit go): from
`~/src/flarepress/isopix.app`, `npx wrangler delete` removes the Worker; check the zone's DNS tab afterwards in
case the Custom Domain record outlives it. Then remove the folder from
flarepress and its line in flarepress `AGENTS.md`.

## If the Custom Domain will not attach

Cloudflare refuses to attach a Custom Domain over an existing DNS record on the
same hostname, and `wrangler deploy` fails with an error naming the record.

1. Look first, read-only: `dig +short isopix.app` and `dig +short CNAME
   isopix.app` (or the Cloudflare dashboard's DNS tab for the zone). The
   owner set up isopix.app's DNS himself on 2026-10-15: a record he made on
   the apex is exactly what blocks the attach.
2. If a record exists, **do not delete it yourself.** Show the owner the exact record
   (type, name, content) and ask. Deleting a DNS record needs his approval.
3. After he approves (or deletes it in the dashboard, DNS tab), run the deploy
   again: it creates the Custom Domain attachment fresh.

## Things to know

- **Each address has its own storage.** Drawings saved at `localhost` or any
  other address do not appear on isopix.app; export and import move them.
  The old addresses carry theirs over by themselves (above).
- **First install on a real device is unverified** (the site is live, but nobody has tried it on a device yet):
  that the manifest installs, the worker registers, and offline start works on
  the Pixel and a tablet.
- **Everything in `web/` is public** on the next deploy. Put nothing there that
  should not be.
