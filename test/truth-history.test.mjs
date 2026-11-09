import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

// site#119: past ground truth rebuilt from transcripts and the agt-ledger log. Fixture transcripts only; the real ones hold private text.
const dir = mkdtempSync(join(tmpdir(), "truth-hist-"));
const proj = join(dir, "projects", "p"); mkdirSync(proj, { recursive: true });
const J = (a) => a.map((r) => JSON.stringify(r)).join("\n") + "\n";
const rec = (type, ts, extra = {}) => ({ type, timestamp: ts, sessionKind: "bg", cwd: "/SENTINEL_CWD", message: { content: "SENTINEL_MESSAGE_TEXT" }, ...extra });
// A: named AGT_, turn ends 10:00, resumed 12:00. B: named AGT_ then renamed DEL_ between 12:30 and 12:40, so out of scope after. C: a title written between two records (name unprovable at 13:30).
writeFileSync(join(proj, "aaaaaaaa-0000.jsonl"), J([rec("user", "2026-11-01T09:00:00Z"), { type: "custom-title", customTitle: "AGT_SENTINEL_TITLE_A", sessionId: "a" }, rec("assistant", "2026-11-01T09:30:00Z"),
  rec("system", "2026-11-01T10:00:00Z", { subtype: "turn_duration" }), rec("system", "2026-11-01T10:00:01Z", { subtype: "stop_hook_summary" }), rec("user", "2026-11-01T12:00:00Z"), rec("assistant", "2026-11-01T12:10:00Z")]));
writeFileSync(join(proj, "bbbbbbbb-0000.jsonl"), J([{ type: "custom-title", customTitle: "AGT_SENTINEL_TITLE_B" }, rec("user", "2026-11-01T09:00:00Z"), rec("system", "2026-11-01T09:10:00Z", { subtype: "turn_duration" }),
  rec("user", "2026-11-01T12:30:00Z"), { type: "custom-title", customTitle: "DEL_SENTINEL_TITLE_B" }, rec("assistant", "2026-11-01T12:40:00Z"), rec("system", "2026-11-01T12:41:00Z", { subtype: "turn_duration" })]));
writeFileSync(join(proj, "cccccccc-0000.jsonl"), J([rec("user", "2026-11-01T09:00:00Z"), { type: "custom-title", customTitle: "AGT_SENTINEL_TITLE_C" }, rec("assistant", "2026-11-01T13:00:00Z"), rec("system", "2026-11-01T13:50:00Z", { subtype: "turn_duration" })]));
// An interactive session never counts.
writeFileSync(join(proj, "dddddddd-0000.jsonl"), J([{ type: "custom-title", customTitle: "AGT_SENTINEL_TITLE_D" }, { ...rec("user", "2026-11-01T09:00:00Z"), sessionKind: "interactive" }, { ...rec("system", "2026-11-01T09:10:00Z", { subtype: "turn_duration" }), sessionKind: "interactive" }, { ...rec("user", "2026-11-01T23:00:00Z"), sessionKind: "interactive" }]));

const ledger = join(dir, "agt-ledger.log"), finish = join(dir, "finish.log"), sweep = join(dir, "sweep.log");
const L = (ts, argv, n, live) => `[${ts}] argv=${argv} exit=1 sessions=${n} live=${live}`;
writeFileSync(ledger, [L("2026-11-01T10:59:58Z", "['--json']", 1, 0), L("2026-11-01T12:59:58Z", "['--json']", 0, 0), L("2026-11-01T14:59:58Z", "['--json']", 2, 1), L("2026-11-01T15:59:58Z", "['--md']", 0, 0)].join("\n") + "\n");
writeFileSync(finish, [`[2026-11-01T11:00:00Z] argv=[] exit=0 status=apply body="1 session(s), 1 action(s), 1 applied"`,    // A idle at 11:00: 1 from the transcript
  `[2026-11-01T13:00:00Z] argv=[] exit=0 status=clean body="no idle AGT_ session to work (0 busy, 0 handled <24h)"`,         // ledger counts 0 sessions: 0
  `[2026-11-01T15:00:00Z] argv=[] exit=0 status=clean body="no idle AGT_ session to work (1 busy, 5 handled <24h)"`,          // 2 sessions, 1 live: unproven, so unknown
  `[2026-11-01T16:00:00Z] argv=[] exit=0 status=clean body="x"`,                                                              // only an ad-hoc --md call: no match, unknown
  `[2026-11-01T17:00:00Z] argv=[--dry-run] exit=0 status=dry body="x"`].join("\n") + "\n");
