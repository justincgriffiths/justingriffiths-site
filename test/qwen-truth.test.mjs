import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

// site#119: the truth matrix (work existed / identified / correct, each 1, 0 or unknown) and every-run counting, from fixture logs.
const dir = mkdtempSync(join(tmpdir(), "qwen-truth-"));
const none = join(dir, "none");
const lines = (a) => a.join("\n") + "\n";

// session-finish: one fixture per cell. New-format lines carry idle_agt / idle_ids / planned after body; the two old lines carry none.
const finish = join(dir, "finish.log");
writeFileSync(finish, lines([
  `[2026-11-10T01:00:00Z] argv=[] exit=0 status=clean body="SENTINEL_FINISH_BODY" idle_agt=2 idle_ids=aaaaaaaa,bbbbbbbb planned=0`,        // miss: work, not found
  `[2026-11-10T02:00:00Z] argv=[] exit=0 status=apply body="x" idle_agt=1 idle_ids=aaaaaaaa planned=1`,                                  // found work
  `[2026-11-10T03:00:00Z] argv=[] exit=0 status=apply body="x" idle_agt=0 idle_ids=- planned=1`,                                        // no work, found
  `[2026-11-10T04:00:00Z] argv=[] exit=0 status=clean body="x" idle_agt=0 idle_ids=- planned=0`,                                        // no work, quiet
  `[2026-11-10T05:00:00Z] argv=[] exit=0 status=clean body="x" idle_agt=unknown idle_ids=- planned=0`,                                   // ledger not read: work unknown
  `[2026-11-10T06:00:00Z] argv=[--dry-run] exit=0 status=dry body="x" idle_agt=3 idle_ids=- planned=1`,                                  // dry run: not a run
  `[2026-11-02T12:00:00Z] argv=[] exit=0 status=apply body="x"`,                                                                      // old line, a session sat done: rebuilt as work
  `[2026-11-05T12:00:00Z] argv=[] exit=0 status=clean body="x"`,                                                                      // old line, no session done then: unknown
]));
// declutter sweep: should_handle against tombstoned (routine-library#274), plus an old line without it.
const sweep = join(dir, "sweep.log");
writeFileSync(sweep, lines([
  `[2026-11-10T01:00:00Z] argv=[--max 10] exit=1 status=miss should_handle=2 tombstoned=0 gate_refused=0 missed=2 refused=0 removed=0 laned=0 drafted=0 body="SENTINEL_SWEEP_BODY"`,
  `[2026-11-10T02:00:00Z] argv=[--max 10] exit=0 status=ok should_handle=1 tombstoned=1 gate_refused=0 missed=0 refused=0 removed=0 laned=0 drafted=0 body="x"`,
  `[2026-11-10T03:00:00Z] argv=[--max 10] exit=0 status=ok should_handle=0 tombstoned=1 gate_refused=0 missed=0 refused=0 removed=0 laned=0 drafted=0 body="x"`,
  `[2026-11-10T04:00:00Z] argv=[--max 10] exit=0 status=ok should_handle=0 tombstoned=0 gate_refused=0 missed=0 refused=0 removed=0 laned=0 drafted=0 body="x"`,
  `[2026-11-10T05:00:00Z] argv=[--max 10] exit=0 status=ok should_handle=1 tombstoned=0 gate_refused=1 missed=0 refused=0 removed=0 laned=0 drafted=0 body="x"`,
  `[2026-11-03T05:00:00Z] argv=[--max 10] exit=0 status=ok tombstoned=2 refused=0 removed=0 laned=1 drafted=0 body="x"`,              // old line, did something: found, work unknown
  `[2026-11-03T06:00:00Z] argv=[--max 10] exit=0 status=ok tombstoned=0 refused=0 removed=0 laned=0 drafted=0 body="x"`,              // old line, did nothing: quiet, work unknown
  `[2026-11-03T07:00:00Z] argv=[--dry-run] exit=0 status=dry-run should_handle=4 body="x"`,
]));
// pr-sweep and cron triage: no ground truth in either source.
const pr = join(dir, "pr.jsonl");
writeFileSync(pr, lines([
  { ts: "2026-11-05T09:00:00Z", enumerated: 3, worked: 2, cost_usd: 0.5, model: "sonnet" },
  { ts: "2026-11-06T09:00:00Z", enumerated: 0, worked: 0, cost_usd: 0.1, model: "sonnet" },
].map((r) => JSON.stringify(r))));
const cron = join(dir, "cron.jsonl");
writeFileSync(cron, lines([
  { run_id: "SENTINEL_CRON_RUNID", started: "2026-11-05T09:00:00Z", jobs_flagged: 3, qwen_ok: 3, escalated: {}, usd: 0.001 },
  { run_id: "x", started: "2026-11-05T10:00:00Z", jobs_flagged: 2, qwen_ok: 0, escalated: { "gate:cause": 2 }, usd: 0.002 },
  { run_id: "y", started: "2026-11-05T11:00:00Z", jobs_flagged: 0, qwen_ok: 0, escalated: {}, usd: 0 },
].map((r) => JSON.stringify(r))));
// Background-job state: an AGT_ session done from 11-02 to 11-04, a blocked one, a non-AGT one. Names are sentinels: they must not leave the exporter.
const jobs = join(dir, "jobs");
const job = (short, name, created, tl) => { const d = join(jobs, short); mkdirSync(d, { recursive: true });
  writeFileSync(join(d, "state.json"), JSON.stringify({ name, createdAt: created, state: "working" }));
  writeFileSync(join(d, "timeline.jsonl"), lines(tl.map(([at, state]) => JSON.stringify({ at, state, detail: "SENTINEL_JOB_DETAIL" })))); };
