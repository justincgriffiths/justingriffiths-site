import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import worker from "../src/worker.js";

// PUBLIC page: poison every source with per-message fields; none may reach the exporter output.
const SENTINELS = ["SENTINEL_MSGID_9f3a", "SENTINEL SUBJECT Q3 invoice", "sender-sentinel@example.com", "SENTINEL_ISSUE_TITLE", "secret-repo-sentinel", "SENTINEL_ACCOUNT", "SENTINEL REASON free text 8841", "SENTINEL_LABEL_xyz", "secret-repo-sentinel2", "7771299", "SENTINEL_PAIR_LABEL", "SENTINEL_MSGID_PAIR", "SENTINEL_CORR_ISSUE_8842"];
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

const out = execFileSync("python3", ["bin/qwen-state.py"], { encoding: "utf8", env: { ...process.env,
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
