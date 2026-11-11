---
title: Fill a table from raw rows
summary: A pass or fail test where Qwen sums and groups run records and a script checks every cell.
---

## What was measured

Qwen received raw rows from the cron triage run log: a start time, a count of answers, a count of fallbacks and a cost for each run. No run names or ids were included. It was asked to group the rows by day and fill four columns per day: runs, answered, fell back and dollars. A script computed the right table from the same rows and compared every cell. A cell counts only on an exact match.

## Results

Each size was run {{tests.fill_table.first.attempts}} times.

{{table:fill_table}}

## Observations

- With {{tests.fill_table.first.rows}} row, Qwen filled {{tests.fill_table.first.cells_correct.0}} of {{tests.fill_table.first.cells}} cells correctly on the first attempt.
- With {{tests.fill_table.last.rows}} rows, Qwen filled {{tests.fill_table.last.cells_correct.0}} of {{tests.fill_table.last.cells}} cells correctly on the first attempt.
- At the smallest size, {{tests.fill_table.first.unparseable}} answers were unreadable.

## What the data does not show

One prompt wording and one model were tested. Writing the sums as a script instead of asking the model to add them was not tested.

## Recommendation

Not written yet.
