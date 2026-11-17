---
title: Dependabot chores merged through a Qwen gate
summary: Qwen gave a merge or hold verdict on each open dependency bump, and a verdict counted only when a script agreed with it.
---

## What was measured

One Pedal repo had 10 open dependabot pull requests, all titled as chores. A script read the facts from dependabot's own metadata: each package and its new version, the files changed, and the result of each check. Qwen (qwen3-coder:30b, temperature 0, no tools) received only those facts and had to answer MERGE or HOLD and copy each bump back. The rule for merging is written as code: every bump is patch or minor, only dependency files change, and every check passed. A verdict counted only when it matched the rule's answer and quoted the bumps exactly. Any other verdict would have gone to Haiku. Run on 2026-11-17.

## Results

- Pull requests: 10
- Verdicts that passed the gate: 10
- Sent to Haiku: 0
- MERGE, and merged: 3
- HOLD, a major version bump: 7
- Median seconds per verdict: 20

## Observations

- Qwen copied every bump exactly on all 10. In an earlier test with tools, it named packages that were not in the pull request.
- The 3 merges were Python package bumps in one lockfile, all checks green.
- The 7 holds were major bumps: 4 GitHub Actions, 2 Python packages and 1 Docker base image. They wait for a person.
- Verdicts took 13 to 60 seconds, with 4 running at once on one machine.

## What the data does not show

10 rows is too few to judge a rate. Every verdict matched the rule, so the Haiku fallback was not exercised. Whether the merged bumps cause problems later was not tested.

## Recommendation

Not written yet.
