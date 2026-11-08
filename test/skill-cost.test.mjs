import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";

// site#115: the skill_cost block, from test/fixtures/skill-cost-extract.json: aggregate rows only (day, skill, model bucket,
// main-thread flag, usd, requests), cut from telemetry.events (api_request) before 2026-11-07, for skills wrap / unstick-prs /
// declutter-sessions / learn plus every untagged row. SQL_SLICE_TOTAL is the straight `select sum(cost_usd)` for that same slice.
const FIXTURE = "test/fixtures/skill-cost-extract.json";
const SQL_SLICE_TOTAL = 931.3882;
const rows = JSON.parse(readFileSync(FIXTURE, "utf8"));
const run = (env = {}) => execFileSync("python3", ["bin/qwen-state.py"], { encoding: "utf8", env: { ...process.env, PGPASSWORD: "", QWEN_AS_OF: "2026-11-08T15:00:00Z",
  QWEN_RUNS: "/nonexistent", QWEN_COST_DB: "/nonexistent", QWEN_TAG_LOG: "/nonexistent", QWEN_TAG_JSONL: "/nonexistent", QWEN_WRAP_DIR: "/nonexistent", QWEN_WRAP_ROW_LOG: "/nonexistent",
  QWEN_PR_SWEEP: "/nonexistent", QWEN_SESSION_FINISH: "/nonexistent", QWEN_DECLUTTER_SWEEP: "/nonexistent", QWEN_CRON_RUNS: "/nonexistent", QWEN_DECLUTTER: "/nonexistent", QWEN_REAP: "/nonexistent", QWEN_LEARN: "/nonexistent", ...env } });
const sc = JSON.parse(run({ QWEN_SKILL_COST_FIXTURE: FIXTURE })).skill_cost;
const r4 = (n) => Math.round(n * 1e4) / 1e4;

test("skill_cost: total reconciles to the straight sum of api_request cost for the slice", () => {
  assert.equal(sc.total_usd, SQL_SLICE_TOTAL);
  assert.equal(sc.requests, rows.reduce((a, r) => a + r.requests, 0));
});

test("skill_cost: every day's total (tagged + untagged) equals that day's api_request cost", () => {
  const want = {}; for (const r of rows) want[r.day] = (want[r.day] || 0) + r.usd;
  const got = {};
  for (const r of sc.by_day_skill_model) got[r.day] = (got[r.day] || 0) + r.usd;
  for (const r of sc.untagged_by_day) got[r.day] = (got[r.day] || 0) + r.main_usd + r.other_usd;
  assert.deepEqual(Object.keys(got).sort(), Object.keys(want).sort());
  for (const d of Object.keys(want)) assert.ok(Math.abs(got[d] - want[d]) < 1e-3, `${d}: ${got[d]} vs ${want[d]}`);
});

test("skill_cost: coverage is computed (tagged spend / total), untagged main thread is its own column per day", () => {
  const tagged = rows.filter((r) => r.skill).reduce((a, r) => a + r.usd, 0);
  assert.equal(sc.tagged_pct, Math.round((1000 * tagged) / SQL_SLICE_TOTAL) / 10);
  assert.equal(sc.since, "2026-11-04");
  const main = rows.filter((r) => !r.skill && r.main).reduce((a, r) => a + r.usd, 0);
  assert.ok(Math.abs(sc.untagged_by_day.reduce((a, r) => a + r.main_usd, 0) - main) < 1e-3);
  assert.ok(sc.by_day_skill_model.every((r) => r.skill && r.model && r.usd >= 0 && r.requests > 0));
});

test("skill_cost: a cut-off with no telemetry source is null, never a zero", () => {
  assert.equal(JSON.parse(run()).skill_cost, null);
});

test("skill_cost: History carries interactive cost for wrap, session cleanup and PR sweeps", () => {
  const h = Object.fromEntries(JSON.parse(run({ QWEN_SKILL_COST_FIXTURE: FIXTURE })).history.commands.map((c) => [c.command, c]));
  const want = (s) => r4(rows.filter((r) => r.skill === s).reduce((a, r) => a + r.usd, 0));
  assert.equal(r4(h.wrap.interactive.usd), want("wrap"));
  assert.equal(r4(h["pr-sweep"].interactive.usd), want("unstick-prs"));
  assert.equal(r4(h["session-cleanup"].interactive.usd), want("declutter-sessions"));
  assert.ok(Math.abs(Object.values(h.wrap.interactive.usd_models).reduce((a, b) => a + b, 0) - h.wrap.interactive.usd) < 1e-3);
});

test("skill_cost: a skill name that is not name-shaped folds into other; no extra field leaves the exporter; leakcheck passes", () => {
  const f = "/tmp/skill-cost-odd.json";
  execFileSync("python3", ["-c", `import json;json.dump([{"day":"2026-11-05","skill":"Q3 invoice for a@b.c","model":"opus","main":False,"usd":1.5,"requests":2,"session_id":"SENTINEL_SID","prompt":"SENTINEL_PROMPT"}],open("${f}","w"))`]);
  const out = run({ QWEN_SKILL_COST_FIXTURE: f });
  assert.equal(out.includes("SENTINEL_SID") || out.includes("SENTINEL_PROMPT") || out.includes("invoice"), false);
  assert.deepEqual(JSON.parse(out).skill_cost.by_day_skill_model, [{ day: "2026-11-05", skill: "other", model: "opus", usd: 1.5, requests: 2 }]);
  const leak = spawnSync("python3", ["bin/qwen-leakcheck.py"], { input: run({ QWEN_SKILL_COST_FIXTURE: FIXTURE }), encoding: "utf8" });
  assert.equal(leak.status, 0, leak.stderr);
});

test("render: History shows interactive cost per command and the computed coverage line", async () => {
  const { renderData } = await import("../src/qwen-render.mjs");
  const html = renderData(JSON.parse(run({ QWEN_SKILL_COST_FIXTURE: FIXTURE })));
  const sec = html.slice(html.indexOf('id="history"'), html.indexOf('id="fallbacks"'));
  assert.match(sec, new RegExp(`telemetry from 2026-11-04; ${sc.tagged_pct}% of spend carries a skill tag`));
  assert.equal((sec.match(/Interactive \(Claude Code\):/g) || []).length, 3);
  assert.doesNotMatch(sec, /NaN|undefined/);
  const none = renderData(JSON.parse(run()));
  assert.doesNotMatch(none, /carries a skill tag|Interactive \(Claude Code\)/);
});