job("aaaa1111", "AGT_SENTINEL_NAME", "2026-11-01T00:00:00.000Z", [["2026-11-01T01:00:00.000Z", "working"], ["2026-11-02T00:00:00.000Z", "done"], ["2026-11-04T00:00:00.000Z", "working"]]);
job("bbbb2222", "AGT_SENTINEL_BLOCKED", "2026-11-01T00:00:00.000Z", [["2026-11-01T01:00:00.000Z", "working"], ["2026-11-02T00:00:00.000Z", "blocked"]]);
job("cccc3333", "SENTINEL_YOU_SESSION", "2026-11-01T00:00:00.000Z", [["2026-11-02T00:00:00.000Z", "done"]]);

const env = { ...process.env, PGPASSWORD: "", QWEN_AS_OF: "2026-11-10T12:00:00Z", QWEN_RUNS: none, QWEN_COST_DB: none, QWEN_TAG_LOG: none, QWEN_TAG_JSONL: none, QWEN_DECLUTTER: none, QWEN_REAP: none,
  QWEN_LEARN: none, QWEN_WRAP_DIR: join(dir, "nowrap"), QWEN_SESSION_FINISH: finish, QWEN_DECLUTTER_SWEEP: sweep, QWEN_PR_SWEEP: pr, QWEN_CRON_RUNS: cron, QWEN_JOBS_DIR: jobs };
const run = (extra = {}) => execFileSync("python3", ["bin/qwen-state.py"], { encoding: "utf8", env: { ...env, ...extra } });
const out = run(), data = JSON.parse(out);
const job_ = (k) => data.truth.jobs.find((j) => j.job === k);

test("session finish: a fixture for every cell, dry runs dropped, unknown never counted as zero", () => {
  const j = job_("session-finish");
  assert.equal(j.n, 7);                                                   // 8 lines, one dry
  assert.equal(j.missed, 1); assert.equal(j.found_work, 2);               // the log's own found work, plus the rebuilt old apply line
  assert.equal(j.false_alarm, 1); assert.equal(j.quiet, 1);
  assert.equal(j.work_unknown, 2); assert.equal(j.work_unknown_quiet, 2); assert.equal(j.work_unknown_found, 0);   // idle_agt=unknown, and the old line nothing rebuilt
  assert.equal(j.missed + j.found_work + j.false_alarm + j.quiet + j.work_unknown, j.n);
  assert.equal(j.from_log, 5); assert.equal(j.reconstructed, 1);
  assert.equal(j.ground_truth_from, "2026-11-02");                        // first run with a known work_existed: the rebuilt one
});

test("reconstruction rule: only a done AGT_ session proves work; absence of one is unknown, never zero", () => {
  const spec = `import importlib.util,json
sp=importlib.util.spec_from_file_location("q","bin/qwen-state.py"); q=importlib.util.module_from_spec(sp); sp.loader.exec_module(q)
S=[("2026-11-01T00:00:00.000Z",[("2026-11-01T01:00:00.000Z","working"),("2026-11-02T00:00:00.000Z","done"),("2026-11-04T00:00:00.000Z","working")])]
T=("2026-10-31T00:00:00Z","2026-11-01T12:00:00Z","2026-11-02T00:00:00Z","2026-11-03T00:00:00Z","2026-11-04T00:00:01Z")
print(json.dumps([q.jobs_idle_at(t,S) for t in T]+[q.jobs_idle_at(T[3],[])]))`;
  const r = spawnSync("python3", ["-c", spec], { encoding: "utf8", env });
  assert.equal(r.status, 0, r.stderr);
  // before it existed, while working, done, still done, working again, and no session at all
  assert.deepEqual(JSON.parse(r.stdout), [false, false, true, true, false, false]);
  const ft = job_("session-finish");
  assert.equal(ft.reconstructed, 1);                                      // the blocked AGT_ session and the non-AGT done one prove nothing
});

