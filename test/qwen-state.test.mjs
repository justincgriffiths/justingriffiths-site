import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, utimesSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import worker from "../src/worker.js";

// PUBLIC page: poison every source with per-message fields; none may reach the exporter output.
const SENTINELS = ["SENTINEL_CRON_JOB_NAME", "SENTINEL_CRON_RUNID", "SENTINEL_FLAGGED_TEXT", "SENTINEL_DECLUTTER_JOB", "SENTINEL_SESSION_NAME", "SENTINEL_REAP_JOB", "SENTINEL REASON declutter 5521", "SENTINEL_MSGID_9f3a", "SENTINEL SUBJECT Q3 invoice", "sender-sentinel@example.com", "SENTINEL_ISSUE_TITLE", "secret-repo-sentinel", "SENTINEL_ACCOUNT", "SENTINEL REASON free text 8841", "SENTINEL_LABEL_xyz", "secret-repo-sentinel2", "7771299", "SENTINEL_PAIR_LABEL", "SENTINEL_MSGID_PAIR", "SENTINEL_CORR_ISSUE_8842", "SENTINEL_LEARN_STORE", "SENTINEL_LEARN_REASON", "SENTINEL_MODEL_ROW", "SENTINEL_WRAP_SESSION_ID", "SENTINEL_WRAP_ASK", "SENTINEL_PR_REPO", "SENTINEL_PR_STOP", "SENTINEL_SWEEP_BODY", "SENTINEL_FINISH_BODY"];
const FORBIDDEN_KEYS = ["id", "ids", "subject", "sender", "from", "title", "number", "repo", "account", "labels", "pair", "haiku_add", "dimension", "from", "to", "model_of_origin", "applied_at", "qwen_label", "haiku_label", "from_label", "to_label", "issue", "match", "haiku_usd", "context", "input", "message_id", "email", "report"];

const dir = mkdtempSync(join(tmpdir(), "qwen-"));
const runs = join(dir, "runs"); mkdirSync(runs);
writeFileSync(join(runs, "20261107-142909-SENTINEL_ACCOUNT.json"), JSON.stringify({ mode: "create", account: "SENTINEL_ACCOUNT", report: "SENTINEL_MSGID_9f3a.md", cost_usd: 0.4,
  qwen: { cap: 1, seen: 3, qwen: 1, escalated: 1, reasons: { "SENTINEL REASON free text 8841": 1, "exit-2": 1 } } }));
writeFileSync(join(runs, "20261107-142909-SENTINEL_ACCOUNT.audit.jsonl"), [
  { tool: "qwen_classify", id: "SENTINEL_MSGID_9f3a", subject: "SENTINEL SUBJECT Q3 invoice", from: "sender-sentinel@example.com", label: "SENTINEL SUBJECT Q3 invoice", escalated: false, reason: "", latency_ms: 1500 },
  { tool: "qwen_classify", id: "SENTINEL_MSGID_9f3a", label: "fyi", escalated: false, latency_ms: 900 },
  { tool: "Agent", input: { prompt: "SENTINEL SUBJECT Q3 invoice sender-sentinel@example.com" } },
].map((r) => JSON.stringify(r)).join("\n") + "\n");
writeFileSync(join(runs, "20261107-150000-SENTINEL_ACCOUNT.json"), JSON.stringify({ mode: "create", qwen: { cap: 1, seen: 0, qwen: 0, escalated: 0, reasons: {} } }));
writeFileSync(join(runs, "20261107-150000-SENTINEL_ACCOUNT.audit.jsonl"), [
  { tool: "qwen_pair", ts: "2026-11-07T15:00:00Z", id: "SENTINEL_MSGID_PAIR", qwen_label: "SENTINEL_PAIR_LABEL", haiku_label: "SENTINEL_PAIR_LABEL", match: true, reason: "SENTINEL REASON free text 8841", haiku_usd: 0.01, latency_ms: 800 },
  { tool: "qwen_pair", id: "SENTINEL_MSGID_PAIR", qwen_label: "fyi", haiku_label: "task", match: false, haiku_usd: 0.01 },
].map((r) => JSON.stringify(r)).join("\n") + "\n");
writeFileSync(join(runs, "20261107-160000-dry.json"), JSON.stringify({ mode: "dry-run", qwen: { cap: 1, seen: 9, qwen: 9, escalated: 0, reasons: { "timeout": 4 } } }));
writeFileSync(join(runs, "20261107-160000-dry.audit.jsonl"), [
  { tool: "qwen_classify", label: "task", escalated: false, latency_ms: 50 },
  { tool: "qwen_pair", match: false, qwen_label: "fyi", haiku_label: "task" },
].map((r) => JSON.stringify(r)).join("\n") + "\n");
// Before Qwen: a run with no qwen block (Haiku did every message). Unique message ids per run count; a dry-run sidecar does not.
writeFileSync(join(runs, "20261020-120000-pedal.json"), JSON.stringify({ mode: "create", account: "x", report: "r.md" }));
writeFileSync(join(runs, "20261020-120000-pedal.audit.jsonl"), ["hid-a", "hid-b", "hid-a"].map((id) => JSON.stringify({ tool: "mcp__mail__get_message", input: { id } })).join("\n") + "\n");
writeFileSync(join(runs, "20261019-120000-pedal.json"), JSON.stringify({ mode: "dry-run" }));
writeFileSync(join(runs, "20261019-120000-pedal.audit.jsonl"), JSON.stringify({ tool: "mcp__mail__get_message", input: { id: "hid-c" } }) + "\n");
writeFileSync(join(runs, "corrections.audit.jsonl"), JSON.stringify({ tool: "qwen_correction", id: "SENTINEL_MSGID_9f3a", from_label: "SENTINEL_PAIR_LABEL", to_label: "task", model_of_origin: "qwen3-coder:30b", issue: "SENTINEL_CORR_ISSUE_8842" }) + "\n");
writeFileSync(join(dir, "tag.log"),
  "[2026-11-07T06:00:00Z] argv=[secret-repo-sentinel personal limit=1 apply=1] exit=0 tagged=1 failed=0 qwen=1 fallback=0 haiku=2\n" +
  "[2026-11-07T06:05:00Z] argv=[secret-repo-sentinel personal limit=5 apply=0] exit=0 tagged=5 failed=0 qwen=5 fallback=0 haiku=0\n");
