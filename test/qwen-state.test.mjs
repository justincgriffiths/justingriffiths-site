import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import worker from "../src/worker.js";

// PUBLIC page: poison every source with per-message fields; none may reach the exporter output.
const SENTINELS = ["SENTINEL_MSGID_9f3a", "SENTINEL SUBJECT Q3 invoice", "sender-sentinel@example.com", "SENTINEL_ISSUE_TITLE", "secret-repo-sentinel", "SENTINEL_ACCOUNT", "SENTINEL REASON free text 8841"];
const FORBIDDEN_KEYS = ["id", "ids", "subject", "sender", "from", "title", "number", "repo", "account", "context", "input", "message_id", "email", "report"];

const dir = mkdtempSync(join(tmpdir(), "qwen-"));
const runs = join(dir, "runs"); mkdirSync(runs);
writeFileSync(join(runs, "20261107-142909-SENTINEL_ACCOUNT.json"), JSON.stringify({ account: "SENTINEL_ACCOUNT", report: "SENTINEL_MSGID_9f3a.md", cost_usd: 0.4,
  qwen: { cap: 1, seen: 3, qwen: 1, escalated: 1, reasons: { "SENTINEL REASON free text 8841": 1, "exit-2": 1 } } }));
writeFileSync(join(runs, "20261107-142909-SENTINEL_ACCOUNT.audit.jsonl"), [
  { tool: "qwen_classify", id: "SENTINEL_MSGID_9f3a", subject: "SENTINEL SUBJECT Q3 invoice", from: "sender-sentinel@example.com", label: "SENTINEL SUBJECT Q3 invoice", escalated: false, reason: "", latency_ms: 1500 },
  { tool: "qwen_classify", id: "SENTINEL_MSGID_9f3a", label: "fyi", escalated: false, latency_ms: 900 },
  { tool: "Agent", input: { prompt: "SENTINEL SUBJECT Q3 invoice sender-sentinel@example.com" } },
].map((r) => JSON.stringify(r)).join("\n") + "\n");
writeFileSync(join(dir, "tag.log"), "[2026-11-07T06:00:00Z] argv=[secret-repo-sentinel personal limit=1] exit=0 tagged=1 failed=0 qwen_used=1 fallback_to_haiku=0 haiku_direct=2\n");
writeFileSync(join(dir, "tag.jsonl"), JSON.stringify({ number: 7771234, title: "SENTINEL_ISSUE_TITLE", repo: "secret-repo-sentinel", model: "qwen3-coder:30b", cost_usd: 0 }) + "\n");

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
  assert.equal(d.share_by_day["issue-tag"][0].answered, 1);
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

test("accuracy slots stay null until mycroft#668 / skill-library#560 land", () => {
  const a = JSON.parse(out).accuracy;
  assert.equal(a.shadow_agreement_pct.triage, null);
  assert.equal(a.pending.correction_free_pct, "skill-library#560");
});

const assets = { fetch: async (r) => new Response(`asset:${new URL(r.url).pathname}`) };
const hit = (p) => worker.fetch(new Request(`https://justingriffiths.com${p}`), { ASSETS: assets });
test("worker: /qwen/ serves the page, not the .info catch-all", async () => {
  assert.equal(await (await hit("/qwen/")).text(), "asset:/qwen/");
  assert.equal(await (await hit("/qwen/data.json")).text(), "asset:/qwen/data.json");
  const r = await hit("/qwen");
  assert.equal(r.status, 301); assert.equal(r.headers.get("location"), "https://justingriffiths.com/qwen/");
});
