import { test } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtempSync, writeFileSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

// bin/qwen-refresh.sh (never deploys, site#78): the privacy gate and the build, from the current HEAD snapshot.
const dir = mkdtempSync(join(tmpdir(), "qrefresh-"));
// Runs the script in its own process group and kills the whole group on timeout, so a hung build leaves no orphans.
const exec = (env, ms = 30000) => new Promise((resolve) => {
  const c = spawn("bin/qwen-refresh.sh", ["--no-deploy"], { detached: true, env: { ...process.env, ...env } });
  let stdout = ""; c.stdout.on("data", (d) => (stdout += d)); c.stderr.resume();
  const timer = setTimeout(() => { try { process.kill(-c.pid, "SIGKILL"); } catch {} }, ms);
  c.on("close", (status, sig) => { clearTimeout(timer); try { process.kill(-c.pid, "SIGKILL"); } catch {} resolve({ status: sig ? 124 : status, stdout }); });
});
// The npm build and the meta page are stubbed: these tests cover the gates, not the site build.
const writeStub = (body) => { const f = join(dir, "stub-" + Math.random().toString(36).slice(2) + ".sh"); writeFileSync(f, "#!/usr/bin/env bash\n" + body, { mode: 0o755 }); return f; };
const npmStub = writeStub("mkdir -p dist\n");
const metaStub = writeStub("mkdir -p dist/fleet/meta; echo x > dist/fleet/meta/index.html\n");
const fleetOk = writeStub('# PAGE selects the sub-page\nd=dist/fleet${PAGE:+/$PAGE}; mkdir -p "$d"; echo x > "$d/index.html"\n');
const dataFile = (data) => { const f = join(dir, "data.json"); writeFileSync(f, JSON.stringify(data)); return f; };
const baseEnv = (data, state, fleetBuild = fleetOk) => ({ QWEN_REFRESH_STATE: state, QWEN_REFRESH_REF: "HEAD", QWEN_REFRESH_DATA: dataFile(data),
  FLEET_BUILD: fleetBuild, SITE_NPM_BUILD: npmStub, SITE_META_BUILD: metaStub, SITE_COPYGATE: "true" });
const run = (data, state) => exec(baseEnv(data, state));
const clean = JSON.parse(readFileSync("content/qwen/data.json", "utf8")); // real shape of the data the gates see

test("clean data passes the gates and is not deployed", async () => {
  const r = await run(clean, join(dir, "s1"));
  assert.equal(r.status, 0); assert.match(r.stdout, /privacy gate clean; --no-deploy/);
});

test("a planted per-message field blocks with a non-zero exit and names the rule, not the value", async () => {
  for (const bad of [{ ...clean, subject: "SENTINEL SUBJECT" }, { ...clean, note: "sender-sentinel@example.com" }]) {
    const r = await run(bad, join(dir, "s3"));
    assert.equal(r.status, 1); assert.match(r.stdout, /PRIVACY GATE BLOCKED/);
    assert.ok(!/SENTINEL|sentinel@/.test(r.stdout), "the leaked value was echoed");
  }
});

// The refresh builds with bin/site-build.sh, so dist/ always carries the four /fleet/ pages (stubbed here: no cargo in tests).
const stub = (body) => writeStub(body);
const runWith = (fleetBuild) => exec(baseEnv(clean, join(dir, "sb" + Math.random()), fleetBuild));
const fleetStub = '# PAGE selects the sub-page\nd=dist/fleet${PAGE:+/$PAGE}; mkdir -p "$d"; echo x > "$d/index.html"\n';

test("refresh build lists fleet/index.html and the three sub-pages", async () => {
  const r = await runWith(stub(fleetStub));
  assert.equal(r.status, 0, r.stdout);
  for (const p of ["./index.html", "./bike-factory/index.html", "./seats/index.html", "./battle-school/index.html"]) assert.ok(r.stdout.includes(p), `missing ${p} in: ${r.stdout}`);
});

test("a fleet page that does not build fails the refresh (exit 1)", async () => {
  const r = await runWith(stub('[ "$PAGE" = seats ] && exit 1\n' + fleetStub));
  assert.equal(r.status, 1); assert.match(r.stdout, /site build failed/);
});

test("a fleet step that exits 0 without writing the page still fails", async () => {
  const r = await runWith(stub("exit 0\n"));
  assert.equal(r.status, 1); assert.match(r.stdout, /site build failed/);
});