writeFileSync(join(dir, "tag.jsonl"), [
  { number: 7771234, title: "SENTINEL_ISSUE_TITLE", repo: "secret-repo-sentinel", model: "qwen3-coder:30b", cost_usd: 0, pair: { haiku_add: ["SENTINEL_LABEL_xyz"], match: true, cost_usd: 0.01, error: null } },
  { number: 7771299, repo: "secret-repo-sentinel2", model: "qwen3-coder:30b", cost_usd: 0, pair: { haiku_add: [], match: false, cost_usd: 0.01, error: null } },
  { kind: "applied", ts: "2026-11-07T06:00:00Z", repo: "secret-repo-sentinel", number: 7771234, labels: ["SENTINEL_LABEL_xyz"], model: "qwen3-coder:30b" },
  { kind: "applied", ts: "2026-11-07T06:00:00Z", repo: "secret-repo-sentinel2", number: 7771299, labels: ["SENTINEL_LABEL_xyz"], model: "qwen3-coder:30b" },
  { kind: "correction", ts: "2026-11-07T07:00:00Z", repo: "secret-repo-sentinel2", number: 7771299, dimension: "SENTINEL_LABEL_xyz", from: "a", to: "b", model_of_origin: "qwen3-coder:30b", applied_at: "2026-11-07T06:00:00Z" },
].map((r) => JSON.stringify(r)).join("\n") + "\n");


