// The app's release stamp. `just version` bumps it: semver, and
// PATCH is always the commit count (tools/bump_version.py). The service worker
// imports this file, so a new stamp changes the worker's cache name and
// installed copies fetch fresh files after a deploy. Classic script (not a
// module) so both the page and importScripts() can load it.
self.ISOPIX_VERSION = '1.2.120';
