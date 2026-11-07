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
const clean = JSON.parse(readFileSync("content/qwen/data.json", "utf8")); // real shape: the refresh now runs the full site build on it

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

// The refresh builds with bin/site-build.sh, so dist/ always carries the four /fleet/ pages (stubbed here: no cargo in tests).
const stub = (body) => { const f = join(dir, "stub-" + Math.random().toString(36).slice(2) + ".sh"); writeFileSync(f, "#!/usr/bin/env bash\n" + body, { mode: 0o755 }); return f; };
const runWith = (fleetBuild) => spawnSync("bin/qwen-refresh.sh", ["--no-deploy"], { encoding: "utf8",
  env: { ...process.env, QWEN_REFRESH_STATE: join(dir, "sb" + Math.random()), QWEN_REFRESH_REF: "HEAD",
    QWEN_REFRESH_DATA: (() => { const f = join(dir, "d2.json"); writeFileSync(f, JSON.stringify(clean)); return f; })(), FLEET_BUILD: fleetBuild } });
const fleetStub = '# PAGE selects the sub-page\nd=dist/fleet${PAGE:+/$PAGE}; mkdir -p "$d"; echo x > "$d/index.html"\n';

test("refresh build lists fleet/index.html and the three sub-pages", () => {
  const r = runWith(stub(fleetStub));
  assert.equal(r.status, 0, r.stdout);
  for (const p of ["./index.html", "./bike-factory/index.html", "./seats/index.html", "./battle-school/index.html"]) assert.ok(r.stdout.includes(p), `missing ${p} in: ${r.stdout}`);
});

test("a fleet page that does not build fails the refresh (exit 1)", () => {
  const r = runWith(stub('[ "$PAGE" = seats ] && exit 1\n' + fleetStub));
  assert.equal(r.status, 1); assert.match(r.stdout, /site build failed/);
});

test("a fleet step that exits 0 without writing the page still fails", () => {
  const r = runWith(stub("exit 0\n"));
  assert.equal(r.status, 1); assert.match(r.stdout, /site build failed/);
});