// site#79: cron triage, declutter and session-reap. Every job name, run id, flagged-job text and session name is a sentinel.
const none = join(dir, "does-not-exist.jsonl");
const jl = (name, rows) => { const f = join(dir, name); writeFileSync(f, rows.map((r) => JSON.stringify(r)).join("\n") + "\n"); return f; };
const cronFile = jl("cron.jsonl", [
  { run_id: "SENTINEL_CRON_RUNID_1", started: "2026-11-08T09:11:00Z", ended: "2026-11-08T09:12:00Z", jobs_flagged: 6, qwen_ok: 0, escalated: { qwen_error: 6 }, usd: 0.0067, latency_ms: 20000, flagged: ["SENTINEL_CRON_JOB_NAME"], text: "SENTINEL_FLAGGED_TEXT" },
  { run_id: "SENTINEL_CRON_RUNID_2", started: "2026-11-08T10:11:00Z", ended: "2026-11-08T10:12:00Z", jobs_flagged: 0, qwen_ok: 0, escalated: {}, usd: 0, latency_ms: 0 },
  { run_id: "SENTINEL_CRON_RUNID_3", started: "2026-11-08T11:11:00Z", ended: "2026-11-08T11:12:00Z", jobs_flagged: 6, qwen_ok: 5, escalated: { "gate:exit-code": 1 }, usd: 0.0013, latency_ms: 30000 },
  { run_id: "SENTINEL_CRON_RUNID_4", started: "2026-11-09T11:11:00Z", ended: "2026-11-09T11:12:00Z", jobs_flagged: 3, qwen_ok: 3, escalated: {}, usd: 0, latency_ms: 40000 },
]);
const declutterFile = jl("declutter.jsonl", [
  { ts: "2026-11-07T23:16:58+00:00", job: "SENTINEL_DECLUTTER_JOB", tool: "qwen_classify", model: "qwen3-coder:30b", escalated: false, reason: "", latency_ms: 14000, usd: 0.002 },
  { ts: "2026-11-07T23:16:58+00:00", job: "SENTINEL_SESSION_NAME", tool: "qwen_classify", model: "qwen3-coder:30b", escalated: true, reason: "cap", latency_ms: 0 },
  { ts: "2026-11-07T23:17:20+00:00", job: "SENTINEL_SESSION_NAME", tool: "qwen_classify", model: "qwen3-coder:30b", escalated: true, reason: "timeout", latency_ms: 0 },
  { ts: "2026-11-08T07:00:00+00:00", job: "SENTINEL_SESSION_NAME", tool: "qwen_classify", model: "qwen3-coder:30b", escalated: true, reason: "SENTINEL REASON declutter 5521", latency_ms: 0 },
]);
const reapFile = jl("reap.jsonl", [
  { ts: "2026-11-07T23:17:24+00:00", job: "SENTINEL_REAP_JOB", tool: "qwen_classify", model: "claude-haiku-5-5", escalated: true, reason: "needs-name", latency_ms: 0 },
  { ts: "2026-11-07T23:17:24+00:00", job: "SENTINEL_SESSION_NAME", tool: "qwen_classify", model: "claude-haiku-5-5", escalated: true, reason: "needs-del", latency_ms: 0 },
  { ts: "2026-11-07T23:17:25+00:00", job: "SENTINEL_SESSION_NAME", tool: "qwen_classify", model: "claude-haiku-5-5", escalated: true, reason: "needs-name", latency_ms: 0 },
]);
// site#88: learn store-pick is a fourth qwen.jsonl source; its job names, reasons and per-row model strings are sentinels too.
const learnFile = jl("learn.jsonl", [
  { ts: "2026-11-08T12:00:00+00:00", job: "SENTINEL_LEARN_STORE", tool: "qwen_classify", model: "SENTINEL_MODEL_ROW", escalated: false, reason: "", latency_ms: 500 },
  { ts: "2026-11-08T12:00:01+00:00", job: "SENTINEL_LEARN_STORE", tool: "qwen_classify", model: "SENTINEL_MODEL_ROW", escalated: true, reason: "SENTINEL_LEARN_REASON", latency_ms: 0 },
]);
// site#90: history sources. Wrap records carry a session id and the user's asks; PR-sweep rows a stop reason; the cleanup logs a body.
const wrapDir = join(dir, "wrap"); mkdirSync(wrapDir);
for (const [i, d] of [[1, "2026-11-01"], [2, "2026-11-01"], [3, "2026-11-03"]]) {
  const f = join(wrapDir, `rec${i}.json`);
  writeFileSync(f, JSON.stringify({ session_id: "SENTINEL_WRAP_SESSION_ID", asks: [{ text: "SENTINEL_WRAP_ASK" }], claimed: "DONE" }));
  const t = new Date(`${d}T12:00:00Z`); utimesSync(f, t, t);
}
// wrap_row.log: one line per wrap, from 2026-11-03; the JSON record dated 11-03 must then not count (the log owns that day).
writeFileSync(join(wrapDir, "wrap_row.log"), `[2026-11-03T08:00:00Z] argv=[] exit=0 SENTINEL_WRAP_ASK\n[2026-11-03T09:00:00Z] argv=[] exit=0\n[2026-11-05T09:00:00Z] argv=[] exit=0\n`.replace(/\\n/g, "\n"));
const prFile = jl("prsweep.jsonl", [
  { ts: "2026-11-01T09:00:00Z", worked: 3, cost_usd: 1.5, rc: 0, stop_reason: "SENTINEL_PR_STOP", turns: 9, model: "sonnet", budget_usd: 6, repo: "SENTINEL_PR_REPO" },
  { ts: "2026-11-05T09:00:00Z", worked: 1, cost_usd: 0.25, rc: 0, stop_reason: "end_turn", turns: 4, model: "SENTINEL_MODEL_ROW" },
  { ts: "2026-11-08T09:00:00Z", worked: 1, cost_usd: 0.5, rc: 0, stop_reason: "end_turn", turns: 4, model: "claude-opus-5-5" },
]);
const finishLog = join(dir, "finish.log"), sweepLog = join(dir, "sweep.log");
writeFileSync(finishLog, `[2026-11-06T06:00:00Z] argv=[] exit=0 status=clean body="SENTINEL_FINISH_BODY"\n[2026-11-06T07:00:00Z] argv=[--dry-run] exit=0 status=dry body="x"\n[2026-11-08T07:00:00Z] argv=[] exit=0 status=apply body="x"\n`.replace(/\\n/g, "\n"));
writeFileSync(sweepLog, `[2026-11-08T08:00:00Z] argv=[--max 10] exit=0 status=ok body="SENTINEL_SWEEP_BODY"\n[2026-11-08T09:00:00Z] argv=[--dry-run] exit=0 status=dry-run body="x"\n`.replace(/\\n/g, "\n"));
const wfEnv = { QWEN_CRON_RUNS: cronFile, QWEN_DECLUTTER: declutterFile, QWEN_REAP: reapFile, QWEN_LEARN: learnFile, QWEN_AS_OF: "2026-11-08T15:00:00Z",
  QWEN_WRAP_DIR: wrapDir, QWEN_PR_SWEEP: prFile, QWEN_SESSION_FINISH: finishLog, QWEN_DECLUTTER_SWEEP: sweepLog };