test("declutter sweep: should_handle against handled; a gate refusal is handled; old lines keep unknown work", () => {
  const j = job_("declutter-sweep");
  assert.equal(j.n, 7);                                                   // 8 lines, one dry-run
  assert.equal(j.missed, 1); assert.equal(j.found_work, 2);               // 2 should-handle, 0 tombstoned = miss; tombstoned 1 and gate-refused 1 are found
  assert.equal(j.false_alarm, 1); assert.equal(j.quiet, 1);
  assert.equal(j.work_unknown, 2); assert.equal(j.work_unknown_found, 1); assert.equal(j.work_unknown_quiet, 1);
  assert.equal(j.ground_truth_from, "2026-11-10"); assert.equal(j.reconstructed, 0);
});

test("pr sweeps and cron triage: found is the run's own count, work existed and right stay unknown", () => {
  for (const [k, found, quiet] of [["pr-sweep", 1, 1], ["cron-triage", 2, 1]]) {
    const j = job_(k);
    assert.equal(j.work_unknown, j.n); assert.equal(j.work_unknown_found, found); assert.equal(j.work_unknown_quiet, quiet);
    assert.equal(j.missed + j.found_work + j.false_alarm + j.quiet, 0); assert.equal(j.ground_truth_from, null);
    assert.equal(j.correct_unknown, found); assert.equal(j.found_right + j.found_wrong, 0);
  }
});

test("matrix cells: right, wrong and unknown are counted apart, and only for runs that found work", () => {
  const spec = `import importlib.util,json
sp=importlib.util.spec_from_file_location("q","bin/qwen-state.py"); q=importlib.util.module_from_spec(sp); sp.loader.exec_module(q)
r=lambda w,i,c,d="2026-11-01": {"day":d,"work":w,"ident":i,"correct":c,"src":"log"}
print(json.dumps(q.matrix([r(1,1,1),r(1,1,0),r(1,1,None),r(1,0,None),r(0,1,0),r(0,0,None),r(None,1,None),r(None,0,None,"2026-10-30"),r(None,None,None)])))`;
  const r = spawnSync("python3", ["-c", spec], { encoding: "utf8", env });
  assert.equal(r.status, 0, r.stderr);
  const m = JSON.parse(r.stdout);
  assert.deepEqual([m.n, m.found_work, m.missed, m.false_alarm, m.quiet], [9, 3, 1, 1, 1]);
  assert.deepEqual([m.found_right, m.found_wrong, m.correct_unknown], [1, 2, 2]);                 // right: row 1; wrong: rows 2 and 5; unknown: rows 3 and 7
  assert.deepEqual([m.work_unknown, m.work_unknown_found, m.work_unknown_quiet, m.identified_unknown], [3, 1, 1, 1]);
  assert.equal(m.ground_truth_from, "2026-11-01");
});

test("every run counts: idle checks are runs, dry runs are not, a model-less job is a script at $0", () => {
  const h = Object.fromEntries(data.history.commands.map((c) => [c.command, c]));
  assert.equal(h["session-cleanup"].runs, 14);                            // 7 finish + 7 sweep, every idle check included
  assert.deepEqual(h["session-cleanup"].days.find((d) => d.day === "2026-11-10").models, { script: 10 });
  assert.equal(h["session-cleanup"].usd, 0);
  assert.equal(h["pr-sweep"].runs, 2);                                    // the run that worked nothing still counts
  assert.equal(h["cron-triage"].runs, 3); assert.deepEqual(h["cron-triage"].days[0].models, { script: 1, "qwen3-coder:30b": 1, haiku: 1 });
  assert.equal(h["cron-triage"].usd, 0.003);
});

test("cost est.: null without telemetry, never zero; with telemetry it is the skill's spend over that day's runs", () => {
  const wrap = join(dir, "wrap"); mkdirSync(wrap);
  writeFileSync(join(wrap, "wrap_row.log"), lines([`[2026-11-04T09:00:00Z] argv=[] exit=0`, `[2026-11-04T10:00:00Z] argv=[] exit=0`, `[2026-11-02T10:00:00Z] argv=[] exit=0`]));
  const fx = join(dir, "sc.json");
  writeFileSync(fx, JSON.stringify([{ day: "2026-11-04", skill: "wrap", model: "opus", main: true, usd: 1.5, requests: 10 }, { day: "2026-11-04", skill: "", model: "haiku", main: true, usd: 9, requests: 3 }]));
  const without = JSON.parse(run({ QWEN_WRAP_DIR: wrap })).history.commands.find((c) => c.command === "wrap");
  assert.equal(without.estimate, null); assert.equal(without.usd, null);
  const withTel = JSON.parse(run({ QWEN_WRAP_DIR: wrap, QWEN_SKILL_COST_FIXTURE: fx })).history.commands.find((c) => c.command === "wrap");
  assert.deepEqual(withTel.estimate, { usd: 1.5, runs_covered: 2, runs_uncovered: 1, since: "2026-11-04" });
  assert.deepEqual(withTel.days.map((d) => [d.day, d.est_usd]), [["2026-11-02", null], ["2026-11-04", 1.5]]);
  assert.equal(withTel.usd, null);                                        // an estimate never becomes a logged cost
});

