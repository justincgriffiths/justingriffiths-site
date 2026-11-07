import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, writeFileSync, readFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

// bin/qwen-refresh.sh with --no-deploy: the change gate and the privacy gate, from the current HEAD snapshot.
const dir = mkdtempSync(join(tmpdir(), "qrefresh-"));
const run = (data, state) => {
  const f = join(dir, "data.json"); writeFileSync(f, JSON.stringify(data));
  return spawnSync("bin/qwen-refresh.sh", ["--no-deploy"], { encoding: "utf8",
    env: { ...process.env, QWEN_REFRESH_STATE: state, QWEN_REFRESH_REF: "HEAD", QWEN_REFRESH_DATA: f } });
};
const clean = { schema: 1, share_by_day: { triage: [{ day: "2026-11-07", answered: 3 }] } };

test("changed + clean data passes the gates and is not deployed", () => {
  const r = run(clean, join(dir, "s1"));
  assert.equal(r.status, 0); assert.match(r.stdout, /privacy gate clean; --no-deploy/);
});

test("unchanged data exits 0 with nothing to deploy", () => {
  const state = join(dir, "s2");
  spawnSync("mkdir", ["-p", state]);
  const sum = spawnSync("shasum", ["-a", "256"], { input: JSON.stringify(clean), encoding: "utf8" }).stdout.split(" ")[0];
  writeFileSync(join(state, "last-deployed.sha256"), sum + "\n");
  const r = run(clean, state);
  assert.equal(r.status, 0); assert.match(r.stdout, /unchanged/);
});

test("a planted per-message field blocks with a non-zero exit and names the rule, not the value", () => {
  for (const bad of [{ ...clean, subject: "SENTINEL SUBJECT" }, { ...clean, note: "sender-sentinel@example.com" }]) {
    const r = run(bad, join(dir, "s3"));
    assert.equal(r.status, 1); assert.match(r.stdout, /PRIVACY GATE BLOCKED/);
    assert.ok(!/SENTINEL|sentinel@/.test(r.stdout), "the leaked value was echoed");
    assert.ok(!existsSync(join(dir, "s3", "last-deployed.sha256")));
  }
});