const out = execFileSync("python3", ["bin/qwen-state.py"], { encoding: "utf8", env: { ...process.env, ...wfEnv,
  QWEN_RUNS: runs, QWEN_COST_DB: join(dir, "none.db"), QWEN_TAG_LOG: join(dir, "tag.log"), QWEN_TAG_JSONL: join(dir, "tag.jsonl") } });
const keysOf = (o, acc = []) => { if (o && typeof o === "object") for (const [k, v] of Object.entries(o)) { acc.push(k); keysOf(v, acc); } return acc; };

test("exporter keeps the aggregates", () => {
  const d = JSON.parse(out);
  assert.equal(d.share_by_day.triage[0].answered, 1);
  assert.equal(d.share_by_day.triage[0].capped, 1);
  assert.equal(d.fallback_reasons["exit-N"], 1);
  assert.equal(d.fallback_reasons.other, 1);
  assert.equal(d.breakdowns.by_task_label.fyi, 1);
  assert.equal(d.breakdowns.by_task_label.other, 1);
  assert.equal(d.share_by_day["issue-tag"][0].answered, 1);   // the apply=0 dry run (5) is not counted
  assert.equal(d.share_by_day["issue-tag"][0].capped, 2);
});

test("a dry-run sidecar and its audit rows are excluded", () => {
  const d = JSON.parse(out);
  assert.equal(d.share_by_day.triage.length, 1);              // only the 2026-11-07 live run; dry run (9 answered) dropped
  assert.equal(d.share_by_day.triage[0].answered, 1);
  assert.equal(d.fallback_reasons.timeout, 0);                // the dry run's timeouts are not counted
  assert.equal(d.breakdowns.by_task_label.task, 0);
  assert.equal(d.latency_ms.qwen.n, 2);
});

test("Haiku latency comes from live qwen_pair rows that carry latency_ms", () => {
  const h = JSON.parse(out).latency_ms.haiku;
  assert.deepEqual([h.n, h.p50, h.p90], [1, 800, 800]);   // the second pair row has no latency_ms; the dry run's pair row is dropped
});

test("no per-message string reaches the output", () => {
  for (const s of SENTINELS) assert.ok(!out.includes(s), `leaked: ${s}`);
  assert.ok(!/@/.test(out), "an @ reached the output");
});

test("no per-message key reaches the output", () => {
  const keys = new Set(keysOf(JSON.parse(out)));
  for (const k of FORBIDDEN_KEYS) assert.ok(!keys.has(k), `forbidden key: ${k}`);
});

test("committed content/qwen/data.json holds no per-message field", () => {
  const raw = readFileSync("content/qwen/data.json", "utf8");
  const keys = new Set(keysOf(JSON.parse(raw)));
  for (const k of FORBIDDEN_KEYS) assert.ok(!keys.has(k), `forbidden key: ${k}`);
  assert.ok(!/@|"id"|title|subject/.test(raw));
});

test("accuracy comes from the #561 (issue-tag) and #670 (triage) rows", () => {
  const a = JSON.parse(out).accuracy;
  assert.equal(a.shadow_agreement_pct["issue-tag"], 50);   // 1 match of 2 pairs
  assert.equal(a.correction_free_pct["issue-tag"], 50);    // 1 of 2 applied was corrected
  assert.equal(a.shadow_agreement_pct.triage, 50);          // 1 match of 2 pairs
  assert.equal(a.correction_free_pct.triage, 50);           // 2 answered, 1 corrected
  assert.equal(a.pending.shadow_agreement_pct["issue-tag"], "skill-library#561");
  assert.equal(a.pending.correction_free_pct.triage, "mycroft#668");
});

const assets = { fetch: async (r) => new Response(`asset:${new URL(r.url).pathname}`) };
const hit = (p) => worker.fetch(new Request(`https://justingriffiths-site.jg-personal.workers.dev${p}`), { ASSETS: assets });
test("worker: /qwen/ serves the page, not the .info catch-all", async () => {
  assert.equal(await (await hit("/qwen/")).text(), "asset:/qwen/");
  assert.equal(await (await hit("/qwen/data.json")).text(), "asset:/qwen/data.json");
  const r = await hit("/qwen");
  assert.equal(r.status, 301); assert.equal(r.headers.get("location"), "https://justingriffiths-site.jg-personal.workers.dev/qwen/");
});

