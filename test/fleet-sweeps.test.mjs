import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, writeFileSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

// Calls sweeps() from bin/fleet-state.py on summary files shaped like routine-library#261's summary.json.
const read = (files) => {
  const py = 'import importlib.util,json;s=importlib.util.spec_from_file_location("fs","bin/fleet-state.py");m=importlib.util.module_from_spec(s);s.loader.exec_module(m);print(json.dumps(m.sweeps()))';
  const r = spawnSync("python3", ["-c", py], { encoding: "utf8", env: { PATH: process.env.PATH, HOME: process.env.HOME, FLEET_SWEEP_FILES: files.join(":") } });
  assert.equal(r.status, 0, r.stderr);
  return { rows: JSON.parse(r.stdout), stdout: r.stdout };
};
const dir = mkdtempSync(join(tmpdir(), "sweeps-"));
const put = (name, doc) => { const f = join(dir, name); writeFileSync(f, JSON.stringify(doc)); return f; };
const good = { schema: 1, host: "justins-macbook-air", run_at: "2026-11-07T23:00:00Z", status: "ok", removed: 2, tombstoned: 1, left: 3, errors: 0, leftover_issue: "justincgriffiths/routine-library#260" };

test("sweeps keeps host, run time and the four counts", () => {
  const { rows } = read([put("a.json", good)]);
  assert.deepEqual(rows, [{ host: "justins-macbook-air", run_at: "2026-11-07T23:00:00Z", status: "ok", removed: 2, tombstoned: 1, left: 3, errors: 0 }]);
});

test("privacy: leftover_issue and any extra name, id or path never reach the panel data", () => {
  const planted = { ...good, session_name: "AGT_BLD_secret-client-thing", session_id: "0b9c1e52-aaaa-bbbb-cccc-1234567890ab", path: "/Users/justin/.claude/jobs/cd9f31c4", reason: "needs Justin: client-x", nested: { name: "DEL_foo" } };
  const { rows, stdout } = read([put("b.json", planted)]);
  assert.equal(rows.length, 1);
  assert.deepEqual(Object.keys(rows[0]).sort(), ["errors", "host", "left", "removed", "run_at", "status", "tombstoned"]);
  for (const needle of ["leftover_issue", "routine-library", "#260", "AGT_BLD", "secret-client", "0b9c1e52", "/Users/", "jobs", "client-x", "DEL_foo", "session"]) {
    assert.ok(!stdout.includes(needle), `panel data leaked ${needle}`);
  }
});

test("privacy: a name or path smuggled into host, run_at or a count drops the whole row", () => {
  const bad = [{ host: "/Users/justin/x" }, { host: "AGT_BLD_x" }, { host: "ok host" }, { run_at: "yesterday /Users/j" }, { status: "DEL_x" }, { left: "3 sessions" }, { removed: -1 }, { errors: true }, { schema: 2 }];
  const files = bad.map((o, i) => put(`bad${i}.json`, { ...good, ...o }));
  assert.deepEqual(read(files).rows, []);
});

test("missing or unreadable summary gives an empty list, not a failure", () => {
  assert.deepEqual(read([join(dir, "nope.json")]).rows, []);
});

test("the committed fixture's sweeps carry only the allowed fields", () => {
  const fx = JSON.parse(readFileSync("fleet/fixture.json", "utf8"));
  assert.ok(fx.sweeps.length > 0);
  for (const r of fx.sweeps) assert.deepEqual(Object.keys(r).sort(), ["errors", "host", "left", "removed", "run_at", "status", "tombstoned"]);
});

test("gating: the sweeps ride the existing /fleet/state.json route; no new route, no public file", () => {
  const w = readFileSync("src/worker.js", "utf8");
  assert.ok(!/sweep/i.test(w), "worker needs no sweeps route");
  const kv = readFileSync("bin/fleet-kv.sh", "utf8");
  assert.match(kv, /fleet-state\.py/);
});
