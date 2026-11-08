# Copy gate (#100)

New copy is checked against this site's own approved copy before it publishes.

- **Profile**: `voice/samples.md` (dated excerpts of approved copy) and `voice/rules.tsv` (id, kind, regex, rule, why).
- **Gate**: `bin/copygate` checks the copy that changed against `origin/main`. It runs in `npm test`, so CI `qa` runs it too.
  `bin/site-build.sh`, the one build `sitedep.sh` uses, runs `bin/copygate --all`, so a deploy refuses a failing build.
- **Waivers**: `voice/known-fails.tsv` lists old lines that fail today. They are Justin's to rewrite or accept. Editing a line un-waives it.
- **Judge, local only**: `bin/copygate --judge` sends changed copy and `voice/samples.md` to ChatGPT through `~/brain/bin/gcopy.sh`.
  Run it before opening a PR and paste the verdict into the PR body. A "no" means rewrite. It refuses to run when `CI` is set.

## Proof, run 2026-11-08

| Case | Fixture | Rules | Judge |
|---|---|---|---|
| Old /qwen/ Background (raw message) | `test/fixtures/copygate/old-background.html` | FAIL V-001 (lowercase i), V-002 (....), V-003, V-004 | no |
| #99's revised Background | `test/fixtures/copygate/background-99.html` | PASS | yes |
| CoS's first doc-genre rewrite | `test/fixtures/copygate/cos-first-rewrite.html` | FAIL V-004, V-005, V-007 | no |

The CoS fixture is a reconstruction from #99's description (bold-signpost bullets, "I do not", "frankly"); the original was never committed.