test("a ramp cap is capped, not a fallback, and a day Qwen answered nothing is not Qwen era", () => {
  // 2026-11-08 07:00 ET: cap 1, Minnie unreachable. One message failed on Qwen (exit-1), one was held by the cap.
  const d2 = mkdtempSync(join(tmpdir(), "qwen-cap-"));
  const r2 = join(d2, "runs"); mkdirSync(r2);
  writeFileSync(join(r2, "20261107-120000-a.json"), JSON.stringify({ mode: "create", qwen: { cap: 1, seen: 1, qwen: 1, escalated: 0, reasons: {} } }));
  writeFileSync(join(r2, "20261108-070000-a.json"), JSON.stringify({ mode: "create", qwen: { cap: 1, seen: 2, qwen: 0, escalated: 2, reasons: { "exit-1": 1, cap: 1 } } }));
  const db = join(d2, "cost.db");
  execFileSync("python3", ["-c", `import sqlite3,sys; c=sqlite3.connect(sys.argv[1]); c.execute("create table runs(ts text, job text, usd real)"); c.executemany("insert into runs values(?,?,?)", [("2026-11-06T12:00:00Z","triage",0.5),("2026-11-07T12:00:00Z","triage",0.4),("2026-11-08T12:00:00Z","triage",0.3)]); c.commit()`, db]);
  const d = JSON.parse(execFileSync("python3", ["bin/qwen-state.py"], { encoding: "utf8", env: { ...process.env,
    QWEN_RUNS: r2, QWEN_COST_DB: db, QWEN_TAG_LOG: join(d2, "none.log"), QWEN_TAG_JSONL: join(d2, "none.jsonl"), QWEN_CRON_RUNS: none, QWEN_DECLUTTER: none, QWEN_REAP: none } }));
  const day8 = d.share_by_day.triage.find((r) => r.day === "2026-11-08");
  assert.deepEqual([day8.answered, day8.fell_back, day8.capped], [0, 1, 1]);
  assert.equal(d.fallback_reasons["exit-N"], 1);
  assert.equal(d.fallback_reasons.other, 0);                  // "cap" is not a failure reason
  const era = Object.fromEntries(d.cost_per_run.triage_by_day.map((r) => [r.day, r.qwen_era]));
  assert.deepEqual(era, { "2026-11-06": false, "2026-11-07": true, "2026-11-08": false });
  assert.equal(d.cost_per_run.triage_qwen_era_usd_per_run, 0.4);
});

test("cron triage, declutter and session-reap are counted as workflows, counts only", () => {
  const w = JSON.parse(out).workflows;
  assert.deepEqual(w["cron-triage"].share_by_day.map((r) => [r.day, r.answered, r.fell_back, r.runs]), [["2026-11-08", 5, 7, 3], ["2026-11-09", 3, 0, 1]]);
  assert.equal(w["cron-triage"].answered, 8); assert.equal(w["cron-triage"].runs, 4); assert.equal(w["cron-triage"].first_logged, "2026-11-08");
  assert.deepEqual(w["cron-triage"].latency_ms, { n: 3, p50: 30000, p90: 40000, unit: "run" });   // the run that flagged nothing logged 0 ms
  assert.equal(w["cron-triage"].usd, 0.008);
  assert.equal(w.declutter.first_logged, "2026-11-07");
  assert.equal(w.declutter.runs, 2);   // 23:16:58, 23:16:58 and 23:17:20 are one sweep (gaps under 2 minutes); 07:00 the next day is another
  assert.deepEqual(w.declutter.share_by_day.map((r) => [r.day, r.answered, r.capped, r.fell_back, r.policy, r.runs]), [["2026-11-07", 1, 1, 1, 0, 1], ["2026-11-08", 0, 0, 1, 0, 1]]);
  assert.deepEqual(w.declutter.latency_ms, { n: 1, p50: 14000, p90: 14000, unit: "item" });
  assert.equal(w.declutter.usd, 0.002);
  assert.deepEqual(w["session-reap"].share_by_day.map((r) => [r.day, r.answered, r.fell_back, r.policy, r.runs]), [["2026-11-07", 0, 0, 3, 1]]);
});

test("policy reasons (needs-name, needs-del) are kept apart from failures", () => {
  const w = JSON.parse(out).workflows["session-reap"];
  assert.equal(w.policy, 3); assert.equal(w.fell_back, 0); assert.deepEqual(w.policy_reasons, { "needs-del": 1, "needs-name": 2 });
  assert.equal(JSON.parse(out).workflows.declutter.policy, 0);   // an unknown reason is a failure, not a policy
});

test("an empty or missing source reads as no runs logged, with no first-logged day", () => {
  const d = JSON.parse(execFileSync("python3", ["bin/qwen-state.py"], { encoding: "utf8", env: { ...process.env, ...wfEnv, QWEN_RUNS: runs, QWEN_COST_DB: join(dir, "none.db"),
    QWEN_TAG_LOG: join(dir, "tag.log"), QWEN_TAG_JSONL: join(dir, "tag.jsonl"), QWEN_CRON_RUNS: none, QWEN_DECLUTTER: jl("blank.jsonl", []) } }));
  for (const k of ["cron-triage", "declutter"]) { assert.equal(d.workflows[k].runs, 0, k); assert.equal(d.workflows[k].first_logged, null, k); assert.deepEqual(d.workflows[k].share_by_day, [], k); }
  assert.equal(d.workflows["session-reap"].runs, 1);
});

