# Tabler (vendored)

| Field | Value |
|---|---|
| Package | `@tabler/core` |
| Version | 1.7.4 (released 2026-11-08) |
| License | MIT, https://github.com/tabler/tabler/blob/master/LICENSE (notice kept in the CSS header) |
| Source | https://registry.npmjs.org/@tabler/core/-/core-1.7.4.tgz |
| Tarball sha256 | `ccb1631d26cec2589d357556c8fe86bbba75ef0bcf672a4939a7ed5d4ab7319c` |
| `tabler.min.css` sha256 | `7347fc35d2f4e3a374c694a2a608424e2d5b9e5cc626ccdce1fcee4fc59fc8ae` (`dist/css/tabler.min.css`) |
| `tabler.min.js` sha256 | `1077d09f3d643afb3134111022a75f425bbccd60ef563f45613a82c53a6b120c` (`dist/js/tabler.min.js`) |

Copied unchanged. The CSS has no `@import`, no `@font-face` and no remote `url()`; the JS makes no network call. Only
`/qwen/dashboard/` uses it (`build-qwen-dashboard.mjs` copies both files to `dist/qwen/dashboard/vendor/`). To upgrade,
download the new tarball into an empty directory, copy the two files, and update this table.
