---
title: Inbox triage: Qwen and Haiku on the same messages
summary: Where the two models gave the same label and where they differed, from the shadow check on inbox triage.
---

## What was measured

Inbox triage gives each message one label: archive, fyi, reply or task. Qwen's label is the one used. For some messages, Haiku also labeled the same message in the background. Only the two labels were stored, never the message.

## Results

{{tests.triage_shadow.total}} messages have a label from both models. Qwen and Haiku gave the same label on {{tests.triage_shadow.agree}} of them ({{pct:tests.triage_shadow.agree/tests.triage_shadow.total}}%). {{tests.triage_shadow.missing_label}} more rows have no label on one side and are left out.

{{table:shadow_matrix}}

## Observations

- Qwen gave archive where Haiku gave fyi on {{cell:archive,fyi}} messages.
- Qwen gave archive where Haiku gave task on {{cell:archive,task}} messages.
- Qwen gave fyi where Haiku gave reply on {{cell:fyi,reply}} messages.
- Qwen gave fyi where Haiku gave archive on {{cell:fyi,archive}} messages.
- Both gave reply on {{cell:reply,reply}} messages and archive on {{cell:archive,archive}} messages.
- The dashboard card shows {{data.accuracy.shadow_agreement_pct.triage}}% from the aggregates as of {{data.as_of}}. The table above reads newer rows.

## What the data does not show

Haiku's label is the comparison, not a checked answer. A person has not marked which label was right on the messages where the two differ.

## Recommendation

Not written yet.