test("the exporter output passes the leakcheck the KV writer runs", () => {
  const r = spawnSync("python3", ["bin/qwen-leakcheck.py"], { input: out, encoding: "utf8" });
  assert.equal(r.status, 0, r.stderr);
});

test("the page renders one chart per job with runs and says so for a job with none", async () => {
  const { renderData } = await import("../src/qwen-render.mjs");
  const base = JSON.parse(readFileSync("content/qwen/data.json", "utf8"));
  const d = JSON.parse(out);
  const html = renderData({ ...base, workflows: { ...d.workflows, declutter: { ...d.workflows.declutter, runs: 0, share_by_day: [] } } });
  const sec = html.slice(html.indexOf('id="workflows"'), html.indexOf('id="calls"'));
  assert.match(sec, /Cron triage<\/h3><p class="note">first logged 2026-11-08 · 4 runs · 8 answered by Qwen · 7 fell back to Claude/);
  assert.match(sec, /Declutter<\/h3><p class="empty">No runs logged\.<\/p>/);
  assert.match(sec, /held back by rule \(needs-del 1, needs-name 2\)/);
  assert.equal((sec.match(/<svg /g) || []).length, 1);                           // the one job with 2+ days draws a chart
  assert.match(sec, /<p class="single"><span class="big">\d+<\/span> items on 2026-11-0\d<\/p>/);   // a one-day job is a datapoint, not a bar
  assert.doesNotMatch(sec, /NaN|undefined|0%/);
  assert.doesNotMatch(renderData(base), /NaN|undefined/);   // the older snapshot without workflows still renders
});

test("calls by day: one row per (day, job) with calls, newest first, counts and fixed model names only", () => {
  const rows = JSON.parse(out).calls_by_day;
  const pick = (day, job) => rows.find((r) => r.day === day && r.job === job);
  const n = (r) => [r.calls, r.qwen, r.haiku_fallback, r.haiku_capped, r.haiku_shadow];
  assert.deepEqual(n(pick("2026-11-07", "triage")), [3, 1, 1, 1, 2]);          // seen 3: 1 answered, 1 escalated (exit-2), 1 not offered; both live pair rows land on the run's day
  assert.deepEqual(n(pick("2026-11-07", "issue-tag")), [3, 1, 0, 2, 0]);       // apply=0 dry run dropped; pair rows carry no day
  assert.deepEqual(n(pick("2026-11-08", "cron-triage")), [12, 5, 7, 0, 0]);
  assert.deepEqual(n(pick("2026-11-07", "declutter")), [3, 1, 1, 1, 0]);
  assert.deepEqual(n(pick("2026-11-07", "session-reap")), [3, 0, 0, 3, 0]);    // a fixed rule (needs-name/needs-del) counts under cap, not fallback
  assert.deepEqual(n(pick("2026-11-08", "learn-store-pick")), [2, 1, 1, 0, 0]);
  assert.equal(pick("2026-11-08", "triage"), undefined);                        // a job with no runs that day has no row, not zeros
  const order = rows.map((r) => r.day);
  assert.deepEqual(order, [...order].sort().reverse());
  for (const r of rows) { assert.equal(r.calls, r.qwen + r.haiku_fallback + r.haiku_capped); assert.equal(r.model_qwen, "qwen3-coder:30b"); assert.equal(r.model_haiku, "claude-haiku-5-5"); }
});

test("calls by day: runs before Qwen count as Haiku calls Qwen was not offered, from unique messages per run; dry runs do not", () => {
  const rows = JSON.parse(out).calls_by_day, t = rows.find((r) => r.day === "2026-10-20" && r.job === "triage");
  assert.deepEqual([t.calls, t.qwen, t.haiku_fallback, t.haiku_capped, t.haiku_shadow], [2, 0, 0, 2, 0]);
  assert.equal(rows.find((r) => r.day === "2026-10-19"), undefined);
});

test("Share on Qwen: a chart with one day of data is a single datapoint", async () => {
  const { renderData } = await import("../src/qwen-render.mjs");
  const base = JSON.parse(readFileSync("content/qwen/data.json", "utf8"));
  const one = [{ day: "2026-11-08", answered: 10, fell_back: 1, capped: 2 }];
  const html = renderData({ ...base, share_by_day: { triage: one, "issue-tag": one } });
  const sec = html.slice(html.indexOf('id="share"'), html.indexOf('id="workflows"'));
  assert.equal((sec.match(/<svg /g) || []).length, 0);
  assert.equal((sec.match(/class="single"/g) || []).length, 2);
  assert.match(sec, /<span class="big">13<\/span> items on 2026-11-08/);
});