writeFileSync(sweep, `[2026-11-01T13:00:30Z] argv=[--max 10] exit=0 status=ok tombstoned=0 refused=0 removed=0 laned=0 drafted=0 body="x"\n[2026-11-01T11:00:30Z] argv=[--max 10] exit=0 status=ok tombstoned=1 refused=0 removed=0 laned=0 drafted=0 body="x"\n`);
// handled.tsv is the job's own 24h back-off list. Only A was handled in the day before 11:00, so B is eligible and the run is work either way.
const handledA = join(dir, "handled-a.tsv"), handledAB = join(dir, "handled-ab.tsv");
writeFileSync(handledA, "2026-11-01T05:00:00Z\taaaaaaaa\n2026-10-30T05:00:00Z\tbbbbbbbb\n");
writeFileSync(handledAB, "2026-11-01T05:00:00Z\taaaaaaaa\n2026-11-01T06:00:00Z\tbbbbbbbb\n");
const idx = join(dir, "sessions.jsonl"), out = join(dir, "history.jsonl");
const env = { ...process.env, QWEN_TRANSCRIPTS: join(dir, "projects"), QWEN_TRUTH_SESSIONS: idx, QWEN_TRUTH_HISTORY: out, QWEN_AGT_LEDGER_LOG: ledger, QWEN_HANDLED: handledA, QWEN_SESSION_FINISH: finish, QWEN_DECLUTTER_SWEEP: sweep };
const py = (...a) => execFileSync("python3", ["bin/truth-history.py", ...a], { encoding: "utf8", env });

test("index is bounded and resumes: --limit 1 reads one transcript, the next call reads the next", () => {
  assert.match(py("index", "--limit", "1"), /indexed 1 transcripts, 1 in the index, 3 left/);
  assert.match(py("index", "--limit", "100"), /indexed 3 transcripts, 4 in the index, 0 left/);
  assert.match(py("index", "--limit", "100"), /indexed 0 transcripts/);
});

test("the index keeps ids, times and name classes only: no name, text or cwd", () => {
  const raw = readFileSync(idx, "utf8");
  for (const sent of ["SENTINEL_TITLE", "SENTINEL_MESSAGE_TEXT", "SENTINEL_CWD", "AGT_"]) assert.equal(raw.includes(sent), false, sent);
});

test("runs: ledger zero is 0, a transcript-proven idle AGT_ session is 1, an unprovable run is unknown", () => {
  py("runs", "--write");
  const rows = readFileSync(out, "utf8").trim().split("\n").map((l) => JSON.parse(l));
  const at = (ts, job = "session-finish") => rows.find((r) => r.ts === ts && r.job === job);
  assert.deepEqual([at("2026-11-01T11:00:00Z").work_existed, at("2026-11-01T11:00:00Z").method, at("2026-11-01T11:00:00Z").n_idle], [1, "transcript", 2]);   // A and B are both AGT_ and idle at 11:00 (B is renamed DEL_ only at 12:30+)
  assert.deepEqual([at("2026-11-01T13:00:00Z").work_existed, at("2026-11-01T13:00:00Z").method], [0, "ledger"]);
  assert.deepEqual([at("2026-11-01T15:00:00Z").work_existed, at("2026-11-01T15:00:00Z").method, at("2026-11-01T15:00:00Z").n_nonlive], [null, "unproven", 1]);
  assert.deepEqual([at("2026-11-01T16:00:00Z").work_existed, at("2026-11-01T16:00:00Z").n_nonlive], [null, null]);   // the --md call is not matched
  assert.equal(rows.some((r) => r.ts === "2026-11-01T17:00:00Z"), false);                                          // dry run: not a run
  assert.equal(at("2026-11-01T13:00:30Z", "declutter-sweep").work_existed, 0);                                    // the sweep gets 0 from the ledger ...
  assert.equal(at("2026-11-01T11:00:30Z", "declutter-sweep").work_existed, null);                                  // ... and never 1 from a transcript
  assert.deepEqual(Object.keys(rows[0]).sort(), ["job", "method", "n_eligible", "n_idle", "n_nonlive", "ts", "work_existed", "work_existed_b"]);
  assert.equal(at("2026-11-01T11:00:00Z").n_eligible, 1);                                                          // A is backed off, B is not
  assert.equal(readFileSync(out, "utf8").includes("SENTINEL"), false);
});