test("leakcheck: counts and dates only; no session name, job detail, body or run id leaves the exporter", () => {
  for (const sent of ["SENTINEL_FINISH_BODY", "SENTINEL_SWEEP_BODY", "SENTINEL_JOB_DETAIL", "AGT_SENTINEL", "SENTINEL_YOU_SESSION", "SENTINEL_CRON_RUNID", "aaaaaaaa", "aaaa1111"]) assert.equal(out.includes(sent), false, sent);
  const r = spawnSync("python3", ["bin/qwen-leakcheck.py"], { input: out, encoding: "utf8" });
  assert.equal(r.status, 0, r.stderr);
});

test("segments: every mapping cell lands in exactly one segment and the segments sum to n", async () => {
  const { renderData } = await import("../src/qwen-render.mjs");
  // One run in each cell the exporter counts: miss, found with work, found with no work, found with work unknown, quiet, work unknown and quiet, found unknown.
  const cells = { n: 7, missed: 1, found_work: 1, false_alarm: 1, quiet: 1, work_unknown: 2, work_unknown_found: 1, work_unknown_quiet: 1, identified_unknown: 1, found_right: 0, found_wrong: 0, correct_unknown: 4, ground_truth_from: "2026-11-01" };
  const page = renderData({ ...data, truth: { jobs: [{ job: "session-finish", ...cells }] } });
  const segs = Object.fromEntries([...page.matchAll(/Session finish (Missed|Found|Quiet|Unknown): (\d+) of 7/g)].map((m) => [m[1], +m[2]]));
  // work_unknown_quiet (1) and identified_unknown (1) are the only runs that are neither missed, found nor quiet.
  assert.deepEqual(segs, { Missed: 1, Found: 3, Quiet: 1, Unknown: 2 });
  assert.equal(Object.values(segs).reduce((a, b) => a + b, 0), 7);
  assert.match(page, /Session finish: 7 runs, 5 with ground truth, 1 missed, 3 found, 1 quiet, 2 unknown\./);
  // The exporter's own fixtures: every job's four segments sum to n.
  const page2 = renderData(data);
  for (const j of data.truth.jobs) {
    const got = [...page2.matchAll(new RegExp(`${{ "session-finish": "Session finish", "declutter-sweep": "Declutter sweep", "pr-sweep": "PR sweeps", "cron-triage": "Cron triage" }[j.job]} (?:Missed|Found|Quiet|Unknown): (\\d+) of ${j.n}`, "g"))].reduce((a, m) => a + +m[1], 0);
    assert.equal(got, j.n, j.job);
  }
});

test("page: one bar per job, one counts-only line per job, the raw cells in a closed scrolling element", async () => {
  const { renderData } = await import("../src/qwen-render.mjs");
  const page = renderData(data), sec = page.slice(page.indexOf('id="truth"'), page.indexOf('id="fallbacks"'));
  assert.equal((sec.match(/<svg/g) || []).length, 1);
  assert.equal((sec.match(/class="note truth-line"/g) || []).length, 4);
  assert.match(sec, /Session finish: 7 runs, 5 with ground truth, 1 missed, 3 found, 1 quiet, 2 unknown\./);
  assert.match(sec, /PR sweeps: 2 runs, 0 with ground truth, 0 missed, 1 found, 0 quiet, 1 unknown\./);
  assert.match(sec, /Session finish: 1 missed/);                                   // the aria label carries the counts
  const rects = [...sec.matchAll(/Session finish (Missed|Found|Quiet|Unknown): (\d+) of 7/g)].map((m) => [m[1], +m[2]]);
  assert.deepEqual(rects, [["Missed", 1], ["Found", 3], ["Quiet", 1], ["Unknown", 2]]);   // misses left-most, in order
  assert.match(sec, /<details class="truth-rows"><summary>Show all runs<\/summary>/);
  assert.doesNotMatch(sec, /<details[^>]*\bopen\b/);                                // closed by default
  assert.match(sec, /class="truth-scroll" tabindex="0" role="region"/);
  assert.match(sec, /Ground truth from<\/th><td>2026-11-02<\/td>/); assert.match(sec, /none yet/);
  assert.doesNotMatch(sec, /NaN|undefined|null/);
  assert.match(page, /Cost est\.: not available in this snapshot/);
  assert.doesNotThrow(() => renderData({ ...data, truth: undefined }));            // an older snapshot without the block still renders
  assert.match(renderData({ ...data, truth: { jobs: [] } }), /No truth matrix logged yet/);
});