test("a missing learn source adds no learn rows", () => {
  const d = JSON.parse(execFileSync("python3", ["bin/qwen-state.py"], { encoding: "utf8", env: { ...process.env, ...wfEnv, QWEN_LEARN: none, QWEN_RUNS: runs, QWEN_COST_DB: join(dir, "none.db"),
    QWEN_TAG_LOG: join(dir, "tag.log"), QWEN_TAG_JSONL: join(dir, "tag.jsonl") } }));
  assert.ok(d.calls_by_day.length && !d.calls_by_day.some((r) => r.job === "learn-store-pick"));
});

const row = (day, job, q, fb, cap, shd) => ({ day, job, calls: q + fb + cap, qwen: q, haiku_fallback: fb, haiku_capped: cap, haiku_shadow: shd, model_qwen: "qwen3-coder:30b", model_haiku: "claude-haiku-5-5" });
const callsSec = async (rows) => {
  const { renderData } = await import("../src/qwen-render.mjs");
  const base = JSON.parse(readFileSync("content/qwen/data.json", "utf8"));
  const html = renderData({ ...base, calls_by_day: rows });
  return html.slice(html.indexOf('id="calls"'), html.indexOf('id="history"'));
};

test("calls by day: no table; a job with one day of data is a single datapoint, not a bar", async () => {
  const sec = await callsSec([row("2026-11-08", "cron-triage", 48, 11, 0, 0)]);
  assert.doesNotMatch(sec, /<table|<details/);
  assert.match(sec, /<span class="big">59<\/span> calls on 2026-11-08/);
  assert.match(sec, /48 Qwen · 11 Haiku fallback · 0 Haiku cap/);
  assert.doesNotMatch(sec, /<svg|<rect/);
});

test("calls by day: 2+ days draw one bar per day, empty days included, Haiku shadow a ring outside the stack", async () => {
  const sec = await callsSec([row("2026-11-05", "triage", 2, 1, 0, 3), row("2026-11-08", "triage", 11, 1, 1, 11), row("2026-11-07", "declutter", 2, 0, 2, 0)]);
  const triage = sec.slice(sec.indexOf("Inbox triage"), sec.indexOf("Declutter"));
  assert.equal((triage.match(/<title>2026-1\d-\d\d(?: [^<]*)?<\/title>/g) || []).length >= 4, true);  // 11-05..11-08 = 4 days
  assert.match(triage, /2026-11-06: no calls/);                                  // gap day drawn empty, not skipped
  assert.match(triage, /2026-11-07: no calls/);
  assert.equal((triage.match(/<circle /g) || []).length, 2);                    // one ring per day with shadow calls
  assert.match(triage, /<text[^>]*>11-05<\/text>/);
  assert.equal((triage.match(/<text[^>]*text-anchor="(?:start|middle|end)">\d\d-\d\d<\/text>/g) || []).length <= 3, true);   // few ticks for a phone
  assert.match(sec, /<span class="big">4<\/span> calls on 2026-11-07/);           // declutter: one day only -> datapoint beside triage's chart
  assert.doesNotMatch(sec, /NaN|undefined/);
  const { renderData } = await import("../src/qwen-render.mjs");
  assert.doesNotMatch(renderData(JSON.parse(readFileSync("content/qwen/data.json", "utf8"))), /NaN|undefined/);
});

// site#90: history and savings per command.
const hist = () => Object.fromEntries(JSON.parse(out).history.commands.map((c) => [c.command, c]));

test("history: run counts match the sources, dollars sum, a day with no record is absent", () => {
  const h = hist();
  assert.equal(h.wrap.runs, 5); assert.deepEqual(h.wrap.days.map((d) => [d.day, d.runs]), [["2026-11-01", 2], ["2026-11-03", 2], ["2026-11-05", 1]]);   // log from its first day, JSON before it
  assert.equal(h.wrap.usd, null); assert.deepEqual(h.wrap.days[0].models, { "not logged": 2 });
  assert.equal(h["pr-sweep"].runs, 3); assert.equal(h["pr-sweep"].usd, 2.25);
  assert.deepEqual(h["pr-sweep"].days.map((d) => d.usd_models), [{ sonnet: 1.5 }, { other: 0.25 }, { opus: 0.5 }]);
  assert.deepEqual(h["pr-sweep"].days.map((d) => d.models), [{ sonnet: 1 }, { other: 1 }, { opus: 1 }]);   // an unknown model string is "other"
  assert.equal(h["session-cleanup"].runs, 3);                                                              // dry-run lines are not runs
  assert.deepEqual(h["session-cleanup"].days.find((d) => d.day === "2026-11-08").models, { script: 2 });
});