test("name in force: a title with no time is bracketed by its neighbours; an overlapping later title makes the class unprovable", () => {
  const spec = `import importlib.util,json
sp=importlib.util.spec_from_file_location("t","bin/truth-history.py"); t=importlib.util.module_from_spec(sp); sp.loader.exec_module(t)
T=[["A","2026-11-01T09:00:00.000Z","2026-11-01T09:30:00.000Z"],["N","2026-11-01T12:30:00.000Z","2026-11-01T12:40:00.000Z"]]
print(json.dumps([t.name_class(T,x) for x in ("2026-11-01T08:00:00.000Z","2026-11-01T10:00:00.000Z","2026-11-01T12:35:00.000Z","2026-11-01T13:00:00.000Z")]))`;
  const r = spawnSync("python3", ["-c", spec], { encoding: "utf8", env });
  assert.equal(r.status, 0, r.stderr);
  assert.deepEqual(JSON.parse(r.stdout), [null, "A", "?", "N"]);                       // not named yet; AGT_; the rename may or may not have happened; renamed
});

test("the exporter reads the history by run ts: a known row fills work_existed, a null row stays unknown, the page's ground truth date moves", () => {
  const sc = { QWEN_AS_OF: "2026-11-02T00:00:00Z", PGPASSWORD: "", QWEN_RUNS: join(dir, "none"), QWEN_COST_DB: join(dir, "none"), QWEN_TAG_LOG: join(dir, "none"), QWEN_TAG_JSONL: join(dir, "none"), QWEN_DECLUTTER: join(dir, "none"),
    QWEN_REAP: join(dir, "none"), QWEN_LEARN: join(dir, "none"), QWEN_WRAP_DIR: join(dir, "none"), QWEN_PR_SWEEP: join(dir, "none"), QWEN_CRON_RUNS: join(dir, "none"), QWEN_JOBS_DIR: join(dir, "none") };
  const d = JSON.parse(execFileSync("python3", ["bin/qwen-state.py"], { encoding: "utf8", env: { ...env, ...sc } }));
  const f = d.truth.jobs.find((j) => j.job === "session-finish");
  assert.equal(f.n, 4); assert.equal(f.from_history, 2);                           // 11:00 (1) and 13:00 (0); 15:00 and 16:00 stay unknown
  assert.equal(f.found_work, 1); assert.equal(f.quiet, 1); assert.equal(f.work_unknown, 2);
  assert.equal(f.ground_truth_from, "2026-11-01");
});

test("24h back-off is a switch: the job's own rule (a) and back-off counts as work (b) give two segment sets, counts only", () => {
  const both = join(dir, "history-ab.jsonl");
  execFileSync("python3", ["bin/truth-history.py", "runs", "--write"], { encoding: "utf8", env: { ...env, QWEN_HANDLED: handledAB, QWEN_TRUTH_HISTORY: both } });
  const r = readFileSync(both, "utf8").trim().split("\n").map((l) => JSON.parse(l)).find((x) => x.ts === "2026-11-01T11:00:00Z" && x.job === "session-finish");
  assert.deepEqual([r.work_existed, r.work_existed_b, r.n_idle, r.n_eligible, r.method], [0, 1, 2, 0, "transcript+backoff"]);   // both idle sessions backed off, and the ledger's one non-live session is one of them
  const sc = { QWEN_AS_OF: "2026-11-02T00:00:00Z", PGPASSWORD: "", QWEN_RUNS: join(dir, "none"), QWEN_COST_DB: join(dir, "none"), QWEN_TAG_LOG: join(dir, "none"), QWEN_TAG_JSONL: join(dir, "none"), QWEN_DECLUTTER: join(dir, "none"),
    QWEN_REAP: join(dir, "none"), QWEN_LEARN: join(dir, "none"), QWEN_WRAP_DIR: join(dir, "none"), QWEN_PR_SWEEP: join(dir, "none"), QWEN_CRON_RUNS: join(dir, "none"), QWEN_JOBS_DIR: join(dir, "none"), QWEN_TRUTH_HISTORY: both };
  const seg = (b) => { const f = JSON.parse(execFileSync("python3", ["bin/qwen-state.py"], { encoding: "utf8", env: { ...env, ...sc, ...(b ? { QWEN_BACKOFF: b } : {}) } })).truth.jobs.find((j) => j.job === "session-finish"); return [f.missed, f.found_work, f.false_alarm, f.quiet, f.work_unknown]; };
  assert.deepEqual(seg(), [0, 0, 1, 1, 2]);    // default is (a): no work existed at 11:00, and the run found one (false alarm)
  assert.deepEqual(seg("a"), [0, 0, 1, 1, 2]);
  assert.deepEqual(seg("b"), [0, 1, 0, 1, 2]); // (b): the same run is work and found
});
