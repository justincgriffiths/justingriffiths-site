---
title: Issue labels replayed through Qwen
summary: Past GitHub issues relabeled by Qwen and compared with Haiku's labels and with the labels on the issues today.
---

## What was measured

The issue tagger gives each GitHub issue a type, a priority, an audience and a rung, which names the cheapest model tier that could do the work. {{tests.label_replay.replayed}} past issues were run through Qwen with the same rubric. Qwen's labels were compared with the labels Haiku applied at the time and with the labels on the issue today. The page stores counts only.

## Results

{{table:replay_fields}}

{{table:rung_vs}}

## Observations

- Qwen matched the audience label on {{tests.label_replay.by_field.audience.vs_haiku.agree}} of {{tests.label_replay.by_field.audience.vs_haiku.n}} issues.
- Qwen matched Haiku's rung on {{tests.label_replay.by_field.rung.vs_haiku.agree}} of {{tests.label_replay.by_field.rung.vs_haiku.n}} issues.
- Qwen chose a cheaper rung than Haiku on {{tests.label_replay.rung_vs.vs_haiku.cheaper}} issues, the same rung on {{tests.label_replay.rung_vs.vs_haiku.same}} and a costlier rung on {{tests.label_replay.rung_vs.vs_haiku.costlier}}.
- Qwen chose a cheaper rung than the label on the issue today on {{tests.label_replay.rung_vs.vs_today.cheaper}} issues and a costlier rung on {{tests.label_replay.rung_vs.vs_today.costlier}}.

## What the data does not show

Neither Haiku's labels nor today's labels were checked against a correct answer. Whether a cheaper rung finishes the work was not tested.

## Recommendation

Not written yet.