test("history: 7-day savings compares the last 7 days with the 7 before; no logged cost says so", () => {
  const h = hist();
  assert.deepEqual(h["pr-sweep"].savings, { cost_logged: true, last7_runs: 2, last7_usd: 0.75, prior7_runs: 1, prior7_usd: 1.5 });
  assert.equal(h.wrap.savings.cost_logged, false); assert.equal(h.wrap.savings.last7_usd, null);
  assert.equal(h["session-cleanup"].marker.day, "2026-11-07");   // first day a Qwen answer landed in declutter or session-reap
  assert.equal(h.wrap.marker, null);
});

test("history: no session id, ask text, repo or log body reaches the output", () => {
  for (const sent of ["SENTINEL_WRAP_SESSION_ID", "SENTINEL_WRAP_ASK", "SENTINEL_PR_REPO", "SENTINEL_PR_STOP", "SENTINEL_SWEEP_BODY", "SENTINEL_FINISH_BODY"]) assert.equal(out.includes(sent), false, sent);
});

test("history charts: empty days drawn, one day is a number, no savings guess without a logged cost", async () => {
  const { renderData } = await import("../src/qwen-render.mjs");
  const h = JSON.parse(out), page = renderData(h), sec = page.slice(page.indexOf('id="history"'), page.indexOf('id="fallbacks"'));
  assert.match(sec, /Cost not logged, so no savings figure/);
  assert.match(sec, /\$0\.75 over 2 runs, against \$1\.50 over 1 run\b/);
  assert.match(sec, /2026-11-02: no runs/);
  assert.doesNotMatch(sec, /NaN|undefined/);
  const one = { ...h, history: { through: "2026-11-08", commands: [{ ...h.history.commands[0], days: [h.history.commands[0].days[0]], runs: 2 }] } };
  const s1 = renderData(one); const sec1 = s1.slice(s1.indexOf('id="history"'), s1.indexOf('id="fallbacks"'));
  assert.match(sec1, /<span class="big">2<\/span> runs on 2026-11-01/); assert.doesNotMatch(sec1, /<rect/);
});

test("history charts: PR sweep bar height is dollars per day, other commands stay runs", async () => {
  const { renderData } = await import("../src/qwen-render.mjs");
  const page = renderData(JSON.parse(out)), sec = page.slice(page.indexOf('id="history"'), page.indexOf('id="fallbacks"'));
  assert.match(sec, /PR sweeps dollars per day by model/); assert.match(sec, /bar height is dollars per day/);
  assert.match(sec, /Wrap runs per day by model/); assert.match(sec, /2026-11-01 Sonnet: \$1\.50, 1 run/);
});

// site#94: a source that stopped writing is flagged, not charted as a drop to zero.
test("stale sources: wrap's session records stopped while its run log kept writing; nothing else is flagged", () => {
  const h = hist();
  assert.deepEqual(h.wrap.stale_sources, [{ source: "wrap session records", last_day: "2026-11-03", covered: true }]);
  assert.deepEqual(h["pr-sweep"].stale_sources, []); assert.deepEqual(h["session-cleanup"].stale_sources, []);
});

test("stale sources: when every source of a command is quiet, each is flagged as not covered", () => {
  const later = JSON.parse(execFileSync("python3", ["bin/qwen-state.py"], { encoding: "utf8", env: { ...process.env, ...wfEnv, QWEN_AS_OF: "2026-12-01T00:00:00Z",
    QWEN_RUNS: runs, QWEN_COST_DB: join(dir, "none.db"), QWEN_TAG_LOG: join(dir, "tag.log"), QWEN_TAG_JSONL: join(dir, "tag.jsonl") } }));
  for (const c of later.history.commands) { assert.ok(c.stale_sources.length, c.command); assert.ok(c.stale_sources.every((x) => x.covered === false), c.command); }
});

test("stale sources: the page says which source stopped and when, only under that command, and the output stays leakcheck-clean", async () => {
  const { renderData } = await import("../src/qwen-render.mjs");
  const page = renderData(JSON.parse(out)), sec = page.slice(page.indexOf('id="history"'), page.indexOf('id="fallbacks"'));
  assert.match(sec, /Source wrap session records stopped on 2026-11-03; runs since then come from the command's other source/);
  assert.doesNotMatch(sec, /missing, not zero|has no record since/);
  assert.equal((sec.match(/stale-source/g) || []).length, 1);
  const idle = JSON.parse(out); idle.history.commands.forEach((c) => { c.stale_sources = c.command === "pr-sweep" ? [{ source: "pr-sweep runs", last_day: "2026-11-01", covered: false }] : []; });
  const si = renderData(idle); assert.match(si, /Source pr-sweep runs has no record since 2026-11-01\./);
  assert.doesNotMatch(si, /runs since then come from/);
  const fresh = JSON.parse(out); fresh.history.commands.forEach((c) => { c.stale_sources = []; });
  assert.doesNotMatch(renderData(fresh), /last wrote on/);
  const r = spawnSync("python3", ["bin/qwen-leakcheck.py"], { input: out, encoding: "utf8" });
  assert.equal(r.status, 0, r.stderr);
});
