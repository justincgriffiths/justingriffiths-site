import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";

const run = (script, args, env = {}) =>
  spawnSync("bash", [script, ...args], { encoding: "utf8", env: { PATH: process.env.PATH, ...env } });
const fx = { ACCESS_APPS_JSON: "test/fixtures-apps.json" };

test("access-login --dry-run plans both apps and needs no secrets", () => {
  const r = run("bin/access-login.sh", ["--dry-run", "v@example.com"]);
  assert.equal(r.status, 0);
  assert.match(r.stdout, /justingriffiths\.com\/fleet/);
  assert.match(r.stdout, /justingriffiths\.com\/marketing-101/);
  assert.match(r.stdout, /v@example\.com/);
});
test("access-login with no emails exits 2", () => assert.equal(run("bin/access-login.sh", ["--dry-run"]).status, 2));
test("access-allow list reads the policy", () => {
  const r = run("bin/access-allow.sh", ["list"], fx);
  assert.equal(r.status, 0);
  assert.match(r.stdout, /a@example\.com/);
});
test("access-allow add is a dry run on fixtures and keeps non-email rules", () => {
  const r = run("bin/access-allow.sh", ["add", "b@example.com"], fx);
  assert.equal(r.status, 0);
  assert.match(r.stdout, /1 -> 2 allowed/);
});
test("access-allow refuses to empty an allowlist", () => {
  const r = run("bin/access-allow.sh", ["remove", "a@example.com"], fx);
  assert.equal(r.status, 1);
  assert.match(r.stderr, /empty allowlist/);
});
